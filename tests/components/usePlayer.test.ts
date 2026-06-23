import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlayer } from "@/components/usePlayer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePlayer", () => {
  it("advances while playing and stops at the end", () => {
    // Each step is the region-hold + dwell cycle (ANTICIPATE_HOLD_MS + BASE_DWELL_MS).
    const STEP_MS = 2500;
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.play());
    act(() => { vi.advanceTimersByTime(STEP_MS); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(STEP_MS); });
    expect(result.current.index).toBe(2);
    act(() => { vi.advanceTimersByTime(STEP_MS); });
    expect(result.current.index).toBe(2);
    expect(result.current.isPlaying).toBe(false);
  });

  it("clamps seek and steps", () => {
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.seek(99));
    expect(result.current.index).toBe(2);
    act(() => result.current.prev());
    expect(result.current.index).toBe(1);
  });

  it("reports atEnd once the final commit is reached", () => {
    const { result } = renderHook(() => usePlayer(3));
    expect(result.current.atEnd).toBe(false);
    act(() => result.current.seek(2));
    expect(result.current.atEnd).toBe(true);
  });

  it("never reports atEnd for a single-commit animation", () => {
    const { result } = renderHook(() => usePlayer(1));
    expect(result.current.atEnd).toBe(false);
  });

  it("replay restarts playback from the first commit", () => {
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.seek(2));
    expect(result.current.atEnd).toBe(true);
    act(() => result.current.replay());
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });
});
