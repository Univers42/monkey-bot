/** Shared finding schema for security bots (evidence over narrative). */

export type FaultClass = "reflected-xss" | "attr-xss";

export type FindingEvidence = {
  payload: string;
  effect: string;
  finalUrl: string;
  sink?: string;
};

export type SecurityFinding = {
  faultClass: FaultClass;
  targetId?: string;
  mutantId?: string;
  severity: "high" | "medium" | "low";
  evidence: FindingEvidence;
};

export type CalibrationRow = {
  mutantId: string;
  faultClass: FaultClass | string;
  expectation: "must-kill" | "must-survive" | "arid" | string;
  detected: boolean;
  verdict: string;
  evidence: string;
  finalUrl: string;
  payload: string;
};

export type BotRunReport = {
  botId: string;
  targetId?: string;
  probeTrusted: boolean;
  calibrations: CalibrationRow[];
  findings: SecurityFinding[];
  suppressed: string[];
  artifactPath?: string;
};
