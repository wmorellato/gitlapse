import { describe, it, expect } from "vitest";
import { getPresentation } from "@/lib/presentation";

describe("getPresentation", () => {
  it("treats markdown and plaintext as prose without line numbers", () => {
    expect(getPresentation("markdown")).toEqual({ font: "prose", showLineNumbers: false });
    expect(getPresentation("plaintext")).toEqual({ font: "prose", showLineNumbers: false });
  });
  it("treats code languages as monospace with line numbers", () => {
    expect(getPresentation("typescript")).toEqual({ font: "code", showLineNumbers: true });
    expect(getPresentation("python")).toEqual({ font: "code", showLineNumbers: true });
  });
});
