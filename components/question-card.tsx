import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Assessment } from "@/lib/types";

export function AssessmentQuestionCard({ assessment, compact = false }: { assessment: Assessment; compact?: boolean }) {
  return (
    <Card className={`question-card ${compact ? "question-compact" : ""}`}>
      <div className="eyebrow"><BookOpen size={15} /> Assessment question</div>
      <blockquote>{assessment.question}</blockquote>
      {!compact && <div className="question-meta"><span>{assessment.subject}</span><span>{assessment.createdLabel}</span></div>}
    </Card>
  );
}
