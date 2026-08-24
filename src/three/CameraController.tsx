import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSettingsStore } from '../stores/settingsStore';
import { useExperienceStore } from '../stores/experienceStore';
import { universeConfig } from '../config/universe.config';

/**
 * CameraController — Cinematic camera with device-adaptive touch controls,
 * smooth damped momentum, pinch-to-zoom, and idle drift.
 */

const IDLE_DRIFT_SPEED = 0.05;
const ZOOM_MOMENTUM_THRESHOLD = 0.01;

export function CameraController() {
  const { camera, gl } = useThree();
  const device = useSettingsStore((s) => s.device);
  const phase = useExperienceStore((s) => s.phase);

  // Dynamic control configuration from universeConfig
  const cfg = device.isMobile ? universeConfig.controls.mobile : universeConfig.controls.desktop;

  const target = useRef(new THREE.Vector3(0, 0, 0));
  const currentPos = useRef(new THREE.Vector3(0, 0, -15));
  const mouseOffset = useRef({ x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const zoomTarget = useRef(-15);
  const zoomMomentum = useRef(0);
  const lastPinchDist = useRef<number | null>(null);
  const lastInteraction = useRef(Date.now());

  const previousPhase = useExperienceStore((s) => s.previousPhase);

  // Reset camera zoom target when entering UNIVERSE phase from LETTER or CHAT
  useEffect(() => {
    if (phase === 'UNIVERSE') {
      zoomTarget.current = -15; // Reset camera zoom target to standard distance
      zoomMomentum.current = 0;
    }
  }, [phase]);

  // Mouse move handler (Desktop - Only active in UNIVERSE phase)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (phase !== 'UNIVERSE') return;
      lastInteraction.current = Date.now();
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseOffset.current = { x, y };
    },
    [phase]
  );

  // Scroll zoom handler (Only active in 3D UNIVERSE phase)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (phase !== 'UNIVERSE') return;
      e.preventDefault();
      lastInteraction.current = Date.now();
      const delta = -e.deltaY * cfg.zoomSpeed * 0.015;
      zoomTarget.current = THREE.MathUtils.clamp(
        zoomTarget.current + delta,
        cfg.zoomMin,
        cfg.zoomMax
      );
      zoomMomentum.current = delta * 0.5;
    },
    [cfg, phase]
  );

  // Touch handlers (Mobile & Touchscreen)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    lastInteraction.current = Date.now();

    if (e.touches.length === 1) {
      isDragging.current = true;
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    if (e.touches.length === 2) {
      isDragging.current = false;
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      lastInteraction.current = Date.now();

      // Single-finger drag to pan (direct natural direction)
      if (e.touches.length === 1 && isDragging.current) {
        const dx = (e.touches[0].clientX - touchStart.current.x) * cfg.touchSensitivity;
        const dy = (e.touches[0].clientY - touchStart.current.y) * cfg.touchSensitivity;
        mouseOffset.current = {
          x: THREE.MathUtils.clamp(mouseOffset.current.x + dx, -cfg.panClampX, cfg.panClampX),
          y: THREE.MathUtils.clamp(mouseOffset.current.y - dy, -cfg.panClampY, cfg.panClampY),
        };
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }

      // Two-finger gradual pinch zoom
      if (e.touches.length === 2) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (lastPinchDist.current !== null) {
          const delta = (currentDist - lastPinchDist.current) * (cfg.zoomSpeed * 0.05);
          zoomTarget.current = THREE.MathUtils.clamp(
            zoomTarget.current + delta,
            cfg.zoomMin,
            cfg.zoomMax
          );
          zoomMomentum.current = delta * 0.4;
        }

        lastPinchDist.current = currentDist;
      }
    },
    [cfg]
  );

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    isDragging.current = false;

    if (e.touches.length < 2) {
      lastPinchDist.current = null;
    }

    if (e.touches.length === 1) {
      isDragging.current = true;
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  // Attach event listeners
  useEffect(() => {
    const domElement = gl.domElement;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });

    domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl, handleMouseMove, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  useFrame((state) => {
    if (phase !== 'UNIVERSE') return;

    const t = state.clock.elapsedTime;
    const timeSinceInteraction = (Date.now() - lastInteraction.current) / 1000;

    // Apply smooth zoom momentum with decay
    if (Math.abs(zoomMomentum.current) > ZOOM_MOMENTUM_THRESHOLD) {
      zoomTarget.current = THREE.MathUtils.clamp(
        zoomTarget.current + zoomMomentum.current,
        cfg.zoomMin,
        cfg.zoomMax
      );
      zoomMomentum.current *= cfg.momentumDecay;
    } else {
      zoomMomentum.current = 0;
    }

    // Gentle idle drift after 3s of inactivity
    let driftX = 0;
    let driftY = 0;
    if (timeSinceInteraction > 3) {
      const driftFactor = Math.min((timeSinceInteraction - 3) * 0.1, 1);
      driftX = Math.sin(t * IDLE_DRIFT_SPEED) * 2 * driftFactor;
      driftY = Math.cos(t * IDLE_DRIFT_SPEED * 0.7) * 1 * driftFactor;
    }

    const targetX = mouseOffset.current.x * 25 + driftX;
    const targetY = -mouseOffset.current.y * 18 + driftY;
    const targetZ = zoomTarget.current;

    // Device-calibrated smooth lerp damping
    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetX, cfg.damping);
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetY, cfg.damping);
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetZ, cfg.zoomDamping);

    camera.position.set(currentPos.current.x, currentPos.current.y, currentPos.current.z);

    target.current.set(
      currentPos.current.x * 0.3,
      currentPos.current.y * 0.3,
      currentPos.current.z - 30
    );
    camera.lookAt(target.current);
  });

  return null;
}
