import { describe, it, expect } from "vitest";
import { resolveLandingExample } from "@/lib/landing";
import type { AnimationRecord } from "@/lib/types";

function record(id: string, displayName: string): AnimationRecord {
  return {
    id,
    repoUrl: null,
    filePath: "src/index.ts",
    language: "typescript",
    commitCount: 1,
    truncated: false,
    byteSize: 1,
    createdAt: 0,
    payload: {
      version: 1,
      repo: { url: null, displayName },
      filePath: "src/index.ts",
      language: "typescript",
      truncated: false,
      commits: []
    }
  };
}

describe("resolveLandingExample", () => {
  it("returns null when the id list is empty", () => {
    expect(resolveLandingExample([], () => null)).toBeNull();
  });

  it("returns null when no id resolves", () => {
    expect(resolveLandingExample(["x", "y"], () => null)).toBeNull();
  });

  it("returns the payload of the first id that resolves, in order", () => {
    const found = resolveLandingExample(["a", "b"], (id) =>
      id === "b" ? record("b", "demo-repo") : null
    );
    expect(found?.repo.displayName).toBe("demo-repo");
  });
});
