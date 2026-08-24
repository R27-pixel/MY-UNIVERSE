import { useCallback, useEffect } from 'react';
import { useExperienceStore } from './stores/experienceStore';
import { Universe } from './three/Universe';
import { LoadingScreen } from './components/LoadingScreen';
import { OpeningSequence } from './components/OpeningSequence';
import { BigBangFlash } from './components/BigBangFlash';
import { MemoryViewer } from './components/MemoryViewer';
import { HUD } from './components/HUD';
import { LetterSequence } from './components/LetterSequence';
import { FinalEvent } from './components/FinalEvent';
import { YesPath } from './components/YesPath';
import { NoPath } from './components/NoPath';
import { ChatRoom } from './components/chat/ChatRoom';
import { EndScreen } from './components/EndScreen';
import { IdentityModal } from './components/IdentityModal';
import { WelcomeBackScreen } from './components/WelcomeBackScreen';
import { DesktopSuggestion } from './components/DesktopSuggestion';
import { AudioManager } from './components/AudioManager';
import { CallModal } from './components/call/CallModal';
import { NotificationToast } from './components/notifications/NotificationToast';
import { PortalModal } from './components/PortalModal';
import { HiddenCosmicGame } from './components/game/HiddenCosmicGame';
import { useNotificationStore } from './stores/notificationStore';
import { supabase, subscribeToV2Messages, redeemUniverseInvitation } from './services/supabase/SupabaseService';
import { callService } from './services/callService';

import { useDeviceCapability } from './hooks/useDeviceCapability';

import './styles/index.css';

/**
 * App — Experience controller & session gatekeeper.
 * Separates Authentication Session from 12-Star Experience Completion.
 */
function App() {
  useDeviceCapability();
  const phase = useExperienceStore((s) => s.phase);
  const setPhase = useExperienceStore((s) => s.setPhase);
  const isAuthInitializing = useExperienceStore((s) => s.isAuthInitializing);
  const isAuthenticated = useExperienceStore((s) => s.isAuthenticated);
  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const activeMembership = useExperienceStore((s) => s.activeMembership);
  const experienceCompleted = useExperienceStore((s) => s.experienceCompleted);
  const userProfile = useExperienceStore((s) => s.userProfile);
  const hydrateUserSession = useExperienceStore((s) => s.hydrateUserSession);
  const showUniverseModal = useExperienceStore((s) => s.showUniverseModal);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    // Hydrate session on initial load with error handling for expired/invalid refresh tokens
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        if (error) {
          console.warn('[Auth Session] Expired or invalid refresh token, clearing session:', error.message);
          client.auth.signOut().catch(() => {});
        }
        hydrateUserSession(null);
      } else {
        hydrateUserSession(session);
      }
    }).catch((err) => {
      console.warn('[Auth Session Error]', err);
      client.auth.signOut().catch(() => {});
      hydrateUserSession(null);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        hydrateUserSession(null);
      } else {
        hydrateUserSession(session);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [hydrateUserSession]);

  // Clear chat notifications whenever the user enters ChatRoom
  useEffect(() => {
    if (phase === 'CHAT') {
      useNotificationStore.getState().clearChatNotifications();
    }
  }, [phase]);

  // URL Invitation Auto-Redemption Listener (?invite=raw_token)
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('invite');
    if (!rawToken) return;

    redeemUniverseInvitation(rawToken)
      .then((res) => {
        if (res?.success && res.universe_id) {
          // Clean token from URL query string
          window.history.replaceState({}, document.title, window.location.pathname);
          // Reload user universes & auto-switch to redeemed universe
          const store = useExperienceStore.getState();
          store.loadUserUniverses().then(() => {
            store.selectUniverse(res.universe_id);
          });
        }
      })
      .catch((err) => {
        console.warn('[Invitation Auto-Redemption Notice]', err?.message || err);
      });
  }, [isAuthenticated]);

  // Global Real-Time Message Notification Listener (ONLY active when user is OUTSIDE ChatRoom)
  useEffect(() => {
    if (!isAuthenticated || !activeUniverse || !currentProfile || phase === 'CHAT') return;

    // 1. Cross-tab LocalStorage message signal listener
    const handleStorageSignal = (e: StorageEvent) => {
      if (e.key === 'universe_message_signal' && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg && msg.senderId && msg.senderId !== currentProfile.id && msg.universeId === activeUniverse.id) {
            const senderName = msg.senderName || 'Member';
            const msgId = msg.id || `${msg.senderId}-${Date.now()}`;
            useNotificationStore.getState().addChatMessageNotification(senderName, msgId);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageSignal);

    // 2. Real-time Supabase database INSERT notification listener
    let unsubscribeSupabase: (() => void) | null = null;
    try {
      unsubscribeSupabase = subscribeToV2Messages(activeUniverse.id, '', (msg) => {
        if (msg.sender_id !== currentProfile.id && msg.universe_id === activeUniverse.id) {
          useNotificationStore.getState().addChatMessageNotification('Member', msg.id);
        }
      });
    } catch (err) {
      console.warn('[Global Message Listener Notice]', err);
    }

    return () => {
      window.removeEventListener('storage', handleStorageSignal);
      if (unsubscribeSupabase) unsubscribeSupabase();
    };
  }, [isAuthenticated, activeUniverse, currentProfile, phase]);

  // Global Realtime Universe Call Listener for incoming WebRTC calls
  useEffect(() => {
    if (isAuthenticated && activeUniverse) {
      callService.ensureUniverseCallListener(activeUniverse.id);
    }
  }, [isAuthenticated, activeUniverse]);

  const handleLoadingComplete = useCallback(() => {
    if (experienceCompleted) {
      setPhase('WELCOME_BACK');
    } else {
      setPhase('OPENING');
    }
  }, [experienceCompleted, setPhase]);

  // Show Welcome Back Screen when phase is WELCOME_BACK or returning after completion
  const isWelcomeBack = phase === 'WELCOME_BACK' || (isAuthenticated && activeUniverse && experienceCompleted && phase === 'LOADING');

  return (
    <>
      {/* Case 1: Session restoration or Universe selection/management required -> Show Identity Verification / Universe Modal */}
      {!isAuthInitializing && (!isAuthenticated || !activeUniverse || showUniverseModal) && <IdentityModal />}

      {/* Global Call & Notification Overlays */}
      {isAuthenticated && activeUniverse && (
        <>
          <CallModal />
          <NotificationToast />
          <PortalModal />
        </>
      )}

      {/* Film grain overlay (always on) */}
      <div className="film-grain" />

      {/* 3D Universe (renders when active universe is chosen) */}
      {isAuthenticated && activeUniverse && (phase === 'UNIVERSE' || phase === 'MEMORY' || phase === 'FINAL' || phase === 'LETTER' || phase === 'BIGBANG') && (
        <Universe />
      )}

      {/* Admin Controls (Visible to Owner / Admin roles) */}
      {isAuthenticated && activeUniverse && (activeMembership?.role === 'owner' || activeMembership?.role === 'admin') && phase !== 'CHAT' && (
        <div className="r27-admin-bar">
          <button
            className="r27-bypass-btn"
            onClick={() => setPhase('CHAT')}
            title="Direct bypass to Chat (Admin)"
            aria-label="Direct bypass to Chat"
          >
            <span className="r27-bypass-dot" />
            <span>Admin Chat</span>
          </button>
        </div>
      )}

      {/* HUD & Audio Controller */}
      {isAuthenticated && activeUniverse && <HUD />}
      <AudioManager />

      {/* Mobile Desktop Suggestion Banner */}
      <DesktopSuggestion />

      {/* Phase-based UI layers */}
      {isAuthenticated && activeUniverse && phase === 'LOADING' && !experienceCompleted && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}
      {isAuthenticated && activeUniverse && isWelcomeBack && <WelcomeBackScreen />}
      {isAuthenticated && activeUniverse && phase === 'OPENING' && <OpeningSequence />}
      {isAuthenticated && activeUniverse && phase === 'BIGBANG' && <BigBangFlash />}
      {isAuthenticated && activeUniverse && phase === 'MEMORY' && <MemoryViewer />}
      {isAuthenticated && activeUniverse && phase === 'LETTER' && <LetterSequence />}
      {isAuthenticated && activeUniverse && phase === 'FINAL' && <FinalEvent />}
      {isAuthenticated && activeUniverse && phase === 'YES_PATH' && <YesPath />}
      {isAuthenticated && activeUniverse && phase === 'NO_PATH' && <NoPath />}
      {isAuthenticated && activeUniverse && phase === 'CHAT' && <ChatRoom />}
      {isAuthenticated && activeUniverse && phase === 'ENDED' && <EndScreen />}
      {isAuthenticated && activeUniverse && phase === 'HIDDEN_GAME' && <HiddenCosmicGame />}
    </>
  );
}

export default App;
