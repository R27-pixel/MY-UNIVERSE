import { useEffect, useState, useCallback, useMemo } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { memories as staticMemories } from '../config/memories.config';
import { mapDbContentToMemories } from '../utils/celestialMapper';
import { MemoryEditorModal } from './authoring/MemoryEditorModal';
import type { Memory, UniverseMemory, Star } from '../types';
import './MemoryViewer.css';

/**
 * MemoryViewer — Displays memory content when a celestial object is clicked.
 * Supports all memory types: photo, text, message, location, etc.
 */
export function MemoryViewer() {
  const activeMemoryId = useExperienceStore((s) => s.activeMemoryId);
  const setActiveMemory = useExperienceStore((s) => s.setActiveMemory);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const discoverMemory = useExperienceStore((s) => s.discoverMemory);
  const activeUniverseStars = useExperienceStore((s) => s.activeUniverseStars);
  const activeUniverseMemories = useExperienceStore((s) => s.activeUniverseMemories);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const activeMembership = useExperienceStore((s) => s.activeMembership);

  const [visible, setVisible] = useState(false);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const canEdit = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';

  const activeMemories = useMemo(() => {
    return mapDbContentToMemories(
      activeUniverseStars,
      activeUniverseMemories,
      activeUniverse?.theme_config
    );
  }, [activeUniverseStars, activeUniverseMemories, activeUniverse?.theme_config]);

  useEffect(() => {
    if (activeMemoryId) {
      const found = activeMemories.find((m) => m.id === activeMemoryId) || staticMemories.find((m) => m.id === activeMemoryId);
      if (found) {
        setMemory(found);
        setImageLoaded(false);
        // Small delay for transition
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
        // Mark as discovered
        discoverMemory(activeMemoryId);
      }
    }
  }, [activeMemoryId, activeMemories, discoverMemory]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setActiveMemory(null);
      setMemory(null);
      setPhase('UNIVERSE');
    }, 600);
  }, [setActiveMemory, setPhase]);

  // Close on Escape & Open Editor on 'C' for owner/admin
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if ((e.key === 'c' || e.key === 'C') && canEdit && !showEditor) {
        setShowEditor(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClose, canEdit, showEditor]);

  if (!memory) return null;

  return (
    <div
      className={`memory-viewer ${visible ? 'memory-viewer--visible' : ''}`}
      onClick={(e) => {
        if (!showEditor) handleClose();
      }}
    >
      <div
        className="memory-viewer__content"
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Date marker */}
        <div className="memory-viewer__date">
          <span className="memory-viewer__date-line" />
          <span className="memory-viewer__date-text">{memory.date}</span>
          <span className="memory-viewer__date-line" />
        </div>

        {/* Title */}
        <h2 className="memory-viewer__title">{memory.title}</h2>

        {/* Content based on type */}
        {memory.type === 'photo' && memory.image && (
          <div className="memory-viewer__photo">
            <div className={`memory-viewer__photo-frame ${imageLoaded ? 'memory-viewer__photo-frame--loaded' : ''}`}>
              <img
                src={memory.image}
                alt={memory.title}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  // Show placeholder if image not found
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            {memory.caption && (
              <p className="memory-viewer__caption">{memory.caption}</p>
            )}
          </div>
        )}

        {/* Description / text content */}
        {memory.description && (
          <div className={`memory-viewer__text ${memory.id === 'memory-09' ? 'memory-viewer__text--solemn' : ''}`}>
            {memory.description.split('\n').map((line, i) => {
              const isBoldHeader = line.startsWith('**') && line.endsWith('**');
              const textContent = isBoldHeader ? line.slice(2, -2) : line;
              return (
                <p
                  key={i}
                  className={`memory-viewer__paragraph ${isBoldHeader ? 'memory-viewer__paragraph--bold' : ''}`}
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}
                >
                  {textContent || '\u00A0'}
                </p>
              );
            })}
          </div>
        )}

        {/* Spotify Audio Embed (Only rendered if custom spotifyEmbed URL exists) */}
        {Boolean(memory.spotifyEmbed) && (
          <div className="memory-viewer__spotify" style={{ marginTop: '20px' }}>
            <iframe
              src={memory.spotifyEmbed}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ borderRadius: '12px' }}
              title={memory.title || "Audio Memory"}
            />
          </div>
        )}

        {/* Messages type */}
        {memory.type === 'message' && memory.messages && (
          <div className="memory-viewer__messages">
            {memory.messages.map((msg, i) => (
              <div
                key={i}
                className={`memory-viewer__message ${
                  msg.sender === 'me'
                    ? 'memory-viewer__message--sent'
                    : 'memory-viewer__message--received'
                }`}
                style={{ animationDelay: `${0.5 + i * 0.2}s` }}
              >
                <span className="memory-viewer__message-text">{msg.text}</span>
                <span className="memory-viewer__message-time">{msg.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Location type */}
        {memory.type === 'location' && memory.location && (
          <div className="memory-viewer__location">
            <div className="memory-viewer__location-pin">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <span className="memory-viewer__location-name">{memory.location.name}</span>
          </div>
        )}

        {/* Creator / Admin Prominent Edit Memory Button */}
        {canEdit && (
          <button
            type="button"
            className="memory-viewer__top-edit-btn"
            onClick={() => setShowEditor(true)}
            title="Edit memory content (Owner / Admin)"
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)',
              border: '1px solid rgba(216, 180, 254, 0.5)',
              color: '#f472b6',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)',
              zIndex: 5,
            }}
          >
            ✏️ Edit Memory
          </button>
        )}

        {/* Close button */}
        <button className="memory-viewer__close" onClick={handleClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Discovery indicator */}
        <div className="memory-viewer__discovered" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="memory-viewer__discovered-dot" />
            <span>Memory discovered</span>
          </div>

          {canEdit && (
            <button
              type="button"
              className="memory-viewer__edit-btn"
              onClick={() => setShowEditor(true)}
              title="Edit memory title, content, date, and 3D star coordinates"
              style={{
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#c084fc',
                borderRadius: '14px',
                padding: '4px 10px',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              ✏️ Edit Memory
            </button>
          )}
        </div>

        {/* Proceed to Meeting Question when all 12 unlocked */}
        {useExperienceStore.getState().discoveredMemoryIds.size >= (activeMemories.length || staticMemories.length) && (
          <button
            className="memory-viewer__chat-btn"
            onClick={() => {
              handleClose();
              setTimeout(() => setPhase('FINAL'), 700);
            }}
          >
            <span>All 12 Unlocked — A Final Question ✦</span>
          </button>
        )}
      </div>

      {/* Memory & Star Editor Modal for Universe Creator / Admin */}
      {showEditor && canEdit && (
        <MemoryEditorModal
          memory={
            activeUniverseMemories.find((m) => m.id === memory.id || m.star_id === memory.starId) || {
              id: memory.id,
              universe_id: activeUniverse?.id || '',
              star_id: memory.starId || null,
              title: memory.title,
              content: memory.description,
              memory_date: memory.date,
              location_name: memory.location?.name || null,
              display_order: 0,
              is_unlocked_by_default: false,
            }
          }
          star={activeUniverseStars.find((s) => s.id === memory.starId || s.star_number === parseInt(memory.id.replace(/\D/g, ''), 10)) || null}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
