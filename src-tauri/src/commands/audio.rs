use tauri::State;
use std::sync::{Arc, Mutex};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crate::state::AudioState;

#[tauri::command]
pub async fn start_recording(
    state: State<'_, AudioState>,
    _app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut is_rec = state.is_recording.lock().unwrap();
    if *is_rec {
        return Err("Already recording".into());
    }

    if let Ok(mut amp) = state.max_amplitude.lock() {
        *amp = 0.0;
    }
    let max_amp = state.max_amplitude.clone();

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
                let mut current_max = 0.0;
                for &sample in data {
                     let abs = sample.abs();
                     if abs > current_max { current_max = abs; }
                }

                if let Ok(mut max_guard) = max_amp.lock() {
                    if current_max > *max_guard {
                        *max_guard = current_max;
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

    Ok(())
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AudioState>) -> Result<String, String> {
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
