import type { RunMetadata } from "@/lib/ai/schemas";

export function getRunLabel(metadata: Pick<RunMetadata, "mode" | "model">): string {
  return metadata.mode === "live" ? "Live analysis · GPT-5.6" : "Prepared demonstration · deterministic data";
}
