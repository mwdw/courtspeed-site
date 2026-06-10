/* Court Speed — client interactions (theme, filters, tooltips, modals, trends) */
(() => {
const payload = JSON.parse(document.getElementById('cs-data').textContent);
const { D, SURF, ORDER, YEARS, COVID, VC, VCSHORT } = payload;
const BANDS = ['Slow', 'Medium-slow', 'Medium', 'Medium-fast', 'Fast'];
const cpiBand = v => v < 30 ? 0 : v < 35 ? 1 : v < 40 ? 2 : v <= 44 ? 3 : 4;
const radBand = v => v > 1.0 ? 0 : v > 0.975 ? 1 : v > 0.96 ? 2 : v > 0.94 ? 3 : 4;
const score = (v, a, b) => Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
const sBand = s => s < 30 ? 0 : s < 45 ? 1 : s < 55 ? 2 : s < 70 ? 3 : 4;

/* theme */
const root = document.documentElement, tbtn = document.getElementById('theme');
let theme = localStorage.getItem('cs-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function setTheme(t) { theme = t; root.dataset.theme = t; if (tbtn) tbtn.textContent = t === 'dark' ? '☀' : '☾'; localStorage.setItem('cs-theme', t); }
setTheme(theme);
if (tbtn) tbtn.onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');

/* tables open showing the most recent years */
function scrollRight() {
  document.querySelectorAll('.tablewrap').forEach(el => { el.scrollLeft = el.scrollWidth; });
}
scrollRight();
addEventListener('load', () => requestAnimationFrame(scrollRight));

/* filters */
const rows = [...document.querySelectorAll('tbody tr[data-surface]')];
const btns = [...document.querySelectorAll('.filters button')];
const q = document.getElementById('q');
let surf = '';
const surfOK = s => !surf || s.startsWith(surf); /* 'Hard (Indoor)' folds into Hard */
function trendFilter() {
  document.querySelectorAll('.tcard').forEach(c => { c.style.display = surfOK(c.dataset.surface || '') ? '' : 'none'; });
}
function apply() {
  const needle = q ? q.value.toLowerCase() : '';
  rows.forEach(r => {
    const okS = surfOK(r.dataset.surface || '');
    const okQ = !needle || r.querySelector('.t').textContent.toLowerCase().includes(needle);
    r.style.display = okS && okQ ? '' : 'none';
  });
  trendFilter();
}
btns.forEach(b => b.onclick = () => { btns.forEach(x => x.classList.remove('on')); b.classList.add('on'); surf = b.dataset.s; apply(); });
if (q) q.oninput = apply;

/* summary content */
function kv(lab, val, band) {
  if (val == null) return '';
  const cls = band != null ? ` class="b${band}"` : '';
  return `<div class="kv"><span class="lab">${lab}</span><b${cls}>${val}</b></div>`;
}
function summary(t, y, r, big) {
  let h = `<div class="tip-h">${t} ${y}</div><div class="tip-sub">${r.surface || ''}${r.elevation != null ? ' · ' + r.elevation + 'm elevation' : ''}</div>`;
  h += kv('CPI', r.cpi != null ? `${r.cpi} — ${BANDS[cpiBand(r.cpi)]}` : null, r.cpi != null ? cpiBand(r.cpi) : null);
  h += kv('Overall speed rating', r.osrLabel, r.osr != null ? sBand(r.osr) : null);
  h += kv('Ace rate', r.aceRate != null ? (r.aceRate * 100).toFixed(1) + '%' : null, r.aceRate != null ? sBand(score(r.aceRate, 0.04, 0.14)) : null);
  h += kv('Rally length', r.rallyLength != null ? r.rallyLength + ' shots' : null, r.rallyLength != null ? sBand(score(5.2 - r.rallyLength, 0, 1.8)) : null);
  h += kv('Air density (RAD)', r.rad != null ? r.rad.toFixed(3) : null, r.rad != null ? radBand(r.rad) : null);
  h += kv('Hold %', r.holdPct != null ? (r.holdPct * 100).toFixed(1) + '%' : null);
  h += kv('Ball', r.ball); h += kv('Champion', r.winner);
  const vc = VC[t + '|' + y];
  if (vc) h += `<div class="tip-vc">▌ ${vc.replace('Venue change — ', 'Venue change: ')}</div>`;
  if (r.cpiSource) h += big
    ? `<a href="${r.cpiSource}" target="_blank" rel="noopener"><img src="${r.cpiSource}" alt="CPI source chart" onerror="this.outerHTML='<p class=tip-src><a href=&quot;${r.cpiSource}&quot; target=_blank>View source chart →</a></p>'"></a>`
    : `<img class="tip-img" src="${r.cpiSource}" alt="" onerror="this.remove()">`;
  return h;
}

/* tooltip (desktop hover) */
const tip = document.getElementById('tip');
const fine = matchMedia('(pointer:fine)').matches;
function placeTip(td) {
  const r = td.getBoundingClientRect(), w = 260, h = tip.offsetHeight;
  tip.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
  tip.style.top = (r.top > h + 16 ? r.top - h - 8 : r.bottom + 8) + 'px';
}
document.addEventListener('mouseover', e => {
  if (!fine || !tip) return;
  const td = e.target.closest('td.v[data-k]');
  if (!td) { tip.style.display = 'none'; return; }
  const [t, y] = td.dataset.k.split('|');
  tip.innerHTML = summary(t, y, D[td.dataset.k], false);
  tip.style.display = 'block';
  placeTip(td);
  const img = tip.querySelector('img');
  if (img) img.onload = () => placeTip(td);
});

/* modal */
const mbg = document.getElementById('modalbg'), mbody = document.getElementById('mbody'), modal = document.getElementById('modal');
function openModal(html, wide) { mbody.innerHTML = html; modal.classList.toggle('wide', !!wide); mbg.style.display = 'flex'; }
document.getElementById('mclose').onclick = () => mbg.style.display = 'none';
mbg.onclick = e => { if (e.target === mbg) mbg.style.display = 'none'; };
addEventListener('keydown', e => { if (e.key === 'Escape') mbg.style.display = 'none'; });

document.addEventListener('click', e => {
  const td = e.target.closest('td.v[data-k]');
  if (td) {
    const [t, y] = td.dataset.k.split('|');
    if (tip) tip.style.display = 'none';
    openModal(summary(t, y, D[td.dataset.k], true));
    return;
  }
  const yh = e.target.closest('th.yh');
  if (yh) {
    const y = yh.dataset.year;
    const withCpi = ORDER.map(t => [t, D[t + '|' + y]]).filter(([, r]) => r && r.cpi != null);
    let h = `<div class="tip-h">${y} season</div><div class="tip-sub">Grand Slams, Masters 1000s &amp; ATP Finals</div>`;
    if (withCpi.length) {
      const sorted = [...withCpi].sort((a, b) => b[1].cpi - a[1].cpi);
      h += kv('Fastest', `${sorted[0][0]} — ${sorted[0][1].cpi}`, cpiBand(sorted[0][1].cpi));
      h += kv('Slowest', `${sorted[sorted.length - 1][0]} — ${sorted[sorted.length - 1][1].cpi}`, cpiBand(sorted[sorted.length - 1][1].cpi));
    }
    const chip = (v, b) => v == null ? '<span class="dim">–</span>' : (b != null ? `<span class="chip b${b}">${v}</span>` : v);
    h += `<div class="yscroll"><table class="ytable"><thead><tr><th>Tournament</th><th>CPI</th><th>Ace</th><th>Rally</th><th>RAD</th><th>Ball</th><th>Rating</th><th>Champion</th></tr></thead><tbody>`;
    ORDER.forEach(t => {
      const r = D[t + '|' + y];
      const nm = (r && r.displayName) || t;
      if (COVID.includes(t + '|' + y)) { h += `<tr><td>${nm}</td><td colspan="7" class="dim" style="letter-spacing:.08em;font-size:9px">COVID</td></tr>`; return; }
      if (!r) { h += `<tr><td>${nm}</td><td colspan="7" class="dim">–</td></tr>`; return; }
      h += `<tr><td>${nm}</td>` +
        `<td>${chip(r.cpi, r.cpi != null ? cpiBand(r.cpi) : null)}</td>` +
        `<td>${chip(r.aceRate != null ? (r.aceRate * 100).toFixed(1) + '%' : null, r.aceRate != null ? sBand(score(r.aceRate, 0.04, 0.14)) : null)}</td>` +
        `<td>${chip(r.rallyLength, r.rallyLength != null ? sBand(score(5.2 - r.rallyLength, 0, 1.8)) : null)}</td>` +
        `<td>${chip(r.rad != null ? r.rad.toFixed(3) : null, r.rad != null ? radBand(r.rad) : null)}</td>` +
        `<td>${r.ball || '<span class="dim">–</span>'}</td>` +
        `<td>${r.osrLabel ? `<span class="chip b${sBand(r.osr)}">${r.osrLabel.replace('Medium', 'Med').replace('-', ' ')}</span>` : '<span class="dim">–</span>'}</td>` +
        `<td>${r.winner || '<span class="dim">–</span>'}</td></tr>`;
    });
    h += '</tbody></table></div>';
    openModal(h, true);
    return;
  }
  const card = e.target.closest('.tcard.haschart');
  if (card) {
    const t = card.dataset.t, s = SURF[t] || '';
    const dotc = s.includes('Indoor') ? 'var(--indoor)' : (DOT[s.split(' ')[0]] || 'var(--indoor)');
    const svg = chartSVG(t, metric, 640, 300);
    if (!svg) return;
    openModal(`<div class="tip-h">${t}</div><div class="tip-sub">${MNAME[metric]} · ${s}</div><div style="margin-top:12px">${svg.replaceAll('CL', dotc)}</div>`, true);
  }
});

/* prefetch source images so tooltips & modals are instant */
addEventListener('load', () => setTimeout(() => {
  Object.values(D).forEach(r => { if (r.cpiSource) { const i = new Image(); i.src = r.cpiSource; } });
}, 1200));

/* trends */
let metric = 'cpi';
const FMT = { cpi: v => v.toFixed(1), aceRate: v => (v * 100).toFixed(1) + '%', rallyLength: v => v.toFixed(2) };
const MNAME = { cpi: 'Court Pace Index', aceRate: 'Ace rate', rallyLength: 'Rally length' };
const DOT = { Hard: 'var(--hard)', Clay: 'var(--clay)', Grass: 'var(--grass)' };
const YRANGE = { cpi: [18, 52], aceRate: [0.04, 0.175], rallyLength: [3.3, 5.3] };
const YTICK = { cpi: { small: 10, big: 5 }, aceRate: { small: 0.04, big: 0.02 }, rallyLength: { small: 0.5, big: 0.25 } };
const YFMT = { cpi: v => v.toFixed(0), aceRate: v => (v * 100).toFixed(0) + '%', rallyLength: v => v.toFixed(2).replace(/0$/, '') };

function chartSVG(t, m, W, H) {
  const data = YEARS.map(y => { const r = D[t + '|' + y]; return [y, r && r[m] != null ? r[m] : null]; });
  const firstIdx = data.findIndex(d => d[1] != null);
  if (firstIdx < 0) return null;
  const dom = data.slice(firstIdx);
  const pts = dom.map((d, i) => [i, d[1], d[0]]).filter(d => d[1] != null);
  if (pts.length < 4) return null;
  const big = W > 400;
  const L = big ? 44 : 38, Rp = big ? 16 : 10, T = big ? 16 : 12, B = big ? 24 : 18;
  const [mn, mx] = YRANGE[m];
  const N = Math.max(dom.length - 1, 1);
  const X = i => L + i / N * (W - L - Rp), Y = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  const step = YTICK[m][big ? 'big' : 'small'];
  for (let v = Math.ceil(mn / step) * step; v <= mx + 1e-9; v += step) {
    svg += `<line x1="${L}" y1="${Y(v)}" x2="${W - Rp}" y2="${Y(v)}" stroke="var(--rule)" stroke-width="1"/>`;
    svg += `<text class="axis" x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${YFMT[m](v)}</text>`;
  }
  dom.forEach((d, i) => {
    const y = d[0];
    if (VC[t + '|' + y] && i > 0) {
      const xm = X(i - 0.5);
      svg += `<line x1="${xm}" y1="${T - 4}" x2="${xm}" y2="${H - B}" stroke="var(--vc)" stroke-width="1.5" stroke-dasharray="3 3"><title>${VC[t + '|' + y]}</title></line>`;
      if (big) {
        const lbl = VCSHORT[t + '|' + y] || 'venue change';
        const end = xm > W * 0.66;
        svg += `<text class="vclabel" x="${end ? xm - 5 : xm + 5}" y="${T + 4}" text-anchor="${end ? 'end' : 'start'}">${lbl}</text>`;
      }
    }
    svg += `<text class="axis" x="${X(i)}" y="${H - (big ? 7 : 5)}" text-anchor="middle">${big ? y : '’' + String(y).slice(2)}</text>`;
  });
  let seg = [];
  const flush = () => {
    if (seg.length > 1)
      svg += `<path d="${seg.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}" fill="none" stroke="CL" stroke-width="${big ? 2.2 : 1.8}" stroke-linejoin="round"/>`;
    seg = [];
  };
  dom.forEach((d, i) => { if (d[1] != null) seg.push([i, d[1]]); else flush(); });
  flush();
  pts.forEach(p => svg += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${big ? 3.2 : 2.4}" fill="CL"><title>${p[2]}: ${FMT[m](p[1])}</title></circle>`);
  svg += '</svg>';
  return svg;
}

function renderTrends(m) {
  const grid = document.getElementById('trendgrid');
  if (!grid) return;
  grid.innerHTML = '';
  ORDER.forEach(t => {
    const s = SURF[t] || '', dotc = s.includes('Indoor') ? 'var(--indoor)' : (DOT[s.split(' ')[0]] || 'var(--indoor)');
    const card = document.createElement('div');
    card.className = 'tcard'; card.dataset.surface = s; card.dataset.t = t;
    const has = YEARS.map(y => D[t + '|' + y]).filter(r => r && r[m] != null);
    let inner = `<div class="th"><i style="background:${dotc}"></i><span class="nm">${t}</span>`;
    if (has.length) {
      const lastY = YEARS.filter(y => D[t + '|' + y] && D[t + '|' + y][m] != null).pop();
      const lastV = D[t + '|' + lastY][m];
      const band = m === 'cpi' ? cpiBand(lastV) : null;
      inner += `<b${band != null ? ` class="b${band}"` : ' style="background:var(--rule);color:var(--ink2)"'}>${FMT[m](lastV)}<small style="font-weight:400"> ’${String(lastY).slice(2)}</small></b>`;
    }
    inner += '</div>';
    const svg = chartSVG(t, m, 290, 96);
    if (svg) { inner += svg.replaceAll('CL', dotc); card.classList.add('haschart'); }
    else inner += `<p style="color:var(--ink3);font-size:12px;padding:24px 0">Not enough data for a trend (needs 4+ seasons).</p>`;
    card.innerHTML = inner;
    grid.appendChild(card);
  });
  trendFilter();
}
renderTrends(metric);
document.querySelectorAll('#mtabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#mtabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); metric = b.dataset.m; renderTrends(metric);
});
})();
