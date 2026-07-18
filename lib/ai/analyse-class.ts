import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, CLASSTRACE_MODEL } from "@/lib/ai/openai";
import { ClassTraceError } from "@/lib/ai/errors";
import { buildClusteringPrompt, buildIndividualAnalysisPrompt } from "@/lib/ai/prompts";
import { normalizeClassAnalysis, normalizeSubmissionAnalyses } from "@/lib/ai/normalize";
import { AnalysisRunSchema, ClassAnalysisSchema, SubmissionAnalysesSchema, type AnalysisRequest, type AnalysisRun } from "@/lib/ai/schemas";
import type { ValidatedImage } from "@/lib/ai/files";
import { getResponseRefusal } from "@/lib/ai/response";

export type AnalysisStage = "preparing" | "reading" | "reasoning" | "clustering" | "validating" | "review" | "complete";
export type StageReporter = (stage: AnalysisStage, message: string) => void;

export async function analyseClassLive(request: AnalysisRequest, images: ValidatedImage[], report: StageReporter): Promise<AnalysisRun> {
  const openai = getOpenAIClient();
  report("reading", "Reading student work");
  const individualPrompt = buildIndividualAnalysisPrompt({ question: request.question, expectedReasoning: request.expectedReasoning, typedResponses: request.typedResponses, imageAliases: request.imageResponses.map(({ responseId, studentAlias }) => ({ responseId, studentAlias })) });
  const imageContent = request.imageResponses.map((descriptor) => {
    const image = images[descriptor.fileIndex];
    if (!image) throw new ClassTraceError("INVALID_INPUT", `Missing image for ${descriptor.studentAlias}.`, false, 400);
    return [
      { type: "input_text" as const, text: `Student-work image for responseId=${descriptor.responseId}, alias=${descriptor.studentAlias}.` },
      { type: "input_image" as const, image_url: image.dataUrl, detail: "original" as const },
    ];
  }).flat();

  report("reasoning", "Reconstructing observable reasoning");
  const individualResponse = await openai.responses.parse({
    model: CLASSTRACE_MODEL,
    instructions: individualPrompt.instructions,
    input: [{ role: "user", content: [{ type: "input_text", text: individualPrompt.content }, ...imageContent] }],
    reasoning: { effort: "high" },
    text: { format: zodTextFormat(SubmissionAnalysesSchema, "classtrace_submission_analyses") },
    store: false,
  });
  const individualRefusal = getResponseRefusal(individualResponse);
  if (individualRefusal) throw new ClassTraceError("MODEL_REFUSAL", "GPT-5.6 declined to analyse one or more submissions. Review the inputs and retry.", false, 422);
  if (!individualResponse.output_parsed) throw new ClassTraceError("MALFORMED_OUTPUT", "GPT-5.6 did not return a complete structured analysis.", true, 502);
  const individualAnalyses = normalizeSubmissionAnalyses(individualResponse.output_parsed, request);

  report("clustering", "Discovering shared reasoning patterns");
  const clusterPrompt = buildClusteringPrompt({ question: request.question, analyses: individualAnalyses });
  const clusterResponse = await openai.responses.parse({
    model: CLASSTRACE_MODEL,
    instructions: clusterPrompt.instructions,
    input: clusterPrompt.content,
    reasoning: { effort: "high" },
    text: { format: zodTextFormat(ClassAnalysisSchema, "classtrace_class_analysis") },
    store: false,
  });
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
