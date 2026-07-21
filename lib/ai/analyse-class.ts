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
  inspectSubmissionBatchResponse,
  mergeSubmissionBatchResponses,
  requestForResponseIds,
  runSubmissionAnalysisWithRecovery,
  type SubmissionBatchExecutor,
} from "@/lib/ai/submission-batch";

export type AnalysisStage = "preparing" | "reading" | "reasoning" | "clustering" | "validating" | "review" | "complete";
export type StageReporter = (stage: AnalysisStage, message: string) => void;

export async function analyseClassLive(request: AnalysisRequest, images: ValidatedImage[], report: StageReporter): Promise<AnalysisRun> {
  const openai = getOpenAIClient();
  report("reading", "Reading student work");

  report("reasoning", "Reconstructing observable reasoning");
  const executeIndividualBatch: SubmissionBatchExecutor = async (batchRequest, responseIds, attempt) => {
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
    }).withResponse();
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
  const executeWithBoundedBatching: SubmissionBatchExecutor = async (batchRequest, responseIds, attempt) => {
    if (attempt !== "primary" || responseIds.length <= 6) {
      return executeIndividualBatch(batchRequest, responseIds, attempt);
    }
    const responseIdBatches = [responseIds.slice(0, 6), responseIds.slice(6)];
    const results = await Promise.all(responseIdBatches.map((ids) => executeIndividualBatch(requestForResponseIds(batchRequest, ids), ids, attempt)));
    return mergeSubmissionBatchResponses(results);
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
  }).withResponse();
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
