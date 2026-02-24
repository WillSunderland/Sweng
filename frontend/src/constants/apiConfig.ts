const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

export { API_BASE_URL, POLL_INTERVAL_MS, POLL_TIMEOUT_MS };
