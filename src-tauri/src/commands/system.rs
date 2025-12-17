use enigo::{Enigo, Key, Keyboard, Settings, Direction};

#[tauri::command]
pub async fn open_link(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn paste_text() -> Result<(), String> {
    // New Enigo 0.6.1 Syntax
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Simulate Ctrl+V safely
    // 1. Press Ctrl
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    // 2. Click V
    enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
    // 3. Release Ctrl
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    
    Ok(())
}
