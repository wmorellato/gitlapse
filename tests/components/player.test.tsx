import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Player } from "@/components/Player";
import type { AnimationPayload } from "@/lib/types";

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const payload: AnimationPayload = {
  version: 1, repo: { url: null, displayName: "a/b" }, filePath: "a.txt",
  language: "plaintext", truncated: false,
  commits: [
    { sha: "1", shortSha: "1111111", message: "first", author: { name: "D", email: "d@x" },
      timestamp: "2026-01-01T00:00:00Z", content: "a", status: "added" },
    { sha: "2", shortSha: "2222222", message: "second", author: { name: "D", email: "d@x" },
      timestamp: "2026-01-02T00:00:00Z", content: "a\nb", status: "modified" }
  ]
};

describe("Player", () => {
  it("renders the first commit and the timeline", () => {
    render(<Player payload={payload} />);
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByRole("slider", { name: /timeline/i })).toBeTruthy();
  });

  it("renders the minimap overview alongside the content", () => {
    const { container } = render(<Player payload={payload} />);
    // One bar per line of the current commit's content (first commit: "a").
    expect(container.querySelectorAll("[data-bar]").length).toBeGreaterThan(0);
  });

  it("autoplays on mount so a shared link shows the morph immediately", () => {
    // jsdom reports no reduced-motion preference, so playback starts on mount
    // and the play control flips to Pause.
    render(<Player payload={payload} />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeTruthy();
  });

  it("does not autoplay a single-commit animation", () => {
    const single: AnimationPayload = { ...payload, commits: [payload.commits[0]] };
    render(<Player payload={single} />);
    expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
  });

  describe("at end of playback", () => {
    afterEach(() => vi.useRealTimers());

    it("reveals a Replay affordance once autoplay finishes", () => {
      vi.useFakeTimers();
      render(<Player payload={payload} />);
      // Autoplay advances through the two commits; one cycle per step, then it
      // stops at the end and the replay affordance should appear.
      act(() => { vi.advanceTimersByTime(2500); });
      act(() => { vi.advanceTimersByTime(2500); });
      // Both the controls button and the viewport overlay expose "Replay".
      expect(screen.getAllByRole("button", { name: /replay/i }).length).toBeGreaterThan(0);
    });
  });

  describe("keyboard control", () => {
    it("toggles playback with the space bar", () => {
      render(<Player payload={payload} />);
      // jsdom autoplays, so it starts on Pause.
      expect(screen.getByRole("button", { name: /pause/i })).toBeTruthy();
      act(() => { fireEvent.keyDown(document, { key: " " }); });
      expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
    });

    it("steps commits with the arrow keys", () => {
      render(<Player payload={payload} />);
      expect(screen.getByText("1 / 2")).toBeTruthy();
      act(() => { fireEvent.keyDown(document, { key: "ArrowRight" }); });
      expect(screen.getByText("2 / 2")).toBeTruthy();
      act(() => { fireEvent.keyDown(document, { key: "ArrowLeft" }); });
      expect(screen.getByText("1 / 2")).toBeTruthy();
    });

    it("ignores shortcuts originating from a form control", () => {
      render(<Player payload={payload} />);
      const slider = screen.getByRole("slider", { name: /timeline/i });
      act(() => { fireEvent.keyDown(slider, { key: " " }); });
      // Space on the range must not hijack — playback keeps running.
      expect(screen.getByRole("button", { name: /pause/i })).toBeTruthy();
    });
  });
});
