import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMorphPhase } from "@/components/useMorphPhase";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMorphPhase", () => {
  it("starts idle with all-context lines", () => {
    const { result } = renderHook(() => useMorphPhase("a\nb", null, { dwellMs: 1500, reduced: false, scrubbing: false }));
    expect(result.current.phase).toBe("idle");
    expect(result.current.lines.every((l) => l.type === "context")).toBe(true);
  });

  it("runs anticipate -> apply -> idle on a real change", () => {
    const { result, rerender } = renderHook(
      ({ c, p }) => useMorphPhase(c, p, { dwellMs: 1500, holdMs: 1000, reduced: false, scrubbing: false }),
      { initialProps: { c: "a\nb", p: null as string | null } }
    );
    act(() => rerender({ c: "a\nx", p: "a\nb" }));
    // Phase 1: region painted — old line shown as a removal, no additions yet.
    expect(result.current.phase).toBe("anticipate");
    expect(result.current.firstChangeKey).not.toBeNull();
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(true);
    expect(result.current.lines.some((l) => l.type === "add")).toBe(false);
    // The change is held for holdMs before being applied.
    act(() => { vi.advanceTimersByTime(900); });
    expect(result.current.phase).toBe("anticipate");
    act(() => { vi.advanceTimersByTime(200); });
    // Phase 2: applied — the addition appears.
    expect(result.current.phase).toBe("apply");
    expect(result.current.lines.some((l) => l.type === "add")).toBe(true);
    act(() => { vi.advanceTimersByTime(700); });
    // Phase 3: settled — removals are gone.
    expect(result.current.phase).toBe("idle");
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(false);
  });

  it("snaps instantly when scrubbing (no anticipate phase)", () => {
    const { result, rerender } = renderHook(
      ({ c, p, s }) => useMorphPhase(c, p, { dwellMs: 1500, reduced: false, scrubbing: s }),
      { initialProps: { c: "a", p: null as string | null, s: false } }
    );
    act(() => rerender({ c: "a\nb", p: "a", s: true }));
    expect(result.current.phase).toBe("idle");
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(false);
  });

  it("snaps instantly under reduced motion", () => {
    const { result, rerender } = renderHook(
      ({ c, p, r }) => useMorphPhase(c, p, { dwellMs: 1500, reduced: r, scrubbing: false }),
      { initialProps: { c: "a", p: null as string | null, r: false } }
    );
    act(() => rerender({ c: "z", p: "a", r: true }));
    expect(result.current.phase).toBe("idle");
  });
});
