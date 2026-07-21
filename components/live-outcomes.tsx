"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, CircleHelp, TrendingDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProductBoundaryNote } from "@/components/product-boundary-note";
import { ProvenanceCard } from "@/components/provenance-card";
import { TransferDifficultyDetail } from "@/components/transfer-difficulty-detail";
import { useAnalysisRun, useIntervention, useTransferEvaluation } from "@/lib/use-client-store";

export function LiveOutcomes() {
  const run = useAnalysisRun();
  const intervention = useIntervention();
  const evaluation = useTransferEvaluation();

  if (!run) {
    return (
      <AppShell>
        <main className="error-state">
          <span>No live run found</span>
          <h1>Analyse a class first.</h1>
          <ButtonLink href="/assessments/new">Return to assessment setup</ButtonLink>
        </main>
      </AppShell>
    );
  }

  const tone = evaluation?.status === "resolved" ? "green" : evaluation?.status === "unresolved" ? "red" : "amber";

  return (
    <AppShell active="analysis">
      <div className="page-width page-stack">
        <Link href="/analyses/live" className="back-link"><ArrowLeft size={16} /> Back to live analysis</Link>
        <header className="outcomes-header">
          <div>
            <span className="eyebrow">Verified outcome · GPT-5.6</span>
            <h1>{evaluation ? "Transfer evidence is ready for review." : "Complete a transfer check to verify change."}</h1>
            <p>ClassTrace evaluates the learner’s explanation—not only the final answer—and allows uncertainty.</p>
          </div>
          {evaluation && <Badge tone={tone}>{evaluation.status.replace("_", " ")}</Badge>}
        </header>
        <ProductBoundaryNote />
        {evaluation ? (
          <>
            <section className="outcome-comparison">
              <div className="comparison-label"><span className="eyebrow"><TrendingDown size={15} /> Before and after</span><h2>Evidence for one completed transfer check</h2></div>
              <div className="comparison-side"><span>Before intervention</span><strong>1</strong><div className="bar before" style={{ "--bar": "100%" } as React.CSSProperties} /><small>targeted possible misconception</small></div>
              <div className="comparison-arrow">→</div>
              <div className="comparison-side"><span>After transfer check</span><strong>{evaluation.status === "resolved" ? 0 : 1}</strong><div className="bar after" style={{ "--bar": evaluation.status === "resolved" ? "0%" : "100%" } as React.CSSProperties} /><small>{evaluation.status.replace("_", " ")}</small></div>
            </section>
            <section className="outcome-status-grid">
              <article className={evaluation.status === "resolved" ? "status-resolved" : "status-uncertain"}>
                {evaluation.status === "resolved" ? <CheckCircle2 size={21} /> : <CircleHelp size={21} />}
                <div><strong>{Math.round(evaluation.confidence * 100)}%</strong><span>Evaluation confidence</span><p>{evaluation.feedbackForStudent}</p></div>
              </article>
              <article className={evaluation.requiresTeacherReview ? "status-follow" : "status-resolved"}>
                {evaluation.requiresTeacherReview ? <AlertCircle size={21} /> : <CheckCircle2 size={21} />}
                <div><strong>{evaluation.requiresTeacherReview ? "Yes" : "No"}</strong><span>Teacher review required</span><p>{evaluation.recommendationForTeacher}</p></div>
              </article>
              <article className="status-uncertain"><CircleHelp size={21} /><div><strong>{evaluation.demonstratedConcepts.length}</strong><span>Demonstrated concepts</span><p>{evaluation.demonstratedConcepts.join(" · ") || "No concept was demonstrated with enough evidence."}</p></div></article>
            </section>
            <section className="card outcome-evidence-detail">
              <span className="eyebrow">Submitted-work evidence</span>
              <h2>{evaluation.evidenceExcerpt ? `“${evaluation.evidenceExcerpt}”` : "No sufficiently specific excerpt was available."}</h2>
              <dl className="outcome-context">
                <div><dt>Original target</dt><dd>{intervention?.targetMisconception ?? "The teacher-approved intervention target"}</dd></div>
                <TransferDifficultyDetail status={evaluation.status} remainingDifficulty={evaluation.remainingDifficulty} />
              </dl>
            </section>
          </>
        ) : (
          <section className="empty-outcome card">
            <CircleHelp size={28} />
            <h2>No live transfer evaluation yet</h2>
            <p>Open the approved student activity, complete the transfer question, and return here.</p>
            <ButtonLink href="/learn/live">Open student activity <ArrowLeft size={16} /></ButtonLink>
          </section>
        )}
        <ProvenanceCard run={run} />
      </div>
    </AppShell>
  );
}
