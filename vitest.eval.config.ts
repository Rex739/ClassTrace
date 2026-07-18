import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const localEnvPath = path.resolve(process.cwd(), ".env.local");
if (!process.env.OPENAI_API_KEY && existsSync(localEnvPath)) {
  const keyLine = readFileSync(localEnvPath, "utf8").split(/\r?\n/).find((line) => line.startsWith("OPENAI_API_KEY="));
  const localKey = keyLine?.slice("OPENAI_API_KEY=".length).trim().replace(/^(['\"])(.*)\1$/, "$2");
  if (localKey) process.env.OPENAI_API_KEY = localKey;
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["eval/**/*.eval.test.ts"], testTimeout: 240_000 },
});
