import type { TransferEvaluation } from "@/lib/ai/schemas";

export function TransferDifficultyDetail({
  status,
  remainingDifficulty,
}: Pick<TransferEvaluation, "status" | "remainingDifficulty">) {
  if (remainingDifficulty === null) return null;
  return (
    <div>
      <dt>{status === "resolved" ? "Optional extension" : "Remaining difficulty"}</dt>
      <dd>{remainingDifficulty}</dd>
    </div>
  );
}
