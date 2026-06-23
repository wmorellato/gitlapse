import { describe, it, expect, beforeAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { CodeViewport } from "@/components/CodeViewport";
import { buildTransition, type TransitionLine } from "@/lib/diff";

beforeAll(() => {
  // jsdom has no layout/scroll; stub so the auto-scroll effect doesn't throw.
  Element.prototype.scrollTo = vi.fn();
});

// An all-context (settled) view of some content, matching what the morph hook
// produces when idle.
const idle = (content: string): TransitionLine[] =>
  buildTransition(content, content).map((l) => ({ ...l, type: "context" as const }));

describe("CodeViewport", () => {
  it("renders one row per line", () => {
    const { container } = render(
      <CodeViewport lines={idle("a\nb\nc")} phase="idle" firstChangeKey={null} reduced={false} language="plaintext" holdMs={1000} />
    );
    expect(container.querySelectorAll("[data-line]")).toHaveLength(3);
  });

  it("omits the line-number gutter for prose and includes it for code", () => {
    const prose = render(
      <CodeViewport lines={idle("hello world")} phase="idle" firstChangeKey={null} reduced={false} language="markdown" holdMs={1000} />
    );
    expect(prose.container.querySelector("[data-gutter]")).toBeNull();

    const code = render(
      <CodeViewport lines={idle("const x = 1")} phase="idle" firstChangeKey={null} reduced={false} language="typescript" holdMs={1000} />
    );
    expect(code.container.querySelector("[data-gutter]")).not.toBeNull();
  });

  it("renders without crashing under reduced motion", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <CodeViewport lines={idle("line one\nline two")} phase="idle" firstChangeKey={null} reduced={true} language="plaintext" holdMs={1000} />
      </MotionConfig>
    );
    expect(container.querySelectorAll("[data-line]").length).toBeGreaterThanOrEqual(2);
  });
});
