import { describe, it, expect } from "vitest";
import { detectLanguage } from "@/lib/language";

describe("detectLanguage", () => {
  it("maps known extensions", () => {
    expect(detectLanguage("src/foo.ts")).toBe("typescript");
    expect(detectLanguage("a/b/main.py")).toBe("python");
    expect(detectLanguage("README.md")).toBe("markdown");
  });
  it("falls back to plaintext for unknown/none", () => {
    expect(detectLanguage("LICENSE")).toBe("plaintext");
    expect(detectLanguage("data.xyz")).toBe("plaintext");
  });
});
