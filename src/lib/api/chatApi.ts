import { apiRequest } from './httpClient';
import { ChatMessage, Conversation, ConversationSummary } from './types';

export const chatApi = {
  startConversation: (otherUserId: string) =>
    apiRequest<Conversation>('/chat/conversations', {
      method: 'POST',
      body: { otherUserId },
    }),

  // One call for the whole chat list: every conversation, who the other
  // person is, their last message, and an unread count (WhatsApp-style
  // watermark: everything after my last-read timestamp not sent by me).
  listConversations: () => apiRequest<ConversationSummary[]>('/chat/conversations'),

  getMessages: (conversationId: string) =>
    apiRequest<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`),

  markRead: (conversationId: string) =>
    apiRequest<{ ok: true }>(`/chat/conversations/${conversationId}/read`, { method: 'POST' }),
};
