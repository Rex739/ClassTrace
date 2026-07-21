import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeacherReviewStatus } from "@/components/teacher-review-status";
import { AnalysisRunSchema, InterventionConfigSchema, TransferEvaluationSchema } from "@/lib/ai/schemas";
import { createPreparedAnalysisRun } from "@/lib/ai/prepared";
import {
  clientStoreKeys,
  createAssessmentFingerprint,
  deleteSavedAnalysis,
  imageDescriptor,
  loadIntervention,
  loadTeacherEdits,
  loadTransferEvaluation,
  matchesSavedAnalysis,
  readAssessmentDraft,
  readLatestAnalysisSnapshot,
  saveAnalysisRun,
  saveAssessmentDraft,
  saveIntervention,
  saveTeacherEdits,
  saveTransferEvaluation,
  shouldStartAnalysisRequest,
} from "@/lib/client-store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const liveRun = AnalysisRunSchema.parse({
  ...createPreparedAnalysisRun(),
  metadata: {
    ...createPreparedAnalysisRun().metadata,
    runId: "live-persisted-test",
    mode: "live",
    model: "gpt-5.6",
  },
});

const intervention = InterventionConfigSchema.parse({
  type: "teacher_review",
  title: "Check the evidence",
  targetMisconception: "Uncertain scaling",
  reason: "The available explanation is incomplete.",
  suggestedTeacherQuestion: "How does the radius appear in the area formula?",
});

const transfer = TransferEvaluationSchema.parse({
  status: "partially_resolved",
  demonstratedConcepts: ["Uses the squared scale factor"],
  remainingDifficulty: "The explanation does not connect both radius factors.",
  evidenceExcerpt: "two squared is four",
  feedbackForStudent: "Connect the scale factor to both radius factors.",
  recommendationForTeacher: "Ask for a symbolic explanation.",
  confidence: .82,
  requiresTeacherReview: false,
});

describe("browser-local persistence", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() });
  });

  it("renders calm and warning teacher-review states conditionally", () => {
    expect(renderToStaticMarkup(createElement(TeacherReviewStatus, { count: 0 }))).toContain("No review needed");
    expect(renderToStaticMarkup(createElement(TeacherReviewStatus, { count: 0 }))).toContain("badge-green");
    expect(renderToStaticMarkup(createElement(TeacherReviewStatus, { count: 2 }))).toContain("Teacher review required");
    expect(renderToStaticMarkup(createElement(TeacherReviewStatus, { count: 2 }))).toContain("badge-amber");
  });

  it("saves and restores a validated assessment draft without image contents", () => {
    const descriptor = imageDescriptor({ name: "synthetic.png", type: "image/png", size: 8, lastModified: 123 });
    saveAssessmentDraft({
      question: "A circle has radius 3 cm. What happens when its radius doubles?",
      expectedReasoning: "Use area equals pi times radius squared and compare the scale factor.",
      typedResponses: ["The area becomes four times as large."],
      imageMetadata: [descriptor],
      analysisMode: "live",
    });
    expect(readAssessmentDraft()).toMatchObject({
      rejected: false,
      value: { typedResponses: ["The area becomes four times as large."], imageMetadata: [descriptor], analysisMode: "live" },
    });
    const serialized = storage.getItem(clientStoreKeys.draft)!;
    expect(serialized).not.toMatch(/data:image|base64|objectURL|image bytes/i);
    expect(JSON.parse(serialized).imageMetadata[0]).toEqual(descriptor);
  });

  it("rejects File objects and malformed stored drafts safely", () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "work.png", { type: "image/png" });
    expect(() => saveAssessmentDraft({
      question: "Question",
      expectedReasoning: "Reasoning",
      typedResponses: [],
      imageMetadata: [file] as never,
      analysisMode: "live",
    })).toThrow();
    expect(storage.getItem(clientStoreKeys.draft)).toBeNull();

    storage.setItem(clientStoreKeys.draft, JSON.stringify({ version: 99, imageBytes: "data:image/png;base64,secret" }));
    expect(readAssessmentDraft()).toEqual({ value: null, rejected: true });
    expect(storage.getItem(clientStoreKeys.draft)).toBeNull();
  });

  it("persists a completed run and its teacher-reviewed related state", () => {
    const fingerprint = "a".repeat(64);
    saveAnalysisRun(liveRun, fingerprint);
    const edits = { ...loadTeacherEdits(), approvedResponseIds: [liveRun.individualAnalyses[0]!.responseId] };
    saveTeacherEdits(edits);
    saveIntervention(intervention);
    saveTransferEvaluation(transfer);

    const restored = readLatestAnalysisSnapshot();
    expect(restored.rejected).toBe(false);
    expect(restored.value).toMatchObject({ fingerprint, run: { metadata: { runId: "live-persisted-test", mode: "live" } }, approvedIntervention: intervention, transferEvaluation: transfer });
    expect(loadTeacherEdits().approvedResponseIds).toEqual(edits.approvedResponseIds);
    expect(loadIntervention()).toEqual(intervention);
    expect(loadTransferEvaluation()).toEqual(transfer);
  });

  it("fingerprints canonical safe inputs and prevents automatic duplicate cost", async () => {
    const input = {
      question: liveRun.assessment.question,
      expectedReasoning: liveRun.assessment.expectedReasoning,
      typedResponses: liveRun.individualAnalyses.map((item) => item.extractedResponse),
      imageDescriptors: [],
    };
    const fingerprint = await createAssessmentFingerprint(input);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await createAssessmentFingerprint(input)).toBe(fingerprint);
    saveAnalysisRun(liveRun, fingerprint);
    const saved = readLatestAnalysisSnapshot().value;
    expect(matchesSavedAnalysis(fingerprint, saved)).toBe(true);
    expect(shouldStartAnalysisRequest(fingerprint, saved, false)).toBe(false);
    expect(shouldStartAnalysisRequest(fingerprint, saved, true)).toBe(true);
    expect(await createAssessmentFingerprint({ ...input, typedResponses: [...input.typedResponses, "Different"] })).not.toBe(fingerprint);
  });

  it("requires the explicit deletion function to remove the complete saved snapshot", () => {
    saveAnalysisRun(liveRun, "b".repeat(64));
    saveIntervention(intervention);
    saveTransferEvaluation(transfer);
    expect(readLatestAnalysisSnapshot().value).not.toBeNull();
    deleteSavedAnalysis();
    expect(readLatestAnalysisSnapshot()).toEqual({ value: null, rejected: false });
  });
});
