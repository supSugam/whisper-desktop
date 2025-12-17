use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct AudioState {
    pub stream: Arc<Mutex<Option<cpal::Stream>>>,
    pub is_recording: Arc<Mutex<bool>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            stream: Arc::new(Mutex::new(None)),
            is_recording: Arc::new(Mutex::new(false)),
        }
    }
}

#[tauri::command]
pub async fn start_recording(
    state: State<'_, AudioState>,
    _app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut is_rec = state.is_recording.lock().unwrap();
    if *is_rec {
        return Err("Already recording".into());
    }

    // Setup CPAL
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;

    // Fixed path
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

    *state.stream.lock().unwrap() = Some(stream);
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
        *stream_guard = None; // Drop stream
    }

    *is_rec = false;

    let path = std::env::temp_dir().join("whisper_desktop_recording.wav");
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn transcribe(path: String, token: String) -> Result<String, String> {
    if token.trim().is_empty() {
        return Err("Token is empty".into());
    }

    // Trim token to avoid header issues
    let token = token.trim();

    // Prepare cookie string
    let cookie_string = if token.contains('=') {
        token.to_string()
    } else {
        format!("__Secure-next-auth.session-token={}", token)
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Get Session
    let session_url = "https://chatgpt.com/api/auth/session";
    let resp = client
        .get(session_url)
        .header("Cookie", &cookie_string)
        .header("Accept", "*/*")
        .header("Referer", "https://chatgpt.com/")
        .header("Origin", "https://chatgpt.com")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status() != 200 {
        return Err(format!(
            "Session failed: {}. Check your token.",
            resp.status()
        ));
    }

    let session_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let access_token = session_json["accessToken"]
        .as_str()
        .ok_or("No access token in session")?;

    // Transcribe
    let url = "https://chatgpt.com/backend-api/transcribe";

    let file_bytes = std::fs::read(&path).map_err(|e| e.to_string())?;

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name("whisper.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new().part("file", part);

    let trans_resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Cookie", &cookie_string)
        .header("oai-device-id", "be84a72f-879ad3082e807495ed")
        .header("Origin", "https://chatgpt.com")
        .header("Referer", "https://chatgpt.com/")
        .header("Accept", "*/*")
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if trans_resp.status() != 200 {
        return Err(format!("Transcription failed: {}", trans_resp.status()));
    }

    let data: serde_json::Value = trans_resp.json().await.map_err(|e| e.to_string())?;
    let text = data["text"].as_str().unwrap_or("").to_string();

    Ok(text)
}

#[tauri::command]
pub async fn open_link(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}
