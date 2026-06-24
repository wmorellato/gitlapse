# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root redirect with a calm landing page that autoplays a curated example morph (with a graceful no-demo fallback) and links to `/create`.

**Architecture:** The root route (`/`) becomes a server component that resolves a pinned example animation from the DB and renders a presentational `Landing` component. `Landing` reuses the existing `Player` to display the demo, falling back to a headline-plus-CTA layout when no example resolves. `/create` and `/a/<id>` are untouched.

**Tech Stack:** Next.js 15 (App Router, server components), React 19, TypeScript, `motion`, `better-sqlite3`, Vitest + Testing Library, Playwright.

## Global Constraints

- Node `>= 20`.
- Stay on-brand per `DESIGN.md`/`PRODUCT.md`: content-first, one ember accent (`var(--accent)` / `#c2410c`), nothing larger than ~22px (No-Hero rule), no marketing scaffold (no eyebrows, hero-metrics, or card grids).
- Honor `prefers-reduced-motion` — inherited from `Player`; the landing adds no new motion.
- Tests use Vitest globals + `@testing-library/react`; assert with `.toBeTruthy()` (this repo does **not** use jest-dom matchers).
- Component tests that render `Player` must first stub `Element.prototype.scrollTo = vi.fn()` (jsdom lacks it).
- Path alias `@` → `src` (configured in `vitest.config.ts` and `tsconfig.json`).
- Commit messages follow conventional commits (`feat:`, `test:`, etc.).

---

### Task 1: Config — parse pinned example ids

**Files:**
- Modify: `src/lib/constants.ts` (append)
- Test: `tests/lib/constants.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseExampleIds(raw: string | undefined): string[]`
  - `LANDING_EXAMPLE_IDS: string[]` (computed from `process.env.LANDING_EXAMPLE_IDS`)

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/constants.test.ts`:

```ts
import { parseExampleIds } from "@/lib/constants";

describe("parseExampleIds", () => {
  it("returns [] when the value is unset", () => {
    expect(parseExampleIds(undefined)).toEqual([]);
  });

  it("returns [] for an empty or whitespace string", () => {
    expect(parseExampleIds("")).toEqual([]);
    expect(parseExampleIds("   ")).toEqual([]);
  });

  it("splits on commas, trims, and drops empty entries", () => {
    expect(parseExampleIds(" a , b ,, c,")).toEqual(["a", "b", "c"]);
  });
});
```

Note: keep the existing top-of-file `import { MAX_COMMITS, ... } from "@/lib/constants"` line; add `parseExampleIds` to that import instead of duplicating the import if you prefer — either works.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: FAIL — `parseExampleIds is not a function` (or import error).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/constants.ts`:

```ts
export function parseExampleIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Pinned /a/<id> ids to showcase on the landing page, in priority order.
export const LANDING_EXAMPLE_IDS = parseExampleIds(process.env.LANDING_EXAMPLE_IDS);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: PASS (existing `constants` tests still pass too).

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts tests/lib/constants.test.ts
git commit -m "feat: parse LANDING_EXAMPLE_IDS env into pinned id list"
```

---

### Task 2: Resolve the landing demo payload

**Files:**
- Create: `src/lib/landing.ts`
- Test: `tests/lib/landing.test.ts`

**Interfaces:**
- Consumes: `AnimationPayload`, `AnimationRecord` from `@/lib/types`.
- Produces:
  - `resolveLandingExample(ids: string[], find: (id: string) => AnimationRecord | null): AnimationPayload | null`
  - Returns the `payload` of the first id (in order) for which `find` returns a record; `null` if the list is empty or none resolve.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/landing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveLandingExample } from "@/lib/landing";
import type { AnimationRecord } from "@/lib/types";

function record(id: string, displayName: string): AnimationRecord {
  return {
    id,
    repoUrl: null,
    filePath: "src/index.ts",
    language: "typescript",
    commitCount: 1,
    truncated: false,
    byteSize: 1,
    createdAt: 0,
    payload: {
      version: 1,
      repo: { url: null, displayName },
      filePath: "src/index.ts",
      language: "typescript",
      truncated: false,
      commits: []
    }
  };
}

describe("resolveLandingExample", () => {
  it("returns null when the id list is empty", () => {
    expect(resolveLandingExample([], () => null)).toBeNull();
  });

  it("returns null when no id resolves", () => {
    expect(resolveLandingExample(["x", "y"], () => null)).toBeNull();
  });

  it("returns the payload of the first id that resolves, in order", () => {
    const found = resolveLandingExample(["a", "b"], (id) =>
      id === "b" ? record("b", "demo-repo") : null
    );
    expect(found?.repo.displayName).toBe("demo-repo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/landing.test.ts`
Expected: FAIL — cannot find module `@/lib/landing`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/landing.ts`:

```ts
import type { AnimationPayload, AnimationRecord } from "@/lib/types";

/**
 * Resolve the first available pinned example, in priority order.
 * `find` is injected (the route passes `findAnimation`) so this stays
 * pure and unit-testable without a database.
 */
export function resolveLandingExample(
  ids: string[],
  find: (id: string) => AnimationRecord | null
): AnimationPayload | null {
  for (const id of ids) {
    const rec = find(id);
    if (rec) return rec.payload;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/landing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing.ts tests/lib/landing.test.ts
git commit -m "feat: add resolveLandingExample to pick the first pinned demo"
```

---

### Task 3: Landing component + styles

**Files:**
- Create: `src/components/Landing.tsx`
- Create: `src/components/Landing.module.css`
- Test: `tests/components/landing.test.tsx`

**Interfaces:**
- Consumes: `Player` from `@/components/Player`, `AnimationPayload` from `@/lib/types`.
- Produces: `Landing({ demo }: { demo: AnimationPayload | null })` — renders an `<h1>` headline, a subhead `<p>`, the `Player` for `demo` when non-null, and a CTA `<a href="/create">`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "@/components/Landing";
import type { AnimationPayload } from "@/lib/types";

beforeAll(() => {
  // Player calls scrollTo on the viewport; jsdom doesn't implement it.
  Element.prototype.scrollTo = vi.fn();
});

const demo: AnimationPayload = {
  version: 1,
  repo: { url: null, displayName: "demo-repo" },
  filePath: "src/index.ts",
  language: "typescript",
  truncated: false,
  commits: [
    {
      sha: "1",
      shortSha: "1111111",
      message: "init",
      author: { name: "D", email: "d@x" },
      timestamp: "2026-01-01T00:00:00Z",
      content: "hello",
      status: "added"
    }
  ]
};

describe("Landing", () => {
  it("renders the headline and a CTA to /create", () => {
    render(<Landing demo={null} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    const cta = screen.getByRole("link", { name: /animate a file/i });
    expect(cta.getAttribute("href")).toBe("/create");
  });

  it("omits the demo player when no example resolves", () => {
    render(<Landing demo={null} />);
    expect(screen.queryByText(/demo-repo/)).toBeNull();
  });

  it("renders the demo player when an example is provided", () => {
    render(<Landing demo={demo} />);
    // Player's header shows "<displayName> · <filePath>".
    expect(screen.getByText(/demo-repo/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing.test.tsx`
Expected: FAIL — cannot find module `@/components/Landing`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/Landing.tsx`:

```tsx
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
```

Create `src/components/Landing.module.css`:

```css
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-6);
  text-align: center;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}
.subtitle {
  margin: 0;
  max-width: 52ch;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}
.demo {
  width: 100%;
  max-width: 900px;
}
.cta {
  display: inline-flex;
  align-items: center;
  height: 42px;
  padding: 0 var(--space-4);
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/Landing.tsx src/components/Landing.module.css tests/components/landing.test.tsx
git commit -m "feat: add Landing component with optional autoplaying demo and CTA"
```

---

### Task 4: Wire the root route + E2E

**Files:**
- Modify: `src/app/page.tsx` (replace the redirect)
- Test: `tests/e2e/landing.spec.ts` (new Playwright spec)

**Interfaces:**
- Consumes: `LANDING_EXAMPLE_IDS` from `@/lib/constants`, `resolveLandingExample` from `@/lib/landing`, `findAnimation` from `@/lib/store/animations`, `Landing` from `@/components/Landing`.
- Produces: the `/` route renders `<Landing demo={...} />`.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/landing.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("landing page shows the CTA and links to create", async ({ page }) => {
  await page.goto("/");
  // Headline is present (no redirect away from root).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // CTA navigates to the create flow.
  await page.getByRole("link", { name: /animate a file/i }).click();
  await page.waitForURL(/\/create$/);
  await expect(page.getByRole("button", { name: /animate/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `npm run e2e -- landing.spec.ts`
Expected: FAIL — `/` redirects to `/create`, so there is no level-1 heading matching the landing headline (the create page heading is "Commit Animation", and the CTA link is absent).

Note: if `npm run e2e` reports the dev server isn't running, start it in another shell with `npm run dev` (the Playwright config drives `http://localhost:3000`).

- [ ] **Step 3: Replace the root route**

Overwrite `src/app/page.tsx`:

```tsx
import { LANDING_EXAMPLE_IDS } from "@/lib/constants";
import { resolveLandingExample } from "@/lib/landing";
import { findAnimation } from "@/lib/store/animations";
import { Landing } from "@/components/Landing";

export default function Home() {
  const demo = resolveLandingExample(LANDING_EXAMPLE_IDS, (id) => findAnimation(id));
  return <Landing demo={demo} />;
}
```

Note: `findAnimation` lazily opens `better-sqlite3` at call time (see `src/lib/store/db.ts`), matching how `/a/[id]` already reads the DB in a server component — no extra setup needed. With no pinned ids configured, `resolveLandingExample` returns `null` and the page renders the headline + CTA only.

- [ ] **Step 4: Run the E2E test to verify it passes**

Run: `npm run e2e -- landing.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS. (If sqlite-related failures appear, run `npm rebuild better-sqlite3` and re-run — see `MEMORY.md`.)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx tests/e2e/landing.spec.ts
git commit -m "feat: serve landing page at root instead of redirecting to /create"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-24-landing-page-design.md`):
- Routing: root no longer redirects; `/create` untouched → Task 4. ✓
- Config `LANDING_EXAMPLE_IDS` (comma-split, trim, empty→`[]`) → Task 1. ✓
- Demo sourcing: first resolving pinned id via `findAnimation` → Task 2 + Task 4. ✓
- Graceful fallback (no id resolves → headline + CTA, no crash) → Task 2 (returns null), Task 3 (conditional demo), tested in Task 3. ✓
- Page composition (headline, subhead, reused `Player`, single ember CTA) → Task 3. ✓
- Motion/accessibility (reduced motion inherited from `Player`; CTA focusable link) → Task 3 (no new motion; native `<a>`). ✓
- Testing (RTL render/omit demo; constants parse; E2E `/`→`/create`, create still works) → Tasks 1, 3, 4. ✓ (The existing `tests/e2e/flow.spec.ts` continues to cover the create-and-play regression.)

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full content. ✓

**Type consistency:** `resolveLandingExample(ids, find)` signature is identical in Task 2 (definition), its test, and Task 4 (call site). `Landing({ demo })` prop type `AnimationPayload | null` matches across Task 3 and Task 4. `parseExampleIds` / `LANDING_EXAMPLE_IDS` names consistent across Tasks 1 and 4. ✓
