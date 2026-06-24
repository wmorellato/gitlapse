import { describe, it, expect } from "vitest";
import { MAX_COMMITS, MAX_FILE_BYTES, MAX_PAYLOAD_BYTES, ALLOWED_HOSTS, parseExampleIds } from "@/lib/constants";

describe("constants", () => {
  it("matches the spec caps", () => {
    expect(MAX_COMMITS).toBe(100);
    expect(MAX_FILE_BYTES).toBe(262144);
    expect(MAX_PAYLOAD_BYTES).toBe(5242880);
    expect(ALLOWED_HOSTS).toEqual(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);
  });
});

describe("parseExampleIds", () => {
  it("returns [] when the value is unset", () => {
    expect(parseExampleIds(undefined)).toEqual([]);
  });

  it("returns [] for an empty or whitespace string", () => {
    expect(parseExampleIds("")).toEqual([]);
    expect(parseExampleIds("   ")).toEqual([]);
  });

  it("splits on commas, trims, and drops empty entries", () => {
    expect(parseExampleIds(" a , b ,, c,")).toEqual(["a", "b", "c"]);
  });
});
