export const MAX_COMMITS = 100;
export const MAX_FILE_BYTES = 262144;        // 256 KB
export const MAX_PAYLOAD_BYTES = 5242880;    // 5 MB
export const CLONE_TIMEOUT_MS = 60000;
export const ALLOWED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"] as const;
export const BASE_DWELL_MS = 1500;
export const ALLOW_LOCAL_PATHS = process.env.ALLOW_LOCAL_PATHS === "1";
export const LOCAL_ROOT = process.env.LOCAL_ROOT ?? "";
export const MAX_CONCURRENT_EXTRACTIONS = 4;
export const RATE_LIMIT_WINDOW_MS = 60000;
export const RATE_LIMIT_MAX = 10;
