import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "@/components/Landing";
import type { AnimationPayload } from "@/lib/types";

beforeAll(() => {
  // Player calls scrollTo on the viewport; jsdom doesn't implement it.
  Element.prototype.scrollTo = vi.fn();
});

const demo: AnimationPayload = {
  version: 1,
  repo: { url: null, displayName: "demo-repo" },
  filePath: "src/index.ts",
  language: "typescript",
  truncated: false,
  commits: [
    {
      sha: "1",
      shortSha: "1111111",
      message: "init",
      author: { name: "D", email: "d@x" },
      timestamp: "2026-01-01T00:00:00Z",
      content: "hello",
      status: "added"
    }
  ]
};

describe("Landing", () => {
  it("renders the headline and a CTA to /create", () => {
    render(<Landing demo={null} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    const cta = screen.getByRole("link", { name: /animate a file/i });
    expect(cta.getAttribute("href")).toBe("/create");
  });

  it("omits the demo player when no example resolves", () => {
    render(<Landing demo={null} />);
    expect(screen.queryByText(/demo-repo/)).toBeNull();
  });

  it("renders the demo player when an example is provided", () => {
    render(<Landing demo={demo} />);
    // Player's header shows "<displayName> · <filePath>".
    expect(screen.getByText(/demo-repo/)).toBeTruthy();
  });
});
