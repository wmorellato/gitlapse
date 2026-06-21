import { test as setup } from "@playwright/test";
import { buildRepo } from "../fixtures/git";
import { promises as fs } from "node:fs";

setup("create fixture repo", async () => {
  const dir = await buildRepo([
    { path: "demo.txt", content: "hello", message: "add demo" },
    { path: "demo.txt", content: "hello\nworld", message: "extend demo" }
  ]);
  await fs.mkdir(".data", { recursive: true });
  await fs.writeFile(".data/e2e-repo-path", dir);
});
