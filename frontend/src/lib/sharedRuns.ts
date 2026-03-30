const SHARED_RUNS_KEY = 'sharedRunIds';

function getSharedRunIds(): string[] {
  try {
    const raw = localStorage.getItem(SHARED_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function isRunShared(runId: string): boolean {
  return getSharedRunIds().includes(runId);
}

function saveSharedRunIds(ids: string[]): void {
  localStorage.setItem(SHARED_RUNS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function toggleRunShared(runId: string): boolean {
  const ids = new Set(getSharedRunIds());
  if (ids.has(runId)) {
    ids.delete(runId);
    saveSharedRunIds(Array.from(ids));
    return false;
  }
  ids.add(runId);
  saveSharedRunIds(Array.from(ids));
  return true;
}

export { SHARED_RUNS_KEY, getSharedRunIds, isRunShared, toggleRunShared };
