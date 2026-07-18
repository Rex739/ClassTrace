import "server-only";

import OpenAI from "openai";
import { ClassTraceError } from "@/lib/ai/errors";

export const CLASSTRACE_MODEL = "gpt-5.6" as const;

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ClassTraceError("MISSING_API_KEY", "Live GPT-5.6 analysis is not configured. Add OPENAI_API_KEY or open the prepared demonstration.", false, 503);
  client ??= new OpenAI({ apiKey, timeout: 90_000, maxRetries: 2 });
  return client;
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
