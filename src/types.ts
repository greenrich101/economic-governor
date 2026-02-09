export interface WeekData {
  label: string; // e.g. "28 Dec"
  weekNum: number; // e.g. 1

  // Tier 1 — Source of Truth (from spreadsheet)
  adSpend: number | null;
  cmForecast: number | null; // 1st Order CM Forecast (in dollars, not thousands)
  cmActual: number | null;
  countForecast: number | null; // 1st Order Count Forecast
  countActual: number | null;
  aovForecast: number | null; // NC AOV Forecast
  aovActual: number | null;
  cacForecast: number | null;
  cacActual: number | null;

  // Tier 2 — Directional (optional, for Module 2)
  cpm: number | null;
  ctr: number | null; // percentage
  cpc: number | null;
  frequency: number | null;
  metaClicks: number | null;
  shopifySessions: number | null;
  cvr: number | null; // percentage
}

export interface CalculatedWeek extends WeekData {
  cmPva: number | null;
  countPva: number | null;
  aovPva: number | null;
  cacPva: number | null;
  unitCmActual: number | null;
  unitCmForecast: number | null;
  cacAovGap: number | null; // CAC - AOV (positive = losing money)
  clickSessionRatio: number | null;
}

export type Verdict = 'cm_problem' | 'volume_problem' | 'both' | 'neither';
export type ScalePermission = 'denied' | 'leak_hunt_only' | 'allowed';

export interface Module1Result {
  verdict: Verdict;
  scalePermission: ScalePermission;
  scaleReason: string;
  verdictExplanation: string;
  warnings: string[];
  cmMirage: boolean;
  cmMirageExplanation: string | null;
  biggestLeak: string;
  biggestLeakDollars: number;
  weeks: CalculatedWeek[];
  latestWeek: CalculatedWeek | null;
}

export interface FunnelStep {
  step: number;
  title: string;
  status: 'pass' | 'fail' | 'warning' | 'no_data';
  finding: string;
  dataUsed: string;
  warning: string | null;
}

export interface Module2Result {
  allowed: boolean;
  allowedScope: string;
  steps: FunnelStep[];
  rcaSummary: {
    action: string;
    rootCause: string;
    discussion: string;
    solve: string;
    doNotDo: string;
  } | null;
}

export const EMPTY_WEEK: WeekData = {
  label: '',
  weekNum: 0,
  adSpend: null,
  cmForecast: null,
  cmActual: null,
  countForecast: null,
  countActual: null,
  aovForecast: null,
  aovActual: null,
  cacForecast: null,
  cacActual: null,
  cpm: null,
  ctr: null,
  cpc: null,
  frequency: null,
  metaClicks: null,
  shopifySessions: null,
  cvr: null,
};
