import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  validateFilePath,
  validateRepoUrl,
  isPrivateIp,
  validateLocalPath,
  ValidationError
} from "@/lib/validate";

describe("validateFilePath", () => {
  it("accepts a normal relative path", () => {
    expect(validateFilePath("src/foo.ts")).toBe("src/foo.ts");
  });
  it("rejects traversal and absolute paths", () => {
    expect(() => validateFilePath("../etc/passwd")).toThrow(ValidationError);
    expect(() => validateFilePath("/etc/passwd")).toThrow(ValidationError);
  });
  it("rejects backslash (Windows-style) paths", () => {
    expect(() => validateFilePath("..\\..\\etc\\passwd")).toThrow(ValidationError);
  });
});

describe("validateRepoUrl", () => {
  it("accepts an allowlisted https host", () => {
    expect(validateRepoUrl("https://github.com/a/b").hostname).toBe("github.com");
  });
  it("rejects disallowed hosts, non-https, and embedded credentials", () => {
    expect(() => validateRepoUrl("https://evil.com/a/b")).toThrow(ValidationError);
    expect(() => validateRepoUrl("ssh://github.com/a/b")).toThrow(ValidationError);
    expect(() => validateRepoUrl("https://user:pw@github.com/a/b")).toThrow(ValidationError);
  });
});

describe("isPrivateIp", () => {
  it("flags loopback and private ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });
  it("allows public IPs", () => {
    expect(isPrivateIp("140.82.112.3")).toBe(false);
  });
  it("flags IPv4-mapped IPv6 loopback/private and allows mapped public", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:140.82.112.3")).toBe(false);
  });
});

describe("validateLocalPath", () => {
  it("throws ValidationError when ALLOW_LOCAL_PATHS is not \"1\"", () => {
    const savedAllow = process.env.ALLOW_LOCAL_PATHS;
    const savedRoot = process.env.LOCAL_ROOT;
    try {
      delete process.env.ALLOW_LOCAL_PATHS;
      delete process.env.LOCAL_ROOT;
      expect(() => validateLocalPath("/tmp/whatever")).toThrow(ValidationError);
    } finally {
      if (savedAllow === undefined) delete process.env.ALLOW_LOCAL_PATHS;
      else process.env.ALLOW_LOCAL_PATHS = savedAllow;
      if (savedRoot === undefined) delete process.env.LOCAL_ROOT;
      else process.env.LOCAL_ROOT = savedRoot;
    }
  });

  it("returns the resolved absolute path when the path is inside LOCAL_ROOT", () => {
    const savedAllow = process.env.ALLOW_LOCAL_PATHS;
    const savedRoot = process.env.LOCAL_ROOT;
    try {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "validate-test-"));
      const innerPath = path.join(tempRoot, "repo");
      process.env.ALLOW_LOCAL_PATHS = "1";
      process.env.LOCAL_ROOT = tempRoot;
      expect(validateLocalPath(innerPath)).toBe(path.resolve(innerPath));
    } finally {
      if (savedAllow === undefined) delete process.env.ALLOW_LOCAL_PATHS;
      else process.env.ALLOW_LOCAL_PATHS = savedAllow;
      if (savedRoot === undefined) delete process.env.LOCAL_ROOT;
      else process.env.LOCAL_ROOT = savedRoot;
    }
  });

  it("throws ValidationError when the path is outside LOCAL_ROOT", () => {
    const savedAllow = process.env.ALLOW_LOCAL_PATHS;
    const savedRoot = process.env.LOCAL_ROOT;
    try {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "validate-test-"));
      process.env.ALLOW_LOCAL_PATHS = "1";
      process.env.LOCAL_ROOT = tempRoot;
      expect(() => validateLocalPath("/etc/passwd")).toThrow(ValidationError);
    } finally {
      if (savedAllow === undefined) delete process.env.ALLOW_LOCAL_PATHS;
      else process.env.ALLOW_LOCAL_PATHS = savedAllow;
      if (savedRoot === undefined) delete process.env.LOCAL_ROOT;
      else process.env.LOCAL_ROOT = savedRoot;
    }
  });
});
