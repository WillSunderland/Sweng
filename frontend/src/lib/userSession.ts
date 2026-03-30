import { API_BASE_URL, buildAuthHeaders } from '../constants/apiConfig';

const USER_DISPLAY_NAME_KEY = 'currentUserDisplayName';

function toDisplayName(raw?: string | null): string {
  if (!raw) return 'Legal Professional';
  const base = raw.includes('@') ? raw.split('@')[0] : raw;
  const cleaned = base.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Legal Professional';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function setCurrentUserDisplayName(rawName: string): void {
  const displayName = toDisplayName(rawName);
  localStorage.setItem(USER_DISPLAY_NAME_KEY, displayName);
}

function getCurrentUserDisplayName(): string {
  return localStorage.getItem(USER_DISPLAY_NAME_KEY) ?? 'Legal Professional';
}

function getCurrentUserAvatarSeed(): string {
  return getCurrentUserDisplayName().replace(/\s+/g, '-');
}

async function hydrateCurrentUserDisplayName(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/authenticated/`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = (await res.json()) as { username?: string };
    if (data.username) {
      setCurrentUserDisplayName(data.username);
    }
  } catch {
    // Ignore hydration failures and keep local fallback.
  }
}

export {
  USER_DISPLAY_NAME_KEY,
  setCurrentUserDisplayName,
  getCurrentUserDisplayName,
  getCurrentUserAvatarSeed,
  hydrateCurrentUserDisplayName,
};
