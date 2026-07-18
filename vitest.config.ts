import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
