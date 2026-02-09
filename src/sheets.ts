import type { WeekData } from './types';
import { EMPTY_WEEK } from './types';

const SHEET_ID = '1sE1p-OfzS013SPOX4kubi3q-Jy5KN9kqHY9rFYPNhZs';
const SHEET_GID = '0';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        row.push(current);
        current = '';
        rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
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

export async function fetchSheetData(): Promise<WeekData[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.status}`);

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (rows.length < 2) throw new Error('Sheet has no data');

  // Row 0 = date headers (col 0 empty, cols 1+ are dates like "28 Dec")
  const dateRow = rows[0];

  // Find week columns (skip column 0 which is the metric label)
  const weekColumns: { colIndex: number; label: string; weekNum: number }[] = [];

  for (let col = 1; col < dateRow.length; col++) {
    const label = dateRow[col]?.trim();
    if (label) {
      weekColumns.push({
        colIndex: col,
        label,
        weekNum: weekColumns.length + 1,
      });
    }
  }

  if (weekColumns.length === 0) throw new Error('No week columns found in sheet');

  // Initialize weeks with sequential numbering
  const weeks: WeekData[] = weekColumns.map((wc, i) => ({
    ...EMPTY_WEEK,
    label: wc.label,
    weekNum: i + 1,
  }));

  // Parse data rows and populate matching fields
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
