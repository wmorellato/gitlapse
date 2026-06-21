import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns", () => {
  const mocked = { promises: { lookup: vi.fn() } };
  return { ...mocked, default: mocked };
});

import { promises as dns } from "node:dns";
import { assertPublicHost, ValidationError } from "@/lib/validate";

const lookup = dns.lookup as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => lookup.mockReset());

describe("assertPublicHost", () => {
  it("rejects a host that resolves to a private IP", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
    await expect(assertPublicHost("evil.test")).rejects.toBeInstanceOf(ValidationError);
  });
  it("rejects a host with no DNS records", async () => {
    lookup.mockResolvedValue([]);
    await expect(assertPublicHost("nothing.test")).rejects.toBeInstanceOf(ValidationError);
  });
  it("allows a host that resolves to a public IP", async () => {
    lookup.mockResolvedValue([{ address: "140.82.112.3", family: 4 }]);
    await expect(assertPublicHost("github.com")).resolves.toBeUndefined();
  });
});
