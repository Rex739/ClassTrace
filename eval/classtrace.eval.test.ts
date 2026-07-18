import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { assessment, responses } from "@/lib/demo-data";
import { createPreparedAnalysisRun } from "@/lib/ai/prepared";
import { buildClusteringPrompt, buildIndividualAnalysisPrompt, containsExecutableInterventionContent } from "@/lib/ai/prompts";
import { normalizeClassAnalysis, membershipProblems } from "@/lib/ai/normalize";
import { AnalysisRequestSchema, buildSubmissionAnalysisBatchSchema, ClassAnalysisSchema } from "@/lib/ai/schemas";
import { getResponseRefusal } from "@/lib/ai/response";
import { buildAndValidateAnalysisInputManifest, runSubmissionAnalysisWithRecovery, type SubmissionBatchExecutor, type SubmissionBatchStageObserver } from "@/lib/ai/submission-batch";

interface RequestDiagnostic {
  stage: string;
  phase: "start" | "end" | "warning";
  timestamp: string;
  durationMs?: number;
  responseStatus?: string | null;
  incompleteReason?: string | null;
  requestId?: string | null;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  parsedItemCount?: number;
  sdkRetryUsed?: boolean;
  applicationRepairUsed?: boolean;
  outcome?: string;
}

function writeDiagnostic(diagnostic: RequestDiagnostic) {
  process.stdout.write(`[ClassTrace eval] ${JSON.stringify(diagnostic)}\n`);
}

function startStage(stage: string) {
  const startedAt = Date.now();
  writeDiagnostic({ stage, phase: "start", timestamp: new Date(startedAt).toISOString(), outcome: "running" });
  return startedAt;
}

function endStage(stage: string, startedAt: number, details: Omit<RequestDiagnostic, "stage" | "phase" | "timestamp" | "durationMs"> = {}) {
  const durationMs = Date.now() - startedAt;
  writeDiagnostic({ stage, phase: "end", timestamp: new Date().toISOString(), durationMs, ...details });
  return durationMs;
}

function warnIfSlow(stage: string, durationMs: number, thresholdMs: number) {
  if (durationMs > thresholdMs) {
    writeDiagnostic({ stage, phase: "warning", timestamp: new Date().toISOString(), durationMs, outcome: `exceeded ${thresholdMs}ms threshold` });
  }
}

describe("ClassTrace synthetic evaluation", () => {
  it("passes the offline structural and evidence baseline", () => {
    const run = createPreparedAnalysisRun();
    expect(run.individualAnalyses).toHaveLength(12);
    expect(membershipProblems(run.classAnalysis, run.individualAnalyses.map((item) => item.responseId))).toEqual([]);
    expect(run.individualAnalyses.filter((item) => item.confidence >= .7 && item.possibleMisconception).every((item) => item.evidence.length > 0)).toBe(true);
    expect(containsExecutableInterventionContent({ type: "teacher_review", title: "Clarify evidence", targetMisconception: "Uncertain", reason: "Ask for more reasoning evidence.", suggestedTeacherQuestion: "Can you explain how you chose that formula?" })).toBe(false);
  });

  it.runIf(Boolean(process.env.OPENAI_API_KEY))("evaluates the sample class live with GPT-5.6", async () => {
    const pipelineStartedAt = Date.now();
    const inputStartedAt = startStage("evaluation-fixture-preparation");
    const request = AnalysisRequestSchema.parse({ mode: "live", question: assessment.question, expectedReasoning: assessment.expectedReasoning.join("\n"), typedResponses: responses.map((response, index) => ({ responseId: response.id, studentAlias: `Learner ${String(index + 1).padStart(2, "0")}`, responseText: response.answer })), imageResponses: [] });
    endStage("evaluation-fixture-preparation", inputStartedAt, { parsedItemCount: request.typedResponses.length, outcome: "completed" });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150_000, maxRetries: 0 });
    const execute: SubmissionBatchExecutor = async (batchRequest, responseIds, attempt) => {
      const preparationStartedAt = startStage("input-preparation");
      const individualPrompt = buildIndividualAnalysisPrompt({ ...batchRequest, imageAliases: [] });
      const manifest = buildAndValidateAnalysisInputManifest(batchRequest, individualPrompt.content);
      expect(manifest.expectedCount).toBe(responseIds.length);
      if (attempt === "primary") expect(manifest.expectedCount).toBe(12);
      endStage("input-preparation", preparationStartedAt, { parsedItemCount: manifest.expectedCount, applicationRepairUsed: attempt === "repair", outcome: "completed" });
      const stageName = attempt === "primary" ? "individual-analysis-request" : "missing-id-repair-request";
      const startedAt = startStage(stageName);
      try {
        const { data: stageOne, request_id: requestId } = await client.responses.parse({
          model: "gpt-5.6",
          instructions: individualPrompt.instructions,
          input: individualPrompt.content,
          reasoning: { effort: "medium" },
          max_output_tokens: 16_000,
          text: { format: zodTextFormat(buildSubmissionAnalysisBatchSchema(responseIds), `classtrace_eval_submissions_${attempt}`) },
          store: false,
        }).withResponse();
        const usage = stageOne.usage ? { inputTokens: stageOne.usage.input_tokens, outputTokens: stageOne.usage.output_tokens, totalTokens: stageOne.usage.total_tokens } : null;
        const parsedItemCount = stageOne.output_parsed?.analyses.length ?? 0;
        const latencyMs = endStage(stageName, startedAt, {
          responseStatus: stageOne.status ?? "unknown",
          incompleteReason: stageOne.incomplete_details?.reason ?? null,
          requestId,
          usage,
          parsedItemCount,
          sdkRetryUsed: false,
          applicationRepairUsed: attempt === "repair",
          outcome: stageOne.status ?? "unknown",
        });
        return {
          status: stageOne.status ?? "unknown",
          incompleteDetails: stageOne.incomplete_details,
          usage,
          outputParsed: stageOne.output_parsed,
          refusal: getResponseRefusal(stageOne),
          latencyMs,
          requestId,
          sdkRetryUsed: false,
          applicationRepairUsed: attempt === "repair",
        };
      } catch (error) {
        endStage(stageName, startedAt, { sdkRetryUsed: false, applicationRepairUsed: attempt === "repair", outcome: error instanceof Error ? error.name : "failed" });
        throw error;
      }
    };
    const observeBatchStage: SubmissionBatchStageObserver = (event) => writeDiagnostic({
      stage: event.stage,
      phase: event.phase,
      timestamp: event.timestamp,
      ...(event.durationMs === null ? {} : { durationMs: event.durationMs }),
      outcome: event.outcome,
    });
    const { analyses: individuals, telemetry } = await runSubmissionAnalysisWithRecovery(request, execute, observeBatchStage);

    const clusteringStartedAt = startStage("cohort-clustering-request");
    const clusterPrompt = buildClusteringPrompt({ question: request.question, analyses: individuals });
    const { data: stageTwo, request_id: clusteringRequestId } = await client.responses.parse({ model: "gpt-5.6", instructions: clusterPrompt.instructions, input: clusterPrompt.content, reasoning: { effort: "medium" }, max_output_tokens: 16_000, text: { format: zodTextFormat(ClassAnalysisSchema, "classtrace_eval_class") }, store: false }).withResponse().catch((error: unknown) => {
      endStage("cohort-clustering-request", clusteringStartedAt, { sdkRetryUsed: false, applicationRepairUsed: false, outcome: error instanceof Error ? error.name : "failed" });
      throw error;
    });
    const clusteringUsage = stageTwo.usage ? { inputTokens: stageTwo.usage.input_tokens, outputTokens: stageTwo.usage.output_tokens, totalTokens: stageTwo.usage.total_tokens } : null;
    const clusteringDurationMs = endStage("cohort-clustering-request", clusteringStartedAt, {
      responseStatus: stageTwo.status ?? "unknown",
      incompleteReason: stageTwo.incomplete_details?.reason ?? null,
      requestId: clusteringRequestId,
      usage: clusteringUsage,
      parsedItemCount: stageTwo.output_parsed?.clusters.length ?? 0,
      sdkRetryUsed: false,
      applicationRepairUsed: false,
      outcome: stageTwo.status ?? "unknown",
    });
    if (stageTwo.status !== "completed" || !stageTwo.output_parsed || getResponseRefusal(stageTwo)) {
      throw new Error(`Cohort clustering did not complete safely (status=${stageTwo.status ?? "unknown"}, incomplete=${stageTwo.incomplete_details?.reason ?? "none"}).`);
    }

    const clusterNormalizationStartedAt = startStage("cluster-normalization");
    const classAnalysis = normalizeClassAnalysis(stageTwo.output_parsed, individuals);
    endStage("cluster-normalization", clusterNormalizationStartedAt, { parsedItemCount: classAnalysis.clusters.length, outcome: "completed" });

    const assertionsStartedAt = startStage("final-evaluation-assertions");
    try {
      expect(individuals).toHaveLength(12);
      expect(membershipProblems(classAnalysis, responses.map((response) => response.id))).toEqual([]);
      expect(individuals.filter((item) => item.confidence >= .7 && item.possibleMisconception).every((item) => item.evidence.length > 0)).toBe(true);
      expect(individuals.filter((item) => item.confidence < .7 || item.inputStatus !== "readable").every((item) => item.requiresTeacherReview)).toBe(true);
      expect(classAnalysis.clusters.length).toBeGreaterThanOrEqual(3);
      const clusterLanguage = classAnalysis.clusters.map((cluster) => [cluster.title, cluster.misconceptionCode, cluster.explanation, cluster.sharedReasoningPattern, ...cluster.evidenceSummary].join(" ").toLowerCase());
      expect(clusterLanguage.some((description) => /linear|direct(?:ly)? proportion|scales? (?:directly|with)/.test(description))).toBe(true);
      expect(clusterLanguage.some((description) => /circumference|2\s*[×x*]?\s*π\s*r|perimeter/.test(description))).toBe(true);
      expect(clusterLanguage.some((description) => /substitut|exponent|squar(?:e|ing)|r²/.test(description))).toBe(true);
      endStage("final-evaluation-assertions", assertionsStartedAt, { parsedItemCount: individuals.length, outcome: "completed" });
    } catch (error) {
      endStage("final-evaluation-assertions", assertionsStartedAt, { parsedItemCount: individuals.length, outcome: "failed" });
      throw error;
    }

    const completePipelineDurationMs = Date.now() - pipelineStartedAt;
    writeDiagnostic({ stage: "complete-pipeline", phase: "end", timestamp: new Date().toISOString(), durationMs: completePipelineDurationMs, outcome: "completed" });
    warnIfSlow("individual-analysis-request", telemetry.primary.latencyMs, 120_000);
    warnIfSlow("cohort-clustering-request", clusteringDurationMs, 60_000);
    warnIfSlow("complete-pipeline", completePipelineDurationMs, 180_000);
  });
});
