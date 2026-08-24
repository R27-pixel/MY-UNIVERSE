import { create } from 'zustand';
import type { NotificationItem } from '../types';
import { playMessageChime } from '../utils/soundEffects';
import { useExperienceStore } from './experienceStore';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  chatCount: number;
  soundEnabled: boolean;
  desktopPermission: NotificationPermission;

  // Actions
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  addChatMessageNotification: (senderName: string, messageId?: string) => void;
  clearChatNotifications: () => void;
  clearCallNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  toggleSound: () => void;
  requestDesktopPermission: () => Promise<void>;
}

let lastProcessedMessageId = '';

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  chatCount: 0,
  soundEnabled: true,
  desktopPermission: typeof Notification !== 'undefined' ? Notification.permission : 'default',

  addChatMessageNotification: (senderName: string, messageId?: string) => {
    // Rule 1: CHAT NOTIFICATIONS ARE ONLY FOR WHEN THE USER IS OUTSIDE THE CHAT.
    // If inside ChatRoom, do NOT show notification, do NOT increment count.
    if (useExperienceStore.getState().phase === 'CHAT') {
      return;
    }

    // Ignore duplicate notification triggers for the exact same message payload/ID
    if (messageId && messageId === lastProcessedMessageId) {
      return;
    }
    if (messageId) {
      lastProcessedMessageId = messageId;
    }

    const { soundEnabled, desktopPermission, chatCount, notifications } = get();
    const newChatCount = chatCount + 1;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedTitle = `💬 ${senderName}`;
    const updatedBody = `${newChatCount} ${newChatCount === 1 ? 'chat' : 'chats'}`;

    const existingChatNotifIndex = notifications.findIndex((n) => n.type === 'message');

    let updatedNotifications: NotificationItem[];

    if (existingChatNotifIndex !== -1) {
      // Update the SINGLE existing persistent chat notification card
      const existing = notifications[existingChatNotifIndex];
      const updatedItem: NotificationItem = {
        ...existing,
        title: updatedTitle,
        body: updatedBody,
        timestamp,
        read: false,
      };
      updatedNotifications = [
        updatedItem,
        ...notifications.filter((_, idx) => idx !== existingChatNotifIndex),
      ];
    } else {
      // Create ONE persistent chat notification card
      const newChatNotif: NotificationItem = {
        id: 'chat-aggregated-notif',
        title: updatedTitle,
        body: updatedBody,
        type: 'message',
        timestamp,
        read: false,
      };
      const nonMessageNotifs = notifications.filter((n) => n.type !== 'message');
      updatedNotifications = [newChatNotif, ...nonMessageNotifs];
    }

    set({
      notifications: updatedNotifications,
      chatCount: newChatCount,
      unreadCount: updatedNotifications.filter((n) => !n.read).length,
    });

    if (soundEnabled) {
      playMessageChime();
    }

    if (
      typeof Notification !== 'undefined' &&
      desktopPermission === 'granted' &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      try {
        new Notification(updatedTitle, {
          body: updatedBody,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('[Desktop Notification Warning]', err);
      }
    }
  },

  addNotification: (item) => {
    // If incoming notification is a message, route through aggregated chat handler
    if (item.type === 'message') {
      get().addChatMessageNotification(item.title);
      return;
    }

    // Call and System notifications remain separate, distinct, and un-suppressed
    const { soundEnabled, desktopPermission } = get();
    const newNotif: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    set((s) => ({
      notifications: [newNotif, ...s.notifications.slice(0, 19)],
      unreadCount: s.unreadCount + 1,
    }));

    if (
      typeof Notification !== 'undefined' &&
      desktopPermission === 'granted' &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      try {
        new Notification(item.title, {
          body: item.body,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('[Desktop Notification Warning]', err);
      }
    }
  },

  clearChatNotifications: () => {
    lastProcessedMessageId = '';
    set((s) => {
      const filtered = s.notifications.filter((n) => n.type !== 'message');
      return {
        notifications: filtered,
        chatCount: 0,
        unreadCount: filtered.filter((n) => !n.read).length,
      };
    });
  },

  clearCallNotifications: () => {
    set((s) => {
      const filtered = s.notifications.filter((n) => n.type !== 'call');
      return {
        notifications: filtered,
        unreadCount: filtered.filter((n) => !n.read).length,
      };
    });
  },

  markAsRead: (id) =>
    set((s) => {
      const isChat = id === 'chat-aggregated-notif' || s.notifications.find((n) => n.id === id)?.type === 'message';
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      const unread = updated.filter((n) => !n.read).length;
      if (isChat) lastProcessedMessageId = '';
      return {
        notifications: updated,
        unreadCount: unread,
        chatCount: isChat ? 0 : s.chatCount,
      };
    }),

  markAllRead: () =>
    set((s) => {
      lastProcessedMessageId = '';
      return {
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
        chatCount: 0,
      };
    }),

  removeNotification: (id) =>
    set((s) => {
      const isChat = id === 'chat-aggregated-notif' || s.notifications.find((n) => n.id === id)?.type === 'message';
      const filtered = s.notifications.filter((n) => n.id !== id);
      if (isChat) lastProcessedMessageId = '';
      return {
        notifications: filtered,
        unreadCount: filtered.filter((n) => !n.read).length,
        chatCount: isChat ? 0 : s.chatCount,
      };
    }),

  clearAll: () => {
    lastProcessedMessageId = '';
    set({ notifications: [], unreadCount: 0, chatCount: 0 });
  },

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  requestDesktopPermission: async () => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      set({ desktopPermission: perm });
    }
  },
}));
