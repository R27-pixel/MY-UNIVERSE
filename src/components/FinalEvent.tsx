import { useState, useEffect, useMemo } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { storyConfig } from '../config/story.config';
import { StoryEditorModal } from './authoring/StoryEditorModal';
import './FinalEvent.css';

/**
 * FinalEvent — The constellation completes → the final universe-scoped question is asked.
 * Two paths: YES (chat) or NO (forgiveness). Supports Creator customization.
 */
export function FinalEvent() {
  const [stage, setStage] = useState(0);
  const [showEditor, setShowEditor] = useState(false);

  const setPhase = useExperienceStore((s) => s.setPhase);
  const choosePath = useExperienceStore((s) => s.choosePath);
  const activeUniverseStories = useExperienceStore((s) => s.activeUniverseStories);
  const activeMembership = useExperienceStore((s) => s.activeMembership);

  const canEdit = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';

  // Read universe-scoped story customization from DB or fallback to static defaults
  const activeStory = activeUniverseStories[0] || null;

  const finalConfig = useMemo(() => {
    let cfg = { ...storyConfig.finalQuestion };
    if (activeStory?.description) {
      try {
        const parsed = JSON.parse(activeStory.description);
        if (parsed.question) {
          cfg = { ...cfg, ...parsed };
        }
      } catch {
        if (activeStory.description) {
          cfg.question = activeStory.description;
        }
      }
    }
    return cfg;
  }, [activeStory]);

  const { prelude, question, yesLabel, noLabel } = finalConfig;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(1), 1500));  // Show prelude
    timers.push(setTimeout(() => setStage(2), 5000));  // Show question
    timers.push(setTimeout(() => setStage(3), 8000));  // Show choices
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleYes = () => {
    choosePath('yes');
    setStage(4);
    setTimeout(() => setPhase('YES_PATH'), 1500);
  };

  const handleNo = () => {
    choosePath('no');
    setStage(4);
    setTimeout(() => setPhase('NO_PATH'), 1500);
  };

  return (
    <div className={`final ${stage >= 4 ? 'final--fade-out' : ''}`}>
      {/* Creator Edit Trigger */}
      {canEdit && (
        <button
          type="button"
          className="final__edit-btn"
          onClick={() => setShowEditor(true)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 10,
            background: 'rgba(168, 85, 247, 0.25)',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            color: '#d8b4fe',
            borderRadius: '20px',
            padding: '6px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          ✏️ Edit Final Question
        </button>
      )}

      {/* Prelude */}
      <p className={`final__prelude ${stage >= 1 ? 'final__prelude--visible' : ''}`}>
        {prelude}
      </p>

      {/* The Question */}
      <h1 className={`final__question ${stage >= 2 ? 'final__question--visible' : ''}`}>
        {question}
      </h1>

      {/* Choices */}
      <div className={`final__choices ${stage >= 3 ? 'final__choices--visible' : ''}`}>
        <button className="final__choice final__choice--yes" onClick={handleYes}>
          <span className="final__choice-glow" />
          <span className="final__choice-text">{yesLabel}</span>
        </button>

        <button className="final__choice final__choice--no" onClick={handleNo}>
          <span className="final__choice-glow" />
          <span className="final__choice-text">{noLabel}</span>
        </button>
      </div>

      {/* Story Editor Modal */}
      {showEditor && canEdit && (
        <StoryEditorModal story={activeStory} onClose={() => setShowEditor(false)} />
      )}
    </div>
  );
}
