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
