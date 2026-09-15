import { auth } from '../../firebase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Every request to our NestJS backend needs the current user's Firebase
// ID token as a Bearer header — this is the ONE place that logic lives,
// instead of every feature re-implementing it (which is exactly how the
// old codebase ended up with auth logic duplicated in three places).
async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};

  // getIdToken() returns the cached token unless it's expired, in which
  // case it silently refreshes — we never manage token expiry ourselves.
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authHeader = await getAuthHeader();

  const url = new URL(path, API_URL);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Our backend's GlobalExceptionFilter always returns this exact shape
  // for errors: { statusCode, message, timestamp }. Parsing it here means
  // every feature gets consistent, typed errors instead of each one
  // guessing at response.json() shape.
  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = null;
    }
    const message =
      (details as any)?.message?.message ??
      (details as any)?.message ??
      response.statusText;
    throw new ApiError(response.status, message, details);
  }

  // 204 No Content or empty bodies shouldn't try to JSON.parse('')
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
