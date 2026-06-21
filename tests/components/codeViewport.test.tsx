import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CodeViewport } from "@/components/CodeViewport";

describe("CodeViewport", () => {
  it("renders one row per line with change annotations", () => {
    const { container } = render(<CodeViewport content={"a\nb\nc"} prevContent={"a\nc"} />);
    const rows = container.querySelectorAll("[data-line]");
    expect(rows).toHaveLength(3);
    const added = container.querySelectorAll('[data-change="add"]');
    expect(added).toHaveLength(1); // "b" is new
  });
});
