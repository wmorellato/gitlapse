import { LANDING_EXAMPLE_IDS } from "@/lib/constants";
import { resolveLandingExample } from "@/lib/landing";
import { findAnimation } from "@/lib/store/animations";
import { Landing } from "@/components/Landing";

export default function Home() {
  const demo = resolveLandingExample(LANDING_EXAMPLE_IDS, (id) => findAnimation(id));
  return <Landing demo={demo} />;
}
