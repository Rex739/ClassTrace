"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, UploadCloud, WandSparkles } from "lucide-react";
import { assessmentSchema } from "@/lib/validation";
import { assessment } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NewAssessmentForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);

  function addFiles(next: FileList | null) {
    if (!next) return;
    setFiles(Array.from(next).filter((file) => ["text/csv", "text/plain", "application/pdf"].includes(file.type) || /\.(csv|txt|pdf)$/i.test(file.name)));
  }

  function submit() {
    const result = assessmentSchema.safeParse({ question, expectedReasoning: reasoning, responseCount: files.length });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    router.push("/analyses/demo");
  }

  function prepareDemo() {
    setQuestion(assessment.question);
    setReasoning(assessment.expectedReasoning.join("\n"));
    setFiles([new File(["Prepared deterministic responses"], "classtrace-demo-responses.csv", { type: "text/csv" })]);
    setErrors({});
  }

  return (
    <div className="form-layout">
      <div className="form-main">
        <section className="form-section" aria-labelledby="question-heading">
          <div className="step-number">01</div><div><h2 id="question-heading">Set the question</h2><p>Give ClassTrace the exact prompt your class received.</p></div>
          <label className="field field-wide">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="What did you ask your class?" aria-describedby={errors.question ? "question-error" : undefined} />{errors.question && <small className="field-error" id="question-error">{errors.question}</small>}</label>
        </section>
        <section className="form-section" aria-labelledby="reasoning-heading">
          <div className="step-number">02</div><div><h2 id="reasoning-heading">Describe expected reasoning</h2><p>Capture the ideas that matter, not only the correct answer.</p></div>
          <label className="field field-wide">Reasoning guide or rubric<textarea value={reasoning} onChange={(event) => setReasoning(event.target.value)} rows={6} placeholder="For example: identify the formula, substitute correctly, explain the scale factor…" />{errors.expectedReasoning && <small className="field-error">{errors.expectedReasoning}</small>}</label>
        </section>
        <section className="form-section" aria-labelledby="responses-heading">
          <div className="step-number">03</div><div><h2 id="responses-heading">Add student responses</h2><p>Upload a CSV, text file or PDF. Student identifiers should be anonymous.</p></div>
          <div className={`drop-zone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <input ref={fileRef} type="file" multiple accept=".csv,.txt,.pdf" onChange={(event) => addFiles(event.target.files)} className="sr-only" />
            <UploadCloud size={28} /><strong>Drop response files here</strong><span>or</span><Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Choose files</Button>
          </div>
          {errors.responseCount && <small className="field-error">{errors.responseCount}</small>}
          {files.length > 0 && <ul className="file-list">{files.map((file) => <li key={file.name}><FileText size={16} /><span>{file.name}</span><button type="button" onClick={() => setFiles((items) => items.filter((item) => item.name !== file.name))}>Remove</button></li>)}</ul>}
        </section>
        <div className="form-actions"><Button type="button" onClick={submit}>Build class trace <ArrowRight size={17} /></Button><span>Nothing is uploaded in this Phase 1 demo.</span></div>
      </div>
      <aside>
        <Card className="demo-option"><span className="demo-icon"><WandSparkles size={20} /></span><h2>Use the prepared demo</h2><p>Load the circle question and 12 synthetic responses to explore the complete ClassTrace journey.</p><Button type="button" variant="secondary" onClick={prepareDemo}>Prepare demo</Button></Card>
        <div className="privacy-note"><strong>Designed for safe demos</strong><p>All prepared learners are synthetic and labelled anonymously.</p></div>
      </aside>
    </div>
  );
}
