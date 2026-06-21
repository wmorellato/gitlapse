import { describe, it, expect } from "vitest";
import { toKeys, toRenderLines } from "@/lib/diff";

describe("toKeys", () => {
  it("disambiguates duplicate lines by occurrence", () => {
    expect(toKeys("a\na\nb")).toEqual(["a#0", "a#1", "b#0"]);
  });
  it("returns one entry for empty content", () => {
    expect(toKeys("")).toEqual(["#0"]);
  });
});

describe("toRenderLines", () => {
  it("marks brand-new lines as add and retained lines as context", () => {
    const lines = toRenderLines("a\nb\nc", "a\nc");
    expect(lines.map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(lines.map((l) => l.change)).toEqual(["context", "add", "context"]);
  });
  it("treats everything as add when there is no previous frame", () => {
    const lines = toRenderLines("x\ny", null);
    expect(lines.every((l) => l.change === "add")).toBe(true);
  });
  it("gives retained lines stable keys across frames", () => {
    const prev = toRenderLines("a\nb", null);
    const next = toRenderLines("a\nb\nc", "a\nb");
    expect(next[0].key).toBe(prev[0].key);
    expect(next[1].key).toBe(prev[1].key);
  });
  it("classifies duplicates correctly when one occurrence is retained and one is new", () => {
    const lines = toRenderLines("a\na\nb", "a\nb");
    expect(lines.map((l) => l.change)).toEqual(["context", "add", "context"]);
  });
  it("gives blank lines stable keys across frames", () => {
    const prev = toRenderLines("a\n\nb", null);
    const next = toRenderLines("a\n\nb\nc", "a\n\nb");
    expect(next[1].key).toBe(prev[1].key);
    expect(next[1].change).toBe("context");
  });
});
