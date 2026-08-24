import type { IChatService, IAuthService, Message, MessagePayload, User, PresenceStatus, Unsubscribe } from '../../types';

/**
 * MockChatService — In-memory chat service for demo/development.
 * Replace with SupabaseChatService or FirebaseChatService for production.
 */

type MessageCallback = (msg: Message) => void;
type PresenceCallback = (status: PresenceStatus) => void;
type TypingCallback = (isTyping: boolean) => void;

export class MockChatService implements IChatService {
  private messages: Map<string, Message[]> = new Map();
  private messageSubscribers: Map<string, Set<MessageCallback>> = new Map();
  private presenceSubscribers: Map<string, Set<PresenceCallback>> = new Map();
  private typingSubscribers: Map<string, Set<TypingCallback>> = new Map();

  async sendMessage(conversationId: string, payload: MessagePayload): Promise<Message> {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversationId,
      senderId: 'user-1',
      content: payload.content,
      messageType: payload.messageType,
      mediaUrl: payload.mediaUrl,
      replyTo: payload.replyTo,
      createdAt: new Date().toISOString(),
      reactions: [],
      isRead: false,
    };

    const existing = this.messages.get(conversationId) || [];
    existing.push(message);
    this.messages.set(conversationId, existing);

    // Notify subscribers
    const subs = this.messageSubscribers.get(conversationId);
    if (subs) {
      subs.forEach((cb) => cb(message));
    }

    return message;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.messages.get(conversationId) || [];
  }

  subscribeToMessages(conversationId: string, callback: MessageCallback): Unsubscribe {
    if (!this.messageSubscribers.has(conversationId)) {
      this.messageSubscribers.set(conversationId, new Set());
    }
    this.messageSubscribers.get(conversationId)!.add(callback);

    return () => {
      this.messageSubscribers.get(conversationId)?.delete(callback);
    };
  }

  async markAsRead(conversationId: string, messageId: string): Promise<void> {
    const msgs = this.messages.get(conversationId);
    if (msgs) {
      const msg = msgs.find((m) => m.id === messageId);
      if (msg) msg.isRead = true;
    }
  }

  async setTypingStatus(conversationId: string, isTyping: boolean, senderId?: string): Promise<void> {
    const subs = this.typingSubscribers.get(conversationId);
    if (subs) {
      subs.forEach((cb) => cb({ isTyping, senderId } as any));
    }
  }

  subscribeToPresence(userId: string, callback: PresenceCallback): Unsubscribe {
    if (!this.presenceSubscribers.has(userId)) {
      this.presenceSubscribers.set(userId, new Set());
    }
    this.presenceSubscribers.get(userId)!.add(callback);
    // Initially online
    callback('online');

    return () => {
      this.presenceSubscribers.get(userId)?.delete(callback);
    };
  }

  subscribeToTyping(conversationId: string, callback: TypingCallback | any): Unsubscribe {
    if (!this.typingSubscribers.has(conversationId)) {
      this.typingSubscribers.set(conversationId, new Set());
    }
    this.typingSubscribers.get(conversationId)!.add(callback);

    return () => {
      this.typingSubscribers.get(conversationId)?.delete(callback);
    };
  }
}

/**
 * MockAuthService — Simple session-based auth for demo.
 */
export class MockAuthService implements IAuthService {
  private currentUser: User | null = null;
  private authCallbacks: Set<(user: User | null) => void> = new Set();

  async signIn(credentials: { name: string }): Promise<User> {
    this.currentUser = {
      id: 'user-1',
      displayName: credentials.name,
      isOnline: true,
    };
    this.authCallbacks.forEach((cb) => cb(this.currentUser));
    return this.currentUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.authCallbacks.forEach((cb) => cb(null));
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  onAuthStateChange(callback: (user: User | null) => void): Unsubscribe {
    this.authCallbacks.add(callback);
    return () => {
      this.authCallbacks.delete(callback);
    };
  }
}

// Singleton instances
export const mockChatService = new MockChatService();
export const mockAuthService = new MockAuthService();
