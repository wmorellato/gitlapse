import { Player } from "@/components/Player";
import type { AnimationPayload } from "@/lib/types";
import styles from "./Landing.module.css";

export function Landing({ demo }: { demo: AnimationPayload | null }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Watch a file evolve across its history.</h1>
      <p className={styles.subtitle}>
        Commit Animation replays a file commit by commit — a calm, shareable diff morph.
      </p>
      {demo && (
        <div className={styles.demo}>
          <Player payload={demo} />
        </div>
      )}
      <a className={styles.cta} href="/create">
        Animate a file →
      </a>
    </main>
  );
}
