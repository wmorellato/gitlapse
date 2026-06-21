export interface RenderLine {
  key: string;
  text: string;
  change: "add" | "context";
}

export function toKeys(content: string): string[] {
  const seen = new Map<string, number>();
  return content.split("\n").map((text) => {
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    return `${text}#${n}`;
  });
}

export function toRenderLines(content: string, prevContent: string | null): RenderLine[] {
  const prevKeys = new Set(prevContent === null ? [] : toKeys(prevContent));
  const keys = toKeys(content);
  const texts = content.split("\n");
  return keys.map((key, i) => ({
    key,
    text: texts[i],
    change: prevContent === null || !prevKeys.has(key) ? "add" : "context"
  }));
}
