import { notificationsApi } from '../../../lib/api';

export interface AppNotification {
  id: string;
  userId: string;
  senderId?: string;
  senderName?: string;
  type: 'friend_request' | 'message' | 'meetup' | 'rating' | 'post_like';
  title: string;
  message: string;
  isUnread: boolean;
  createdAt: string;
}

// Same call signature as the old Firestore version in src/firebase.ts, so
// every existing call site just needs its import swapped — no call-site
// changes needed. senderId is dropped here on purpose: the backend infers
// it from the authenticated caller (@CurrentUser()) instead of trusting
// whatever the client claims, which is the more correct behavior anyway.
export async function createNotification(
  notification: Omit<AppNotification, 'id' | 'isUnread' | 'createdAt'>,
) {
  try {
    await notificationsApi.create({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
    });
  } catch (err) {
    console.warn('Failed to create notification:', err);
  }
}
