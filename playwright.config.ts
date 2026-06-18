import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local so opt-in signed-in specs can read SCOUT_E2E_* creds
// locally (CI won't have them → those specs skip). No dotenv dep needed.
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env.local — fine; signed-in specs will skip
}

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
