use whisper_rs::{WhisperContext, FullParams, SamplingStrategy, WhisperContextParameters};
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

/// Merge words into natural subtitle blocks
/// Uses Whisper's natural segmentation, only adjusting for very short/long segments
fn merge_tokens_to_subtitles(tokens: Vec<(i64, i64, String)>) -> Vec<SubtitleEntry> {
    let mut subtitles: Vec<SubtitleEntry> = Vec::new();
    
    if tokens.is_empty() {
        return subtitles;
    }

    // Constraints
    let min_duration_ms: i64 = 1000;  // Minimum 1 second for readability
    let max_duration_ms: i64 = 7000;  // Maximum 7 seconds
    let max_chars: usize = 84;         // ~2 lines of 42 chars

    let mut pending: Option<SubtitleEntry> = None;

    for (start, end, text) in tokens {
        let text = text.trim().to_string();
        if text.is_empty() {
            continue;
        }

        let duration = end - start;

        // If we have a pending short subtitle, try to merge
        if let Some(ref mut p) = pending {
            let merged_duration = end - p.start_ms;
            let merged_text = format!("{} {}", p.text, text);
            
            // Merge if: pending is short AND merged result is reasonable
            if p.end_ms - p.start_ms < min_duration_ms 
                && merged_duration <= max_duration_ms 
                && merged_text.len() <= max_chars 
            {
                p.text = merged_text;
                p.end_ms = end;
                continue;
            } else {
                // Can't merge, push pending and start fresh
                subtitles.push(pending.take().unwrap());
            }
        }

        // Handle current segment
        if duration < min_duration_ms && text.len() < 30 {
            // Too short - hold for potential merge
            pending = Some(SubtitleEntry {
                start_ms: start,
                end_ms: end,
                text,
            });
        } else if duration > max_duration_ms || text.len() > max_chars {
            // Too long - split at sentence boundaries
            let sentences = split_at_sentences(&text);
            let segment_duration = duration / sentences.len() as i64;
            
            for (i, sentence) in sentences.iter().enumerate() {
                if !sentence.trim().is_empty() {
                    subtitles.push(SubtitleEntry {
                        start_ms: start + (i as i64 * segment_duration),
                        end_ms: start + ((i + 1) as i64 * segment_duration),
                        text: sentence.trim().to_string(),
                    });
                }
            }
        } else {
            // Good length - use as-is
            subtitles.push(SubtitleEntry {
                start_ms: start,
                end_ms: end,
                text,
            });
        }
    }

    // Don't forget pending
    if let Some(p) = pending {
        subtitles.push(p);
    }

    subtitles
}

/// Split text at sentence boundaries for long segments
fn split_at_sentences(text: &str) -> Vec<String> {
    let mut sentences: Vec<String> = Vec::new();
    let mut current = String::new();
    
    for ch in text.chars() {
        current.push(ch);
        if ch == '.' || ch == '!' || ch == '?' {
            // Check for abbreviations (single letter before period)
            let trimmed = current.trim();
            if trimmed.len() > 2 {
                sentences.push(current.trim().to_string());
                current = String::new();
            }
        }
    }
    
    // Remaining text
    if !current.trim().is_empty() {
        if sentences.is_empty() {
            // No sentence breaks found - split by comma or just return as-is
            if current.contains(',') {
                for part in current.split(',') {
                    let p = part.trim();
                    if !p.is_empty() {
                        sentences.push(format!("{},", p).trim_end_matches(',').to_string() + if part.ends_with(',') { "," } else { "" });
                    }
                }
                // Clean up - just split by comma
                sentences = current.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            } else {
                sentences.push(current.trim().to_string());
            }
        } else {
            sentences.push(current.trim().to_string());
        }
    }
    
    if sentences.is_empty() {
        sentences.push(text.to_string());
    }
    
    sentences
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

    let mut params = WhisperContextParameters::default();
    
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

    // Configure Whisper params for natural sentence-level timestamps
    let mut whisper_params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    whisper_params.set_language(Some("auto"));
    whisper_params.set_translate(translate);
    whisper_params.set_print_special(false);
    whisper_params.set_print_progress(false);
    whisper_params.set_print_realtime(false);
    whisper_params.set_print_timestamps(false);
    whisper_params.set_token_timestamps(false); // Use segment-level timestamps for natural sentences
    whisper_params.set_no_speech_thold(0.6);
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

    // Start a background thread to emit progress updates during transcription
    let app_clone = app.clone();
    let total_ms = total_duration_ms;
    let audio_duration_secs = total_duration_ms as f64 / 1000.0;
    // Estimate: ~0.3x realtime for GPU, ~1x for CPU (conservative)
    let estimated_process_time = (audio_duration_secs * 0.5).max(5.0); // At least 5 seconds
    
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
            // Progress from 20% to 80% based on estimated time
            let progress = (elapsed / estimated_process_time).min(1.0);
            let percentage = 20 + (progress * 60.0) as u32;
            let estimated_processed = (progress * total_ms as f64) as u64;
            
            let _ = app_clone.emit("srt-progress", SrtProgress {
                percentage,
                processed_ms: estimated_processed,
                total_ms: total_ms,
                status: "transcribing".to_string(),
            });
            
            std::thread::sleep(std::time::Duration::from_millis(500));
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
        status: "transcribing".to_string(),
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
        
        // Filter hallucinations
        let lower = seg_text.to_lowercase();
        if lower.contains("subscribe") || lower.contains("amara.org") || 
           lower.contains("subtitles by") || lower.contains("[") ||
           lower.contains("(speaking") || lower.contains("(music") {
            continue;
        }

        if !seg_text.trim().is_empty() {
            all_tokens.push((start_ms, end_ms, seg_text.trim().to_string()));
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
    let output_path_buf = PathBuf::from(&output_path);
    if let Some(parent) = output_path_buf.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut file = File::create(&output_path).map_err(|e| format!("Failed to create file: {}", e))?;
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

    Ok(output_path)
}
