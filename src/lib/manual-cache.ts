export interface ManualCacheEnvelope<T> {
  data: T;
  refreshedAt: string;
}

export function readManualCache<T>(key: string): ManualCacheEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManualCacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || !("refreshedAt" in parsed) || !("data" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeManualCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  const payload: ManualCacheEnvelope<T> = {
    data,
    refreshedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(payload));
  return payload;
}

export function removeManualCache(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}
