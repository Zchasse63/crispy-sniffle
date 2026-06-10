import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 1,
  // 3 workers: the ai-search edge fn rate-limits per IP (20/min) and the dev
  // server cold-compiles routes; 6-worker stampedes starve both (see
  // specs/bugs/discovery-core-bugs.md BUG-01 resolution).
  workers: 3,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    viewport: { width: 1366, height: 850 },
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
