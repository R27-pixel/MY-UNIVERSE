import { useState } from 'react';
import { useExperienceStore } from '../../stores/experienceStore';
import { createUniverseInvitation } from '../../services/supabase/SupabaseService';
import type { UniverseMemberRole } from '../../types';
import './InviteModal.css';

interface InviteModalProps {
  onClose: () => void;
}

export function InviteModal({ onClose }: InviteModalProps) {
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);

  const [role, setRole] = useState<UniverseMemberRole>('guest');
  const [maxUses, setMaxUses] = useState<string>('');
  const [expiresHours, setExpiresHours] = useState<string>('72');

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUniverse) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setInviteUrl(null);
    setCopied(false);

    try {
      const parsedMaxUses = maxUses.trim() ? parseInt(maxUses.trim(), 10) : null;
      const parsedExpires = expiresHours.trim() ? parseInt(expiresHours.trim(), 10) : null;

      const result = await createUniverseInvitation(
        activeUniverse.id,
        role,
        parsedMaxUses,
        parsedExpires
      );

      if (result?.raw_token) {
        const fullUrl = `${window.location.origin}?invite=${result.raw_token}`;
        setInviteUrl(fullUrl);
      } else {
        setErrorMsg('Failed to generate invitation link.');
      }
    } catch (err: any) {
      console.error('[InviteModal Generate Error]', err);
      setErrorMsg(err?.message || 'Permission denied. (Requires Creator / Admin role)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="invite-modal"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="invite-modal__backdrop" onClick={onClose} />
      <div className="invite-modal__container">
        <div className="invite-modal__header">
          <h2>💌 Invite Members to {activeUniverse?.title || 'Universe'}</h2>
          <button type="button" className="invite-modal__close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div className="invite-modal__error">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {!inviteUrl ? (
          <form onSubmit={handleGenerate} className="invite-modal__form">
            <div className="invite-modal__field">
              <label>Assign Role for Invited User</label>
              <div className="invite-modal__role-picker">
                <label className={`role-option ${role === 'guest' ? 'role-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="assignedRole"
                    value="guest"
                    checked={role === 'guest'}
                    onChange={() => setRole('guest')}
                  />
                  <div className="role-option__info">
                    <strong>Guest (Read-Only) 🔒</strong>
                    <span>Can explore 3D space & memories. Cannot edit or mutate content.</span>
                  </div>
                </label>

                <label className={`role-option ${role === 'traveler' ? 'role-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="assignedRole"
                    value="traveler"
                    checked={role === 'traveler'}
                    onChange={() => setRole('traveler')}
                  />
                  <div className="role-option__info">
                    <strong>Traveler 🌌</strong>
                    <span>Standard member. Can chat & participate in calls.</span>
                  </div>
                </label>

                <label className={`role-option ${role === 'admin' ? 'role-option--active' : ''}`}>
                  <input
                    type="radio"
                    name="assignedRole"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={() => setRole('admin')}
                  />
                  <div className="role-option__info">
                    <strong>Co-Admin / Co-Creator 👑</strong>
                    <span>Full creator access to edit memories & manage invitations.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="invite-modal__row">
              <div className="invite-modal__field">
                <label>Expiration (Hours)</label>
                <select value={expiresHours} onChange={(e) => setExpiresHours(e.target.value)}>
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="72">72 Hours (3 Days)</option>
                  <option value="168">7 Days</option>
                  <option value="">Never Expires</option>
                </select>
              </div>

              <div className="invite-modal__field">
                <label>Max Uses (Optional)</label>
                <input
                  type="number"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            <div className="invite-modal__actions">
              <button type="button" className="invite-btn invite-btn--cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="invite-btn invite-btn--generate" disabled={isGenerating}>
                {isGenerating ? 'Generating Hashed Token...' : 'Generate Shareable Link 🔗'}
              </button>
            </div>
          </form>
        ) : (
          <div className="invite-modal__result">
            <div className="invite-modal__success-badge">
              <span>✅ Cryptographic Invitation Token Generated!</span>
            </div>

            <div className="invite-modal__url-box">
              <input type="text" value={inviteUrl} readOnly />
              <button type="button" className="invite-btn invite-btn--copy" onClick={handleCopy}>
                {copied ? 'Copied! 📋' : 'Copy Link 📋'}
              </button>
            </div>

            <p className="invite-modal__hint">
              Share this link with your invited user. Upon clicking and signing up, they will automatically join <strong>{activeUniverse?.title}</strong> as a <strong>{role.toUpperCase()}</strong>.
            </p>

            <div className="invite-modal__actions">
              <button type="button" className="invite-btn invite-btn--cancel" onClick={() => setInviteUrl(null)}>
                Create Another
              </button>
              <button type="button" className="invite-btn invite-btn--generate" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
