mod commands;
mod state;

use state::AudioState;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

// Track if app was launched via autostart
static LAUNCHED_VIA_AUTOSTART: AtomicBool = AtomicBool::new(false);

// Track if SRT/transcription should be cancelled
pub static SRT_CANCELLED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn was_autostarted() -> bool {
    LAUNCHED_VIA_AUTOSTART.load(Ordering::SeqCst)
}

#[tauri::command]
fn cancel_transcription() -> bool {
    SRT_CANCELLED.store(true, Ordering::SeqCst);
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let is_autostarted = args.iter().any(|arg| arg == "--autostarted");
    LAUNCHED_VIA_AUTOSTART.store(is_autostarted, Ordering::SeqCst);

    let builder = tauri::Builder::default()
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit Yappie", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")).unwrap();
            let _tray = TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => { app.exit(0); }
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
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
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

            }

            Ok(())
        })
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|arg| arg == "--toggle") {
                // Target only the main window to avoid double-toggle
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.emit("cli-toggle", ());
                }
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init());

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
        .manage(state::WhisperModelState::new())
        .manage(commands::manager::DownloadState::new())
        .invoke_handler(tauri::generate_handler![
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::system::open_link,
            commands::system::open_folder,
            commands::system::paste_text,
            commands::system::get_session_type,
            commands::system::get_system_stats,
            commands::system::get_linux_distro,
            commands::system::send_notification,
            commands::sounds::play_start_sound,
            commands::sounds::play_end_sound,
            commands::local::transcribe_local,
            commands::manager::check_model_exists,
            commands::manager::download_model,
            commands::manager::delete_model,
            commands::manager::cancel_download,
            commands::srt::generate_srt,
            commands::system::set_tray_icon,
            was_autostarted,
            cancel_transcription
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
