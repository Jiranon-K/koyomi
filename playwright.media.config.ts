import { defineConfig, devices } from "@playwright/test";

const port = 3101;

/* Records the README pictures from the real app (`bun run media`); not part of verify or e2e. */
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
