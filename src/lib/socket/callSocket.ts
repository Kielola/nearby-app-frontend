import { io, Socket } from 'socket.io-client';
import { auth } from '../../firebase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let callSocket: Socket | null = null;

// Separate connection from chat because it's a separate Socket.IO
// namespace on the backend (/calls vs the default namespace) — mirrors
// CallGateway's @WebSocketGateway({ namespace: 'calls' }) exactly.
export async function getCallSocket(): Promise<Socket> {
  if (callSocket?.connected) return callSocket;

  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to connect to calls');

  const token = await user.getIdToken();

  callSocket = io(`${SOCKET_URL}/calls`, {
    auth: { token },
    transports: ['websocket'],
  });

  return callSocket;
}

export function disconnectCallSocket() {
  callSocket?.disconnect();
  callSocket = null;
}
