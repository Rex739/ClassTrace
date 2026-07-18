import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { assessment, responses } from "@/lib/demo-data";
import { createPreparedAnalysisRun } from "@/lib/ai/prepared";
import { buildClusteringPrompt, buildIndividualAnalysisPrompt, containsExecutableInterventionContent } from "@/lib/ai/prompts";
import { normalizeClassAnalysis, normalizeSubmissionAnalyses, membershipProblems } from "@/lib/ai/normalize";
import { AnalysisRequestSchema, ClassAnalysisSchema, SubmissionAnalysesSchema } from "@/lib/ai/schemas";

describe("ClassTrace synthetic evaluation", () => {
  it("passes the offline structural and evidence baseline", () => {
    const run = createPreparedAnalysisRun();
    expect(run.individualAnalyses).toHaveLength(12);
    expect(membershipProblems(run.classAnalysis, run.individualAnalyses.map((item) => item.responseId))).toEqual([]);
    expect(run.individualAnalyses.filter((item) => item.confidence >= .7 && item.possibleMisconception).every((item) => item.evidence.length > 0)).toBe(true);
    expect(containsExecutableInterventionContent({ type: "teacher_review", title: "Clarify evidence", targetMisconception: "Uncertain", reason: "Ask for more reasoning evidence.", suggestedTeacherQuestion: "Can you explain how you chose that formula?" })).toBe(false);
  });

  it.runIf(Boolean(process.env.OPENAI_API_KEY))("evaluates the sample class live with GPT-5.6", async () => {
    const request = AnalysisRequestSchema.parse({ mode: "live", question: assessment.question, expectedReasoning: assessment.expectedReasoning.join("\n"), typedResponses: responses.map((response, index) => ({ responseId: response.id, studentAlias: `Learner ${String(index + 1).padStart(2, "0")}`, responseText: response.answer })), imageResponses: [] });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 2 });
    const individualPrompt = buildIndividualAnalysisPrompt({ ...request, imageAliases: [] });
    const stageOne = await client.responses.parse({ model: "gpt-5.6", instructions: individualPrompt.instructions, input: individualPrompt.content, reasoning: { effort: "high" }, text: { format: zodTextFormat(SubmissionAnalysesSchema, "classtrace_eval_submissions") }, store: false });
    const individuals = normalizeSubmissionAnalyses(stageOne.output_parsed, request);
    const clusterPrompt = buildClusteringPrompt({ question: request.question, analyses: individuals });
    const stageTwo = await client.responses.parse({ model: "gpt-5.6", instructions: clusterPrompt.instructions, input: clusterPrompt.content, reasoning: { effort: "high" }, text: { format: zodTextFormat(ClassAnalysisSchema, "classtrace_eval_class") }, store: false });
    const classAnalysis = normalizeClassAnalysis(stageTwo.output_parsed, individuals);
    expect(individuals).toHaveLength(12);
    expect(membershipProblems(classAnalysis, responses.map((response) => response.id))).toEqual([]);
    expect(individuals.filter((item) => item.confidence >= .7 && item.possibleMisconception).every((item) => item.evidence.length > 0)).toBe(true);
    expect(classAnalysis.clusters.length).toBeGreaterThanOrEqual(3);
  });
});
