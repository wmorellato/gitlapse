import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "@/components/Controls";
import { CommitInfo } from "@/components/CommitInfo";

function api(overrides = {}) {
  return {
    index: 0, isPlaying: false, speed: 1,
    play: vi.fn(), pause: vi.fn(), toggle: vi.fn(),
    next: vi.fn(), prev: vi.fn(), seek: vi.fn(), setSpeed: vi.fn(),
    ...overrides
  };
}

describe("Controls", () => {
  it("calls toggle when play/pause is clicked", async () => {
    const player = api();
    render(<Controls player={player} />);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(player.toggle).toHaveBeenCalled();
  });
});

describe("CommitInfo", () => {
  it("shows the first line of the message and position", () => {
    render(
      <CommitInfo
        index={2} count={5}
        commit={{ sha: "s", shortSha: "abc1234", message: "Fix bug\n\ndetails",
          author: { name: "Dev", email: "d@x" }, timestamp: "2026-01-01T00:00:00Z",
          content: "", status: "modified" }}
      />
    );
    expect(screen.getByText("Fix bug")).toBeTruthy();
    expect(screen.getByText("abc1234")).toBeTruthy();
    expect(screen.getByText("3 / 5")).toBeTruthy();
  });
});
