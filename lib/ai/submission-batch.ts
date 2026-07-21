import { ClassTraceError, toClassTraceError } from "@/lib/ai/errors";
import { normalizeSubmissionAnalyses } from "@/lib/ai/normalize";
import { SubmissionAnalysesSchema, type AnalysisRequest, type SubmissionAnalysis } from "@/lib/ai/schemas";

export type SubmissionInputType = "typed" | "image";

export interface AnalysisInputManifest {
  expectedCount: number;
  expectedIds: string[];
  studentAliases: string[];
  inputTypes: SubmissionInputType[];
  promptCharacterCount: number;
}

export interface SafeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface SubmissionBatchResponse {
  status: string;
  incompleteDetails: { reason?: string } | null;
  usage: SafeUsage | null;
  outputParsed: unknown;
  refusal: string | null;
  latencyMs: number;
  requestId: string | null;
  sdkRetryUsed: boolean;
  applicationRepairUsed: boolean;
}

export interface SubmissionBatchTelemetry {
  primary: SafeBatchInspection;
  recovery: SafeBatchInspection | null;
  completedBy: "primary" | "recovery";
}

export interface SafeBatchInspection {
  status: string;
  incompleteReason: string | null;
  usage: SafeUsage | null;
  parsedAnalysisCount: number;
  parsedResponseIds: string[];
  latencyMs: number;
  requestId: string | null;
  sdkRetryUsed: boolean;
  applicationRepairUsed: boolean;
}

export type SubmissionBatchExecutor = (
  request: AnalysisRequest,
  responseIds: string[],
  attempt: "primary" | "repair",
  context?: SubmissionBatchExecutionContext,
) => Promise<SubmissionBatchResponse>;

export interface SubmissionBatchExecutionContext {
  batchId: string;
  timeoutMs: number;
}

export interface SafeTimeoutBatchEvent {
  batchId: string;
  phase: "primary" | "fallback";
  outcome: "completed" | "timeout" | "failed";
  durationMs: number;
  usage: SafeUsage | null;
  responseCount: number;
}

export interface TimeoutFallbackTelemetry {
  primary: SafeTimeoutBatchEvent[];
  fallbackUsed: boolean;
  fallback: SafeTimeoutBatchEvent[];
  finalResponseMembershipCount: number;
}

export interface TimeoutFallbackOptions {
  primaryTimeoutMs: number;
  fallbackTimeoutMs: number;
  onFallback?: () => void;
  observeBatch?: (event: SafeTimeoutBatchEvent) => void;
}

export type SubmissionBatchStage = "individual-normalization" | "missing-id-repair";
export type SubmissionBatchStageObserver = (event: {
  stage: SubmissionBatchStage;
  phase: "start" | "end";
  timestamp: string;
  durationMs: number | null;
  outcome: "running" | "completed" | "failed";
}) => void;

export function requestForResponseIds(request: AnalysisRequest, responseIds: string[]): AnalysisRequest {
  const wanted = new Set(responseIds);
  return {
    ...request,
    typedResponses: request.typedResponses.filter((item) => wanted.has(item.responseId)),
    imageResponses: request.imageResponses.filter((item) => wanted.has(item.responseId)),
  };
}

export function mergeSubmissionBatchResponses(responses: SubmissionBatchResponse[]): SubmissionBatchResponse {
  const parsed = responses.map((response) => SubmissionAnalysesSchema.safeParse(response.outputParsed));
  const failedIndex = responses.findIndex((response, index) => response.status !== "completed" || response.refusal || !parsed[index]?.success);
  const usage = responses.every((response) => response.usage)
    ? responses.reduce<SafeUsage>((total, response) => ({
        inputTokens: total.inputTokens + response.usage!.inputTokens,
        outputTokens: total.outputTokens + response.usage!.outputTokens,
        totalTokens: total.totalTokens + response.usage!.totalTokens,
      }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 })
    : null;

  if (failedIndex >= 0) {
    const failed = responses[failedIndex]!;
    return {
      ...failed,
      usage,
      latencyMs: Math.max(...responses.map((response) => response.latencyMs)),
      sdkRetryUsed: responses.some((response) => response.sdkRetryUsed),
      applicationRepairUsed: responses.some((response) => response.applicationRepairUsed),
    };
  }

  return {
    status: "completed",
    incompleteDetails: null,
    usage,
    outputParsed: { analyses: parsed.flatMap((result) => result.success ? result.data.analyses : []) },
    refusal: null,
    latencyMs: Math.max(...responses.map((response) => response.latencyMs)),
    requestId: responses.map((response) => response.requestId).filter(Boolean).join(",") || null,
    sdkRetryUsed: responses.some((response) => response.sdkRetryUsed),
    applicationRepairUsed: responses.some((response) => response.applicationRepairUsed),
  };
}

function isTimeout(error: unknown): boolean {
  return toClassTraceError(error).code === "API_TIMEOUT";
}

function parsedResponseCount(response: SubmissionBatchResponse): number {
  const parsed = SubmissionAnalysesSchema.safeParse(response.outputParsed);
  return parsed.success ? parsed.data.analyses.length : 0;
}

/**
 * Runs the two primary response groups while retaining a completed peer when
 * exactly one group times out. The timeout fallback is deliberately not
 * recursive: the failed group is split once and either completes or surfaces
 * the existing recoverable error.
 */
export async function executeTwoBatchAnalysisWithTimeoutFallback(
  request: AnalysisRequest,
  responseIds: string[],
  execute: SubmissionBatchExecutor,
  options: TimeoutFallbackOptions,
): Promise<{ response: SubmissionBatchResponse; telemetry: TimeoutFallbackTelemetry }> {
  const primaryGroups = [responseIds.slice(0, 6), responseIds.slice(6)];
  const primaryEvents: SafeTimeoutBatchEvent[] = [];
  const fallbackEvents: SafeTimeoutBatchEvent[] = [];

  const run = async (
    ids: string[],
    batchId: string,
    phase: "primary" | "fallback",
    timeoutMs: number,
  ): Promise<SubmissionBatchResponse> => {
    const startedAt = performance.now();
    try {
      const response = await execute(
        requestForResponseIds(request, ids),
        ids,
        "primary",
        { batchId, timeoutMs },
      );
      const event: SafeTimeoutBatchEvent = {
        batchId,
        phase,
        outcome: "completed",
        durationMs: Math.round(performance.now() - startedAt),
        usage: response.usage,
        responseCount: parsedResponseCount(response),
      };
      (phase === "primary" ? primaryEvents : fallbackEvents).push(event);
      options.observeBatch?.(event);
      return response;
    } catch (error) {
      const normalized = toClassTraceError(error);
      const event: SafeTimeoutBatchEvent = {
        batchId,
        phase,
        outcome: isTimeout(normalized) ? "timeout" : "failed",
        durationMs: Math.round(performance.now() - startedAt),
        usage: null,
        responseCount: 0,
      };
      (phase === "primary" ? primaryEvents : fallbackEvents).push(event);
      options.observeBatch?.(event);
      throw normalized;
    }
  };

  const primarySettled = await Promise.allSettled(primaryGroups.map((ids, index) =>
    run(ids, `primary-${index + 1}`, "primary", options.primaryTimeoutMs),
  ));
  const primaryFailures = primarySettled
    .map((result, index) => ({ result, index }))
    .filter((item): item is { result: PromiseRejectedResult; index: number } => item.result.status === "rejected");

  if (primaryFailures.length === 0) {
    const response = mergeSubmissionBatchResponses(primarySettled.map((item) => (item as PromiseFulfilledResult<SubmissionBatchResponse>).value));
    return {
      response,
      telemetry: {
        primary: primaryEvents,
        fallbackUsed: false,
        fallback: [],
        finalResponseMembershipCount: parsedResponseCount(response),
      },
    };
  }

  const timeoutFailures = primaryFailures.filter(({ result }) => isTimeout(result.reason));
  if (primaryFailures.length !== 1 || timeoutFailures.length !== 1) {
    throw toClassTraceError(primaryFailures[0]!.result.reason);
  }

  options.onFallback?.();
  const failedIndex = timeoutFailures[0]!.index;
  const failedIds = primaryGroups[failedIndex]!;
  const splitPoint = Math.ceil(failedIds.length / 2);
  const fallbackGroups = [failedIds.slice(0, splitPoint), failedIds.slice(splitPoint)];
  const fallbackSettled = await Promise.allSettled(fallbackGroups.map((ids, index) =>
    run(ids, `fallback-${failedIndex + 1}-${index + 1}`, "fallback", options.fallbackTimeoutMs),
  ));
  const fallbackFailure = fallbackSettled.find((item): item is PromiseRejectedResult => item.status === "rejected");
  if (fallbackFailure) throw toClassTraceError(fallbackFailure.reason);

  const successfulPrimary = primarySettled.find((item): item is PromiseFulfilledResult<SubmissionBatchResponse> => item.status === "fulfilled");
  if (!successfulPrimary) throw toClassTraceError(timeoutFailures[0]!.result.reason);
  const response = mergeSubmissionBatchResponses([
    successfulPrimary.value,
    ...fallbackSettled.map((item) => (item as PromiseFulfilledResult<SubmissionBatchResponse>).value),
  ]);
  return {
    response,
    telemetry: {
      primary: primaryEvents,
      fallbackUsed: true,
      fallback: fallbackEvents,
      finalResponseMembershipCount: parsedResponseCount(response),
    },
  };
}

function submissions(request: AnalysisRequest) {
  return [
    ...request.typedResponses.map((item) => ({ responseId: item.responseId, studentAlias: item.studentAlias, inputType: "typed" as const })),
    ...request.imageResponses.map((item) => ({ responseId: item.responseId, studentAlias: item.studentAlias, inputType: "image" as const })),
  ];
}

export function buildAndValidateAnalysisInputManifest(request: AnalysisRequest, prompt: string): AnalysisInputManifest {
  const allSubmissions = submissions(request);
  const expectedIds = allSubmissions.map((item) => item.responseId);
  if (allSubmissions.length !== request.typedResponses.length + request.imageResponses.length) {
    throw new ClassTraceError("INVALID_INPUT", "A response was dropped while preparing the analysis request.", false, 400);
  }
  if (new Set(expectedIds).size !== expectedIds.length) {
    throw new ClassTraceError("INVALID_INPUT", "Every response ID must be unique.", false, 400);
  }
  for (const responseId of expectedIds) {
    if (!prompt.includes(`RESPONSE ID: ${responseId}`)) {
      throw new ClassTraceError("INVALID_INPUT", `The generated analysis input omitted ${responseId}.`, false, 400);
    }
  }
  return {
    expectedCount: allSubmissions.length,
    expectedIds,
    studentAliases: allSubmissions.map((item) => item.studentAlias),
    inputTypes: allSubmissions.map((item) => item.inputType),
    promptCharacterCount: prompt.length,
  };
}

export function inspectSubmissionBatchResponse(response: SubmissionBatchResponse): SafeBatchInspection {
  const parsed = SubmissionAnalysesSchema.safeParse(response.outputParsed);
  return {
    status: response.status,
    incompleteReason: response.incompleteDetails?.reason ?? null,
    usage: response.usage,
    parsedAnalysisCount: parsed.success ? parsed.data.analyses.length : 0,
    parsedResponseIds: parsed.success ? parsed.data.analyses.map((analysis) => analysis.responseId) : [],
    latencyMs: response.latencyMs,
    requestId: response.requestId,
    sdkRetryUsed: response.sdkRetryUsed,
    applicationRepairUsed: response.applicationRepairUsed,
  };
}

function assertCompleted(response: SubmissionBatchResponse) {
  if (response.status === "incomplete") {
    const reason = response.incompleteDetails?.reason ?? "unknown_reason";
    throw new ClassTraceError("INCOMPLETE_ANALYSIS", `GPT-5.6 returned an incomplete individual analysis (${reason}).`, true, 502);
  }
  if (response.status !== "completed") {
    throw new ClassTraceError("INCOMPLETE_ANALYSIS", `GPT-5.6 individual analysis ended with status ${response.status}.`, true, 502);
  }
  if (response.refusal) {
    throw new ClassTraceError("MODEL_REFUSAL", "GPT-5.6 declined to analyse one or more submissions. Review the inputs and retry.", false, 422);
  }
  if (!response.outputParsed) {
    throw new ClassTraceError("MALFORMED_OUTPUT", "GPT-5.6 did not return a complete structured analysis.", true, 502);
  }
}

function missingIds(raw: unknown, expectedIds: string[]): string[] {
  const parsed = SubmissionAnalysesSchema.safeParse(raw);
  if (!parsed.success) return [];
  const returned = new Set(parsed.data.analyses.map((analysis) => analysis.responseId));
  return expectedIds.filter((responseId) => !returned.has(responseId));
}

export async function runSubmissionAnalysisWithRecovery(
  request: AnalysisRequest,
  execute: SubmissionBatchExecutor,
  observeStage?: SubmissionBatchStageObserver,
): Promise<{ analyses: SubmissionAnalysis[]; telemetry: SubmissionBatchTelemetry }> {
  const expectedIds = submissions(request).map((item) => item.responseId);
  const primary = await execute(request, expectedIds, "primary");
  assertCompleted(primary);
  const primaryInspection = inspectSubmissionBatchResponse(primary);

  const normalizationStartedAt = Date.now();
  observeStage?.({ stage: "individual-normalization", phase: "start", timestamp: new Date(normalizationStartedAt).toISOString(), durationMs: null, outcome: "running" });
  try {
    const analyses = normalizeSubmissionAnalyses(primary.outputParsed, request);
    observeStage?.({ stage: "individual-normalization", phase: "end", timestamp: new Date().toISOString(), durationMs: Date.now() - normalizationStartedAt, outcome: "completed" });
    return {
      analyses,
      telemetry: { primary: primaryInspection, recovery: null, completedBy: "primary" },
    };
  } catch (error) {
    observeStage?.({ stage: "individual-normalization", phase: "end", timestamp: new Date().toISOString(), durationMs: Date.now() - normalizationStartedAt, outcome: "failed" });
    if (!(error instanceof ClassTraceError) || error.code !== "INCOMPLETE_ANALYSIS" || !error.message.includes("omitted")) throw error;
    const missing = missingIds(primary.outputParsed, expectedIds);
    if (missing.length === 0) throw error;

    const repairStartedAt = Date.now();
    observeStage?.({ stage: "missing-id-repair", phase: "start", timestamp: new Date(repairStartedAt).toISOString(), durationMs: null, outcome: "running" });
    try {
      const repairRequest = requestForResponseIds(request, missing);
      const repair = await execute(repairRequest, missing, "repair");
      assertCompleted(repair);
      const repairParsed = SubmissionAnalysesSchema.parse(repair.outputParsed);
      const initialParsed = SubmissionAnalysesSchema.parse(primary.outputParsed);
      const merged = { analyses: [...initialParsed.analyses, ...repairParsed.analyses] };
      const analyses = normalizeSubmissionAnalyses(merged, request);
      observeStage?.({ stage: "missing-id-repair", phase: "end", timestamp: new Date().toISOString(), durationMs: Date.now() - repairStartedAt, outcome: "completed" });
      return {
        analyses,
        telemetry: {
          primary: primaryInspection,
          recovery: inspectSubmissionBatchResponse(repair),
          completedBy: "recovery",
        },
      };
    } catch (repairError) {
      observeStage?.({ stage: "missing-id-repair", phase: "end", timestamp: new Date().toISOString(), durationMs: Date.now() - repairStartedAt, outcome: "failed" });
      throw repairError;
    }
  }
}
