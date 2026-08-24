import { useState, useEffect } from 'react';
import { useExperienceStore } from '../stores/experienceStore';
import {
  signInUser,
  signUpUser,
  redeemUniverseInvitation,
} from '../services/supabase/SupabaseService';
import './IdentityModal.css';

/**
 * IdentityModal — v2 Multi-Tenant Authentication & Universe Onboarding Portal
 */
export function IdentityModal() {
  const isAuthInitializing = useExperienceStore((s) => s.isAuthInitializing);
  const isAuthenticated = useExperienceStore((s) => s.isAuthenticated);
  const currentUser = useExperienceStore((s) => s.currentUser);
  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const userUniverses = useExperienceStore((s) => s.userUniverses);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const loadUserUniverses = useExperienceStore((s) => s.loadUserUniverses);
  const selectUniverse = useExperienceStore((s) => s.selectUniverse);
  const createUniverseAction = useExperienceStore((s) => s.createUniverse);
  const signOutAction = useExperienceStore((s) => s.signOut);
  const showUniverseModal = useExperienceStore((s) => s.showUniverseModal);
  const setShowUniverseModal = useExperienceStore((s) => s.setShowUniverseModal);

  // Modal Sub-views: 'auth' | 'selector' | 'create' | 'join'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [viewMode, setViewMode] = useState<'auth' | 'selector' | 'create' | 'join'>('auth');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Universe Creation Form
  const [universeTitle, setUniverseTitle] = useState('');
  const [universeSlug, setUniverseSlug] = useState('');
  const [universeSubtitle, setUniverseSubtitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  // Invitation Token
  const [invitationToken, setInvitationToken] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  // Feedback State
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Auto-detect invitation token in URL query (/join?token=XYZ or ?token=XYZ)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    let token = searchParams.get('token');

    if (!token && window.location.pathname.startsWith('/join')) {
      const parts = window.location.pathname.split('/');
      if (parts.length >= 3 && parts[2]) {
        token = parts[2];
      }
    }

    if (token) {
      setPendingToken(token.trim());
    }
  }, []);

  // 2. Auto-redeem pending invitation token once authenticated
  useEffect(() => {
    if (isAuthenticated && pendingToken && !isLoading) {
      setIsLoading(true);
      setError('');
      setSuccessMsg('Redeeming invitation token...');

      redeemUniverseInvitation(pendingToken)
        .then(async (res) => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setPendingToken(null);
          setSuccessMsg('Successfully joined Universe!');
          const uid = useExperienceStore.getState().userId;
          if (uid) await loadUserUniverses(uid);
          if (res.universe_id) {
            await selectUniverse(res.universe_id);
          }
        })
        .catch((err: any) => {
          const msg = err?.message || '';
          if (msg.includes('ALREADY_MEMBER')) {
            setError('You are already a member of this Universe.');
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setPendingToken(null);
          } else if (msg.includes('EXPIRED_INVITATION')) {
            setError('This invitation link has expired.');
            setPendingToken(null);
          } else if (msg.includes('INVITATION_LIMIT_REACHED')) {
            setError('This invitation link has reached its maximum usage limit.');
            setPendingToken(null);
          } else {
            setError(msg || 'Failed to redeem invitation token.');
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated, pendingToken]);

  // Sync View Mode based on Auth State & Universes
  useEffect(() => {
    if (isAuthenticated) {
      if (userUniverses.length === 0) {
        setViewMode('create');
      } else {
        setViewMode('selector');
      }
    } else {
      setViewMode('auth');
    }
  }, [isAuthenticated, userUniverses.length]);

  // If session is restoring or active universe is already chosen (and modal was not explicitly opened), hide modal
  if (isAuthInitializing || (isAuthenticated && activeUniverse && !showUniverseModal)) {
    return null;
  }

  // Handle Authentication (Sign In / Sign Up)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (authMode === 'signup') {
        const data = await signUpUser(email.trim(), password.trim(), displayName.trim());
        if (!data.session) {
          setSuccessMsg('Account created! Please check your email to confirm or sign in.');
        }
      } else {
        await signInUser(email.trim(), password.trim());
      }
    } catch (err: any) {
      console.error('[Auth Submit Error]', err);
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Create Universe
  const handleCreateUniverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universeTitle.trim() || isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      await createUniverseAction(
        universeTitle.trim(),
        universeSlug.trim() || undefined,
        isPrivate,
        { subtitle: universeSubtitle.trim() }
      );
      setUniverseTitle('');
      setUniverseSlug('');
      setUniverseSubtitle('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create universe.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Manual Token Redemption
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationToken.trim() || isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await redeemUniverseInvitation(invitationToken.trim());
      setInvitationToken('');
      const uid = useExperienceStore.getState().userId;
      if (uid) await loadUserUniverses(uid);
      if (res.universe_id) {
        await selectUniverse(res.universe_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to redeem invitation code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="identity-overlay">
      <div className="identity-card" style={{ position: 'relative' }}>
        {activeUniverse && (
          <button
            type="button"
            className="identity-close-btn"
            onClick={() => setShowUniverseModal(false)}
            title="Close Universe Manager"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            ✕
          </button>
        )}
        <div className="identity-header">
          <div className="identity-logo">✦ OUR UNIVERSE ✦</div>
          <h2 className="identity-title">
            {viewMode === 'auth' && (authMode === 'signin' ? 'Sign In' : 'Create Account')}
            {viewMode === 'selector' && (userUniverses.length === 0 ? 'Welcome to Our Universe' : 'Select Universe')}
            {viewMode === 'create' && 'Create Your Universe'}
            {viewMode === 'join' && 'Join with Invitation'}
          </h2>
          <p className="identity-subtitle">
            {viewMode === 'auth' && 'Enter your credentials to access your digital experiences'}
            {viewMode === 'selector' && (userUniverses.length === 0 ? 'Create a Universe or join one with an invitation code' : 'Choose an active universe to enter')}
            {viewMode === 'create' && 'Set up your private 3D celestial experience'}
            {viewMode === 'join' && 'Enter your invitation code to access a private universe'}
          </p>
        </div>

        {/* Pending Invitation Link Banner */}
        {pendingToken && !isAuthenticated && (
          <div className="identity-invite-banner">
            ✦ You have been invited to join a Universe! Sign in or create an account to accept.
          </div>
        )}

        {/* Feedback Messages */}
        {error && <div className="identity-error-msg" style={{ marginBottom: '16px' }}>{error}</div>}
        {successMsg && <div className="identity-success-msg" style={{ marginBottom: '16px' }}>{successMsg}</div>}

        {/* VIEW 1: AUTHENTICATION FORM */}
        {viewMode === 'auth' && (
          <>
            <div className="identity-tabs">
              <button
                type="button"
                className={`identity-tab-btn ${authMode === 'signin' ? 'identity-tab-btn--active' : ''}`}
                onClick={() => { setAuthMode('signin'); setError(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`identity-tab-btn ${authMode === 'signup' ? 'identity-tab-btn--active' : ''}`}
                onClick={() => { setAuthMode('signup'); setError(''); }}
              >
                Sign Up
              </button>
            </div>

            <form className="identity-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <div className="identity-input-group">
                  <label htmlFor="display-name">Display Name</label>
                  <input
                    id="display-name"
                    type="text"
                    className="identity-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Cosmic Traveler"
                    required
                  />
                </div>
              )}

              <div className="identity-input-group">
                <label htmlFor="email-input">Email Address</label>
                <input
                  id="email-input"
                  type="email"
                  className="identity-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="traveler@ouruniverse.io"
                  required
                />
              </div>

              <div className="identity-input-group">
                <label htmlFor="password-input">Password</label>
                <input
                  id="password-input"
                  type="password"
                  className="identity-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <button type="submit" className="identity-submit-btn" disabled={isLoading}>
                {isLoading ? 'Authenticating...' : authMode === 'signin' ? 'Sign In →' : 'Create Account →'}
              </button>
            </form>
          </>
        )}

        {/* VIEW 2: UNIVERSE SELECTOR */}
        {viewMode === 'selector' && (
          <div>
            {currentProfile && (
              <div className="identity-user-tag">
                Signed in as: <strong>{currentProfile.display_name}</strong> ({currentUser?.email})
              </div>
            )}

            {userUniverses.length === 0 ? (
              <div style={{ margin: '20px 0' }}>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '20px' }}>
                  You do not belong to any Universes yet.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <button
                    type="button"
                    className="identity-submit-btn"
                    onClick={() => { setViewMode('create'); setError(''); }}
                  >
                    + Create New Universe
                  </button>
                  <button
                    type="button"
                    className="identity-secondary-btn"
                    onClick={() => { setViewMode('join'); setError(''); }}
                  >
                    + Redeem Invitation Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="identity-universe-list">
                {userUniverses.map((uni) => (
                  <div key={uni.id} className="identity-universe-item">
                    <div className="identity-universe-info">
                      <span className="identity-universe-title">{uni.title}</span>
                      <span className="identity-universe-sub">{uni.subtitle || uni.slug}</span>
                    </div>
                    <button
                      type="button"
                      className="identity-enter-btn"
                      onClick={() => selectUniverse(uni.id)}
                    >
                      Enter →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="identity-actions-row">
              {userUniverses.length > 0 && (
                <>
                  <button
                    type="button"
                    className="identity-secondary-btn"
                    onClick={() => { setViewMode('create'); setError(''); }}
                  >
                    + Create
                  </button>
                  <button
                    type="button"
                    className="identity-secondary-btn"
                    onClick={() => { setViewMode('join'); setError(''); }}
                  >
                    + Join
                  </button>
                </>
              )}
              <button
                type="button"
                className="identity-secondary-btn"
                onClick={() => signOutAction()}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: CREATE UNIVERSE */}
        {viewMode === 'create' && (
          <form className="identity-form" onSubmit={handleCreateUniverseSubmit}>
            <div className="identity-input-group">
              <label htmlFor="universe-title">Universe Title</label>
              <input
                id="universe-title"
                type="text"
                className="identity-input"
                value={universeTitle}
                onChange={(e) => setUniverseTitle(e.target.value)}
                placeholder="OUR UNIVERSE"
                required
              />
            </div>

            <div className="identity-input-group">
              <label htmlFor="universe-slug">Unique Slug (Optional)</label>
              <input
                id="universe-slug"
                type="text"
                className="identity-input"
                value={universeSlug}
                onChange={(e) => setUniverseSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="our-universe-cosmic"
              />
            </div>

            <div className="identity-input-group">
              <label htmlFor="universe-subtitle">Subtitle / Description (Optional)</label>
              <input
                id="universe-subtitle"
                type="text"
                className="identity-input"
                value={universeSubtitle}
                onChange={(e) => setUniverseSubtitle(e.target.value)}
                placeholder="A private digital experience"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#ccc', margin: '6px 0' }}>
              <input
                id="is-private"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <label htmlFor="is-private">Private Universe (Requires invitation to join)</label>
            </div>

            <button type="submit" className="identity-submit-btn" disabled={isLoading || !universeTitle.trim()}>
              {isLoading ? 'Creating...' : 'Create & Enter Universe →'}
            </button>

            {userUniverses.length > 0 && (
              <button
                type="button"
                className="identity-secondary-btn"
                onClick={() => setViewMode('selector')}
                style={{ width: '100%' }}
              >
                ← Back to Universes
              </button>
            )}
          </form>
        )}

        {/* VIEW 4: JOIN VIA INVITATION TOKEN */}
        {viewMode === 'join' && (
          <form className="identity-form" onSubmit={handleJoinSubmit}>
            <div className="identity-input-group">
              <label htmlFor="token-input">Enter Invitation Code / Secret Token</label>
              <input
                id="token-input"
                type="text"
                className="identity-input"
                value={invitationToken}
                onChange={(e) => setInvitationToken(e.target.value)}
                placeholder="Paste invitation token..."
                required
              />
            </div>

            <button type="submit" className="identity-submit-btn" disabled={isLoading || !invitationToken.trim()}>
              {isLoading ? 'Redeeming...' : 'Redeem Invitation →'}
            </button>

            <button
              type="button"
              className="identity-secondary-btn"
              onClick={() => setViewMode(userUniverses.length > 0 ? 'selector' : 'create')}
              style={{ width: '100%' }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
