export type Confidence = "high" | "medium" | "low";
export type OutcomeStatus = "resolved" | "uncertain" | "follow-up";

export interface Assessment {
  id: string;
  title: string;
  subject: string;
  question: string;
  expectedReasoning: string[];
  createdLabel: string;
}

export interface Student {
  id: string;
  label: string;
}

export interface StudentResponse {
  id: string;
  studentId: string;
  answer: string;
  finalAnswer: string;
  submittedLabel: string;
}

export interface ReasoningStep {
  label: string;
  detail: string;
  status: "sound" | "break" | "uncertain";
}

export interface Diagnosis {
  responseId: string;
  clusterId: string | null;
  summary: string;
  reasoning: ReasoningStep[];
  evidence: string[];
  confidence: Confidence;
  alternativeHypothesis: string;
  needsTeacherReview: boolean;
}

export interface MisconceptionCluster {
  id: string;
  name: string;
  shortName: string;
  description: string;
  learningNeed: string;
  responseIds: string[];
  severity: "attention" | "uncertain" | "monitor";
  commonFinalAnswers: string[];
}

export interface Intervention {
  id: string;
  title: string;
  clusterIds: string[];
  objective: string;
  predictionPrompt: string;
  explanationPrompt: string;
  reflectionPrompt: string;
  transferQuestion: string;
}

export interface TransferOutcome {
  studentId: string;
  beforeClusterId: string | null;
  status: OutcomeStatus;
  transferAnswer: string;
  evidence: string;
}
