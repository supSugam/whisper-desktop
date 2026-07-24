use tauri::{State, Emitter, Manager};
use std::sync::{Arc, Mutex};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crate::state::AudioState;

#[tauri::command]
pub async fn start_recording(
    state: State<'_, AudioState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut is_rec = state.is_recording.lock().unwrap();
    if *is_rec {
        return Err("Already recording".into());
    }

    if let Ok(mut amp) = state.max_amplitude.lock() {
        *amp = 0.0;
    }
    if let Ok(mut lvl) = state.current_level.lock() {
        *lvl = 0.0;
    }

    let max_amp = state.max_amplitude.clone();
    let current_level = state.current_level.clone();

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let spec = hound::WavSpec {
        channels: config.channels(),
        sample_rate: config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let path = std::env::temp_dir().join("whisper_desktop_recording.wav");
    let writer = hound::WavWriter::create(&path, spec).map_err(|e| e.to_string())?;
    let writer = Arc::new(Mutex::new(Some(writer)));
    let writer_clone = writer.clone();

    let err_fn = move |err| {
        eprintln!("an error occurred on stream: {}", err);
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &_| {
                // Compute RMS amplitude for this chunk
                let rms = if data.is_empty() {
                    0.0f32
                } else {
                    // Calculate mean (DC offset)
                    let mean: f32 = data.iter().sum::<f32>() / data.len() as f32;
                    // Calculate RMS without the DC offset
                    let sum_sq: f32 = data.iter().map(|&s| (s - mean) * (s - mean)).sum();
                    (sum_sq / data.len() as f32).sqrt()
                };

                // Track rolling current level (smoothed)
                if let Ok(mut lvl) = current_level.lock() {
                    *lvl = rms;
                }

                // Track overall peak for silence detection
                let peak = data.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
                if let Ok(mut max_guard) = max_amp.lock() {
                    if peak > *max_guard {
                        *max_guard = peak;
                    }
                }

                if let Ok(mut guard) = writer_clone.lock() {
                    if let Some(w) = guard.as_mut() {
                        for &sample in data {
                            let amplitude = i16::MAX as f32;
                            w.write_sample((sample * amplitude) as i16).ok();
                        }
                    }
                }
            },
            err_fn,
            None,
        ),
        _ => return Err("Unsupported sample format (only F32 implemented)".into()),
    }
    .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    *state.stream.lock().unwrap() = Some(crate::state::SendStream(stream));
    *is_rec = true;


    // Spawn a thread that emits audio level to the main window every ~60ms while recording
    let is_rec_arc = state.is_recording.clone();
    let level_arc = state.current_level.clone();
    let app = app_handle.clone();
    let start_time = std::time::Instant::now();
    std::thread::spawn(move || {
        // Set initial 00:00 immediately
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_title(Some("00:00".to_string()));
        }
        let mut last_second = 0;
        
        loop {
            std::thread::sleep(std::time::Duration::from_millis(60));
            let recording = *is_rec_arc.lock().unwrap();
            if !recording {
                // Clear tray title when recording ends
                if let Some(tray) = app.tray_by_id("main") {
                    let _ = tray.set_title(None::<String>);
                }
                break;
            }
            let level = *level_arc.lock().unwrap();
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.emit("audio-level", level as f64);
            }
            let elapsed = start_time.elapsed().as_secs();
            if elapsed > last_second {
                last_second = elapsed;
                let time_str = format!("{:02}:{:02}", elapsed / 60, elapsed % 60);
                if let Some(tray) = app.tray_by_id("main") {
                    let _ = tray.set_title(Some(time_str));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_recording(
    state: State<'_, AudioState>,
) -> Result<String, String> {
    let mut is_rec = state.is_recording.lock().unwrap();
    if !*is_rec {
        return Err("Not recording".into());
    }

    {
        let mut stream_guard = state.stream.lock().unwrap();
        *stream_guard = None;
    }

    *is_rec = false;

    let max_amp = *state.max_amplitude.lock().unwrap();
    if max_amp < 0.02 {
        return Err("SILENCE_DETECTED".into());
    }

    let path = std::env::temp_dir().join("whisper_desktop_recording.wav");
    Ok(path.to_string_lossy().into_owned())
}

