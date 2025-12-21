mod commands;
mod state;

use state::AudioState;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

// Track if app was launched via autostart
static LAUNCHED_VIA_AUTOSTART: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn was_autostarted() -> bool {
    LAUNCHED_VIA_AUTOSTART.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if launched via autostart (with --autostarted flag)
    let args: Vec<String> = std::env::args().collect();
    let is_autostarted = args.iter().any(|arg| arg == "--autostarted");
    LAUNCHED_VIA_AUTOSTART.store(is_autostarted, Ordering::SeqCst);

    let builder = tauri::Builder::default()
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit Whisper+", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().unwrap();
                                window.set_focus().unwrap();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let icon = app.default_window_icon().unwrap().clone();
                let _ = window.set_icon(icon);
                
                // Show window only if NOT launched via autostart
                // Use a small delay to allow the HTML/CSS to render first (prevents white flash)
                if !LAUNCHED_VIA_AUTOSTART.load(Ordering::SeqCst) {
                    let win = window.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        let _ = win.show();
                        let _ = win.set_focus();
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Check if --toggle argument was passed (for GNOME keybinding support)
            if args.iter().any(|arg| arg == "--toggle") {
                // Emit toggle event to frontend - triggers recording toggle
                let _ = app.emit("cli-toggle", ());
                return;
            }
            
            // Default behavior: Show window and focus (for regular app launch)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(
        tauri_plugin_autostart::Builder::new()
            .args(vec!["--autostarted".to_string()])
            .build(),
    );

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AudioState::new())
        .invoke_handler(tauri::generate_handler![
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::transcribe::transcribe,
            commands::system::open_link,
            commands::system::paste_text,
            commands::system::get_session_type,
            commands::system::get_system_stats,
            commands::system::send_notification,
            commands::sounds::play_start_sound,
            commands::sounds::play_end_sound,
            commands::local::transcribe_local,
            commands::manager::check_model_exists,
            commands::manager::download_model,
            commands::manager::delete_model,
            was_autostarted
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
