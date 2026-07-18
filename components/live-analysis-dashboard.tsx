"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCcw, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AssessmentQuestionCard } from "@/components/question-card";
import { TraceMap } from "@/components/trace-map";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProductBoundaryNote } from "@/components/product-boundary-note";
import { ProvenanceCard } from "@/components/provenance-card";
import { applyTeacherEdits } from "@/lib/client-store";
import { useAnalysisRun, useTeacherEdits } from "@/lib/use-client-store";

export function LiveAnalysisDashboard() {
  const run = useAnalysisRun();
  const edits = useTeacherEdits();
  const classAnalysis = useMemo(() => run ? applyTeacherEdits(run.classAnalysis, edits) : null, [run, edits]);
  if (!run || !classAnalysis) return <AppShell active="analysis"><main className="error-state"><span>No live run found</span><h1>Start with an assessment.</h1><p>Live results stay on this device and may have been cleared.</p><ButtonLink href="/assessments/new">Return to assessment setup</ButtonLink></main></AppShell>;
  const questionCard = { id: run.metadata.runId, title: "Live assessment", subject: "Live teacher analysis", question: run.assessment.question, expectedReasoning: run.assessment.expectedReasoning.split("\n"), createdLabel: `${run.metadata.responseCount} responses` };
  const attention = run.individualAnalyses.filter((item) => classAnalysis.teacherAttentionResponseIds.includes(item.responseId));
  return <AppShell active="analysis"><div className="page-width page-stack">
    <header className="analysis-header"><div><div className="analysis-breadcrumb"><Link href="/">ClassTrace</Link><span>/</span><span>Live run {run.metadata.runId.slice(0, 8)}</span></div><h1>Class reasoning analysis</h1><p><Badge tone="blue">Live analysis · GPT-5.6</Badge></p></div><div className="analysis-actions"><ButtonLink href="/assessments/new" variant="secondary"><RefreshCcw size={16} /> New analysis</ButtonLink><ButtonLink href="/analyses/live/outcomes">View outcomes <ArrowRight size={16} /></ButtonLink></div></header>
    <ProductBoundaryNote />
    <AssessmentQuestionCard assessment={questionCard} />
    <section className="metrics" aria-label="Live analysis summary"><article><span><Users size={18} /></span><div><strong>{classAnalysis.classSummary.totalResponses}</strong><small>responses represented</small></div></article><article><span><AlertTriangle size={18} /></span><div><strong>{classAnalysis.clusters.length}</strong><small>possible misconception clusters</small></div></article><article><span><CheckCircle2 size={18} /></span><div><strong>{classAnalysis.demonstratedUnderstandingResponseIds.length}</strong><small>demonstrated understanding</small></div></article><article><span><Clock3 size={18} /></span><div><strong>{classAnalysis.teacherAttentionResponseIds.length}</strong><small>teacher review required</small></div></article></section>
    <TraceMap analysis={classAnalysis} basePath="/analyses/live/clusters" />
    <section><div className="section-heading-row"><div><span className="eyebrow">Evidence-grounded groups</span><h2>Possible misconception clusters</h2></div><p>Grouped by reasoning evidence, never final answer alone.</p></div><div className="cluster-grid">{classAnalysis.clusters.map((cluster) => <article className="card cluster-card" key={cluster.id}><div className="cluster-card-top"><Badge tone={cluster.confidence < .8 ? "amber" : "blue"}>{Math.round(cluster.confidence * 100)}% confidence</Badge><span><Users size={15} /> {cluster.responseIds.length} learners</span></div><h3>{cluster.title}</h3><p>{cluster.explanation}</p><div className="cluster-need"><span>Shared reasoning pattern</span>{cluster.sharedReasoningPattern}</div><Link href={`/analyses/live/clusters/${cluster.id}`}>Inspect evidence <ArrowRight size={16} /></Link></article>)}</div></section>
    <div className="analysis-lower"><section className="attention-queue"><div className="section-heading-row"><div><span className="eyebrow">Teacher attention</span><h2>{attention.length} responses need review</h2></div><Badge tone="amber">Teacher review required</Badge></div><div>{attention.map((item) => <Link key={item.responseId} href="/analyses/live"><span className="student-monogram">{item.studentAlias.slice(-2)}</span><span><strong>{item.studentAlias}</strong><small>{item.reviewReason ?? item.observableReasoningSummary}</small></span><Badge tone="amber">{Math.round(item.confidence * 100)}%</Badge></Link>)}</div></section><ProvenanceCard run={{ ...run, classAnalysis }} /></div>
  </div></AppShell>;
}
