use std::env;
use std::process::Command;

#[tauri::command]
pub async fn open_link(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    
    #[cfg(target_os = "linux")]
    {
        // Use nautilus --select to open folder with file selected
        let nautilus = std::process::Command::new("nautilus")
            .arg("--select")
            .arg(&path)
            .spawn();
        
        if nautilus.is_err() {
            // Fallback: just open parent directory
            let folder = file_path.parent().unwrap_or(file_path);
            std::process::Command::new("gio")
                .arg("open")
                .arg(folder)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // -R reveals and selects the file in Finder
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        // /select, selects the file in Explorer
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn paste_text() -> Result<(), String> {
    let wayland_display = env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "NONE".into());
    let xdg_session = env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "NONE".into());
    let is_wayland = wayland_display != "NONE" || xdg_session == "wayland";

    if is_wayland {
        // On Wayland, try ydotool first
        let ydotool_result = std::process::Command::new("ydotool")
            .args(["key", "29:1", "47:1", "47:0", "29:0"])
            .output();

        let ydotool_success = match &ydotool_result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        };

        if ydotool_success {
            return Ok(());
        }

        // Try wtype as fallback
        let wtype_result = std::process::Command::new("wtype")
            .args(["-M", "ctrl", "-P", "v", "-p", "v", "-m", "ctrl"])
            .output();

        let wtype_success = match &wtype_result {
            Ok(output) => output.status.success(),
            Err(_) => false,
        };

        if wtype_success {
            return Ok(());
        }

        // Both failed
        let mut err_msg = String::from("Wayland auto-paste blocked by compositor.");
        if ydotool_result.is_ok() {
            err_msg.push_str(" Start 'ydotoold' daemon as root to enable pasting.");
        } else if wtype_result.is_ok() {
            err_msg.push_str(" 'wtype' is unsupported on GNOME.");
        } else {
            err_msg.push_str(" Install ydotool & run ydotoold.");
        }

        return Err(err_msg);
    } else {
        // Pure X11: xdotool works reliably
        let res = std::process::Command::new("xdotool")
            .args(["key", "--clearmodifiers", "ctrl+v"])
            .output();
            
        match res {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => return Err(format!("X11 DETECTED. xdotool failed with code: {:?}", output.status.code())),
            Err(e) => return Err(format!("X11 DETECTED (xdg_session: {}). xdotool failed: {}", xdg_session, e)),
        }
    }
}

#[tauri::command]
pub fn get_session_type() -> String {
    // WAYLAND_DISPLAY is set even when apps run under XWayland
    if env::var("WAYLAND_DISPLAY").is_ok() {
        "wayland".to_string()
    } else {
        env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string())
    }
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
            .arg("--app-name=Yappie")
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
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Yappie').Show([Windows.UI.Notifications.ToastNotification]::new($xml))",
                title, body
            )])
            .spawn()
            .map_err(|e| format!("Failed to send notification: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_linux_distro() -> String {
    // Try to read /etc/os-release
    if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
        let lower = content.to_lowercase();
        
        if lower.contains("ubuntu") || lower.contains("debian") {
            return "ubuntu".to_string();
        } else if lower.contains("fedora") || lower.contains("rhel") || lower.contains("centos") {
            return "fedora".to_string();
        } else if lower.contains("arch") || lower.contains("manjaro") {
            return "arch".to_string();
        }
    }
    
    // Fallback: check for package managers
    if std::path::Path::new("/usr/bin/apt").exists() {
        return "ubuntu".to_string();
    } else if std::path::Path::new("/usr/bin/dnf").exists() || std::path::Path::new("/usr/bin/yum").exists() {
        return "fedora".to_string();
    } else if std::path::Path::new("/usr/bin/pacman").exists() {
        return "arch".to_string();
    }
    
    "unknown".to_string()
}

#[tauri::command]
pub fn set_tray_icon(app_handle: tauri::AppHandle, variant: String) -> Result<(), String> {
    if let Some(tray) = app_handle.tray_by_id("main") {
        let icon_bytes = match variant.as_str() {
            "black" => include_bytes!("../../icons/tray_black.png").to_vec(),
            "dim" => include_bytes!("../../icons/tray_dim.png").to_vec(),
            "recording" => include_bytes!("../../icons/tray_recording.png").to_vec(),
            _ => include_bytes!("../../icons/tray.png").to_vec(),
        };
        
        if let Ok(img) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = tray.set_icon(Some(img));
        }
    }
    Ok(())
}
