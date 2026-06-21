import { execFile } from "node:child_process";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";

export function isBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

export function getFileAt(repoDir: string, sha: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", repoDir, "show", `${sha}:${filePath}`],
      { encoding: "buffer", maxBuffer: MAX_FILE_BYTES },
      (err, stdout) => {
        if (err) {
          const e = err as NodeJS.ErrnoException;
          // Output exceeded maxBuffer => the file is larger than the cap.
          if (e.code === "ERR_CHILD_PROCESS_STDOUT_MAXBUFFER" || /maxBuffer/i.test(String(err.message))) {
            reject(new ValidationError("too_large", "That file is too large to animate (max 256 KB)."));
            return;
          }
          // Otherwise the path is absent at this commit (e.g. a deletion) => empty content.
          resolve("");
          return;
        }
        const buf = stdout as Buffer;
        if (buf.byteLength > MAX_FILE_BYTES) {
          reject(new ValidationError("too_large", "That file is too large to animate (max 256 KB)."));
          return;
        }
        if (isBinary(buf)) {
          reject(new ValidationError("binary", "That looks like a binary file — only text/code files are supported."));
          return;
        }
        resolve(buf.toString("utf8"));
      }
    );
  });
}
