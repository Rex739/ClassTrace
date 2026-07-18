import type { Diagnosis, MisconceptionCluster, StudentResponse, TransferOutcome } from "@/lib/types";

export function countSecureUnderstanding(diagnoses: Diagnosis[]): number {
  return diagnoses.filter((diagnosis) => diagnosis.clusterId === null).length;
}

export function buildAnswerReasoningIndex(
  responses: StudentResponse[],
  diagnoses: Diagnosis[],
): Record<string, string[]> {
  const diagnosisByResponse = new Map(diagnoses.map((item) => [item.responseId, item]));
  return responses.reduce<Record<string, string[]>>((index, response) => {
    const clusterId = diagnosisByResponse.get(response.id)?.clusterId ?? "secure";
    const existing = index[response.finalAnswer] ?? [];
    if (!existing.includes(clusterId)) existing.push(clusterId);
    index[response.finalAnswer] = existing;
    return index;
  }, {});
}

export function getAttentionQueue(diagnoses: Diagnosis[]): Diagnosis[] {
  return diagnoses.filter((diagnosis) => diagnosis.needsTeacherReview);
}

export function getOutcomeCounts(outcomes: TransferOutcome[]): Record<TransferOutcome["status"], number> {
  return outcomes.reduce(
    (counts, outcome) => ({ ...counts, [outcome.status]: counts[outcome.status] + 1 }),
    { resolved: 0, uncertain: 0, "follow-up": 0 },
  );
}

export function getBeforeCounts(clusters: MisconceptionCluster[], secureCount: number) {
  return {
    misconception: clusters.reduce((sum, cluster) => sum + cluster.responseIds.length, 0),
    secure: secureCount,
  };
}
