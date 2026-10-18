import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  // Each DB test boots an in-memory Postgres, which is slow on shared CI runners.
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 60_000, hookTimeout: 60_000 },
})
