import type { WeekData } from './types';
import { EMPTY_WEEK } from './types';

function parseTSV(text: string): string[][] {
  return text.trim().split('\n').map(line =>
    line.split('\t').map(cell => cell.replace(/^"|"$/g, '').trim())
  );
}

function parseValue(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,%\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

interface RowMatch {
  field: keyof WeekData;
  multiply: number;
}

function matchRow(label: string): RowMatch | null {
  const clean = label.trim();

  // Skip Plan vs Actual rows
  if (/plan\s*v/i.test(clean)) return null;

  // 1st Order CM — values are in thousands, multiply by 1000
  if (/1st Order CM/i.test(clean)) {
    if (/f(orecast|cast)/i.test(clean)) return { field: 'cmForecast', multiply: 1000 };
    return { field: 'cmActual', multiply: 1000 };
  }

  // 1st Order Count — raw counts, no multiplier
  if (/1st Order Count/i.test(clean)) {
    if (/f(orecast|cast)/i.test(clean)) return { field: 'countForecast', multiply: 1 };
    return { field: 'countActual', multiply: 1 };
  }

  // AOV
  if (/AOV/i.test(clean)) {
    if (/f(orecast|cast)/i.test(clean)) return { field: 'aovForecast', multiply: 1 };
    return { field: 'aovActual', multiply: 1 };
  }

  // CAC
  if (/CAC/i.test(clean)) {
    if (/f(orecast|cast)/i.test(clean)) return { field: 'cacForecast', multiply: 1 };
    return { field: 'cacActual', multiply: 1 };
  }

  // Ad Spend
  if (/Ad Spend/i.test(clean)) return { field: 'adSpend', multiply: 1 };

  return null;
}

export function parsePastedData(text: string): WeekData[] {
  const rows = parseTSV(text);

  if (rows.length < 2) throw new Error('Not enough rows — paste the full table from Google Sheets');

  const dateRow = rows[0];

  const weekColumns: { colIndex: number; label: string }[] = [];
  for (let col = 1; col < dateRow.length; col++) {
    const label = dateRow[col]?.trim();
    if (label) {
      weekColumns.push({ colIndex: col, label });
    }
  }

  if (weekColumns.length === 0) throw new Error('No week columns found in pasted data');

  const weeks: WeekData[] = weekColumns.map((wc, i) => ({
    ...EMPTY_WEEK,
    label: wc.label,
    weekNum: i + 1,
  }));

  for (const row of rows) {
    const metricLabel = row[0] || '';
    const match = matchRow(metricLabel);
    if (!match) continue;

    for (let i = 0; i < weekColumns.length; i++) {
      const rawVal = row[weekColumns[i].colIndex];
      const parsed = parseValue(rawVal);
      if (parsed !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (weeks[i] as any)[match.field] = parsed * match.multiply;
      }
    }
  }

  return weeks;
}
