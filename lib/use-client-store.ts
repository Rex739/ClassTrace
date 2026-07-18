"use client";

import { useMemo, useSyncExternalStore } from "react";
import { AnalysisRunSchema, InterventionConfigSchema, TeacherEditsSchema, TransferEvaluationSchema } from "@/lib/ai/schemas";
import { CLASSTRACE_STORE_EVENT, clientStoreKeys, emptyTeacherEdits } from "@/lib/client-store";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CLASSTRACE_STORE_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CLASSTRACE_STORE_EVENT, callback); };
}

function useStoredRaw(key: string) {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
}

export function useAnalysisRun() {
  const raw = useStoredRaw(clientStoreKeys.run);
  return useMemo(() => { try { return AnalysisRunSchema.parse(JSON.parse(raw ?? "null")); } catch { return null; } }, [raw]);
}

export function useTeacherEdits() {
  const raw = useStoredRaw(clientStoreKeys.edits);
  return useMemo(() => { try { return TeacherEditsSchema.parse(JSON.parse(raw ?? "null")); } catch { return emptyTeacherEdits(); } }, [raw]);
}

export function useIntervention() {
  const raw = useStoredRaw(clientStoreKeys.intervention);
  return useMemo(() => { try { return InterventionConfigSchema.parse(JSON.parse(raw ?? "null")); } catch { return null; } }, [raw]);
}

export function useTransferEvaluation() {
  const raw = useStoredRaw(clientStoreKeys.transfer);
  return useMemo(() => { try { return TransferEvaluationSchema.parse(JSON.parse(raw ?? "null")); } catch { return null; } }, [raw]);
}
