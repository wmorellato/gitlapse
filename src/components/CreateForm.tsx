"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SseEvent { event: string; data: unknown }

function parseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SseEvent[] = [];
  for (const block of blocks) {
    const evLine = block.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (evLine && dataLine) {
      events.push({ event: evLine.slice(7), data: JSON.parse(dataLine.slice(6)) });
    }
  }
  return { events, rest };
}

export function CreateForm() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setStatus("Starting…");
    const res = await fetch("/api/animations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repoInput, filePath })
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const { events, rest } = parseChunk(buffer);
      buffer = rest;
      for (const ev of events) {
        if (ev.event === "progress") {
          const p = ev.data as { phase: string; current?: number; total?: number };
          setStatus(
            p.phase === "snapshots" ? `Extracting ${p.current}/${p.total}…`
            : p.phase === "cloning" ? "Cloning…" : "Reading history…"
          );
        } else if (ev.event === "done") {
          router.push(`/a/${(ev.data as { id: string }).id}`);
          return;
        } else if (ev.event === "error") {
          setError((ev.data as { message: string }).message);
          setBusy(false); setStatus(null);
        }
      }
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "10vh auto", padding: 16 }}>
      <h1>Animate a file's history</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Repository URL
          <input value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
            placeholder="https://github.com/owner/repo" required style={{ width: "100%" }} />
        </label>
        <label>File path
          <input value={filePath} onChange={(e) => setFilePath(e.target.value)}
            placeholder="src/index.ts" required style={{ width: "100%" }} />
        </label>
        <button type="submit" disabled={busy}>Animate</button>
      </form>
      {status && <p>{status}</p>}
      {error && <p role="alert" style={{ color: "#b00" }}>{error}</p>}
    </main>
  );
}
