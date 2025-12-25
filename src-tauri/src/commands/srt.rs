use whisper_rs::{WhisperContext, FullParams, SamplingStrategy, WhisperContextParameters, DtwParameters, DtwMode, DtwModelPreset};
use tauri::{AppHandle, Runtime, Manager, Emitter};
use hound;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct SrtProgress {
    pub percentage: u32,
    pub processed_ms: u64,
    pub total_ms: u64,
    pub status: String,
}

/// Convert any media file to 16kHz mono WAV using ffmpeg
fn convert_to_wav(input_path: &str, output_path: &str) -> Result<(), String> {
    let input = Path::new(input_path);
    if !input.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-i").arg(input_path)
        .arg("-vn")
        .arg("-ac").arg("1")
        .arg("-ar").arg("16000")
        .arg("-acodec").arg("pcm_s16le")
        .arg("-f").arg("wav")
        .arg(output_path)
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}. Is ffmpeg installed?", e))?;

    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        return Err(format!("ffmpeg conversion failed: {}", stderr));
    }

    if !Path::new(output_path).exists() {
        return Err("ffmpeg completed but output file was not created".to_string());
    }

    Ok(())
}

/// Check if file needs conversion
fn needs_conversion(path: &str) -> bool {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if matches!(ext.as_str(), "mp4" | "mkv" | "webm" | "mov" | "avi" | "m4v") {
        return true;
    }
    if matches!(ext.as_str(), "mp3" | "m4a" | "flac" | "ogg" | "opus" | "aac" | "wma") {
        return true;
    }
    if ext == "wav" {
        if let Ok(reader) = hound::WavReader::open(path) {
            let spec = reader.spec();
            if spec.sample_rate == 16000 && spec.channels == 1 && spec.bits_per_sample == 16 {
                return false;
            }
        }
    }
    true
}

/// Format milliseconds to SRT timestamp format: 00:00:00,000
fn format_srt_timestamp(ms: i64) -> String {
    let total_seconds = ms / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    let millis = ms % 1000;
    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
}

/// A single subtitle entry
#[derive(Clone, Debug)]
struct SubtitleEntry {
    start_ms: i64,
    end_ms: i64,
    text: String,
}

/// Energy-based VAD - returns true if segment has speech
fn has_speech(samples: &[f32], threshold: f32) -> bool {
    if samples.is_empty() {
        return false;
    }
    let energy: f32 = samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32;
    energy > threshold
}


/// Format subtitles with line breaks for readability (max 42 chars per line)
fn format_subtitle_text(text: &str) -> String {
    let max_line_length = 42;
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines: Vec<String> = Vec::new();
    let mut current_line = String::new();

    for word in words {
        if current_line.is_empty() {
            current_line = word.to_string();
        } else if current_line.len() + 1 + word.len() <= max_line_length {
            current_line = format!("{} {}", current_line, word);
        } else {
            lines.push(current_line);
            current_line = word.to_string();
            if lines.len() >= 2 {
                // Max 2 lines reached, stop
                break;
            }
        }
    }
    
    if !current_line.is_empty() && lines.len() < 2 {
        lines.push(current_line);
    }

    lines.join("\n")
}

/// Generate SRT content from subtitles
fn generate_srt_content(subtitles: &[SubtitleEntry]) -> String {
    let mut content = String::new();
    
    for (i, sub) in subtitles.iter().enumerate() {
        // Subtitle number
        content.push_str(&format!("{}\n", i + 1));
        // Timestamp line
        content.push_str(&format!(
            "{} --> {}\n",
            format_srt_timestamp(sub.start_ms),
            format_srt_timestamp(sub.end_ms)
        ));
        // Text with proper line breaks
        content.push_str(&format_subtitle_text(&sub.text));
        content.push_str("\n\n");
    }

    content
}

#[tauri::command]
pub async fn generate_srt<R: Runtime>(
    app: AppHandle<R>,
    audio_path: String,
    model: String,
    output_path: String,
    translate: bool,
    use_gpu: bool,
    duplicate_mode: String, // "overwrite" or "rename"
) -> Result<String, String> {
    // Emit starting progress
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 0,
        processed_ms: 0,
        total_ms: 0,
        status: "loading_model".to_string(),
    });

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(format!("ggml-{}.bin", model.to_lowercase()));
    
    if !model_path.exists() {
        return Err("Model not found. Please download it first.".to_string());
    }

    // Map model name to DTW preset for precise timestamps
    let dtw_preset = match model.to_lowercase().as_str() {
        "tiny.en" => Some(DtwModelPreset::TinyEn),
        "tiny" => Some(DtwModelPreset::Tiny),
        "base.en" => Some(DtwModelPreset::BaseEn),
        "base" => Some(DtwModelPreset::Base),
        "small.en" => Some(DtwModelPreset::SmallEn),
        "small" => Some(DtwModelPreset::Small),
        "medium.en" => Some(DtwModelPreset::MediumEn),
        "medium" => Some(DtwModelPreset::Medium),
        "large" | "large-v1" => Some(DtwModelPreset::LargeV1),
        "large-v2" => Some(DtwModelPreset::LargeV2),
        "large-v3" => Some(DtwModelPreset::LargeV3),
        _ => None, // Unknown model, skip DTW
    };
    
    let mut params = WhisperContextParameters::default();
    
    // Enable DTW for precise millisecond timestamps if model is supported
    if let Some(preset) = dtw_preset {
        println!("[SRT] Enabling DTW with {:?} preset for precise timestamps", preset);
        params.dtw_parameters(DtwParameters {
            mode: DtwMode::ModelPreset { model_preset: preset },
            dtw_mem_size: 1024 * 1024 * 128, // 128MB for DTW computation
        });
    }
    
    #[cfg(any(feature = "cuda", feature = "vulkan", feature = "rocm"))]
    {
        params.use_gpu(use_gpu);
    }
    let _ = use_gpu; // Suppress warning when no GPU features

    let ctx = WhisperContext::new_with_params(&model_path.to_string_lossy(), params)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    let mut state = ctx.create_state().map_err(|e| format!("Failed to create state: {}", e))?;

    // Emit model loaded
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 5,
        processed_ms: 0,
        total_ms: 0,
        status: "converting".to_string(),
    });

    // Convert media if needed
    let wav_path: String;
    let temp_wav: Option<String>;
    
    if needs_conversion(&audio_path) {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("whisper_srt_{}.wav", std::process::id()));
        wav_path = temp_file.to_string_lossy().to_string();
        convert_to_wav(&audio_path, &wav_path)?;
        temp_wav = Some(wav_path.clone());
    } else {
        wav_path = audio_path.clone();
        temp_wav = None;
    }

    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 10,
        processed_ms: 0,
        total_ms: 0,
        status: "loading_audio".to_string(),
    });

    // Load and process audio
    let mut reader = hound::WavReader::open(&wav_path)
        .map_err(|e| {
            // Clean up temp file on error
            if let Some(ref temp) = temp_wav {
                let _ = std::fs::remove_file(temp);
            }
            format!("Failed to open wav file: {}", e)
        })?;
    let spec = reader.spec();

    let raw_samples: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap_or(0)).collect();
    let mut samples: Vec<f32> = raw_samples.iter().map(|&s| s as f32 / 32768.0).collect();
    
    // Stereo to Mono
    if spec.channels == 2 {
        samples = samples.chunks(2).map(|chunk| (chunk[0] + chunk[1]) / 2.0).collect();
    } else if spec.channels > 2 {
        return Err("Unsupported channel count".to_string());
    }

    // Resample to 16kHz if necessary
    let sample_rate = spec.sample_rate;
    if sample_rate != 16000 {
        let ratio = sample_rate as f32 / 16000.0;
        let new_len = (samples.len() as f32 / ratio) as usize;
        let mut new_samples = Vec::with_capacity(new_len);
        
        for i in 0..new_len {
            let old_idx_f = i as f32 * ratio;
            let idx_floor = old_idx_f.floor() as usize;
            let idx_ceil = (idx_floor + 1).min(samples.len() - 1);
            let t = old_idx_f - idx_floor as f32;
            let val = samples[idx_floor] * (1.0 - t) + samples[idx_ceil] * t;
            new_samples.push(val);
        }
        samples = new_samples;
    }

    let total_duration_ms = (samples.len() as f64 / 16.0) as u64; // 16000 samples per second = 16 per ms

    // Emit audio loaded
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 10,
        processed_ms: 0,
        total_ms: total_duration_ms,
        status: "preprocessing".to_string(),
    });

    // Simple VAD preprocessing - detect speech regions
    // Very low threshold to only skip ABSOLUTE silence, not quiet speech
    let chunk_size = 16000 / 10; // 100ms chunks
    let vad_threshold = 0.00001; // Very low - only skip near-zero energy (true silence)
    let mut speech_regions: Vec<(usize, usize)> = Vec::new();
    let mut in_speech = false;
    let mut speech_start: usize = 0;

    for (i, chunk) in samples.chunks(chunk_size).enumerate() {
        let is_speech = has_speech(chunk, vad_threshold);
        
        if is_speech && !in_speech {
            speech_start = i * chunk_size;
            in_speech = true;
        } else if !is_speech && in_speech {
            // Add some padding
            let padding = chunk_size * 2;
            let end = (i * chunk_size + padding).min(samples.len());
            speech_regions.push((speech_start.saturating_sub(padding), end));
            in_speech = false;
        }
    }
    
    // Handle case where speech continues to end
    if in_speech {
        speech_regions.push((speech_start.saturating_sub(chunk_size * 2), samples.len()));
    }

    // If no speech detected, process entire audio
    if speech_regions.is_empty() {
        speech_regions.push((0, samples.len()));
    }

    // Reset cancellation flag
    crate::SRT_CANCELLED.store(false, std::sync::atomic::Ordering::SeqCst);

    // Configure Whisper params for precise timestamps
    let mut whisper_params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    whisper_params.set_language(Some("auto"));
    whisper_params.set_translate(translate);
    whisper_params.set_print_special(false);
    whisper_params.set_print_progress(false);
    whisper_params.set_print_realtime(false);
    whisper_params.set_print_timestamps(false);
    
    // ENABLE token timestamps for precise millisecond timing
    whisper_params.set_token_timestamps(true);
    // Set maximum segment length for better granularity (in tokens)
    whisper_params.set_max_len(0); // 0 = no limit, let natural breaks happen
    
    // CRITICAL: Suppress non-speech tokens to prevent [Music], [BLANK_AUDIO] hallucinations
    whisper_params.set_suppress_blank(true);
    whisper_params.set_suppress_non_speech_tokens(true);
    
    // Lower thresholds for better low voice capture
    // no_speech_thold: lower = more sensitive to quiet speech
    // entropy_thold: higher = allow more uncertain segments (catches quiet voices)
    if translate {
        whisper_params.set_no_speech_thold(0.1); // Very lenient for translation
        whisper_params.set_logprob_thold(-2.0);
    } else {
        whisper_params.set_no_speech_thold(0.3); // More lenient than before (was 0.6)
        whisper_params.set_logprob_thold(-1.5);
    }
    // Do NOT set max_len - let Whisper create natural sentence-length segments

    // Emit transcribing status
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 20,
        processed_ms: 0,
        total_ms: total_duration_ms,
        status: "transcribing".to_string(),
    });

    // Check for cancellation before transcription
    if crate::SRT_CANCELLED.load(std::sync::atomic::Ordering::SeqCst) {
        if let Some(temp) = temp_wav {
            let _ = std::fs::remove_file(&temp);
        }
        return Err("Cancelled by user".to_string());
    }

    // Simple time-based progress during transcription (progress callback was causing crashes)
    let app_clone = app.clone();
    let total_ms = total_duration_ms;
    let audio_duration_secs = total_duration_ms as f64 / 1000.0;
    let estimated_process_time = (audio_duration_secs * 0.5).max(5.0);
    
    let progress_running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let progress_running_clone = progress_running.clone();
    
    std::thread::spawn(move || {
        let start = std::time::Instant::now();
        loop {
            if !progress_running_clone.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            if crate::SRT_CANCELLED.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            
            let elapsed = start.elapsed().as_secs_f64();
            let progress = (elapsed / estimated_process_time).min(1.0);
            let percentage = 20 + (progress * 60.0) as u32;
            let estimated_processed = (progress * total_ms as f64) as u64;
            
            let _ = app_clone.emit("srt-progress", SrtProgress {
                percentage,
                processed_ms: estimated_processed,
                total_ms,
                status: "transcribing".to_string(),
            });
            
            std::thread::sleep(std::time::Duration::from_millis(200)); // Update every 200ms
        }
    });

    // Process FULL audio in one pass for natural sentence segmentation
    let result = state.full(whisper_params, &samples);
    
    // Stop progress thread
    progress_running.store(false, std::sync::atomic::Ordering::SeqCst);
    
    result.map_err(|e| format!("Failed to run model: {}", e))?;

    // Emit progress after transcription
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 85,
        processed_ms: total_duration_ms,
        total_ms: total_duration_ms,
        status: "processing_segments".to_string(),
    });

    // Extract segments (natural sentences from Whisper)
    let num_segments = state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {}", e))?;
    
    let mut all_tokens: Vec<(i64, i64, String)> = Vec::new();
    
    for seg_idx in 0..num_segments {
        let seg_start = state.full_get_segment_t0(seg_idx).unwrap_or(0);
        let seg_end = state.full_get_segment_t1(seg_idx).unwrap_or(0);
        let seg_text = state.full_get_segment_text(seg_idx).unwrap_or_default();
        
        // Convert centiseconds to milliseconds
        let start_ms = seg_start as i64 * 10;
        let end_ms = seg_end as i64 * 10;
        
        // Filter hallucinations - be more careful to not filter legitimate text
        let lower = seg_text.to_lowercase();
        let trimmed = seg_text.trim();
        
        // Skip common hallucination patterns
        if lower.contains("subscribe") || lower.contains("amara.org") || 
           lower.contains("subtitles by") || lower.contains("transcribed by") ||
           lower.contains("(speaking") {
            continue;
        }
        
        // Skip pure annotation segments like "[Music]", "[Applause]", etc.
        // But keep segments that have actual text alongside annotations
        if trimmed.starts_with('[') && trimmed.ends_with(']') && !trimmed.contains(' ') {
            // Pure annotation like "[Music]" or "[Applause]"
            continue;
        }
        
        // Remove inline annotations but keep the text
        let cleaned_text = trimmed
            .replace("[Music]", "")
            .replace("[music]", "")
            .replace("[Applause]", "")
            .replace("[applause]", "")
            .replace("[Laughter]", "")
            .replace("[laughter]", "")
            .trim()
            .to_string();

        if !cleaned_text.is_empty() {
            all_tokens.push((start_ms, end_ms, cleaned_text));
        }
    }

    // Emit generating SRT
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 90,
        processed_ms: total_duration_ms,
        total_ms: total_duration_ms,
        status: "generating_srt".to_string(),
    });

    // Use Whisper's segments directly (they are already natural sentences)
    let subtitles: Vec<SubtitleEntry> = all_tokens.iter()
        .map(|(start, end, text)| SubtitleEntry {
            start_ms: *start,
            end_ms: *end,
            text: text.clone(),
        })
        .collect();

    // Generate SRT content
    let srt_content = generate_srt_content(&subtitles);

    // Emit generating file
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 95,
        processed_ms: total_duration_ms,
        total_ms: total_duration_ms,
        status: "saving_file".to_string(),
    });

    // Save to file
    let mut final_output_path = PathBuf::from(&output_path);
    
    // Handle duplicate files
    if duplicate_mode == "rename" && final_output_path.exists() {
        // Find a unique filename by adding _1, _2, etc.
        let stem = final_output_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");
        let parent = final_output_path.parent().unwrap_or(Path::new("."));
        
        let mut counter = 1;
        loop {
            let new_name = format!("{}_{}.srt", stem, counter);
            let new_path = parent.join(&new_name);
            if !new_path.exists() {
                final_output_path = new_path;
                break;
            }
            counter += 1;
            if counter > 1000 {
                return Err("Too many duplicate files".to_string());
            }
        }
    }
    
    if let Some(parent) = final_output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut file = File::create(&final_output_path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(srt_content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;

    // Emit complete
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 100,
        processed_ms: total_duration_ms,
        total_ms: total_duration_ms,
        status: "complete".to_string(),
    });

    // Clean up temp file
    if let Some(temp) = temp_wav {
        let _ = std::fs::remove_file(&temp);
    }

    Ok(final_output_path.to_string_lossy().to_string())
}
