const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;
const AUTH_TOKEN_KEY = 'token';

const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const buildAuthHeaders = (init: HeadersInit = {}): HeadersInit => {
  const headers = new Headers(init);
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
};

export {
  API_BASE_URL,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  AUTH_TOKEN_KEY,
  getAuthToken,
  buildAuthHeaders,
};
