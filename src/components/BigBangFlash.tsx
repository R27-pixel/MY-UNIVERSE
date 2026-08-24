import { useState, useEffect, useMemo } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import './BigBangFlash.css';

/**
 * BigBangFlash — Cinematic "BIG BANG" explosion transition.
 * Stages: text reveal → singularity pulse → explosion → particles → fade to universe.
 */

const PARTICLE_COUNT = 40;
const STREAK_COUNT = 24;

export function BigBangFlash() {
  const [stage, setStage] = useState(0);
  // 0 = black, 1 = text appears, 2 = text explodes + singularity,
  // 3 = flash + rings + particles, 4 = fade out to universe
  const setPhase = useExperienceStore((s) => s.setPhase);
  const completeOpening = useExperienceStore((s) => s.completeOpening);

  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 100 + Math.random() * 600;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const duration = 1.2 + Math.random() * 1.0;
      const size = 1 + Math.random() * 4;
      const hue = Math.random() > 0.6 ? 45 : Math.random() > 0.3 ? 200 : 280;
      return { tx, ty, duration, size, hue, delay: Math.random() * 0.15 };
    });
  }, []);

  // Generate speed line streaks
  const streaks = useMemo(() => {
    return Array.from({ length: STREAK_COUNT }, (_, i) => {
      const angle = (i / STREAK_COUNT) * 360;
      const length = 150 + Math.random() * 500;
      const width = 1 + Math.random() * 2;
      return { angle, length, width };
    });
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Stage 0 → 1: Show "BIG BANG" text (after 300ms)
    timers.push(setTimeout(() => setStage(1), 300));

    // Stage 1 → 2: Text explodes + singularity glows (after 1.6s)
    timers.push(setTimeout(() => setStage(2), 1800));

    // Stage 2 → 3: Flash + rings + particles (after 2.4s)
    timers.push(setTimeout(() => setStage(3), 2400));

    // Stage 3 → 4: Start fade out to universe (after 3.5s)
    timers.push(setTimeout(() => setStage(4), 3800));

    // Transition to UNIVERSE (after 5s)
    timers.push(
      setTimeout(() => {
        completeOpening();
        setPhase('UNIVERSE');
      }, 5200)
    );

    return () => timers.forEach(clearTimeout);
  }, [setPhase, completeOpening]);

  return (
    <div className={`bigbang ${stage >= 4 ? 'bigbang--fade-out' : ''}`}>
      {/* "BIG BANG" text */}
      <div
        className={`bigbang__text ${
          stage >= 1 && stage < 2 ? 'bigbang__text--visible' : ''
        } ${stage >= 2 ? 'bigbang__text--explode' : ''}`}
      >
        BIG BANG
      </div>

      {/* Singularity point */}
      <div
        className={`bigbang__singularity ${
          stage >= 1 && stage < 3 ? 'bigbang__singularity--active' : ''
        } ${stage >= 3 ? 'bigbang__singularity--explode' : ''}`}
      />

      {/* White flash */}
      {stage >= 3 && (
        <div className="bigbang__flash bigbang__flash--active" />
      )}

      {/* Energy rings */}
      {stage >= 3 && (
        <div className="bigbang__rings">
          <div className="bigbang__ring bigbang__ring--1" />
          <div className="bigbang__ring bigbang__ring--2" />
          <div className="bigbang__ring bigbang__ring--3" />
          <div className="bigbang__ring bigbang__ring--4" />
        </div>
      )}

      {/* Particles */}
      {stage >= 3 && (
        <div className="bigbang__particles">
          {particles.map((p, i) => (
            <div
              key={i}
              className="bigbang__particle bigbang__particle--active"
              style={{
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                '--fly-duration': `${p.duration}s`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: `hsl(${p.hue}, 80%, 75%)`,
                animationDelay: `${p.delay}s`,
                boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue}, 80%, 60%)`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Speed line streaks */}
      {stage >= 3 && (
        <div className="bigbang__streaks bigbang__streaks--active">
          {streaks.map((s, i) => (
            <div
              key={i}
              className="bigbang__streak"
              style={{
                transform: `rotate(${s.angle}deg)`,
                width: `${s.length}px`,
                height: `${s.width}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Afterglow nebula */}
      {stage >= 3 && (
        <div className="bigbang__afterglow bigbang__afterglow--active" />
      )}
    </div>
  );
}
