import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  projects: [
    { name: "setup", testMatch: /fixture-repo\.setup\.ts/ },
    { name: "e2e", dependencies: ["setup"], testMatch: /\.spec\.ts/ }
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/create",
    timeout: 120000,
    env: {
      ALLOW_LOCAL_PATHS: "1",
      LOCAL_ROOT: process.env.E2E_LOCAL_ROOT ?? "/tmp",
      DB_FILE: ".data/e2e.db"
    }
  },
  use: { baseURL: "http://localhost:3000" }
});
