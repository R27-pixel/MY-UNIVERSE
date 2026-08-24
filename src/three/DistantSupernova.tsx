import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * DistantSupernova — Photorealistic Supernova Remnant (Cassiopeia A / DEM L241 style)
 * matching the user's reference image:
 * - Fiery orange/gold outer shockwave rim filaments
 * - Deep cosmic blue/cyan interior cavity cloud
 * - Translucent gaseous bubble structure positioned deep in background space (z = -150)
 */
export function DistantSupernova() {
  const pointsRef = useRef<THREE.Points>(null);
  const outerPointsRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const innerCount = 350;
  const outerRimCount = 450;

  // 1. Interior Cavity Particles (Cosmic Blue, Cyan, Emerald)
  const { innerPositions, innerColors } = useMemo(() => {
    const innerPositions = new Float32Array(innerCount * 3);
    const innerColors = new Float32Array(innerCount * 3);

    const blueCol = new THREE.Color('#2563eb');
    const cyanCol = new THREE.Color('#06b6d4');
    const emeraldCol = new THREE.Color('#10b981');
    const violetCol = new THREE.Color('#8b5cf6');

    for (let i = 0; i < innerCount; i++) {
      // Elliptical bubble interior distribution
      const u = Math.random();
      const radiusX = (0.2 + u * 0.8) * 32.0;
      const radiusY = (0.2 + u * 0.8) * 22.0;
      const radiusZ = (0.2 + u * 0.8) * 18.0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Noise turbulence offset
      const noise = (Math.sin(theta * 3.0) + Math.cos(phi * 4.0)) * 2.5;

      innerPositions[i * 3] = (radiusX + noise) * Math.sin(phi) * Math.cos(theta);
      innerPositions[i * 3 + 1] = (radiusY + noise) * Math.sin(phi) * Math.sin(theta);
      innerPositions[i * 3 + 2] = (radiusZ + noise) * Math.cos(phi);

      // Color gradient from center outwards (Blue core -> Cyan/Emerald mid)
      const distRatio = radiusX / 32.0;
      let col = blueCol;
      if (distRatio < 0.4) {
        col = new THREE.Color().copy(blueCol).lerp(violetCol, distRatio * 2.0);
      } else if (distRatio < 0.7) {
        col = new THREE.Color().copy(violetCol).lerp(cyanCol, (distRatio - 0.4) * 3.3);
      } else {
        col = new THREE.Color().copy(cyanCol).lerp(emeraldCol, (distRatio - 0.7) * 3.3);
      }

      innerColors[i * 3] = col.r;
      innerColors[i * 3 + 1] = col.g;
      innerColors[i * 3 + 2] = col.b;
    }

    return { innerPositions, innerColors };
  }, []);

  // 2. Fiery Outer Shockwave Rim Particles (Gold, Amber, Orange, Crimson)
  const { outerPositions, outerColors } = useMemo(() => {
    const outerPositions = new Float32Array(outerRimCount * 3);
    const outerColors = new Float32Array(outerRimCount * 3);

    const goldCol = new THREE.Color('#fbbf24');
    const orangeCol = new THREE.Color('#f97316');
    const crimsonCol = new THREE.Color('#ef4444');
    const amberCol = new THREE.Color('#d97706');

    for (let i = 0; i < outerRimCount; i++) {
      // Dense outer rim boundary with irregular filaments
      const radiusX = 30.0 + (Math.random() - 0.5) * 8.0;
      const radiusY = 21.0 + (Math.random() - 0.5) * 6.0;
      const radiusZ = 16.0 + (Math.random() - 0.5) * 5.0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Organic shockwave filament distortion (matching the reference image rim)
      const filament = Math.sin(theta * 5.0) * Math.cos(phi * 3.0) * 4.5;

      outerPositions[i * 3] = (radiusX + filament) * Math.sin(phi) * Math.cos(theta);
      outerPositions[i * 3 + 1] = (radiusY + filament) * Math.sin(phi) * Math.sin(theta);
      outerPositions[i * 3 + 2] = (radiusZ + filament) * Math.cos(phi);

      const colorMix = Math.random();
      const col = colorMix < 0.4 ? goldCol : colorMix < 0.75 ? orangeCol : Math.random() > 0.5 ? crimsonCol : amberCol;

      outerColors[i * 3] = col.r;
      outerColors[i * 3 + 1] = col.g;
      outerColors[i * 3 + 2] = col.b;
    }

    return { outerPositions, outerColors };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (pointsRef.current) {
      pointsRef.current.rotation.z = t * 0.015;
      pointsRef.current.rotation.y = t * 0.01;
    }

    if (outerPointsRef.current) {
      outerPointsRef.current.rotation.z = t * 0.012;
      outerPointsRef.current.rotation.y = t * 0.008;
    }

    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 2.0) * 0.6;
    }
  });

  return (
    <group position={[-40, 22, -150]} rotation={[0.2, 0.4, -0.3]}>
      {/* Central Fiery Core Light */}
      <pointLight
        ref={lightRef}
        color="#fbbf24"
        distance={180}
        decay={1.8}
      />

      {/* Deep Blue/Cyan Interior Cavity Cloud */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[innerPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[innerColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.75}
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Fiery Gold/Orange Outer Shockwave Rim Filaments */}
      <points ref={outerPointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[outerPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[outerColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.9}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
