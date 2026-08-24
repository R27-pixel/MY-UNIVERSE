import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

/**
 * getCircleParticleTexture — Returns a cached 64x64 radial glow CanvasTexture
 * so WebGL point particles render as soft round stardust instead of square quads.
 */
export function getCircleParticleTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  if (typeof document === 'undefined') {
    return new THREE.Texture() as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.25)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }

  cachedTexture = new THREE.CanvasTexture(canvas);
  return cachedTexture;
}
