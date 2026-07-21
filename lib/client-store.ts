import { z } from "zod";
import {
  AnalysisRunSchema,
  InterventionConfigSchema,
  TeacherEditsSchema,
  TransferEvaluationSchema,
  type AnalysisRun,
  type ClassAnalysis,
  type InterventionConfig,
  type TeacherEdits,
  type TransferEvaluation,
} from "@/lib/ai/schemas";

const DRAFT_KEY = "classtrace:v1:assessment-draft";
const LATEST_ANALYSIS_KEY = "classtrace:v1:latest-analysis";
const LEGACY_RUN_KEY = "classtrace:analysis-run:v1";
const LEGACY_EDITS_KEY = "classtrace:teacher-edits:v1";
const LEGACY_INTERVENTION_KEY = "classtrace:intervention:v1";
const LEGACY_TRANSFER_KEY = "classtrace:transfer:v1";
export const CLASSTRACE_STORE_EVENT = "classtrace-store-change";

export const SafeImageDescriptorSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  size: z.number().int().nonnegative().max(5 * 1024 * 1024),
  lastModified: z.number().int().nonnegative(),
}).strict();

export const AssessmentDraftSchema = z.object({
  version: z.literal(1),
  question: z.string().max(8_000),
  expectedReasoning: z.string().max(12_000),
  typedResponses: z.array(z.string().max(8_000)).max(12),
  imageMetadata: z.array(SafeImageDescriptorSchema).max(12),
  analysisMode: z.enum(["live", "prepared_demo"]),
  lastUpdated: z.string().datetime(),
}).strict();

export const LatestAnalysisSnapshotSchema = z.object({
  version: z.literal(1),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  run: AnalysisRunSchema,
  teacherEdits: TeacherEditsSchema,
  approvedIntervention: InterventionConfigSchema.nullable(),
  transferEvaluation: TransferEvaluationSchema.nullable(),
  savedAt: z.string().datetime(),
}).strict();

export type AssessmentDraft = z.infer<typeof AssessmentDraftSchema>;
export type SafeImageDescriptor = z.infer<typeof SafeImageDescriptorSchema>;
export type LatestAnalysisSnapshot = z.infer<typeof LatestAnalysisSnapshotSchema>;
export type StorageReadResult<T> = { value: T | null; rejected: boolean };

function storageAvailable() {
  try { return typeof window !== "undefined" && typeof window.localStorage !== "undefined"; }
  catch { return false; }
}
function notifyStore() { if (typeof window !== "undefined") window.dispatchEvent(new Event(CLASSTRACE_STORE_EVENT)); }

function parseStored<T>(key: string, schema: z.ZodType<T>): StorageReadResult<T> {
  if (!storageAvailable()) return { value: null, rejected: false };
  const raw = window.localStorage.getItem(key);
  if (raw === null) return { value: null, rejected: false };
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return { value: parsed.data, rejected: false };
  } catch { /* discard below */ }
  window.localStorage.removeItem(key);
  return { value: null, rejected: true };
}

export function imageDescriptor(file: Pick<File, "name" | "type" | "size" | "lastModified">): SafeImageDescriptor {
  return SafeImageDescriptorSchema.parse({ name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });
}

export async function createAssessmentFingerprint(input: {
  question: string;
  expectedReasoning: string;
  typedResponses: string[];
  imageDescriptors: SafeImageDescriptor[];
}): Promise<string> {
  const canonical = JSON.stringify({
    question: input.question.trim().replace(/\r\n/g, "\n"),
    expectedReasoning: input.expectedReasoning.trim().replace(/\r\n/g, "\n"),
    typedResponses: input.typedResponses.map((item) => item.trim()),
    imageDescriptors: input.imageDescriptors.map((item) => SafeImageDescriptorSchema.parse(item)),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readAssessmentDraft(): StorageReadResult<AssessmentDraft> {
  return parseStored(DRAFT_KEY, AssessmentDraftSchema);
}

export function saveAssessmentDraft(draft: Omit<AssessmentDraft, "version" | "lastUpdated">) {
  if (!storageAvailable()) return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(AssessmentDraftSchema.parse({ ...draft, version: 1, lastUpdated: new Date().toISOString() })));
  notifyStore();
}

export function clearAssessmentDraft() {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(DRAFT_KEY);
  notifyStore();
}

export function emptyTeacherEdits(): TeacherEdits {
  return { approvedResponseIds: [], reviewResponseIds: [], clusterRenames: [], responseMoves: [], clusterMerges: [], updatedAt: new Date().toISOString() };
}

function legacySnapshot(): LatestAnalysisSnapshot | null {
  const legacyRun = parseStored(LEGACY_RUN_KEY, AnalysisRunSchema).value;
  if (!legacyRun) return null;
  return LatestAnalysisSnapshotSchema.parse({
    version: 1,
    fingerprint: null,
    run: legacyRun,
    teacherEdits: parseStored(LEGACY_EDITS_KEY, TeacherEditsSchema).value ?? emptyTeacherEdits(),
    approvedIntervention: parseStored(LEGACY_INTERVENTION_KEY, InterventionConfigSchema).value,
    transferEvaluation: parseStored(LEGACY_TRANSFER_KEY, TransferEvaluationSchema).value,
    savedAt: legacyRun.metadata.createdAt,
  });
}

export function readLatestAnalysisSnapshot(): StorageReadResult<LatestAnalysisSnapshot> {
  const current = parseStored(LATEST_ANALYSIS_KEY, LatestAnalysisSnapshotSchema);
  if (current.value || current.rejected) return current;
  const legacy = legacySnapshot();
  if (!legacy) return current;
  window.localStorage.setItem(LATEST_ANALYSIS_KEY, JSON.stringify(legacy));
  notifyStore();
  return { value: legacy, rejected: false };
}

export function loadLatestAnalysisSnapshot(): LatestAnalysisSnapshot | null {
  return readLatestAnalysisSnapshot().value;
}

function saveSnapshot(snapshot: LatestAnalysisSnapshot) {
  if (!storageAvailable()) return;
  window.localStorage.setItem(LATEST_ANALYSIS_KEY, JSON.stringify(LatestAnalysisSnapshotSchema.parse({ ...snapshot, savedAt: new Date().toISOString() })));
  notifyStore();
}

export function saveAnalysisRun(run: AnalysisRun, fingerprint: string | null = null) {
  if (!storageAvailable()) return;
  saveSnapshot({ version: 1, fingerprint, run: AnalysisRunSchema.parse(run), teacherEdits: emptyTeacherEdits(), approvedIntervention: null, transferEvaluation: null, savedAt: new Date().toISOString() });
  for (const key of [LEGACY_RUN_KEY, LEGACY_EDITS_KEY, LEGACY_INTERVENTION_KEY, LEGACY_TRANSFER_KEY]) window.localStorage.removeItem(key);
}

export function loadAnalysisRun(): AnalysisRun | null {
  return loadLatestAnalysisSnapshot()?.run ?? null;
}

export function saveTeacherEdits(edits: TeacherEdits) {
  const snapshot = loadLatestAnalysisSnapshot();
  if (!snapshot) return;
  saveSnapshot({ ...snapshot, teacherEdits: TeacherEditsSchema.parse({ ...edits, updatedAt: new Date().toISOString() }) });
}

export function loadTeacherEdits(): TeacherEdits {
  return loadLatestAnalysisSnapshot()?.teacherEdits ?? emptyTeacherEdits();
}

export function clearTeacherEdits() {
  const snapshot = loadLatestAnalysisSnapshot();
  if (snapshot) saveSnapshot({ ...snapshot, teacherEdits: emptyTeacherEdits() });
}

export function applyTeacherEdits(original: ClassAnalysis, edits: TeacherEdits): ClassAnalysis {
  const analysis = structuredClone(original);
  for (const rename of edits.clusterRenames) {
    const cluster = analysis.clusters.find((item) => item.id === rename.clusterId);
    if (cluster) cluster.title = rename.title;
  }
  for (const merge of edits.clusterMerges) {
    const source = analysis.clusters.find((item) => item.id === merge.sourceClusterId);
    const target = analysis.clusters.find((item) => item.id === merge.targetClusterId);
    if (source && target && source.id !== target.id) {
      target.responseIds = [...new Set([...target.responseIds, ...source.responseIds])];
      target.evidenceSummary = [...new Set([...target.evidenceSummary, ...source.evidenceSummary])];
      analysis.clusters = analysis.clusters.filter((item) => item.id !== source.id);
    }
  }
  const removeEverywhere = (responseId: string) => {
    analysis.clusters.forEach((cluster) => { cluster.responseIds = cluster.responseIds.filter((id) => id !== responseId); });
    analysis.demonstratedUnderstandingResponseIds = analysis.demonstratedUnderstandingResponseIds.filter((id) => id !== responseId);
    analysis.teacherAttentionResponseIds = analysis.teacherAttentionResponseIds.filter((id) => id !== responseId);
  };
  for (const move of edits.responseMoves) {
    removeEverywhere(move.responseId);
    if (move.target === "understanding") analysis.demonstratedUnderstandingResponseIds.push(move.responseId);
    else if (move.target === "attention") analysis.teacherAttentionResponseIds.push(move.responseId);
    else analysis.clusters.find((cluster) => cluster.id === move.target)?.responseIds.push(move.responseId);
  }
  for (const responseId of edits.reviewResponseIds) {
    removeEverywhere(responseId);
    analysis.teacherAttentionResponseIds.push(responseId);
  }
  analysis.clusters = analysis.clusters.filter((cluster) => cluster.responseIds.length > 0);
  analysis.classSummary = {
    ...analysis.classSummary,
    misconceptionClusterCount: analysis.clusters.length,
    teacherReviewCount: new Set(analysis.teacherAttentionResponseIds).size,
  };
  return analysis;
}

export function saveIntervention(intervention: InterventionConfig) {
  const snapshot = loadLatestAnalysisSnapshot();
  if (snapshot) saveSnapshot({ ...snapshot, approvedIntervention: InterventionConfigSchema.parse(intervention) });
}
export function loadIntervention(): InterventionConfig | null {
  return loadLatestAnalysisSnapshot()?.approvedIntervention ?? null;
}
export function saveTransferEvaluation(evaluation: TransferEvaluation) {
  const snapshot = loadLatestAnalysisSnapshot();
  if (snapshot) saveSnapshot({ ...snapshot, transferEvaluation: TransferEvaluationSchema.parse(evaluation) });
}
export function loadTransferEvaluation(): TransferEvaluation | null {
  return loadLatestAnalysisSnapshot()?.transferEvaluation ?? null;
}

export function deleteSavedAnalysis() {
  if (!storageAvailable()) return;
  for (const key of [LATEST_ANALYSIS_KEY, LEGACY_RUN_KEY, LEGACY_EDITS_KEY, LEGACY_INTERVENTION_KEY, LEGACY_TRANSFER_KEY]) window.localStorage.removeItem(key);
  notifyStore();
}

export function matchesSavedAnalysis(fingerprint: string, snapshot: LatestAnalysisSnapshot | null): boolean {
  return Boolean(snapshot?.fingerprint && snapshot.fingerprint === fingerprint && snapshot.run.metadata.mode === "live");
}

export function shouldStartAnalysisRequest(fingerprint: string, snapshot: LatestAnalysisSnapshot | null, runAnyway: boolean): boolean {
  return runAnyway || !matchesSavedAnalysis(fingerprint, snapshot);
}

export function buildEvidenceExport(run: AnalysisRun, edits: TeacherEdits, intervention: InterventionConfig | null, transfer: TransferEvaluation | null) {
  const validatedRun = AnalysisRunSchema.parse(run);
  const validatedEdits = TeacherEditsSchema.parse(edits);
  const validatedIntervention = intervention ? InterventionConfigSchema.parse(intervention) : null;
  const validatedTransfer = transfer ? TransferEvaluationSchema.parse(transfer) : null;
  return { assessment: validatedRun.assessment, validatedStructuredResults: { individualAnalyses: validatedRun.individualAnalyses, classAnalysis: validatedRun.classAnalysis }, teacherEdits: validatedEdits, interventionConfiguration: validatedIntervention, transferOutcomes: validatedTransfer, runMetadata: validatedRun.metadata };
}

export const clientStoreKeys = {
  draft: DRAFT_KEY,
  latestAnalysis: LATEST_ANALYSIS_KEY,
  legacyRun: LEGACY_RUN_KEY,
};
