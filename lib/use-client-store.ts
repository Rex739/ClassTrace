"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AnalysisRunSchema } from "@/lib/ai/schemas";
import { CLASSTRACE_STORE_EVENT, LatestAnalysisSnapshotSchema, clientStoreKeys, emptyTeacherEdits, loadLatestAnalysisSnapshot } from "@/lib/client-store";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CLASSTRACE_STORE_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CLASSTRACE_STORE_EVENT, callback); };
}

function useStoredRaw(key: string) {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
}

export function useAnalysisRun() {
  const raw = useStoredRaw(clientStoreKeys.latestAnalysis);
  const legacyRaw = useStoredRaw(clientStoreKeys.legacyRun);
  const snapshot = useMemo(() => { try { return LatestAnalysisSnapshotSchema.parse(JSON.parse(raw ?? "null")); } catch { return null; } }, [raw]);
  const legacyRun = useMemo(() => { try { return AnalysisRunSchema.parse(JSON.parse(legacyRaw ?? "null")); } catch { return null; } }, [legacyRaw]);
  useEffect(() => {
    if (!snapshot && legacyRun) loadLatestAnalysisSnapshot();
  }, [snapshot, legacyRun]);
  return snapshot?.run ?? legacyRun;
}

export function useTeacherEdits() {
  const raw = useStoredRaw(clientStoreKeys.latestAnalysis);
  return useMemo(() => { try { return LatestAnalysisSnapshotSchema.parse(JSON.parse(raw ?? "null")).teacherEdits; } catch { return emptyTeacherEdits(); } }, [raw]);
}

export function useIntervention() {
  const raw = useStoredRaw(clientStoreKeys.latestAnalysis);
  return useMemo(() => { try { return LatestAnalysisSnapshotSchema.parse(JSON.parse(raw ?? "null")).approvedIntervention; } catch { return null; } }, [raw]);
}

export function useTransferEvaluation() {
  const raw = useStoredRaw(clientStoreKeys.latestAnalysis);
  return useMemo(() => { try { return LatestAnalysisSnapshotSchema.parse(JSON.parse(raw ?? "null")).transferEvaluation; } catch { return null; } }, [raw]);
}

export function useLatestAnalysisSnapshot() {
  const raw = useStoredRaw(clientStoreKeys.latestAnalysis);
  return useMemo(() => { try { return LatestAnalysisSnapshotSchema.parse(JSON.parse(raw ?? "null")); } catch { return null; } }, [raw]);
}
