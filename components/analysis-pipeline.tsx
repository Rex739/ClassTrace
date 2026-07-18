import { Check, FileStack, Network, Sparkles, Target } from "lucide-react";

const steps = [
  { label: "Responses read", detail: "12 of 12", icon: FileStack },
  { label: "Reasoning traced", detail: "12 paths", icon: Sparkles },
  { label: "Needs clustered", detail: "4 groups", icon: Network },
  { label: "Review prepared", detail: "3 flagged", icon: Target },
];

export function AnalysisPipeline() {
  return (
    <ol className="pipeline" aria-label="Analysis pipeline">
      {steps.map(({ label, detail, icon: Icon }) => (
        <li key={label}><span className="pipeline-icon"><Icon size={17} /></span><div><strong>{label}</strong><small>{detail}</small></div><Check className="pipeline-check" size={15} /></li>
      ))}
    </ol>
  );
}
