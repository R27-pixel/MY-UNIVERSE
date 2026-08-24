import { useSettingsStore } from '../stores/settingsStore';

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private ringtoneOsc: OscillatorNode | null = null;
  private ringtoneGain: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private isAudioEnabled(): boolean {
    return useSettingsStore.getState().audioEnabled;
  }

  /**
   * Message chime for chat & real-time notification toasts
   */
  playMessageChime() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  /**
   * WebRTC Call Ringtone loop
   */
  startRingtone() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      this.stopRingtone();
      const now = ctx.currentTime;
      this.ringtoneOsc = ctx.createOscillator();
      this.ringtoneGain = ctx.createGain();

      this.ringtoneOsc.type = 'sine';
      this.ringtoneOsc.frequency.setValueAtTime(440, now);

      this.ringtoneGain.gain.setValueAtTime(0.1, now);

      this.ringtoneOsc.connect(this.ringtoneGain);
      this.ringtoneGain.connect(ctx.destination);

      this.ringtoneOsc.start(now);
    } catch (e) {}
  }

  stopRingtone() {
    if (this.ringtoneOsc) {
      try {
        this.ringtoneOsc.stop();
        this.ringtoneOsc.disconnect();
      } catch (e) {}
      this.ringtoneOsc = null;
    }
    if (this.ringtoneGain) {
      try {
        this.ringtoneGain.disconnect();
      } catch (e) {}
      this.ringtoneGain = null;
    }
  }

  playCallEndTone() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  playCallAnswerTone() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  /**
   * Deep atmospheric cosmic anomaly sound when secret 13th star reveals
   */
  playAnomalySound() {
    // Opening sound disabled per user preference
  }

  playRevealChime() {
    // Opening sound disabled per user preference
  }

  /**
   * Custom Portal Sound Effect
   * Plays user custom sound file from /audio/portal.mp3 (or /audio/portal.wav)
   */
  playExplosionSound() {
    if (!this.isAudioEnabled()) return;

    try {
      // 1. Attempt to play custom portal audio file placed in public/audio/portal.mp3 or portal.wav
      const portalAudio = new Audio('/audio/portal.mp3');
      portalAudio.volume = 0.85;

      const playPromise = portalAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Try wav extension if mp3 fails
          const wavAudio = new Audio('/audio/portal.wav');
          wavAudio.volume = 0.85;
          wavAudio.play().catch(() => {
            // Fallback to Web Audio synthesis if custom file not present
            this.playSynthesizedPortalSound();
          });
        });
      }
    } catch (e) {
      this.playSynthesizedPortalSound();
    }
  }

  /**
   * Fallback Synthesized Sci-Fi Portal Sound
   */
  private playSynthesizedPortalSound() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Heavy Sub-bass Void Drop
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(240, now);
      sub.frequency.exponentialRampToValueAtTime(18, now + 2.5);

      subGain.gain.setValueAtTime(0.6, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(450, now);
      subFilter.frequency.exponentialRampToValueAtTime(30, now + 2.5);

      sub.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 3.5);
    } catch (e) {}
  }

  /**
   * Bright cosmic pickup sound for hidden game fragments
   */
  playPickupSound() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  /**
   * Victory sound on completing the hidden game level
   */
  playVictorySound() {
    if (!this.isAudioEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((note, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now + idx * 0.1);

        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.8);
      });
    } catch (e) {}
  }
  public resumeAudioContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const soundFx = new SoundEffectsManager();

// Standalone function exports for callService & notificationStore compatibility
export const playMessageChime = () => soundFx.playMessageChime();
export const startRingtone = () => soundFx.startRingtone();
export const stopRingtone = () => soundFx.stopRingtone();
export const playCallEndTone = () => soundFx.playCallEndTone();
export const playCallAnswerTone = () => soundFx.playCallAnswerTone();
export const resumeAudioContext = () => soundFx.resumeAudioContext();
