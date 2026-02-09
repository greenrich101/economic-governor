import { useState, useMemo, useEffect, useCallback } from 'react';
import type { WeekData } from './types';
import { fetchSheetData } from './sheets';
import { runModule1 } from './logic/economicGovernor';
import { runModule2 } from './logic/funnelDiagnostician';
import PasswordGate from './components/PasswordGate';
import DataInput from './components/DataInput';
import Module1 from './components/Module1';
import Module2 from './components/Module2';

const TIER2_STORAGE_KEY = 'economic-governor-tier2';

/** Tier 2 field keys — everything NOT sourced from the spreadsheet */
const TIER2_FIELDS: (keyof WeekData)[] = [
  'cpm', 'ctr', 'cpc', 'frequency', 'metaClicks', 'shopifySessions', 'cvr',
];

/** Merge saved Tier 2 data onto sheet-sourced weeks (match by label) */
function mergeTier2(sheetWeeks: WeekData[]): WeekData[] {
  try {
    const saved = localStorage.getItem(TIER2_STORAGE_KEY);
    if (!saved) return sheetWeeks;
    const tier2Map: Record<string, Partial<WeekData>> = JSON.parse(saved);

    return sheetWeeks.map(w => {
      const t2 = tier2Map[w.label];
      if (!t2) return w;
      const merged = { ...w };
      for (const key of TIER2_FIELDS) {
        if (t2[key] != null) (merged as Record<string, unknown>)[key] = t2[key];
      }
      return merged;
    });
  } catch { return sheetWeeks; }
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadFromSheet = useCallback(async () => {
    try {
      const sheetWeeks = await fetchSheetData();
      const merged = mergeTier2(sheetWeeks);
      setWeeks(merged);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch sheet data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    loadFromSheet().finally(() => setLoading(false));
  }, [loadFromSheet]);

  // Save Tier 2 data to localStorage when weeks change
  useEffect(() => {
    if (weeks.length > 0) saveTier2(weeks);
  }, [weeks]);

  const handleSync = async () => {
    setSyncing(true);
    await loadFromSheet();
    setSyncing(false);
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
            <h1 className="text-xl font-bold text-white">Economic Governor</h1>
            <p className="text-xs text-gray-500">Full-Funnel Diagnostician</p>
          </div>
          <div className="flex gap-2 items-center">
            {error && (
              <span className="text-xs text-red-400 mr-2">Sheet error: {error}</span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync from Sheet'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
            <p className="text-gray-400 text-sm">Loading data from spreadsheet...</p>
          </div>
        ) : (
          <>
            <DataInput weeks={weeks} onChange={setWeeks} />

            {module1Result && (
              <>
                <Module1 result={module1Result} />
                {module2Result && <Module2 result={module2Result} weeks={weeks} onChange={setWeeks} />}
              </>
            )}

            {!module1Result && !loading && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
                <p className="text-gray-500 text-sm">No Tier 1 data found in spreadsheet. Check the RCA tab has data.</p>
              </div>
            )}
          </>
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
