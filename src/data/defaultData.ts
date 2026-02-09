/** Google Sheets source for live sync */
export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1sE1p-OfzS013SPOX4kubi3q-Jy5KN9kqHY9rFYPNhZs/export?format=csv&gid=289043970';

/** Convert CSV text to TSV (handles quoted cells) */
export function csvToTsv(csv: string): string {
  return csv
    .split('\n')
    .map(line => {
      const cells: string[] = [];
      let cur = '';
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
        else { cur += ch; }
      }
      cells.push(cur);
      return cells.join('\t');
    })
    .join('\n');
}

/** Auto-synced from Google Sheets — gid=289043970 (Traction Scorecard) */
export const DEFAULT_TIER1_TSV = [
  'Date\t28 Dec\t4 Jan\t11 Jan\t18 Jan\t25 Jan\t1 Feb\t8 Feb\t15 Feb\t22 Feb\t1 Mar\t8 Mar\t15 Mar\t22 Mar\t29 Mar',
  'Wk\tWK 1\tWK 2\tWK 3\tWK 4\tWK 5\tWK 6\tWK 7\tWK 8\tWK 9\tWK 10\tWK 11\tWK 12\tWK 13\tWK 14',
  'Net Sales Fcast (1000s) 🇺🇲\t$8\t$16\t$18\t$34\t$19\t$21\t$58\t$21\t$30\t$25\t$26\t$40\t$25\t$21',
  'Total Net Sales Actuals USD\t$5.6\t$9.1\t$10.9\t$22.4\t$11.2\t$10.7\t\t\t\t\t\t\t\t',
  '🇺🇲 Plan vs Actual\t66%\t55%\t61%\t65%\t60%\t51%\t0%\t0%\t0%\t0%\t0%\t0%\t0%\t0%',
  '1st Order CM Fcast (1000s)  🇺🇲\t-$1.1\t-$2.2\t-$2.4\t-$2.6\t-$2.8\t-$2.9\t-$3.1\t-$3.3\t-$3.5\t-$4\t-$4\t-$4\t-$4\t-$2',
  '1st Order CM Actuals 🇺🇲 USD\t-$4.0\t-$4.1\t-$3.7\t-$2.7\t-$2.4\t-$3.3\t\t\t\t\t\t\t\t',
  '🇺🇲 Plan vs Actual\t28%\t53%\t64%\t93%\t117%\t88%\t\t\t\t\t\t\t\t',
  '1st Order Count Fcast 🇺🇲\t51\t98\t107\t116\t125\t134\t143\t152\t161\t170\t179\t188\t196\t88',
  '1st Order Count 🇺🇲\t19\t28\t30\t25\t28\t37\t\t\t\t\t\t\t\t',
  '🇺🇲 Plan vs Actual\t37%\t29%\t28%\t22%\t22%\t28%\t0%\t0%\t0%\t0%\t0%\t0%\t0%\t0%',
  'NC $ AOV Fcast 🇺🇲\t$86\t$86\t$86\t$86\t$86\t$86\t$345\t$16\t$44\t$37\t$37\t$172\t$24\t$37',
  'NC $ AOV Actuals USD\t$60\t$73\t$82\t$72\t$69\t$101.7\t\t\t\t\t\t\t\t',
  'Plan vs Actual\t69%\t84%\t95%\t83%\t80%\t118%\t0%\t0%\t0%\t0%\t0%\t0%\t0%\t0%',
  'CAC 🇺🇲 Fcast USD\t$83\t$89\t$88\t$87\t$86\t$86\t\t\t\t\t\t\t\t',
  'CAC 🇺🇲 Actuals USD\t$90\t$156\t$118\t$134\t$121\t$120\t\t\t\t\t\t\t\t',
  'Plan vs Actual\t108%\t176%\t134%\t154%\t140%\t140%\t\t\t\t\t\t\t\t',
].join('\n');
