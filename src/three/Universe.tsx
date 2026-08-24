import { useCallback, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { StarField } from './StarField';
import { DistantSupernova } from './DistantSupernova';
import { CelestialObject } from './CelestialObject';
import { ConstellationLines } from './ConstellationLines';
import { CameraController } from './CameraController';
import { PostProcessing } from './PostProcessing';
import { Star13Object } from './Star13Object';
import { StarExplosionEffect } from './StarExplosionEffect';
import { StarCompletionConvergence } from './StarCompletionConvergence';
import { useExperienceStore } from '../stores/experienceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { mapDbContentToMemories } from '../utils/celestialMapper';
import type { Memory } from '../types';

/**
 * Universe — The main 3D scene containing stars, celestial objects,
 * constellation lines, 12-star completion convergence, background supernova flare, lighting, and post-processing.
 */
export function Universe() {
  const setPhase = useExperienceStore((s) => s.setPhase);
  const setActiveMemory = useExperienceStore((s) => s.setActiveMemory);
  const activeUniverseStars = useExperienceStore((s) => s.activeUniverseStars);
  const activeUniverseMemories = useExperienceStore((s) => s.activeUniverseMemories);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const device = useSettingsStore((s) => s.device);

  const activeMemories = useMemo(() => {
    return mapDbContentToMemories(
      activeUniverseStars,
      activeUniverseMemories,
      activeUniverse?.theme_config
    );
  }, [activeUniverseStars, activeUniverseMemories, activeUniverse?.theme_config]);

  const handleMemoryClick = useCallback(
    (memory: Memory) => {
      setActiveMemory(memory.id);
      setPhase('MEMORY');
    },
    [setActiveMemory, setPhase]
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#000',
      }}
    >
      <Canvas
        dpr={device.pixelRatio}
        camera={{
          fov: 60,
          near: 0.1,
          far: 500,
          position: [0, 0, -15],
        }}
        gl={{
          antialias: device.tier !== 'low',
          alpha: false,
          powerPreference: device.isMobile ? 'low-power' : 'high-performance',
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
          });
        }}
        style={{ touchAction: 'none' }}
      >
        <Suspense fallback={null}>
          {/* Ambient light — dim deep space base */}
          <ambientLight intensity={0.05} />

          {/* Distant directional light — key light */}
          <directionalLight
            position={[20, 30, -50]}
            intensity={0.15}
            color="#4fc3f7"
          />

          {/* Deep nebula point lights */}
          <pointLight position={[-30, 10, -80]} intensity={0.3} color="#2d1b69" distance={100} decay={2} />
          <pointLight position={[40, -20, -60]} intensity={0.2} color="#1a1a4e" distance={80} decay={2} />

          {/* Depth fog */}
          <fog attach="fog" args={['#000005', 30, 200]} />

          {/* Star field backdrop */}
          <StarField />

          {/* Celestial objects (memories) */}
          {activeMemories.map((memory) => (
            <CelestialObject
              key={memory.id}
              memory={memory}
              onClick={handleMemoryClick}
            />
          ))}

          {/* Constellation lines between discovered memories */}
          <ConstellationLines memories={activeMemories} />

          {/* Cinematic 12-Star Convergence Sequence upon reaching 12/12 */}
          <StarCompletionConvergence />

          {/* Secret 13th Star Object */}
          <Star13Object />

          {/* Star Explosion & Portal Effect */}
          <StarExplosionEffect />

          {/* Camera controls */}
          <CameraController />

          {/* Post-processing effects */}
          <PostProcessing />
        </Suspense>
      </Canvas>
    </div>
  );
}
