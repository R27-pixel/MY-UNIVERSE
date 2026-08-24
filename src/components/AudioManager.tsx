import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useExperienceStore } from '../stores/experienceStore';

/**
 * AudioManager — Plays ambient background music when audio is enabled
 * via the top-right speaker button. Features smooth phase-ducking (softens during
 * Letter, Final Choice, and Chat phases).
 */
export function AudioManager() {
  const audioEnabled = useSettingsStore((s) => s.audioEnabled);
  const audioVolume = useSettingsStore((s) => s.audioVolume);
  const phase = useExperienceStore((s) => s.phase);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = audioVolume;

    // Primary source: Windows file name /audio/bgm.mp3.mp3
    const src1 = document.createElement('source');
    src1.src = '/audio/bgm.mp3.mp3';
    src1.type = 'audio/mpeg';
    audio.appendChild(src1);

    // Fallback source: /audio/bgm.mp3
    const src2 = document.createElement('source');
    src2.src = '/audio/bgm.mp3';
    src2.type = 'audio/mpeg';
    audio.appendChild(src2);

    audio.load();
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Duck volume during quiet or introspective phases (Letter, Final Choice, Chat)
    let targetVolume = audioVolume;
    if (phase === 'LETTER' || phase === 'FINAL' || phase === 'ENDED') {
      targetVolume = audioVolume * 0.25;
    } else if (phase === 'CHAT') {
      targetVolume = audioVolume * 0.45;
    }

    audio.volume = Math.max(0, Math.min(1, targetVolume));

    if (audioEnabled) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[Audio Autoplay Notice - Click Speaker Icon to Play]', err.message);
        });
      }
    } else {
      audio.pause();
    }
  }, [audioEnabled, audioVolume, phase]);

  return null;
}
