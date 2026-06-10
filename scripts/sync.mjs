#!/usr/bin/env node
/**
 * Sync: Google Sheet (xlsx export) -> src/data/court_speed.json
 *
 * The sheet is the CMS. One xlsx download preserves every tab AND the
 * cell hyperlinks on CPI values (source-chart screenshots) that CSV strips.
 *
 * Also mirrors source-chart images into public/sources/ so tooltips load
 * instantly and survive reddit/twimg link-rot. Failures fall back to the
 * remote URL.
 *
 * Env:
 *   SYNC_XLSX=path/to/file.xlsx   parse a local file instead of fetching
 *   SKIP_IMAGES=1                 skip the image mirror step
 */
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHEET_ID = '1artEsVLOOjwSEafl4RfMnLhfEUnsQKa7aQNIyaPVnLI';
const XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
const YEARS = Array.from({ length: 15 }, (_, i) => 2012 + i);
const CANON = new Map([
  ['toronto', 'Canadian Open'], ['montreal', 'Canadian Open'],
  ['toronto/montreal', 'Canadian Open'], ['montreal/toronto', 'Canadian Open'],
]);

function normPct(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v < 1.5 ? +v.toFixed(4) : null;
  const s = String(v).trim();
  if (s.endsWith('%')) { const f = parseFloat(s); return isNaN(f) ? null : +(f / 100).toFixed(4); }
  const f = parseFloat(s);
  return isNaN(f) ? null : (f < 1.5 ? +f.toFixed(4) : null);
}
function normNum(v) {
  if (v == null || v === '') return null;
  const f = parseFloat(String(v));
  return isNaN(f) ? null : f;
}
function normElev(v) {
  if (v == null) return null;
  const m = String(v).match(/^([\d.]+)\s*m/);
  return m ? parseFloat(m[1]) : null;
}
const str = v => (v == null ? null : String(v).trim() || null);

async function loadWorkbook() {
  if (process.env.SYNC_XLSX) {
    console.log(`parsing local ${process.env.SYNC_XLSX}`);
    return XLSX.read(readFileSync(process.env.SYNC_XLSX), { type: 'buffer' });
  }
  console.log('fetching sheet xlsx export…');
  const res = await fetch(XLSX_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`sheet fetch failed: ${res.status}`);
  return XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });
}

const wb = await loadWorkbook();
const data = {};
for (const year of YEARS) {
  const ws = wb.Sheets[`CPI ${year}`];
  if (!ws) { console.warn(`missing tab CPI ${year}`); data[year] = []; continue; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const out = [];
  rows.slice(1).forEach((row, i) => {
    const name = str(row[0]);
    if (!name) return;
    const low = name.toLowerCase();
    if (/^(slow court|medium|fast court|\*|category)/.test(low)) return;
    const canon = CANON.get(low) || name;
    // hyperlink on the CPI cell (column B)
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
    const link = ws[addr] && ws[addr].l ? ws[addr].l.Target : null;
    out.push({
      tournament: canon,
      displayName: name,
      cpi: normNum(row[1]),
      surface: str(row[2]),
      aceRate: normPct(row[3]),
      winner: str(row[6]),
      elevation: normElev(row[7]),
      ball: str(row[8]),
      holdPct: normPct(row[9]),
      rallyLength: normNum(row[10]),
      rad: normNum(row[11]),
      ...(link ? { cpiSource: link } : {}),
    });
  });
  data[year] = out;
}

// ---- mirror source images ----
if (!process.env.SKIP_IMAGES) {
  const dir = join(ROOT, 'public', 'sources');
  mkdirSync(dir, { recursive: true });
  let ok = 0, fail = 0, cached = 0;
  for (const [year, recs] of Object.entries(data)) {
    for (const r of recs) {
      if (!r.cpiSource) continue;
      const slug = `${r.tournament.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${year}`;
      const ext = (extname(new URL(r.cpiSource).pathname) || '.jpg').slice(0, 5);
      const file = `${slug}${ext}`;
      const local = join(dir, file);
      if (existsSync(local)) { r.cpiSourceLocal = `/sources/${file}`; cached++; continue; }
      try {
        const res = await fetch(r.cpiSource, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(res.status);
        writeFileSync(local, Buffer.from(await res.arrayBuffer()));
        r.cpiSourceLocal = `/sources/${file}`;
        ok++;
      } catch (e) {
        fail++; // tooltip falls back to the remote URL
      }
    }
  }
  console.log(`images: ${ok} downloaded, ${cached} cached, ${fail} failed (remote fallback)`);
}

const outPath = join(ROOT, 'src', 'data', 'court_speed.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 1));
const n = Object.values(data).reduce((s, a) => s + a.length, 0);
console.log(`wrote ${outPath} — ${n} tournament-years`);
