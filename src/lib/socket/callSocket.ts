import { io, Socket } from 'socket.io-client';
import { auth } from '../../firebase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let callSocket: Socket | null = null;

// Separate connection from chat because it's a separate Socket.IO
// namespace on the backend (/calls vs the default namespace) — mirrors
// CallGateway's @WebSocketGateway({ namespace: 'calls' }) exactly.
export async function getCallSocket(): Promise<Socket> {
  // Reuse the existing socket. ALWAYS.
  //
  // An earlier version of this function tore the socket down whenever
  // `connected` was false, on the theory that a half-open socket should be
  // replaced. That produced a reconnect storm in production: during a call the
  // ICE-candidate handler asks for the socket many times per second, and each
  // request arrived while the previous attempt was still handshaking — so it
  // disconnected the in-flight connection and started another. The server saw
  // 13 fresh connections in 13 seconds from one user, and the socket never
  // stayed up long enough to receive anything.
  //
  // `active` is true while Socket.IO is connected OR still trying to reconnect.
  // Only when it is false has Socket.IO genuinely given up (the server actively
  // disconnected us), and the correct response is to ask the SAME instance to
  // reconnect — not to build a new one, which would drop the event handlers
  // every caller registered on the old one.
  //
  // Note this does NOT wait for the connection. Callers that only LISTEN for
  // incoming calls must register their handlers immediately; waiting here would
  // mean a slow backend also stopped calls from being received.
  if (callSocket) {
    if (!callSocket.connected && !callSocket.active) {
      callSocket.connect();
    }
    return callSocket;
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
