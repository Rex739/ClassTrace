import { z } from "zod";
import { AnalysisRequestSchema, type AnalysisRequest } from "@/lib/ai/schemas";
import { ClassTraceError } from "@/lib/ai/errors";

export function parseAnalysisPayload(value: unknown): AnalysisRequest {
  const parsed = AnalysisRequestSchema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "The analysis request is incomplete.";
    throw new ClassTraceError("INVALID_INPUT", message, false, 400);
  }
  return parsed.data;
}

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).strict(),
}).strict();
