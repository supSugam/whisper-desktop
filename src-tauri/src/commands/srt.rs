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



/// Energy-based VAD - returns true if segment has speech
fn has_speech(samples: &[f32], threshold: f32) -> bool {
    if samples.is_empty() {
        return false;
    }
    let energy: f32 = samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32;
    energy > threshold
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

    // Handle duplicate files logic
    let mut final_output_path = PathBuf::from(&output_path);
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

    // Open file for writing immediately (streaming mode)
    let mut file = File::create(&final_output_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    
    // Counter for SRT segments
    let mut segment_counter = 1;
    
    // Set up segment callback for REAL-TIME writing
    // This allows data to be saved even if the app crashes mid-process
    whisper_params.set_segment_callback_safe(move |data: whisper_rs::SegmentCallbackData| {
        let seg_text = data.text;
        
        // Filter hallucinations - same logic as before
        let lower = seg_text.to_lowercase();
        let trimmed = seg_text.trim();
        
        // Skip common hallucination patterns
        if lower.contains("subscribe") || lower.contains("amara.org") || 
           lower.contains("subtitles by") || lower.contains("transcribed by") ||
           lower.contains("(speaking") {
            return;
        }
        
        // Skip pure annotation segments like "[Music]", "[Applause]", etc.
        if trimmed.starts_with('[') && trimmed.ends_with(']') && !trimmed.contains(' ') {
            return;
        }
        
        // Remove inline annotations but keep the text
        let cleaned_text = if trimmed.contains('[') && trimmed.contains(']') {
            let mut result = String::new();
            let mut in_bracket = false;
            for c in trimmed.chars() {
                if c == '[' { in_bracket = true; continue; }
                if c == ']' { in_bracket = false; continue; }
                if !in_bracket { result.push(c); }
            }
            // If cleaning resulted in empty string (e.g. "[Music]" becomes ""), skip
            if result.trim().is_empty() { return; }
            result
        } else {
            trimmed.to_string()
        };
        
        if cleaned_text.trim().is_empty() { return; }

        // Determine timestamp unit based on whether DTW is enabled or not
        // Whisper default is centiseconds (10ms units)
        // With DTW enabled, timestamps are more precise but seemingly still scaled?
        // Let's assume consistent conversion: unit * 10 = milliseconds
        let start_ms = data.start_timestamp * 10;
        let end_ms = data.end_timestamp * 10;
        
        // Format timestamp: HH:MM:SS,mmm
        fn format_timestamp(ms: i64) -> String {
            let hours = ms / 3600000;
            let minutes = (ms % 3600000) / 60000;
            let seconds = (ms % 60000) / 1000;
            let millis = ms % 1000;
            format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
        }
        
        let start_fmt = format_timestamp(start_ms);
        let end_fmt = format_timestamp(end_ms);
        
        // Write segment to file immediately
        let srt_entry = format!("{}\n{} --> {}\n{}\n\n", 
            segment_counter, start_fmt, end_fmt, cleaned_text.trim());
            
        if let Err(e) = file.write_all(srt_entry.as_bytes()) {
            eprintln!("[SRT] Failed to write segment: {}", e);
        }
        if let Err(e) = file.flush() { // Flush to ensure disk save
            eprintln!("[SRT] Failed to flush file: {}", e);
        }
        
        segment_counter += 1;
    });

    // Process FULL audio in one pass
    // Segments are now written in real-time via the callback above
    let result = state.full(whisper_params, &samples);
    
    // Stop progress thread
    progress_running.store(false, std::sync::atomic::Ordering::SeqCst);
    
    result.map_err(|e| format!("Failed to run model: {}", e))?;

    // Emit progress after transcription
    let _ = app.emit("srt-progress", SrtProgress {
        percentage: 100,
        processed_ms: total_duration_ms,
        total_ms: total_duration_ms,
        status: "complete".to_string(),
    });
    
    // We kept the file open in the closure, so it simply closes when dropped.
    // Logic for duplicate handling and path generation was done before this block
    // and `final_output_path` was used.

    /* REMOVED: Old post-processing loop 
       Segments are already written to disk!
    */
    // Clean up temp file
    if let Some(temp) = temp_wav {
        let _ = std::fs::remove_file(&temp);
    }

    Ok(final_output_path.to_string_lossy().to_string())
}

