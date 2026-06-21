import { describe, it, expect, beforeEach, vi } from "vitest";
import { tryAcquireSlot, checkRateLimit, __resetLimits } from "@/lib/limits";
import { MAX_CONCURRENT_EXTRACTIONS, RATE_LIMIT_MAX } from "@/lib/constants";

beforeEach(() => __resetLimits());

describe("tryAcquireSlot", () => {
  it("grants up to the max then refuses, and frees on release", () => {
    const releases: Array<() => void> = [];
    for (let i = 0; i < MAX_CONCURRENT_EXTRACTIONS; i++) {
      const r = tryAcquireSlot();
      expect(r).not.toBeNull();
      releases.push(r!);
    }
    expect(tryAcquireSlot()).toBeNull();
    releases[0]();
    expect(tryAcquireSlot()).not.toBeNull();
  });

  it("double release does not over-free a slot", () => {
    const r = tryAcquireSlot()!;
    r();
    r();
    const held: Array<() => void> = [];
    for (let i = 0; i < MAX_CONCURRENT_EXTRACTIONS; i++) {
      const x = tryAcquireSlot();
      expect(x).not.toBeNull();
      held.push(x!);
    }
    expect(tryAcquireSlot()).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("allows up to RATE_LIMIT_MAX per IP then blocks; other IPs unaffected", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect(checkRateLimit("1.2.3.4")).toBe(true);
    expect(checkRateLimit("1.2.3.4")).toBe(false);
    expect(checkRateLimit("5.6.7.8")).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit("9.9.9.9");
      expect(checkRateLimit("9.9.9.9")).toBe(false);
      vi.advanceTimersByTime(60001);
      expect(checkRateLimit("9.9.9.9")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
