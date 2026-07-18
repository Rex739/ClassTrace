"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildEvidenceExport, loadIntervention, loadTeacherEdits, loadTransferEvaluation } from "@/lib/client-store";
import type { AnalysisRun } from "@/lib/ai/schemas";
import { getRunLabel } from "@/lib/run-provenance";

export function ProvenanceCard({ run }: { run: AnalysisRun }) {
  const [copied, setCopied] = useState(false);
  async function copyEvidence() {
    const payload = buildEvidenceExport(run, loadTeacherEdits(), loadIntervention(), loadTransferEvaluation());
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
  }
  return <section className="provenance-card" aria-labelledby="provenance-title"><div><span className="eyebrow"><Fingerprint size={15} /> Analysis provenance</span><h2 id="provenance-title">{run.metadata.mode === "live" ? "Live analysis" : "Prepared demonstration"}</h2></div><dl><div><dt>Mode</dt><dd><Badge tone={run.metadata.mode === "live" ? "blue" : "neutral"}>{getRunLabel(run.metadata)}</Badge></dd></div><div><dt>Created</dt><dd>{new Date(run.metadata.createdAt).toLocaleString()}</dd></div><div><dt>Responses</dt><dd>{run.metadata.responseCount}</dd></div><div><dt>Teacher review</dt><dd>{run.metadata.teacherReviewCount}</dd></div><div><dt>Run ID</dt><dd>{run.metadata.runId.slice(0, 8)}</dd></div></dl><Button type="button" variant="secondary" onClick={copyEvidence}>{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}{copied ? "Evidence copied" : "Copy JSON evidence"}</Button></section>;
}
