import { io, Socket } from 'socket.io-client';
import { auth } from '../../firebase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let callSocket: Socket | null = null;

// Separate connection from chat because it's a separate Socket.IO
// namespace on the backend (/calls vs the default namespace) — mirrors
// CallGateway's @WebSocketGateway({ namespace: 'calls' }) exactly.
export async function getCallSocket(): Promise<Socket> {
  if (callSocket?.connected) return callSocket;

  // A socket that exists but is not connected was previously just abandoned: the
  // next call built a second connection and overwrote the reference, so the old
  // one was never closed and both could sit half-open. Close it first.
  //
  // Note this does NOT wait for the new connection. Callers that only LISTEN for
  // incoming calls must register their handlers immediately — waiting here would
  // mean a slow backend also stopped calls from being received, which is a worse
  // failure than the one being fixed.
  if (callSocket) {
    callSocket.removeAllListeners();
    callSocket.disconnect();
    callSocket = null;
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Must be logged in to connect to calls');

  const token = await user.getIdToken();

  callSocket = io(`${SOCKET_URL}/calls`, {
    auth: { token },
    // WebSocket first, but allow the HTTP long-polling fallback. Some
    // managed proxies (including free-tier PaaS edge networks) occasionally
    // refuse the upgrade, and without a fallback the socket just never
    // connects. Polling frames are also ordinary HTTP requests, which keeps
    // a spin-down-prone host awake.
    transports: ['websocket', 'polling'],
  });

  return callSocket;
}

/**
 * Wait for the call socket to be usable, then hand it back — or throw.
 *
 * Use this before SENDING anything (the invite, the answer, an ICE candidate).
 * Socket.IO buffers emits while disconnected and flushes them on connect, so
 * without this an invite sent to a dead socket produced no error, no feedback
 * and no call: the caller saw the ringing screen and nothing happened on either
 * side. Failing loudly is the whole point.
 *
 * A free-tier backend that has spun down needs roughly 30-60s to answer, which
 * is why the default timeout is generous, and why calls are the one place worth
 * waiting rather than failing fast.
 */
export async function waitForCallSocket(timeoutMs = 20_000): Promise<Socket> {
  const socket = await getCallSocket();
  if (socket.connected) return socket;

  await new Promise<void>((resolve) => {
    const done = () => {
      socket.off('connect', done);
      socket.off('connect_error', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    socket.once('connect', done);
    socket.once('connect_error', done);
  });

  if (!socket.connected) {
    throw new Error(`Could not reach the calling service at ${SOCKET_URL}`);
  }

  return socket;
}

export function disconnectCallSocket() {
  callSocket?.disconnect();
  callSocket = null;
}
