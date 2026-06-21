import { extractAnimation, type Progress } from "@/lib/extract";
import { createAnimation } from "@/lib/store/animations";
import { ValidationError } from "@/lib/validate";
import { tryAcquireSlot, checkRateLimit } from "@/lib/limits";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request): Promise<Response> {
  let body: { repoInput?: string; filePath?: string } = {};
  try {
    body = (await req.json()) as { repoInput?: string; filePath?: string };
  } catch {
    body = {};
  }
  const { repoInput, filePath } = body;
  const ip = clientIp(req);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(sse(event, data)));

      if (!checkRateLimit(ip)) {
        send("error", { message: "Too many requests — please wait a minute and try again.", code: "rate_limited" });
        controller.close();
        return;
      }
      const release = tryAcquireSlot();
      if (!release) {
        send("error", { message: "The server is busy — please try again shortly.", code: "busy" });
        controller.close();
        return;
      }
      try {
        if (!repoInput || !filePath) {
          throw new ValidationError("bad_input", "Repository and file path are required.");
        }
        const onProgress = (p: Progress) => send("progress", p);
        const payload = await extractAnimation({ repoInput, filePath }, onProgress);
        const { id } = createAnimation(payload);
        send("done", { id });
      } catch (err) {
        const code = err instanceof ValidationError ? err.code : "internal";
        const message = err instanceof ValidationError ? err.message : "Something went wrong.";
        if (!(err instanceof ValidationError)) console.error("extract failed:", err);
        send("error", { message, code });
      } finally {
        release();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
