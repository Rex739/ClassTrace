import type { TransferEvaluation } from "@/lib/ai/schemas";

export function transferComparisonDisplay(status: TransferEvaluation["status"]): {
  count: 0 | 1;
  label: string;
  bar: "0%" | "100%";
} {
  switch (status) {
    case "resolved":
      return { count: 0, label: "misconceptions remaining", bar: "0%" };
    case "partially_resolved":
      return { count: 1, label: "partially resolved", bar: "100%" };
    case "unresolved":
      return { count: 1, label: "still unresolved", bar: "100%" };
    case "uncertain":
      return { count: 1, label: "requires further evidence", bar: "100%" };
  }
}
