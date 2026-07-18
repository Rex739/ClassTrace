import { Check, CircleAlert, HelpCircle } from "lucide-react";
import type { ReasoningStep } from "@/lib/types";

export function ReasoningTimeline({ steps }: { steps: ReasoningStep[] }) {
  return (
    <ol className="reasoning-timeline">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className={`reasoning-${step.status}`}>
          <span className="reasoning-icon" aria-hidden="true">
            {step.status === "sound" ? <Check size={15} /> : step.status === "break" ? <CircleAlert size={15} /> : <HelpCircle size={15} />}
          </span>
          <div><strong>{step.label}</strong><p>{step.detail}</p></div>
        </li>
      ))}
    </ol>
  );
}
