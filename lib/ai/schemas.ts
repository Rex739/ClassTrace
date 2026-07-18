import { z } from "zod";

export const MAX_RESPONSES = 12;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const TypedSubmissionSchema = z.object({
  responseId: z.string().trim().min(1).max(64),
  studentAlias: z.string().trim().min(1).max(64),
  responseText: z.string().trim().min(1).max(8_000),
}).strict();

export const ImageSubmissionDescriptorSchema = z.object({
  responseId: z.string().trim().min(1).max(64),
  studentAlias: z.string().trim().min(1).max(64),
  fileIndex: z.number().int().min(0),
}).strict();

export const AnalysisRequestSchema = z.object({
  mode: z.enum(["live", "prepared_demo"]),
  question: z.string().trim().min(20).max(8_000),
  expectedReasoning: z.string().trim().min(20).max(12_000),
  typedResponses: z.array(TypedSubmissionSchema).max(MAX_RESPONSES),
  imageResponses: z.array(ImageSubmissionDescriptorSchema).max(MAX_RESPONSES),
}).strict().superRefine((value, context) => {
  const responseIds = [...value.typedResponses, ...value.imageResponses].map((item) => item.responseId);
  if (responseIds.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["typedResponses"], message: "Add at least one student response." });
  if (responseIds.length > MAX_RESPONSES) context.addIssue({ code: z.ZodIssueCode.custom, path: ["typedResponses"], message: `ClassTrace supports up to ${MAX_RESPONSES} responses per run.` });
  if (new Set(responseIds).size !== responseIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["typedResponses"], message: "Every response ID must be unique." });
});

export const ReasoningStepAnalysisSchema = z.object({
  order: z.number().int().min(1),
  description: z.string().min(1),
  evidenceExcerpt: z.string().nullable(),
}).strict();

export const SubmissionAnalysisSchema = z.object({
  responseId: z.string().min(1),
  studentAlias: z.string().min(1),
  inputStatus: z.enum(["readable", "partially_readable", "insufficient_evidence"]),
  extractedResponse: z.string(),
  finalAnswer: z.string().nullable(),
  observableReasoningSummary: z.string(),
  reasoningSteps: z.array(ReasoningStepAnalysisSchema),
  demonstratedUnderstanding: z.array(z.string()),
  possibleMisconception: z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    explanation: z.string().min(1),
  }).strict().nullable(),
  evidence: z.array(z.object({
    exactExcerpt: z.string().min(1),
    interpretation: z.string().min(1),
  }).strict()),
  alternativeHypotheses: z.array(z.object({
    title: z.string().min(1),
    explanation: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }).strict()),
  confidence: z.number().min(0).max(1),
  requiresTeacherReview: z.boolean(),
  reviewReason: z.string().nullable(),
}).strict();

export const SubmissionAnalysesSchema = z.object({
  analyses: z.array(SubmissionAnalysisSchema).min(1).max(MAX_RESPONSES),
}).strict();

export const RecommendedInterventionTypeSchema = z.enum([
  "circle_area_explorer",
  "comparison_activity",
  "worked_example",
  "teacher_review",
]);

export const ClassAnalysisSchema = z.object({
  assessmentSummary: z.string().min(1),
  clusters: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    misconceptionCode: z.string().min(1),
    explanation: z.string().min(1),
    sharedReasoningPattern: z.string().min(1),
    responseIds: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    evidenceSummary: z.array(z.string()),
    recommendedDiagnosticQuestion: z.string().min(1),
    recommendedInterventionType: RecommendedInterventionTypeSchema,
  }).strict()),
  demonstratedUnderstandingResponseIds: z.array(z.string()),
  teacherAttentionResponseIds: z.array(z.string()),
  classSummary: z.object({
    totalResponses: z.number().int().min(0),
    analysedResponses: z.number().int().min(0),
    insufficientEvidenceResponses: z.number().int().min(0),
    misconceptionClusterCount: z.number().int().min(0),
    teacherReviewCount: z.number().int().min(0),
  }).strict(),
}).strict();

export const RunMetadataSchema = z.object({
  runId: z.string().min(1),
  mode: z.enum(["live", "prepared_demo"]),
  model: z.enum(["gpt-5.6", "deterministic"]),
  createdAt: z.string().datetime(),
  responseCount: z.number().int().min(0),
  teacherReviewCount: z.number().int().min(0),
}).strict();

export const AnalysisRunSchema = z.object({
  assessment: z.object({
    question: z.string(),
    expectedReasoning: z.string(),
  }).strict(),
  individualAnalyses: z.array(SubmissionAnalysisSchema),
  classAnalysis: ClassAnalysisSchema,
  metadata: RunMetadataSchema,
}).strict();

const TransferQuestionSchema = z.object({
  prompt: z.string().min(1),
  expectedConcepts: z.array(z.string()).min(1),
  scoringGuidance: z.string().min(1),
}).strict();

export const CircleAreaExplorerInterventionSchema = z.object({
  type: z.literal("circle_area_explorer"),
  title: z.string().min(1),
  targetMisconception: z.string().min(1),
  learningObjective: z.string().min(1),
  predictionPrompt: z.string().min(1),
  startingRadius: z.number().positive().max(50),
  comparisonRadius: z.number().positive().max(50),
  explanationSteps: z.array(z.string()).min(1).max(8),
  reflectionQuestion: z.string().min(1),
  transferQuestion: TransferQuestionSchema,
}).strict();

export const ComparisonActivityInterventionSchema = z.object({
  type: z.literal("comparison_activity"),
  title: z.string().min(1),
  targetMisconception: z.string().min(1),
  learningObjective: z.string().min(1),
  comparisonPrompt: z.string().min(1),
  cases: z.array(z.object({ label: z.string(), expression: z.string(), discussionPrompt: z.string() }).strict()).min(2).max(4),
  reflectionQuestion: z.string().min(1),
  transferQuestion: TransferQuestionSchema,
}).strict();

export const WorkedExampleInterventionSchema = z.object({
  type: z.literal("worked_example"),
  title: z.string().min(1),
  targetMisconception: z.string().min(1),
  learningObjective: z.string().min(1),
  problem: z.string().min(1),
  steps: z.array(z.object({ explanation: z.string(), expression: z.string() }).strict()).min(1).max(8),
  selfExplanationPrompt: z.string().min(1),
  transferQuestion: TransferQuestionSchema,
}).strict();

export const TeacherReviewInterventionSchema = z.object({
  type: z.literal("teacher_review"),
  title: z.string().min(1),
  targetMisconception: z.string().min(1),
  reason: z.string().min(1),
  suggestedTeacherQuestion: z.string().min(1),
}).strict();

export const InterventionConfigSchema = z.discriminatedUnion("type", [
  CircleAreaExplorerInterventionSchema,
  ComparisonActivityInterventionSchema,
  WorkedExampleInterventionSchema,
  TeacherReviewInterventionSchema,
]);

export const InterventionResponseSchema = z.object({ intervention: InterventionConfigSchema }).strict();

export const InterventionRequestSchema = z.object({
  run: AnalysisRunSchema,
  clusterId: z.string().min(1),
}).strict();

export const TransferEvaluationSchema = z.object({
  status: z.enum(["resolved", "partially_resolved", "unresolved", "uncertain"]),
  demonstratedConcepts: z.array(z.string()),
  remainingDifficulty: z.string().nullable(),
  evidenceExcerpt: z.string().nullable(),
  feedbackForStudent: z.string().min(1),
  recommendationForTeacher: z.string().min(1),
  confidence: z.number().min(0).max(1),
  requiresTeacherReview: z.boolean(),
}).strict();

export const TransferRequestSchema = z.object({
  targetMisconception: z.string().min(1),
  learningObjective: z.string().min(1),
  transferQuestion: TransferQuestionSchema,
  learnerAnswer: z.string().trim().min(1).max(4_000),
  learnerExplanation: z.string().trim().min(1).max(4_000),
}).strict();

export const TeacherEditsSchema = z.object({
  approvedResponseIds: z.array(z.string()),
  reviewResponseIds: z.array(z.string()),
  clusterRenames: z.array(z.object({ clusterId: z.string(), title: z.string().min(1) }).strict()),
  responseMoves: z.array(z.object({ responseId: z.string(), target: z.string() }).strict()),
  clusterMerges: z.array(z.object({ sourceClusterId: z.string(), targetClusterId: z.string() }).strict()),
  updatedAt: z.string().datetime(),
}).strict();

export type TypedSubmission = z.infer<typeof TypedSubmissionSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type SubmissionAnalysis = z.infer<typeof SubmissionAnalysisSchema>;
export type ClassAnalysis = z.infer<typeof ClassAnalysisSchema>;
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>;
export type RunMetadata = z.infer<typeof RunMetadataSchema>;
export type InterventionConfig = z.infer<typeof InterventionConfigSchema>;
export type TransferEvaluation = z.infer<typeof TransferEvaluationSchema>;
export type TeacherEdits = z.infer<typeof TeacherEditsSchema>;
