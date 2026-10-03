import { defineConfig, devices } from "@playwright/test";

const port = 3101;

// Records the pictures in README.md from the real app: the real schedule source and
// the MongoDB in .env.local (in a database of its own). Run with `bun run media`. Not part of
// verify or the end-to-end suite.
export default defineConfig({
  testDir: "scripts/media",
  workers: 1,
  reporter: "list",
  timeout: 240_000,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "node scripts/media/server.mjs",
    env: { E2E_PORT: String(port) },
    url: `http://localhost:${port}/sign-in`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
