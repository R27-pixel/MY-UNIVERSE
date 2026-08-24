import { useState, useEffect } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { storyConfig } from '../config/story.config';
import './YesPath.css';

/**
 * YesPath — Transition from universe to chat.
 * "Connection established." → "Maybe we should start with a conversation."
 */
export function YesPath() {
  const [stage, setStage] = useState(0);
  const setPhase = useExperienceStore((s) => s.setPhase);

  const { connectionText, followUp } = storyConfig.yesPath;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(1), 1000));  // Connection text
    timers.push(setTimeout(() => setStage(2), 4000));  // Follow up
    timers.push(setTimeout(() => setStage(3), 7000));  // Transition to chat
    timers.push(setTimeout(() => setPhase('CHAT'), 8500));
    return () => timers.forEach(clearTimeout);
  }, [setPhase]);

  return (
    <div className={`yes-path ${stage >= 3 ? 'yes-path--fade-out' : ''}`}>
      {/* Terminal-style connection */}
      <div className="yes-path__terminal">
        <div className={`yes-path__line ${stage >= 1 ? 'yes-path__line--visible' : ''}`}>
          <span className="yes-path__cursor">▊</span>
          <span className="yes-path__connection">{connectionText}</span>
        </div>

        <div className={`yes-path__line ${stage >= 2 ? 'yes-path__line--visible' : ''}`}>
          <span className="yes-path__follow-up">{followUp}</span>
        </div>
      </div>

      {/* Animated connection dots */}
      <div className="yes-path__dots">
        <span className="yes-path__dot" style={{ animationDelay: '0s' }} />
        <span className="yes-path__dot" style={{ animationDelay: '0.3s' }} />
        <span className="yes-path__dot" style={{ animationDelay: '0.6s' }} />
      </div>
    </div>
  );
}
