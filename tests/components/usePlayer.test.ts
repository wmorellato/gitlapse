import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlayer } from "@/components/usePlayer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePlayer", () => {
  it("advances while playing and stops at the end", () => {
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.play());
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.index).toBe(2);
    act(() => { vi.advanceTimersByTime(1500); });
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
});
