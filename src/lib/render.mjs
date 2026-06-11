/** Server-side HTML builders — matrix tables, legends, sidebar. */
import {
  R, YEARS, ORDER, SLAMS, COVID, VENUE, MONTH, BALLCHANGE,
  surfaceOf, cpiBand, radBand, bandFromScore, aceBand, rallyBand, BAND_LABEL,
} from './data.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtPct = v => (v * 100).toFixed(1);
const fmtNum = v => String(+v.toFixed(4));
const fmtRad = v => v.toFixed(3);

export const VIEWS = {
  cpi: { get: r => r.cpi, fmt: fmtNum, band: r => cpiBand(r.cpi), avgband: cpiBand, avgfmt: v => v.toFixed(1) },
  ace: { get: r => r.aceRate, fmt: fmtPct,
    band: r => r.aceRate != null ? aceBand(r.aceRate) : null,
    avgband: aceBand, avgfmt: fmtPct },
  rally: { get: r => r.rallyLength, fmt: fmtNum,
    band: r => r.rallyLength != null ? rallyBand(r.rallyLength) : null,
    avgband: rallyBand, avgfmt: v => v.toFixed(2) },
  conditions: { get: r => r.rad, fmt: fmtRad, band: r => radBand(r.rad), avgband: radBand, avgfmt: fmtRad },
  osr: { get: r => r.osr, fmt: null, band: r => bandFromScore(r.osr) },
  champions: { get: r => r.winner, fmt: null, band: () => null },
  balls: { get: r => r.ball, fmt: null, band: () => null },
};

export function thRow(extraLabel) {
  const yh = YEARS.map(y =>
    `<th class="yh" data-year="${y}" title="Click for ${y} season summary">’${y.slice(2)}</th>`).join('');
  const last = extraLabel ? `<th class="avgh" title="${esc(extraLabel)}">3yr</th>` : '';
  return `<tr><th>Tournament</th>${yh}${last}</tr>`;
}

function tournamentTh(t) {
  const s = surfaceOf(t);
  const dot = s.includes('Indoor') ? 'var(--indoor)'
    : ({ Hard: 'var(--hard)', Clay: 'var(--clay)', Grass: 'var(--grass)' }[s.split(' ')[0]] || 'var(--indoor)');
  const slam = SLAMS.has(t) ? '<span class="slam" title="Grand Slam">◆</span>' : '';
  const nice = s.replace(' (Indoor)', ' · indoor');
  const note = t === 'Canadian Open' ? ' title="Alternates Toronto / Montreal every other year"' : '';
  const SHORT = { 'Australian Open': 'Aus Open', 'Canadian Open': 'Canada' };
  const nm = SHORT[t] ? `<span class="tn-f">${t}</span><span class="tn-s">${SHORT[t]}</span>` : t;
  return `<th class="t" scope="row"${note}>${slam}${nm}<span class="surf"><i style="background:${dot}"></i>${nice}</span></th>`;
}

export function matrix(viewKey, { avg = false, ballmarks = false, novc = false } = {}) {
  const v = VIEWS[viewKey];
  const out = [];
  for (const t of ORDER) {
    const cells = [];
    const vals = [];
    for (const y of YEARS) {
      const k = `${t}|${y}`;
      const r = R.get(k);
      const vc = novc ? null : VENUE[k];
      let cls = vc ? ' vc' : '';
      let attr = vc ? ` data-vc="${esc(vc)}"` : '';
      const bc = ballmarks ? BALLCHANGE[k] : null;
      if (bc) { cls += ' bc'; attr += ` data-bc="${esc(bc)}"`; }
      if (COVID.has(k)) {
        cells.push(`<td class="na covid${cls}"${attr} title="Cancelled or restricted — COVID">COVID</td>`);
        continue;
      }
      const val = r ? v.get(r) : null;
      if (viewKey === 'conditions') {
        const elev = r && r.elevation;
        const indoor = r && (r.surface || '').includes('Indoor');
        const alt = elev != null ? `${+elev}m` : '';
        if (val == null) {
          const label = alt ? alt + (indoor ? ' · indoor' : '') : (indoor ? 'indoor' : '');
          cells.push(label
            ? `<td class="na${cls}"${attr}><small class="alt">${label}</small></td>`
            : `<td class="na${cls}"${attr}>–</td>`);
          continue;
        }
        vals.push([+y, val]);
        const b = v.band(r);
        const bandCls = b != null ? ` b${b}` : '';
        const sub = alt ? `<small class="alt">${alt}</small>` : '';
        cells.push(`<td class="v${bandCls}${cls}"${attr} data-k="${esc(k)}" tabindex="0">${v.fmt(val)}${sub}</td>`);
        continue;
      }
      if (val == null) {
        const title = vc ? ` title="${esc(vc)}"` : '';
        cells.push(`<td class="na${cls}"${attr}${title}>–</td>`);
        continue;
      }
      if (viewKey === 'champions' || viewKey === 'balls') {
        const title = (bc || vc) ? ` title="${esc(bc || vc)}"` : '';
        cells.push(`<td class="txt${cls}"${attr}${title}>${esc(val)}</td>`);
        continue;
      }
      vals.push([+y, val]);
      const b = v.band(r);
      const bandCls = b != null ? ` b${b}` : '';
      const disp = viewKey === 'osr'
        ? BAND_LABEL[b].replace('Medium', 'Med').replace('-', ' ')
        : v.fmt(val);
      const src = viewKey === 'cpi' && (r.cpiSource || r.cpiSourceLocal) ? ' src' : '';
      cells.push(`<td class="v${bandCls}${src}${cls}"${attr} data-k="${esc(k)}" tabindex="0">${disp}</td>`);
    }
    let avgCell = '';
    if (avg) {
      const recent = vals.filter(([yy]) => yy >= 2023).map(([, x]) => x);
      if (recent.length) {
        const m = recent.reduce((a, b) => a + b) / recent.length;
        const b = v.avgband ? v.avgband(m) : null;
        avgCell = `<td class="v avg${b != null ? ` b${b}` : ''}">${v.avgfmt ? v.avgfmt(m) : m.toFixed(1)}</td>`;
      } else avgCell = '<td class="na avg">–</td>';
    }
    out.push(`<tr data-surface="${esc(surfaceOf(t))}">${tournamentTh(t)}${cells.join('')}${avgCell}</tr>`);
  }
  return out.join('');
}

// ---- legends ----
const chips = ranges => ranges.map(([rng, lab], i) =>
  `<span class="chip b${i}"><b>${rng}</b> ${lab}</span>`).join('');
export const LEGEND = {
  cpi: chips([['<30', 'Slow'], ['30–34', 'Medium-slow'], ['35–39', 'Medium'], ['40–44', 'Medium-fast'], ['>44', 'Fast']]),
  ace: chips([['<7%', 'Low'], ['7–8.5', 'Medium-low'], ['8.5–9.5', 'Medium'], ['9.5–11', 'Medium-high'], ['>11%', 'High']]),
  rally: chips([['>4.7', 'Long'], ['4.4–4.7', 'Medium-long'], ['4.2–4.4', 'Medium'], ['3.9–4.2', 'Medium-short'], ['<3.9', 'Short']]),
  rad: chips([['>1.0', 'Dense'], ['0.975–1.0', 'Denser'], ['0.96–0.975', 'Medium'], ['0.94–0.96', 'Thinner'], ['<0.94', 'Thin']]),
};

// ---- sidebar ----
export function sidebar(nowY = 2026, nowM = 6) {
  const inLast12 = (t, y) => (+y === nowY && MONTH[t] <= nowM) || (+y === nowY - 1 && MONTH[t] > nowM);
  const last12 = [];
  for (const t of ORDER)
    for (const y of [String(nowY - 1), String(nowY)]) {
      const r = R.get(`${t}|${y}`);
      if (r && inLast12(t, y) && r.cpi != null) last12.push([t, +y, r.cpi]);
    }
  last12.sort((a, b) => b[2] - a[2]);
  const li = ([t, y, c]) =>
    `<li><span>${t} <small class="yr">’${String(y).slice(2)}</small></span><b class="b${cpiBand(c)}">${+c}</b></li>`;
  const fast = last12.slice(0, 3).map(li).join('');
  const slow = [...last12].sort((a, b) => a[2] - b[2]).slice(0, 3).map(li).join('');

  // hard-court trend: last 4 complete seasons
  const trendYears = ['2022', '2023', '2024', '2025'];
  const seasonAvg = (y, key) => {
    const vals = [...R.entries()]
      .filter(([k, r]) => k.endsWith(`|${y}`) && r[key] != null && (r.surface || '').startsWith('Hard'))
      .map(([, r]) => r[key]);
    return vals.length ? vals.reduce((a, b) => a + b) / vals.length : null;
  };
  const spark = vals => {
    const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
    let mn = Math.min(...pts.map(p => p[1])), mx = Math.max(...pts.map(p => p[1]));
    if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * .2; mn -= pad; mx += pad;
    const X = i => 3 + i / (vals.length - 1) * 74, Y = v => 3 + (1 - (v - mn) / (mx - mn)) * 16;
    const d = pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 84 22" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="var(--ink3)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="2.4" fill="var(--accent)"/></svg>`;
  };
  const trend = [
    ['cpi', 'Avg CPI', v => v.toFixed(1), true],
    ['aceRate', 'Avg ace rate', v => (v * 100).toFixed(1) + '%', true],
    ['rallyLength', 'Avg rally', v => v.toFixed(2), false],
  ].map(([key, label, fmt, upIsFast]) => {
    const vals = trendYears.map(y => seasonAvg(y, key));
    const first = vals.find(v => v != null), last = [...vals].reverse().find(v => v != null);
    const d = last - first;
    /* arrows only earn a colour when the move is >2% over the window */
    const flat = Math.abs(d) / Math.abs(first) < 0.02;
    const cls = flat ? '' : ((d > 0) === upIsFast ? 'pos' : 'neg');
    const arrow = flat ? '→' : (d > 0 ? '▲' : '▼');
    return `<li><span>${label}<small style="display:block;color:var(--ink3);font-size:11px">’22 → ’25</small></span>${spark(vals)}<b class="${cls}" style="background:none;padding:0${flat ? ';color:var(--ink2)' : ''}">${fmt(last)} ${arrow}</b></li>`;
  }).join('');

  return { fast, slow, trend };
}

export function logoSvg(cls = '', ink = 'var(--ink)') {
  return `<svg ${cls ? `class="${cls}" ` : ''}viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Court Speed">
<defs><linearGradient id="csramp" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#c4683f"/><stop offset=".5" stop-color="#cbb31a"/><stop offset="1" stop-color="#3f9e58"/>
</linearGradient></defs>
<path d="M7 14 Q 19 49 30 50 Q 42 51 55 20" fill="none" stroke="url(#csramp)" stroke-width="5.5" stroke-linecap="round"/>
<circle cx="56.5" cy="15" r="4.6" fill="#3f9e58"/>
<line x1="9" y1="59" x2="55" y2="59" stroke="${ink}" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>
</svg>`;
}
