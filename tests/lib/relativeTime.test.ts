import { describe, it, expect } from "vitest";
import { formatRelative } from "@/lib/relativeTime";

const now = new Date("2026-06-23T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const SEC = 1000, MIN = 60 * SEC, HR = 60 * MIN, DAY = 24 * HR;

describe("formatRelative", () => {
  it("uses full words, never abbreviations (translation-friendly)", () => {
    expect(formatRelative(ago(3 * DAY), now)).toBe("3 days ago");
    expect(formatRelative(ago(2 * HR), now)).toBe("2 hours ago");
    expect(formatRelative(ago(5 * MIN), now)).toBe("5 minutes ago");
  });

  it("reads naturally for the recent past", () => {
    expect(formatRelative(ago(DAY), now)).toBe("yesterday");
    expect(formatRelative(ago(10 * SEC), now)).toMatch(/now|seconds ago/);
  });

  it("scales up to months and years", () => {
    expect(formatRelative(ago(45 * DAY), now)).toBe("last month");
    expect(formatRelative(ago(400 * DAY), now)).toBe("last year");
  });
});
