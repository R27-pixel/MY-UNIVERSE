import { useState, useEffect } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { storyConfig } from '../config/story.config';
import './NoPath.css';

/**
 * NoPath — The NO branch.
 * Displays a peaceful conclusion and options to return to the universe or open chat.
 */
export function NoPath() {
  const [stage, setStage] = useState(0);
  const setPhase = useExperienceStore((s) => s.setPhase);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(1), 1500));   // "Okay."
    timers.push(setTimeout(() => setStage(2), 4500));   // "I understand."
    timers.push(setTimeout(() => setStage(3), 7500));   // Peaceful ending & navigation
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleOpenChat = () => {
    setPhase('CHAT');
  };

  const handleReturnToUniverse = () => {
    setPhase('UNIVERSE');
  };

  return (
    <div className="no-path">
      {/* Stage 1: "Okay." */}
      <p className={`no-path__text no-path__text--center ${stage >= 1 ? 'no-path__text--visible' : ''} ${stage >= 2 ? 'no-path__text--faded' : ''}`}>
        {storyConfig.noPath.initial}
      </p>

      {/* Stage 2: Follow up */}
      <p className={`no-path__text no-path__text--center ${stage >= 2 ? 'no-path__text--visible' : ''} ${stage >= 3 ? 'no-path__text--faded' : ''}`}>
        {storyConfig.noPath.followUp}
      </p>

      {/* Stage 3: Peaceful Conclusion */}
      {stage >= 3 && (
        <div className="no-path__ending" style={{ textAlign: 'center' }}>
          <p className="no-path__text no-path__text--visible">
            Every star respects your choice and continues to glow softly in the distance.
          </p>
          <p className="no-path__text no-path__text--visible" style={{ marginTop: '12px' }}>
            You are always welcome back whenever you wish to return.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '28px' }}>
            <button className="no-path__chat-btn" onClick={handleReturnToUniverse}>
              ✦ Return to Universe
            </button>
            <button className="no-path__chat-btn" onClick={handleOpenChat}>
              💬 Open Conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
