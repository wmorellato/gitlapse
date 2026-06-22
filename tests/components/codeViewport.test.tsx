import { describe, it, expect, beforeAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { CodeViewport } from "@/components/CodeViewport";

beforeAll(() => {
  // jsdom has no layout/scroll; stub so the scroll effect doesn't throw.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CodeViewport", () => {
  it("renders one row per line on first paint (all context)", () => {
    const { container } = render(
      <CodeViewport content={"a\nb\nc"} prevContent={null} language="plaintext" dwellMs={1500} scrubbing={false} />
    );
    expect(container.querySelectorAll("[data-line]")).toHaveLength(3);
  });

  it("omits the line-number gutter for prose and includes it for code", () => {
    const prose = render(
      <CodeViewport content={"hello world"} prevContent={null} language="markdown" dwellMs={1500} scrubbing={false} />
    );
    expect(prose.container.querySelector("[data-gutter]")).toBeNull();

    const code = render(
      <CodeViewport content={"const x = 1"} prevContent={null} language="typescript" dwellMs={1500} scrubbing={false} />
    );
    expect(code.container.querySelector("[data-gutter]")).not.toBeNull();
  });
});
