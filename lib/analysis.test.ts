import { describe, expect, it } from "vitest";
import { buildAnswerReasoningIndex, countSecureUnderstanding, getAttentionQueue, getBeforeCounts, getOutcomeCounts } from "@/lib/analysis";
import { clusters, diagnoses, responses, transferOutcomes } from "@/lib/demo-data";

describe("analysis transformations", () => {
  it("counts secure responses separately from misconception clusters", () => {
    expect(countSecureUnderstanding(diagnoses)).toBe(3);
    expect(getBeforeCounts(clusters, 3)).toEqual({ misconception: 9, secure: 3 });
  });

  it("preserves different reasoning paths that lead to the same answer", () => {
    const index = buildAnswerReasoningIndex(responses, diagnoses);
    expect(index["12π cm²"]).toEqual(expect.arrayContaining(["circumference-confusion", "substitution-errors"]));
    expect(index["18π cm²"]).toEqual(expect.arrayContaining(["linear-scaling", "substitution-errors"]));
  });

  it("builds a focused teacher review queue", () => {
    expect(getAttentionQueue(diagnoses).map((item) => item.responseId)).toEqual(["r03", "r07", "r09"]);
  });

  it("summarises transfer outcomes", () => {
    expect(getOutcomeCounts(transferOutcomes)).toEqual({ resolved: 9, uncertain: 2, "follow-up": 1 });
  });
});
