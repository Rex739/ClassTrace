"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { EvidencePanel } from "@/components/evidence-panel";
import { ReasoningTimeline } from "@/components/reasoning-timeline";
import { TeacherReviewControls } from "@/components/teacher-review-controls";
import { ButtonLink } from "@/components/ui/button";
import { getDiagnosis, getResponse, getStudent } from "@/lib/demo-data";
import type { MisconceptionCluster } from "@/lib/types";

export function ClusterWorkbench({ cluster }: { cluster: MisconceptionCluster }) {
  const [selectedId, setSelectedId] = useState(cluster.responseIds[0]);
  const items = useMemo(() => cluster.responseIds.map((id) => {
    const response = getResponse(id);
    const diagnosis = getDiagnosis(id);
    const student = response ? getStudent(response.studentId) : undefined;
    return response && diagnosis && student ? { response, diagnosis, student } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null), [cluster.responseIds]);
  const selected = items.find((item) => item.response.id === selectedId) ?? items[0];
  if (!selected) return null;
  const selectedIndex = items.findIndex((item) => item.response.id === selected.response.id);

  return (
    <div className="workbench">
      <aside className="response-rail" aria-label="Student responses">
        <div className="response-rail-head"><span>{items.length} responses</span><small>Anonymous synthetic data</small></div>
        {items.map(({ response, diagnosis, student }) => <button type="button" key={response.id} className={selected.response.id === response.id ? "selected" : ""} onClick={() => setSelectedId(response.id)}><span className="student-monogram">{student.label.slice(-2)}</span><span><strong>{student.label}</strong><small>{response.finalAnswer}</small></span>{diagnosis.needsTeacherReview && <i aria-label="Needs review" />}</button>)}
      </aside>
      <article className="response-viewer">
        <div className="response-viewer-head"><div><span className="eyebrow"><MessageSquareText size={15} /> Selected response</span><h2>{selected.student.label}</h2></div><div className="response-nav"><button type="button" aria-label="Previous response" disabled={selectedIndex === 0} onClick={() => setSelectedId(items[selectedIndex - 1]?.response.id ?? selectedId)}><ArrowLeft size={17} /></button><span>{selectedIndex + 1} / {items.length}</span><button type="button" aria-label="Next response" disabled={selectedIndex === items.length - 1} onClick={() => setSelectedId(items[selectedIndex + 1]?.response.id ?? selectedId)}><ArrowRight size={17} /></button></div></div>
        <blockquote className="student-answer">“{selected.response.answer}”<footer>Final answer: <strong>{selected.response.finalAnswer}</strong></footer></blockquote>
        <section className="diagnosis-summary"><div><span className="eyebrow">Reconstructed reasoning</span><h2>{selected.diagnosis.summary}</h2></div><ConfidenceBadge confidence={selected.diagnosis.confidence} /></section>
        <ReasoningTimeline steps={selected.diagnosis.reasoning} />
        <EvidencePanel evidence={selected.diagnosis.evidence} alternative={selected.diagnosis.alternativeHypothesis} />
        <TeacherReviewControls key={selected.response.id} currentClusterName={cluster.name} studentLabel={selected.student.label} />
        <div className="intervention-cta"><div><strong>Ready to respond to this learning need?</strong><p>Turn the diagnosis into a focused, testable activity.</p></div><ButtonLink href="/interventions/demo">Create intervention <ArrowRight size={17} /></ButtonLink></div>
      </article>
    </div>
  );
}
