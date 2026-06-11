/** Data model + scoring. Single source of truth shared by pages and client payload. */
import raw from '../data/court_speed.json' with { type: 'json' };

export const DATA = raw;
export const YEARS = Array.from({ length: 15 }, (_, i) => String(2012 + i));
export const ORDER = ['Australian Open', 'Indian Wells', 'Miami', 'Monte Carlo', 'Madrid', 'Rome',
  'Roland Garros', 'Wimbledon', 'Canadian Open', 'Cincinnati', 'US Open',
  'Shanghai', 'Paris', 'ATP Finals'];
export const SLAMS = new Set(['Australian Open', 'Roland Garros', 'Wimbledon', 'US Open']);
export const COVID = new Set(['Indian Wells|2020', 'Miami|2020', 'Monte Carlo|2020', 'Madrid|2020',
  'Wimbledon|2020', 'Canadian Open|2020', 'Shanghai|2020', 'Shanghai|2021', 'Shanghai|2022']);
export const VENUE = {
  'Miami|2019': 'Venue change — Crandon Park, Key Biscayne → Hard Rock Stadium, Miami Gardens',
  'ATP Finals|2021': 'Venue change — The O2, London (11m) → Pala Alpitour, Turin (247m)',
  'Paris|2025': 'Venue change — Accor Arena, Bercy → Paris La Défense Arena',
};
export const VC_SHORT = {
  'Miami|2019': 'Crandon Pk → Hard Rock',
  'ATP Finals|2021': 'London → Turin',
  'Paris|2025': 'Bercy → La Défense',
};
export const MONTH = { 'Australian Open': 1, 'Indian Wells': 3, 'Miami': 3, 'Monte Carlo': 4, 'Madrid': 5, 'Rome': 5,
  'Roland Garros': 6, 'Wimbledon': 7, 'Canadian Open': 8, 'Cincinnati': 8, 'US Open': 9,
  'Shanghai': 10, 'Paris': 11, 'ATP Finals': 11 };

export const R = new Map();
for (const [y, recs] of Object.entries(DATA))
  for (const r of recs) R.set(`${r.tournament}|${y}`, r);

export function surfaceOf(t) {
  for (let i = YEARS.length - 1; i >= 0; i--) {
    const r = R.get(`${t}|${YEARS[i]}`);
    if (r && r.surface) return r.surface;
  }
  return '';
}

// ---- scoring ----
const clamp = v => Math.max(0, Math.min(100, v));
export const sCpi = v => clamp((v - 20) / 30 * 100);
export const sAce = v => clamp((v - 0.04) / 0.10 * 100);
export const sRally = v => clamp((5.2 - v) / 1.8 * 100);
export const sRad = v => clamp((1.00 - v) / 0.10 * 100);

export const BAND_LABEL = ['Slow', 'Medium-slow', 'Medium', 'Medium-fast', 'Fast'];
export const bandFromScore = s => s == null ? null : s < 30 ? 0 : s < 45 ? 1 : s < 55 ? 2 : s < 70 ? 3 : 4;
/* legend-exact bands for the ace & rally matrices (sAce/sRally above feed OSR only) */
export const aceBand = v => v < 0.07 ? 0 : v <= 0.085 ? 1 : v <= 0.095 ? 2 : v <= 0.11 ? 3 : 4;
export const rallyBand = v => v > 4.7 ? 0 : v >= 4.4 ? 1 : v >= 4.2 ? 2 : v >= 3.9 ? 3 : 4;
// sheet bands: <30 / 30-34 / 35-39 / 40-44 / >44 (44.1 is FAST)
export const cpiBand = v => v == null ? null : v < 30 ? 0 : v < 35 ? 1 : v < 40 ? 2 : v <= 44 ? 3 : 4;
// original-site RAD bands: >1.0 Dense … <0.94 Thin
export const radBand = v => v == null ? null : v > 1.0 ? 0 : v > 0.975 ? 1 : v > 0.96 ? 2 : v > 0.94 ? 3 : 4;

export function osr(r) {
  const parts = [];
  if (r.cpi != null) parts.push(sCpi(r.cpi));
  if (r.aceRate != null) parts.push(sAce(r.aceRate));
  if (r.rallyLength != null) parts.push(sRally(r.rallyLength));
  if (r.rad != null) parts.push(sRad(r.rad));
  if (parts.length < 3) return null;
  let v = parts.reduce((a, b) => a + b) / parts.length;
  const s = r.surface || '';
  if (s.includes('Clay')) v -= 5;
  if (s.includes('Grass')) v += 5;
  return +v.toFixed(1);
}
for (const r of R.values()) {
  r.osr = osr(r);
  r.osrLabel = r.osr != null ? BAND_LABEL[bandFromScore(r.osr)] : null;
}

// ---- ball changes ----
const normBall = b => (b || '').replace(/\*/g, '').trim().toLowerCase();
export const BALLCHANGE = {};
for (const t of ORDER) {
  let prev = null;
  for (const y of YEARS) {
    const r = R.get(`${t}|${y}`);
    const b = r && r.ball;
    if (b) {
      if (prev && normBall(b) !== normBall(prev))
        BALLCHANGE[`${t}|${y}`] = `Ball change: ${prev.replace(/\*/g, '').trim()} → ${b.replace(/\*/g, '').trim()}`;
      prev = b;
    }
  }
}

/** payload embedded into every page for tooltips / modals / trends */
export function clientPayload() {
  const D = {};
  for (const [k, r] of R.entries()) {
    D[k] = {
      cpi: r.cpi, surface: r.surface, aceRate: r.aceRate, rallyLength: r.rallyLength,
      rad: r.rad, elevation: r.elevation, ball: r.ball, winner: r.winner,
      holdPct: r.holdPct, osr: r.osr, osrLabel: r.osrLabel,
      cpiSource: r.cpiSourceLocal || r.cpiSource,
    };
    if (r.displayName && r.displayName !== r.tournament) D[k].displayName = r.displayName;
  }
  const SURF = Object.fromEntries(ORDER.map(t => [t, surfaceOf(t)]));
  return {
    D, SURF, ORDER, YEARS: YEARS.map(Number),
    COVID: [...COVID], VC: VENUE, VCSHORT: VC_SHORT,
  };
}
