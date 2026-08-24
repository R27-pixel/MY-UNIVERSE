import { create } from 'zustand';
import type { CallStatus, CallType } from '../types';

export type PendingOffer = {
  callId: string;
  sdp: RTCSessionDescriptionInit;
} | null;

interface CallState {
  callId: string | null;
  status: CallStatus;
  callType: CallType;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  duration: number;

  // Peer-side mute/video state (received from signaling)
  isPeerMuted: boolean;
  isPeerVideoOff: boolean;

  // Permission error message to display in CallModal (Bug 9 fix)
  permissionError: string | null;
  pendingOffer: PendingOffer;

  // Actions
  startOutgoingCall: (
    callId: string,
    type: CallType,
    callerId: string,
    callerName: string,
    calleeId: string,
    calleeName: string
  ) => void;
  receiveIncomingCall: (
    callId: string,
    type: CallType,
    callerId: string,
    callerName: string,
    calleeId: string,
    calleeName: string,
    pendingOffer?: PendingOffer
  ) => void;
  acceptCall: () => void;
  setConnected: (localStream: MediaStream | null, remoteStream: MediaStream | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setMuted: (muted: boolean) => void;
  setVideoOff: (off: boolean) => void;
  setDuration: (duration: number) => void;
  incrementDuration: () => void;
  setPeerMuted: (muted: boolean) => void;
  setPeerVideoOff: (off: boolean) => void;
  setPermissionError: (error: string | null) => void;
  clearPermissionError: () => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  callId: null,
  status: 'idle',
  callType: 'audio',
  callerId: '',
  callerName: '',
  calleeId: '',
  calleeName: '',
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  duration: 0,
  isPeerMuted: false,
  isPeerVideoOff: false,
  permissionError: null,
  pendingOffer: null,

  startOutgoingCall: (callId, type, callerId, callerName, calleeId, calleeName) =>
    set({
      callId,
      status: 'calling',
      callType: type,
      callerId,
      callerName,
      calleeId,
      calleeName,
      isMuted: false,
      isVideoOff: type === 'audio',
      isPeerMuted: false,
      isPeerVideoOff: false,
      duration: 0,
      permissionError: null,
      pendingOffer: null,
    }),

  receiveIncomingCall: (callId, type, callerId, callerName, calleeId, calleeName, pendingOffer) =>
    set({
      callId,
      status: 'incoming',
      callType: type,
      callerId,
      callerName,
      calleeId,
      calleeName,
      isMuted: false,
      isVideoOff: type === 'audio',
      isPeerMuted: false,
      isPeerVideoOff: false,
      duration: 0,
      permissionError: null,
      pendingOffer: pendingOffer ? (pendingOffer.callId === callId ? pendingOffer : null) : null,
    }),

  acceptCall: () => set({ status: 'connected' }),

  setConnected: (localStream, remoteStream) =>
    set({
      status: 'connected',
      localStream,
      remoteStream,
    }),

  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),

  toggleMute: () =>
    set((s) => {
      const nextMuted = !s.isMuted;
      if (s.localStream) {
        s.localStream.getAudioTracks().forEach((t) => {
          t.enabled = !nextMuted;
        });
      }
      return { isMuted: nextMuted };
    }),

  toggleVideo: () =>
    set((s) => {
      const nextVideoOff = !s.isVideoOff;
      if (s.localStream) {
        s.localStream.getVideoTracks().forEach((t) => {
          t.enabled = !nextVideoOff;
        });
      }
      return { isVideoOff: nextVideoOff };
    }),

  setMuted: (muted) =>
    set((s) => {
      if (s.localStream) {
        s.localStream.getAudioTracks().forEach((t) => {
          t.enabled = !muted;
        });
      }
      return { isMuted: muted };
    }),

  setVideoOff: (off) =>
    set((s) => {
      if (s.localStream) {
        s.localStream.getVideoTracks().forEach((t) => {
          t.enabled = !off;
        });
      }
      return { isVideoOff: off };
    }),

  setDuration: (duration) => set({ duration }),
  incrementDuration: () => set((s) => ({ duration: s.duration + 1 })),

  setPeerMuted: (muted) => set({ isPeerMuted: muted }),
  setPeerVideoOff: (off) => set({ isPeerVideoOff: off }),

  setPermissionError: (error) => set({ permissionError: error }),
  clearPermissionError: () => set({ permissionError: null }),

  endCall: () =>
    set((s) => {
      // Stop all local media tracks (microphone, camera)
      if (s.localStream) {
        s.localStream.getTracks().forEach((t) => t.stop());
      }
      // Stop remote stream tracks if different from local (not echo test)
      if (s.remoteStream && s.remoteStream !== s.localStream) {
        s.remoteStream.getTracks().forEach((t) => t.stop());
      }
      return {
        callId: null,
        // Bug 7 fix: set to 'ended', NOT 'idle'. The CallModal will display the
        // "Call Ended" screen with a dismiss button. The button sets status → 'idle'.
        // Previously both endCall() AND callService forced 'idle' immediately,
        // meaning the "ended" screen was never visible.
        status: 'ended',
        localStream: null,
        remoteStream: null,
        duration: 0,
        isMuted: false,
        isVideoOff: false,
        isPeerMuted: false,
        isPeerVideoOff: false,
        permissionError: null,
        pendingOffer: null,
      };
    }),
}));
