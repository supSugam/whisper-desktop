// Native audio playback using rodio
// Sounds are embedded in the binary at compile time

use rodio::{Decoder, OutputStream, Sink};
use std::io::Cursor;

// Embed the WAV files at compile time
const START_SOUND: &[u8] = include_bytes!("../sounds/start.wav");
const END_SOUND: &[u8] = include_bytes!("../sounds/end.wav");

fn play_sound(data: &'static [u8]) {
    std::thread::spawn(move || {
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let cursor = Cursor::new(data);
                if let Ok(source) = Decoder::new(cursor) {
                    sink.append(source);
                    sink.sleep_until_end();
                }
            }
        }
    });
}

#[tauri::command]
pub fn play_start_sound() {
    play_sound(START_SOUND);
}

#[tauri::command]
pub fn play_end_sound() {
    play_sound(END_SOUND);
}
