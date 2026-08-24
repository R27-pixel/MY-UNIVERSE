import { useState, useEffect, useRef, useMemo } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { storyConfig } from '../config/story.config';
import './LetterSequence.css';

/**
 * LetterSequence — "The Reason I Made This"
 * Paper unfolds → text reveals gradually with delicate typography.
 * Supports smooth 1-finger and 2-finger touch scrolling on phone devices.
 */
export function LetterSequence() {
  const [stage, setStage] = useState(0); // 0=collapse, 1=black, 2=paper, 3=text, 4=done
  const [visibleParas, setVisibleParas] = useState(0);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const readLetter = useExperienceStore((s) => s.readLetter);
  const activeUniverseMemories = useExperienceStore((s) => s.activeUniverseMemories);
  const activeUniverseStoryMemories = useExperienceStore((s) => s.activeUniverseStoryMemories);
  const paperRef = useRef<HTMLDivElement>(null);

  const dbLetter = useMemo(() => {
    if (!activeUniverseMemories || activeUniverseMemories.length === 0) return null;
    // 1. Try finding a memory matching a story_memory join
    if (activeUniverseStoryMemories && activeUniverseStoryMemories.length > 0) {
      const storyMemId = activeUniverseStoryMemories[0].memory_id;
      const found = activeUniverseMemories.find((m) => m.id === storyMemId);
      if (found && found.content && found.content.trim().length > 0) {
        return found;
      }
    }
    // 2. Try finding a memory marked unlocked by default or containing 'letter' in title
    const defaultLetter = activeUniverseMemories.find(
      (m) => (m.is_unlocked_by_default || m.title.toLowerCase().includes('letter')) && m.content && m.content.trim().length > 0
    );
    return defaultLetter || null;
  }, [activeUniverseMemories, activeUniverseStoryMemories]);

  const title = dbLetter?.title || storyConfig.letter?.title || 'A Letter Written Across Time';
  const date = dbLetter?.memory_date || storyConfig.letter?.date || 'Cosmic Sequence';

  const paragraphs: string[] = useMemo(() => {
    if (dbLetter?.content && dbLetter.content.trim().length > 0) {
      const rawParas = dbLetter.content.split(/\n+/).filter((p) => p.trim().length > 0);
      if (rawParas.length > 0) {
        return rawParas;
      }
    }
    return (
      storyConfig.letter?.paragraphs ||
      (storyConfig.letter as any)?.lines?.map((l: any) => l.text) ||
      []
    );
  }, [dbLetter]);

  useEffect(() => {
    if (paperRef.current) {
      paperRef.current.scrollTop = 0;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Stage transitions
    timers.push(setTimeout(() => setStage(1), 300));   // Dark background
    timers.push(setTimeout(() => setStage(2), 1200));  // Paper appears
    timers.push(setTimeout(() => setStage(3), 2200));  // Text starts

    // Reveal paragraphs one by one smoothly without forcing scroll down
    paragraphs.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleParas(i + 1);
        }, 2500 + i * 900)
      );
    });

    // Complete
    timers.push(
      setTimeout(() => {
        setStage(4);
        readLetter();
      }, 2500 + paragraphs.length * 1100 + 1000)
    );

    return () => timers.forEach(clearTimeout);
  }, [paragraphs, readLetter]);

  const handleContinue = () => {
    setPhase('UNIVERSE');
  };

  const handleShowAll = () => {
    setVisibleParas(paragraphs.length);
    setStage(4);
    if (paperRef.current) {
      paperRef.current.scrollTop = 0;
    }
    requestAnimationFrame(() => {
      if (paperRef.current) {
        paperRef.current.scrollTop = 0;
      }
    });
  };

  // Stop wheel and touch propagation so trackpad scrolling on laptops & phones works natively
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`letter ${stage >= 1 ? 'letter--dark' : ''}`}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
    >
      {/* Paper */}
      <div
        ref={paperRef}
        className={`letter__paper ${stage >= 2 ? 'letter__paper--visible' : ''}`}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        {/* Title */}
        <h2 className={`letter__title ${stage >= 3 ? 'letter__title--visible' : ''}`}>
          {title}
        </h2>

        {/* Paragraphs */}
        <div className="letter__body">
          {paragraphs.map((para, i) => {
            const isThankYou = para.startsWith('Thank you');
            return (
              <p
                key={i}
                className={`letter__paragraph ${
                  visibleParas > i ? 'letter__paragraph--visible' : ''
                } ${isThankYou ? 'letter__paragraph--highlight' : ''}`}
              >
                {para}
              </p>
            );
          })}
        </div>

        {/* Controls */}
        <div className="letter__actions">
          {visibleParas < paragraphs.length && stage >= 3 && (
            <button className="letter__skip" onClick={handleShowAll}>
              <span>Read Full Letter</span>
            </button>
          )}

          {stage >= 4 && (
            <button className="letter__continue" onClick={handleContinue}>
              <span>Return to Universe</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
