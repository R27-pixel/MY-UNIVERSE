import { create } from 'zustand';
import type { QualityTier, DeviceCapability } from '../types';
import { themeConfig } from '../config/theme.config';

interface SettingsState {
  audioEnabled: boolean;
  audioVolume: number;
  qualityTier: QualityTier;
  reducedMotion: boolean;
  showHUD: boolean;
  device: DeviceCapability;

  // Actions
  toggleAudio: () => void;
  setVolume: (v: number) => void;
  setQuality: (tier: QualityTier) => void;
  setReducedMotion: (v: boolean) => void;
  toggleHUD: () => void;
  detectDevice: () => void;
}

function detectDeviceCapability(): DeviceCapability {
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let hasWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    hasWebGL2 = !!canvas.getContext('webgl2');
  } catch {
    hasWebGL2 = false;
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memoryGB = (navigator as any).deviceMemory || 4;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let tier: QualityTier;
  if (isMobile && (cores <= 4 || memoryGB <= 3)) {
    tier = 'low';
  } else if (isMobile) {
    tier = 'medium';
  } else if (cores >= 8 && memoryGB >= 8) {
    tier = 'ultra';
  } else if (cores >= 4) {
    tier = 'high';
  } else {
    tier = 'medium';
  }

  const particleMap: Record<QualityTier, number> = {
    ultra: 15000,
    high: 10000,
    medium: 5000,
    low: 2000,
  };

  return {
    tier,
    isMobile,
    isTouch,
    hasWebGL2,
    maxParticles: particleMap[tier],
    enableBloom: tier !== 'low',
    enableDoF: tier === 'ultra' || tier === 'high',
    enableGrain: tier !== 'low',
    enableAberration: tier === 'ultra' || tier === 'high',
    pixelRatio: tier === 'low' ? 1 : dpr,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  audioEnabled: themeConfig.audio.enabled,
  audioVolume: themeConfig.audio.volume,
  qualityTier: 'high',
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
  showHUD: true,
  device: detectDeviceCapability(),

  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  setVolume: (v) => set({ audioVolume: v }),
  setQuality: (tier) => set({ qualityTier: tier }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  toggleHUD: () => set((s) => ({ showHUD: !s.showHUD })),
  detectDevice: () => set({ device: detectDeviceCapability() }),
}));
