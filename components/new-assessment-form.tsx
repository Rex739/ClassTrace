"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileImage, History, LoaderCircle, Trash2, UploadCloud, WandSparkles, X } from "lucide-react";
import { assessmentSchema } from "@/lib/validation";
import { assessment, responses } from "@/lib/demo-data";
import { AnalysisRunSchema, MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from "@/lib/ai/schemas";
import {
  clearAssessmentDraft,
  createAssessmentFingerprint,
  deleteSavedAnalysis,
  imageDescriptor,
  loadLatestAnalysisSnapshot,
  readAssessmentDraft,
  readLatestAnalysisSnapshot,
  saveAnalysisRun,
  saveAssessmentDraft,
  shouldStartAnalysisRequest,
  type SafeImageDescriptor,
} from "@/lib/client-store";
import { useLatestAnalysisSnapshot } from "@/lib/use-client-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductBoundaryNote } from "@/components/product-boundary-note";

const progressStages = [
  ["preparing", "Preparing responses"],
  ["reading", "Reading student work"],
  ["reasoning", "Reconstructing observable reasoning"],
  ["clustering", "Discovering shared patterns"],
  ["validating", "Validating evidence"],
  ["review", "Preparing teacher review"],
  ["complete", "Complete"],
] as const;

type SafeApiError = { code: string; message: string; retryable: boolean };
type Confirmation = "clear-draft" | "delete-analysis" | "start-new" | null;

export function NewAssessmentForm() {
  const router = useRouter();
  const latest = useLatestAnalysisSnapshot();
  const fileRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const skipDraftSave = useRef(false);
  const [question, setQuestion] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [responseText, setResponseText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [restoredImageMetadata, setRestoredImageMetadata] = useState<SafeImageDescriptor[]>([]);
  const [analysisMode, setAnalysisMode] = useState<"live" | "prepared_demo">("live");
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [apiError, setApiError] = useState<SafeApiError | null>(null);
  const [duplicateFingerprint, setDuplicateFingerprint] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  const typedLines = useMemo(() => responseText.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12), [responseText]);
  const currentImageMetadata = useMemo(() => files.map(imageDescriptor), [files]);

  useEffect(() => {
    const draftResult = readAssessmentDraft();
    const latestResult = readLatestAnalysisSnapshot();
    const timer = window.setTimeout(() => {
      if (draftResult.value) {
        setQuestion(draftResult.value.question);
        setReasoning(draftResult.value.expectedReasoning);
        setResponseText(draftResult.value.typedResponses.join("\n"));
        setRestoredImageMetadata(draftResult.value.imageMetadata);
        setAnalysisMode(draftResult.value.analysisMode);
      }
      if (draftResult.rejected || latestResult.rejected) {
        setStorageNotice("An incompatible saved ClassTrace record was discarded. You can continue safely.");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipDraftSave.current) { skipDraftSave.current = false; return; }
    const timer = window.setTimeout(() => saveAssessmentDraft({
      question,
      expectedReasoning: reasoning,
      typedResponses: typedLines,
      imageMetadata: currentImageMetadata.length > 0 ? currentImageMetadata : restoredImageMetadata,
      analysisMode,
    }), 250);
    return () => window.clearTimeout(timer);
  }, [analysisMode, currentImageMetadata, hydrated, question, reasoning, restoredImageMetadata, typedLines]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [running]);

  function addFiles(next: FileList | null) {
    if (!next) return;
    const candidates = Array.from(next);
    const unsupported = candidates.find((file) => !SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]));
    const oversized = candidates.find((file) => file.size > MAX_IMAGE_BYTES);
    if (unsupported) { setErrors((value) => ({ ...value, responseCount: "Student-work images must be PNG, JPEG, or WebP." })); return; }
    if (oversized) { setErrors((value) => ({ ...value, responseCount: "Each image must be 5 MB or smaller." })); return; }
    const remaining = Math.max(0, 12 - typedLines.length);
    setFiles(candidates.slice(0, remaining));
    setRestoredImageMetadata([]);
    setErrors((value) => ({ ...value, responseCount: "" }));
  }

  function loadSampleInputs() {
    setQuestion(assessment.question);
    setReasoning(assessment.expectedReasoning.join("\n"));
    setResponseText(responses.map((response) => response.answer).join("\n"));
    setFiles([]);
    setRestoredImageMetadata([]);
    setAnalysisMode("live");
    setErrors({});
    setApiError(null);
    setDuplicateFingerprint(null);
  }

  function resetForm() {
    skipDraftSave.current = true;
    setQuestion("");
    setReasoning("");
    setResponseText("");
    setFiles([]);
    setRestoredImageMetadata([]);
    setAnalysisMode("live");
    setErrors({});
    setApiError(null);
    setDuplicateFingerprint(null);
    clearAssessmentDraft();
    setConfirmation(null);
  }

  function openPreparedDemo() {
    setAnalysisMode("prepared_demo");
    saveAssessmentDraft({
      question,
      expectedReasoning: reasoning,
      typedResponses: typedLines,
      imageMetadata: currentImageMetadata.length > 0 ? currentImageMetadata : restoredImageMetadata,
      analysisMode: "prepared_demo",
    });
    router.push("/analyses/demo");
  }

  async function analyseLive(runAnyway = false) {
    if (running || submitLock.current) return;
    const responseCount = typedLines.length + files.length;
    const validation = assessmentSchema.safeParse({ question, expectedReasoning: reasoning, responseCount });
    if (!validation.success) {
      setErrors(Object.fromEntries(validation.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    if (responseCount > 12) { setErrors({ responseCount: "ClassTrace supports up to 12 responses per analysis." }); return; }

    submitLock.current = true;
    setAnalysisMode("live");
    try {
      const fingerprint = await createAssessmentFingerprint({
        question,
        expectedReasoning: reasoning,
        typedResponses: typedLines,
        imageDescriptors: currentImageMetadata,
      });
      const savedSnapshot = loadLatestAnalysisSnapshot();
      if (!shouldStartAnalysisRequest(fingerprint, savedSnapshot, runAnyway)) {
        setDuplicateFingerprint(fingerprint);
        return;
      }

      setDuplicateFingerprint(null);
      setRunning(true);
      setApiError(null);
      setActiveStage("preparing");
      setElapsedSeconds(0);
      const typedResponses = typedLines.map((text, index) => ({ responseId: `response-${String(index + 1).padStart(2, "0")}`, studentAlias: `Learner ${String(index + 1).padStart(2, "0")}`, responseText: text }));
      const imageResponses = files.map((_, index) => ({ responseId: `response-${String(typedResponses.length + index + 1).padStart(2, "0")}`, studentAlias: `Learner ${String(typedResponses.length + index + 1).padStart(2, "0")}`, fileIndex: index }));
      const payload = { mode: "live", question, expectedReasoning: reasoning, typedResponses, imageResponses };
      const body = new FormData();
      body.set("payload", JSON.stringify(payload));
      files.forEach((file) => body.append("images", file));
      const response = await fetch("/api/analyses", { method: "POST", body });
      if (!response.body) throw new Error("The analysis stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as { type: string; stage?: string; data?: unknown; error?: SafeApiError };
          if (event.type === "stage" && event.stage) setActiveStage(event.stage);
          if (event.type === "error" && event.error) throw event.error;
          if (event.type === "result") {
            const run = AnalysisRunSchema.parse(event.data);
            saveAnalysisRun(run, fingerprint);
            router.push("/analyses/live");
            return;
          }
        }
        if (done) break;
      }
      throw new Error("The analysis ended before results were returned.");
    } catch (error) {
      const safe = typeof error === "object" && error !== null && "message" in error ? error as SafeApiError : { code: "NETWORK_INTERRUPTION", message: "The analysis connection was interrupted.", retryable: true };
      setApiError({ code: safe.code ?? "NETWORK_INTERRUPTION", message: String(safe.message), retryable: Boolean(safe.retryable) });
    } finally {
      setRunning(false);
      submitLock.current = false;
    }
  }

  return (
    <div className="form-layout">
      <div className="form-main">
        {storageNotice && <div className="storage-notice" role="status">{storageNotice}</div>}
        {latest?.run.metadata.mode === "live" && (
          <Card className="resume-analysis-card">
            <div><span className="eyebrow"><History size={15} /> Saved on this browser</span><h2>Resume latest analysis</h2><p title={latest.run.assessment.question}>{latest.run.assessment.question}</p><small>{latest.run.metadata.responseCount} responses · {latest.run.classAnalysis.clusters.length} clusters · {new Date(latest.run.metadata.createdAt).toLocaleDateString()} · Live analysis · GPT-5.6</small></div>
            <div className="resume-actions"><Button type="button" onClick={() => router.push("/analyses/live")}>Resume latest analysis</Button><Button type="button" variant="secondary" onClick={() => setConfirmation("start-new")}>Start a new analysis</Button><Button type="button" variant="ghost" onClick={() => setConfirmation("delete-analysis")}><Trash2 size={16} /> Delete saved analysis</Button></div>
            {confirmation === "start-new" && <ConfirmationPanel message="Clear the current assessment form and start fresh? Your saved analysis will remain available." confirmLabel="Start a new analysis" onCancel={() => setConfirmation(null)} onConfirm={resetForm} />}
            {confirmation === "delete-analysis" && <ConfirmationPanel message="Delete the saved analysis, teacher edits, approved intervention, transfer result, and fingerprint from this browser?" confirmLabel="Delete saved analysis" onCancel={() => setConfirmation(null)} onConfirm={() => { deleteSavedAnalysis(); setDuplicateFingerprint(null); setConfirmation(null); }} />}
          </Card>
        )}

        <section className="form-section" aria-labelledby="question-heading"><div className="step-number">01</div><div><h2 id="question-heading">Set the question</h2><p>Give ClassTrace the exact prompt your class received.</p></div><label className="field field-wide">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="What did you ask your class?" />{errors.question && <small className="field-error">{errors.question}</small>}</label></section>
        <section className="form-section" aria-labelledby="reasoning-heading"><div className="step-number">02</div><div><h2 id="reasoning-heading">Describe expected reasoning</h2><p>Capture the ideas that matter, not only the correct answer.</p></div><label className="field field-wide">Reasoning guide or rubric<textarea value={reasoning} onChange={(event) => setReasoning(event.target.value)} rows={6} placeholder="Identify the formula, substitute correctly, explain the scale factor…" />{errors.expectedReasoning && <small className="field-error">{errors.expectedReasoning}</small>}</label></section>
        <section className="form-section" aria-labelledby="responses-heading"><div className="step-number">03</div><div><h2 id="responses-heading">Add student responses</h2><p>Type one de-identified response per line, add student-work images, or combine both.</p></div><label className="field field-wide">Typed responses<textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} rows={9} placeholder={"One anonymous response per line\nA second response…"} /><small>{typedLines.length} typed · {files.length} images · 12 maximum</small></label><div className={`drop-zone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => addFiles(event.target.files)} className="sr-only" /><UploadCloud size={28} /><strong>Drop PNG, JPEG, or WebP work here</strong><span>5 MB per image</span><Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Choose images</Button></div>{errors.responseCount && <small className="field-error field-wide">{errors.responseCount}</small>}{files.length > 0 && <ul className="file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><FileImage size={16} /><span>{file.name}</span><button type="button" onClick={() => setFiles((items) => items.filter((item) => item !== file))}><X size={15} /><span className="sr-only">Remove {file.name}</span></button></li>)}</ul>}{restoredImageMetadata.length > 0 && files.length === 0 && <p className="upload-privacy field-wide">Saved image metadata: {restoredImageMetadata.map((item) => item.name).join(", ")}. For privacy, image contents were not retained; reattach them before analysis.</p>}<p className="upload-privacy field-wide">For this demonstration, use synthetic or de-identified student work. Images are held only for the live request and are not persisted.</p></section>

        {duplicateFingerprint && <section className="duplicate-analysis-panel" role="status"><strong>This assessment has already been analysed.</strong><p>Open the saved result without spending API credit, or deliberately run a fresh analysis.</p><div><Button type="button" onClick={() => router.push("/analyses/live")}>Open saved analysis</Button><Button type="button" variant="secondary" onClick={() => analyseLive(true)}>Run a new analysis anyway</Button></div></section>}
        {apiError && <section className="analysis-error" role="alert"><strong>{apiError.code === "MISSING_API_KEY" ? "Live analysis is not configured" : "Live analysis did not complete"}</strong><p>{apiError.message}</p><div>{apiError.retryable && <Button type="button" variant="secondary" onClick={() => analyseLive(true)}>Retry live analysis</Button>}<Button type="button" variant="ghost" onClick={openPreparedDemo}>Open prepared demonstration</Button></div></section>}
        {confirmation === "clear-draft" && <ConfirmationPanel message="Clear the current assessment draft from this browser? Your saved completed analysis will not be deleted." confirmLabel="Clear assessment draft" onCancel={() => setConfirmation(null)} onConfirm={resetForm} />}
        <div className="form-actions live-actions"><Button type="button" onClick={() => analyseLive(false)} disabled={running}>{running ? <LoaderCircle className="spinning" size={17} /> : <WandSparkles size={17} />}{running ? "Analysing with GPT-5.6" : "Analyse with GPT-5.6"}</Button><Button type="button" variant="secondary" onClick={openPreparedDemo}>Open prepared demonstration</Button><Button type="button" variant="ghost" onClick={() => setConfirmation("clear-draft")}>Clear assessment draft</Button></div>
      </div>
      <aside className="form-sidebar"><Card className="demo-option"><span className="demo-icon"><WandSparkles size={20} /></span><h2>Prepared sample, two modes</h2><p>Load the 12 synthetic circle responses and send them through GPT-5.6, or open the deterministic demonstration with no live model call.</p><p className="analysis-duration-note">Detailed class analysis usually takes about one to two minutes.</p><Button type="button" variant="secondary" onClick={loadSampleInputs}>Load sample inputs</Button></Card>{running && <Card className="progress-card" role="status" aria-live="polite" aria-atomic="true"><div className="progress-card-heading"><span className="eyebrow">Live analysis · GPT-5.6</span><strong>{elapsedSeconds}s elapsed</strong></div><p>ClassTrace is actively analysing. Duplicate submissions are disabled while this run completes.</p><ol>{progressStages.map(([id, label]) => { const activeIndex = progressStages.findIndex(([stage]) => stage === activeStage); const index = progressStages.findIndex(([stage]) => stage === id); return <li key={id} className={id === activeStage ? "active" : index < activeIndex ? "done" : ""}><span>{index < activeIndex ? "✓" : index + 1}</span>{label}</li>; })}</ol></Card>}<ProductBoundaryNote /></aside>
    </div>
  );
}

function ConfirmationPanel({ message, confirmLabel, onCancel, onConfirm }: { message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <section className="confirmation-panel" role="alertdialog" aria-label={confirmLabel}><p>{message}</p><div><Button type="button" variant="secondary" onClick={onConfirm}>{confirmLabel}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div></section>;
}
