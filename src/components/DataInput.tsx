import type { WeekData } from '../types';

interface Props {
  weeks: WeekData[];
  onChange: (weeks: WeekData[]) => void;
}

interface RowDef {
  key: keyof WeekData;
  label: string;
  prefix?: string;
  suffix?: string;
  tier: 1 | 2;
  section?: string;
}

const TIER1_ROWS: RowDef[] = [
  { key: 'adSpend', label: 'Ad Spend Meta USD', prefix: '$', tier: 1, section: 'Ad Spend' },
  { key: 'cmForecast', label: '1st Order CM Forecast', prefix: '$', tier: 1, section: '1st Order CM' },
  { key: 'cmActual', label: '1st Order CM Actuals', prefix: '$', tier: 1 },
  { key: 'countForecast', label: '1st Order Count Forecast', tier: 1, section: '1st Order Count' },
  { key: 'countActual', label: '1st Order Count Actuals', tier: 1 },
  { key: 'aovForecast', label: 'NC AOV Forecast', prefix: '$', tier: 1, section: 'NC AOV' },
  { key: 'aovActual', label: 'NC AOV Actuals', prefix: '$', tier: 1 },
  { key: 'cacForecast', label: 'CAC Forecast', prefix: '$', tier: 1, section: 'CAC' },
  { key: 'cacActual', label: 'CAC Actuals', prefix: '$', tier: 1 },
];

export default function DataInput({ weeks, onChange }: Props) {

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

  const renderRows = (rows: RowDef[]) => {
    let currentSection = '';
    return rows.map((row) => {
      const sectionHeader = row.section && row.section !== currentSection;
      if (row.section) currentSection = row.section;

      const isForecast = row.key.includes('Forecast') || row.key.includes('forecast');
      const isReadOnly = row.tier === 1;
      const rowColor = isReadOnly
        ? (isForecast ? 'text-gray-500' : 'text-gray-300')
        : (isForecast ? 'text-gray-400' : 'text-white');

      return (
        <tr key={row.key} className={`border-b border-gray-800 ${sectionHeader ? 'border-t-2 border-t-gray-700' : ''}`}>
          <td className={`py-2 px-3 text-xs font-medium ${rowColor} whitespace-nowrap sticky left-0 bg-gray-900 z-10 min-w-[180px]`}>
            {row.label}
            {row.tier === 2 && <span className="ml-1 text-yellow-600 text-[10px]">T2</span>}
          </td>
          {weeks.map((week, i) => (
            <td key={i} className="py-1 px-1">
              {isReadOnly ? (
                <div className={`w-full bg-gray-900/50 border border-gray-800 rounded px-2 py-1 text-xs text-right ${rowColor} min-w-[80px]`}>
                  {formatVal(week[row.key] as number | null, row.prefix, row.suffix) || '-'}
                </div>
              ) : (
                <input
                  type="text"
                  value={formatVal(week[row.key] as number | null, row.prefix, row.suffix)}
                  onChange={e => updateCell(i, row.key, e.target.value)}
                  className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-right ${rowColor} focus:outline-none focus:border-red-500 min-w-[80px]`}
                  placeholder="-"
                />
              )}
            </td>
          ))}
        </tr>
      );
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-white">Data Input</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tier 1 — Source of Truth (from spreadsheet)</p>
        </div>
      </div>
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
            {renderRows(TIER1_ROWS)}
          </tbody>
        </table>
      </div>

    </div>
  );
}
