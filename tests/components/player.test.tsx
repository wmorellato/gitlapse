import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Player } from "@/components/Player";
import type { AnimationPayload } from "@/lib/types";

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
});
