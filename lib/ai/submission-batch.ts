import { ClassTraceError } from "@/lib/ai/errors";
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
) => Promise<SubmissionBatchResponse>;

export type SubmissionBatchStage = "individual-normalization" | "missing-id-repair";
export type SubmissionBatchStageObserver = (event: {
  stage: SubmissionBatchStage;
  phase: "start" | "end";
  timestamp: string;
  durationMs: number | null;
  outcome: "running" | "completed" | "failed";
}) => void;

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

function requestForIds(request: AnalysisRequest, responseIds: string[]): AnalysisRequest {
  const wanted = new Set(responseIds);
  return {
    ...request,
    typedResponses: request.typedResponses.filter((item) => wanted.has(item.responseId)),
    imageResponses: request.imageResponses.filter((item) => wanted.has(item.responseId)),
  };
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
      const repairRequest = requestForIds(request, missing);
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
