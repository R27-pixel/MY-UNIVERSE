import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useSettingsStore } from '../stores/settingsStore';
import * as THREE from 'three';

/**
 * PostProcessing — Cinematic effect pipeline.
 * Adapts to device capability: disables expensive effects on low-end devices.
 */
export function PostProcessing() {
  const device = useSettingsStore((s) => s.device);

  return (
    <EffectComposer multisampling={0}>
      {/* Bloom — selective glow on emissive objects */}
      {device.enableBloom && (
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={1.2}
          mipmapBlur
        />
      )}

      {/* Chromatic Aberration — subtle color fringing */}
      {device.enableAberration && (
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0008)}
          // @ts-ignore - radialModulation is valid in postprocessing but missing in current @react-three/postprocessing types
          radialModulation={true}
          modulationOffset={0.5}
          blendFunction={BlendFunction.NORMAL}
        />
      )}

      {/* Film Grain */}
      {device.enableGrain && (
        <Noise
          premultiply
          blendFunction={BlendFunction.ADD}
          opacity={0.03}
        />
      )}

      {/* Vignette — edge darkening for cinematic framing */}
      <Vignette
        offset={0.3}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
