import { notFound } from "next/navigation";
import { findAnimation } from "@/lib/store/animations";
import { Player } from "@/components/Player";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = findAnimation(id);
  if (!rec) notFound();
  return <Player payload={rec.payload} />;
}
