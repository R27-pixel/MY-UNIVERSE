/**
 * UNIVERSE 3D CONFIGURATION
 * ────────────────────────
 * Centralized settings for 3D camera controls, touch interaction thresholds,
 * mobile vs desktop movement sensitivity, and rendering performance modes.
 */

export const universeConfig = {
  controls: {
    desktop: {
      rotationSensitivity: 0.0008,
      touchSensitivity: 0.012,
      zoomSpeed: 5.0,
      damping: 0.12,
      zoomDamping: 0.25,
      momentumDecay: 0.92,
      panClampX: 40,
      panClampY: 30,
      zoomMin: -120,
      zoomMax: -3,
    },
    mobile: {
      rotationSensitivity: 0.0003, // Calm, smooth mobile camera rotation
      touchSensitivity: 0.004,    // Gentle, controlled single-finger drag
      zoomSpeed: 1.5,             // Smooth, controlled pinch zoom
      damping: 0.07,             // Smooth lerp damping to prevent sudden movements
      zoomDamping: 0.12,         // Smooth zoom lerp
      momentumDecay: 0.85,        // Gradual deceleration
      panClampX: 38,             // Full panorama reach across outer stars
      panClampY: 28,             // Full vertical reach
      zoomMin: -90,
      zoomMax: -5,
    },
  },
  interaction: {
    tapDragThresholdMobilePx: 24, // Generous 24px threshold for mobile finger wobble
    tapDragThresholdDesktopPx: 10,
    hitSphereMobileScale: 3.8,   // Large, effortless touch target area for mobile
    hitSphereDesktopScale: 2.2,
  },
  performance: {
    modes: ['AUTO', 'HIGH', 'BALANCED', 'LOW'] as const,
    defaultMode: 'AUTO' as const,
  },
};
