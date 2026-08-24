import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useExperienceStore } from '../stores/experienceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { soundFx } from '../utils/soundEffects';

const EXPLOSION_CENTER = new THREE.Vector3(22, 14, -40);

export function StarExplosionEffect() {
  const isExploding = useExperienceStore((s) => s.isExploding13thStar);
  const finishExplosion = useExperienceStore((s) => s.finishStar13Explosion);
  const star13Unlocked = useExperienceStore((s) => s.star13Unlocked);
  const device = useSettingsStore((s) => s.device);

  const portalGroupRef = useRef<THREE.Group>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const trailParticlesRef = useRef<THREE.Points>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const portalVortexRef = useRef<THREE.Mesh>(null);
  const eventHorizonRef = useRef<THREE.Mesh>(null);

  const [stage, setStage] = useState<'idle' | 'implode' | 'explode' | 'portal'>('idle');
  const [startTime, setStartTime] = useState<number>(0);

  // Initialize explosion particles
  const particleCount = device.isMobile ? 120 : 350;
  const [particleData] = useState(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = 15 + Math.random() * 25;

      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      vel[i * 3] = dir.x * speed;
      vel[i * 3 + 1] = dir.y * speed;
      vel[i * 3 + 2] = dir.z * speed;
    }
    return { pos, vel };
  });

  // Initialize Portal Particle Trail
  const trailCount = device.isMobile ? 40 : 90;
  const [trailData] = useState(() => {
    const pos = new Float32Array(trailCount * 3);
    const speed = new Float32Array(trailCount);
    for (let i = 0; i < trailCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6.0;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6.0;
      pos[i * 3 + 2] = -Math.random() * 12.0; // Trail extends behind portal
      speed[i] = 0.8 + Math.random() * 1.5;
    }
    return { pos, speed };
  });

  useEffect(() => {
    if (isExploding) {
      setStage('implode');
      setStartTime(Date.now());

      // Reset explosion particle positions to center
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = 0;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }
    }
  }, [isExploding, particleCount]);

  useFrame((state, delta) => {
    if (!isExploding && !star13Unlocked) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const t = state.clock.elapsedTime;

    // Wide Sweeping 3D Cosmic Orbital Path
    const orbitX = EXPLOSION_CENTER.x + Math.sin(t * 0.35) * 24.0 + Math.cos(t * 0.15) * 8.0;
    const orbitY = EXPLOSION_CENTER.y + Math.cos(t * 0.25) * 16.0 + Math.sin(t * 0.5) * 5.0;
    const orbitZ = EXPLOSION_CENTER.z + Math.sin(t * 0.2) * 14.0;

    // Motion velocity vector calculation
    const prevX = EXPLOSION_CENTER.x + Math.sin((t - 0.05) * 0.35) * 24.0 + Math.cos((t - 0.05) * 0.15) * 8.0;
    const prevY = EXPLOSION_CENTER.y + Math.cos((t - 0.05) * 0.25) * 16.0 + Math.sin((t - 0.05) * 0.5) * 5.0;
    const prevZ = EXPLOSION_CENTER.z + Math.sin((t - 0.05) * 0.2) * 14.0;

    const velX = orbitX - prevX;
    const velY = orbitY - prevY;

    if (portalGroupRef.current) {
      portalGroupRef.current.position.set(orbitX, orbitY, orbitZ);

      portalGroupRef.current.rotation.x = Math.sin(t * 0.7) * 0.25;
      portalGroupRef.current.rotation.y = Math.cos(t * 0.6) * 0.25;
    }

    // Update Swirling Particle Trail Stream (Streaming opposite to movement velocity)
    if (trailParticlesRef.current) {
      const positions = trailParticlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < trailCount; i++) {
        // Stream backwards relative to motion direction
        positions[i * 3] -= velX * trailData.speed[i] * 3.5;
        positions[i * 3 + 1] -= velY * trailData.speed[i] * 3.5;
        positions[i * 3 + 2] -= trailData.speed[i] * delta * 12.0;

        // Swirl around trail core
        const angle = t * 2.5 + i;
        positions[i * 3] += Math.cos(angle) * delta * 1.5;
        positions[i * 3 + 1] += Math.sin(angle) * delta * 1.5;

        // Reset particle if drifted too far behind
        if (Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]) > 22.0) {
          positions[i * 3] = (Math.random() - 0.5) * 3.0;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
          positions[i * 3 + 2] = 0;
        }
      }
      trailParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Stage 1: Implode / Charge (0 - 1.2s)
    if (stage === 'implode') {
      if (flashLightRef.current) {
        flashLightRef.current.intensity = Math.min(elapsed * 25, 30);
      }
      if (elapsed > 1.2) {
        setStage('explode');
      }
    }

    // Stage 2: Shockwave & Particle Explosion (1.2s - 2.8s)
    if (stage === 'explode') {
      const expTime = elapsed - 1.2;

      // Expand shockwave ring
      if (shockwaveRef.current) {
        const shockScale = Math.min(expTime * 45, 60);
        shockwaveRef.current.scale.setScalar(shockScale);

        const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(1 - expTime * 0.7, 0);
      }

      // Update particle positions radiating outward
      if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += particleData.vel[i * 3] * delta;
          positions[i * 3 + 1] += particleData.vel[i * 3 + 1] * delta;
          positions[i * 3 + 2] += particleData.vel[i * 3 + 2] * delta;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Flash light fade out
      if (flashLightRef.current) {
        flashLightRef.current.intensity = Math.max(30 - expTime * 20, 0);
      }

      if (expTime > 1.6) {
        setStage('portal');
        finishExplosion();
      }
    }

    // Stage 3: Persistent Swirling Cosmic Portal
    if (portalVortexRef.current) {
      portalVortexRef.current.rotation.z += delta * 1.2;
      const portalScale = 1.0 + Math.sin(t * 2.5) * 0.1;
      portalVortexRef.current.scale.setScalar(portalScale);
    }

    if (eventHorizonRef.current) {
      eventHorizonRef.current.rotation.z -= delta * 0.8;
    }
  });

  if (!isExploding && !star13Unlocked) return null;

  return (
    <group ref={portalGroupRef} position={[EXPLOSION_CENTER.x, EXPLOSION_CENTER.y, EXPLOSION_CENTER.z]}>
      {/* Intense Blinding Point Light */}
      <pointLight
        ref={flashLightRef}
        color="#e9d5ff"
        distance={80}
        decay={1.5}
      />

      {/* Cosmic White Portal Trailing Tail Stream */}
      <points ref={trailParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailData.pos, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={device.isMobile ? 0.32 : 0.42}
          color="#ffffff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Subtle Sleek Portal Vortex Ring */}
      <mesh ref={portalVortexRef} position={[0, 0, 0.2]}>
        <torusGeometry args={[1.6, 0.15, 16, 64]} />
        <meshBasicMaterial
          color="#9333ea"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner Portal Event Horizon Ring */}
      <mesh ref={eventHorizonRef} position={[0, 0, 0.3]}>
        <torusGeometry args={[1.8, 0.05, 16, 64]} />
        <meshBasicMaterial
          color="#c084fc"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
