import { io, Socket } from 'socket.io-client';
import { auth } from '../../firebase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let chatSocket: Socket | null = null;

// One shared socket per browser tab, not one per component. Components
// that need chat events call this to get the same connection rather
// than each opening their own — matches how the backend's ChatGateway
// expects one authenticated connection per user.
export async function getChatSocket(): Promise<Socket> {
  if (chatSocket?.connected) return chatSocket;

  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to connect to chat');

  const token = await user.getIdToken();

  chatSocket = io(SOCKET_URL, {
    auth: { token },
    // WebSocket first, but allow the HTTP long-polling fallback. Some
    // managed proxies (including free-tier PaaS edge networks) occasionally
    // refuse the upgrade, and without a fallback the socket just never
    // connects. Polling frames are also ordinary HTTP requests, which keeps
    // a spin-down-prone host awake.
    transports: ['websocket', 'polling'],
  });

  return chatSocket;
}

export function disconnectChatSocket() {
  chatSocket?.disconnect();
  chatSocket = null;
}
