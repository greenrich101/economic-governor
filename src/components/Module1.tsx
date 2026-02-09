import type { Module1Result } from '../types';

interface Props {
  result: Module1Result;
}

const verdictColors: Record<string, string> = {
  cm_problem: 'bg-red-900/50 border-red-700 text-red-300',
  volume_problem: 'bg-yellow-900/50 border-yellow-700 text-yellow-300',
  both: 'bg-red-900/50 border-red-700 text-red-300',
  neither: 'bg-green-900/50 border-green-700 text-green-300',
};

const scaleColors: Record<string, string> = {
  denied: 'text-red-400',
  leak_hunt_only: 'text-yellow-400',
  allowed: 'text-green-400',
};

export default function Module1({ result }: Props) {
  const { verdict, scalePermission, scaleReason, verdictExplanation, warnings, cmMirage, cmMirageExplanation, biggestLeak, biggestLeakDollars, latestWeek, weeks } = result;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Module 1 — Economic Governor</h2>
          <p className="text-xs text-gray-500 mt-0.5">Math-first economic verdict. No storytelling.</p>
        </div>

        {/* Verdict */}
        <div className={`m-4 p-4 rounded border ${verdictColors[verdict]}`}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1">Verdict</div>
          <div className="text-sm font-medium">{verdictExplanation}</div>
        </div>

        {/* Scale Permission */}
        <div className="mx-4 mb-4 p-3 bg-gray-800/50 rounded">
          <div className="text-xs text-gray-500 mb-1">Scale Permission</div>
          <div className={`text-sm font-bold ${scaleColors[scalePermission]}`}>
            {scalePermission === 'denied' ? 'DENIED' : scalePermission === 'leak_hunt_only' ? 'LEAK HUNT ONLY' : 'ALLOWED'}
          </div>
          <div className="text-xs text-gray-400 mt-1">{scaleReason}</div>
        </div>

        {/* CM Mirage Warning */}
        {cmMirage && (
          <div className="mx-4 mb-4 p-3 bg-orange-900/30 border border-orange-700 rounded">
            <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">CM Mirage Detected</div>
            <div className="text-xs text-orange-300">{cmMirageExplanation}</div>
          </div>
        )}

        {/* Biggest Leak */}
        {biggestLeak && (
          <div className="mx-4 mb-4 p-3 bg-gray-800/50 rounded">
            <div className="text-xs text-gray-500 mb-1">Biggest Dollar Leak</div>
            <div className="text-sm text-white">{biggestLeak}</div>
            <div className="text-xs text-red-400 mt-1">= ${biggestLeakDollars.toLocaleString()}/week at current volume</div>
          </div>
        )}

        {/* PvA Table */}
        {latestWeek && (
          <div className="mx-4 mb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-2 text-left text-gray-500">Metric</th>
                  {weeks.map((w, i) => (
                    <th key={i} className="py-2 px-2 text-center text-gray-500">{w.label || `WK ${w.weekNum}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <PvaRow label="CM PvA" weeks={weeks as unknown as Record<string, unknown>[]} field="cmPva" invert />
                <PvaRow label="Count PvA" weeks={weeks as unknown as Record<string, unknown>[]} field="countPva" />
                <PvaRow label="AOV PvA" weeks={weeks as unknown as Record<string, unknown>[]} field="aovPva" />
                <PvaRow label="CAC PvA" weeks={weeks as unknown as Record<string, unknown>[]} field="cacPva" invert />
              </tbody>
            </table>
          </div>
        )}

        {/* Warnings */}
        <div className="mx-4 mb-4 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-gray-600 flex gap-1">
              <span className="text-yellow-700">⚠</span> {w}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PvaRow({ label, weeks, field, invert }: {
  label: string;
  weeks: Record<string, unknown>[];
  field: string;
  invert?: boolean;
}) {
  return (
    <tr className="border-b border-gray-800">
      <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">{label}</td>
      {weeks.map((w, i) => {
        const val = w[field] as number | null;
        if (val == null) return <td key={i} className="py-1.5 px-2 text-center text-gray-600">-</td>;

        let color = 'text-gray-400';
        const threshold = invert ? val : val;
        if (threshold >= 95) color = 'text-green-400';
        else if (threshold >= 85) color = 'text-yellow-400';
        else color = 'text-red-400';

        // For CAC, higher PvA is worse (inverted)
        if (invert && field === 'cacPva') {
          if (val <= 105) color = 'text-green-400';
          else if (val <= 120) color = 'text-yellow-400';
          else color = 'text-red-400';
        }

        return <td key={i} className={`py-1.5 px-2 text-center font-mono ${color}`}>{val.toFixed(0)}%</td>;
      })}
    </tr>
  );
}
