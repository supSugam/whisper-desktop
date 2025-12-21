use whisper_rs::{WhisperContext, FullParams, SamplingStrategy, WhisperContextParameters};
use tauri::{AppHandle, Runtime, Manager};
use hound;

#[tauri::command]
pub async fn transcribe_local<R: Runtime>(app: AppHandle<R>, path: String, model: String, use_gpu: bool, translate: bool) -> Result<String, String> {
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

    let ctx = WhisperContext::new_with_params(&model_path.to_string_lossy(), params)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    let mut state = ctx.create_state().map_err(|e| format!("Failed to create state: {}", e))?;

    // Audio processing
    let mut reader = hound::WavReader::open(&path).map_err(|e| format!("Failed to open wav file: {}", e))?;
    let spec = reader.spec();

    // Verify format
    if spec.channels != 1 {
        // Simple downmix if needed, but for now enforcing mono
        // Ideally we should process/mixdown, but let's assume the recorder saves mono or we error
        // Actually, let's implement a simple stereo->mono if needed or just error
        // Existing whisper-desktop recorder might save as stereo?
        // Checking "audio.rs" might reveal this, but let's be safe and just read samples
        // and if stereo, take every Nth or average.
    }
    
    // Convert to f32 standard vector
    let raw_samples: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap_or(0)).collect();
    let mut samples: Vec<f32> = raw_samples.iter().map(|&s| s as f32 / 32768.0).collect();
    
    // Stereo to Mono: if 2 channels, average them
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
            
            let s1 = samples[idx_floor];
            let s2 = samples[idx_ceil];
            let val = s1 * (1.0 - t) + s2 * t;
            new_samples.push(val);
        }
        samples = new_samples;
    }

    // Run inference
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("auto")); // Auto-detect language
    params.set_translate(translate); // Translate to English if true
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_no_speech_thold(0.6); // Stricter silence detection
    params.set_logprob_thold(-1.0); // Discard low confidence

    // Prompt engineering to reduce hallucinations (especially "speaking in foreign language")
    // By priming it with standard English text, it expects speech.
    let prompt = "Hello, welcome to the transcription. This is a clear English text.";
    params.set_initial_prompt(prompt);

    state.full(params, &samples).map_err(|e| format!("Failed to run model: {}", e))?;

    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {}", e))?;
    let mut text = String::new();
    
    for i in 0..num_segments {
        let segment = state.full_get_segment_text(i).map_err(|e| format!("Failed to get segment text: {}", e))?;
        text.push_str(&segment);
        text.push(' ');
    }

    let trimmed = text.trim().to_string();

    // Aggressive Hallucination Filter
    // 1. Check for bracketed descriptions like "(Speaking Japanese)" or "[Silence]"
    let lower = trimmed.to_lowercase();
    if (lower.starts_with('(') || lower.starts_with('[')) && (lower.ends_with(')') || lower.ends_with(']')) {
        if lower.contains("speaking") || lower.contains("foreign") || lower.contains("silence") || lower.contains("music") || lower.contains("appla") {
             return Ok("".to_string());
        }
    }

    // 2. Known fixed hallucinations
    let hallucinations = [
        "Please subscribe", 
        "Subscribe to my channel",
        "Amara.org",
        "Subtitles by",
        "I'm sorry",
        "bad translation",
        "This is a clear English text",
        "Hello, welcome to the transcription"
    ];

    for h in hallucinations {
        if trimmed.contains(h) {
            return Ok("".to_string());
        }
    }

    Ok(trimmed)
}
