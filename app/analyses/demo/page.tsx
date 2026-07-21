import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Users } from "lucide-react";
import { AnalysisPipeline } from "@/components/analysis-pipeline";
import { AppShell } from "@/components/app-shell";
import { AssessmentQuestionCard } from "@/components/question-card";
import { ClusterCard } from "@/components/cluster-card";
import { TraceMap } from "@/components/trace-map";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { assessment, clusters, diagnoses, getResponse, getStudent } from "@/lib/demo-data";
import { countSecureUnderstanding, getAttentionQueue } from "@/lib/analysis";
import { ProductBoundaryNote } from "@/components/product-boundary-note";
import { ProvenanceCard } from "@/components/provenance-card";
import { createPreparedAnalysisRun } from "@/lib/ai/prepared";
import { TeacherReviewStatus } from "@/components/teacher-review-status";

export const metadata = { title: "Demo analysis" };

export default function AnalysisPage() {
  const attention = getAttentionQueue(diagnoses);
  const secure = countSecureUnderstanding(diagnoses);
  const preparedRun = createPreparedAnalysisRun();
  return <AppShell active="analysis"><div className="page-width page-stack">
    <header className="analysis-header"><div><div className="analysis-breadcrumb"><Link href="/">ClassTrace</Link><span>/</span><span>Circle area scaling</span></div><h1>Class reasoning analysis</h1><p><Badge tone="neutral">Prepared demonstration · deterministic data</Badge></p></div><div className="analysis-actions"><ButtonLink href="/interventions/demo" variant="secondary">Preview intervention</ButtonLink><ButtonLink href="/analyses/demo/outcomes">View outcomes <ArrowRight size={16} /></ButtonLink></div></header>
    <ProductBoundaryNote />
    <AssessmentQuestionCard assessment={assessment} />
    <section className="metrics" aria-label="Analysis summary"><article><span><Users size={18} /></span><div><strong>12</strong><small>responses traced</small></div></article><article><span><AlertTriangle size={18} /></span><div><strong>4</strong><small>shared learning needs</small></div></article><article><span><CheckCircle2 size={18} /></span><div><strong>{secure}</strong><small>secure understanding</small></div></article><article><span><Clock3 size={18} /></span><div><strong>3</strong><small>teacher checks</small></div></article></section>
    <TraceMap />
    <section><div className="section-heading-row"><div><span className="eyebrow">Learning-need groups</span><h2>Possible misconception clusters</h2></div><p>Ordered by instructional leverage, not score.</p></div><div className="cluster-grid">{clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} />)}</div></section>
    <div className="analysis-lower"><section className="attention-queue"><div className="section-heading-row"><div><span className="eyebrow">Teacher attention</span><h2>Three interpretations to check</h2></div><TeacherReviewStatus count={attention.length} /></div><div>{attention.map((item) => { const response = getResponse(item.responseId); const student = response ? getStudent(response.studentId) : undefined; return response && student ? <Link key={item.responseId} href={`/analyses/demo/clusters/${item.clusterId}`}><span className="student-monogram">{student.label.slice(-2)}</span><span><strong>{student.label}</strong><small>{item.summary}</small></span><Badge tone="amber">{item.confidence}</Badge><ArrowRight size={16} /></Link> : null; })}</div></section><section className="pipeline-card"><span className="eyebrow">Analysis record</span><h2>How this trace was built</h2><AnalysisPipeline /></section></div>
    <ProvenanceCard run={preparedRun} />
  </div></AppShell>;
}
