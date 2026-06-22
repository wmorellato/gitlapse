import { describe, it, expect } from "vitest";
import { toKeys, buildTransition } from "@/lib/diff";

describe("toKeys", () => {
  it("disambiguates duplicate lines by occurrence", () => {
    expect(toKeys("a\na\nb")).toEqual(["a#0", "a#1", "b#0"]);
  });
  it("returns one entry for empty content", () => {
    expect(toKeys("")).toEqual(["#0"]);
  });
});

describe("buildTransition", () => {
  it("marks added, removed, and context lines in order", () => {
    const t = buildTransition("a\nb\nc", "a\nx\nc");
    expect(t.map((l) => [l.type, l.text])).toEqual([
      ["context", "a"],
      ["remove", "b"],
      ["add", "x"],
      ["context", "c"]
    ]);
  });

  it("returns all context for identical input", () => {
    const t = buildTransition("a\nb", "a\nb");
    expect(t.every((l) => l.type === "context")).toBe(true);
    expect(t.map((l) => l.text)).toEqual(["a", "b"]);
  });

  it("gives context/add lines keys matching their occurrence in next", () => {
    const t = buildTransition("a", "a\nb");
    const aLine = t.find((l) => l.text === "a")!;
    const bLine = t.find((l) => l.text === "b")!;
    expect(aLine).toMatchObject({ type: "context", key: "n a 0" });
    expect(bLine).toMatchObject({ type: "add", key: "n b 0" });
  });

  it("keeps removed-line keys in a separate namespace", () => {
    const t = buildTransition("gone", "kept");
    expect(t.find((l) => l.type === "remove")!.key.startsWith("r ")).toBe(true);
  });

  it("handles all-added and all-removed", () => {
    expect(buildTransition("", "x\ny").filter((l) => l.type === "add")).toHaveLength(2);
    expect(buildTransition("x\ny", "").filter((l) => l.type === "remove")).toHaveLength(2);
  });

  it("produces unique keys even when next text mimics the remove namespace", () => {
    const t = buildTransition("x\nkeep", "r x\nkeep");
    const keys = t.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to remove-all-then-add-all for very large diffs", () => {
    const prev = Array.from({ length: 2001 }, (_, i) => `a${i}`).join("\n");
    const next = Array.from({ length: 2001 }, (_, i) => `b${i}`).join("\n");
    const t = buildTransition(prev, next);
    expect(t.slice(0, 2001).every((l) => l.type === "remove")).toBe(true);
    expect(t.slice(2001).every((l) => l.type === "add")).toBe(true);
  });
});
