import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useExperienceStore } from '../stores/experienceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getCircleParticleTexture } from './particleTexture';
import { soundFx } from '../utils/soundEffects';

const STAR_13_POSITION = new THREE.Vector3(22, 14, -40);

export function Star13Object() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const discoveredCount = useExperienceStore((s) => s.discoveredMemoryIds.size);
  const totalMemories = useExperienceStore((s) => s.totalMemories);
  const star13Unlocked = useExperienceStore((s) => s.star13Unlocked);
  const isExploding = useExperienceStore((s) => s.isExploding13thStar);
  const triggerExplosion = useExperienceStore((s) => s.triggerStar13Explosion);
  const openPortalModal = useExperienceStore((s) => s.showPortalModal);
  const openPortal = useExperienceStore((s) => s.openPortalModal);
  const device = useSettingsStore((s) => s.device);

  const isEligible = discoveredCount >= totalMemories || star13Unlocked;
  const [revealed, setRevealed] = useState(star13Unlocked);
  const [scale, setScale] = useState(star13Unlocked ? 1 : 0);
  const [hovered, setHovered] = useState(false);

  // Trigger reveal sequence after 12/12 completion (aligned with 5.5s convergence animation)
  useEffect(() => {
    if (isEligible && !revealed) {
      const timer = setTimeout(() => {
        setRevealed(true);
        soundFx.playAnomalySound();
      }, 5500); // Perfectly aligned with 5.5s 12-star convergence completion
      return () => clearTimeout(timer);
    }
  }, [isEligible, revealed]);

  // Smooth scale lerp in 3D frame
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    // Target scale calculation
    const targetScale = revealed ? (hovered ? 1.4 : 1.0) : 0;
    setScale((prev) => THREE.MathUtils.lerp(prev, targetScale, delta * 3));

    meshRef.current.scale.setScalar(scale);

    if (ringRef.current) {
      ringRef.current.scale.setScalar(scale * (1.2 + Math.sin(t * 3) * 0.15));
      ringRef.current.rotation.z += delta * 0.8;
      ringRef.current.rotation.x = Math.sin(t * 0.5) * 0.3;
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.3;
    }

    // Wide Sweeping 3D Cosmic Orbital Path
    const orbitX = STAR_13_POSITION.x + Math.sin(t * 0.35) * 24.0 + Math.cos(t * 0.15) * 8.0;
    const orbitY = STAR_13_POSITION.y + Math.cos(t * 0.25) * 16.0 + Math.sin(t * 0.5) * 5.0;
    const orbitZ = STAR_13_POSITION.z + Math.sin(t * 0.2) * 14.0;

    meshRef.current.position.set(orbitX, orbitY, orbitZ);
    if (ringRef.current) ringRef.current.position.set(orbitX, orbitY, orbitZ);
    if (particlesRef.current) particlesRef.current.position.set(orbitX, orbitY, orbitZ);
    if (lightRef.current) {
      lightRef.current.position.set(orbitX, orbitY, orbitZ);
      lightRef.current.intensity = scale * (1.8 + Math.sin(t * 5) * 0.5);
    }
  });

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!revealed) return;

      // Play portal audio sound immediately on click
      soundFx.playExplosionSound();

      // Trigger 3D explosion sequence if not already active
      if (!isExploding) {
        triggerExplosion();
      }

      // Open hidden level portal modal prompt with an exact 800ms gap after click
      setTimeout(() => {
        openPortal();
      }, 1200);
    },
    [revealed, isExploding, openPortal, triggerExplosion]
  );

  // Particle halo buffer
  const particleCount = device.isMobile ? 30 : 65;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 2.5 + Math.random() * 2.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      pos[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      pos[i * 3 + 1] = radius * Math.sin(phi);
      pos[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);
    }
    return pos;
  }, [particleCount]);

  // Cosmic White Particle Trailing Stream behind Portal
  const trailCount = device.isMobile ? 45 : 90;
  const trailPositions = useMemo(() => {
    const pos = new Float32Array(trailCount * 3);
    for (let i = 0; i < trailCount; i++) {
      const progress = i / trailCount;
      const angle = progress * Math.PI * 2.2;
      const r = 0.6 + progress * 14.0;

      pos[i * 3] = -Math.cos(angle) * (r * 0.8) + (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 1] = -Math.sin(angle * 0.6) * (r * 0.4) + (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 2] = -progress * 22.0 + (Math.random() - 0.5) * 0.9;
    }
    return pos;
  }, [trailCount]);

  const circleTexture = useMemo(() => getCircleParticleTexture(), []);

  if (!isEligible || (!revealed && scale < 0.01)) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* Dynamic Point Light */}
      <pointLight
        ref={lightRef}
        color="#a855f7"
        distance={25}
        decay={2}
      />

      {/* Core Glowing Mesh */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshStandardMaterial
          color="#d8b4fe"
          emissive="#9333ea"
          emissiveIntensity={hovered ? 2.5 : 1.8}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Orbiting Energy Ring */}
      <mesh ref={ringRef} onClick={handleClick}>
        <torusGeometry args={[2.8, 0.12, 16, 64]} />
        <meshBasicMaterial
          color="#c084fc"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cosmic White Trailing Stream behind Portal */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.4}
          map={circleTexture}
          color="#ffffff"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Ambient Particle Halo */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3}
          map={circleTexture}
          color="#f472b6"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Invisible Touch Hit Target for Mobile */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[4.5, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
