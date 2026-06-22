export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
      <h1 style={{ margin: 0 }}>Animation not found</h1>
      <p style={{ color: "var(--text-muted)" }}>This link may be incorrect or expired.</p>
      <a href="/create">Create a new animation</a>
    </main>
  );
}
