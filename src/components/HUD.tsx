import { useState } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import { memories } from '../config/memories.config';
import { useSettingsStore } from '../stores/settingsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { InviteModal } from './authoring/InviteModal';
import './HUD.css';

/**
 * HUD — Floating heads-up display showing discovery progress,
 * sound toggle, letter shortcut, and subtle metadata.
 */
export function HUD() {
  const discoveredCount = useExperienceStore((s) => s.discoveredMemoryIds.size);
  const phase = useExperienceStore((s) => s.phase);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const showHUD = useSettingsStore((s) => s.showHUD);
  const audioEnabled = useSettingsStore((s) => s.audioEnabled);
  const toggleAudio = useSettingsStore((s) => s.toggleAudio);
  const device = useSettingsStore((s) => s.device);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const activeMembership = useExperienceStore((s) => s.activeMembership);
  const userUniverses = useExperienceStore((s) => s.userUniverses);
  const setShowUniverseModal = useExperienceStore((s) => s.setShowUniverseModal);

  const [showInviteModal, setShowInviteModal] = useState(false);

  const totalMemories = memories.length;
  const allDiscovered = discoveredCount >= totalMemories;

  const displayName = currentProfile?.display_name || 'Traveler';
  const universeTitle = activeUniverse?.title || 'Our Universe';
  const role = activeMembership?.role || 'traveler';
  const isGuest = role === 'guest';
  const isAdminOrOwner = role === 'owner' || role === 'admin';

  if (phase !== 'UNIVERSE' && phase !== 'MEMORY') return null;
  if (!showHUD) return null;

  return (
    <div className={`hud ${device.isMobile ? 'hud--mobile' : ''}`}>
      {/* Active Universe & Identity Info Pill */}
      <div className="hud__identity-pill">
        <div className="hud__universe-title">
          ✦ {universeTitle}
        </div>
        <div className="hud__user-info">
          <span className="hud__user-name">{displayName}</span>
          <span className={`hud__role-chip hud__role-chip--${role}`}>
            {role.toUpperCase()}
          </span>
          {isGuest && <span className="hud__guest-chip">READ-ONLY</span>}
        </div>
      </div>

      {/* Discovery counter */}
      <div className="hud__discovery">
        <span className="hud__label">MEMORIES DISCOVERED</span>
        <span className="hud__counter">
          <span className="hud__count">{discoveredCount}</span>
          <span className="hud__separator">/</span>
          <span className="hud__total">{totalMemories}</span>
        </span>
        {!allDiscovered && (
          <div className="hud__spam-hint">
            ✦ Explore all {totalMemories} memory stars across the cosmos to unlock the secret gateway ✦
          </div>
        )}
      </div>

      {/* Top Right Action Controls Bar */}
      <div className="hud__actions-bar">
        {/* Switch / Create Universe Button */}
        <button
          className="hud__letter-btn"
          onClick={() => setShowUniverseModal(true)}
          title="Switch active Universe or Create a New Universe"
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(96, 165, 250, 0.4)',
            color: '#93c5fd',
          }}
        >
          <span>🌌 UNIVERSES</span>
        </button>

        {/* Creator / Admin Invitation Button */}
        {isAdminOrOwner && (
          <button
            className="hud__letter-btn"
            onClick={() => setShowInviteModal(true)}
            title="Generate secure invitation link for guests or co-creators"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
              borderColor: 'rgba(165, 180, 252, 0.4)',
              color: '#c7d2fe',
            }}
          >
            <span>💌 INVITE</span>
          </button>
        )}

        {/* Read Letter Button */}
        <button
          className="hud__letter-btn"
          onClick={() => setPhase('LETTER')}
          title="Read 'The Reason I Made This'"
        >
          <span>📜 LETTER</span>
        </button>

        {/* Chat Access Button when all 12 planets are discovered */}
        {allDiscovered && (
          <button
            className="hud__chat-access"
            onClick={() => setPhase(useExperienceStore.getState().experienceCompleted ? 'CHAT' : 'FINAL')}
            title="All 12 memories unlocked! Proceed to final question."
          >
            <span className="hud__chat-pulse" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>ENTER CHAT</span>
            {unreadCount > 0 && (
              <span className="hud__unread-badge">{unreadCount}</span>
            )}
          </button>
        )}

        {/* Sound toggle */}
        <button className="hud__sound" onClick={toggleAudio} aria-label="Toggle sound">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {audioEnabled ? (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            )}
          </svg>
        </button>

        {/* Log Out button */}
        <button
          className="hud__sound"
          onClick={() => useExperienceStore.getState().signOut()}
          title="Sign out of current session"
          aria-label="Log out"
        >
          <span>🚪</span>
        </button>
      </div>

      {/* Subtle coordinates */}
      {!device.isMobile && (
        <div className="hud__meta">
          <span className="hud__meta-item">SYS::ACTIVE</span>
          <span className="hud__meta-item">{new Date().toISOString().split('T')[0]}</span>
        </div>
      )}

      {/* Creator / Admin Invitation Generation Modal */}
      {showInviteModal && isAdminOrOwner && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
