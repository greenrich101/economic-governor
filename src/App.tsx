import { useState, useMemo, useEffect } from 'react';
import type { WeekData } from './types';
import { parsePastedData } from './sheets';
import { runModule1 } from './logic/economicGovernor';
import { runModule2 } from './logic/funnelDiagnostician';
import { DEFAULT_TIER1_TSV, SHEET_CSV_URL, csvToTsv } from './data/defaultData';
import PasswordGate from './components/PasswordGate';
import DataInput from './components/DataInput';
import Module1 from './components/Module1';
import Module2 from './components/Module2';

const TIER1_STORAGE_KEY = 'economic-governor-tier1-paste';
const TIER2_STORAGE_KEY = 'economic-governor-tier2';

/** Tier 2 field keys — everything NOT sourced from the spreadsheet */
const TIER2_FIELDS: (keyof WeekData)[] = [
  'cpm', 'ctr', 'cpc', 'frequency', 'metaClicks', 'shopifySessions', 'cvr',
];

/** Merge saved Tier 2 data onto pasted weeks (match by label) */
function mergeTier2(pastedWeeks: WeekData[]): WeekData[] {
  try {
    const saved = localStorage.getItem(TIER2_STORAGE_KEY);
    if (!saved) return pastedWeeks;
    const tier2Map: Record<string, Partial<WeekData>> = JSON.parse(saved);

    return pastedWeeks.map(w => {
      const t2 = tier2Map[w.label];
      if (!t2) return w;
      const merged = { ...w };
      for (const key of TIER2_FIELDS) {
        if (t2[key] != null) (merged as Record<string, unknown>)[key] = t2[key];
      }
      return merged;
    });
  } catch { return pastedWeeks; }
}

/** Save only Tier 2 data to localStorage (keyed by week label) */
function saveTier2(weeks: WeekData[]) {
  const tier2Map: Record<string, Partial<WeekData>> = {};
  for (const w of weeks) {
    const entry: Partial<WeekData> = {};
    let hasData = false;
    for (const key of TIER2_FIELDS) {
      if (w[key] != null) {
        (entry as Record<string, unknown>)[key] = w[key];
        hasData = true;
      }
    }
    if (hasData) tier2Map[w.label] = entry;
  }
  localStorage.setItem(TIER2_STORAGE_KEY, JSON.stringify(tier2Map));
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('auth') === 'true');
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Load saved paste from localStorage on mount, fall back to synced default
  useEffect(() => {
    const saved = localStorage.getItem(TIER1_STORAGE_KEY);
    const source = saved || DEFAULT_TIER1_TSV;
    try {
      const parsed = parsePastedData(source);
      setWeeks(mergeTier2(parsed));
      if (!saved) localStorage.setItem(TIER1_STORAGE_KEY, DEFAULT_TIER1_TSV);
    } catch {
      // stale data, ignore
    }
  }, []);

  // Save Tier 2 data to localStorage when weeks change
  useEffect(() => {
    if (weeks.length > 0) saveTier2(weeks);
  }, [weeks]);

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    try {
      const parsed = parsePastedData(pasteText);
      const merged = mergeTier2(parsed);
      setWeeks(merged);
      localStorage.setItem(TIER1_STORAGE_KEY, pasteText);
      setError(null);
      setShowPaste(false);
      setPasteText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse pasted data');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const csv = await res.text();
      const tsv = csvToTsv(csv);
      const parsed = parsePastedData(tsv);
      const merged = mergeTier2(parsed);
      setWeeks(merged);
      localStorage.setItem(TIER1_STORAGE_KEY, tsv);
    } catch {
      setError('Sync blocked by CORS — use "Paste from Sheet" instead');
    } finally {
      setSyncing(false);
    }
  };

  const module1Result = useMemo(() => {
    const hasData = weeks.some(w => w.adSpend != null || w.cmActual != null || w.countActual != null);
    if (!hasData) return null;
    return runModule1(weeks);
  }, [weeks]);

  const module2Result = useMemo(() => {
    if (!module1Result) return null;
    return runModule2(module1Result);
  }, [module1Result]);

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Economic Governor + Full-Funnel Diagnostician</h1>
          </div>
          <div className="flex gap-2 items-center">
            {error && (
              <span className="text-xs text-red-400 mr-2">{error}</span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync from Sheet'}
            </button>
            <button
              onClick={() => setShowPaste(!showPaste)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded transition-colors"
            >
              {showPaste ? 'Cancel' : 'Paste from Sheet'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6 space-y-6">
        {showPaste && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-3">
            <p className="text-xs text-gray-400">Select the full table in Google Sheets (including headers), copy, and paste below.</p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste spreadsheet data here..."
              className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 font-mono focus:outline-none focus:border-red-500 resize-y"
            />
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className="text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              Load Data
            </button>
          </div>
        )}

        {weeks.length > 0 ? (
          <>
            <DataInput weeks={weeks} onChange={setWeeks} />

            {module1Result && (
              <>
                <Module1 result={module1Result} />
                {module2Result && <Module2 result={module2Result} weeks={weeks} onChange={setWeeks} />}
              </>
            )}
          </>
        ) : (
          !showPaste && (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
              <p className="text-gray-500 text-sm">No data loaded. Click "Paste from Sheet" to import your Traction Scorecard.</p>
            </div>
          )
        )}
      </main>

      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-[10px] text-gray-600">Math-first. Skeptical. Anti-attribution. No storytelling. No scaling broken economics.</p>
        </div>
      </footer>
    </div>
  );
}
