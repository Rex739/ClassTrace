import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { ClassTraceError } from "@/lib/ai/errors";
import { getOpenAIClient, CLASSTRACE_MODEL } from "@/lib/ai/openai";
import { buildTransferPrompt } from "@/lib/ai/prompts";
import { TransferEvaluationSchema, type TransferEvaluation, type TransferRequestSchema } from "@/lib/ai/schemas";
import type { z } from "zod";
import { getResponseRefusal } from "@/lib/ai/response";

type TransferRequest = z.infer<typeof TransferRequestSchema>;

export async function evaluateTransfer(input: TransferRequest): Promise<TransferEvaluation> {
  const prompt = buildTransferPrompt(input);
  const response = await getOpenAIClient().responses.parse({
    model: CLASSTRACE_MODEL,
    instructions: prompt.instructions,
    input: prompt.content,
    reasoning: { effort: "medium" },
    text: { format: zodTextFormat(TransferEvaluationSchema, "classtrace_transfer_evaluation") },
    store: false,
  });
  if (getResponseRefusal(response)) throw new ClassTraceError("MODEL_REFUSAL", "GPT-5.6 declined to evaluate this transfer response. Ask the teacher to review it directly.", false, 422);
  if (!response.output_parsed) throw new ClassTraceError("MALFORMED_OUTPUT", "GPT-5.6 did not return a valid transfer evaluation.", true, 502);
  const parsed = TransferEvaluationSchema.parse(response.output_parsed);
  if (parsed.evidenceExcerpt && !`${input.learnerAnswer}\n${input.learnerExplanation}`.includes(parsed.evidenceExcerpt)) throw new ClassTraceError("MALFORMED_OUTPUT", "Transfer evidence was not found verbatim in the learner submission.", true, 502);
  return TransferEvaluationSchema.parse({ ...parsed, requiresTeacherReview: parsed.requiresTeacherReview || parsed.confidence < 0.7 });
}
