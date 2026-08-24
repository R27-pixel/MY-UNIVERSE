import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { storyConfig } from '../config/story.config';
import './OpeningSequence.css';

/**
 * OpeningSequence — Premium cinematic intro.
 * Features: particle starfield, typewriter text, lens flare,
 * sound wave ripples, and an interactive orb to enter the universe.
 */

const STAR_COUNT = 60;
const RIPPLE_COUNT = 4;

export function OpeningSequence() {
  const [stage, setStage] = useState(0);
  const [textIndex, setTextIndex] = useState(-1);
  const [typedChars, setTypedChars] = useState(0);
  const [currentLineFinished, setCurrentLineFinished] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const activeUniverseStories = useExperienceStore((s) => s.activeUniverseStories);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = storyConfig.opening.lines;

  // Generate random stars for the background
  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      brightness: 0.15 + Math.random() * 0.5,
      duration: 15 + Math.random() * 30,
      twinkleDuration: 2 + Math.random() * 4,
      delay: Math.random() * 10,
      driftX: -30 + Math.random() * 60,
    }));
  }, []);

  // Stage 0 → 1: Light appears
  useEffect(() => {
    const timer = setTimeout(() => setStage(1), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Start text after light appears
  useEffect(() => {
    if (stage < 1) return;
    const timer = setTimeout(() => {
      setTextIndex(0);
      setTypedChars(0);
      setCurrentLineFinished(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [stage]);

  // Typewriter effect: type out current line char by char
  useEffect(() => {
    if (textIndex < 0 || textIndex >= lines.length) return;
    if (currentLineFinished) return;

    const currentText = lines[textIndex].text;
    if (typedChars >= currentText.length) {
      setCurrentLineFinished(true);
      return;
    }

    // Variable typing speed for realism
    const baseSpeed = 50;
    const char = currentText[typedChars];
    const delay =
      char === '.' ? baseSpeed * 6 :
      char === ',' ? baseSpeed * 3 :
      char === ' ' ? baseSpeed * 0.5 :
      baseSpeed + Math.random() * 30;

    const timer = setTimeout(() => {
      setTypedChars((c) => c + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [textIndex, typedChars, currentLineFinished, lines]);

  // After finishing a line, wait then advance
  useEffect(() => {
    if (!currentLineFinished || textIndex < 0) return;

    const pauseDuration = lines[textIndex].pause;
    const timer = setTimeout(() => {
      if (textIndex < lines.length - 1) {
        setTextIndex((i) => i + 1);
        setTypedChars(0);
        setCurrentLineFinished(false);
      } else {
        setShowExplore(true);
      }
    }, pauseDuration);

    return () => clearTimeout(timer);
  }, [currentLineFinished, textIndex, lines]);

  const handleEnter = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setPhase('BIGBANG');
    }, 1200);
  }, [setPhase]);

  const handleSkip = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setPhase('BIGBANG');
    }, 600);
  }, [setPhase]);

  return (
    <div
      ref={containerRef}
      className={`opening ${fadeOut ? 'opening--fade-out' : ''}`}
    >
      {/* Vignette overlay */}
      <div className="opening__vignette" />

      {/* Particle star field */}
      <div className="opening__starfield">
        {stars.map((star, i) => (
          <div
            key={i}
            className="opening__star"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                '--star-brightness': star.brightness,
                '--star-duration': `${star.duration}s`,
                '--twinkle-duration': `${star.twinkleDuration}s`,
                '--star-delay': `${star.delay}s`,
                '--drift-x': `${star.driftX}px`,
                boxShadow: `0 0 ${star.size * 2}px rgba(232, 230, 227, ${star.brightness * 0.3})`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Central light */}
      <div
        className={`opening__light ${stage >= 1 ? 'opening__light--visible' : ''}`}
      />

      {/* Lens flare */}
      <div
        className={`opening__lens-flare ${stage >= 1 ? 'opening__lens-flare--visible' : ''}`}
      />

      {/* Lens flare hex artifacts */}
      {stage >= 1 && (
        <>
          <div className="opening__flare-hex opening__flare-hex--1 opening__flare-hex--visible" />
          <div className="opening__flare-hex opening__flare-hex--2 opening__flare-hex--visible" />
          <div className="opening__flare-hex opening__flare-hex--3 opening__flare-hex--visible" />
        </>
      )}

      {/* Sound wave ripples from the light */}
      {stage >= 1 && (
        <div className="opening__ripples">
          {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
            <div
              key={i}
              className="opening__ripple opening__ripple--visible"
              style={
                {
                  '--ripple-delay': `${i * 1.2}s`,
                  '--ripple-duration': `${4 + i * 0.5}s`,
                  borderColor: `rgba(79, 195, 247, ${0.15 - i * 0.03})`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Text lines with typewriter effect */}
      <div className="opening__text-container">
        {lines.map((line, i) => {
          // Determine text state
          const isCurrentLine = textIndex === i;
          const isPastLine = textIndex > i;
          const isFutureLine = textIndex < i;
          const isTyping = isCurrentLine && !currentLineFinished;
          const isDone = isCurrentLine && currentLineFinished;

          // Get the displayed text
          let displayText = '';
          if (isPastLine) {
            displayText = line.text;
          } else if (isCurrentLine) {
            displayText = line.text.slice(0, typedChars);
          }

          if (isFutureLine) return null;

          return (
            <p
              key={i}
              className={`opening__text ${
                isTyping ? 'opening__text--typing' : ''
              } ${isDone ? 'opening__text--done' : ''} ${
                isPastLine ? 'opening__text--faded' : ''
              }`}
            >
              {displayText || '\u00A0'}
            </p>
          );
        })}
      </div>

      {/* Enter interaction — enhanced orb */}
      {showExplore && (
        <div className="opening__enter" onClick={handleEnter}>
          <div className="opening__orb">
            <div className="opening__orb-core" />
            <div className="opening__orb-ring opening__orb-ring--1" />
            <div className="opening__orb-ring opening__orb-ring--2" />
            <div className="opening__orb-ring opening__orb-ring--3" />
            <div className="opening__orb-ripple opening__orb-ripple--1" />
            <div className="opening__orb-ripple opening__orb-ripple--2" />
            <div className="opening__orb-ripple opening__orb-ripple--3" />
          </div>
          <span className="opening__enter-hint">touch to enter</span>
        </div>
      )}

      {/* Skip button */}
      {!fadeOut && stage >= 1 && (
        <button className="opening__skip" onClick={handleSkip}>
          skip ›
        </button>
      )}
    </div>
  );
}
