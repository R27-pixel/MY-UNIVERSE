import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook to automatically monitor device hardware capabilities,
 * screen orientation, touch status, and reduced motion accessibility preference.
 */
export function useDeviceCapability() {
  const device = useSettingsStore((s) => s.device);
  const qualityTier = useSettingsStore((s) => s.qualityTier);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const detectDevice = useSettingsStore((s) => s.detectDevice);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);

  useEffect(() => {
    // Initial capability check
    detectDevice();

    // Resize and orientation listener to update DPI / device bounds
    const handleResize = () => {
      detectDevice();
    };

    // Reduced motion accessibility preference listener
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(handleMotionChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionChange);
      } else if (motionQuery?.removeListener) {
        motionQuery.removeListener(handleMotionChange);
      }
    };
  }, [detectDevice, setReducedMotion]);

  return {
    device,
    qualityTier,
    reducedMotion,
  };
}
