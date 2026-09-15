// These mirror the Postgres row shapes returned by the backend
// (see nearby-backend/src/database/*.ts). Keeping them here in one file
// means every API module and every component imports the SAME shape —
// no more each feature inventing its own slightly-different User type.

export interface ApiUser {
  id: string;
  firebaseUid: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  distance_km: string;
  is_friend: boolean;
  has_existing_chat: boolean;
}

export interface Conversation {
  conversationId: string;
  wasCreated: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'voice' | 'document' | null;
  audioDurationSec: number | null;
  fileName: string | null;
  fileSize: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  conversation_id: string;
  other_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  unread_count: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  caption: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  caption: string | null;
  createdAt: string;
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  folder: string;
  apiKey: string;
  cloudName: string;
}
