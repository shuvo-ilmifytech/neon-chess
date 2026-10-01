// Synthesizer for cyberpunk sound effects without external audio assets
class SoundFX {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on first user gesture if needed
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('AudioContext failed to initialize:', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol: number = 0.1,
    slideTo: number | null = null
  ) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Ignore audio glitches gracefully
    }
  }

  toggle(on: boolean) {
    this.enabled = on;
    if (on) {
      this.initCtx();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  playClick() {
    this.playTone(1200, 'sine', 0.04, 0.05, 600);
  }

  playMove() {
    // Holographic digital piece placement
    this.playTone(550, 'sine', 0.08, 0.08, 880);
  }

  playCapture() {
    // Crunchy energy disruption
    this.playTone(220, 'sawtooth', 0.18, 0.12, 40);
  }

  playCheck() {
    // Threat alarm pulse
    this.playTone(440, 'square', 0.15, 0.08, 330);
    setTimeout(() => {
      this.playTone(440, 'square', 0.2, 0.08, 330);
    }, 120);
  }

  playGameStart() {
    // Matrix cyber bootup
    this.playTone(180, 'sawtooth', 0.4, 0.1, 720);
    setTimeout(() => {
      this.playTone(720, 'sine', 0.3, 0.08, 1080);
    }, 200);
  }

  playWin() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.25, 0.09);
      }, i * 110);
    });
  }

  playLoss() {
    if (!this.enabled) return;
    const notes = [440, 370, 311, 220];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.2, 0.08);
      }, i * 140);
    });
  }

  playAlert() {
    this.playTone(660, 'sine', 0.12, 0.09, 440);
  }

  playPing() {
    this.playTone(1200, 'sine', 0.06, 0.05);
  }
}

export const sfx = new SoundFX();
