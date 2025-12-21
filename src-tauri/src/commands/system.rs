use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use std::env;
use std::process::Command;

#[tauri::command]
pub async fn open_link(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn paste_text() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_session_type() -> String {
    env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string())
}

use sysinfo::System;

#[derive(serde::Serialize)]
pub struct SystemStats {
    total_memory: u64,
    free_memory: u64,
    cpu_cores: usize,
    has_nvidia: bool,
    has_amd: bool,
    backend: String,
}

#[tauri::command]
pub fn get_system_stats() -> SystemStats {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_memory = sys.total_memory();
    let free_memory = sys.free_memory();
    let cpu_cores = sys.cpus().len();
    
    // Features check
    let backend = if cfg!(feature = "cuda") {
        "CUDA (NVIDIA)".to_string()
    } else if cfg!(feature = "vulkan") {
        "Vulkan".to_string()
    } else if cfg!(feature = "rocm") {
        "ROCm (AMD)".to_string()
    } else {
        "CPU".to_string()
    };

    // Check for GPU presence via CLI commands (linux only for now)
    let has_nvidia = std::path::Path::new("/usr/bin/nvidia-smi").exists() || 
                     std::path::Path::new("/proc/driver/nvidia").exists();
                     
    // AMD check mechanism? `rocminfo` or `/dev/kfd`
    let has_amd = std::path::Path::new("/dev/kfd").exists();

    SystemStats {
        total_memory,
        free_memory,
        cpu_cores,
        has_nvidia,
        has_amd,
        backend,
    }
}

#[tauri::command]
pub fn send_notification(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        Command::new("notify-send")
            .arg(&title)
            .arg(&body)
            .arg("--app-name=Whisper+")
            .spawn()
            .map_err(|e| format!("Failed to send notification: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("osascript")
            .args(["-e", &format!("display notification \"{}\" with title \"{}\"", body, title)])
            .spawn()
            .map_err(|e| format!("Failed to send notification: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(["-Command", &format!(
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
                $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
                $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('{}')) | Out-Null; \
                $xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('{}')) | Out-Null; \
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Whisper+').Show([Windows.UI.Notifications.ToastNotification]::new($xml))",
                title, body
            )])
            .spawn()
            .map_err(|e| format!("Failed to send notification: {}", e))?;
    }
    
    Ok(())
}
