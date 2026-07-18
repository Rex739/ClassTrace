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

const RUN_KEY = "classtrace:analysis-run:v1";
const EDITS_KEY = "classtrace:teacher-edits:v1";
const INTERVENTION_KEY = "classtrace:intervention:v1";
const TRANSFER_KEY = "classtrace:transfer:v1";
export const CLASSTRACE_STORE_EVENT = "classtrace-store-change";

function storageAvailable() { return typeof window !== "undefined" && typeof window.localStorage !== "undefined"; }
function notifyStore() { if (typeof window !== "undefined") window.dispatchEvent(new Event(CLASSTRACE_STORE_EVENT)); }

export function emptyTeacherEdits(): TeacherEdits {
  return { approvedResponseIds: [], reviewResponseIds: [], clusterRenames: [], responseMoves: [], clusterMerges: [], updatedAt: new Date().toISOString() };
}

export function saveAnalysisRun(run: AnalysisRun) {
  if (!storageAvailable()) return;
  localStorage.setItem(RUN_KEY, JSON.stringify(AnalysisRunSchema.parse(run)));
  localStorage.removeItem(EDITS_KEY);
  localStorage.removeItem(INTERVENTION_KEY);
  localStorage.removeItem(TRANSFER_KEY);
  notifyStore();
}

export function loadAnalysisRun(): AnalysisRun | null {
  if (!storageAvailable()) return null;
  try { return AnalysisRunSchema.parse(JSON.parse(localStorage.getItem(RUN_KEY) ?? "null")); } catch { return null; }
}

export function saveTeacherEdits(edits: TeacherEdits) {
  if (!storageAvailable()) return;
  localStorage.setItem(EDITS_KEY, JSON.stringify(TeacherEditsSchema.parse({ ...edits, updatedAt: new Date().toISOString() })));
  notifyStore();
}

export function loadTeacherEdits(): TeacherEdits {
  if (!storageAvailable()) return emptyTeacherEdits();
  try { return TeacherEditsSchema.parse(JSON.parse(localStorage.getItem(EDITS_KEY) ?? "null")); } catch { return emptyTeacherEdits(); }
}

export function clearTeacherEdits() { if (storageAvailable()) { localStorage.removeItem(EDITS_KEY); notifyStore(); } }

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
  if (storageAvailable()) { localStorage.setItem(INTERVENTION_KEY, JSON.stringify(InterventionConfigSchema.parse(intervention))); notifyStore(); }
}
export function loadIntervention(): InterventionConfig | null {
  if (!storageAvailable()) return null;
  try { return InterventionConfigSchema.parse(JSON.parse(localStorage.getItem(INTERVENTION_KEY) ?? "null")); } catch { return null; }
}
export function saveTransferEvaluation(evaluation: TransferEvaluation) {
  if (storageAvailable()) { localStorage.setItem(TRANSFER_KEY, JSON.stringify(TransferEvaluationSchema.parse(evaluation))); notifyStore(); }
}
export function loadTransferEvaluation(): TransferEvaluation | null {
  if (!storageAvailable()) return null;
  try { return TransferEvaluationSchema.parse(JSON.parse(localStorage.getItem(TRANSFER_KEY) ?? "null")); } catch { return null; }
}

export function buildEvidenceExport(run: AnalysisRun, edits: TeacherEdits, intervention: InterventionConfig | null, transfer: TransferEvaluation | null) {
  return { assessment: run.assessment, validatedStructuredResults: { individualAnalyses: run.individualAnalyses, classAnalysis: run.classAnalysis }, teacherEdits: edits, interventionConfiguration: intervention, transferOutcomes: transfer, runMetadata: run.metadata };
}

export const clientStoreKeys = { run: RUN_KEY, edits: EDITS_KEY, intervention: INTERVENTION_KEY, transfer: TRANSFER_KEY };
