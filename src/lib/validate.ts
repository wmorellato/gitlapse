import { promises as dns } from "node:dns";
import path from "node:path";
import { ALLOWED_HOSTS } from "@/lib/constants";

export class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
    this.name = "ValidationError";
  }
}

export function validateFilePath(filePath: string): string {
  const original = filePath.trim();
  if (path.posix.isAbsolute(original)) {
    throw new ValidationError("bad_path", "That path isn't allowed.");
  }
  const trimmed = original.replace(/^\/+/, "");
  if (trimmed === "") throw new ValidationError("bad_path", "File path is required.");
  const normalized = path.posix.normalize(trimmed);
  if (normalized.startsWith("..") || normalized.includes("/../") || path.posix.isAbsolute(normalized)) {
    throw new ValidationError("bad_path", "That path isn't allowed.");
  }
  return normalized;
}

export function validateRepoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError("bad_url", "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new ValidationError("bad_url", "Only https:// repository URLs are supported.");
  }
  if (url.username || url.password) {
    throw new ValidationError("bad_url", "Remove credentials from the URL.");
  }
  if (!ALLOWED_HOSTS.includes(url.hostname as (typeof ALLOWED_HOSTS)[number])) {
    throw new ValidationError("bad_url", "That repository host isn't supported.");
  }
  return url;
}

export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — re-check the embedded IPv4.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIp(mapped[1]);
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new ValidationError("bad_url", "That host could not be resolved to a public address.");
  }
}

export function validateLocalPath(raw: string): string {
  if (process.env.ALLOW_LOCAL_PATHS !== "1") {
    throw new ValidationError("local_disabled", "Local repositories are not enabled.");
  }
  const resolved = path.resolve(raw);
  const root = path.resolve(process.env.LOCAL_ROOT || ".");
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ValidationError("bad_path", "That path is outside the allowed root.");
  }
  return resolved;
}
