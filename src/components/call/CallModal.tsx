import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '../../stores/callStore';
import { useExperienceStore } from '../../stores/experienceStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { callService } from '../../services/callService';
import { resumeAudioContext } from '../../utils/soundEffects';
import './CallModal.css';

/**
 * CallModal — v2 Multi-tenant full-screen WebRTC call overlay.
 */

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function CallModal() {
  const status = useCallStore((s) => s.status);
  const callType = useCallStore((s) => s.callType);
  const callerId = useCallStore((s) => s.callerId);
  const callerName = useCallStore((s) => s.callerName);
  const calleeName = useCallStore((s) => s.calleeName);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const isMuted = useCallStore((s) => s.isMuted);
  const isVideoOff = useCallStore((s) => s.isVideoOff);
  const isPeerMuted = useCallStore((s) => s.isPeerMuted);
  const duration = useCallStore((s) => s.duration);
  const permissionError = useCallStore((s) => s.permissionError);

  const setPhase = useExperienceStore((s) => s.setPhase);
  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const userId = useExperienceStore((s) => s.userId);
  const activeMembership = useExperienceStore((s) => s.activeMembership);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [speakerOn, setSpeakerOn] = useState(true);

  const myId = currentProfile?.id || userId || '';
  const isCaller = myId === callerId;
  const peerDisplayName = isCaller ? (calleeName || 'Member') : (callerName || 'Member');

  // Ensure WebRTC signaling channel is joined when authenticated
  useEffect(() => {
    callService.ensureSupabaseSignaling();
  }, []);

  // Attach local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, status]);

  const [audioBlocked, setAudioBlocked] = useState(false);

  // Attach remote video/audio stream
  useEffect(() => {
    const remoteElement = callType === 'video' ? remoteVideoRef.current : remoteAudioRef.current;
    if (remoteElement && remoteStream) {
      if (remoteElement.srcObject !== remoteStream) {
        remoteElement.srcObject = remoteStream;
      }
      remoteElement.autoplay = true;
      remoteElement.volume = 1.0;
      remoteElement.play().then(() => {
        setAudioBlocked(false);
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[CallModal] Remote audio/video autoplay blocked:', err.message);
          setAudioBlocked(true);
        }
      });
    }
  }, [callType, remoteStream, status]);

  const unlockAudioManually = () => {
    resumeAudioContext();
    const remoteElement = callType === 'video' ? remoteVideoRef.current : remoteAudioRef.current;
    if (remoteElement) {
      remoteElement.play().then(() => {
        setAudioBlocked(false);
      }).catch(() => {});
    }
  };

  const toggleSpeaker = async () => {
    resumeAudioContext();
    const audio = remoteAudioRef.current || remoteVideoRef.current;
    const nextSpeakerOn = !speakerOn;
    setSpeakerOn(nextSpeakerOn);

    if (!audio) return;

    const audioWithSink = audio as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };

    if (typeof audioWithSink.setSinkId === 'function') {
      try {
        await audioWithSink.setSinkId(nextSpeakerOn ? 'default' : 'communications');
      } catch (error) {
        console.warn('[CallModal] setSinkId audio output routing is unavailable or failed:', error);
      }
    } else {
      useNotificationStore.getState().addNotification({
        title: 'Speaker Setting 🔊',
        body: 'Speaker switching is managed by your mobile device volume / Bluetooth settings.',
        type: 'system',
      });
    }
  };

  if (status === 'idle') return null;

  const isIncoming = status === 'incoming';
  const isCalling = status === 'calling';
  const isConnected = status === 'connected';
  const isEnded = status === 'ended';

  const dismissToIdle = () => {
    useCallStore.setState({ status: 'idle' });
  };

  const handleDecline = () => {
    callService.declineCall();
    useCallStore.setState({ status: 'idle' });
    setPhase('CHAT');
  };

  const handleHangup = () => {
    callService.hangupCall();
    useCallStore.setState({ status: 'idle' });
    setPhase('CHAT');
  };

  return (
    <div className={`call-modal call-modal--${status}`}>
      <div className="call-modal__backdrop" />

      <div className="call-modal__container">
        {/* Header bar */}
        <div className="call-modal__header">
          <div className="call-modal__badge">
            <span className="call-modal__dot" />
            <span>
              {callType === 'video' ? '📹 VIDEO CALL' : '📞 VOICE CALL'}
            </span>
          </div>

          {isConnected && (
            <div className="call-modal__timer">{formatDuration(duration)}</div>
          )}
        </div>

        {/* Permission Error Banner */}
        {permissionError && (
          <div className="call-modal__permission-error">
            <span>{permissionError}</span>
          </div>
        )}

        {/* Browser Autoplay Blocked Tap-to-Unmute Banner */}
        {audioBlocked && (
          <div
            className="call-modal__permission-error"
            onClick={unlockAudioManually}
            style={{ cursor: 'pointer', background: 'rgba(234, 179, 8, 0.25)', borderColor: '#eab308' }}
          >
            <span>🔊 Audio playback blocked by browser. Tap anywhere on this banner to enable sound!</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="call-modal__body">
          {/* CONNECTED VIDEO STREAM DISPLAY */}
          {isConnected && callType === 'video' ? (
            <div className="call-modal__video-grid">
              {/* Remote Video Stream */}
              <div className="call-modal__video-remote">
                <video
                  ref={(el) => {
                    remoteVideoRef.current = el;
                    if (el && remoteStream && el.srcObject !== remoteStream) {
                      el.srcObject = remoteStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className="call-modal__video-elem"
                />
                {!remoteStream && (
                  <div className="call-modal__video-placeholder">
                    <div className="call-modal__avatar-pulse">
                      <span>{peerDisplayName.charAt(0).toUpperCase()}</span>
                    </div>
                    <p>Connecting video feed...</p>
                  </div>
                )}
                {isPeerMuted && (
                  <div className="call-modal__peer-muted-badge">🔇 Muted</div>
                )}
              </div>

              {/* Local Video Stream */}
              <div className="call-modal__video-local">
                <video
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && localStream && el.srcObject !== localStream) {
                      el.srcObject = localStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`call-modal__video-elem ${isVideoOff ? 'call-modal__video-elem--off' : ''}`}
                />
                {isVideoOff && (
                  <div className="call-modal__local-off-label">
                    <span>Camera Off</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* AUDIO CALL OR RINGING AVATAR DISPLAY */
            <div className="call-modal__avatar-container">
              <audio
                ref={(el) => {
                  remoteAudioRef.current = el;
                  if (el && remoteStream && el.srcObject !== remoteStream) {
                    el.srcObject = remoteStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                className="call-modal__remote-audio"
                aria-label="Remote voice call audio"
              />

              <div className="call-modal__pulse-rings">
                <span className="ring ring--1" />
                <span className="ring ring--2" />
                <span className="ring ring--3" />
              </div>

              <div className="call-modal__avatar-orb">
                <span>{peerDisplayName.charAt(0).toUpperCase()}</span>
              </div>

              <h2 className="call-modal__peer-name">{peerDisplayName}</h2>
              <p className="call-modal__status-text">
                {isCalling && 'Calling... Waiting for answer'}
                {isIncoming && `Incoming ${callType === 'video' ? 'video' : 'voice'} call...`}
                {isConnected && 'Voice Connected'}
                {isEnded && 'Call Ended'}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="call-modal__actions">
          {/* INCOMING CALL ACTIONS */}
          {isIncoming && (
            <div className="call-modal__incoming-actions">
              <button
                type="button"
                className="call-btn call-btn--decline"
                onClick={handleDecline}
                title="Decline Call & Return to Chat"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.33a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
                <span>Decline</span>
              </button>

              <button
                type="button"
                className="call-btn call-btn--accept"
                onClick={() => {
                  resumeAudioContext();
                  callService.acceptCall();
                }}
                title="Accept Call"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>Accept</span>
              </button>
            </div>
          )}

          {/* OUTGOING RINGING OR CONNECTED CALL CONTROLS */}
          {(isCalling || isConnected) && (
            <div className="call-modal__active-controls">
              {/* Single tab Echo Test Mode button (Owner/Admin Only) */}
              {isCalling && (activeMembership?.role === 'owner' || activeMembership?.role === 'admin') && (
                <button
                  type="button"
                  className="call-btn call-btn--echo"
                  onClick={() => callService.startEchoTestCall()}
                  title="Connect Echo Test Mode for single-tab testing (Admin only)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>Test Call Mode</span>
                </button>
              )}

              {/* Mute Mic Button */}
              <button
                type="button"
                className={`call-btn call-btn--tool ${isMuted ? 'call-btn--active-danger' : ''}`}
                onClick={() => callService.toggleMute()}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {/* Speaker Output Button */}
              {callType === 'audio' && isConnected && (
                <button
                  type="button"
                  className={`call-btn call-btn--tool ${speakerOn ? '' : 'call-btn--active-danger'}`}
                  onClick={toggleSpeaker}
                  title={speakerOn ? 'Use device earpiece' : 'Use speaker'}
                >
                  <span aria-hidden="true">{speakerOn ? '🔊' : '🔈'}</span>
                  <span>{speakerOn ? 'Speaker' : 'Earpiece'}</span>
                </button>
              )}

              {/* Toggle Camera Button */}
              <button
                type="button"
                className={`call-btn call-btn--tool ${isVideoOff ? 'call-btn--active-danger' : ''}`}
                onClick={() => callService.toggleVideo()}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoOff ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                )}
                <span>{isVideoOff ? 'Camera On' : 'Camera Off'}</span>
              </button>

              {/* End Call Button */}
              <button
                type="button"
                className="call-btn call-btn--end"
                onClick={handleHangup}
                title="End Call"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.33a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                </svg>
                <span>End Call</span>
              </button>
            </div>
          )}

          {/* CALL ENDED SCREEN */}
          {isEnded && (
            <div className="call-modal__ended-actions">
              <button
                type="button"
                className="call-btn call-btn--return-chat"
                onClick={() => {
                  dismissToIdle();
                  setPhase('CHAT');
                }}
                title="Return to Chat Room"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Return to Chat 💬</span>
              </button>

              <button
                type="button"
                className="call-btn call-btn--close-modal"
                onClick={dismissToIdle}
                title="Close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Close</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
