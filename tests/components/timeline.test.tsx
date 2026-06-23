import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Timeline } from "@/components/Timeline";

describe("Timeline", () => {
  it("renders a tick per commit for short histories", () => {
    const { container } = render(<Timeline index={0} count={4} onSeek={vi.fn()} />);
    expect(container.querySelectorAll("[data-tick]").length).toBe(4);
  });

  it("omits ticks for long histories to avoid crowding", () => {
    const { container } = render(<Timeline index={0} count={80} onSeek={vi.fn()} />);
    expect(container.querySelectorAll("[data-tick]").length).toBe(0);
  });

  it("fills the track in ember up to the current position", () => {
    const { container } = render(<Timeline index={2} count={5} onSeek={vi.fn()} />);
    const range = container.querySelector("input[type=range]") as HTMLInputElement;
    // 2 of 4 steps = 50% filled
    expect(range.style.background).toContain("50%");
    expect(range.style.background).toContain("--accent");
  });
});
