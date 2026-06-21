import type Database from "better-sqlite3";
import { findAnimation } from "@/lib/store/animations";

interface Ctx {
  params: Promise<{ id: string }>;
  db?: Database.Database; // test injection only
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const rec = findAnimation(id, ctx.db);
  if (!rec) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }
  return Response.json({
    payload: rec.payload,
    meta: { id: rec.id, createdAt: rec.createdAt, commitCount: rec.commitCount, truncated: rec.truncated }
  });
}
