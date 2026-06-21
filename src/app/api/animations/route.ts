import { extractAnimation, type Progress } from "@/lib/extract";
import { createAnimation } from "@/lib/store/animations";
import { ValidationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  const { repoInput, filePath } = (await req.json()) as { repoInput?: string; filePath?: string };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(sse(event, data)));
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
