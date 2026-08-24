/**
 * callService.ts — Production WebRTC calling service for Our Universe v2.
 *
 * ARCHITECTURE:
 *   Signaling:   Supabase Realtime Broadcast (scoped channel: universe:{universe_id}:call:{call_session_id})
 *                + BroadcastChannel API (same-device multi-tab fallback)
 *   WebRTC:      RTCPeerConnection with STUN + optional TURN
 *   ICE:         Candidate queue — candidates are buffered until remoteDescription
 *                is set, then flushed.
 *   Security:    senderId is derived from authenticated user UUID (currentProfile.id / userId)
 *                and database RLS policies on call_sessions / call_participants.
 */

import { supabase } from './supabase/SupabaseService';
import { useCallStore, type PendingOffer } from '../stores/callStore';
import { useExperienceStore } from '../stores/experienceStore';
import { useNotificationStore } from '../stores/notificationStore';
import { startRingtone, stopRingtone, playCallEndTone, playCallAnswerTone, resumeAudioContext } from '../utils/soundEffects';
import type { CallSignalingPayload, CallType } from '../types';

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL || import.meta.env.VITE_TURN_URLS;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    const urlsList = turnUrl.split(',').map((u: string) => u.trim()).filter(Boolean);
    urlsList.forEach((rawUrl: string) => {
      let normalizedUrl = rawUrl;
      if (
        !normalizedUrl.startsWith('turn:') &&
        !normalizedUrl.startsWith('turns:') &&
        !normalizedUrl.startsWith('stun:') &&
        !normalizedUrl.startsWith('stuns:')
      ) {
        normalizedUrl = `turn:${normalizedUrl}`;
      }

      servers.push({
        urls: normalizedUrl,
        username: turnUsername,
        credential: turnCredential,
      });

      if (normalizedUrl.startsWith('turn:')) {
        servers.push({
          urls: normalizedUrl.replace('turn:', 'turns:'),
          username: turnUsername,
          credential: turnCredential,
        });
      }
    });
    callLog('TURN_CONFIGURED', `Configured ${urlsList.length} TURN endpoint(s) from environment.`);
  } else {
    callLog(
      'TURN_NOT_CONFIGURED',
      'No TURN credentials in environment (VITE_TURN_*). STUN-only mode active.'
    );
  }

  return servers;
}

const LOG_EVENTS = [
  'CALL_CREATED', 'CALL_ACCEPTED', 'CALL_REJECTED', 'CALL_CANCELLED',
  'OFFER_CREATED', 'OFFER_RECEIVED', 'ANSWER_CREATED', 'ANSWER_RECEIVED',
  'ICE_CANDIDATE_SENT', 'ICE_CANDIDATE_RECEIVED', 'ICE_CANDIDATE_QUEUED',
  'ICE_CANDIDATE_FLUSHED', 'REMOTE_DESCRIPTION_SET',
  'CONNECTION_STATE_CHANGED', 'ICE_CONNECTION_STATE_CHANGED',
  'CALL_ENDED', 'CALL_TIMEOUT', 'PERMISSION_ERROR',
  'TURN_CONFIGURED', 'TURN_NOT_CONFIGURED', 'SIGNALING_CHANNEL_JOINED',
  'SIGNALING_CHANNEL_LEFT', 'SIGNALING_SELF_FILTERED',
] as const;

type CallLogEvent = typeof LOG_EVENTS[number] | string;

function callLog(event: CallLogEvent, detail?: string, extra?: Record<string, unknown>) {
  if (import.meta.env.DEV || import.meta.env.VITE_CALL_DEBUG === 'true') {
    const parts: string[] = [`[CALL_SERVICE][${event}]`];
    if (detail) parts.push(detail);
    console.log(...parts, extra || '');
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const CALL_TIMEOUT_MS = 60_000; // Auto-cancel unanswered calls after 60 seconds

class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private signalingChannel: any = null;
  private localBroadcastChannel: BroadcastChannel | null = null;

  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  private peerStream: MediaStream | null = null;
  private canvasIntervalId: ReturnType<typeof setInterval> | null = null;

  private callTimer: ReturnType<typeof setInterval> | null = null;
  private callTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private pendingOffer: PendingOffer = null;
  private activeCallId: string | null = null;
  private activeUniverseId: string | null = null;

  constructor() {
    this.initLocalSignaling();
  }

  /**
   * Get the current authenticated user ID from Zustand store.
   */
  public getMySenderId(): string {
    const state = useExperienceStore.getState();
    return state.currentProfile?.id || state.userId || '';
  }

  /**
   * Set up same-device multi-tab signaling fallback.
   */
  private initLocalSignaling() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('universe_call_local_channel');
        this.localBroadcastChannel.onmessage = (event) => {
          const payload = event.data?.payload;
          if (payload?.eventType) {
            this.handleSignalingEvent(payload);
          }
        };
      } catch (err) {
        console.warn('[Call Service] BroadcastChannel init warning:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'universe_call_signal' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            if (data?.payload) {
              this.handleSignalingEvent(data.payload);
            }
          } catch (e) {}
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const store = useCallStore.getState();
          if (store.status === 'connected' && this.peerConnection) {
            callLog('VISIBILITY_RESUMED', 'Tab became visible during call');
            resumeAudioContext();
          }
        }
      });
    }
  }

  private universeCallChannel: any = null;

  /**
   * Listen for incoming calls across the entire Universe: universe:{universe_id}:calls
   */
  public ensureUniverseCallListener(universeId?: string) {
    if (!supabase) return;
    const activeUni = universeId || useExperienceStore.getState().activeUniverse?.id;
    if (!activeUni) return;

    if (this.universeCallChannel && this.activeUniverseId === activeUni) return;

    if (this.universeCallChannel) {
      supabase.removeChannel(this.universeCallChannel);
      this.universeCallChannel = null;
    }

    const channelTopic = `universe:${activeUni}:calls`;
    callLog('UNIVERSE_CALL_LISTENER_JOINED', channelTopic);

    this.activeUniverseId = activeUni;

    this.universeCallChannel = supabase.channel(channelTopic, {
      config: { broadcast: { self: false } },
    });

    this.universeCallChannel
      .on('broadcast', { event: 'call_signaling' }, (evt: any) => {
        const data = evt?.payload || evt;
        if (data?.eventType) {
          this.handleSignalingEvent(data);
        }
      })
      .subscribe((status: string) => {
        callLog('UNIVERSE_CALL_LISTENER', `Status: ${status}`);
      });
  }

  /**
   * Scoped Realtime Channel subscription: universe:{universe_id}:call:{call_session_id}
   */
  public ensureSupabaseSignaling(universeId?: string, callSessionId?: string) {
    if (!supabase) return;
    const activeUni = universeId || useExperienceStore.getState().activeUniverse?.id;
    const activeSession = callSessionId || this.activeCallId;

    if (!activeUni || !activeSession) return;

    if (this.signalingChannel && this.activeUniverseId === activeUni && this.activeCallId === activeSession) {
      return;
    }

    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }

    const channelTopic = `universe:${activeUni}:call:${activeSession}`;
    callLog('SIGNALING_CHANNEL_JOINED', channelTopic);

    this.activeUniverseId = activeUni;
    this.activeCallId = activeSession;

    this.signalingChannel = supabase.channel(channelTopic, {
      config: { broadcast: { self: false } },
    });

    this.signalingChannel
      .on('broadcast', { event: 'call_signaling' }, (evt: any) => {
        const data = evt?.payload || evt;
        if (data?.eventType) {
          this.handleSignalingEvent(data);
        }
      })
      .subscribe((status: string) => {
        callLog('SIGNALING_CHANNEL_JOINED', `Status: ${status}`);
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          this.signalingChannel = null;
        }
      });
  }

  public disconnectSupabaseSignaling() {
    if (this.signalingChannel && supabase) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }
  }

  private sendSignalingPayload(payload: CallSignalingPayload) {
    const myId = this.getMySenderId();
    const fullPayload: CallSignalingPayload = {
      ...payload,
      senderId: myId,
    };

    if (this.universeCallChannel) {
      this.universeCallChannel.send({
        type: 'broadcast',
        event: 'call_signaling',
        payload: fullPayload,
      }).catch((e: any) => console.warn('[Universe Call Broadcast Warning]', e));
    }

    if (this.signalingChannel) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'call_signaling',
        payload: fullPayload,
      }).catch((e: any) => console.warn('[Supabase Broadcast Warning]', e));
    }

    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: 'call_signaling',
          payload: fullPayload,
        });
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'universe_call_signal',
          JSON.stringify({ payload: fullPayload, _t: Date.now(), _rand: Math.random() })
        );
      } catch (e) {}
    }
  }

  public isSelf(id?: string): boolean {
    if (!id) return false;
    const state = useExperienceStore.getState();
    const myProfileId = state.currentProfile?.id;
    const myUserId = state.userId;
    return id === myProfileId || id === myUserId;
  }

  private async handleSignalingEvent(payload: CallSignalingPayload) {
    if (!payload?.eventType) return;

    const myId = this.getMySenderId();
    const store = useCallStore.getState();

    if (this.isSelf(payload.senderId)) {
      callLog('SIGNALING_SELF_FILTERED', payload.eventType);
      return;
    }

    if (
      payload.eventType !== 'CALL_OFFER' &&
      this.activeCallId &&
      payload.callId &&
      payload.callId !== this.activeCallId
    ) {
      callLog('SIGNALING_SELF_FILTERED', `Stale callId filtered: ${payload.callId} vs active: ${this.activeCallId}`);
      return;
    }

    switch (payload.eventType) {
      case 'CALL_OFFER': {
        callLog('OFFER_RECEIVED', `callId=${payload.callId} from=${payload.callerId}`);

        if (this.isSelf(payload.callerId)) return;
        if (payload.calleeId && !this.isSelf(payload.calleeId)) return;

        if (store.status !== 'idle' && store.status !== 'ended') {
          callLog('OFFER_RECEIVED', 'Already in a call — ignoring incoming offer');
          return;
        }

        this.pendingOffer = payload.sdp
          ? {
              callId: payload.callId,
              sdp: payload.sdp,
            }
          : null;
        this.activeCallId = payload.callId;

        // Ensure signaling channel is established for this call session
        const activeUni = useExperienceStore.getState().activeUniverse?.id;
        if (activeUni) {
          this.ensureSupabaseSignaling(activeUni, payload.callId);
        }

        const myProfile = useExperienceStore.getState().currentProfile;
        const myUserId = myId || useExperienceStore.getState().userId || '';

        store.receiveIncomingCall(
          payload.callId,
          payload.callType,
          payload.callerId,
          payload.callerName || 'Cosmic Traveler',
          payload.calleeId || myUserId,
          payload.calleeName || myProfile?.display_name || 'Member',
          this.pendingOffer
        );

        startRingtone();
        useNotificationStore.getState().addNotification({
          title: `Incoming ${payload.callType === 'video' ? 'Video' : 'Voice'} Call 📞`,
          body: `${payload.callerName || 'Member'} is calling...`,
          type: 'call',
          callerId: payload.callerId,
          callerName: payload.callerName,
          callType: payload.callType,
        });
        break;
      }

      case 'CALL_ANSWER': {
        if ((store.status === 'calling' || store.status === 'connected') && payload.sdp) {
          callLog('ANSWER_RECEIVED', `callId=${payload.callId}`);
          this.clearCallTimeout();

          try {
            if (this.peerConnection) {
              const currentState = this.peerConnection.signalingState;
              if (currentState === 'have-local-offer') {
                await this.peerConnection.setRemoteDescription(
                  new RTCSessionDescription(payload.sdp)
                );
                this.remoteDescriptionSet = true;
                callLog('REMOTE_DESCRIPTION_SET', 'answer');
                await this.flushIceCandidateQueue();
              } else {
                callLog('ANSWER_SKIPPED', `signalingState is ${currentState}`);
              }
            }
            store.acceptCall();
            stopRingtone();
            playCallAnswerTone();
            this.startCallTimer();
            this.updateCallSessionStatus('connected');
          } catch (e) {
            console.error('[WebRTC] Set remote answer error:', e);
            if (this.peerConnection?.signalingState === 'stable') {
              store.acceptCall();
              stopRingtone();
              this.startCallTimer();
            } else {
              this.cleanup();
              store.endCall();
              this.updateCallSessionStatus('ended');
            }
          }
        }
        break;
      }

      case 'ICE_CANDIDATE': {
        if (!payload.candidate) break;
        callLog('ICE_CANDIDATE_RECEIVED', `remoteDescSet=${this.remoteDescriptionSet}`);

        if (this.peerConnection && this.remoteDescriptionSet) {
          try {
            await this.peerConnection.addIceCandidate(
              new RTCIceCandidate(payload.candidate)
            );
          } catch (e) {
            console.error('[WebRTC] Add ICE candidate error:', e);
          }
        } else {
          this.iceCandidateQueue.push(payload.candidate);
        }
        break;
      }

      case 'CALL_DECLINE': {
        callLog('CALL_REJECTED', `by=${payload.calleeId}`);
        stopRingtone();
        playCallEndTone();
        this.cleanup();
        store.endCall();
        this.updateCallSessionStatus('declined');
        useNotificationStore.getState().clearCallNotifications();
        useNotificationStore.getState().addNotification({
          title: 'Call Declined ✖',
          body: `${payload.calleeName || 'Member'} declined the call.`,
          type: 'call',
        });
        break;
      }

      case 'CALL_END': {
        callLog('CALL_ENDED', `remote ended — callId=${payload.callId}`);
        stopRingtone();
        playCallEndTone();
        const durationStr = formatDuration(store.duration);
        this.cleanup();
        store.endCall();
        this.updateCallSessionStatus('ended');
        useNotificationStore.getState().clearCallNotifications();
        useNotificationStore.getState().addNotification({
          title: 'Call Ended 📞',
          body: `${payload.callType === 'video' ? 'Video' : 'Voice'} call ended (${durationStr}).`,
          type: 'call',
        });
        break;
      }

      case 'CALL_MUTE_TOGGLE': {
        if (payload.isMuted !== undefined) {
          useCallStore.getState().setPeerMuted(payload.isMuted);
        }
        break;
      }

      case 'CALL_VIDEO_TOGGLE': {
        if (payload.isVideoOff !== undefined) {
          useCallStore.getState().setPeerVideoOff(payload.isVideoOff);
        }
        break;
      }
    }
  }

  private async flushIceCandidateQueue() {
    if (!this.peerConnection || this.iceCandidateQueue.length === 0) return;

    callLog('ICE_CANDIDATE_FLUSHED', `flushing ${this.iceCandidateQueue.length} queued candidate(s)`);
    const candidates = [...this.iceCandidateQueue];
    this.iceCandidateQueue = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('[WebRTC] Flush ICE candidate error:', e);
      }
    }
  }

  private async getMediaStream(callType: CallType): Promise<{ stream: MediaStream; permissionError?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        stream: this.createCanvasMockStream(callType),
        permissionError: 'Your browser does not support camera/microphone access.',
      };
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video'
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream };
    } catch (err: any) {
      callLog('PERMISSION_ERROR', err?.name, { message: err?.message });

      let permissionError: string;
      switch (err?.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          permissionError = callType === 'video'
            ? '🎥 Camera and microphone permission denied. Please allow access in browser settings.'
            : '🎤 Microphone permission denied. Please allow access in browser settings.';
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          permissionError = callType === 'video'
            ? '📷 No camera or microphone found.'
            : '🎤 No microphone found.';
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          permissionError = '🎤 Microphone or camera is in use by another app.';
          break;
        default:
          permissionError = `⚠️ Could not access ${callType === 'video' ? 'camera/microphone' : 'microphone'}.`;
      }

      return { stream: new MediaStream(), permissionError };
    }
  }

  private createCanvasMockStream(callType: CallType): MediaStream {
    const stream = new MediaStream();

    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          const dst = ctx.createMediaStreamDestination();
          osc.frequency.value = 440;
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          dst.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        } catch (e) {}
      }
    }

    if (callType === 'video') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let angle = 0;
        const renderMockVideo = () => {
          ctx.fillStyle = '#0b0f19';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#6366f1';
          ctx.beginPath();
          ctx.arc(320 + Math.cos(angle) * 80, 180 + Math.sin(angle) * 40, 45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠ Camera Unavailable', 320, 340);
          angle += 0.04;
        };
        this.canvasIntervalId = setInterval(renderMockVideo, 1000 / 30);
        const canvasStream = canvas.captureStream(30);
        canvasStream.getVideoTracks().forEach((track) => stream.addTrack(track));
      }
    }

    return stream;
  }

  private createPeerConnection(
    callId: string,
    callerId: string,
    callerName: string,
    calleeId: string,
    calleeName: string,
    callType: CallType
  ): RTCPeerConnection {
    const iceServers = buildIceServers();
    let pc: RTCPeerConnection;

    try {
      pc = new RTCPeerConnection({ iceServers });
    } catch (err: any) {
      const defaultStunServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];
      pc = new RTCPeerConnection({ iceServers: defaultStunServers });
    }

    this.peerStream = new MediaStream();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callLog('ICE_CANDIDATE_SENT');
        this.sendSignalingPayload({
          callId,
          eventType: 'ICE_CANDIDATE',
          callerId,
          callerName,
          calleeId,
          calleeName,
          callType,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      callLog('CONNECTION_STATE_CHANGED', `ontrack kind=${event.track.kind}`);
      if (!this.peerStream) this.peerStream = new MediaStream();
      this.peerStream.addTrack(event.track);
      const updatedStream = new MediaStream(this.peerStream.getTracks());
      useCallStore.getState().setRemoteStream(updatedStream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      callLog('CONNECTION_STATE_CHANGED', state);
      if (state === 'connected') {
        callLog('CONNECTION_ESTABLISHED', 'Direct/Relayed WebRTC connection active.');
      }
    };

    this.peerConnection = pc;
    return pc;
  }

  /**
   * Initiate an outgoing voice or video call scoped to active Universe.
   */
  async startCall(
    callType: CallType,
    callerId?: string,
    callerName?: string,
    calleeId?: string,
    calleeName?: string
  ) {
    const store = useCallStore.getState();
    const expState = useExperienceStore.getState();
    const activeUni = expState.activeUniverse;
    const activeMem = expState.activeMembership;
    const currentProf = expState.currentProfile;

    if (!activeUni) {
      alert('Cannot start call: No active Universe selected.');
      return;
    }

    if (activeMem?.role === 'guest') {
      alert('Permission denied: Guests cannot initiate calls.');
      return;
    }

    if (store.status !== 'idle' && store.status !== 'ended') {
      return;
    }

    const actualCallerId = callerId || currentProf?.id || expState.userId || '';
    const actualCallerName = callerName || currentProf?.display_name || 'Traveler';
    const actualCalleeId = calleeId || '';
    const actualCalleeName = calleeName || 'Member';

    const fallbackUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000';
    let callSessionId: string = fallbackUuid;

    // Create database call_sessions row
    if (supabase && actualCallerId) {
      try {
        const { data: sessionRow, error: sessionErr } = await supabase
          .from('call_sessions')
          .insert({
            universe_id: activeUni.id,
            host_id: actualCallerId,
            call_type: callType,
            status: 'initiated',
          })
          .select('id')
          .single();

        if (!sessionErr && sessionRow?.id) {
          callSessionId = sessionRow.id;

          // Create host participant row
          await supabase.from('call_participants').insert({
            call_session_id: callSessionId,
            universe_id: activeUni.id,
            user_id: actualCallerId,
          });
        }
      } catch (err) {
        console.warn('[Call Service] Database call session insert notice:', err);
      }
    }

    this.activeCallId = callSessionId;
    this.activeUniverseId = activeUni.id;

    this.ensureUniverseCallListener(activeUni.id);
    this.ensureSupabaseSignaling(activeUni.id, callSessionId);

    callLog('CALL_CREATED', `callId=${callSessionId} universe=${activeUni.id}`);
    store.startOutgoingCall(callSessionId, callType, actualCallerId, actualCallerName, actualCalleeId, actualCalleeName);
    store.clearPermissionError();

    this.iceCandidateQueue = [];
    this.remoteDescriptionSet = false;
    this.peerStream = null;

    try {
      const { stream: localStream, permissionError } = await this.getMediaStream(callType);
      store.setLocalStream(localStream);

      if (permissionError) {
        store.setPermissionError(permissionError);
      }

      const pc = this.createPeerConnection(callSessionId, actualCallerId, actualCallerName, actualCalleeId, actualCalleeName, callType);

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callLog('OFFER_CREATED', `callId=${callSessionId}`);

      this.sendSignalingPayload({
        callId: callSessionId,
        eventType: 'CALL_OFFER',
        callerId: actualCallerId,
        callerName: actualCallerName,
        calleeId: actualCalleeId,
        calleeName: actualCalleeName,
        callType,
        sdp: offer,
      });

      startRingtone();
      this.startCallTimeout(callSessionId, actualCallerName, actualCalleeName, callType);

    } catch (err) {
      console.error('[Call Service] startCall error:', err);
      this.cleanup();
      store.endCall();
    }
  }

  /**
   * Accept an incoming call.
   */
  async acceptCall() {
    const store = useCallStore.getState();
    const { callId, callType, callerId, callerName, calleeId, calleeName } = store;
    const activeUni = useExperienceStore.getState().activeUniverse;

    if (!callId) return;

    const offerObj = this.pendingOffer || store.pendingOffer;
    if (!offerObj || !offerObj.sdp) {
      console.warn('[Call Service] Cannot accept call: missing pending SDP offer.');
      this.cleanup();
      store.endCall();
      return;
    }

    callLog('CALL_ACCEPTED', `callId=${callId}`);
    stopRingtone();
    store.clearPermissionError();
    useNotificationStore.getState().clearCallNotifications();

    const sdpToAccept = offerObj.sdp;
    this.pendingOffer = null;

    this.iceCandidateQueue = [];
    this.remoteDescriptionSet = false;
    this.peerStream = null;

    // Join participant row in database
    const myUserId = this.getMySenderId();
    if (supabase && activeUni && myUserId) {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(myUserId);
      if (isValidUuid) {
        try {
          await supabase.from('call_participants').insert({
            call_session_id: callId,
            universe_id: activeUni.id,
            user_id: myUserId,
          });
        } catch (err) {}
      }
    }

    try {
      const { stream: localStream, permissionError } = await this.getMediaStream(callType);
      store.setLocalStream(localStream);

      if (permissionError) {
        store.setPermissionError(permissionError);
      }

      const pc = this.createPeerConnection(callId, callerId, callerName, calleeId, calleeName, callType);

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(sdpToAccept));
      this.remoteDescriptionSet = true;
      await this.flushIceCandidateQueue();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      store.acceptCall();
      this.startCallTimer();
      this.updateCallSessionStatus('connected');

      this.sendSignalingPayload({
        callId,
        eventType: 'CALL_ANSWER',
        callerId,
        callerName,
        calleeId,
        calleeName,
        callType,
        sdp: answer,
      });

    } catch (err) {
      console.error('[Call Service] acceptCall error:', err);
      this.cleanup();
      store.endCall();
      this.updateCallSessionStatus('ended');
    }
  }

  async startEchoTestCall() {
    stopRingtone();
    playCallAnswerTone();

    const store = useCallStore.getState();
    const { callType } = store;
    store.clearPermissionError();

    try {
      const { stream: localStream } = await this.getMediaStream(callType);
      store.setLocalStream(localStream);
      const echoStream = new MediaStream(localStream.getTracks());
      store.setRemoteStream(echoStream);
      store.acceptCall();
      this.startCallTimer();
    } catch (e) {}
  }

  declineCall() {
    callLog('CALL_REJECTED', 'user declined');

    try {
      stopRingtone();
      playCallEndTone();

      const store = useCallStore.getState();
      const { callId, callType, callerId, callerName, calleeId, calleeName } = store;

      if (callId) {
        this.sendSignalingPayload({
          callId,
          eventType: 'CALL_DECLINE',
          callerId,
          callerName,
          calleeId,
          calleeName,
          callType,
        });
      }
    } catch (e) {
    } finally {
      this.updateCallSessionStatus('declined');
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  hangupCall() {
    callLog('CALL_ENDED', 'local hangup');

    try {
      stopRingtone();
      playCallEndTone();

      const store = useCallStore.getState();
      const { callId, callType, callerId, callerName, calleeId, calleeName } = store;

      if (callId) {
        this.sendSignalingPayload({
          callId,
          eventType: 'CALL_END',
          callerId,
          callerName,
          calleeId,
          calleeName,
          callType,
        });
      }
    } catch (e) {
    } finally {
      this.updateCallSessionStatus('ended');
      this.cleanup();
      useCallStore.getState().endCall();
    }
  }

  private async updateCallSessionStatus(status: 'connected' | 'ended' | 'declined' | 'missed') {
    if (!supabase || !this.activeCallId || !this.activeUniverseId) return;

    // Validate that activeCallId is a valid UUID format before sending REST request
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.activeCallId);
    if (!isUuid) return;

    try {
      const duration = useCallStore.getState().duration;
      await supabase
        .from('call_sessions')
        .update({
          status,
          ended_at: status === 'ended' || status === 'declined' || status === 'missed' ? new Date().toISOString() : undefined,
          duration_seconds: duration,
        })
        .eq('id', this.activeCallId)
        .eq('universe_id', this.activeUniverseId);
    } catch (e) {}
  }

  toggleMute() {
    const store = useCallStore.getState();
    store.toggleMute();
    const { callId, callType, callerId, callerName, calleeId, calleeName, isMuted } = store;

    if (callId) {
      this.sendSignalingPayload({
        callId,
        eventType: 'CALL_MUTE_TOGGLE',
        callerId,
        callerName,
        calleeId,
        calleeName,
        callType,
        isMuted,
      });
    }
  }

  toggleVideo() {
    const store = useCallStore.getState();
    store.toggleVideo();
    const { callId, callType, callerId, callerName, calleeId, calleeName, isVideoOff } = store;

    if (callId) {
      this.sendSignalingPayload({
        callId,
        eventType: 'CALL_VIDEO_TOGGLE',
        callerId,
        callerName,
        calleeId,
        calleeName,
        callType,
        isVideoOff,
      });
    }
  }

  private startCallTimer() {
    this.stopCallTimer();
    this.callTimer = setInterval(() => {
      useCallStore.getState().incrementDuration();
    }, 1000);
  }

  private stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  private startCallTimeout(callId: string, callerName: string, calleeName: string, callType: CallType) {
    this.clearCallTimeout();
    this.callTimeoutId = setTimeout(() => {
      const store = useCallStore.getState();
      if (store.status === 'calling' && store.callId === callId) {
        callLog('CALL_TIMEOUT', `callId=${callId}`);
        this.sendSignalingPayload({
          callId,
          eventType: 'CALL_END',
          callerId: this.getMySenderId(),
          callerName,
          calleeId: store.calleeId,
          calleeName,
          callType,
        });
        stopRingtone();
        playCallEndTone();
        this.updateCallSessionStatus('missed');
        this.cleanup();
        store.endCall();
      }
    }, CALL_TIMEOUT_MS);
  }

  private clearCallTimeout() {
    if (this.callTimeoutId) {
      clearTimeout(this.callTimeoutId);
      this.callTimeoutId = null;
    }
  }

  private cleanup() {
    this.stopCallTimer();
    this.clearCallTimeout();

    if (this.canvasIntervalId) {
      clearInterval(this.canvasIntervalId);
      this.canvasIntervalId = null;
    }

    this.disconnectSupabaseSignaling();

    this.pendingOffer = null;
    this.activeCallId = null;
    this.activeUniverseId = null;
    this.iceCandidateQueue = [];
    this.remoteDescriptionSet = false;
    this.peerStream = null;

    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export const callService = new CallService();
