import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "mcp/**/*.test.ts"],
    pool: "threads",
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});
