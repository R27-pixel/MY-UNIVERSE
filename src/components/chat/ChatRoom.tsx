import { useState, useRef, useEffect, useCallback } from 'react';
import { useExperienceStore } from '../../stores/experienceStore';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  supabase,
  fetchConversations,
  fetchV2Messages,
  markV2MessagesAsRead,
  sendV2Message,
  subscribeToV2Messages,
  fetchProfile,
  uploadUniverseMedia,
} from '../../services/supabase/SupabaseService';
import { callService } from '../../services/callService';
import { InviteModal } from '../authoring/InviteModal';
import type { V2Message, Profile } from '../../types';
import './ChatRoom.css';

/**
 * ChatRoom — Multi-tenant real-time messaging interface.
 * Scoped by activeUniverse.id and conversation_id.
 * Features: Reply-to-message, Emoji Picker, Voice Notes Recording, Photo & Video attachments, Guest Read-Only Mode.
 */

interface ReplyTarget {
  id: string;
  senderName: string;
  text: string;
}

const EMOJI_LIST = [
  '❤️', '✨', '🥺', '😂', '🌌', '🪐', '💫', '💖', '🌸', '🥂',
  '🙏', '💬', '💭', '🔥', '👑', '🥳', '🥹', '😭', '🤍', '💙',
  '🫂', '💌', '📷', '🎯', '🚀', '🌟', '🎈', '☕', '🌺', '😊'
];

export function ChatRoom() {
  const setPhase = useExperienceStore((s) => s.setPhase);
  const activeUniverse = useExperienceStore((s) => s.activeUniverse);
  const currentProfile = useExperienceStore((s) => s.currentProfile);
  const activeMembership = useExperienceStore((s) => s.activeMembership);
  const markChatUnlocked = useExperienceStore((s) => s.markChatUnlocked);

  const isGuest = activeMembership?.role === 'guest';
  const myUserId = useExperienceStore((s) => s.currentProfile?.id || s.userId || '');

  // Conversations state
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Messages & Profiles state
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});

  // Input & UI state
  const [input, setInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isAdminOrOwner = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';

  // Typing state
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<any>(null);

  // Realtime Typing Broadcast Subscription
  useEffect(() => {
    if (!supabase || !activeUniverse) return;
    const channelTopic = `universe:${activeUniverse.id}:chat:typing`;
    const channel = supabase.channel(channelTopic, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, (evt: any) => {
        const payload = evt?.payload || evt;
        if (payload?.senderId && payload.senderId !== myUserId) {
          setIsOtherUserTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherUserTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase?.removeChannel(channel);
    };
  }, [activeUniverse, myUserId]);

  const broadcastTyping = () => {
    if (typingChannelRef.current && myUserId) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: myUserId },
      }).catch(() => {});
    }
  };

  // Audio Playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mobile Touch Swipe-to-Reply state
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    markChatUnlocked();
  }, [markChatUnlocked]);

  // Profile Lookup Helper with local cache
  const resolveProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      if (profilesCache[userId]) return profilesCache[userId];
      if (currentProfile && currentProfile.id === userId) {
        setProfilesCache((prev) => ({ ...prev, [userId]: currentProfile }));
        return currentProfile;
      }
      try {
        const p = await fetchProfile(userId);
        if (p) {
          setProfilesCache((prev) => ({ ...prev, [userId]: p }));
        }
        return p;
      } catch (err) {
        return null;
      }
    },
    [profilesCache, currentProfile]
  );

  // 1. Fetch Conversations for active Universe
  useEffect(() => {
    if (!activeUniverse) return;
    fetchConversations(activeUniverse.id)
      .then((convs) => {
        setConversations(convs);
        if (convs.length > 0 && !activeConversationId) {
          setActiveConversationId(convs[0].id);
        }
      })
      .catch((err) => {
        console.error('[ChatRoom] Error fetching conversations:', err);
      });
  }, [activeUniverse, activeConversationId]);

  // 2. Fetch Messages & Subscribe to Realtime for activeUniverse + activeConversationId
  useEffect(() => {
    if (!activeUniverse || !activeConversationId) return;

    const loadMessagesAndProfiles = async () => {
      try {
        const fetchedMsgs = await fetchV2Messages(activeUniverse.id, activeConversationId);
        setMessages(fetchedMsgs);

        // Batch fetch sender profiles
        const uniqueSenderIds = Array.from(new Set(fetchedMsgs.map((m) => m.sender_id)));
        for (const sid of uniqueSenderIds) {
          resolveProfile(sid);
        }

        // Auto-mark incoming unread messages as read
        if (!isGuest && myUserId) {
          const hasUnreadFromOthers = fetchedMsgs.some((m) => m.sender_id !== myUserId && !m.is_read);
          if (hasUnreadFromOthers) {
            markV2MessagesAsRead(activeUniverse.id, activeConversationId);
          }
        }
      } catch (err: any) {
        console.error('[ChatRoom] Error fetching messages:', err);
      }
    };

    // Initial message load
    loadMessagesAndProfiles();

    // Subscribe to Realtime CDC updates
    const unsubscribe = subscribeToV2Messages(activeUniverse.id, activeConversationId, (incomingMsg) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === incomingMsg.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = incomingMsg;
          return updated;
        }
        return [...prev, incomingMsg];
      });

      if (incomingMsg.sender_id) {
        resolveProfile(incomingMsg.sender_id);
      }

      // Auto-mark incoming unread messages as read
      if (!isGuest && myUserId && incomingMsg.sender_id !== myUserId && !incomingMsg.is_read) {
        markV2MessagesAsRead(activeUniverse.id, activeConversationId);
      }
    });

    // Mobile visibility catch-up sync
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMessagesAndProfiles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [activeUniverse, activeConversationId, resolveProfile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherUserTyping, scrollToBottom]);

  // Send Message Handler
  const handleSendMessage = async (content: string, type: 'text' | 'image' | 'video' | 'audio' = 'text', mediaUrl?: string) => {
    if (!activeUniverse || !activeConversationId || isGuest) return;

    const currentReplyId = replyTarget ? replyTarget.id : undefined;

    setInput('');
    setReplyTarget(null);
    setShowEmojiPicker(false);
    inputRef.current?.focus();

    try {
      const sent = await sendV2Message(
        activeUniverse.id,
        activeConversationId,
        content,
        type,
        mediaUrl,
        currentReplyId
      );

      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (err: any) {
      console.error('[ChatRoom] Error sending message:', err);
      alert('Failed to send message: ' + (err?.message || 'Permission denied'));
    }
  };

  const handleSendText = () => {
    const text = input.trim();
    if (!text) return;
    handleSendMessage(text, 'text');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const initiateReply = (msg: V2Message) => {
    if (msg.message_type === 'system') return;
    const senderName = profilesCache[msg.sender_id]?.display_name || 'Member';
    const displayText = msg.message_type === 'audio'
      ? '🎤 Voice Note'
      : msg.message_type === 'image'
      ? '📷 Photo'
      : msg.message_type === 'video'
      ? '🎥 Video'
      : msg.content;

    setReplyTarget({
      id: msg.id,
      senderName,
      text: displayText.length > 60 ? displayText.slice(0, 60) + '...' : displayText,
    });
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
    inputRef.current?.focus();
  };

  // Touch Swipe Right & Long-Press Handlers for Mobile
  const handleTouchStart = (msg: V2Message, e: React.TouchEvent) => {
    if (msg.message_type === 'system') return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipingId(msg.id);
    setSwipeOffset(0);

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      initiateReply(msg);
      setSwipingId(null);
      setSwipeOffset(0);
    }, 450);
  };

  const handleTouchMove = (msg: V2Message, e: React.TouchEvent) => {
    if (swipingId !== msg.id) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    if (Math.abs(diffY) > 8 || Math.abs(diffX) > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (diffX > 0 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      setSwipeOffset(Math.min(diffX, 80));
    }
  };

  const handleTouchEnd = (msg: V2Message) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (swipingId === msg.id && swipeOffset > 35) {
      initiateReply(msg);
    }
    setSwipingId(null);
    setSwipeOffset(0);
  };

  // File Attachment (Photo / Video) Selection Handler via v2 Storage
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUniverse || isGuest) return;

    setIsUploading(true);
    try {
      const { publicUrl, storagePath } = await uploadUniverseMedia(activeUniverse.id, null, file);
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const type = isVideo ? 'video' : isAudio ? 'audio' : 'image';

      await handleSendMessage(file.name, type, publicUrl || storagePath);
    } catch (err: any) {
      console.error('[ChatRoom] File upload error:', err);
      alert('Failed to upload attachment: ' + (err?.message || 'Permission denied'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Voice Recording Handlers
  const startRecording = async () => {
    if (isGuest) return;

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Microphone access required for voice messages.');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const supportedMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mimeType = supportedMimeTypes.find((t) => MediaRecorder.isTypeSupported(t));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || 'audio/webm',
          });
          const extension = audioBlob.type.includes('mp4')
            ? 'mp4'
            : audioBlob.type.includes('ogg')
            ? 'ogg'
            : 'webm';
          const file = new File([audioBlob], `voice_note_${Date.now()}.${extension}`, { type: audioBlob.type });
          if (activeUniverse) {
            const { publicUrl, storagePath } = await uploadUniverseMedia(activeUniverse.id, null, file);
            await handleSendMessage('🎤 Voice Note', 'audio', publicUrl || storagePath);
          }
        } catch (e) {
          console.error('Voice note upload error:', e);
        } finally {
          stream?.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.onerror = (evt) => {
        console.error('[MediaRecorder Runtime Error]', evt);
        cancelRecording();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[Voice Recording Notice]', err?.message || err);
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      setIsRecording(false);
      mediaRecorderRef.current = null;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      alert('Microphone access required for voice messages.');
    }
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[Stop Recording Notice]', e);
      }
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
      } catch (e) {
        console.warn('[Cancel Recording Notice]', e);
      }
      mediaRecorderRef.current = null;
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Media URL Resolver, Normalizer & Validator
  const normalizeAudioUrl = (src: string): string => {
    const trimmed = src.trim();

    if (!trimmed.startsWith('data:audio/')) {
      return trimmed;
    }

    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) {
      return trimmed;
    }

    const header = trimmed.slice(0, commaIndex);
    const payload = trimmed.slice(commaIndex + 1);

    // Keep the actual container MIME type but remove codec parameters.
    const mime = header.replace(/^data:/, '').split(';')[0];

    return `data:${mime};base64,${payload}`;
  };

  const resolveMediaUrl = (src?: string): string => {
    if (!src) return '';
    const trimmed = src.trim();

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }

    if (supabase && (trimmed.includes('/') || trimmed.length > 10)) {
      const { data } = supabase.storage.from('universe_media').getPublicUrl(trimmed);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }

    return trimmed;
  };

  const isValidMediaUrl = (src?: string): boolean => {
    if (!src) return false;
    const resolved = resolveMediaUrl(src);
    return (
      resolved.startsWith('http://') ||
      resolved.startsWith('https://') ||
      resolved.startsWith('data:') ||
      resolved.startsWith('blob:')
    );
  };

  const isValidAudioUrl = (src?: string): boolean => {
    if (!src) return false;
    return isValidMediaUrl(src);
  };

  const toggleAudioPlayback = (id: string, rawUrl?: string) => {
    const resolved = resolveMediaUrl(rawUrl);
    const url = normalizeAudioUrl(resolved);

    const testAudio = document.createElement('audio');
    console.log('[AUDIO CAPABILITY DEBUG]', {
      webm: testAudio.canPlayType('audio/webm'),
      opus: testAudio.canPlayType('audio/webm; codecs="opus"'),
      mp4: testAudio.canPlayType('audio/mp4'),
      ogg: testAudio.canPlayType('audio/ogg'),
    });

    console.log('[AUDIO DEBUG]', {
      rawUrl,
      resolved,
      normalized: url,
      isDataUri: url.startsWith('data:'),
      mime: url.startsWith('data:')
        ? url.slice(5, url.indexOf(','))
        : 'remote',
      length: url.length,
    });

    if (!url || !isValidAudioUrl(url)) {
      alert('Voice note audio source unavailable for legacy text entry.');
      return;
    }

    if (playingAudioId === id) {
      currentAudioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.preload = 'auto';
      currentAudioRef.current = audio;
      audio
        .play()
        .then(() => {
          setPlayingAudioId(id);
        })
        .catch((error) => {
          console.warn('[Chat Audio Playback Notice]', error);
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          setPlayingAudioId(null);
          useNotificationStore.getState().addNotification({
            title: 'Audio Notice 🎤',
            body: 'Unable to stream audio. Source link may be restricted or unavailable.',
            type: 'system',
          });
        });
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => {
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        setPlayingAudioId(null);
      };
    }
  };

  if (!activeUniverse) {
    return (
      <div className="chat">
        <div className="chat__header">
          <span className="chat__header-name">No Active Universe</span>
          <button className="chat__back-btn" onClick={() => setPhase('UNIVERSE')}>‹ Return</button>
        </div>
        <div className="chat__messages custom-scrollbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
          Please select or join a Universe to access private channels.
        </div>
      </div>
    );
  }

  return (
    <div className="chat">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Photo Lightbox Modal */}
      {previewPhotoUrl && (
        <div className="chat__lightbox" onClick={() => setPreviewPhotoUrl(null)}>
          <div className="chat__lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhotoUrl} alt="Enlarged preview" />
            <button className="chat__lightbox-close" onClick={() => setPreviewPhotoUrl(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat__header">
        <div className="chat__header-info">
          <div className="chat__header-avatar">
            <span className="chat__online-dot" />
          </div>
          <div className="chat__header-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="chat__header-name">{activeUniverse.title}</span>
              {conversations.length > 1 && (
                <select
                  value={activeConversationId || ''}
                  onChange={(e) => setActiveConversationId(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', color: '#4fc3f7', border: '1px solid rgba(79,195,247,0.3)', borderRadius: '6px', fontSize: '0.75rem', padding: '2px 6px' }}
                >
                  {conversations.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
            </div>
            <span className={`chat__header-status ${isOtherUserTyping ? 'chat__header-status--typing' : ''}`}>
              {isOtherUserTyping ? '✦ SOMEONE IS TYPING...' : isGuest ? 'READ-ONLY (GUEST ROLE)' : 'ENCRYPTED • MULTI-TENANT'}
            </span>
          </div>
        </div>

        <div className="chat__header-meta">
          {isAdminOrOwner && (
            <button
              className="chat__call-btn"
              onClick={() => setShowInviteModal(true)}
              title="Generate Invitation Link"
              style={{ background: 'rgba(168, 85, 247, 0.25)', borderColor: 'rgba(168, 85, 247, 0.5)' }}
            >
              <span>💌 Invite</span>
            </button>
          )}

          {!isGuest && (
            <>
              <button
                className="chat__call-btn"
                onClick={() => callService.startCall('audio')}
                title="Start Voice Call"
              >
                <span>📞 Voice Call</span>
              </button>
              <button
                className="chat__call-btn"
                onClick={() => callService.startCall('video')}
                title="Start Video Call"
              >
                <span>📹 Video Call</span>
              </button>
            </>
          )}
          <button className="chat__back-btn" onClick={() => setPhase('UNIVERSE')}>
            ‹ Return to Universe
          </button>
          <button
            className="chat__back-btn"
            onClick={() => useExperienceStore.getState().signOut()}
            title="Sign out"
          >
            🚪 Log Out
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat__messages custom-scrollbar">
        {messages.map((msg, i) => {
          const isMySentMessage = currentProfile ? msg.sender_id === currentProfile.id : false;
          const isSystem = msg.message_type === 'system';
          const isSwipingThis = swipingId === msg.id;
          const senderProfile = profilesCache[msg.sender_id];
          const senderDisplayName = senderProfile?.display_name || (isMySentMessage ? 'You' : 'Member');

          return (
            <div
              key={msg.id}
              className={`chat__message ${
                isSystem
                  ? 'chat__message--system'
                  : isMySentMessage
                  ? 'chat__message--me'
                  : 'chat__message--received'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              {isSystem ? (
                <div className="chat__message-system">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>{msg.content}</span>
                </div>
              ) : (
                <div
                  className="chat__message-wrapper"
                  onTouchStart={(e) => handleTouchStart(msg, e)}
                  onTouchMove={(e) => handleTouchMove(msg, e)}
                  onTouchEnd={() => handleTouchEnd(msg)}
                  style={{
                    transform: isSwipingThis ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                    transition: isSwipingThis ? 'none' : 'transform 0.25s ease-out',
                  }}
                >
                  {/* Swipe reply indicator */}
                  {isSwipingThis && swipeOffset > 15 && (
                    <div className="chat__swipe-reply-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </div>
                  )}

                  <div className="chat__message-bubble" onDoubleClick={() => initiateReply(msg)}>
                    {/* Sender Name Header */}
                    {!isMySentMessage && (
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#4fc3f7', marginBottom: '4px' }}>
                        {senderDisplayName}
                      </div>
                    )}

                    {/* PHOTO MESSAGE */}
                    {msg.message_type === 'image' && (
                      <div className="chat__media-photo-box">
                        {isValidMediaUrl(msg.media_url || msg.content) ? (
                          <img
                            src={resolveMediaUrl(msg.media_url || msg.content)}
                            alt="Shared photo"
                            className="chat__media-photo"
                            onClick={() => setPreviewPhotoUrl(resolveMediaUrl(msg.media_url || msg.content))}
                          />
                        ) : (
                          <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#aaa' }}>
                            📷 {msg.content || 'Photo Attachment'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* VIDEO MESSAGE */}
                    {msg.message_type === 'video' && (
                      <div className="chat__media-video-box">
                        {isValidMediaUrl(msg.media_url || msg.content) ? (
                          <video
                            src={resolveMediaUrl(msg.media_url || msg.content)}
                            controls
                            playsInline
                            className="chat__media-video"
                          />
                        ) : (
                          <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#aaa' }}>
                            🎥 {msg.content || 'Video Attachment'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AUDIO / VOICE NOTE MESSAGE */}
                    {msg.message_type === 'audio' && (
                      <div className="chat__audio-pill">
                        {isValidAudioUrl(msg.media_url || msg.content) ? (
                          <>
                            <button
                              type="button"
                              className="chat__audio-play-btn"
                              onClick={() => toggleAudioPlayback(msg.id, msg.media_url || msg.content)}
                            >
                              {playingAudioId === msg.id ? '⏸' : '▶'}
                            </button>
                            <div className="chat__audio-waves">
                              <span className={`chat__audio-wave-bar ${playingAudioId === msg.id ? 'chat__audio-wave-bar--anim' : ''}`} />
                              <span className={`chat__audio-wave-bar ${playingAudioId === msg.id ? 'chat__audio-wave-bar--anim' : ''}`} />
                              <span className={`chat__audio-wave-bar ${playingAudioId === msg.id ? 'chat__audio-wave-bar--anim' : ''}`} />
                            </div>
                            <span className="chat__audio-label">Voice Note</span>
                          </>
                        ) : (
                          <span className="chat__audio-label" style={{ opacity: 0.6 }}>🎤 Voice Note (Legacy Text)</span>
                        )}
                      </div>
                    )}

                    {/* TEXT CONTENT */}
                    {msg.content && msg.message_type !== 'audio' && msg.message_type !== 'image' && msg.message_type !== 'video' && (
                      <span className="chat__message-text">{msg.content}</span>
                    )}

                    <div className="chat__message-meta">
                      <span className="chat__message-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMySentMessage && (
                        <span className={`chat__message-read ${msg.is_read ? 'chat__message-read--read' : ''}`}>
                          ✓✓
                        </span>
                      )}
                    </div>

                    {/* Desktop Hover Reply Button */}
                    {!isGuest && (
                      <button
                        type="button"
                        className="chat__message-reply-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          initiateReply(msg);
                        }}
                        title="Reply to this message"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 17 4 12 9 7" />
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isOtherUserTyping && (
          <div className="chat__message chat__message--received chat__message--typing">
            <div className="chat__message-wrapper">
              <div className="chat__message-bubble chat__typing-bubble" title="Typing message...">
                <span className="chat__typing-dot" />
                <span className="chat__typing-dot" />
                <span className="chat__typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker Drawer */}
      {showEmojiPicker && !isGuest && (
        <div className="chat__emoji-picker">
          <div className="chat__emoji-grid">
            {EMOJI_LIST.map((emoji, i) => (
              <button
                key={i}
                type="button"
                className="chat__emoji-item"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Note Recording Bar */}
      {isRecording && !isGuest && (
        <div className="chat__recording-bar">
          <div className="chat__recording-status">
            <span className="chat__recording-dot" />
            <span className="chat__recording-time">{formatRecordingTime(recordingTime)}</span>
            <span className="chat__recording-label">Recording Voice Note...</span>
          </div>
          <div className="chat__recording-actions">
            <button type="button" className="chat__rec-btn chat__rec-btn--cancel" onClick={cancelRecording} title="Cancel Recording">
              ✕
            </button>
            <button type="button" className="chat__rec-btn chat__rec-btn--send" onClick={stopAndSendRecording} title="Send Voice Note">
              ✓
            </button>
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyTarget && !isRecording && !isGuest && (
        <div className="chat__reply-bar">
          <div className="chat__reply-bar-content">
            <div className="chat__reply-bar-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 17 4 12 9 7" />
                <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
              </svg>
              <span>Replying to <strong>{replyTarget.senderName}</strong></span>
            </div>
            <span className="chat__reply-bar-text">{replyTarget.text}</span>
          </div>
          <button
            type="button"
            className="chat__reply-bar-close"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {/* Guest Mode Notice */}
      {isGuest && (
        <div style={{ padding: '16px', background: 'rgba(0,0,0,0.4)', textAlign: 'center', color: '#aaa', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          🔒 Read-Only Channel — Guest members cannot send messages.
        </div>
      )}

      {/* Input Container */}
      {!isRecording && !isGuest && (
        <div className="chat__input-container">
          <div className="chat__input-wrapper">
            {/* Attachment Button */}
            <button
              type="button"
              className="chat__attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach Photo or Video"
            >
              {isUploading ? '⌛' : '📎'}
            </button>

            {/* Emoji Toggle Button */}
            <button
              type="button"
              className={`chat__emoji-toggle ${showEmojiPicker ? 'chat__emoji-toggle--active' : ''}`}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Choose Emoji"
            >
              😊
            </button>

            <textarea
              ref={inputRef}
              className="chat__input"
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                broadcastTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder={replyTarget ? `Reply to ${replyTarget.senderName}...` : "Write something..."}
              rows={1}
              maxLength={2000}
              autoFocus
            />

            {/* Microphone Voice Note Button */}
            {!input.trim() && (
              <button
                type="button"
                className="chat__mic-btn"
                onClick={startRecording}
                title="Record Voice Note"
              >
                🎤
              </button>
            )}

            {/* Send Button */}
            {input.trim() && (
              <button
                className="chat__send chat__send--active"
                onClick={handleSendText}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
          <div className="chat__input-hint">
            <span>press enter to send • 📎 photo/video • 🎤 hold mic for voice note</span>
          </div>
        </div>
      )}

      {/* Creator / Admin Invitation Modal */}
      {showInviteModal && isAdminOrOwner && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
