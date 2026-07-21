import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, CLASSTRACE_MODEL } from "@/lib/ai/openai";
import { ClassTraceError } from "@/lib/ai/errors";
import { buildClusteringPrompt, buildIndividualAnalysisPrompt } from "@/lib/ai/prompts";
import { normalizeClassAnalysis } from "@/lib/ai/normalize";
import { AnalysisRunSchema, buildSubmissionAnalysisBatchSchema, ClassAnalysisSchema, type AnalysisRequest, type AnalysisRun } from "@/lib/ai/schemas";
import type { ValidatedImage } from "@/lib/ai/files";
import { getResponseRefusal } from "@/lib/ai/response";
import {
  buildAndValidateAnalysisInputManifest,
  executeTwoBatchAnalysisWithTimeoutFallback,
  inspectSubmissionBatchResponse,
  runSubmissionAnalysisWithRecovery,
  type SubmissionBatchExecutor,
} from "@/lib/ai/submission-batch";

export type AnalysisStage = "preparing" | "reading" | "reasoning" | "clustering" | "validating" | "review" | "complete";
export type StageReporter = (stage: AnalysisStage, message: string) => void;

export const PRIMARY_ANALYSIS_TIMEOUT_MS = 95_000;
export const FALLBACK_ANALYSIS_TIMEOUT_MS = 30_000;
export const MISSING_ID_REPAIR_TIMEOUT_MS = 10_000;
export const CLUSTERING_TIMEOUT_MS = 35_000;
export const WORST_CASE_ROUTE_BUDGET_MS =
  PRIMARY_ANALYSIS_TIMEOUT_MS
  + FALLBACK_ANALYSIS_TIMEOUT_MS
  + MISSING_ID_REPAIR_TIMEOUT_MS
  + CLUSTERING_TIMEOUT_MS;

export async function analyseClassLive(request: AnalysisRequest, images: ValidatedImage[], report: StageReporter): Promise<AnalysisRun> {
  const openai = getOpenAIClient();
  report("reading", "Reading student work");

  report("reasoning", "Reconstructing observable reasoning");
  const executeIndividualBatch: SubmissionBatchExecutor = async (batchRequest, responseIds, attempt, context) => {
    const individualPrompt = buildIndividualAnalysisPrompt({
      question: batchRequest.question,
      expectedReasoning: batchRequest.expectedReasoning,
      typedResponses: batchRequest.typedResponses,
      imageAliases: batchRequest.imageResponses.map(({ responseId, studentAlias }) => ({ responseId, studentAlias })),
    });
    const manifest = buildAndValidateAnalysisInputManifest(batchRequest, individualPrompt.content);
    if (manifest.expectedCount !== responseIds.length || manifest.expectedIds.some((responseId, index) => responseId !== responseIds[index])) {
      throw new ClassTraceError("INVALID_INPUT", "The analysis manifest does not match the requested response batch.", false, 400);
    }
    if (process.env.NODE_ENV !== "production") {
      console.info("ClassTrace individual-analysis manifest", {
        expectedCount: manifest.expectedCount,
        expectedIds: manifest.expectedIds,
        inputTypes: manifest.inputTypes,
        promptCharacterCount: manifest.promptCharacterCount,
      });
    }

    const imageContent = batchRequest.imageResponses.flatMap((descriptor) => {
      const image = images[descriptor.fileIndex];
      if (!image) throw new ClassTraceError("INVALID_INPUT", `Missing image for ${descriptor.studentAlias}.`, false, 400);
      return [
        { type: "input_text" as const, text: `----- ATTACHED IMAGE FOR RESPONSE ID: ${descriptor.responseId} -----` },
        { type: "input_image" as const, image_url: image.dataUrl, detail: "original" as const },
      ];
    });
    const schema = buildSubmissionAnalysisBatchSchema(responseIds);
    const startedAt = performance.now();
    const { data: individualResponse, request_id: requestId } = await openai.responses.parse({
      model: CLASSTRACE_MODEL,
      instructions: individualPrompt.instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: individualPrompt.content }, ...imageContent] }],
      reasoning: { effort: "medium" },
      max_output_tokens: 16_000,
      text: { format: zodTextFormat(schema, `classtrace_submission_analyses_${attempt}`) },
      store: false,
    }, { timeout: context?.timeoutMs ?? PRIMARY_ANALYSIS_TIMEOUT_MS, maxRetries: 0 }).withResponse();
    const result = {
      status: individualResponse.status ?? "unknown",
      incompleteDetails: individualResponse.incomplete_details,
      usage: individualResponse.usage ? {
        inputTokens: individualResponse.usage.input_tokens,
        outputTokens: individualResponse.usage.output_tokens,
        totalTokens: individualResponse.usage.total_tokens,
      } : null,
      outputParsed: individualResponse.output_parsed,
      refusal: getResponseRefusal(individualResponse),
      latencyMs: Math.round(performance.now() - startedAt),
      requestId,
      sdkRetryUsed: false,
      applicationRepairUsed: attempt === "repair",
    };
    if (process.env.NODE_ENV !== "production") {
      console.info(`ClassTrace individual-analysis ${attempt} response`, inspectSubmissionBatchResponse(result));
    }
    return result;
  };
  const executeWithBoundedBatching: SubmissionBatchExecutor = async (batchRequest, responseIds, attempt, context) => {
    if (attempt === "repair") {
      return executeIndividualBatch(batchRequest, responseIds, attempt, {
        batchId: "missing-id-repair",
        timeoutMs: MISSING_ID_REPAIR_TIMEOUT_MS,
      });
    }
    if (responseIds.length <= 6) {
      return executeIndividualBatch(batchRequest, responseIds, attempt, context ?? {
        batchId: "primary-1",
        timeoutMs: PRIMARY_ANALYSIS_TIMEOUT_MS,
      });
    }
    const { response, telemetry } = await executeTwoBatchAnalysisWithTimeoutFallback(
      batchRequest,
      responseIds,
      executeIndividualBatch,
      {
        primaryTimeoutMs: PRIMARY_ANALYSIS_TIMEOUT_MS,
        fallbackTimeoutMs: FALLBACK_ANALYSIS_TIMEOUT_MS,
        onFallback: () => {
          report("reasoning", "Completing a slower response group");
          console.info("ClassTrace individual-analysis timeout fallback", { timeoutFallbackUsed: true });
        },
        observeBatch: (event) => console.info("ClassTrace individual-analysis batch", event),
      },
    );
    console.info("ClassTrace individual-analysis batch summary", {
      successfulBatchIds: [...telemetry.primary, ...telemetry.fallback]
        .filter((event) => event.outcome === "completed")
        .map((event) => event.batchId),
      failedBatchIds: [...telemetry.primary, ...telemetry.fallback]
        .filter((event) => event.outcome !== "completed")
        .map((event) => event.batchId),
      primaryDurationsMs: telemetry.primary.map((event) => event.durationMs),
      timeoutFallbackUsed: telemetry.fallbackUsed,
      fallbackDurationsMs: telemetry.fallback.map((event) => event.durationMs),
      usage: [...telemetry.primary, ...telemetry.fallback].map((event) => ({ batchId: event.batchId, usage: event.usage })),
      finalResponseMembershipCount: telemetry.finalResponseMembershipCount,
    });
    return response;
  };
  const { analyses: individualAnalyses } = await runSubmissionAnalysisWithRecovery(request, executeWithBoundedBatching);

  report("clustering", "Discovering shared reasoning patterns");
  const clusterPrompt = buildClusteringPrompt({ question: request.question, analyses: individualAnalyses });
  const clusterStartedAt = performance.now();
  const { data: clusterResponse, request_id: clusterRequestId } = await openai.responses.parse({
    model: CLASSTRACE_MODEL,
    instructions: clusterPrompt.instructions,
    input: clusterPrompt.content,
    reasoning: { effort: "medium" },
    max_output_tokens: 16_000,
    text: { format: zodTextFormat(ClassAnalysisSchema, "classtrace_class_analysis") },
    store: false,
  }, { timeout: CLUSTERING_TIMEOUT_MS, maxRetries: 0 }).withResponse();
  if (process.env.NODE_ENV !== "production") {
    console.info("ClassTrace cohort-clustering response", {
      stage: "cohort-clustering-request",
      durationMs: Math.round(performance.now() - clusterStartedAt),
      status: clusterResponse.status ?? "unknown",
      incompleteReason: clusterResponse.incomplete_details?.reason ?? null,
      requestId: clusterRequestId,
      usage: clusterResponse.usage ? {
        inputTokens: clusterResponse.usage.input_tokens,
        outputTokens: clusterResponse.usage.output_tokens,
        totalTokens: clusterResponse.usage.total_tokens,
      } : null,
      parsedItemCount: clusterResponse.output_parsed?.clusters.length ?? 0,
      sdkRetryUsed: false,
      applicationRepairUsed: false,
    });
  }
  if (clusterResponse.status === "incomplete") {
    throw new ClassTraceError("INCOMPLETE_ANALYSIS", `GPT-5.6 returned incomplete cohort clustering (${clusterResponse.incomplete_details?.reason ?? "unknown_reason"}).`, true, 502);
  }
  const clusterRefusal = getResponseRefusal(clusterResponse);
  if (clusterRefusal) throw new ClassTraceError("MODEL_REFUSAL", "GPT-5.6 declined to cluster the class analysis.", false, 422);
  if (!clusterResponse.output_parsed) throw new ClassTraceError("MALFORMED_OUTPUT", "GPT-5.6 did not return a complete structured class analysis.", true, 502);

  report("validating", "Validating evidence and response membership");
  const classAnalysis = normalizeClassAnalysis(clusterResponse.output_parsed, individualAnalyses);
  report("review", "Preparing teacher review");
  const run = AnalysisRunSchema.parse({
    assessment: { question: request.question, expectedReasoning: request.expectedReasoning },
    individualAnalyses,
    classAnalysis,
    metadata: { runId: crypto.randomUUID(), mode: "live", model: CLASSTRACE_MODEL, createdAt: new Date().toISOString(), responseCount: individualAnalyses.length, teacherReviewCount: classAnalysis.classSummary.teacherReviewCount },
  });
  report("complete", "Analysis complete");
  return run;
}
