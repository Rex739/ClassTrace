import { Badge } from "@/components/ui/badge";
import type { Confidence } from "@/lib/types";

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <Badge tone={confidence === "high" ? "green" : confidence === "medium" ? "amber" : "red"}>{confidence} confidence</Badge>;
}
