import { useState, useEffect } from 'react';
import './LoadingScreen.css';

interface Props {
  onComplete: () => void;
}

/**
 * LoadingScreen — Cinematic loading with progress bar.
 * Minimum display time for dramatic pacing.
 */
export function LoadingScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const minDuration = 2500;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / minDuration, 1);
      // Ease-out curve
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * 100);

      if (p >= 1) {
        clearInterval(interval);
        setFadeOut(true);
        setTimeout(onComplete, 800);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={`loading ${fadeOut ? 'loading--fade-out' : ''}`}>
      <div className="loading__content">
        <div className="loading__title">OUR UNIVERSE</div>
        <div className="loading__bar">
          <div className="loading__fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading__meta">
          <span>{Math.round(progress)}%</span>
          <span>initializing</span>
        </div>
      </div>
    </div>
  );
}
