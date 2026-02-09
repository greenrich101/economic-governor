import type { WeekData, CalculatedWeek, Module1Result, Verdict, ScalePermission } from '../types';

function pva(actual: number | null, forecast: number | null): number | null {
  if (actual == null || forecast == null || forecast === 0) return null;
  return (actual / forecast) * 100;
}

function calcWeek(w: WeekData): CalculatedWeek {
  const unitCmActual = (w.cmActual != null && w.countActual && w.countActual > 0)
    ? w.cmActual / w.countActual : null;
  const unitCmForecast = (w.cmForecast != null && w.countForecast && w.countForecast > 0)
    ? w.cmForecast / w.countForecast : null;
  const cacAovGap = (w.cacActual != null && w.aovActual != null)
    ? w.cacActual - w.aovActual : null;
  const clickSessionRatio = (w.metaClicks != null && w.shopifySessions != null && w.shopifySessions > 0)
    ? w.metaClicks / w.shopifySessions : null;

  return {
    ...w,
    cmPva: pva(w.cmActual, w.cmForecast),
    countPva: pva(w.countActual, w.countForecast),
    aovPva: pva(w.aovActual, w.aovForecast),
    cacPva: pva(w.cacActual, w.cacForecast),
    unitCmActual,
    unitCmForecast,
    cacAovGap,
    clickSessionRatio,
  };
}

export function runModule1(weeks: WeekData[]): Module1Result {
  const calculated = weeks.map(calcWeek);

  // Only consider weeks that have actual data (not empty future weeks)
  const withData = calculated.filter(w => w.cmActual != null || w.countActual != null || w.adSpend != null);
  const latest = withData.length > 0 ? withData[withData.length - 1] : null;

  const recentWeeks = withData.slice(-3);

  const avgCountPva = avg(recentWeeks.map(w => w.countPva));
  const hasVolumeProblem = avgCountPva != null && avgCountPva < 70;

  const latestUnitCm = latest?.unitCmActual;
  const latestUnitCmPlan = latest?.unitCmForecast;
  let hasCmProblem = false;
  if (latestUnitCm != null && latestUnitCmPlan != null && latestUnitCmPlan < 0) {
    hasCmProblem = latestUnitCm < latestUnitCmPlan * 2;
  } else if (latestUnitCm != null && latestUnitCm < 0 && latestUnitCmPlan != null && latestUnitCmPlan >= 0) {
    hasCmProblem = true;
  }

  if (latest?.cacAovGap != null && latest.cacAovGap > 0) {
    hasCmProblem = true;
  }

  let verdict: Verdict;
  if (hasCmProblem && hasVolumeProblem) verdict = 'both';
  else if (hasCmProblem) verdict = 'cm_problem';
  else if (hasVolumeProblem) verdict = 'volume_problem';
  else verdict = 'neither';

  let scalePermission: ScalePermission;
  let scaleReason: string;
  if (hasCmProblem) {
    scalePermission = 'denied';
    scaleReason = `Unit CM is $${latest?.unitCmActual?.toFixed(0) ?? '?'}/customer vs $${latest?.unitCmForecast?.toFixed(0) ?? '?'} plan. CAC ($${latest?.cacActual ?? '?'}) exceeds AOV ($${latest?.aovActual ?? '?'}) by $${latest?.cacAovGap?.toFixed(0) ?? '?'}. Cannot scale into these losses.`;
  } else if (hasVolumeProblem) {
    scalePermission = 'allowed';
    scaleReason = 'CM is healthy. Funnel analysis allowed to grow volume.';
  } else {
    scalePermission = 'allowed';
    scaleReason = 'Economics are within acceptable range. Scaling allowed.';
  }

  let cmMirage = false;
  let cmMirageExplanation: string | null = null;
  if (latest) {
    const totalCmPva = latest.cmPva;
    const countPva = latest.countPva;
    if (totalCmPva != null && totalCmPva > 95 && countPva != null && countPva < 50) {
      cmMirage = true;
      const hypotheticalCm = latest.unitCmActual != null && latest.countForecast != null
        ? latest.unitCmActual * latest.countForecast : null;
      cmMirageExplanation = `CM appears to beat forecast (${totalCmPva.toFixed(0)}% PvA) but volume is at ${countPva.toFixed(0)}% of plan. ` +
        `At forecast volume of ${latest.countForecast} customers with actual unit economics ($${latest.unitCmActual?.toFixed(0)}/customer), ` +
        `total CM would be $${hypotheticalCm?.toFixed(0) ?? '?'} — NOT the $${latest.cmForecast?.toFixed(0) ?? '?'} planned.`;
    }
  }

  const warnings: string[] = [];
  warnings.push('Meta "new customers" include returning customers by default — do not use Meta attribution for NC count.');
  warnings.push('Meta attribution over-credits conversions — use Tier 1 (Traction Scorecard) only.');
  warnings.push('Shopify USA expansion store: "New customers" may be historical Canadian buyers. NC AOV is directionally useful only.');

  let biggestLeak = '';
  let biggestLeakDollars = 0;
  if (latest && latest.countActual) {
    const cacGapDollars = (latest.cacActual != null && latest.cacForecast != null)
      ? (latest.cacActual - latest.cacForecast) * latest.countActual : 0;
    const aovGapDollars = (latest.aovActual != null && latest.aovForecast != null)
      ? (latest.aovForecast - latest.aovActual) * latest.countActual : 0;

    if (cacGapDollars > aovGapDollars) {
      biggestLeak = `CAC overspend: $${latest.cacActual} actual vs $${latest.cacForecast} plan = $${(latest.cacActual! - latest.cacForecast!).toFixed(0)} excess per customer`;
      biggestLeakDollars = cacGapDollars;
    } else {
      biggestLeak = `AOV shortfall: $${latest.aovActual} actual vs $${latest.aovForecast} plan = $${(latest.aovForecast! - latest.aovActual!).toFixed(0)} less per customer`;
      biggestLeakDollars = aovGapDollars;
    }
  }

  let verdictExplanation = '';
  if (verdict === 'both') {
    verdictExplanation = `BOTH broken. Volume at ${avgCountPva?.toFixed(0)}% of target. Unit CM at $${latest?.unitCmActual?.toFixed(0)} vs $${latest?.unitCmForecast?.toFixed(0)} plan (${((latest?.unitCmActual ?? 0) / (latest?.unitCmForecast ?? 1)).toFixed(1)}x worse). CM fixes take priority.`;
  } else if (verdict === 'cm_problem') {
    verdictExplanation = `CM Problem. Unit economics are broken: $${latest?.unitCmActual?.toFixed(0)}/customer vs $${latest?.unitCmForecast?.toFixed(0)} plan.`;
  } else if (verdict === 'volume_problem') {
    verdictExplanation = `Volume Problem. NC count at ${avgCountPva?.toFixed(0)}% of target. Unit economics are acceptable.`;
  } else {
    verdictExplanation = 'Economics within acceptable variance. No structural issues detected.';
  }

  return {
    verdict,
    scalePermission,
    scaleReason,
    verdictExplanation,
    warnings,
    cmMirage,
    cmMirageExplanation,
    biggestLeak,
    biggestLeakDollars,
    weeks: calculated,
    latestWeek: latest,
  };
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
