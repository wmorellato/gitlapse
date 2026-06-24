import { Player } from "@/components/Player";
import type { AnimationPayload } from "@/lib/types";
import styles from "./Landing.module.css";

interface LandingProps {
  demo: AnimationPayload | null;
}

export function Landing({ demo }: LandingProps) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Watch a file evolve across its history.</h1>
      <p className={styles.subtitle}>
        Gitlapse replays a file commit by commit — a calm, shareable diff morph.
      </p>
      {demo && (
        <div className={styles.demo}>
          <Player payload={demo} />
        </div>
      )}
      <a className={styles.cta} href="/create">
        Animate a file <span aria-hidden>→</span>
      </a>
    </main>
  );
}
