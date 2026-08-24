import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { constellationConnections as staticConnections } from '../config/memories.config';
import { useExperienceStore } from '../stores/experienceStore';
import { mapDbContentToMemories } from '../utils/celestialMapper';
import type { Memory } from '../types';

interface ConstellationLinesProps {
  memories?: Memory[];
}

/**
 * ConstellationLines — Lines that connect discovered memories.
 * Lines only appear when BOTH connected memories have been discovered.
 * Animated draw-on effect with glow.
 */
export function ConstellationLines({ memories: propMemories }: ConstellationLinesProps) {
  const linesRef = useRef<THREE.Group>(null);
  const discoveredIds = useExperienceStore((s) => s.discoveredMemoryIds);
  const activeUniverseStars = useExperienceStore((s) => s.activeUniverseStars);
  const activeUniverseMemories = useExperienceStore((s) => s.activeUniverseMemories);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);

  const activeMemories = useMemo(() => {
    if (propMemories && propMemories.length > 0) {
      return propMemories;
    }
    return mapDbContentToMemories(
      activeUniverseStars,
      activeUniverseMemories,
      activeUniverse?.theme_config
    );
  }, [propMemories, activeUniverseStars, activeUniverseMemories, activeUniverse?.theme_config]);

  const memoryPositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const m of activeMemories) {
      map.set(m.id, new THREE.Vector3(m.position.x, m.position.y, m.position.z));
    }
    return map;
  }, [activeMemories]);

  const connections = useMemo(() => {
    if (!activeUniverseStars || activeUniverseStars.length === 0) {
      return staticConnections;
    }
    const dynamicConnections: Array<[string, string]> = [];
    for (let i = 0; i < activeMemories.length - 1; i++) {
      dynamicConnections.push([activeMemories[i].id, activeMemories[i + 1].id]);
    }
    return dynamicConnections;
  }, [activeUniverseStars, activeMemories]);

  const visibleLines = useMemo(() => {
    // Hide permanent straight connection lines upon 12/12 completion
    if (discoveredIds.size >= 12) return [];

    return connections.filter(
      ([a, b]) => discoveredIds.has(a) && discoveredIds.has(b)
    );
  }, [discoveredIds, connections]);

  useFrame((state) => {
    if (!linesRef.current) return;
    // Subtle opacity pulse
    linesRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Line) {
        const mat = child.material as THREE.LineBasicMaterial;
        mat.opacity = 0.2 + Math.sin(state.clock.elapsedTime * 0.8 + i) * 0.08;
      }
    });
  });

  return (
    <group ref={linesRef}>
      {visibleLines.map(([a, b]) => {
        const posA = memoryPositions.get(a);
        const posB = memoryPositions.get(b);
        if (!posA || !posB) return null;

        const points = [posA, posB];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        return (
          // @ts-ignore - R3F line primitive types conflict with SVG line in some TS configurations
          <line key={`${a}-${b}`} geometry={geometry}>
            <lineBasicMaterial
              color="#4fc3f7"
              transparent
              opacity={0.2}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </line>
        );
      })}
    </group>
  );
}
