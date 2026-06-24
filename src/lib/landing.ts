import type { AnimationPayload, AnimationRecord } from "@/lib/types";

/**
 * Resolve the first available pinned example, in priority order.
 * `find` is injected (the route passes `findAnimation`) so this stays
 * pure and unit-testable without a database.
 */
export function resolveLandingExample(
  ids: string[],
  find: (id: string) => AnimationRecord | null
): AnimationPayload | null {
  for (const id of ids) {
    const rec = find(id);
    if (rec) return rec.payload;
  }
  return null;
}
