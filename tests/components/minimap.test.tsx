import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { Minimap, barWidthPercent } from "@/components/Minimap";
import type { TransitionLine } from "@/lib/diff";

const line = (text: string, type: TransitionLine["type"], key: string): TransitionLine => ({ key, text, type });

describe("barWidthPercent", () => {
  it("scales with line length and clamps between 8 and 100", () => {
    expect(barWidthPercent("")).toBe(8); // floor for empty lines
    expect(barWidthPercent("x".repeat(24))).toBeCloseTo(50, 5); // half of the 48-char full width
    expect(barWidthPercent("x".repeat(200))).toBe(100); // long lines peg at full width
  });
});

describe("Minimap", () => {
  const lines: TransitionLine[] = [
    line("short", "context", "a"),
    line("a much longer line of content here", "add", "b"),
    line("gone", "remove", "c"),
  ];

  it("renders one bar per line with the matching change type", () => {
    const { container } = render(<Minimap lines={lines} reduced={false} />);
    const bars = container.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(3);
    expect(Array.from(bars).map((b) => b.getAttribute("data-type"))).toEqual(["context", "add", "remove"]);
  });

  it("sets bar width proportional to line length", () => {
    const { container } = render(<Minimap lines={lines} reduced={false} />);
    const bars = container.querySelectorAll<HTMLElement>("[data-bar]");
    // The longer 'add' line is wider than the short 'context' line.
    expect(parseFloat(bars[1].style.width)).toBeGreaterThan(parseFloat(bars[0].style.width));
  });

  it("is hidden from assistive tech and renders under reduced motion", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <Minimap lines={lines} reduced={true} />
      </MotionConfig>
    );
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(3);
  });
});
