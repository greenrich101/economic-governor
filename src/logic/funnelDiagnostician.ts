import type { CalculatedWeek, Module1Result, Module2Result, FunnelStep, Tier2DiagnosisRow } from '../types';

export function runModule2(module1: Module1Result): Module2Result {
  const { verdict, weeks } = module1;
  const latest = module1.latestWeek;
  const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;

  if (!latest) {
    return { allowed: false, allowedScope: 'No data', steps: [], tier2Diagnosis: [], rcaSummary: null };
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

  const tier2Diagnosis = buildTier2Diagnosis(latest, steps);
  const rcaSummary = buildRCA(module1, steps);

  return { allowed, allowedScope, steps, tier2Diagnosis, rcaSummary };
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

function buildTier2Diagnosis(latest: CalculatedWeek, steps: FunnelStep[]): Tier2DiagnosisRow[] {
  const tier2Steps = steps.filter(s => [2, 3, 4].includes(s.step));
  return tier2Steps.map(s => {
    if (s.status === 'no_data') {
      return {
        step: s.step, title: s.title,
        action: 'Collect data', identify: 'No Tier 2 data provided.',
        rootCause: 'Cannot determine — data missing.',
        discuss: 'Prioritize getting this data entered to unlock diagnosis.',
        solve: 'Input the required Tier 2 metrics.', assign: 'Media Buyer',
      };
    }

    if (s.step === 2) return buildStep2Diagnosis(latest, s);
    if (s.step === 3) return buildStep3Diagnosis(latest, s);
    return buildStep4Diagnosis(latest, s);
  });
}

function buildStep2Diagnosis(latest: CalculatedWeek, s: FunnelStep): Tier2DiagnosisRow {
  if (s.status === 'pass') {
    return {
      step: 2, title: s.title, action: 'Monitor',
      identify: 'Attention metrics healthy.',
      rootCause: 'No issue detected in Meta attention layer.',
      discuss: 'Current creative and targeting performing within range.',
      solve: 'Maintain current approach. Test incrementally.',
      assign: 'Media Buyer',
    };
  }

  const issues: string[] = [];
  const causes: string[] = [];
  const solves: string[] = [];

  if (latest.cpm != null && latest.cpm > 30) {
    issues.push(`CPM elevated at $${latest.cpm.toFixed(2)}`);
    causes.push('Audience saturation or competitive auction pressure');
    solves.push('Broaden targeting or test new audiences');
  }
  if (latest.ctr != null && latest.ctr < 1.5) {
    issues.push(`CTR low at ${latest.ctr.toFixed(2)}%`);
    causes.push('Message-market mismatch — hooks not resonating');
    solves.push('Test new hooks, angles, and creative formats');
  }
  if (latest.frequency != null && latest.frequency > 2) {
    issues.push(`Frequency high at ${latest.frequency.toFixed(1)}x`);
    causes.push('Creative fatigue — same audience seeing ads too often');
    solves.push('Rotate creative, expand audience, or reduce spend');
  }

  return {
    step: 2, title: s.title,
    action: s.status === 'fail' ? 'Fix immediately' : 'Investigate',
    identify: issues.join('. ') + '.',
    rootCause: causes.join('. ') + '.',
    discuss: 'Attention layer issues bleed into every downstream metric. Fix before diagnosing conversion.',
    solve: solves.join('. ') + '.',
    assign: 'Media Buyer',
  };
}

function buildStep3Diagnosis(latest: CalculatedWeek, s: FunnelStep): Tier2DiagnosisRow {
  const ratio = latest.clickSessionRatio;

  if (s.status === 'pass') {
    return {
      step: 3, title: s.title, action: 'Monitor',
      identify: `Click-to-session ratio clean at ${ratio?.toFixed(2)}.`,
      rootCause: 'No tracking or landing page issues detected.',
      discuss: 'Clicks are reaching the site. Funnel integrity intact at this layer.',
      solve: 'No action needed. Continue monitoring.',
      assign: 'Dev / Analytics',
    };
  }

  const severe = ratio != null && ratio > 1.5;
  return {
    step: 3, title: s.title,
    action: severe ? 'Fix immediately' : 'Investigate',
    identify: `${latest.metaClicks} Meta clicks but only ${latest.shopifySessions} sessions (ratio: ${ratio?.toFixed(2)}).`,
    rootCause: severe
      ? 'Major click leakage — likely slow page load, broken landing page, bot traffic, or tracking mismatch.'
      : 'Moderate click loss — possible page speed issue or minor tracking drift.',
    discuss: 'Every lost click is wasted ad spend. This is a system/tech issue, not a traffic quality issue.',
    solve: severe
      ? 'Audit landing page speed, check UTM/pixel setup, rule out bot clicks, verify Shopify session tracking.'
      : 'Check page load time. Verify Meta pixel fires on landing. Compare with GA sessions.',
    assign: 'Dev / Analytics',
  };
}

function buildStep4Diagnosis(latest: CalculatedWeek, s: FunnelStep): Tier2DiagnosisRow {
  if (s.status === 'pass') {
    return {
      step: 4, title: s.title, action: 'Monitor',
      identify: `CVR healthy at ${latest.cvr?.toFixed(2)}%.`,
      rootCause: 'Traffic is converting — site experience is working.',
      discuss: 'Conversion is not the bottleneck. Look upstream or at unit economics.',
      solve: 'Maintain current offer and page experience. Test for incremental gains.',
      assign: 'CRO / Marketing',
    };
  }

  const belowFloor = latest.cvr != null && latest.cvr < 1.5;
  return {
    step: 4, title: s.title,
    action: belowFloor ? 'Fix immediately' : 'Investigate',
    identify: `CVR at ${latest.cvr?.toFixed(2)}%${belowFloor ? ' — below 1.5% floor' : ' — mediocre'}.`,
    rootCause: belowFloor
      ? 'Offer clarity, proof elements, or friction killing conversions. Traffic is innocent until proven guilty.'
      : 'Room for improvement in offer presentation, trust signals, or checkout flow.',
    discuss: 'Do not blame traffic for low CVR. Diagnose the offer, page experience, and friction points first.',
    solve: belowFloor
      ? 'Audit offer clarity, add/improve social proof, simplify checkout, test price anchoring.'
      : 'A/B test headline, hero image, and CTA. Review mobile experience. Test urgency elements.',
    assign: 'CRO / Marketing',
  };
}

function buildRCA(module1: Module1Result, steps: FunnelStep[]): Module2Result['rcaSummary'] {
  const latest = module1.latestWeek;
  if (!latest) return null;

  // RCA based on Tier 2 steps only (2, 3, 4)
  const tier2Steps = steps.filter(s => [2, 3, 4].includes(s.step));
  const t2Fails = tier2Steps.filter(s => s.status === 'fail');
  const t2Warnings = tier2Steps.filter(s => s.status === 'warning');
  const t2NoData = tier2Steps.filter(s => s.status === 'no_data');

  // All Tier 2 data missing — can't diagnose
  if (t2NoData.length === tier2Steps.length) {
    return {
      action: 'Collect Tier 2 data before diagnosing.',
      rootCause: 'Cannot determine — no Tier 2 metrics provided.',
      discussion: 'Without CPM, CTR, Frequency, Clicks, Sessions, and CVR there is no funnel to diagnose. Enter Tier 2 data above.',
      solve: 'Input Meta Ads and Shopify funnel metrics to unlock the full diagnostic.',
      doNotDo: 'Do NOT guess the root cause from Tier 1 economics alone. Tier 2 reveals where the funnel breaks.',
    };
  }

  // All Tier 2 steps healthy
  if (t2Fails.length === 0 && t2Warnings.length === 0) {
    return {
      action: 'Monitor — Tier 2 funnel metrics are healthy.',
      rootCause: 'No breakpoints detected in attention, click integrity, or conversion layers.',
      discussion: 'The funnel is functioning within acceptable ranges at every Tier 2 checkpoint. If economics are still off, the issue lives in Tier 1 (pricing, CAC structure, or volume shortfall) — not the funnel.',
      solve: 'Maintain current funnel approach. Look for incremental gains in creative testing and landing page optimization.',
      doNotDo: 'Do NOT change what is working. If there is still an economic problem it is NOT a funnel problem.',
    };
  }

  // Identify the primary Tier 2 failure
  const primary = t2Fails[0] || t2Warnings[0];
  const problemNames = [...t2Fails, ...t2Warnings].map(s => `Step ${s.step} (${s.title})`);

  let action = '';
  let rootCause = '';
  let discussion = '';
  let solve = '';
  let doNotDo = '';

  // Step 2 failing = top-of-funnel attention problem
  if (primary.step === 2) {
    action = 'Fix attention layer before diagnosing anything downstream.';
    const issues: string[] = [];
    if (latest.cpm != null && latest.cpm > 30) issues.push(`CPM at $${latest.cpm.toFixed(2)} signals audience saturation or auction pressure`);
    if (latest.ctr != null && latest.ctr < 1.5) issues.push(`CTR at ${latest.ctr.toFixed(2)}% signals message-market mismatch`);
    if (latest.frequency != null && latest.frequency > 2) issues.push(`Frequency at ${latest.frequency.toFixed(1)}x signals creative fatigue`);
    rootCause = issues.length > 0 ? issues.join('. ') + '.' : primary.finding;
    discussion = 'Attention is the first domino. High CPM, low CTR, or high frequency corrupt every metric downstream — clicks, sessions, CVR all inherit the problem. Fix this layer first.';
    solve = 'Rotate creative, test new hooks/angles, broaden or refresh audiences, and reduce spend until efficiency returns.';
    doNotDo = 'Do NOT scale spend into bad attention metrics. More budget at high frequency and low CTR just accelerates waste.';
  }
  // Step 3 failing = click leakage / tracking integrity
  else if (primary.step === 3) {
    const ratio = latest.clickSessionRatio;
    action = 'Fix click-to-session leakage — paid clicks are not reaching the site.';
    rootCause = `Click-session ratio at ${ratio?.toFixed(2)}. ${latest.metaClicks} Meta clicks producing only ${latest.shopifySessions} Shopify sessions. Clicks are being lost between ad platform and site.`;
    discussion = 'This is a system/tech issue, not a traffic quality issue. Every lost click is wasted ad spend that never had a chance to convert. Attention metrics may look fine but the handoff is broken.';
    solve = 'Audit landing page speed, verify Meta pixel fires correctly, check UTM parameter setup, rule out bot clicks, compare with Google Analytics sessions.';
    doNotDo = 'Do NOT blame traffic quality or creative. The traffic is clicking — it is just not arriving. This is an infrastructure problem.';
  }
  // Step 4 failing = conversion problem
  else {
    action = 'Fix site conversion — traffic is arriving but not buying.';
    rootCause = `CVR at ${latest.cvr?.toFixed(2)}%${latest.cvr != null && latest.cvr < 1.5 ? ' — below the 1.5% floor' : ''}. The site is failing to convert the traffic it receives.`;
    discussion = 'Traffic is innocent until proven guilty. Attention and click integrity are acceptable, so the problem is on-site: offer clarity, trust signals, friction, or checkout experience.';
    solve = 'Audit offer presentation, strengthen social proof, simplify checkout flow, test price anchoring and urgency elements. Review mobile vs desktop split.';
    doNotDo = 'Do NOT blame the ad creative or audience for low CVR. The funnel delivered traffic — the site failed to convert it.';
  }

  // If multiple Tier 2 steps are broken, note it
  if (problemNames.length > 1) {
    discussion += ` Note: multiple Tier 2 breakpoints detected (${problemNames.join(', ')}). Fix in order — attention first, then click integrity, then conversion.`;
  }

  return { action, rootCause, discussion, solve, doNotDo };
}
