"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CircleExplorer } from "@/components/circle-explorer";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProductBoundaryNote } from "@/components/product-boundary-note";
import { InterventionConfigSchema, type InterventionConfig } from "@/lib/ai/schemas";
import { applyTeacherEdits, saveIntervention } from "@/lib/client-store";
import { useAnalysisRun, useIntervention, useTeacherEdits } from "@/lib/use-client-store";

export function LiveInterventionStudio() {
  const params = useSearchParams();
  const run = useAnalysisRun();
  const edits = useTeacherEdits();
  const [clusterId, setClusterId] = useState(params.get("cluster") ?? "");
  const storedIntervention = useIntervention();
  const [interventionOverride, setIntervention] = useState<InterventionConfig | null | undefined>(undefined);
  const intervention = interventionOverride === undefined ? storedIntervention : interventionOverride;
  const [loading, setLoading] = useState(false);
  const [approvedState, setApprovedState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analysis = useMemo(() => run ? applyTeacherEdits(run.classAnalysis, edits) : null, [run, edits]);
  const cluster = analysis?.clusters.find((item) => item.id === clusterId);
  const approved = approvedState || Boolean(storedIntervention && interventionOverride === undefined);

  function setApproved(value: boolean) {
    if (value && intervention) saveIntervention(intervention);
    setApprovedState(value);
  }

  async function generate() {
    if (!run || !analysis || !clusterId) return;
    setLoading(true); setError(null); setApproved(false);
    try {
      const response = await fetch("/api/interventions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: { ...run, classAnalysis: analysis }, clusterId }) });
      const payload = await response.json() as { intervention?: unknown; error?: { message: string } };
      if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "Intervention generation failed.");
      const next = InterventionConfigSchema.parse(payload.intervention);
      setIntervention(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Intervention generation failed."); }
    finally { setLoading(false); }
  }

  if (!run || !analysis) return <AppShell><main className="error-state"><span>No live run found</span><h1>Analyse a class first.</h1><ButtonLink href="/assessments/new">Return to assessment setup</ButtonLink></main></AppShell>;
  return <AppShell active="analysis"><div className="page-width page-stack"><Link href="/analyses/live" className="back-link"><ArrowLeft size={16} /> Back to live analysis</Link><header className="intervention-header"><div><div className="cluster-header-meta"><Badge tone="blue">Live configuration · GPT-5.6</Badge><span>Trusted React components only</span></div><h1>{intervention?.title ?? "Configure a targeted intervention"}</h1><p>{intervention && "learningObjective" in intervention ? intervention.learningObjective : "Choose an approved reasoning pattern. GPT-5.6 will configure—not code—the activity."}</p></div></header><ProductBoundaryNote /><div className="intervention-layout"><main><section className="activity-sequence"><span className="eyebrow"><Sparkles size={15} /> Intervention request</span><h2>Select a possible misconception cluster</h2><label className="field">Target cluster<select value={clusterId} onChange={(event) => { setClusterId(event.target.value); setIntervention(null); }}><option value="">Choose a cluster</option>{analysis.clusters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{cluster && <p className="intervention-context"><strong>Evidence pattern:</strong> {cluster.sharedReasoningPattern}</p>}<Button type="button" onClick={generate} disabled={!clusterId || loading}>{loading ? <LoaderCircle className="spinning" size={16} /> : <Sparkles size={16} />}{loading ? "Generating configuration" : "Generate with GPT-5.6"}</Button>{error && <div className="analysis-error" role="alert"><strong>Intervention was not generated</strong><p>{error}</p><Button type="button" variant="secondary" onClick={generate}>Retry</Button></div>}</section>{intervention && <InterventionRenderer intervention={intervention} />}</main><aside className="approval-panel"><span className="eyebrow">Teacher approval</span><h2>{approved ? "Activity approved" : "Review before sharing"}</h2><p>Only validated configuration is passed into trusted ClassTrace components. Model-generated code is rejected.</p><div className="approval-checks"><span><Check size={15} /> Grounded in selected cluster evidence</span><span><Check size={15} /> Structured configuration validated</span><span><Check size={15} /> No executable model output</span></div>{!approved ? <Button type="button" disabled={!intervention} onClick={() => setApproved(true)}><Check size={16} /> Approve activity</Button> : <ButtonLink href="/learn/live">Open student view <ArrowRight size={16} /></ButtonLink>}</aside></div></div></AppShell>;
}

export function InterventionRenderer({ intervention }: { intervention: InterventionConfig }) {
  if (intervention.type === "teacher_review") return <section className="transfer-card"><Badge tone="amber">Teacher review required</Badge><h2>{intervention.reason}</h2><p><strong>Suggested question:</strong> {intervention.suggestedTeacherQuestion}</p></section>;
  if (intervention.type === "circle_area_explorer") return <><section className="activity-sequence"><span className="eyebrow">Prediction</span><h2>{intervention.predictionPrompt}</h2><ol>{intervention.explanationSteps.map((step, index) => <li key={step}><span className="sequence-number">{index + 1}</span><div><h3>Explanation step</h3><p>{step}</p></div></li>)}</ol></section><CircleExplorer initialRadius={intervention.startingRadius} comparisonRadius={intervention.comparisonRadius} /><section className="transfer-card"><span className="eyebrow">Transfer check</span><h2>{intervention.transferQuestion.prompt}</h2><p>{intervention.reflectionQuestion}</p></section></>;
  if (intervention.type === "comparison_activity") return <section className="activity-sequence"><span className="eyebrow">Comparison activity</span><h2>{intervention.comparisonPrompt}</h2><ol>{intervention.cases.map((item, index) => <li key={item.label}><span className="sequence-number">{index + 1}</span><div><h3>{item.label}</h3><p><strong>{item.expression}</strong><br />{item.discussionPrompt}</p></div></li>)}</ol><div className="transfer-card"><h2>{intervention.transferQuestion.prompt}</h2></div></section>;
  return <section className="activity-sequence"><span className="eyebrow">Worked example</span><h2>{intervention.problem}</h2><ol>{intervention.steps.map((item, index) => <li key={`${item.expression}-${index}`}><span className="sequence-number">{index + 1}</span><div><h3>{item.expression}</h3><p>{item.explanation}</p></div></li>)}</ol><div className="transfer-card"><h2>{intervention.transferQuestion.prompt}</h2><p>{intervention.selfExplanationPrompt}</p></div></section>;
}
