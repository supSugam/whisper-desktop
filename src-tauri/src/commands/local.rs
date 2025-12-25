use whisper_rs::{WhisperContext, FullParams, SamplingStrategy, WhisperContextParameters};
use tauri::{AppHandle, Runtime, Manager, Emitter};
use hound;
use std::process::Command;
use std::path::Path;
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct TranscribeProgress {
    pub percentage: u32,
    pub processed_ms: u64,
    pub total_ms: u64,
    pub status: String,
}

/// Convert any media file to 16kHz mono WAV using ffmpeg
fn convert_to_wav(input_path: &str, output_path: &str) -> Result<(), String> {
    // First verify the input file exists
    let input = Path::new(input_path);
    if !input.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    let status = Command::new("ffmpeg")
        .arg("-y")           // Overwrite output
        .arg("-i")
        .arg(input_path)     // Input path as single arg (handles spaces)
        .arg("-vn")          // No video
        .arg("-ac").arg("1") // Mono
        .arg("-ar").arg("16000") // 16kHz sample rate
        .arg("-acodec").arg("pcm_s16le") // 16-bit PCM
        .arg("-f").arg("wav")
        .arg(output_path)    // Output path as single arg
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}. Is ffmpeg installed?", e))?;

    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        return Err(format!("ffmpeg conversion failed: {}", stderr));
    }

    // Verify output was created
    if !Path::new(output_path).exists() {
        return Err("ffmpeg completed but output file was not created".to_string());
    }

    Ok(())
}

/// Check if file needs conversion (not a WAV with correct format)
fn needs_conversion(path: &str) -> bool {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // Video files always need conversion
    if matches!(ext.as_str(), "mp4" | "mkv" | "webm" | "mov" | "avi" | "m4v") {
        return true;
    }

    // Non-WAV audio files need conversion
    if matches!(ext.as_str(), "mp3" | "m4a" | "flac" | "ogg" | "opus" | "aac" | "wma") {
        return true;
    }

    // For WAV files, check if format is already correct
    if ext == "wav" {
        if let Ok(reader) = hound::WavReader::open(path) {
            let spec = reader.spec();
            // Already 16kHz mono 16-bit? No conversion needed
            if spec.sample_rate == 16000 && spec.channels == 1 && spec.bits_per_sample == 16 {
                return false;
            }
        }
    }

    // Anything else needs conversion
    true
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, percentage: u32, processed_ms: u64, total_ms: u64, status: &str) {
    let _ = app.emit("transcribe-progress", TranscribeProgress {
        percentage,
        processed_ms,
        total_ms,
        status: status.to_string(),
    });
}

#[tauri::command]
pub async fn transcribe_local<R: Runtime>(app: AppHandle<R>, path: String, model: String, _use_gpu: bool, translate: bool) -> Result<String, String> {
    emit_progress(&app, 0, 0, 0, "loading");
    
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(format!("ggml-{}.bin", model.to_lowercase()));
    
    if !model_path.exists() {
        return Err("Model not found. Please download it first.".to_string());
    }

    // Convert media if needed
    let wav_path: String;
    let temp_wav: Option<String>;
    
    if needs_conversion(&path) {
        emit_progress(&app, 5, 0, 0, "converting");
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("whisper_temp_{}.wav", std::process::id()));
        wav_path = temp_file.to_string_lossy().to_string();
        convert_to_wav(&path, &wav_path)?;
        temp_wav = Some(wav_path.clone());
    } else {
        wav_path = path.clone();
        temp_wav = None;
    }

    emit_progress(&app, 10, 0, 0, "loading_model");
    let result = transcribe_wav(&app, &wav_path, &model_path, _use_gpu, translate).await;

    // Clean up temp file
    if let Some(temp) = temp_wav {
        let _ = std::fs::remove_file(&temp);
    }

    emit_progress(&app, 100, 0, 0, "complete");
    result
}

async fn transcribe_wav<R: Runtime>(
    app: &AppHandle<R>,
    wav_path: &str,
    model_path: &std::path::Path,
    _use_gpu: bool,
    translate: bool,
) -> Result<String, String> {
    let mut params = WhisperContextParameters::default();
    
    #[cfg(any(feature = "cuda", feature = "vulkan", feature = "rocm"))]
    {
        params.use_gpu(_use_gpu);
    }

    let ctx = WhisperContext::new_with_params(&model_path.to_string_lossy(), params)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    let mut state = ctx.create_state().map_err(|e| format!("Failed to create state: {}", e))?;

    emit_progress(app, 15, 0, 0, "loading_audio");

    // Audio processing - now always 16kHz mono from ffmpeg
    let mut reader = hound::WavReader::open(wav_path)
        .map_err(|e| format!("Failed to open wav file: {}", e))?;
    let spec = reader.spec();

    let raw_samples: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap_or(0)).collect();
    let mut samples: Vec<f32> = raw_samples.iter().map(|&s| s as f32 / 32768.0).collect();
    
    // Stereo to Mono if still needed
    if spec.channels == 2 {
        samples = samples.chunks(2).map(|chunk| (chunk[0] + chunk[1]) / 2.0).collect();
    } else if spec.channels > 2 {
        return Err("Unsupported channel count".to_string());
    }

    // Resample to 16kHz if necessary
    if spec.sample_rate != 16000 {
        let ratio = spec.sample_rate as f32 / 16000.0;
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

    // Calculate audio duration
    let total_duration_ms = (samples.len() as u64 * 1000) / 16000;

    emit_progress(app, 20, 0, total_duration_ms, "transcribing");

    // Run inference
    let mut wparams = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    wparams.set_language(Some("auto"));
    wparams.set_translate(translate);
    wparams.set_print_special(false);
    wparams.set_print_progress(false);
    wparams.set_print_realtime(false);
    wparams.set_print_timestamps(false);
    
    // CRITICAL: Suppress non-speech tokens to prevent [Music], [BLANK_AUDIO] hallucinations
    // This forces Whisper to actually transcribe/translate instead of labeling as music
    wparams.set_suppress_blank(true);
    wparams.set_suppress_non_speech_tokens(true);
    
    // Lower the no_speech threshold for translation - foreign languages can have different audio characteristics
    // that might be incorrectly classified as "no speech"
    if translate {
        wparams.set_no_speech_thold(0.2); // More lenient for translation
        wparams.set_logprob_thold(-2.0);  // More lenient log probability threshold
    } else {
        wparams.set_no_speech_thold(0.6);
        wparams.set_logprob_thold(-1.0);
        // Only use prompt when NOT translating
        let prompt = "Hello, welcome to the transcription. This is a clear English text.";
        wparams.set_initial_prompt(prompt);
    }

    // Run transcription (progress callback removed - was causing crashes)
    state.full(wparams, &samples).map_err(|e| format!("Failed to run model: {}", e))?;

    emit_progress(app, 90, total_duration_ms, total_duration_ms, "finishing");

    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {}", e))?;
    println!("[DEBUG] Number of segments: {}", num_segments);
    
    let mut text = String::new();
    
    for i in 0..num_segments {
        let segment = state.full_get_segment_text(i).map_err(|e| format!("Failed to get segment text: {}", e))?;
        println!("[DEBUG] Segment {}: {:?}", i, segment);
        text.push_str(&segment);
        text.push(' ');
    }

    println!("[DEBUG] Raw text before filtering: {:?}", text);
    let mut trimmed = text.trim().to_string();

    // Clean up annotations like [Music], [Applause], etc.
    let annotations = ["[Music]", "[music]", "[Applause]", "[applause]", "[Laughter]", "[laughter]"];
    for annotation in annotations {
        trimmed = trimmed.replace(annotation, "").trim().to_string();
    }

    println!("[DEBUG] After annotation cleanup: {:?}", trimmed);

    // Hallucination Filter - only for pure annotation segments
    let lower = trimmed.to_lowercase();
    if trimmed.is_empty() {
        println!("[DEBUG] Result is empty after cleanup");
        return Ok("".to_string());
    }
    
    // Only filter if ENTIRE result is just an annotation
    if (lower.starts_with('(') || lower.starts_with('[')) && (lower.ends_with(')') || lower.ends_with(']')) {
        if lower.contains("speaking") || lower.contains("foreign") || lower.contains("silence") || lower.contains("music") || lower.contains("appla") {
             return Ok("".to_string());
        }
    }

    // Hallucination filter - only very specific patterns that are definitely not real transcriptions
    // Be VERY careful here - we don't want to filter valid content
    let hallucinations = [
        "Subscribe to my channel",
        "Amara.org",
        "Subtitles by the",
        "Transcribed by",
        "This is a clear English text",
        "Hello, welcome to the transcription",
        "Thank you for watching",
    ];

    // Only filter if the ENTIRE text is just the hallucination (not if it contains it)
    let lower = trimmed.to_lowercase();
    for h in hallucinations {
        if lower == h.to_lowercase() {
            println!("[DEBUG] Filtered as hallucination: {}", h);
            return Ok("".to_string());
        }
    }

    Ok(trimmed)
}
