const PROSE_LANGUAGES = new Set(["markdown", "plaintext"]);

export interface Presentation {
  font: "prose" | "code";
  showLineNumbers: boolean;
}

export function getPresentation(language: string): Presentation {
  const isProse = PROSE_LANGUAGES.has(language);
  return { font: isProse ? "prose" : "code", showLineNumbers: !isProse };
}
