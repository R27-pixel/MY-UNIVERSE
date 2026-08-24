import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useExperienceStore } from '../../stores/experienceStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { soundFx } from '../../utils/soundEffects';
import { VirtualJoystick } from './VirtualJoystick';
import './HiddenCosmicGame.css';

interface Fragment {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulseOffset: number;
}

interface Hazard {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

export function HiddenCosmicGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const completeHiddenGame = useExperienceStore((s) => s.completeHiddenGame);
  const device = useSettingsStore((s) => s.device);

  const [timeLeft, setTimeLeft] = useState(60);
  const [fragmentsCount, setFragmentsCount] = useState(0);
  const [gameState, setGameState] = useState<'PLAYING' | 'WON' | 'LOST'>('PLAYING');
  const [joystickDir, setJoystickDir] = useState({ x: 0, y: 0 });

  // Game Engine Mutable Refs
  const playerRef = useRef({
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    radius: 14,
    speed: device.isMobile ? 6.5 : 7.5,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const fragmentsRef = useRef<Fragment[]>([
    { id: 1, x: 200, y: 150, radius: 16, collected: false, pulseOffset: 0 },
    { id: 2, x: 700, y: 180, radius: 16, collected: false, pulseOffset: 1.2 },
    { id: 3, x: 150, y: 500, radius: 16, collected: false, pulseOffset: 2.4 },
    { id: 4, x: 750, y: 520, radius: 16, collected: false, pulseOffset: 3.6 },
    { id: 5, x: 450, y: 350, radius: 16, collected: false, pulseOffset: 4.8 },
  ]);

  const hazardsRef = useRef<Hazard[]>([
    { x: 300, y: 200, radius: 26, vx: 2.2, vy: 1.8 },
    { x: 600, y: 400, radius: 32, vx: -1.8, vy: 2.5 },
    { x: 450, y: 120, radius: 22, vx: 3.0, vy: -1.5 },
  ]);

  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);

  // Timer Tick
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState('LOST');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  // Keyboard Listeners for Desktop with default prevent to stop browser page scroll/vanish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle Joystick Input
  const handleJoystickMove = useCallback((dir: { x: number; y: number }) => {
    setJoystickDir(dir);
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initial positioning based on canvas dimensions
    if (playerRef.current.x === 400 && playerRef.current.y === 300) {
      playerRef.current.x = canvas.width / 2;
      playerRef.current.y = canvas.height / 2;

      fragmentsRef.current = [
        { id: 1, x: canvas.width * 0.2, y: canvas.height * 0.25, radius: 16, collected: false, pulseOffset: 0 },
        { id: 2, x: canvas.width * 0.8, y: canvas.height * 0.2, radius: 16, collected: false, pulseOffset: 1.2 },
        { id: 3, x: canvas.width * 0.25, y: canvas.height * 0.8, radius: 16, collected: false, pulseOffset: 2.4 },
        { id: 4, x: canvas.width * 0.75, y: canvas.height * 0.75, radius: 16, collected: false, pulseOffset: 3.6 },
        { id: 5, x: canvas.width * 0.5, y: canvas.height * 0.5, radius: 16, collected: false, pulseOffset: 4.8 },
      ];

      hazardsRef.current = [
        { x: canvas.width * 0.35, y: canvas.height * 0.3, radius: 26, vx: 2.2, vy: 1.8 },
        { x: canvas.width * 0.65, y: canvas.height * 0.6, radius: 32, vx: -1.8, vy: 2.5 },
        { x: canvas.width * 0.5, y: canvas.height * 0.2, radius: 22, vx: 3.0, vy: -1.5 },
      ];
    }

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep Cosmic Space Background
      const bgGrad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        100,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.8
      );
      bgGrad.addColorStop(0, '#0a0218');
      bgGrad.addColorStop(1, '#020005');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (gameState === 'PLAYING') {
        // Player Input Processing
        let moveX = joystickDir.x;
        let moveY = joystickDir.y;

        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) moveY -= 1;
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) moveY += 1;
        if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) moveX -= 1;
        if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) moveX += 1;

        const mag = Math.hypot(moveX, moveY);
        if (mag > 0) {
          const normX = moveX / Math.max(mag, 1);
          const normY = moveY / Math.max(mag, 1);

          playerRef.current.vx = THREE.MathUtils.lerp(playerRef.current.vx, normX * playerRef.current.speed, 0.25);
          playerRef.current.vy = THREE.MathUtils.lerp(playerRef.current.vy, normY * playerRef.current.speed, 0.25);
        } else {
          playerRef.current.vx *= 0.88;
          playerRef.current.vy *= 0.88;
        }

        playerRef.current.x += playerRef.current.vx;
        playerRef.current.y += playerRef.current.vy;

        // Canvas Boundary Clamping
        playerRef.current.x = Math.max(playerRef.current.radius, Math.min(canvas.width - playerRef.current.radius, playerRef.current.x));
        playerRef.current.y = Math.max(playerRef.current.radius, Math.min(canvas.height - playerRef.current.radius, playerRef.current.y));

        // Add Player Motion Trail Particles
        if (Math.hypot(playerRef.current.vx, playerRef.current.vy) > 0.5) {
          particlesRef.current.push({
            x: playerRef.current.x,
            y: playerRef.current.y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 1.0,
            color: '#c084fc',
          });
        }
      }

      // Draw Trail Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw & Update Moving Cosmic Hazards
      hazardsRef.current.forEach((h) => {
        if (gameState === 'PLAYING') {
          h.x += h.vx;
          h.y += h.vy;
          if (h.x - h.radius < 0 || h.x + h.radius > canvas.width) h.vx *= -1;
          if (h.y - h.radius < 0 || h.y + h.radius > canvas.height) h.vy *= -1;

          // Check Collision with Player
          const dist = Math.hypot(playerRef.current.x - h.x, playerRef.current.y - h.y);
          if (dist < playerRef.current.radius + h.radius) {
            // Push player back gently
            playerRef.current.vx *= -1.5;
            playerRef.current.vy *= -1.5;
          }
        }

        // Draw Hazard Sphere
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Draw & Collect Cosmic Fragments
      const now = Date.now() / 1000;
      let collectedCount = 0;

      fragmentsRef.current.forEach((f) => {
        if (f.collected) {
          collectedCount++;
          return;
        }

        // Check Collision with Player
        if (gameState === 'PLAYING') {
          const dist = Math.hypot(playerRef.current.x - f.x, playerRef.current.y - f.y);
          if (dist < playerRef.current.radius + f.radius) {
            f.collected = true;
            soundFx.playPickupSound();
            setFragmentsCount((prev) => {
              const next = prev + 1;
              if (next >= 5) {
                setGameState('WON');
                soundFx.playVictorySound();
                completeHiddenGame();
              }
              return next;
            });
          }
        }

        // Pulsing Star Fragment Draw
        const pulse = 1.0 + Math.sin(now * 4 + f.pulseOffset) * 0.2;

        // Expanding Outer Beacon Ring to make fragments easy to spot
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * (1.8 + Math.sin(now * 3 + f.pulseOffset) * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(pulse, pulse);

        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f472b6';
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 20;
        ctx.fill();

        // Inner Star Glow
        ctx.beginPath();
        ctx.arc(0, 0, f.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;

        // Directional pointer line from player to fragment
        if (gameState === 'PLAYING') {
          const dx = f.x - playerRef.current.x;
          const dy = f.y - playerRef.current.y;
          const angle = Math.atan2(dy, dx);
          const pointerDist = 32;

          const px = playerRef.current.x + Math.cos(angle) * pointerDist;
          const py = playerRef.current.y + Math.sin(angle) * pointerDist;

          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#f0abfc';
          ctx.fill();
        }
      });

      // Draw Player Probe Orb
      ctx.beginPath();
      ctx.arc(playerRef.current.x, playerRef.current.y, playerRef.current.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 25;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(playerRef.current.x, playerRef.current.y, playerRef.current.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [joystickDir, gameState, completeHiddenGame]);

  return (
    <div className="game-container">
      {/* 2D/3D Cosmic Canvas */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Top HUD (Timer & Fragment Score) */}
      <div className="game-hud">
        <div className="game-hud__item">
          <span className="game-hud__label">TIME REMAINING</span>
          <span className={`game-hud__val ${timeLeft <= 10 ? 'game-hud__val--urgent' : ''}`}>
            {timeLeft}s
          </span>
        </div>

        <div className="game-hud__item">
          <span className="game-hud__label">COSMIC FRAGMENTS</span>
          <span className="game-hud__val">{fragmentsCount} / 5</span>
        </div>
      </div>

      {/* Mobile Virtual Joystick */}
      {device.isTouch && gameState === 'PLAYING' && (
        <VirtualJoystick onMove={handleJoystickMove} />
      )}

      {/* Controls & Objective Hint Overlay */}
      {gameState === 'PLAYING' && (
        <div className="game-controls-hint">
          <span>✦ MISSION: COLLECT ALL 5 PINK GLOWING FRAGMENTS ✦ {device.isTouch ? 'USE JOYSTICK TO MOVE' : 'USE WASD OR ARROW KEYS'}</span>
        </div>
      )}

      {/* LEVEL COMPLETE WIN OVERLAY */}
      {gameState === 'WON' && (
        <div className="game-modal-overlay">
          <div className="game-modal-card">
            <div className="game-modal__badge">✦ LEVEL COMPLETE ✦</div>
            <h1 className="game-modal__title">You survived.</h1>
            <p className="game-modal__subtitle">You probably weren't supposed to.</p>

            <div className="game-modal__actions">
              <button
                className="game-btn game-btn--primary"
                onClick={() => setPhase('CHAT')}
              >
                <span>Want to talk? [ OPEN CHAT ] 💬</span>
              </button>

              <button
                className="game-btn game-btn--secondary"
                onClick={() => setPhase('UNIVERSE')}
              >
                <span>Return to Universe 🌌</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL LOST OVERLAY */}
      {gameState === 'LOST' && (
        <div className="game-modal-overlay">
          <div className="game-modal-card">
            <div className="game-modal__badge game-modal__badge--lost">TIME EXPIRED</div>
            <h1 className="game-modal__title">Cosmic Distortion Took Over</h1>
            <p className="game-modal__subtitle">The universe collapsed before you reached all 5 fragments.</p>

            <div className="game-modal__actions">
              <button
                className="game-btn game-btn--primary"
                onClick={() => {
                  setTimeLeft(60);
                  setFragmentsCount(0);
                  setGameState('PLAYING');
                }}
              >
                <span>TRY AGAIN 🔄</span>
              </button>

              <button
                className="game-btn game-btn--secondary"
                onClick={() => setPhase('UNIVERSE')}
              >
                <span>Return to Universe 🌌</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
