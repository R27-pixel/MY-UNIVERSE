import { create } from 'zustand';
import type { Message, User, MessagePayload, PresenceStatus } from '../types';

interface ChatState {
  currentUser: User | null;
  otherUser: User | null;
  messages: Message[];
  isTyping: boolean;
  otherIsTyping: boolean;
  conversationId: string;
  isConnected: boolean;

  // Actions
  setCurrentUser: (user: User) => void;
  setOtherUser: (user: User) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setTyping: (v: boolean) => void;
  setOtherTyping: (v: boolean) => void;
  setConnected: (v: boolean) => void;
  markMessageRead: (msgId: string) => void;
  addReaction: (msgId: string, emoji: string, userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  otherUser: null,
  messages: [],
  isTyping: false,
  otherIsTyping: false,
  conversationId: 'universe-chat-001',
  isConnected: false,

  setCurrentUser: (user) => set({ currentUser: user }),
  setOtherUser: (user) => set({ otherUser: user }),
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setTyping: (v) => set({ isTyping: v }),
  setOtherTyping: (v) => set({ otherIsTyping: v }),
  setConnected: (v) => set({ isConnected: v }),
  markMessageRead: (msgId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId ? { ...m, isRead: true } : m
      ),
    })),
  addReaction: (msgId, emoji, userId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              reactions: [
                ...m.reactions,
                { id: `${msgId}-${emoji}-${userId}`, userId, emoji },
              ],
            }
          : m
      ),
    })),
}));
