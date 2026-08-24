import { useCallback } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import './PortalModal.css';

export function PortalModal() {
  const showPortalModal = useExperienceStore((s) => s.showPortalModal);
  const closePortalModal = useExperienceStore((s) => s.closePortalModal);
  const setPhase = useExperienceStore((s) => s.setPhase);

  const handleEnter = useCallback(() => {
    closePortalModal();
    setPhase('HIDDEN_GAME');
  }, [closePortalModal, setPhase]);

  const handleNotYet = useCallback(() => {
    closePortalModal();
  }, [closePortalModal]);

  if (!showPortalModal) return null;

  return (
    <div className="portal-overlay" onClick={handleNotYet}>
      <div className="portal-card" onClick={(e) => e.stopPropagation()}>
        {/* Glow Ring */}
        <div className="portal-card__glow" />

        <div className="portal-card__content">
          <div className="portal-card__badge">
            <span className="portal-card__dot" />
            <span>ANOMALY DETECTED</span>
          </div>

          <h2 className="portal-card__title">UNKNOWN LEVEL DETECTED</h2>
          <p className="portal-card__prompt">ENTER?</p>

          <div className="portal-card__actions">
            <button className="portal-btn portal-btn--enter" onClick={handleEnter}>
              <span>ENTER</span>
              <span className="portal-btn__arrow">→</span>
            </button>
            <button className="portal-btn portal-btn--notyet" onClick={handleNotYet}>
              <span>NOT YET</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
