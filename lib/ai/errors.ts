import OpenAI from "openai";
import { z } from "zod";

export type ClassTraceErrorCode =
  | "MISSING_API_KEY"
  | "API_TIMEOUT"
  | "MODEL_REFUSAL"
  | "MALFORMED_OUTPUT"
  | "UNSUPPORTED_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "INVALID_INPUT"
  | "INCOMPLETE_ANALYSIS"
  | "NETWORK_INTERRUPTION"
  | "RATE_LIMITED"
  | "OPENAI_ERROR";

export class ClassTraceError extends Error {
  constructor(
    public readonly code: ClassTraceErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "ClassTraceError";
  }
}

export function toClassTraceError(error: unknown): ClassTraceError {
  if (error instanceof ClassTraceError) return error;
  if (error instanceof z.ZodError) return new ClassTraceError("MALFORMED_OUTPUT", "The model response did not match the required evidence structure.", true, 502);
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new ClassTraceError("API_TIMEOUT", "The live analysis took too long. Please retry.", true, 504);
  if (error instanceof OpenAI.RateLimitError) {
    if (error.code === "insufficient_quota") return new ClassTraceError("RATE_LIMITED", "Live GPT-5.6 quota is unavailable. Check the API plan and billing before trying again.", false, 429);
    return new ClassTraceError("RATE_LIMITED", "Live analysis is temporarily rate limited. Wait briefly, then retry.", true, 429);
  }
  if (error instanceof OpenAI.APIConnectionError) return new ClassTraceError("NETWORK_INTERRUPTION", "The connection to the analysis service was interrupted.", true, 503);
  if (error instanceof OpenAI.APIError) {
    const retryable = error.status === 408 || error.status === 409 || error.status === 429 || (error.status ?? 0) >= 500;
    return new ClassTraceError("OPENAI_ERROR", retryable ? "The analysis service is temporarily unavailable." : "The live analysis request could not be completed.", retryable, error.status ?? 502);
  }
  return new ClassTraceError("OPENAI_ERROR", "An unexpected analysis error occurred.", false, 500);
}

export function safeErrorPayload(error: unknown) {
  const safe = toClassTraceError(error);
  return { code: safe.code, message: safe.message, retryable: safe.retryable };
}
