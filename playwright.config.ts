import { defineConfig, devices } from "@playwright/test";

import {
  LINE_LOGIN_CHANNEL_ID,
  LINE_SERVER,
  LINE_SERVER_DIR,
  LINE_SERVER_PORT,
} from "./e2e/line-server";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/server.mjs",
      env: { E2E_PORT: String(port) },
      url: `http://localhost:${port}/sign-in`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "node e2e/server.mjs",
      env: {
        E2E_PORT: String(LINE_SERVER_PORT),
        E2E_DIR: LINE_SERVER_DIR,
        E2E_SKIP_BUILD: "1",
        E2E_LINE_LOGIN_CHANNEL_ID: LINE_LOGIN_CHANNEL_ID,
        E2E_LINE_LOGIN_CHANNEL_SECRET: "e2e-only-not-a-real-channel-secret",
      },
      url: `${LINE_SERVER}/sign-in`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
