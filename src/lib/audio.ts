export class AudioController {
  private startSound: HTMLAudioElement;
  private endSound: HTMLAudioElement;

  constructor() {
    this.startSound = new Audio('/sounds/start.ogg');
    this.endSound = new Audio('/sounds/end.ogg');
    
    // Preload
    this.startSound.load();
    this.endSound.load();
  }

  async playStart() {
    try {
      this.startSound.currentTime = 0;
      await this.startSound.play();
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  async playEnd() {
    try {
      this.endSound.currentTime = 0;
      await this.endSound.play();
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }
}

export const audioController = new AudioController();
