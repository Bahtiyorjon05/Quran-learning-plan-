import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Neon lives in Frankfurt; a round trip from here is not instant.
    testTimeout: 45_000,
    hookTimeout: 45_000,
    // Integration tests share one database, so they must not race each other.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
});
