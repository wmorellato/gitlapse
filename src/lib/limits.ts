import { MAX_CONCURRENT_EXTRACTIONS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

let active = 0;

/** Reserve a concurrency slot for an extraction, or null if at capacity. Call the returned fn to release it. */
export function tryAcquireSlot(): (() => void) | null {
  if (active >= MAX_CONCURRENT_EXTRACTIONS) return null;
  active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active--;
  };
}

interface RateWindow {
  count: number;
  start: number;
}
const hits = new Map<string, RateWindow>();

/** Fixed-window per-IP rate limit. Returns false when the caller exceeded RATE_LIMIT_MAX in the current window. */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start >= RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) return false;
  rec.count++;
  return true;
}

/** Test-only: reset all limiter state. */
export function __resetLimits(): void {
  active = 0;
  hits.clear();
}
