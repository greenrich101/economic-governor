import type { CalculatedWeek, Module1Result, Module2Result, FunnelStep } from '../types';

export function runModule2(module1: Module1Result): Module2Result {
  const { verdict, weeks } = module1;
  const latest = module1.latestWeek;
  const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;

  if (!latest) {
    return { allowed: false, allowedScope: 'No data', steps: [], rcaSummary: null };
  }

  const allowed = verdict !== 'neither';
  let allowedScope = '';
  if (verdict === 'cm_problem' || verdict === 'both') {
    allowedScope = 'Leak hunting ONLY. Do NOT scale.';
  } else if (verdict === 'volume_problem') {
    allowedScope = 'Volume growth allowed. CM is healthy.';
  } else {
    allowedScope = 'No funnel issues flagged by economics.';
  }

  const steps: FunnelStep[] = [];
  steps.push(buildStep1(latest, prev));
  steps.push(buildStep2(latest));
  steps.push(buildStep3(latest));
  steps.push(buildStep4(latest, prev));
  steps.push(buildStep5(latest));
  steps.push(buildStep6(latest));

  const rcaSummary = buildRCA(module1, steps);

  return { allowed, allowedScope, steps, rcaSummary };
}

function buildStep1(latest: CalculatedWeek, prev: CalculatedWeek | null): FunnelStep {
  if (latest.adSpend == null || latest.countActual == null) {
    return { step: 1, title: 'Spend → Orders Reality', status: 'no_data', finding: 'Missing ad spend or order count data.', dataUsed: 'N/A', warning: null };
  }

  const spendChange = prev?.adSpend ? ((latest.adSpend - prev.adSpend) / prev.adSpend * 100) : null;
  const orderChange = prev?.countActual ? ((latest.countActual - prev.countActual) / prev.countActual * 100) : null;

  let status: FunnelStep['status'] = 'pass';
  let finding = '';

  if (spendChange != null && orderChange != null) {
    const proportional = Math.abs(spendChange - orderChange) < 15;
    if (!proportional && spendChange > 0 && orderChange <= 0) {
      status = 'fail';
      finding = `Spend increased ${spendChange.toFixed(0)}% but orders changed ${orderChange.toFixed(0)}%. Efficiency breakdown — more spend is NOT producing more orders.`;
    } else if (!proportional) {
      status = 'warning';
      finding = `Spend moved ${spendChange.toFixed(0)}%, orders moved ${orderChange.toFixed(0)}%. Disproportionate — investigate efficiency.`;
    } else {
      finding = `Spend and orders moved proportionally (spend ${spendChange.toFixed(0)}%, orders ${orderChange.toFixed(0)}%).`;
    }
  } else {
    finding = `WK${latest.weekNum}: $${latest.adSpend.toLocaleString()} spend → ${latest.countActual} orders. CAC: $${latest.cacActual?.toFixed(0) ?? '?'}.`;
    if (latest.cacActual != null && latest.aovActual != null && latest.cacActual > latest.aovActual) {
      status = 'fail';
      finding += ` CAC ($${latest.cacActual}) exceeds AOV ($${latest.aovActual}). Paying more to acquire than they spend.`;
    }
  }

  return { step: 1, title: 'Spend → Orders Reality', status, finding, dataUsed: 'Tier 1: Ad Spend, Order Count', warning: null };
}

function buildStep2(latest: CalculatedWeek): FunnelStep {
  if (latest.cpm == null && latest.ctr == null && latest.frequency == null) {
    return { step: 2, title: 'Attention Quality (Meta)', status: 'no_data', finding: 'No Meta attention data provided. Input CPM, CTR, and Frequency to diagnose.', dataUsed: 'N/A', warning: null };
  }

  let status: FunnelStep['status'] = 'pass';
  const findings: string[] = [];

  if (latest.cpm != null) {
    if (latest.cpm > 30) {
      status = 'warning';
      findings.push(`CPM at $${latest.cpm.toFixed(2)} — elevated. Check audience saturation.`);
    } else {
      findings.push(`CPM at $${latest.cpm.toFixed(2)} — within normal range.`);
    }
  }

  if (latest.ctr != null) {
    if (latest.ctr < 1.0) {
      status = 'fail';
      findings.push(`CTR at ${latest.ctr.toFixed(2)}% — below 1%. Message-market mismatch likely.`);
    } else if (latest.ctr < 1.5) {
      status = 'warning';
      findings.push(`CTR at ${latest.ctr.toFixed(2)}% — mediocre. Test new hooks/angles.`);
    } else {
      findings.push(`CTR at ${latest.ctr.toFixed(2)}% — healthy.`);
    }
  }

  if (latest.frequency != null) {
    if (latest.frequency > 3) {
      status = 'fail';
      findings.push(`Frequency at ${latest.frequency.toFixed(1)} — creative fatigue likely. Audience seeing ads ${latest.frequency.toFixed(1)}x.`);
    } else if (latest.frequency > 2) {
      if (status !== 'fail') status = 'warning';
      findings.push(`Frequency at ${latest.frequency.toFixed(1)} — approaching fatigue threshold.`);
    } else {
      findings.push(`Frequency at ${latest.frequency.toFixed(1)} — healthy.`);
    }
  }

  return {
    step: 2, title: 'Attention Quality (Meta)', status,
    finding: findings.join(' '),
    dataUsed: 'Tier 2: Meta CPM, CTR, Frequency',
    warning: 'Tier 2 data is directional only. No profitability conclusions allowed from Meta metrics.',
  };
}

function buildStep3(latest: CalculatedWeek): FunnelStep {
  if (latest.metaClicks == null || latest.shopifySessions == null) {
    return { step: 3, title: 'Click → Session Integrity', status: 'no_data', finding: 'No click/session data provided. Input Meta clicks and Shopify sessions to diagnose.', dataUsed: 'N/A', warning: null };
  }

  const ratio = latest.clickSessionRatio!;
  let status: FunnelStep['status'] = 'pass';
  let finding = '';

  if (ratio > 1.5) {
    status = 'fail';
    finding = `${latest.metaClicks} clicks but only ${latest.shopifySessions} sessions (ratio: ${ratio.toFixed(2)}). Major click leakage — tracking issue, slow site, or bot traffic.`;
  } else if (ratio > 1.2) {
    status = 'warning';
    finding = `${latest.metaClicks} clicks vs ${latest.shopifySessions} sessions (ratio: ${ratio.toFixed(2)}). Moderate click loss — check page load speed.`;
  } else {
    finding = `${latest.metaClicks} clicks → ${latest.shopifySessions} sessions (ratio: ${ratio.toFixed(2)}). Clicks tracking to sessions cleanly.`;
  }

  return {
    step: 3, title: 'Click → Session Integrity', status, finding,
    dataUsed: 'Tier 2: Meta Clicks, Shopify Sessions',
    warning: 'Treat click-session mismatch as a system issue, not traffic blame.',
  };
}

function buildStep4(latest: CalculatedWeek, prev: CalculatedWeek | null): FunnelStep {
  if (latest.cvr == null) {
    return { step: 4, title: 'Conversion Mechanics', status: 'no_data', finding: 'No CVR data provided. Input site conversion rate to diagnose.', dataUsed: 'N/A', warning: null };
  }

  let status: FunnelStep['status'] = 'pass';
  let finding = '';

  if (latest.cvr < 1.5) {
    status = 'fail';
    finding = `CVR at ${latest.cvr.toFixed(2)}% — below 1.5%. Check offer clarity, proof elements, and friction.`;
  } else if (latest.cvr < 2.5) {
    status = 'warning';
    finding = `CVR at ${latest.cvr.toFixed(2)}% — mediocre. Room for improvement in offer presentation.`;
  } else {
    finding = `CVR at ${latest.cvr.toFixed(2)}% — solid. Traffic is innocent — conversion is working.`;
  }

  if (prev?.cvr != null) {
    const change = latest.cvr - prev.cvr;
    finding += ` WoW change: ${change > 0 ? '+' : ''}${change.toFixed(2)}pp.`;
  }

  return {
    step: 4, title: 'Conversion Mechanics', status, finding,
    dataUsed: 'Tier 2: CVR',
    warning: 'Assume traffic is innocent until proven guilty. Diagnose offer, not audience.',
  };
}

function buildStep5(latest: CalculatedWeek): FunnelStep {
  if (latest.countActual == null || latest.countForecast == null) {
    return { step: 5, title: 'New Customer Reality', status: 'no_data', finding: 'Missing NC count data.', dataUsed: 'N/A', warning: null };
  }

  const pva = latest.countPva!;
  const status: FunnelStep['status'] = pva >= 85 ? 'pass' : pva >= 50 ? 'warning' : 'fail';

  return {
    step: 5, title: 'New Customer Reality', status,
    finding: `${latest.countActual} real new customers vs ${latest.countForecast} forecast (${pva.toFixed(0)}% PvA). Validated using Tier 1 data only.`,
    dataUsed: 'Tier 1: 1st Order Count (Traction Scorecard)',
    warning: 'Shopify "new" customers may include historical Canadian buyers. Use Tier 1 count only.',
  };
}

function buildStep6(latest: CalculatedWeek): FunnelStep {
  if (latest.aovActual == null || latest.cacActual == null || latest.cmActual == null) {
    return { step: 6, title: 'Cash & CM Leak', status: 'no_data', finding: 'Missing AOV, CAC, or CM data.', dataUsed: 'N/A', warning: null };
  }

  const count = latest.countActual ?? 1;
  const unitCm = latest.unitCmActual ?? 0;
  const status: FunnelStep['status'] = unitCm >= 0 ? 'pass' : unitCm > -50 ? 'warning' : 'fail';

  const cacGap = (latest.cacActual && latest.cacForecast) ? latest.cacActual - latest.cacForecast : 0;
  const aovGap = (latest.aovForecast && latest.aovActual) ? latest.aovForecast - latest.aovActual : 0;

  const findings = [
    `Unit CM: $${unitCm.toFixed(0)}/customer.`,
    `AOV: $${latest.aovActual} (${aovGap > 0 ? `-$${aovGap.toFixed(0)} vs plan` : 'on plan'}).`,
    `CAC: $${latest.cacActual} (${cacGap > 0 ? `+$${cacGap.toFixed(0)} over plan` : 'on plan'}).`,
  ];

  if (cacGap > aovGap) {
    findings.push(`Biggest dollar leak: CAC overspend = $${(cacGap * count).toFixed(0)}/week.`);
  } else if (aovGap > 0) {
    findings.push(`Biggest dollar leak: AOV shortfall = $${(aovGap * count).toFixed(0)}/week.`);
  }

  return {
    step: 6, title: 'Cash & CM Leak', status,
    finding: findings.join(' '),
    dataUsed: 'Tier 1: AOV, CAC, CM, Count',
    warning: null,
  };
}

function buildRCA(module1: Module1Result, steps: FunnelStep[]): Module2Result['rcaSummary'] {
  const latest = module1.latestWeek;
  if (!latest) return null;

  const failedSteps = steps.filter(s => s.status === 'fail');
  const warningSteps = steps.filter(s => s.status === 'warning');
  const problemSteps = [...failedSteps, ...warningSteps];

  if (problemSteps.length === 0) {
    return {
      action: 'Monitor — no acute funnel breakpoints detected.',
      rootCause: 'Economics may be within acceptable variance.',
      discussion: 'All funnel steps passed or had insufficient data. Ensure Tier 2 data is provided for a complete diagnosis.',
      solve: 'Maintain current approach. Look for incremental gains.',
      doNotDo: 'Do not increase spend to "test" without fixing underlying unit economics first.',
    };
  }

  const primaryFail = failedSteps[0] || warningSteps[0];
  const isVolumeIssue = module1.verdict === 'volume_problem' || module1.verdict === 'both';
  const isCmIssue = module1.verdict === 'cm_problem' || module1.verdict === 'both';

  let action = '';
  let rootCause = '';
  let discussion = '';
  let solve = '';
  let doNotDo = '';

  if (isCmIssue) {
    const cacGap = latest.cacActual && latest.cacForecast ? latest.cacActual - latest.cacForecast : 0;
    const aovGap = latest.aovForecast && latest.aovActual ? latest.aovForecast - latest.aovActual : 0;

    if (cacGap > aovGap) {
      rootCause = `CAC is the primary leak. $${latest.cacActual} actual vs $${latest.cacForecast} target = $${cacGap.toFixed(0)} overspend per customer.`;
      solve = 'Reduce CAC: tighten targeting, test new creative to lower CPA, or reduce spend to find efficient floor.';
      doNotDo = `Do NOT increase spend to "get more data." More spend at $${latest.cacActual} CAC just buys more losses.`;
    } else {
      rootCause = `AOV is the primary leak. $${latest.aovActual} actual vs $${latest.aovForecast} target = $${aovGap.toFixed(0)} shortfall per customer.`;
      solve = 'Increase AOV: test bundles, upsells, free shipping thresholds, or higher-priced hero SKU in ads.';
      doNotDo = 'Do NOT discount to drive volume. Lower prices worsen AOV and compound the CM problem.';
    }

    action = 'Fix unit economics before any volume push.';
    discussion = `Unit CM is $${latest.unitCmActual?.toFixed(0)}/customer. ${module1.cmMirage ? 'WARNING: Total CM beating forecast is a mirage caused by low volume.' : ''} The business is losing $${Math.abs(latest.unitCmActual ?? 0).toFixed(0)} on every new customer acquired.`;
  } else if (isVolumeIssue) {
    rootCause = `Volume is the constraint. Delivering ${latest.countActual} customers vs ${latest.countForecast} target (${latest.countPva?.toFixed(0)}% PvA).`;
    action = 'Diagnose volume bottleneck in funnel steps.';
    discussion = `Unit economics are acceptable but customer acquisition is severely under plan. The funnel is leaking traffic or conversions.`;
    solve = `Focus on Step ${primaryFail.step} (${primaryFail.title}): ${primaryFail.finding}`;
    doNotDo = 'Do NOT assume more spend = more customers. Current spend is not converting efficiently.';
  }

  return { action, rootCause, discussion, solve, doNotDo };
}
