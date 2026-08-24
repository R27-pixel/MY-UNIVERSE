export const chatConfig = {
  backend: 'mock' as 'mock' | 'supabase' | 'firebase',
  supabase: {
    url: '',
    anonKey: '',
  },
  firebase: {},
  features: {
    imageSharing: true,
    emojiReactions: true,
    typingIndicator: true,
    readReceipts: true,
    onlineStatus: true,
  },
  ui: {
    maxMessageLength: 2000,
    showTimestamps: true,
    groupMessagesByDate: true,
  },
};
