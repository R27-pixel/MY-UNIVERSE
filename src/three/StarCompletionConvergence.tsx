import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { memories } from '../config/memories.config';
import { useExperienceStore } from '../stores/experienceStore';
import { soundFx } from '../utils/soundEffects';
import { getCircleParticleTexture } from './particleTexture';

const CENTER_POINT = new THREE.Vector3(0, 0, -20);
const DURATION_MS = 5500; // 5.5 seconds total cinematic sequence

/**
 * StarCompletionConvergence — Cinematic 12-star completion sequence:
 * 1. (0.0s - 1.0s) All 12 stars gently pulse expanding light waves.
 * 2. (1.0s - 3.0s) Organic curved Bezier energy trails stream from each star toward the center.
 * 3. (3.0s - 4.5s) Streams converge at center to form a glowing temporary cosmic core.
 * 4. (4.5s - 5.5s) Quiet moment as streams fade and core transitions to reveal 13th star.
 * 5. (5.5s+) Fully dissolves and cleans up from scene.
 */
export function StarCompletionConvergence() {
  const discoveredCount = useExperienceStore((s) => s.discoveredMemoryIds.size);
  const totalMemories = useExperienceStore((s) => s.totalMemories);
  const isComplete = discoveredCount >= totalMemories;

  const [animating, setAnimating] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const coreMeshRef = useRef<THREE.Mesh>(null);
  const coreGlowRef = useRef<THREE.Mesh>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const trailsGroupRef = useRef<THREE.Group>(null);

  // Trigger convergence sequence on 12/12 completion
  useEffect(() => {
    if (isComplete && !animating && startTimeRef.current === null) {
      // Small delay to allow 12th star modal to settle
      const timer = setTimeout(() => {
        setAnimating(true);
        startTimeRef.current = Date.now();
        soundFx.playRevealChime();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isComplete, animating]);

  // Pre-calculate 12 Curved Bezier Paths from each star to center
  const curvedPaths = useMemo(() => {
    return memories.map((m, idx) => {
      const p0 = new THREE.Vector3(m.position.x, m.position.y, m.position.z);
      const p2 = CENTER_POINT.clone();

      // Control point offset for smooth organic curve (NOT straight lines)
      const mid = p0.clone().add(p2).multiplyScalar(0.5);
      const perpAngle = (idx / memories.length) * Math.PI * 2;
      const curveHeight = 8.0 + Math.sin(idx * 1.5) * 4.0;

      const p1 = new THREE.Vector3(
        mid.x + Math.cos(perpAngle) * curveHeight,
        mid.y + Math.sin(perpAngle) * curveHeight,
        mid.z + Math.sin(idx) * 3.0
      );

      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const points = curve.getPoints(32);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const starColor = new THREE.Color(m.color || '#4fc3f7');

      return { geometry, starColor, idx, p0 };
    });
  }, []);

  // Particle stream along curved trails
  const particleCountPerStar = 16;
  const totalParticles = memories.length * particleCountPerStar;

  const { particlePositions, particleColors } = useMemo(() => {
    const particlePositions = new Float32Array(totalParticles * 3);
    const particleColors = new Float32Array(totalParticles * 3);

    memories.forEach((m, sIdx) => {
      const col = new THREE.Color(m.color || '#4fc3f7');
      for (let pIdx = 0; pIdx < particleCountPerStar; pIdx++) {
        const i = sIdx * particleCountPerStar + pIdx;
        particlePositions[i * 3] = m.position.x;
        particlePositions[i * 3 + 1] = m.position.y;
        particlePositions[i * 3 + 2] = m.position.z;

        particleColors[i * 3] = col.r;
        particleColors[i * 3 + 1] = col.g;
        particleColors[i * 3 + 2] = col.b;
      }
    });

    return { particlePositions, particleColors };
  }, [totalParticles]);

  const particlesRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!animating || startTimeRef.current === null) return;

    const elapsed = Date.now() - startTimeRef.current;
    const progress = Math.min(elapsed / DURATION_MS, 1.0);

    // 0.0s - 1.0s: Star Pulse Wave
    const pulsePhase = Math.min(elapsed / 1000, 1.0);

    // 1.0s - 3.0s: Stream Convergence along Bezier Curves
    const streamProgress = Math.max(0, Math.min((elapsed - 1000) / 2000, 1.0));

    // 3.0s - 4.5s: Cosmic Core Intensifies
    const coreProgress = Math.max(0, Math.min((elapsed - 3000) / 1500, 1.0));

    // 4.5s - 5.5s: Dissolve and quiet transition
    const fadeOutProgress = Math.max(0, Math.min((elapsed - 4500) / 1000, 1.0));

    // Update curved line opacities (Temporary lines, fade out after 3.5s)
    if (trailsGroupRef.current) {
      const lineOpacity = Math.max(0, (1 - fadeOutProgress)) * (streamProgress > 0 ? 0.4 : pulsePhase * 0.2);
      trailsGroupRef.current.children.forEach((child) => {
        if (child instanceof THREE.Line) {
          (child.material as THREE.LineBasicMaterial).opacity = lineOpacity;
        }
      });
    }

    // Animate streaming particles along quadratic Bezier curves toward center
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;

      curvedPaths.forEach((path, sIdx) => {
        const p0 = path.p0;
        const p2 = CENTER_POINT;

        for (let pIdx = 0; pIdx < particleCountPerStar; pIdx++) {
          const i = sIdx * particleCountPerStar + pIdx;
          const offset = (pIdx / particleCountPerStar) * 0.3;
          const t = Math.max(0, Math.min(streamProgress * 1.3 - offset, 1.0));

          // Quadratic Bezier interpolation
          const mid = p0.clone().add(p2).multiplyScalar(0.5);
          const perpAngle = (sIdx / memories.length) * Math.PI * 2;
          const curveHeight = 8.0 + Math.sin(sIdx * 1.5) * 4.0;
          const p1 = new THREE.Vector3(
            mid.x + Math.cos(perpAngle) * curveHeight,
            mid.y + Math.sin(perpAngle) * curveHeight,
            mid.z + Math.sin(sIdx) * 3.0
          );

          const oneMinusT = 1 - t;
          const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
          const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
          const z = oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z;

          array[i * 3] = x;
          array[i * 3 + 1] = y;
          array[i * 3 + 2] = z;
        }
      });

      posAttr.needsUpdate = true;
      (particlesRef.current.material as THREE.PointsMaterial).opacity =
        (1 - fadeOutProgress) * (streamProgress > 0 ? 0.8 : 0);
    }

    // Animate temporary cosmic core at center
    if (coreMeshRef.current && coreGlowRef.current) {
      const coreScale = coreProgress * (1.2 + Math.sin(state.clock.elapsedTime * 4) * 0.15) * (1 - fadeOutProgress);
      coreMeshRef.current.scale.setScalar(coreScale);
      coreGlowRef.current.scale.setScalar(coreScale * 2.2);

      if (coreLightRef.current) {
        coreLightRef.current.intensity = coreProgress * 3.5 * (1 - fadeOutProgress);
      }
    }

    // End animation after 5.5s and clean up completely
    if (progress >= 1.0) {
      setAnimating(false);
    }
  });

  if (!animating) return null;

  return (
    <group>
      {/* Temporary Cosmic Core Mesh at Center */}
      <group position={[CENTER_POINT.x, CENTER_POINT.y, CENTER_POINT.z]}>
        <pointLight ref={coreLightRef} color="#c084fc" distance={40} decay={1.8} />

        <mesh ref={coreMeshRef} scale={0}>
          <sphereGeometry args={[1.4, 32, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        <mesh ref={coreGlowRef} scale={0}>
          <sphereGeometry args={[2.0, 24, 24]} />
          <meshBasicMaterial
            color="#a855f7"
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Temporary Curved Bezier Energy Trails from Stars to Center */}
      <group ref={trailsGroupRef}>
        {curvedPaths.map((path) => (
          // @ts-ignore
          <line key={path.idx} geometry={path.geometry}>
            <lineBasicMaterial
              color={path.starColor}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              linewidth={1}
            />
          </line>
        ))}
      </group>

      {/* Thin Streaming Light Particles Traveling Along Curves */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[particleColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.25}
          map={getCircleParticleTexture()}
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
