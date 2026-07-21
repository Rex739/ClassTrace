import { ClassTraceError } from "@/lib/ai/errors";
import {
  ClassAnalysisSchema,
  SubmissionAnalysesSchema,
  TransferEvaluationSchema,
  type AnalysisRequest,
  type ClassAnalysis,
  type SubmissionAnalysis,
  type TransferEvaluation,
} from "@/lib/ai/schemas";

const OPTIONAL_TEXT_PLACEHOLDERS = new Set([
  "none",
  "n a",
  "na",
  "not applicable",
  "not available",
  "no remaining difficulty",
  "no difficulty",
  "nothing",
]);

export function normalizeOptionalModelText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || !/[\p{L}\p{N}]/u.test(trimmed)) return null;
  const comparable = trimmed.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return OPTIONAL_TEXT_PLACEHOLDERS.has(comparable) ? null : trimmed;
}

export function normalizeTransferEvaluation(evaluation: TransferEvaluation): TransferEvaluation {
  return TransferEvaluationSchema.parse({
    ...evaluation,
    remainingDifficulty: normalizeOptionalModelText(evaluation.remainingDifficulty),
    evidenceExcerpt: normalizeOptionalModelText(evaluation.evidenceExcerpt),
  });
}

function sourceTextFor(responseId: string, request: AnalysisRequest, analysis: SubmissionAnalysis): string {
  return request.typedResponses.find((item) => item.responseId === responseId)?.responseText ?? analysis.extractedResponse;
}

export function normalizeSubmissionAnalyses(raw: unknown, request: AnalysisRequest): SubmissionAnalysis[] {
  const parsed = SubmissionAnalysesSchema.parse(raw).analyses;
  const expected = new Map([...request.typedResponses, ...request.imageResponses].map((item) => [item.responseId, item.studentAlias]));
  const seen = new Set<string>();

  const normalized = parsed.map((analysis) => {
    const alias = expected.get(analysis.responseId);
    if (!alias) throw new ClassTraceError("INCOMPLETE_ANALYSIS", `The model referenced an unknown response ID: ${analysis.responseId}.`, true, 502);
    if (seen.has(analysis.responseId)) throw new ClassTraceError("INCOMPLETE_ANALYSIS", `The model analysed ${analysis.responseId} more than once.`, true, 502);
    seen.add(analysis.responseId);
    const sourceText = sourceTextFor(analysis.responseId, request, analysis);
    for (const evidence of analysis.evidence) {
      if (!sourceText.includes(evidence.exactExcerpt)) throw new ClassTraceError("MALFORMED_OUTPUT", `Evidence for ${analysis.responseId} was not found verbatim in the submitted work.`, true, 502);
    }
    const requiresTeacherReview = analysis.requiresTeacherReview || analysis.confidence < 0.7 || analysis.inputStatus !== "readable";
    if (analysis.confidence >= 0.7 && analysis.inputStatus === "readable" && analysis.possibleMisconception && analysis.evidence.length === 0) {
      throw new ClassTraceError("INCOMPLETE_ANALYSIS", `A confident diagnosis for ${analysis.responseId} did not include evidence.`, true, 502);
    }
    return {
      ...analysis,
      finalAnswer: normalizeOptionalModelText(analysis.finalAnswer),
      reasoningSteps: analysis.reasoningSteps.map((step) => ({
        ...step,
        evidenceExcerpt: normalizeOptionalModelText(step.evidenceExcerpt),
      })),
      studentAlias: alias,
      requiresTeacherReview,
      reviewReason: requiresTeacherReview ? (normalizeOptionalModelText(analysis.reviewReason) ?? "Teacher review is required because evidence is incomplete or confidence is below 0.70.") : null,
    };
  });

  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  if (missing.length > 0) throw new ClassTraceError("INCOMPLETE_ANALYSIS", `The model omitted ${missing.length} response${missing.length === 1 ? "" : "s"}.`, true, 502);
  return normalized;
}

export function normalizeClassAnalysis(raw: unknown, analyses: SubmissionAnalysis[]): ClassAnalysis {
  const parsed = ClassAnalysisSchema.parse(raw);
  const known = new Set(analyses.map((item) => item.responseId));
  const teacherAttention = new Set(
    analyses.filter((item) => item.requiresTeacherReview || item.inputStatus === "insufficient_evidence").map((item) => item.responseId),
  );
  for (const id of parsed.teacherAttentionResponseIds) if (known.has(id)) teacherAttention.add(id);

  const assigned = new Set<string>(teacherAttention);
  const clusters = parsed.clusters.map((cluster, index) => {
    const withinCluster = new Set<string>();
    const responseIds = cluster.responseIds.filter((id) => {
      if (!known.has(id) || assigned.has(id) || withinCluster.has(id)) return false;
      withinCluster.add(id);
      return true;
    });
    responseIds.forEach((id) => assigned.add(id));
    const lowConfidence = cluster.confidence < 0.7;
    if (lowConfidence) {
      responseIds.forEach((id) => teacherAttention.add(id));
    }
    return { ...cluster, id: cluster.id || `cluster-${index + 1}`, responseIds: lowConfidence ? [] : responseIds };
  }).filter((cluster) => cluster.responseIds.length > 0);

  const demonstratedUnderstandingResponseIds = parsed.demonstratedUnderstandingResponseIds.filter((id) => known.has(id) && !assigned.has(id));
  demonstratedUnderstandingResponseIds.forEach((id) => assigned.add(id));
  for (const analysis of analyses) if (!assigned.has(analysis.responseId)) teacherAttention.add(analysis.responseId);

  const insufficientEvidenceResponses = analyses.filter((item) => item.inputStatus === "insufficient_evidence").length;
  return ClassAnalysisSchema.parse({
    ...parsed,
    clusters,
    demonstratedUnderstandingResponseIds,
    teacherAttentionResponseIds: [...teacherAttention],
    classSummary: {
      totalResponses: analyses.length,
      analysedResponses: analyses.length - insufficientEvidenceResponses,
      insufficientEvidenceResponses,
      misconceptionClusterCount: clusters.length,
      teacherReviewCount: teacherAttention.size,
    },
  });
}

export function membershipProblems(classAnalysis: ClassAnalysis, knownIds: string[]): string[] {
  const memberships = [
    ...classAnalysis.clusters.flatMap((cluster) => cluster.responseIds),
    ...classAnalysis.demonstratedUnderstandingResponseIds,
    ...classAnalysis.teacherAttentionResponseIds,
  ];
  const counts = new Map<string, number>();
  memberships.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return [
    ...knownIds.filter((id) => counts.get(id) !== 1).map((id) => `${id} appears ${counts.get(id) ?? 0} times`),
    ...memberships.filter((id) => !knownIds.includes(id)).map((id) => `unknown response ${id}`),
  ];
}
