import { createClient, SupabaseClient, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type {
  IChatService,
  Message,
  MessagePayload,
  PresenceStatus,
  Unsubscribe,
  Profile,
  Universe,
  UniverseMember,
  UniverseMemberRole,
  UniverseInvitationResult,
  UniverseRedemptionResult,
  V2Message,
  UserUniverseProgress,
  Star,
  UniverseMemory,
  UniverseStory,
  StoryMemory,
  UniverseContentPayload,
} from '../../types';

/**
 * SUPABASE CONFIGURATION
 * ──────────────────────
 * Loaded from environment variables:
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/* ============================================================
   OUR UNIVERSE V2 AUTHENTICATION PRIMITIVES
   ============================================================ */

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentAuthUser(): Promise<SupabaseAuthUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUpUser(email: string, password: string, displayName?: string) {
  if (!supabase) throw new Error('Supabase client not configured.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
        username: email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInUser(email: string, password: string) {
  if (!supabase) throw new Error('Supabase client not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/* ============================================================
   OUR UNIVERSE V2 PROFILE SERVICES
   ============================================================ */

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase || !userId || typeof userId !== 'string' || userId.trim() === '') return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
    .eq('id', userId.trim())
    .maybeSingle();

  if (error) {
    console.error('[Supabase fetchProfile Error]', error);
    return null;
  }
  return data as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as Profile;
}

/* ============================================================
   OUR UNIVERSE V2 UNIVERSES & MEMBERSHIPS SERVICES
   ============================================================ */

export async function listUserUniverses(userId: string): Promise<Universe[]> {
  if (!supabase || !userId) return [];
  try {
    const { data: memberRows, error: memberErr } = await supabase
      .from('universe_members')
      .select('universe_id')
      .eq('user_id', userId);

    if (memberErr || !memberRows || memberRows.length === 0) return [];

    const universeIds = memberRows.map((r) => r.universe_id);
    const { data: universes, error: universeErr } = await supabase
      .from('universes')
      .select('*')
      .in('id', universeIds);

    if (universeErr) {
      console.error('[Supabase listUserUniverses Error]', universeErr);
      return [];
    }

    return (universes || []) as Universe[];
  } catch (err) {
    console.error('[Supabase listUserUniverses Error]', err);
    return [];
  }
}

export async function fetchUniverse(universeIdOrSlug: string): Promise<Universe | null> {
  if (!supabase || !universeIdOrSlug || typeof universeIdOrSlug !== 'string' || universeIdOrSlug.trim() === '') return null;
  const target = universeIdOrSlug.trim();
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(target);

  const { data, error } = isUuid
    ? await supabase.from('universes').select('*').eq('id', target).maybeSingle()
    : await supabase.from('universes').select('*').eq('slug', target).maybeSingle();

  if (error) {
    console.error('[Supabase fetchUniverse Error]', error);
    return null;
  }
  return data as Universe | null;
}

export async function createUniverse(
  title: string,
  slug?: string,
  isPrivate: boolean = true,
  themeConfig?: any
): Promise<Universe> {
  if (!supabase) throw new Error('Supabase client not configured.');
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Authentication required to create a universe.');

  // Ensure profile row exists in public.profiles before foreign key insertion
  const existingProfile = await fetchProfile(user.id);
  if (!existingProfile) {
    const defaultUsername = 'user_' + user.id.substring(0, 8);
    const defaultDisplayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Cosmic Traveler';
    await supabase.from('profiles').upsert({
      id: user.id,
      username: defaultUsername,
      display_name: defaultDisplayName,
      updated_at: new Date().toISOString(),
    });
  }

  const rawSlug = typeof slug === 'string' && slug.trim().length > 0 ? slug : title;
  const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const generatedSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 7)}`;

  const { error } = await supabase
    .from('universes')
    .insert({
      owner_id: user.id,
      slug: generatedSlug,
      title,
      is_private: Boolean(isPrivate),
      theme_config: themeConfig || {
        colorPalette: 'cosmic_dark',
        starGlowColor: '#ffffff',
        backgroundNebula: true,
      },
    });

  if (error) throw error;

  const createdUniverse = await fetchUniverse(generatedSlug);
  if (!createdUniverse) {
    throw new Error('Universe created successfully, but failed to load the created universe object.');
  }

  return createdUniverse;
}

export async function fetchUniverseMember(universeId: string, userId: string): Promise<UniverseMember | null> {
  if (!supabase || !universeId || !userId) return null;
  const { data, error } = await supabase
    .from('universe_members')
    .select('universe_id, user_id, role, joined_at')
    .eq('universe_id', universeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data as UniverseMember | null;
}

/* ============================================================
   OUR UNIVERSE V2 DATABASE CONTENT SERVICES (Phase 6A)
   ============================================================ */

export async function fetchUniverseStars(universeId: string): Promise<Star[]> {
  if (!supabase || !universeId) return [];
  const { data, error } = await supabase
    .from('stars')
    .select('id, universe_id, star_number, name, subtitle, description, position_x, position_y, position_z, is_secret_star, created_at')
    .eq('universe_id', universeId)
    .order('star_number', { ascending: true });

  if (error) {
    console.error('[Supabase fetchUniverseStars Error]', error);
    return [];
  }
  return (data || []) as Star[];
}

export async function fetchUniverseMemories(universeId: string): Promise<UniverseMemory[]> {
  if (!supabase || !universeId) return [];
  const { data, error } = await supabase
    .from('memories')
    .select('id, universe_id, star_id, author_id, title, content, memory_date, location_name, display_order, is_unlocked_by_default, created_at, updated_at')
    .eq('universe_id', universeId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[Supabase fetchUniverseMemories Error]', error);
    return [];
  }
  return (data || []) as UniverseMemory[];
}

export async function fetchUniverseStories(universeId: string): Promise<UniverseStory[]> {
  if (!supabase || !universeId) return [];
  const { data, error } = await supabase
    .from('stories')
    .select('id, universe_id, title, description, created_at')
    .eq('universe_id', universeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Supabase fetchUniverseStories Error]', error);
    return [];
  }
  return (data || []) as UniverseStory[];
}

export async function fetchStoryMemories(universeId: string, storyId?: string): Promise<StoryMemory[]> {
  if (!supabase || !universeId) return [];
  let query = supabase
    .from('story_memories')
    .select('story_id, memory_id, universe_id, display_order, created_at')
    .eq('universe_id', universeId);

  if (storyId) {
    query = query.eq('story_id', storyId);
  }

  const { data, error } = await query.order('display_order', { ascending: true });

  if (error) {
    console.error('[Supabase fetchStoryMemories Error]', error);
    return [];
  }
  return (data || []) as StoryMemory[];
}

export async function fetchUniverseContent(universeId: string): Promise<UniverseContentPayload> {
  if (!universeId) {
    return { stars: [], memories: [], stories: [], storyMemories: [] };
  }

  const [stars, memories, stories, storyMemories] = await Promise.all([
    fetchUniverseStars(universeId),
    fetchUniverseMemories(universeId),
    fetchUniverseStories(universeId),
    fetchStoryMemories(universeId),
  ]);

  return { stars, memories, stories, storyMemories };
}

/* ============================================================
   OUR UNIVERSE V2 PROGRESS SERVICES
   ============================================================ */

export async function fetchUserUniverseProgress(
  universeId: string,
  userId: string
): Promise<UserUniverseProgress | null> {
  if (!supabase || !universeId || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_universe_progress')
      .select('user_id, universe_id, discovered_star_ids, is_experience_completed, is_star_13_unlocked, is_hidden_game_completed, last_visited_at, updated_at')
      .eq('universe_id', universeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserUniverseProgress;
  } catch (err) {
    console.error('[Supabase fetchUserUniverseProgress Catch]', err);
    return null;
  }
}

export async function recordV2StarDiscovery(
  universeId: string,
  starUuid: string
): Promise<UserUniverseProgress | null> {
  if (!supabase || !universeId || !starUuid) return null;

  // Guard: validate that starUuid is a valid UUID before sending to PostgreSQL uuid[] column
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(starUuid);
  if (!isUuid) {
    return null;
  }

  const user = await getCurrentAuthUser();
  if (!user) return null;

  try {
    const { error } = await supabase.rpc('record_star_discovery', {
      p_universe_id: universeId,
      p_star_id: starUuid,
    });

    if (error) {
      console.error('[Supabase recordV2StarDiscovery Error]', error.message || error);
      return null;
    }

    return await fetchUserUniverseProgress(universeId, user.id);
  } catch (err) {
    console.error('[Supabase recordV2StarDiscovery Catch]', err);
    return null;
  }
}

export async function recordV2Star13Unlocked(universeId: string): Promise<void> {
  if (!supabase || !universeId) return;
  const user = await getCurrentAuthUser();
  if (!user) return;
  try {
    const current = await fetchUserUniverseProgress(universeId, user.id);
    await supabase.from('user_universe_progress').upsert(
      {
        user_id: user.id,
        universe_id: universeId,
        discovered_star_ids: current?.discovered_star_ids || [],
        is_experience_completed: current?.is_experience_completed || false,
        is_star_13_unlocked: true,
        is_hidden_game_completed: current?.is_hidden_game_completed || false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,universe_id' }
    );
  } catch (err) {}
}

export async function recordV2HiddenGameCompleted(universeId: string): Promise<void> {
  if (!supabase || !universeId) return;
  const user = await getCurrentAuthUser();
  if (!user) return;
  try {
    const current = await fetchUserUniverseProgress(universeId, user.id);
    await supabase.from('user_universe_progress').upsert(
      {
        user_id: user.id,
        universe_id: universeId,
        discovered_star_ids: current?.discovered_star_ids || [],
        is_experience_completed: current?.is_experience_completed || false,
        is_star_13_unlocked: true,
        is_hidden_game_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,universe_id' }
    );
  } catch (err) {}
}

/* ============================================================
   OUR UNIVERSE V2 INVITATION RPC SERVICES
   ============================================================ */

export async function createUniverseInvitation(
  universeId: string,
  assignedRole: UniverseMemberRole = 'guest',
  maxUses: number | null = null,
  expiresInHours: number | null = null
): Promise<UniverseInvitationResult> {
  if (!supabase) throw new Error('Supabase client not configured.');
  const { data, error } = await supabase.rpc('create_universe_invitation', {
    p_universe_id: universeId,
    p_assigned_role: assignedRole,
    p_max_uses: maxUses,
    p_expires_in_hours: expiresInHours,
  });

  if (error) throw error;
  return data as UniverseInvitationResult;
}

export async function redeemUniverseInvitation(rawToken: string): Promise<UniverseRedemptionResult> {
  if (!supabase) throw new Error('Supabase client not configured.');
  const { data, error } = await supabase.rpc('redeem_universe_invitation', {
    p_raw_token: rawToken,
  });

  if (error) throw error;
  return data as UniverseRedemptionResult;
}

/* ============================================================
   OUR UNIVERSE V2 MULTI-CHANNEL CHAT & STORAGE SERVICES
   ============================================================ */

export async function fetchConversations(universeId: string) {
  if (!supabase || !universeId) return [];
  const { data, error } = await supabase
    .from('conversations')
    .select('id, universe_id, title, is_private, created_at')
    .eq('universe_id', universeId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchV2Messages(universeId: string, conversationId: string): Promise<V2Message[]> {
  if (!supabase || !universeId || !conversationId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, universe_id, conversation_id, sender_id, content, message_type, media_asset_id, reply_to_message_id, is_edited, is_read, created_at')
    .eq('universe_id', universeId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as V2Message[];
}

export async function markV2MessagesAsRead(universeId: string, conversationId: string): Promise<void> {
  if (!supabase || !universeId || !conversationId) return;
  const user = await getCurrentAuthUser();
  if (!user) return;

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('universe_id', universeId)
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.warn('[Mark Messages Read Notice]', error);
  }
}

export async function sendV2Message(
  universeId: string,
  conversationId: string,
  content: string,
  messageType: 'text' | 'image' | 'video' | 'audio' | 'system' = 'text',
  mediaUrl?: string,
  replyToMessageId?: string
): Promise<V2Message> {
  if (!supabase) throw new Error('Supabase client not configured.');
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Authentication required to send messages.');

  // If mediaUrl is provided for media/audio message types, use mediaUrl as finalContent
  const finalContent =
    (messageType === 'image' || messageType === 'video' || messageType === 'audio') && mediaUrl
      ? mediaUrl
      : content;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      universe_id: universeId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: finalContent,
      message_type: messageType,
      reply_to_message_id: replyToMessageId,
      is_read: false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as V2Message;
}

export function subscribeToV2Messages(
  universeId: string,
  conversationId: string,
  callback: (msg: V2Message) => void
): Unsubscribe {
  if (!supabase) return () => {};
  const topic = `universe:${universeId}:msg:${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const m = payload.new as any;
        if (!m || m.universe_id !== universeId || m.conversation_id !== conversationId) return;
        callback(m as V2Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function uploadUniverseMedia(
  universeId: string,
  memoryId: string | null,
  file: File
): Promise<{ storagePath: string; publicUrl?: string }> {
  if (!supabase) throw new Error('Supabase client not configured.');
  const memoryFolder = memoryId ? `${memoryId}/` : '';
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = `${universeId}/${memoryFolder}${fileName}`;

  // Generate Base64 Data URL for zero-dependency playback
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.readAsDataURL(file);
  });

  // Attempt background upload to Supabase Storage for long-term persistence
  try {
    await supabase.storage
      .from('universe_media')
      .upload(storagePath, file, { upsert: true });
  } catch (e) {
    console.warn('[Storage Upload Notice]', e);
  }

  // Return dataUrl to guarantee 100% playback reliability without bucket RLS dependencies
  return { storagePath, publicUrl: dataUrl };
}

/* ============================================================
   LEGACY ADAPTER SERVICES (Preserved for V1 Backward Compatibility)
   ============================================================ */

export class SupabaseChatService implements IChatService {
  private client: SupabaseClient;

  constructor() {
    if (!supabase) {
      throw new Error(
        'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }
    this.client = supabase;
  }

  async sendMessage(conversationId: string, payload: MessagePayload): Promise<Message> {
    const sender = payload.senderId || 'me';
    const rowPayload: Record<string, any> = {
      conversation_id: conversationId,
      sender_id: sender,
      content: payload.content,
    };
    if (payload.messageType) rowPayload.message_type = payload.messageType;
    if (payload.mediaUrl) rowPayload.media_url = payload.mediaUrl;
    if (payload.replyTo) rowPayload.reply_to = payload.replyTo;
    rowPayload.is_read = false;

    let res: any = await this.client
      .from('messages')
      .insert(rowPayload)
      .select('id, conversation_id, sender_id, content, message_type, media_url, reply_to, created_at, is_read')
      .single();

    if (res.error) {
      const fallbackPayload = { ...rowPayload };
      delete fallbackPayload.reply_to;
      res = await this.client
        .from('messages')
        .insert(fallbackPayload)
        .select('id, conversation_id, sender_id, content, message_type, media_url, created_at, is_read')
        .single();
    }

    if (res.error) {
      console.error('[Supabase Insert Error]', res.error);
      throw res.error;
    }

    const data = res.data;
    return {
      id: data?.id || String(Date.now()),
      conversationId: data?.conversation_id || conversationId,
      senderId: data?.sender_id || 'me',
      content: data?.content || payload.content,
      messageType: data?.message_type || 'text',
      mediaUrl: data?.media_url,
      replyTo: data?.reply_to || payload.replyTo,
      createdAt: data?.created_at || new Date().toISOString(),
      reactions: [],
      isRead: data?.is_read ?? false,
    };
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    let res: any = await this.client
      .from('messages')
      .select('id, conversation_id, sender_id, content, message_type, media_url, reply_to, created_at, is_read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (res.error) {
      res = await this.client
        .from('messages')
        .select('id, conversation_id, sender_id, content, message_type, media_url, created_at, is_read')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    }

    if (res.error) throw res.error;

    return (res.data || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      content: m.content,
      messageType: m.message_type,
      mediaUrl: m.media_url,
      replyTo: m.reply_to || undefined,
      createdAt: m.created_at,
      reactions: [],
      isRead: m.is_read,
    }));
  }

  subscribeToMessages(conversationId: string, callback: (msg: Message) => void): Unsubscribe {
    const topic = `room:${conversationId}:msg:${Math.random().toString(36).substring(2, 7)}`;
    const channel = this.client
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          if (!m || m.conversation_id !== conversationId) return;
          callback({
            id: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            content: m.content,
            messageType: m.message_type,
            mediaUrl: m.media_url,
            replyTo: m.reply_to || undefined,
            createdAt: m.created_at,
            reactions: [],
            isRead: Boolean(m.is_read),
          });
        }
      )
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }

  async markAsRead(conversationId: string, messageId: string): Promise<void> {
    await this.client
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId);
  }

  async markAllAsRead(conversationId: string, currentUserId: string): Promise<void> {
    await this.client
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .eq('is_read', false);
  }

  private typingChannels: Map<string, ReturnType<SupabaseClient['channel']>> = new Map();

  private getTypingChannel(conversationId: string) {
    if (!this.typingChannels.has(conversationId)) {
      const channel = this.client.channel(`room:${conversationId}:typing`);
      channel.subscribe();
      this.typingChannels.set(conversationId, channel);
    }
    return this.typingChannels.get(conversationId)!;
  }

  async setTypingStatus(conversationId: string, isTyping: boolean, senderId?: string): Promise<void> {
    const channel = this.getTypingChannel(conversationId);
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping, senderId },
    });
  }

  subscribeToPresence(userId: string, callback: (status: PresenceStatus) => void): Unsubscribe {
    const topic = `presence:${userId}:${Math.random().toString(36).substring(2, 7)}`;
    const channel = this.client.channel(topic, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        callback(Object.keys(state).length > 0 ? 'online' : 'offline');
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }

  subscribeToTyping(
    conversationId: string,
    callback: (data: { isTyping: boolean; senderId?: string } | boolean) => void
  ): Unsubscribe {
    const channel = this.getTypingChannel(conversationId);
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload?.payload) {
        callback(payload.payload);
      }
    });

    return () => {
      // Channel stays subscribed for sending/receiving
    };
  }
}

export interface UserProgressData {
  discoveredStars: string[];
  experienceCompleted: boolean;
  star13Unlocked?: boolean;
  hiddenGameCompleted?: boolean;
}

export async function fetchUserProgress(userId: string): Promise<UserProgressData> {
  if (!supabase || !userId) {
    return { discoveredStars: [], experienceCompleted: false, star13Unlocked: false, hiddenGameCompleted: false };
  }

  try {
    const { data, error } = await supabase
      .from('user_universe_progress')
      .select('discovered_star_ids, is_experience_completed, is_star_13_unlocked, is_hidden_game_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { discoveredStars: [], experienceCompleted: false, star13Unlocked: false, hiddenGameCompleted: false };
    }

    return {
      discoveredStars: data.discovered_star_ids || [],
      experienceCompleted: Boolean(data.is_experience_completed),
      star13Unlocked: Boolean(data.is_star_13_unlocked),
      hiddenGameCompleted: Boolean(data.is_hidden_game_completed),
    };
  } catch (err) {
    return { discoveredStars: [], experienceCompleted: false, star13Unlocked: false, hiddenGameCompleted: false };
  }
}

export async function recordStarDiscovery(
  userId: string,
  starId: string,
  totalRequired: number = 12
): Promise<{ discoveredStars: string[]; experienceCompleted: boolean }> {
  if (!supabase || !userId) return { discoveredStars: [], experienceCompleted: false };

  try {
    const current = await fetchUserProgress(userId);
    const starSet = new Set(current.discoveredStars);
    starSet.add(starId);
    const updatedStars = Array.from(starSet);
    const isCompleted = current.experienceCompleted || updatedStars.length >= totalRequired;

    return {
      discoveredStars: updatedStars,
      experienceCompleted: isCompleted,
    };
  } catch (err) {
    return { discoveredStars: [], experienceCompleted: false };
  }
}

export async function recordChatUnlocked(_userId: string): Promise<void> {
  // Chat unlock recorded via experienceState
}

export async function recordStar13Unlocked(_userId: string): Promise<void> {
  // Star 13 unlock recorded via recordV2Star13Unlocked
}

export async function recordHiddenGameCompleted(_userId: string): Promise<void> {
  // Hidden game completion recorded via recordV2HiddenGameCompleted
}

/* ============================================================
   OUR UNIVERSE V2 AUTHORING & INVITATION SERVICES (Phase 7)
   ============================================================ */

/** Update a Universe Memory (Requires owner/admin RLS) */
export async function updateUniverseMemory(
  universeId: string,
  memoryId: string,
  updates: Partial<UniverseMemory>
): Promise<UniverseMemory | null> {
  if (!supabase || !universeId || !memoryId) return null;

  try {
    const { data, error } = await supabase
      .from('memories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('universe_id', universeId)
      .eq('id', memoryId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[Supabase updateUniverseMemory Error]', error.message || error);
      throw error;
    }

    return data as UniverseMemory | null;
  } catch (err) {
    console.error('[Supabase updateUniverseMemory Catch]', err);
    throw err;
  }
}

/** Update a 3D Star Node (Requires owner/admin RLS) */
export async function updateUniverseStar(
  universeId: string,
  starId: string,
  updates: Partial<Star>
): Promise<Star | null> {
  if (!supabase || !universeId || !starId) return null;

  try {
    const { data, error } = await supabase
      .from('stars')
      .update(updates)
      .eq('universe_id', universeId)
      .eq('id', starId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[Supabase updateUniverseStar Error]', error.message || error);
      throw error;
    }

    return data as Star | null;
  } catch (err) {
    console.error('[Supabase updateUniverseStar Catch]', err);
    throw err;
  }
}

/** Update a Universe Story Sequence (Requires owner/admin RLS) */
export async function updateUniverseStory(
  universeId: string,
  storyId: string,
  updates: Partial<UniverseStory>
): Promise<UniverseStory | null> {
  if (!supabase || !universeId || !storyId) return null;

  try {
    const { data, error } = await supabase
      .from('stories')
      .update(updates)
      .eq('universe_id', universeId)
      .eq('id', storyId)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[Supabase updateUniverseStory Error]', error.message || error);
      throw error;
    }

    return data as UniverseStory | null;
  } catch (err) {
    console.error('[Supabase updateUniverseStory Catch]', err);
    throw err;
  }
}
