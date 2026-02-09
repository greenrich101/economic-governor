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
  const { allowedScope, steps, tier2Diagnosis, rcaSummary } = result;
  const [showTier2, setShowTier2] = useState(true);
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
      <div className="border-b border-yellow-800/40">
        <div className="flex items-center justify-between bg-yellow-900/15 border-b border-yellow-800/30">
          <button
            onClick={() => setShowTier2(!showTier2)}
            className="flex-1 flex items-center justify-between px-5 py-4 text-yellow-500 hover:bg-yellow-900/20 transition-colors"
          >
            <div className="flex flex-col items-start gap-1">
              <span className="text-base font-bold tracking-wide">Tier 2 — Directional Data Input</span>
              <span className="text-xs text-yellow-600/80 font-normal">Enter your Meta Ads + Shopify funnel metrics below to unlock the full diagnostic</span>
              <span className="text-xs text-yellow-500/90 font-semibold">⚠ Do this per funnel or account-wide — pick one, don't mix.</span>
            </div>
            <span className="text-lg ml-4">{showTier2 ? '▲' : '▼'}</span>
          </button>
          {showTier2 && (
            <div className="flex gap-2 mr-5">
              <button
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  showBulkPaste
                    ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:text-yellow-400 hover:border-yellow-700'
                }`}
              >
                Bulk Paste
              </button>
              <button
                onClick={handleClearTier2}
                className="text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-red-400 hover:border-red-700 font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
        {showTier2 && showBulkPaste && (
          <div className="px-5 py-4 space-y-3 bg-gray-800/30">
            <p className="text-sm text-gray-400">
              Paste all Tier 2 data from your spreadsheet. <span className="text-yellow-500 font-medium">Rows:</span> CPM, CTR, CPC, Frequency, Meta Clicks, Shopify Sessions, CVR. <span className="text-yellow-500 font-medium">Columns:</span> one per week (tab-separated).
            </p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"12.50\t13.20\t11.80\n2.1\t1.9\t2.3\n0.60\t0.70\t0.55\n1.8\t2.0\t1.7\n1200\t1100\t1300\n980\t920\t1050\n3.2\t2.8\t3.5"}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 min-h-[160px] resize-y"
            />
            <div className="flex gap-3">
              <button
                onClick={handleBulkApply}
                disabled={bulkText.trim() === ''}
                className="text-sm bg-yellow-700 hover:bg-yellow-600 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Data
              </button>
              <button
                onClick={() => { setBulkText(''); setShowBulkPaste(false); }}
                className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 px-5 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {showTier2 && (
          <div className="overflow-x-auto px-2 pb-4 pt-2">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-700">
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-400 sticky left-0 bg-gray-900 z-10 min-w-[200px]">Metric</th>
                  {weeks.map((week, i) => (
                    <th key={i} className="py-3 px-2 min-w-[110px]">
                      <div className="text-sm text-center text-gray-300 font-semibold px-2">
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
                    <>
                      {sectionHeader && (
                        <tr key={`section-${row.key}`}>
                          <td colSpan={weeks.length + 1} className="pt-4 pb-1 px-4">
                            <span className="text-xs font-bold text-yellow-600/70 uppercase tracking-widest">{sectionHeader}</span>
                          </td>
                        </tr>
                      )}
                      <tr key={row.key} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-white whitespace-nowrap sticky left-0 bg-gray-900 z-10 min-w-[200px]">
                          {row.label}
                          {row.prefix && <span className="ml-1.5 text-gray-600 text-xs">{row.prefix}</span>}
                          {row.suffix && <span className="ml-1.5 text-gray-600 text-xs">{row.suffix}</span>}
                        </td>
                        {weeks.map((week, i) => (
                          <td key={i} className="py-2 px-2">
                            <input
                              type="text"
                              value={formatVal(week[row.key] as number | null, row.prefix, row.suffix)}
                              onChange={e => updateCell(i, row.key, e.target.value)}
                              onPaste={e => handleCellPaste(e, rowIdx, i)}
                              className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2.5 text-sm text-right text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 min-w-[100px] placeholder:text-gray-600"
                              placeholder="-"
                            />
                          </td>
                        ))}
                      </tr>
                    </>
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

      {tier2Diagnosis.length > 0 && (
        <div className="border-t border-yellow-800/40 p-4">
          <h3 className="text-sm font-bold text-yellow-500 mb-3">Tier 2 Diagnostic — Action Table</h3>
          <p className="text-xs text-yellow-600/70 mb-3">Based on Tier 2 directional data only. No profitability conclusions.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-yellow-800/40">
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold w-[50px]">Step</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold w-[110px]">Action</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold">Identify</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold">Root Cause</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold">Discuss</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold">Solve</th>
                  <th className="py-2 px-3 text-left text-yellow-600 font-semibold w-[110px]">Assign</th>
                </tr>
              </thead>
              <tbody>
                {tier2Diagnosis.map(row => {
                  const actionColor = row.action === 'Fix immediately' ? 'text-red-400 font-bold'
                    : row.action === 'Investigate' ? 'text-yellow-400 font-medium'
                    : row.action === 'Collect data' ? 'text-gray-500'
                    : 'text-green-400';
                  return (
                    <tr key={row.step} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-white font-medium">{row.step}. {row.title}</td>
                      <td className={`py-2.5 px-3 ${actionColor}`}>{row.action}</td>
                      <td className="py-2.5 px-3 text-gray-300">{row.identify}</td>
                      <td className="py-2.5 px-3 text-gray-300">{row.rootCause}</td>
                      <td className="py-2.5 px-3 text-gray-400">{row.discuss}</td>
                      <td className="py-2.5 px-3 text-green-400">{row.solve}</td>
                      <td className="py-2.5 px-3 text-yellow-500 font-medium">{row.assign}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
