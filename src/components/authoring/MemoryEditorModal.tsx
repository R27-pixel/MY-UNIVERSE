import { useState } from 'react';
import { useExperienceStore } from '../../stores/experienceStore';
import type { UniverseMemory, Star } from '../../types';
import './MemoryEditorModal.css';

interface MemoryEditorModalProps {
  memory: UniverseMemory;
  star?: Star | null;
  onClose: () => void;
}

export function MemoryEditorModal({ memory, star, onClose }: MemoryEditorModalProps) {
  const updateMemoryContent = useExperienceStore((s) => s.updateMemoryContent);

  const [title, setTitle] = useState(memory.title || '');
  const [memoryDate, setMemoryDate] = useState(memory.memory_date || '');
  const [locationName, setLocationName] = useState(memory.location_name || '');
  const [content, setContent] = useState(memory.content || '');

  // Star 3D Properties
  const [starName, setStarName] = useState(star?.name || '');
  const [starSubtitle, setStarSubtitle] = useState(star?.subtitle || '');
  const [positionX, setPositionX] = useState(star?.position_x ?? 0);
  const [positionY, setPositionY] = useState(star?.position_y ?? 0);
  const [positionZ, setPositionZ] = useState(star?.position_z ?? 0);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const memoryUpdates: Partial<UniverseMemory> = {
        title: title.trim(),
        memory_date: memoryDate.trim() || null,
        location_name: locationName.trim() || null,
        content: content.trim(),
      };

      const starUpdates: Partial<Star> = star
        ? {
            name: starName.trim() || title.trim(),
            subtitle: starSubtitle.trim() || locationName.trim() || undefined,
            position_x: Number(positionX),
            position_y: Number(positionY),
            position_z: Number(positionZ),
          }
        : {};

      await updateMemoryContent(memory.id, memoryUpdates, star ? starUpdates : undefined);
      onClose();
    } catch (err: any) {
      console.error('[MemoryEditorModal Save Error]', err);
      setErrorMsg(err?.message || 'Permission denied or update failed. (Requires Creator / Admin role)');
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
      <div className="memory-editor-modal__container custom-scrollbar">
        <div className="memory-editor-modal__header">
          <h2>✏️ Edit Memory & 3D Star Node</h2>
          <button type="button" className="memory-editor-modal__close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div className="memory-editor-modal__error">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="memory-editor-modal__form">
          <div className="memory-editor-modal__field">
            <label>Memory Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. The Beginning"
            />
          </div>

          <div className="memory-editor-modal__row">
            <div className="memory-editor-modal__field">
              <label>Memory Date</label>
              <input
                type="text"
                value={memoryDate}
                onChange={(e) => setMemoryDate(e.target.value)}
                placeholder="e.g. 2026-08-24"
              />
            </div>
            <div className="memory-editor-modal__field">
              <label>Location / Phase</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Starlight Observatory"
              />
            </div>
          </div>

          <div className="memory-editor-modal__field">
            <label>Memory Story & Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              placeholder="Write the memory details or narrative..."
            />
          </div>

          {star && (
            <div className="memory-editor-modal__star-section">
              <h3>✨ 3D Celestial Node Properties</h3>
              <div className="memory-editor-modal__row">
                <div className="memory-editor-modal__field">
                  <label>Star Name</label>
                  <input
                    type="text"
                    value={starName}
                    onChange={(e) => setStarName(e.target.value)}
                    placeholder="Star node label"
                  />
                </div>
                <div className="memory-editor-modal__field">
                  <label>Star Subtitle</label>
                  <input
                    type="text"
                    value={starSubtitle}
                    onChange={(e) => setStarSubtitle(e.target.value)}
                    placeholder="Sub-label"
                  />
                </div>
              </div>

              <div className="memory-editor-modal__row">
                <div className="memory-editor-modal__field">
                  <label>Pos X</label>
                  <input
                    type="number"
                    step="0.5"
                    value={positionX}
                    onChange={(e) => setPositionX(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="memory-editor-modal__field">
                  <label>Pos Y</label>
                  <input
                    type="number"
                    step="0.5"
                    value={positionY}
                    onChange={(e) => setPositionY(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="memory-editor-modal__field">
                  <label>Pos Z</label>
                  <input
                    type="number"
                    step="0.5"
                    value={positionZ}
                    onChange={(e) => setPositionZ(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="memory-editor-modal__actions">
            <button type="button" className="editor-btn editor-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="editor-btn editor-btn--save" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save & Publish ✦'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
