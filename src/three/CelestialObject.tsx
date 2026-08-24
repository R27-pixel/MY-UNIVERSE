import { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Memory, CelestialType } from '../types';
import { useExperienceStore } from '../stores/experienceStore';
import { PlanetMaterial, AtmosphereShell } from './PlanetShader';
import { useSettingsStore } from '../stores/settingsStore';
import { universeConfig } from '../config/universe.config';

interface Props {
  memory: Memory;
  onClick: (memory: Memory) => void;
}

const GLOW_COLORS: Record<string, string> = {
  '#ffd700': '#ffd700',
  '#9c6cff': '#b388ff',
  '#4fc3f7': '#4fc3f7',
  '#ff6b35': '#ff8a65',
  '#e91e8a': '#f48fb1',
  '#2d1b69': '#7c4dff',
  '#7ec8e3': '#80deea',
};

function getCelestialGeometry(type: CelestialType) {
  switch (type) {
    case 'star':
      return <sphereGeometry args={[0.75, 64, 64]} />;
    case 'planet':
      return <sphereGeometry args={[0.85, 64, 64]} />;
    case 'portal':
      return <sphereGeometry args={[0.8, 64, 64]} />;
    case 'fragment':
      return <sphereGeometry args={[0.7, 64, 64]} />;
    case 'capsule':
      return <sphereGeometry args={[0.75, 64, 64]} />;
    case 'nebula':
      return <sphereGeometry args={[0.9, 64, 64]} />;
    case 'constellation':
      return <sphereGeometry args={[0.7, 64, 64]} />;
    case 'mystery':
      return <sphereGeometry args={[0.85, 64, 64]} />;
    default:
      return <sphereGeometry args={[0.75, 64, 64]} />;
  }
}

const ATMOSPHERE_TYPES: Set<CelestialType> = new Set([
  'planet', 'nebula', 'mystery', 'capsule',
]);

export function CelestialObject({ memory, onClick }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const pointerDownStart = useRef<{ x: number; y: number } | null>(null);

  const isDiscovered = useExperienceStore((s) => s.discoveredMemoryIds.has(memory.id));
  const discoveredCount = useExperienceStore((s) => s.discoveredMemoryIds.size);
  const device = useSettingsStore((s) => s.device);

  const color = memory.color || '#4fc3f7';
  const glowColor = GLOW_COLORS[color] || color;
  const scale = memory.scale || 1;

  // Extract planet number (e.g. memory-01 -> 1, memory-12 -> 12)
  const planetNumber = memory.id.replace('memory-', '').replace(/^0/, '');

  // Check unlock condition
  const isLocked = useMemo(() => {
    if (!memory.unlockCondition) return false;
    if (memory.unlockCondition.type === 'discoveredCount') {
      return discoveredCount < (memory.unlockCondition.value as number);
    }
    return false;
  }, [memory.unlockCondition, discoveredCount]);

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'default';
  }, []);

  // Track initial pointer down position for drag-vs-tap discrimination
  const handlePointerDown = useCallback((e: any) => {
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    pointerDownStart.current = { x: clientX, y: clientY };
  }, []);

  // Handle click / pointer release: discriminate between dragging universe vs tapping star
  const handlePointerUp = useCallback(
    (e: any) => {
      if (isLocked) return;

      const maxThreshold = device.isMobile
        ? universeConfig.interaction.tapDragThresholdMobilePx
        : universeConfig.interaction.tapDragThresholdDesktopPx;

      if (pointerDownStart.current) {
        const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
        const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
        const dx = clientX - pointerDownStart.current.x;
        const dy = clientY - pointerDownStart.current.y;
        const dist = Math.hypot(dx, dy);

        // Allow up to 24px finger wobble on mobile devices
        if (dist > maxThreshold) {
          pointerDownStart.current = null;
          return;
        }
      }

      pointerDownStart.current = null;
      onClick(memory);
    },
    [isLocked, onClick, memory, device.isMobile]
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;

    switch (memory.animationStyle) {
      case 'pulse': {
        const pulseScale = scale * (1 + Math.sin(t * 1.5) * 0.08);
        mesh.scale.setScalar(pulseScale);
        break;
      }
      case 'orbit': {
        mesh.position.x = memory.position.x + Math.sin(t * 0.3) * 1.5;
        mesh.position.z = memory.position.z + Math.cos(t * 0.3) * 1.5;
        break;
      }
      case 'float': {
        mesh.position.y = memory.position.y + Math.sin(t * 0.5) * 0.8;
        break;
      }
      case 'spin': {
        mesh.rotation.y = t * 0.5;
        mesh.rotation.x = t * 0.2;
        break;
      }
      case 'breathe': {
        const breatheScale = scale * (1 + Math.sin(t * 0.8) * 0.12);
        mesh.scale.setScalar(breatheScale);
        break;
      }
      default: {
        mesh.rotation.y = t * 0.2;
      }
    }

    // Dynamic hover scale without compounding every frame
    const currentScale = hovered ? scale * 1.18 : scale;
    mesh.scale.setScalar(currentScale);

    if (glowRef.current) {
      const glowScale = (hovered ? 2.8 : isDiscovered ? 2.2 : 1.8) + Math.sin(t * 2) * 0.2;
      glowRef.current.scale.setScalar(glowScale);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        hovered ? 0.2 : isDiscovered ? 0.12 : 0.06;
    }
  });

  if (isLocked) {
    return (
      <group position={[memory.position.x, memory.position.y, memory.position.z]}>
        <mesh ref={meshRef} scale={scale * 0.5}>
          {getCelestialGeometry(memory.celestialType)}
          <meshBasicMaterial color="#111122" transparent opacity={0.15} />
        </mesh>
      </group>
    );
  }

  // Generous hit-target scale so tapping planets on smartphones is effortless
  const hitScale = device.isMobile ? 3.5 : 2.2;

  return (
    <group position={[memory.position.x, memory.position.y, memory.position.z]}>
      {/* Invisible hit-area sphere with tap-vs-drag threshold */}
      <mesh
        scale={scale}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[hitScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Main visual object */}
      <mesh ref={meshRef} scale={scale}>
        {getCelestialGeometry(memory.celestialType)}
        <PlanetMaterial celestialType={memory.celestialType} color={color} />
      </mesh>

      {/* Atmosphere shell */}
      {ATMOSPHERE_TYPES.has(memory.celestialType) && (
        <AtmosphereShell color={color} size={1.2} />
      )}

      {/* Planetary Ring System (Only on select Gas Giant planets: Memory 4 & Memory 12) */}
      {(memory.id === 'memory-04' || memory.id === 'memory-12') && (
        <mesh rotation={[Math.PI / 3, 0, Math.PI / 6]} scale={scale * 1.35}>
          <torusGeometry args={[1.3, 0.05, 16, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={hovered ? 0.75 : 0.45}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Glow sphere */}
      <mesh ref={glowRef} scale={1.8}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Permanent planet number badge (1-12) */}
      <Html
        center
        distanceFactor={18}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: isDiscovered ? 'rgba(255, 215, 0, 0.25)' : 'rgba(12, 12, 28, 0.75)',
            border: `1.5px solid ${isDiscovered ? '#ffd700' : color}`,
            boxShadow: `0 0 12px ${isDiscovered ? 'rgba(255, 215, 0, 0.6)' : color}`,
            color: isDiscovered ? '#ffd700' : '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '11px',
            fontWeight: 700,
            transform: 'translateY(24px)',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.3s ease',
          }}
        >
          {planetNumber}
        </div>
      </Html>

      {/* Hover label */}
      {hovered && (
        <Html
          center
          distanceFactor={15}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '12px',
              fontWeight: 300,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              transform: 'translateY(-40px)',
              textShadow: '0 0 10px rgba(79,195,247,0.5)',
            }}
          >
            {memory.title}
            <div
              style={{
                fontSize: '9px',
                color: 'rgba(255,255,255,0.4)',
                marginTop: '4px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {memory.date}
            </div>
          </div>
        </Html>
      )}

      {/* Point light for discovered memories */}
      {isDiscovered && <pointLight color={color} intensity={0.5} distance={8} decay={2} />}
    </group>
  );
}
