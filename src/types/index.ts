/* ─────────────────────────────────────────
   Experience Phase Types
   ───────────────────────────────────────── */

export type ExperiencePhase =
  | 'LOADING'
  | 'OPENING'
  | 'BIGBANG'
  | 'UNIVERSE'
  | 'MEMORY'
  | 'ARCHIVE'
  | 'LETTER'
  | 'FINAL'
  | 'YES_PATH'
  | 'NO_PATH'
  | 'FORGIVE'
  | 'NO_FORGIVE'
  | 'CHAT'
  | 'ENDED'
  | 'WELCOME_BACK'
  | 'HIDDEN_GAME';

/* ─────────────────────────────────────────
   Memory Types
   ───────────────────────────────────────── */

export type MemoryType =
  | 'photo'
  | 'text'
  | 'message'
  | 'location'
  | 'audio'
  | 'video'
  | 'letter'
  | 'mixed';

export type CelestialType =
  | 'star'
  | 'planet'
  | 'portal'
  | 'fragment'
  | 'capsule'
  | 'constellation'
  | 'nebula'
  | 'mystery';

export type AnimationStyle =
  | 'pulse'
  | 'orbit'
  | 'float'
  | 'spin'
  | 'breathe';

export interface MemoryMessage {
  sender: string;
  text: string;
  time: string;
}

export interface MemoryLocation {
  name: string;
  lat?: number;
  lng?: number;
}

export interface UnlockCondition {
  type: 'discoveredCount' | 'memoryId' | 'always';
  value: number | string;
}

export interface Memory {
  id: string;
  starId?: string;
  type: MemoryType;
  title: string;
  date: string;
  description: string;
  image?: string;
  audio?: string;
  video?: string;
  caption?: string;
  spotifyEmbed?: string;
  messages?: MemoryMessage[];
  location?: MemoryLocation;
  color?: string;
  position: { x: number; y: number; z: number };
  celestialType: CelestialType;
  scale?: number;
  animationStyle?: AnimationStyle;
  unlockCondition?: UnlockCondition | null;
}

/* ─────────────────────────────────────────
   OUR UNIVERSE V2 MULTI-TENANT DATA CONTRACTS
   ───────────────────────────────────────── */

/** User Profile linked to Supabase auth.users */
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 3D Theme Configuration for a Universe */
export interface UniverseThemeConfig {
  colorPalette?: string;
  starGlowColor?: string;
  backgroundNebula?: boolean;
  cameraSensitivityMobile?: number;
  cameraSensitivityDesktop?: number;
  [key: string]: unknown;
}

/** Multi-tenant Universe Container */
export interface Universe {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  theme_config: UniverseThemeConfig;
  star_count: number;
  has_secret_star: boolean;
  is_private: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Role scoped per universe */
export type UniverseMemberRole = 'owner' | 'admin' | 'traveler' | 'guest';

/** Universe Membership Assignment */
export interface UniverseMember {
  universe_id: string;
  user_id: string;
  role: UniverseMemberRole;
  joined_at: string;
}

/** Hashed Token Invitation Record */
export interface UniverseInvitation {
  id: string;
  universe_id: string;
  created_by: string;
  token_hash?: string;
  assigned_role: UniverseMemberRole;
  max_uses?: number | null;
  uses_count: number;
  expires_at?: string | null;
  created_at: string;
}

/** Creation Result for Admin RPC create_universe_invitation() */
export interface UniverseInvitationResult {
  invitation_id: string;
  universe_id: string;
  raw_token: string;
  assigned_role: UniverseMemberRole;
  expires_at?: string | null;
}

/** Redemption Result for User RPC redeem_universe_invitation() */
export interface UniverseRedemptionResult {
  success: boolean;
  universe_id: string;
  assigned_role: UniverseMemberRole;
}

/** Database-backed 3D Star entity (public.stars) */
export interface Star {
  id: string;
  universe_id: string;
  star_number: number;
  name: string;
  subtitle?: string | null;
  description?: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  is_secret_star: boolean;
  created_at?: string;
}

/** Database-backed Universe Memory record (public.memories) */
export interface UniverseMemory {
  id: string;
  universe_id: string;
  star_id?: string | null;
  author_id?: string | null;
  title: string;
  content: string;
  memory_date?: string | null;
  location_name?: string | null;
  display_order: number;
  is_unlocked_by_default: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Database-backed Story sequence record (public.stories) */
export interface UniverseStory {
  id: string;
  universe_id: string;
  title: string;
  description?: string | null;
  created_at?: string;
}

/** Database-backed Story-Memory Relational Join (public.story_memories) */
export interface StoryMemory {
  story_id: string;
  memory_id: string;
  universe_id: string;
  display_order: number;
  created_at?: string;
}

/** Combined universe content payload */
export interface UniverseContentPayload {
  stars: Star[];
  memories: UniverseMemory[];
  stories: UniverseStory[];
  storyMemories: StoryMemory[];
}

/** WebRTC Active Call Session Status */
export type CallSessionStatus = 'initiated' | 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';

/** V2 WebRTC Call Session Record */
export interface V2CallSession {
  id: string;
  universe_id: string;
  host_id: string;
  call_type: CallType;
  status: CallSessionStatus;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
}

/** V2 WebRTC Call Participant Record */
export interface V2CallParticipant {
  call_session_id: string;
  universe_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string | null;
}

/** V2 Multi-Tenant Chat Message Record */
export interface V2Message {
  id: string;
  universe_id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'system';
  media_url?: string | null;
  media_asset_id?: string | null;
  reply_to_message_id?: string | null;
  is_edited: boolean;
  is_read: boolean;
  created_at: string;
}

/** Per-User Progress within a specific Universe */
export interface UserUniverseProgress {
  user_id: string;
  universe_id: string;
  discovered_star_ids: string[];
  is_experience_completed: boolean;
  is_star_13_unlocked: boolean;
  is_hidden_game_completed: boolean;
  last_visited_at?: string;
  updated_at: string;
}

/* ─────────────────────────────────────────
   Legacy Chat & User Types (Preserved for V1 Compatibility)
   ───────────────────────────────────────── */

export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'system';
  mediaUrl?: string;
  createdAt: string;
  editedAt?: string;
  reactions: MessageReaction[];
  isRead: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

export interface MessageReaction {
  id: string;
  userId: string;
  emoji: string;
}

export interface MessagePayload {
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'system';
  mediaUrl?: string;
  senderId?: string;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  createdAt: string;
}

export type PresenceStatus = 'online' | 'offline' | 'typing';

export type Unsubscribe = () => void;

/* ─────────────────────────────────────────
   Call & Notification Types
   ───────────────────────────────────────── */

export type CallType = 'audio' | 'video';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallSession {
  callId: string;
  type: CallType;
  status: CallStatus;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  startedAt?: number;
  duration: number;
}

export type CallSignalingEventType =
  | 'CALL_OFFER'
  | 'CALL_ANSWER'
  | 'ICE_CANDIDATE'
  | 'CALL_DECLINE'
  | 'CALL_END'
  | 'CALL_MUTE_TOGGLE'
  | 'CALL_VIDEO_TOGGLE';

export interface CallSignalingPayload {
  callId: string;
  eventType: CallSignalingEventType;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callType: CallType;
  senderId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'system';
  timestamp: string;
  avatarUrl?: string;
  conversationId?: string;
  callerId?: string;
  callerName?: string;
  callType?: CallType;
  read: boolean;
}

/* ─────────────────────────────────────────
   Service Interfaces
   ───────────────────────────────────────── */

export interface IChatService {
  sendMessage(conversationId: string, message: MessagePayload): Promise<Message>;
  getMessages(conversationId: string, cursor?: string): Promise<Message[]>;
  subscribeToMessages(conversationId: string, callback: (msg: Message) => void): Unsubscribe;
  markAsRead(conversationId: string, messageId: string): Promise<void>;
  markAllAsRead?(conversationId: string, myRole: string): Promise<void>;
  setTypingStatus(conversationId: string, isTyping: boolean, senderId?: string): Promise<void>;
  subscribeToPresence(userId: string, callback: (status: PresenceStatus) => void): Unsubscribe;
  subscribeToTyping(conversationId: string, callback: (data: { isTyping: boolean; senderId?: string } | boolean) => void): Unsubscribe;
}

export interface IAuthService {
  signIn(credentials: { name: string }): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  onAuthStateChange(callback: (user: User | null) => void): Unsubscribe;
}

/* ─────────────────────────────────────────
   Device / Performance
   ───────────────────────────────────────── */

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low';

export interface DeviceCapability {
  tier: QualityTier;
  isMobile: boolean;
  isTouch: boolean;
  hasWebGL2: boolean;
  maxParticles: number;
  enableBloom: boolean;
  enableDoF: boolean;
  enableGrain: boolean;
  enableAberration: boolean;
  pixelRatio: number;
}
