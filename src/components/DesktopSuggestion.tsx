import { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useExperienceStore } from '../stores/experienceStore';
import './DesktopSuggestion.css';

/**
 * DesktopSuggestion — Non-intrusive mobile banner suggesting desktop viewing
 * for optimal 3D visuals. Does NOT block experience or force device switching.
 */
export function DesktopSuggestion() {
  const device = useSettingsStore((s) => s.device);
  const phase = useExperienceStore((s) => s.phase);
  const [dismissed, setDismissed] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = device.isMobile || (typeof window !== 'undefined' && window.innerWidth <= 1024);
      setIsMobileScreen(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [device.isMobile]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    sessionStorage.setItem('dismissed_desktop_suggestion', 'true');
  };

  if (!isMobileScreen || dismissed) return null;
  if (phase === 'CHAT' || phase === 'ENDED') return null;

  return (
    <div className="desktop-suggestion-banner">
      <div className="desktop-suggestion-content">
        <div className="desktop-suggestion-tag">✦ OPTIMAL EXPERIENCE ✦</div>
        <p className="desktop-suggestion-text">
          This 3D universe is even more breathtaking on a laptop or desktop screen.
        </p>
        <button
          type="button"
          className="desktop-suggestion-btn"
          onClick={handleDismiss}
        >
          <span>Continue on phone</span>
          <span className="desktop-suggestion-x">✕</span>
        </button>
      </div>
    </div>
  );
}
