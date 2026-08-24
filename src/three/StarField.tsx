import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * StarField — Thousands of particles creating an immersive deep-space backdrop.
 * 3 depth layers with different speeds, sizes, and brightness levels.
 * Adapts particle count based on device capability.
 */

const vertexShader = `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aLayer;
  varying float vBrightness;
  varying float vLayer;
  uniform float uTime;
  uniform float uIntensity;

  void main() {
    vBrightness = aBrightness;
    vLayer = aLayer;

    vec3 pos = position;

    // Gentle drift based on layer
    float speed = (3.0 - aLayer) * 0.003 * uIntensity;
    pos.x += sin(uTime * speed + position.z * 0.1) * 0.3;
    pos.y += cos(uTime * speed * 0.7 + position.x * 0.1) * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size attenuation
    float dist = -mvPosition.z;
    gl_PointSize = aSize * (200.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vBrightness;
  varying float vLayer;
  uniform float uTime;

  void main() {
    // Circular point
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float alpha = smoothstep(0.5, 0.0, dist);
    alpha *= alpha; // Quadratic falloff for softer glow

    // Twinkle effect
    float twinkle = sin(uTime * (1.5 + vBrightness * 2.0) + vLayer * 6.28) * 0.3 + 0.7;
    alpha *= vBrightness * twinkle;

    // Color: warm white for bright stars, cool blue for dim ones
    vec3 warmWhite = vec3(1.0, 0.95, 0.85);
    vec3 coolBlue = vec3(0.7, 0.8, 1.0);
    vec3 color = mix(coolBlue, warmWhite, vBrightness);

    gl_FragColor = vec4(color, alpha * 0.9);
  }
`;

export function StarField() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const device = useSettingsStore((s) => s.device);
  const count = device.maxParticles;

  const { positions, sizes, brightness, layers } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const layers = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribute in a large sphere
      const radius = 50 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi) - 100; // Push back

      // Assign to layer (0=far, 1=mid, 2=near)
      const layer = Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0;
      layers[i] = layer;

      // Size varies by layer
      const layerSizes = [0.5, 1.2, 2.5];
      sizes[i] = layerSizes[layer] * (0.5 + Math.random() * 1.0);

      // Brightness
      brightness[i] = layer === 2
        ? 0.6 + Math.random() * 0.4
        : layer === 1
          ? 0.3 + Math.random() * 0.4
          : 0.1 + Math.random() * 0.3;
    }

    return { positions, sizes, brightness, layers };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-aBrightness"
          count={count}
          array={brightness}
          itemSize={1}
          args={[brightness, 1]}
        />
        <bufferAttribute
          attach="attributes-aLayer"
          count={count}
          array={layers}
          itemSize={1}
          args={[layers, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
