"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CreateForm.module.css";

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
    try {
      const res = await fetch("/api/animations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoInput, filePath })
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
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
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Gitlapse</h1>
        <p className={styles.subtitle}>Watch a file evolve across its history.</p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className={styles.field}>Repository URL
            <input className={styles.input} value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
              placeholder="https://github.com/owner/repo" required />
          </label>
          <label className={styles.field}>File path
            <input className={styles.input} value={filePath} onChange={(e) => setFilePath(e.target.value)}
              placeholder="src/index.ts" required />
          </label>
          <button className={styles.button} type="submit" disabled={busy}>Animate</button>
        </form>
        {status && <p className={styles.status}>{status}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
