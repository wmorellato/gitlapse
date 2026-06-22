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

export interface TransitionLine {
  key: string;
  text: string;
  type: "context" | "add" | "remove";
}

// Guard: skip the O(n*m) LCS for very large differing middles; fall back to
// "remove all, then add all" so we never blow up memory on huge files.
const LCS_CELL_LIMIT = 4_000_000;

export function buildTransition(prev: string, next: string): TransitionLine[] {
  const a = prev.split("\n");
  const b = next.split("\n");
  const out: TransitionLine[] = [];

  const seenNext = new Map<string, number>();
  const seenRemoved = new Map<string, number>();
  const emitNext = (text: string, type: "context" | "add") => {
    const n = seenNext.get(text) ?? 0;
    seenNext.set(text, n + 1);
    out.push({ key: `n ${text} ${n}`, text, type });
  };
  const emitRemove = (text: string) => {
    const n = seenRemoved.get(text) ?? 0;
    seenRemoved.set(text, n + 1);
    out.push({ key: `r ${text} ${n}`, text, type: "remove" });
  };

  // Trim common prefix (emitted as context, in next order).
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) {
    emitNext(a[lo], "context");
    lo++;
  }
  // Measure common suffix (emitted later, after the middle).
  let aHi = a.length;
  let bHi = b.length;
  let suffix = 0;
  while (aHi - 1 >= lo && bHi - 1 >= lo && a[aHi - 1] === b[bHi - 1]) {
    aHi--;
    bHi--;
    suffix++;
  }

  const aMid = a.slice(lo, aHi);
  const bMid = b.slice(lo, bHi);
  const m = aMid.length;
  const n = bMid.length;

  if (m * n > LCS_CELL_LIMIT) {
    for (const t of aMid) emitRemove(t);
    for (const t of bMid) emitNext(t, "add");
  } else {
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = aMid[i] === bMid[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (aMid[i] === bMid[j]) {
        emitNext(aMid[i], "context");
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        emitRemove(aMid[i]);
        i++;
      } else {
        emitNext(bMid[j], "add");
        j++;
      }
    }
    while (i < m) emitRemove(aMid[i++]);
    while (j < n) emitNext(bMid[j++], "add");
  }

  for (let k = 0; k < suffix; k++) emitNext(b[bHi + k], "context");
  return out;
}
