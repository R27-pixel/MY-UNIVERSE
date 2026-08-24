import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CelestialType } from '../types';

/**
 * PlanetShader — Procedural GLSL materials for realistic celestial objects.
 * Each type gets a unique shader: rocky terrain, gas bands, nebula clouds,
 * star coronas, ice crystals, etc.
 */

// ── Shared noise functions (simplex 3D) ──

const NOISE_GLSL = `
  // Simplex 3D noise
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      val += amp * snoise(p * freq);
      amp *= 0.5;
      freq *= 2.0;
    }
    return val;
  }
`;

// ── Shared vertex shader ──

const PLANET_VERTEX = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uBumpScale;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    // Smooth elevation for surface shader coloring without deforming 3D geometry
    vElevation = fbm(position * 2.5 + uTime * 0.02) * uBumpScale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Rocky Planet Fragment ──

const ROCKY_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 0.8, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.15;

    // Terrain coloring based on elevation
    float n = fbm(vPosition * 3.0 + uTime * 0.01);
    float height = vElevation * 5.0 + n * 0.5;

    // Deep water → shallow → sand → grass → rock → snow
    vec3 deepWater = vec3(0.02, 0.05, 0.15);
    vec3 shallowWater = vec3(0.05, 0.15, 0.35);
    vec3 sand = vec3(0.6, 0.5, 0.3);
    vec3 terrain = uColor;
    vec3 rock = uColor2;
    vec3 snow = vec3(0.9, 0.92, 0.95);

    vec3 color;
    if (height < -0.1) {
      color = mix(deepWater, shallowWater, smoothstep(-0.3, -0.1, height));
    } else if (height < 0.0) {
      color = mix(shallowWater, sand, smoothstep(-0.1, 0.0, height));
    } else if (height < 0.15) {
      color = mix(sand, terrain, smoothstep(0.0, 0.15, height));
    } else if (height < 0.35) {
      color = mix(terrain, rock, smoothstep(0.15, 0.35, height));
    } else {
      color = mix(rock, snow, smoothstep(0.35, 0.5, height));
    }

    // Crater detail
    float craters = abs(snoise(vPosition * 8.0)) * 0.15;
    color -= craters;

    // Fresnel rim
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    vec3 rimColor = vec3(0.3, 0.5, 0.9);
    color += rimColor * fresnel * 0.4;

    // Final lighting
    color *= (ambient + diff * 0.85);
    color += vec3(0.02, 0.04, 0.08) * fresnel; // Atmosphere scatter

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Gas Giant Fragment ──

const GAS_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 0.5, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.2;

    // Banded atmosphere
    float bands = sin(vUv.y * 30.0 + snoise(vec3(vUv * 5.0, uTime * 0.05)) * 3.0) * 0.5 + 0.5;

    // Turbulent flow
    float turbulence = fbm(vec3(vUv.x * 8.0 + uTime * 0.03, vUv.y * 15.0, uTime * 0.02));

    // Storm spots
    float storm = smoothstep(0.6, 0.9, snoise(vPosition * 2.0 + uTime * 0.01));

    vec3 band1 = uColor;
    vec3 band2 = uColor2;
    vec3 stormColor = vec3(0.9, 0.6, 0.3);

    vec3 color = mix(band1, band2, bands + turbulence * 0.3);
    color = mix(color, stormColor, storm * 0.6);

    // Fresnel atmosphere
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);
    color += uColor * fresnel * 0.5;

    color *= (ambient + diff * 0.8);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Star / Corona Fragment ──

const STAR_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // High-resolution solar surface granulation
    float gran1 = fbm(vPosition * 8.0 + uTime * 0.12);
    float gran2 = snoise(vPosition * 16.0 - uTime * 0.18);
    float gran = gran1 * 0.6 + gran2 * 0.4;

    // Solar hotspots & convection cells
    float hotspot = smoothstep(0.5, 0.85, snoise(vPosition * 4.0 + uTime * 0.15));

    // Solar prominence flares
    float flare = smoothstep(0.65, 0.95, snoise(vec3(vUv * 6.0, uTime * 0.25)));

    vec3 coreColor = uColor;
    vec3 hotColor = vec3(1.0, 0.98, 0.9); // Incandescent white
    vec3 flareColor = mix(uColor, vec3(1.0, 0.5, 0.2), 0.5);

    vec3 color = mix(coreColor * 0.8, coreColor * 1.3, gran * 0.5 + 0.5);
    color = mix(color, hotColor, hotspot * 0.8);
    color = mix(color, flareColor, flare * 0.5);

    // Emissive intensity boost
    color *= 2.2;

    // Fresnel solar corona & limb brightening
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 1.8);
    color += mix(uColor, vec3(1.0, 1.0, 1.0), 0.5) * fresnel * 2.0;

    // Subtle thermal pulsation
    float pulse = sin(uTime * 2.0) * 0.06 + 1.0;
    color *= pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Nebula Fragment ──

const NEBULA_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Wispy cloud patterns
    float cloud1 = fbm(vPosition * 2.0 + uTime * 0.03);
    float cloud2 = fbm(vPosition * 4.0 - uTime * 0.02);
    float clouds = cloud1 * 0.6 + cloud2 * 0.4;

    // Internal glow
    float glow = smoothstep(-0.2, 0.5, clouds);

    vec3 innerColor = uColor * 1.5;
    vec3 outerColor = uColor * 0.3;
    vec3 glowColor = vec3(0.8, 0.6, 1.0);

    vec3 color = mix(outerColor, innerColor, glow);
    color += glowColor * smoothstep(0.3, 0.7, clouds) * 0.3;

    // Fresnel
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);
    color += uColor * fresnel * 0.6;

    // Semi-transparent edges
    float alpha = smoothstep(-0.4, 0.2, clouds) * 0.85 + 0.15;
    alpha = mix(alpha, 1.0, 1.0 - fresnel);

    color *= 1.2; // Boost emissive

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Crystal / Ice Fragment ──

const CRYSTAL_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 0.8, 0.5));
    float diff = max(dot(vNormal, lightDir), 0.0);

    // Crystal facets
    float facets = abs(snoise(vPosition * 10.0)) * 0.5 + 0.5;

    // Internal refraction pattern
    float refract = fbm(vPosition * 5.0 + uTime * 0.05);

    vec3 iceColor = uColor;
    vec3 sparkle = vec3(0.9, 0.95, 1.0);
    vec3 deep = uColor * 0.4;

    vec3 color = mix(deep, iceColor, facets);
    color = mix(color, sparkle, smoothstep(0.6, 0.9, refract) * 0.4);

    // Subsurface scattering approximation
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float sss = pow(max(dot(viewDir, -lightDir + vNormal * 0.5), 0.0), 3.0);
    color += iceColor * sss * 0.5;

    // Strong fresnel for glassy look
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 4.0);
    color += vec3(0.6, 0.8, 1.0) * fresnel * 0.7;

    color *= (0.2 + diff * 0.8);

    gl_FragColor = vec4(color, 0.9);
  }
`;

// ── Mystery / Portal Fragment ──

const MYSTERY_FRAGMENT = `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    // Swirling void
    float swirl = fbm(vec3(
      vUv.x * 5.0 + sin(uTime * 0.2) * 2.0,
      vUv.y * 5.0 + cos(uTime * 0.15) * 2.0,
      uTime * 0.1
    ));

    // Dark energy pulsation
    float pulse = sin(uTime * 0.8 + swirl * 3.0) * 0.5 + 0.5;

    vec3 voidColor = vec3(0.02, 0.01, 0.05);
    vec3 energyColor = uColor;
    vec3 hotColor = vec3(1.0, 0.8, 0.4);

    vec3 color = mix(voidColor, energyColor, swirl * 0.5 + 0.3);
    color += hotColor * pulse * 0.15;

    // Fresnel
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);
    color += energyColor * fresnel * 0.8;

    // Emissive
    color *= 1.3;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Shader selection map ──

type ShaderConfig = {
  fragmentShader: string;
  bumpScale: number;
  transparent?: boolean;
  color2?: [number, number, number];
};

const SHADER_MAP: Record<string, ShaderConfig> = {
  planet: { fragmentShader: ROCKY_FRAGMENT, bumpScale: 0.04, color2: [0.4, 0.35, 0.3] },
  star: { fragmentShader: STAR_FRAGMENT, bumpScale: 0.02 },
  nebula: { fragmentShader: NEBULA_FRAGMENT, bumpScale: 0.06, transparent: true },
  portal: { fragmentShader: MYSTERY_FRAGMENT, bumpScale: 0.03 },
  fragment: { fragmentShader: CRYSTAL_FRAGMENT, bumpScale: 0.03, transparent: true },
  capsule: { fragmentShader: GAS_FRAGMENT, bumpScale: 0.01, color2: [0.2, 0.15, 0.3] },
  constellation: { fragmentShader: CRYSTAL_FRAGMENT, bumpScale: 0.02, transparent: true },
  mystery: { fragmentShader: MYSTERY_FRAGMENT, bumpScale: 0.04 },
};

interface Props {
  celestialType: CelestialType;
  color: string;
}

/**
 * usePlanetMaterial — Returns a ShaderMaterial ref configured
 * for the given celestial type with procedural textures.
 */
export function usePlanetMaterial(celestialType: CelestialType, color: string) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const config = SHADER_MAP[celestialType] || SHADER_MAP.planet;
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  const color2 = useMemo(() => {
    if (config.color2) return new THREE.Color(...config.color2);
    return new THREE.Color(color).multiplyScalar(0.5);
  }, [color, config.color2]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: threeColor },
      uColor2: { value: color2 },
      uBumpScale: { value: config.bumpScale },
    }),
    [threeColor, color2, config.bumpScale]
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return { materialRef, uniforms, config };
}

/**
 * PlanetMaterial — JSX component for procedural shader material.
 */
export function PlanetMaterial({ celestialType, color }: Props) {
  const { materialRef, uniforms, config } = usePlanetMaterial(celestialType, color);

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={PLANET_VERTEX}
      fragmentShader={config.fragmentShader}
      uniforms={uniforms}
      transparent={config.transparent || false}
      side={THREE.FrontSide}
      depthWrite={!config.transparent}
    />
  );
}

/**
 * AtmosphereShell — Transparent glowing shell around a planet.
 */
export function AtmosphereShell({ color, size = 1.15 }: { color: string; size?: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: threeColor },
      uTime: { value: 0 },
    }),
    [threeColor]
  );

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      vec3 color = uColor * fresnel * 1.5;
      float alpha = fresnel * 0.35;

      // Subtle shimmer
      alpha *= (0.9 + sin(uTime * 2.0 + vPosition.y * 5.0) * 0.1);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh scale={size}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
