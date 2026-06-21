const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cs: "csharp",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml",
  md: "markdown", html: "html", css: "css", sh: "bash", sql: "sql"
};

export function detectLanguage(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? "plaintext";
}
