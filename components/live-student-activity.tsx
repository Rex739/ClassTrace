"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { CircleExplorer } from "@/components/circle-explorer";
import { Button, ButtonLink } from "@/components/ui/button";
import { saveTransferEvaluation } from "@/lib/client-store";
import { TransferEvaluationSchema, type TransferEvaluation } from "@/lib/ai/schemas";
import { useIntervention } from "@/lib/use-client-store";

export function LiveStudentActivity() {
  const intervention = useIntervention();
  const [stage, setStage] = useState(0);
  const [prediction, setPrediction] = useState("");
  const [explanation, setExplanation] = useState("");
  const [answer, setAnswer] = useState("");
  const [transferExplanation, setTransferExplanation] = useState("");
  const [evaluation, setEvaluation] = useState<TransferEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!intervention) return <main className="error-state"><span>No approved live activity</span><h1>Ask your teacher to prepare the intervention.</h1><ButtonLink href="/interventions/live">Return to intervention studio</ButtonLink></main>;
  if (intervention.type === "teacher_review") return <main className="error-state"><span>Teacher conversation</span><h1>{intervention.suggestedTeacherQuestion}</h1><p>{intervention.reason}</p></main>;
  const transferQuestion = intervention.transferQuestion;
  const objective = intervention.learningObjective;
  const target = intervention.targetMisconception;
  const circle = intervention.type === "circle_area_explorer" ? intervention : null;

  async function submitTransfer() {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/transfer-evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetMisconception: target, learningObjective: objective, transferQuestion, learnerAnswer: answer, learnerExplanation: transferExplanation }) });
      const payload = await response.json() as { evaluation?: unknown; error?: { message: string } };
      if (!response.ok || payload.error) throw new Error(payload.error?.message ?? "Evaluation failed.");
      const next = TransferEvaluationSchema.parse(payload.evaluation);
      saveTransferEvaluation(next); setEvaluation(next); setStage(4);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Evaluation failed."); }
    finally { setLoading(false); }
  }

  if (evaluation) return <div className="completion-state"><span><CheckCircle2 size={42} /></span><p className="eyebrow">Transfer check evaluated · GPT-5.6</p><h1>{evaluation.status === "resolved" ? "Your reasoning transferred." : evaluation.status === "partially_resolved" ? "Your model is taking shape." : "There’s more to investigate."}</h1><p>{evaluation.feedbackForStudent}</p><div className="completion-evidence"><span>Evidence status</span><strong>{evaluation.status.replace("_", " ")}</strong><small>{evaluation.requiresTeacherReview ? "Teacher review required" : `${Math.round(evaluation.confidence * 100)}% evaluation confidence`}</small></div><Link href="/analyses/live/outcomes" className="button button-primary">View outcome evidence <ArrowRight size={17} /></Link></div>;

  return <div className="student-activity"><header><span>{intervention.title}</span><ol>{["Predict", "Explore", "Explain", "Transfer"].map((label, index) => <li key={label} className={index === stage ? "current" : index < stage ? "done" : ""}><span>{index + 1}</span>{label}</li>)}</ol></header><main>{stage === 0 && <section className="activity-prompt"><span className="eyebrow">Start with your thinking</span><h1>{circle?.predictionPrompt ?? "What do you predict before working through the activity?"}</h1><label className="field"><span>Your prediction</span><textarea rows={5} value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="I predict…" /></label></section>}{stage === 1 && (circle ? <CircleExplorer initialRadius={circle.startingRadius} comparisonRadius={circle.comparisonRadius} studentMode /> : <section className="activity-prompt"><span className="eyebrow">Explore the examples</span><h1>{objective}</h1><p>Compare the representations in the teacher-approved activity.</p></section>)}{stage === 2 && <section className="activity-prompt"><span className="eyebrow">Explain what changed</span><h1>{objective}</h1><label className="field"><span>Your explanation</span><textarea rows={7} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="The evidence shows…" /></label></section>}{stage === 3 && <section className="activity-prompt"><span className="eyebrow">Transfer to a new case</span><h1>{transferQuestion.prompt}</h1><div className="transfer-input-grid"><label className="field">Answer<input value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><label className="field">Short explanation<textarea rows={6} value={transferExplanation} onChange={(event) => setTransferExplanation(event.target.value)} placeholder="Explain how you know…" /></label></div>{error && <div className="analysis-error" role="alert"><strong>Evaluation did not complete</strong><p>{error}</p></div>}</section>}</main><footer><button type="button" className="button button-ghost" disabled={stage === 0 || loading} onClick={() => setStage((value) => Math.max(0, value - 1))}>Back</button>{stage < 3 ? <Button type="button" disabled={(stage === 0 && prediction.trim().length < 2) || (stage === 2 && explanation.trim().length < 10)} onClick={() => setStage((value) => value + 1)}>Continue <ArrowRight size={17} /></Button> : <Button type="button" disabled={answer.trim().length < 1 || transferExplanation.trim().length < 10 || loading} onClick={submitTransfer}>{loading ? <LoaderCircle className="spinning" size={17} /> : null}{loading ? "Evaluating reasoning" : "Submit transfer check"}</Button>}</footer></div>;
}
