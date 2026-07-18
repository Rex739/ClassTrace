import { assessment, clusters, diagnoses, getResponse, getStudent, responses } from "@/lib/demo-data";
import { AnalysisRunSchema, type AnalysisRun, type SubmissionAnalysis } from "@/lib/ai/schemas";
import { normalizeClassAnalysis } from "@/lib/ai/normalize";

const confidenceValue = { high: 0.92, medium: 0.68, low: 0.45 } as const;

export function createPreparedAnalysisRun(): AnalysisRun {
  const individualAnalyses: SubmissionAnalysis[] = diagnoses.map((diagnosis) => {
    const response = getResponse(diagnosis.responseId);
    const student = response ? getStudent(response.studentId) : undefined;
    if (!response || !student) throw new Error(`Invalid prepared response ${diagnosis.responseId}`);
    return {
      responseId: response.id,
      studentAlias: student.label,
      inputStatus: "readable",
      extractedResponse: response.answer,
      finalAnswer: response.finalAnswer,
      observableReasoningSummary: diagnosis.summary,
      reasoningSteps: diagnosis.reasoning.map((step, index) => ({ order: index + 1, description: `${step.label}: ${step.detail}`, evidenceExcerpt: null })),
      demonstratedUnderstanding: diagnosis.clusterId === null ? diagnosis.reasoning.map((step) => step.detail) : diagnosis.reasoning.filter((step) => step.status === "sound").map((step) => step.detail),
      possibleMisconception: diagnosis.clusterId ? { code: diagnosis.clusterId, title: clusters.find((cluster) => cluster.id === diagnosis.clusterId)?.name ?? "Possible reasoning pattern", explanation: diagnosis.summary } : null,
      evidence: [{ exactExcerpt: response.answer, interpretation: diagnosis.summary }],
      alternativeHypotheses: diagnosis.alternativeHypothesis.startsWith("No material") ? [] : [{ title: "Alternative interpretation", explanation: diagnosis.alternativeHypothesis, confidence: Math.max(0.2, confidenceValue[diagnosis.confidence] - 0.2) }],
      confidence: confidenceValue[diagnosis.confidence],
      requiresTeacherReview: diagnosis.needsTeacherReview,
      reviewReason: diagnosis.needsTeacherReview ? "Prepared fixture marks this interpretation for teacher review." : null,
    };
  });

  const rawClassAnalysis = {
    assessmentSummary: assessment.title,
    clusters: clusters.map((cluster) => ({
      id: cluster.id,
      title: cluster.name,
      misconceptionCode: cluster.id,
      explanation: cluster.description,
      sharedReasoningPattern: cluster.description,
      responseIds: cluster.responseIds,
      confidence: cluster.severity === "uncertain" ? 0.76 : 0.9,
      evidenceSummary: cluster.responseIds.map((id) => getResponse(id)?.answer ?? "").filter(Boolean),
      recommendedDiagnosticQuestion: cluster.learningNeed,
      recommendedInterventionType: cluster.id === "linear-scaling" ? "circle_area_explorer" as const : cluster.id === "arithmetic-slips" ? "worked_example" as const : "comparison_activity" as const,
    })),
    demonstratedUnderstandingResponseIds: responses.filter((response) => !diagnoses.find((item) => item.responseId === response.id)?.clusterId).map((response) => response.id),
    teacherAttentionResponseIds: diagnoses.filter((item) => item.needsTeacherReview).map((item) => item.responseId),
    classSummary: { totalResponses: 12, analysedResponses: 12, insufficientEvidenceResponses: 0, misconceptionClusterCount: 4, teacherReviewCount: 3 },
  };
  const classAnalysis = normalizeClassAnalysis(rawClassAnalysis, individualAnalyses);
  return AnalysisRunSchema.parse({
    assessment: { question: assessment.question, expectedReasoning: assessment.expectedReasoning.join("\n") },
    individualAnalyses,
    classAnalysis,
    metadata: { runId: "prepared-demo", mode: "prepared_demo", model: "deterministic", createdAt: new Date().toISOString(), responseCount: individualAnalyses.length, teacherReviewCount: classAnalysis.classSummary.teacherReviewCount },
  });
}
