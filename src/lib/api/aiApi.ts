import { apiRequest } from './httpClient';

// These two used to be `fetch('/api/my-ai/chat')` — relative paths served by
// a separate Express process in this repo (server.ts). That process was the
// only reason a second always-on server had to be deployed, which free tiers
// charge for and 750-hour months can't cover.
//
// Going through apiRequest means they hit the NestJS backend at VITE_API_URL,
// carry the Firebase bearer token (so only signed-in users can call them),
// and inherit the server's rate limiting.
export const aiApi = {
  myAiChat: (payload: { prompt?: string; image?: string; chatHistory?: unknown }) =>
    apiRequest<{ response: string }>('/ai/my-ai-chat', {
      method: 'POST',
      body: payload,
    }),

  icebreakers: (payload: {
    userProfile?: { name?: string; interests?: string[]; streetName?: string };
    neighborProfile?: { name?: string; interests?: string[]; streetName?: string };
  }) =>
    apiRequest<{ starters: string[] }>('/ai/icebreaker', {
      method: 'POST',
      body: payload,
    }),
};
