import { defineConfig, devices } from "@playwright/test";

const port = 3101;

// Records the pictures and the clip in README.md from the real app with the fake sources.
// Run with `bun run media`. Not part of verify or the end-to-end suite.
export default defineConfig({
  testDir: "scripts/media",
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    baseURL: `http://localhost:${port}`,
    video: { mode: "on", size: { width: 1440, height: 900 } },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/server.mjs",
    env: { E2E_PORT: String(port) },
    url: `http://localhost:${port}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
