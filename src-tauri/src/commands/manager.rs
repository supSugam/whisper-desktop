use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Runtime, Manager};
use futures_util::StreamExt;
use std::io::Write;

const MODELS: &[(&str, &str)] = &[
    ("Tiny", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"),
    ("Base", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"),
    ("Small", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"),
    ("Medium", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"),
    ("Large", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"),
];

fn get_models_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }
    Ok(models_dir)
}

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    model_name: String,
    total: u64,
    downloaded: u64,
    percentage: f64,
}

#[tauri::command]
pub fn check_model_exists<R: Runtime>(app: AppHandle<R>, model_name: String) -> Result<bool, String> {
    let models_dir = get_models_dir(&app)?;
    let file_path = models_dir.join(format!("ggml-{}.bin", model_name.to_lowercase()));
    Ok(file_path.exists())
}

#[tauri::command]
pub fn delete_model<R: Runtime>(app: AppHandle<R>, model_name: String) -> Result<(), String> {
    let models_dir = get_models_dir(&app)?;
    let file_path = models_dir.join(format!("ggml-{}.bin", model_name.to_lowercase()));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn download_model<R: Runtime>(app: AppHandle<R>, model_name: String) -> Result<(), String> {
    let url = MODELS.iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(&model_name))
        .ok_or_else(|| "Model not found".to_string())?
        .1;

    let models_dir = get_models_dir(&app)?;
    let file_path = models_dir.join(format!("ggml-{}.bin", model_name.to_lowercase()));

    let client = reqwest::Client::new();
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    let total_size = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    let window = app.get_webview_window("main").ok_or("Main window not found")?;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percentage = (downloaded as f64 / total_size as f64) * 100.0;
            let _ = window.emit("download_progress", DownloadProgress {
                model_name: model_name.clone(),
                total: total_size,
                downloaded,
                percentage,
            });
        }
    }

    Ok(())
}
