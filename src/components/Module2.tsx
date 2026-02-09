import { useState, useCallback, type ClipboardEvent } from 'react';
import type { Module2Result, WeekData } from '../types';

interface Props {
  result: Module2Result;
  weeks: WeekData[];
  onChange: (weeks: WeekData[]) => void;
}

interface RowDef {
  key: keyof WeekData;
  label: string;
  prefix?: string;
  suffix?: string;
  section?: string;
}

const TIER2_ROWS: RowDef[] = [
  { key: 'cpm', label: 'CPM', prefix: '$', section: 'Meta Attention' },
  { key: 'ctr', label: 'CTR', suffix: '%' },
  { key: 'cpc', label: 'CPC', prefix: '$' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'metaClicks', label: 'Meta Clicks', section: 'Click → Session' },
  { key: 'shopifySessions', label: 'Shopify Sessions' },
  { key: 'cvr', label: 'Site CVR', suffix: '%', section: 'Conversion' },
];

/** Parse a raw clipboard cell value into a number or null */
function parseCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,%\s]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse tab-separated, newline-separated clipboard data into a 2D grid */
function parseClipboard(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => line.split('\t'));
}

const statusColors = {
  pass: 'border-green-700 bg-green-900/20',
  fail: 'border-red-700 bg-red-900/20',
  warning: 'border-yellow-700 bg-yellow-900/20',
  no_data: 'border-gray-700 bg-gray-800/50',
};

const statusIcons = {
  pass: '✓',
  fail: '✗',
  warning: '⚠',
  no_data: '—',
};

const statusTextColors = {
  pass: 'text-green-400',
  fail: 'text-red-400',
  warning: 'text-yellow-400',
  no_data: 'text-gray-500',
};

const STEP_CHECKS: Record<number, string> = {
  1: 'Did spend go up but orders didn\'t follow? Is CAC > AOV?',
  2: 'CPM too high? CTR too low? Frequency causing fatigue?',
  3: 'Are Meta clicks actually becoming Shopify sessions?',
  4: 'Is site CVR healthy? WoW trend?',
  5: 'Actual NC count vs forecast (PvA %)',
  6: 'Unit CM per customer, AOV gap, CAC gap — biggest dollar leak?',
};

export default function Module2({ result, weeks, onChange }: Props) {
  const { allowedScope, steps, rcaSummary } = result;
  const [showTier2, setShowTier2] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const updateCell = (weekIdx: number, key: keyof WeekData, raw: string) => {
    const updated = [...weeks];
    const val = raw === '' ? null : parseFloat(raw.replace(/[$,%]/g, ''));
    updated[weekIdx] = { ...updated[weekIdx], [key]: isNaN(val as number) ? null : val };
    onChange(updated);
  };

  const formatVal = (val: number | null, prefix?: string, suffix?: string) => {
    if (val == null) return '';
    const num = prefix === '$' ? Math.abs(val).toFixed(0) : val.toString();
    const sign = val < 0 ? '-' : '';
    return `${sign}${prefix ?? ''}${num}${suffix ?? ''}`;
  };

  /** Apply a 2D grid of pasted data starting from a given row/col position */
  const applyGrid = useCallback((grid: string[][], startRow: number, startCol: number) => {
    const updated = weeks.map(w => ({ ...w }));
    for (let r = 0; r < grid.length; r++) {
      const rowIdx = startRow + r;
      if (rowIdx >= TIER2_ROWS.length) break;
      const key = TIER2_ROWS[rowIdx].key;
      for (let c = 0; c < grid[r].length; c++) {
        const colIdx = startCol + c;
        if (colIdx >= weeks.length) break;
        updated[colIdx] = { ...updated[colIdx], [key]: parseCell(grid[r][c]) };
      }
    }
    onChange(updated);
  }, [weeks, onChange]);

  /** Handle paste on any individual cell — fills grid from that position */
  const handleCellPaste = useCallback((e: ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    const text = e.clipboardData.getData('text/plain');
    const grid = parseClipboard(text);
    // Only intercept if multi-cell paste (has tabs or multiple lines)
    if (grid.length > 1 || (grid.length === 1 && grid[0].length > 1)) {
      e.preventDefault();
      applyGrid(grid, rowIdx, colIdx);
    }
  }, [applyGrid]);

  /** Handle bulk paste from the textarea */
  const handleBulkApply = useCallback(() => {
    const grid = parseClipboard(bulkText);
    if (grid.length === 0) return;
    applyGrid(grid, 0, 0);
    setBulkText('');
    setShowBulkPaste(false);
  }, [bulkText, applyGrid]);

  /** Clear all Tier 2 data back to null */
  const handleClearTier2 = useCallback(() => {
    const updated = weeks.map(w => {
      const cleared = { ...w };
      for (const row of TIER2_ROWS) {
        (cleared as Record<string, unknown>)[row.key] = null;
      }
      return cleared;
    });
    onChange(updated);
  }, [weeks, onChange]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">Module 2 — Funnel Diagnostician</h2>
        <p className="text-xs text-gray-500 mt-0.5">{allowedScope}</p>
      </div>

      {/* Tier 2 — Directional Data Input */}
      <div className="border-b border-gray-800">
        <div className="flex items-center">
          <button
            onClick={() => setShowTier2(!showTier2)}
            className="flex-1 flex items-center justify-between p-3 text-xs text-yellow-600 hover:bg-gray-800/50 transition-colors"
          >
            <span className="font-medium">Tier 2 — Directional Data Input</span>
            <span>{showTier2 ? '▲' : '▼'}</span>
          </button>
          {showTier2 && (
            <div className="flex gap-1.5 mr-3">
              <button
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  showBulkPaste
                    ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-yellow-400 hover:border-yellow-700'
                }`}
              >
                Bulk Paste
              </button>
              <button
                onClick={handleClearTier2}
                className="text-[10px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-red-400 hover:border-red-700 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {showTier2 && showBulkPaste && (
          <div className="px-3 pb-3 space-y-2">
            <p className="text-[10px] text-gray-500">
              Paste all Tier 2 data from a spreadsheet. Rows: CPM, CTR, CPC, Frequency, Meta Clicks, Shopify Sessions, CVR. Columns: one per week (tab-separated).
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"12.50\t13.20\t11.80\n2.1\t1.9\t2.3\n0.60\t0.70\t0.55\n1.8\t2.0\t1.7\n1200\t1100\t1300\n980\t920\t1050\n3.2\t2.8\t3.5"}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-yellow-600 min-h-[120px] resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={handleBulkApply}
                disabled={bulkText.trim() === ''}
                className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Data
              </button>
              <button
                onClick={() => { setBulkText(''); setShowBulkPaste(false); }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {showTier2 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-xs text-gray-500 sticky left-0 bg-gray-900 z-10 min-w-[180px]">Metric</th>
                  {weeks.map((week, i) => (
                    <th key={i} className="py-2 px-1 min-w-[90px]">
                      <div className="text-xs text-center text-gray-300 px-2">
                        {week.label || `WK ${i + 1}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIER2_ROWS.map((row, rowIdx) => {
                  const sectionHeader = row.section;
                  return (
                    <tr key={row.key} className={`border-b border-gray-800 ${sectionHeader ? 'border-t-2 border-t-gray-700' : ''}`}>
                      <td className="py-2 px-3 text-xs font-medium text-white whitespace-nowrap sticky left-0 bg-gray-900 z-10 min-w-[180px]">
                        {row.label}
                        <span className="ml-1 text-yellow-600 text-[10px]">T2</span>
                      </td>
                      {weeks.map((week, i) => (
                        <td key={i} className="py-1 px-1">
                          <input
                            type="text"
                            value={formatVal(week[row.key] as number | null, row.prefix, row.suffix)}
                            onChange={e => updateCell(i, row.key, e.target.value)}
                            onPaste={e => handleCellPaste(e, rowIdx, i)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-red-500 min-w-[80px]"
                            placeholder="-"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-gray-500 font-medium w-[40px]">Step</th>
              <th className="py-2 px-3 text-left text-gray-500 font-medium w-[160px]">Title</th>
              <th className="py-2 px-3 text-left text-gray-500 font-medium w-[220px]">What it checks</th>
              <th className="py-2 px-3 text-left text-gray-500 font-medium">Analysis</th>
            </tr>
          </thead>
          <tbody>
            {steps.map(step => (
              <tr key={step.step} className={`border-b border-gray-800 ${statusColors[step.status]}`}>
                <td className="py-2.5 px-3 text-center">
                  <span className={`font-bold ${statusTextColors[step.status]}`}>{statusIcons[step.status]}</span>
                </td>
                <td className="py-2.5 px-3 text-white font-medium whitespace-nowrap">{step.title}</td>
                <td className="py-2.5 px-3 text-gray-400">{STEP_CHECKS[step.step] ?? ''}</td>
                <td className="py-2.5 px-3 text-gray-300">
                  {step.finding}
                  {step.warning && (
                    <span className="text-yellow-600 ml-1">⚠ {step.warning}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rcaSummary && (
        <div className="border-t border-gray-800 p-4">
          <h3 className="text-sm font-bold text-white mb-3">Root Cause Analysis</h3>
          <div className="space-y-2 text-xs">
            <RCARow label="Action" value={rcaSummary.action} color="text-red-400" />
            <RCARow label="Root Cause" value={rcaSummary.rootCause} color="text-white" />
            <RCARow label="Discussion" value={rcaSummary.discussion} color="text-gray-300" />
            <RCARow label="Solve" value={rcaSummary.solve} color="text-green-400" />
            <RCARow label="Do NOT Do" value={rcaSummary.doNotDo} color="text-red-400" />
          </div>
        </div>
      )}
    </div>
  );
}

function RCARow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <span className="text-gray-500 font-medium">{label}: </span>
      <span className={color}>{value}</span>
    </div>
  );
}
