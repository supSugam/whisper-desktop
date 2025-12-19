import { invoke } from '@tauri-apps/api/core';

export class AudioController {
  // Play sounds using native Rust audio (rodio)
  // WAV files are embedded in the Rust binary

  playStart(): void {
    invoke('play_start_sound').catch((e) => {
      console.error('Failed to play start sound:', e);
    });
  }

  playEnd(): void {
    invoke('play_end_sound').catch((e) => {
      console.error('Failed to play end sound:', e);
    });
  }
}

export const audioController = new AudioController();
