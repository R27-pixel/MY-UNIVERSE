import { useExperienceStore } from '../stores/experienceStore';
import './WelcomeBackScreen.css';

/**
 * WelcomeBackScreen — Screen displayed when an authenticated user returns
 * after having already completed all 12 memory stars.
 */
export function WelcomeBackScreen() {
  const setPhase = useExperienceStore((s) => s.setPhase);
  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const activeMembership = useExperienceStore((s) => s.activeMembership);
  const userUniverses = useExperienceStore((s) => s.userUniverses);

  const displayName = currentProfile?.display_name || 'Cosmic Traveler';
  const universeTitle = activeUniverse?.title || 'Our Universe';
  const role = activeMembership?.role || 'traveler';
  const isGuest = role === 'guest';

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">
        <div className="welcome-header">
          <div className="welcome-logo">✦ OUR UNIVERSE ✦</div>
          <h1 className="welcome-title">Welcome Back, {displayName}</h1>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '8px 0 16px 0', flexWrap: 'wrap' }}>
            <span className="identity-badge identity-badge--universe">
              ✦ {universeTitle}
            </span>
            <span className={`identity-badge identity-badge--role identity-badge--${role}`}>
              {role.toUpperCase()}
            </span>
            {isGuest && (
              <span className="identity-badge identity-badge--guest">
                👁 GUEST (READ ONLY)
              </span>
            )}
          </div>
          <p className="welcome-subtitle">
            You are connected to <strong>{universeTitle}</strong>. All celestial memories across this universe are unlocked.
          </p>
          <p className="welcome-glowing-hint">
            ✦ A secret unknown anomaly still pulses in the deep cosmos... Can you find it? ✦
          </p>
        </div>

        <div className="welcome-actions">
          {/* Primary Action Button: Go directly to Chat */}
          <button
            className="welcome-btn welcome-btn--primary"
            onClick={() => setPhase('CHAT')}
          >
            <span>ENTER UNIVERSE CHAT 💬</span>
            <span className="welcome-btn-arrow">→</span>
          </button>

          {/* Secondary Action Button: Read Letter */}
          <button
            className="welcome-btn welcome-btn--secondary"
            onClick={() => setPhase('LETTER')}
          >
            <span>Read Letter: The Reason I Made This 📜</span>
          </button>

          {/* Tertiary Action Button: Re-explore Universe */}
          <button
            className="welcome-btn welcome-btn--tertiary welcome-btn--jumping"
            onClick={() => setPhase('UNIVERSE')}
          >
            <span>Re-explore Universe 🌌</span>
          </button>

          {/* Log Out / Switch Identity Button */}
          <button
            className="welcome-btn welcome-btn--secondary"
            onClick={() => useExperienceStore.getState().signOut()}
            title="Sign out of current session and return to Identity Verification"
          >
            <span>Log Out / Switch Account 🚪</span>
          </button>
        </div>
      </div>
    </div>
  );
}
