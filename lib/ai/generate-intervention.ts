import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { ClassTraceError } from "@/lib/ai/errors";
import { getOpenAIClient, CLASSTRACE_MODEL } from "@/lib/ai/openai";
import { buildInterventionPrompt, containsExecutableInterventionContent } from "@/lib/ai/prompts";
import { InterventionConfigSchema, InterventionResponseSchema, type AnalysisRun, type InterventionConfig } from "@/lib/ai/schemas";
import { getResponseRefusal } from "@/lib/ai/response";

export async function generateIntervention(run: AnalysisRun, clusterId: string): Promise<InterventionConfig> {
  const cluster = run.classAnalysis.clusters.find((item) => item.id === clusterId);
  if (!cluster) throw new ClassTraceError("INVALID_INPUT", "Choose an available possible-misconception cluster.", false, 400);
  const analyses = run.individualAnalyses.filter((item) => cluster.responseIds.includes(item.responseId));
  const prompt = buildInterventionPrompt({ cluster, analyses });
  const response = await getOpenAIClient().responses.parse({
    model: CLASSTRACE_MODEL,
    instructions: prompt.instructions,
    input: prompt.content,
    reasoning: { effort: "medium" },
    text: { format: zodTextFormat(InterventionResponseSchema, "classtrace_intervention") },
    store: false,
  });
  if (getResponseRefusal(response)) throw new ClassTraceError("MODEL_REFUSAL", "GPT-5.6 declined to configure this intervention. Review the selected evidence.", false, 422);
  if (!response.output_parsed) throw new ClassTraceError("MALFORMED_OUTPUT", "GPT-5.6 did not return a valid intervention configuration.", true, 502);
  const intervention = InterventionConfigSchema.parse(response.output_parsed.intervention);
  if (containsExecutableInterventionContent(intervention)) throw new ClassTraceError("MALFORMED_OUTPUT", "The intervention contained unsupported executable content and was rejected.", false, 502);
  return intervention;
}
