import { useState } from 'react';
import { useExperienceStore } from '../../stores/experienceStore';
import type { UniverseStory } from '../../types';
import './MemoryEditorModal.css';

interface StoryEditorModalProps {
  story?: UniverseStory | null;
  onClose: () => void;
}

export function StoryEditorModal({ story, onClose }: StoryEditorModalProps) {
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const updateStoryContent = useExperienceStore((s) => s.updateStoryContent);

  // Parse existing JSON from story.description if present
  let initialConfig = {
    prelude: 'There is one thing I actually wanted to ask you.',
    question: 'Would you want to meet?',
    yesLabel: 'YES',
    noLabel: 'NO',
  };

  if (story?.description) {
    try {
      const parsed = JSON.parse(story.description);
      if (parsed.question) {
        initialConfig = { ...initialConfig, ...parsed };
      }
    } catch {
      if (story.description) {
        initialConfig.question = story.description;
      }
    }
  }

  const [prelude, setPrelude] = useState(initialConfig.prelude);
  const [question, setQuestion] = useState(initialConfig.question);
  const [yesLabel, setYesLabel] = useState(initialConfig.yesLabel);
  const [noLabel, setNoLabel] = useState(initialConfig.noLabel);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUniverse) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const jsonPayload = JSON.stringify({
        prelude: prelude.trim(),
        question: question.trim(),
        yesLabel: yesLabel.trim(),
        noLabel: noLabel.trim(),
      });

      const storyId = story?.id || 'default-story';

      await updateStoryContent(storyId, {
        title: question.trim() || 'Our Universe Sequence',
        description: jsonPayload,
      });

      onClose();
    } catch (err: any) {
      console.error('[StoryEditorModal Save Error]', err);
      setErrorMsg(err?.message || 'Failed to save final question. (Requires Creator / Admin role)');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="memory-editor-modal"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="memory-editor-modal__backdrop" onClick={onClose} />
      <div className="memory-editor-modal__container">
        <div className="memory-editor-modal__header">
          <h2>✏️ Edit Final Question Interaction</h2>
          <button type="button" className="memory-editor-modal__close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div className="memory-editor-modal__error">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="memory-editor-modal__form">
          <div className="memory-editor-modal__field">
            <label>Prelude Line</label>
            <input
              type="text"
              value={prelude}
              onChange={(e) => setPrelude(e.target.value)}
              required
              placeholder="e.g. There is one thing I actually wanted to ask you."
            />
          </div>

          <div className="memory-editor-modal__field">
            <label>Main Final Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Would you want to meet?"
            />
          </div>

          <div className="memory-editor-modal__row">
            <div className="memory-editor-modal__field">
              <label>Yes Button Label</label>
              <input
                type="text"
                value={yesLabel}
                onChange={(e) => setYesLabel(e.target.value)}
                required
                placeholder="e.g. YES"
              />
            </div>
            <div className="memory-editor-modal__field">
              <label>No Button Label</label>
              <input
                type="text"
                value={noLabel}
                onChange={(e) => setNoLabel(e.target.value)}
                required
                placeholder="e.g. NO"
              />
            </div>
          </div>

          <div className="memory-editor-modal__actions">
            <button type="button" className="editor-btn editor-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="editor-btn editor-btn--save" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Question ✦'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
