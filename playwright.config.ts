import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3216", headless: true },
  webServer: {
    command: "npm run start -- --port 3216",
    url: "http://127.0.0.1:3216",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
