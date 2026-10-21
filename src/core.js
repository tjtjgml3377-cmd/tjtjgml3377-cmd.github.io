'use strict';
/* =========================================================
   터무늬 부동산 인텔리전스 — 아산시 대시보드 core
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const nf = new Intl.NumberFormat('ko-KR');
const PY = 3.305785;
let D = null;            // 원본 데이터
const X = {};            // 가공 데이터
const CH = {};           // echarts 인스턴스
const MAPS = {};         // leaflet 지도

/* ---------- 숫자 포맷 ---------- */
const fN = (v, d = 0) => (v == null || !isFinite(v)) ? '–' : nf.format(+(+v).toFixed(d));
const fP = (v, d = 1) => (v == null || !isFinite(v)) ? '–' : (v > 0 ? '+' : '') + (+v).toFixed(d) + '%';
function fMan(v) {                 // 만원 → 억/만
  if (v == null || !isFinite(v)) return '–';
  v = Math.round(v);
  if (Math.abs(v) >= 10000) { const e = Math.trunc(v / 10000), r = Math.abs(v % 10000); return e + '억' + (r ? ' ' + nf.format(r) + '만' : ''); }
  return nf.format(v) + '만';
}
function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '억';
  if (a >= 1e4) return (v / 1e4).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만';
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + '천';
  return nf.format(Math.round(v * 100) / 100);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function delta(cur, base, isPct = false) {
  if (cur == null || base == null || !isFinite(cur) || !isFinite(base) || base === 0) return '<span>비교 불가</span>';
  const ch = isPct ? cur - base : (cur / base - 1) * 100;
  const cls = ch > 0 ? 'up' : ch < 0 ? 'dn' : '';
  const arrow = ch > 0 ? '▲' : ch < 0 ? '▼' : '■';
  return `<span class="${cls}">${arrow} ${isPct ? (ch > 0 ? '+' : '') + ch.toFixed(1) + '%p' : fP(ch)}</span>`;
}

/* ---------- 통계 ---------- */
const sum = a => { let s = 0; for (const v of a) s += v; return s; };
const mean = a => a.length ? sum(a) / a.length : null;
function sorted(a) { return Float64Array.from(a).sort(); }
function qs(s, p) { if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
const median = a => qs(sorted(a), .5);
function std(a) { const m = mean(a); return Math.sqrt(sum(a.map(v => (v - m) ** 2)) / Math.max(1, a.length - 1)); }
function ols(x, y) {
  const n = x.length; if (n < 3) return null;
  const mx = mean(x), my = mean(y); let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const b = sxy / sxx, a = my - b * mx, r2 = (sxy * sxy) / (sxx * syy);
  return { a, b, r2, n };
}
function pearson(x, y) {
  const p = []; for (let i = 0; i < x.length; i++) if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) p.push([x[i], y[i]]);
  if (p.length < 5) return null;
  const r = ols(p.map(v => v[0]), p.map(v => v[1])); return r ? Math.sign(r.b) * Math.sqrt(r.r2) : null;
}
function kde(vals, grid) {     // 가우시안 KDE, Silverman 대역폭
  const n = vals.length; if (n < 5) return grid.map(() => 0);
  const s = std(vals), srt = sorted(vals), iqr = qs(srt, .75) - qs(srt, .25);
  const h = 0.9 * Math.min(s, iqr / 1.34 || s) * Math.pow(n, -0.2) || 1;
  const step = Math.max(1, Math.floor(n / 3000));
  const sample = []; for (let i = 0; i < n; i += step) sample.push(vals[i]);
  const k = 1 / (sample.length * h * Math.sqrt(2 * Math.PI));
  return grid.map(g => { let t = 0; for (const v of sample) { const z = (g - v) / h; t += Math.exp(-.5 * z * z); } return t * k; });
}
function boxStats(a) {
  const s = sorted(a); if (s.length < 1) return null;
  const q1 = qs(s, .25), q2 = qs(s, .5), q3 = qs(s, .75), iqr = q3 - q1;
  let lo = s[0], hi = s[s.length - 1];
  for (const v of s) if (v >= q1 - 1.5 * iqr) { lo = v; break; }
  for (let i = s.length - 1; i >= 0; i--) if (s[i] <= q3 + 1.5 * iqr) { hi = s[i]; break; }
  return [lo, q1, q2, q3, hi];
}
function zs(a) {
  const v = a.filter(x => x != null && isFinite(x)); const m = mean(v), s = std(v) || 1;
  return a.map(x => x == null || !isFinite(x) ? 0 : (x - m) / s);
}
function pctRank(a) {
  const v = a.filter(x => x != null && isFinite(x)).sort((p, q) => p - q);
  return a.map(x => { if (x == null || !isFinite(x)) return null; let c = 0, e = 0; for (const y of v) { if (y < x) c++; else if (y === x) e++; } return Math.round((c + e / 2) / v.length * 100); });
}
function niceBins(lo, hi, n = 30) {
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const w = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  const start = Math.floor(lo / w) * w; const edges = []; for (let x = start; x <= hi + w; x += w) edges.push(x); return { w, edges };
}

/* ---------- 거리 ---------- */
function distM(lat0, lon0, lat, lon) {
  const k = Math.cos(lat0 * Math.PI / 180);
  const dx = (lon - lon0) * 111320 * k, dy = (lat - lat0) * 110574;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- 데이터 해제 ---------- */
async function loadData() {
  const bin = Uint8Array.from(atob(window.DZ), c => c.charCodeAt(0));
  window.DZ = null;
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다. 최신 크롬·엣지·사파리·파이어폭스를 사용해 주세요.');
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

/* ---------- 날짜/연도 ---------- */
const BASE_MS = Date.UTC(2021, 9, 1);
const AY = [2021, 2022, 2023, 2024, 2025];
const ayLabel = y => `${String(y).slice(2)}.10~${String(y + 1).slice(2)}.10`;
const ayShort = y => `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
const YM0 = { y: 2021, m: 10 };
const ymLabel = i => { const t = YM0.m - 1 + i; return `${YM0.y + Math.floor(t / 12)}.${String(t % 12 + 1).padStart(2, '0')}`; };

function prep() {
  const tx = D.tx, n = tx.t.length;
  const ay = new Int16Array(n), ym = new Int16Array(n), pp = new Float32Array(n), lat = new Float64Array(n), lon = new Float64Array(n), prec = new Uint8Array(n);
  const PREC = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const llat = tx.locs.lat.map(v => v / 1e5), llon = tx.locs.lon.map(v => v / 1e5), lpr = tx.locs.p.map(p => PREC[p]);
  for (let i = 0; i < n; i++) {
    const d = new Date(BASE_MS + tx.day[i] * 864e5), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    ay[i] = (m > 10 || (m === 10 && dd >= 21)) ? y : y - 1;
    ym[i] = (y - 2021) * 12 + (m - 10);
    const area = tx.ar[i] / 10;
    pp[i] = area > 0 ? tx.a[i] / (area / PY) : NaN;
    const L = tx.loc[i]; lat[i] = llat[L]; lon[i] = llon[L]; prec[i] = lpr[L];
  }
  X.tx = { n, ay, ym, pp, lat, lon, prec, nYM: Math.max(...ym) + 1 };
  // 단지
  const c = tx.cxs; X.cx = c.n.map((nm, i) => ({ i, n: nm, b: c.b[i], t: c.t[i], lat: c.lat[i] / 1e5, lon: c.lon[i] / 1e5, d: c.d[i], road: c.road[i], jb: c.jb[i], by: c.by[i], p: c.p[i] }));
  // 인구
  const P = D.pop, nc = P.gid.length, NA = P.ages.length, NY = P.years.length;
  X.pop = { nc, NA, NY, lat: P.lat.map(v => v / 1e5), lon: P.lon.map(v => v / 1e5), d: P.d, v: P.v };
  X.popAt = (c, yi, s, a) => P.v[c][(yi * 2 + s) * NA + a];
  // 국민연금
  const N = D.nps, nn = N.m.length;
  N.inds = N.inds.map(v => v === 'BIZ_NO미존재사업장' ? '미분류(사업자번호 없음)' : v);
  X.nps = { n: nn, lat: Float64Array.from(N.loc, L => N.locs.lat[L] / 1e5), lon: Float64Array.from(N.loc, L => N.locs.lon[L] / 1e5), prec: Uint8Array.from(N.loc, L => PREC[N.locs.p[L]]) };
  // 상가
  const S = D.st; X.st = { n: S.lat.length, lat: S.lat.map(v => v / 1e5), lon: S.lon.map(v => v / 1e5), d: S.d };
  X.stCol = f => S.cols[f];
  X.stVal = (f, i) => { const c = S.cols[f]; return c.v[c.c[i]]; };
}

/* ---------- 공통 차트 ---------- */
const FONT = '"Pretendard Variable",Pretendard,system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif';
const SER = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => css('--s' + i));
const SEQ = () => [1, 2, 3, 4, 5, 6, 7].map(i => css('--q' + i));
function TK() { return { ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), grid: css('--grid'), axis: css('--axis'), surf: css('--surface'), tip: css('--tip-bg'), border: css('--border'), other: css('--other') }; }
function chart(id) {
  const el = document.getElementById(id); if (!el) return null;
  if (CH[id] && CH[id].getDom() === el) return CH[id];
  CH[id] = echarts.init(el, null, { renderer: 'canvas' });
  new ResizeObserver(() => CH[id] && CH[id].resize()).observe(el);
  return CH[id];
}
function base(o = {}) {
  const t = TK();
  return Object.assign({
    backgroundColor: 'transparent', animationDuration: 350,
    textStyle: { fontFamily: FONT, color: t.ink2, fontSize: 12 },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: t.tip, borderColor: t.border, borderWidth: 1, textStyle: { color: t.ink, fontSize: 12, fontFamily: FONT }, axisPointer: { type: 'line', lineStyle: { color: t.axis } }, extraCssText: 'box-shadow:0 6px 20px rgba(0,0,0,.12);border-radius:8px;' },
    grid: { left: 12, right: 16, top: 30, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12 } },
  }, o);
}
function xCat(data, o = {}) { const t = TK(); return Object.assign({ type: 'category', data, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 11, hideOverlap: true } }, o); }
function yVal(o = {}) { const t = TK(); return Object.assign({ type: 'value', splitLine: { lineStyle: { color: t.grid, width: 1 } }, axisLabel: { color: t.muted, fontSize: 11, formatter: compact }, axisLine: { show: false }, axisTick: { show: false }, nameTextStyle: { color: t.muted, fontSize: 11 } }, o); }
function setOpt(id, opt) { const c = chart(id); if (!c) return; c.setOption(opt, true); return c; }
function emptyChart(id, msg = '조건에 맞는 데이터가 없습니다') {
  setOpt(id, base({ graphic: { type: 'text', left: 'center', top: 'middle', style: { text: msg, fill: TK().muted, fontSize: 13, fontFamily: FONT } }, xAxis: { show: false }, yAxis: { show: false }, series: [] }));
}
const barStyle = (color, horiz = false) => ({ color, borderRadius: horiz ? [0, 4, 4, 0] : [4, 4, 0, 0] });
function divergingColor(v, max) {
  const t = Math.max(-1, Math.min(1, v / (max || 1)));
  const neg = css('--dv-neg'), pos = css('--dv-pos'), mid = css('--dv-mid');
  return mix(mid, t < 0 ? neg : pos, Math.abs(t));
}
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function seqColor(v, lo, hi) { const s = SEQ(); if (!(hi > lo)) return s[3]; const t = Math.max(0, Math.min(.9999, (v - lo) / (hi - lo))); return s[Math.floor(t * s.length)]; }

/* ---------- 표 ---------- */
function renderTable(el, cols, rows, opt = {}) {
  // cols: [{k, l, n(bool numeric), f(format)}]
  const st = el._sort || { k: opt.sortKey || cols[0].k, asc: opt.asc ?? false };
  el._sort = st;
  const rs = rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (st.asc ? 1 : -1); });
  const lim = opt.limit || 1000;
  let h = '<table class="t"><thead><tr>' + cols.map(c => `<th data-k="${c.k}" class="${c.n ? 'n ' : ''}${st.k === c.k ? 'sorted ' + (st.asc ? 'asc' : '') : ''}">${c.l}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of rs.slice(0, lim)) h += `<tr data-id="${esc(r._id ?? '')}" class="${opt.sel != null && r._id === opt.sel ? 'sel' : ''}">` + cols.map(c => `<td class="${c.n ? 'n' : ''}"${c.n || c.f ? '' : ` title="${esc(r[c.k] ?? '')}"`}>${c.f ? c.f(r[c.k], r) : esc(r[c.k] ?? '–')}</td>`).join('') + '</tr>';
  h += '</tbody></table>';
  if (rs.length > lim) h += `<div class="note" style="padding:6px 9px">상위 ${nf.format(lim)}개만 표시 (전체 ${nf.format(rs.length)}개)</div>`;
  el.innerHTML = h;
  $$('th', el).forEach(th => th.onclick = () => { const k = th.dataset.k; el._sort = { k, asc: st.k === k ? !st.asc : false }; renderTable(el, cols, rows, opt); });
  if (opt.onRow) $$('tbody tr', el).forEach(tr => tr.onclick = () => opt.onRow(tr.dataset.id));
}
function kpiHTML(items) {
  return items.map(k => `<div class="kpi"><div class="l" title="${esc(k.l)}">${k.l}</div><div class="v">${k.v}${k.u ? `<small>${k.u}</small>` : ''}</div><div class="d">${k.d || '&nbsp;'}</div></div>`).join('');
}

/* ---------- 선택 상자 ---------- */
function fillSelect(el, items, val) { el.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); if (val != null) el.value = val; }
function segInit(el, items, val, cb) {
  if (items) el.innerHTML = items.map(([v, l]) => `<button data-v="${esc(v)}">${esc(l)}</button>`).join('');
  const btns = $$('button', el); if (val != null) btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(val)));
  btns.forEach(b => b.onclick = () => { btns.forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); });
}
const segVal = el => ($('button.on', el) || {}).dataset?.v;
const dongOpts = (all = '아산시 전체') => [['-1', all], ...D.dongs.map((d, i) => [String(i), d])];
const AREA_BANDS = [['all', '전체'], ['0-60', '60㎡ 이하 (소형)'], ['60-85', '60~85㎡ (중소형)'], ['85-135', '85~135㎡ (중대형)'], ['135-99999', '135㎡ 초과 (대형)']];
function inArea(band, a) { if (band === 'all') return true; const [lo, hi] = band.split('-').map(Number); return a > lo && a <= hi || (lo === 0 && a <= hi); }

/* ---------- 터보(Turbo) 색상표 — d3-scale-chromatic interpolateTurbo 공식 ---------- */
function turbo(t) {
  t = Math.max(0, Math.min(1, t));
  return 'rgb(' + Math.max(0, Math.min(255, Math.round(34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05))))))) + ','
    + Math.max(0, Math.min(255, Math.round(23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56))))))) + ','
    + Math.max(0, Math.min(255, Math.round(27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66))))))) + ')';
}
// vals → 색 함수. sqrt: 건수·인구처럼 한쪽으로 쏠린 값, sym: 증감(0=초록 중심, 파랑=감소, 빨강=증가)
function turboScale(vals, o = {}) {
  const v = vals.filter(x => x != null && isFinite(x));
  if (!v.length) return { f: () => turbo(.5), lo: 0, hi: 0, sym: !!o.sym };
  if (o.sym) { const m = qs(sorted(v.map(Math.abs)), .95) || Math.max(...v.map(Math.abs)) || 1; return { f: x => turbo(.5 + Math.max(-1, Math.min(1, x / m)) / 2), lo: -m, hi: m, sym: true }; }
  const s = sorted(v); let lo = o.lo ?? qs(s, .02), hi = o.hi ?? qs(s, .98); if (!(hi > lo)) { lo = s[0]; hi = s[s.length - 1]; if (!(hi > lo)) hi = lo + 1; }
  const tf = o.sqrt ? x => Math.sqrt(Math.max(0, x)) : x => x, a = tf(lo), b = tf(hi);
  return { f: x => turbo((tf(x) - a) / (b - a)), lo, hi, sym: false };
}
function turboLegend(title, sc, fmt = v => fN(v), note = '') {
  const stops = Array.from({ length: 11 }, (_, i) => turbo(i / 10)).join(',');
  return `<b>${title}</b><div style="height:10px;width:190px;border-radius:3px;margin:6px 0 3px;background:linear-gradient(90deg,${stops})"></div>`
    + `<div style="display:flex;justify-content:space-between;gap:8px;font-variant-numeric:tabular-nums"><span>${sc.sym ? '▼ ' : '≤ '}${fmt(sc.lo)}</span>${sc.sym ? '<span>0</span>' : ''}<span>${sc.sym ? '▲ +' : '≥ '}${fmt(sc.hi)}</span></div>`
    + (sc.sym ? '<div style="color:var(--muted)">파랑=감소 · 초록=변화 없음 · 빨강=증가</div>' : '') + (note ? `<div style="color:var(--muted);margin-top:2px">${note}</div>` : '');
}
/* 실거래 위치별 집계 → 지도 원 표시 (원 크기=건수, 색=지표) */
function txLocAgg(idx, valFn) {
  const T = D.tx, m = new Map();
  for (const i of idx) { const L = T.loc[i]; let o = m.get(L); if (!o) m.set(L, o = { L, n: 0, v: [], cx: new Map(), i0: i }); o.n++; if (valFn) { const v = valFn(i); if (v != null && isFinite(v)) o.v.push(v); } if (T.cx[i] >= 0) o.cx.set(T.cx[i], (o.cx.get(T.cx[i]) || 0) + 1); }
  return m;
}
const locLL = L => [D.tx.locs.lat[L] / 1e5, D.tx.locs.lon[L] / 1e5];
function locName(o) {
  if (o.cx.size) return [...o.cx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${esc(X.cx[c].n)} (${n})`).join('<br>');
  const T = D.tx, i = o.i0; return esc(D.tx.beops[T.b[i]]) + ' 일대 <span style="color:var(--muted)">(번지 비공개 · 도로 단위 위치)</span>';
}
function aggVal(o, agg) { if (agg === 'count') return o.n; if (!o.v.length) return null; return agg === 'mean' ? mean(o.v) : median(o.v); }
function drawLocMap(m, agg, metric, opt = {}) {      // agg: Map from txLocAgg
  if (m._pts) m.removeLayer(m._pts);
  const rows = [...agg.values()].map(o => ({ o, v: aggVal(o, metric.agg) })).filter(r => r.v != null && (metric.agg !== 'mean' || r.o.v.length >= (metric.minN || 1)));
  const g = L.layerGroup(); m._pts = g;
  if (!rows.length) { g.addTo(m); legendCtl(m, '<b>조건에 맞는 거래가 없습니다</b>'); return rows; }
  const sc = opt.scale || turboScale(rows.map(r => r.v), { sqrt: metric.agg === 'count' || metric.sqrt, sym: metric.sym });
  const mxN = Math.max(...rows.map(r => r.o.n));
  rows.sort((a, b) => b.o.n - a.o.n);
  for (const r of rows) {
    L.circleMarker(locLL(r.o.L), { radius: 4 + 13 * Math.sqrt(r.o.n / mxN), color: css('--surface'), weight: 1, fillColor: sc.f(r.v), fillOpacity: .85 })
      .bindPopup(() => `${locName(r.o)}<br><b>${metric.l}: ${metric.fmt ? metric.fmt(r.v) : fN(r.v)}</b><br>거래 ${fN(r.o.n)}건 · 위치 정밀도 ${D.tx.locs.p[r.o.L]}`).addTo(g);
  }
  g.addTo(m);
  legendCtl(m, turboLegend(metric.l, sc, metric.fmt || (v => fN(v)), '원 크기 = 거래 건수'));
  if (opt.fit && rows.length) m.fitBounds(L.latLngBounds(rows.map(r => locLL(r.o.L))).pad(.12), { maxZoom: 15 });
  return rows;
}
function dongBounds(d) { const f = D.bnd.features.find(x => x.properties.d === d); return f ? L.geoJSON(f).getBounds() : null; }

/* ---------- 지도 ---------- */
// 브이월드 인증키: 페이지의 [반경 분석 > 고급]에서 다른 키를 입력하면 그 키가 우선합니다(이 브라우저에만 저장).
const VWORLD_KEY_DEFAULT = '';   // 공개 저장소: 키 비움 (개인용 빌드는 VWORLD_KEY 환경변수로 주입)
function vkey() { try { return (localStorage.getItem('termuni_vkey') || '').trim() || VWORLD_KEY_DEFAULT; } catch (e) { return VWORLD_KEY_DEFAULT; } }
const VW_ATT = '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noopener">국토교통부 브이월드</a>';
const BASE_LIGHT = '브이월드 일반', BASE_DARK = '브이월드 야간', FB_LIGHT = '밝은 지도 (CARTO)', FB_DARK = '어두운 지도 (CARTO)';
function tileLayers() {
  const K = vkey();
  const vw = (n, ext) => L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${K}/${n}/{z}/{y}/{x}.${ext}`, { attribution: VW_ATT, maxZoom: 19, minZoom: 6 });
  const att = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
  const vwl = K ? {
    '브이월드 일반': vw('Base', 'png'),
    '브이월드 회색': vw('white', 'png'),
    '브이월드 야간': vw('midnight', 'png'),
    '브이월드 위성': vw('Satellite', 'jpeg'),
    '브이월드 위성+지명': L.layerGroup([vw('Satellite', 'jpeg'), vw('Hybrid', 'png')]),
  } : {};
  return Object.assign(vwl, {
    [FB_LIGHT]: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: att, maxZoom: 19, subdomains: 'abcd' }),
    [FB_DARK]: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: att, maxZoom: 19, subdomains: 'abcd' }),
    '오픈스트리트맵': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }),
  });
}
function overlayLayers() {
  if (!vkey()) return {};
  return {
    '지적도 (브이월드 · 확대 시 표시)': L.tileLayer.wms('https://api.vworld.kr/req/wms', {
      layers: 'lp_pa_cbnd_bubun,lp_pa_cbnd_bonbun', styles: 'lp_pa_cbnd_bubun_line,lp_pa_cbnd_bonbun_line',
      format: 'image/png', transparent: true, version: '1.3.0', key: vkey(), minZoom: 15, maxZoom: 19, opacity: .85, attribution: VW_ATT,
    }),
  };
}
function mapNotice(m, msg) {
  if (m._note) m.removeControl(m._note);
  const c = L.control({ position: 'bottomright' }); c.onAdd = () => { const d = L.DomUtil.create('div', 'mlegend'); d.style.borderColor = 'var(--warning)'; d.innerHTML = '⚠ ' + msg; return d; }; c.addTo(m); m._note = c;
  setTimeout(() => { if (m._note === c) { m.removeControl(c); m._note = null; } }, 9000);
}
function useBase(m, name) {
  if (m._cur && m._tl[m._cur]) m.removeLayer(m._tl[m._cur]);
  const layer = m._tl[name]; layer.addTo(m); m._cur = name;
  if (name.startsWith('브이월드') && layer.on) {             // 브이월드 타일이 계속 실패하면 CARTO로 자동 전환
    let ok = 0, err = 0;
    layer.off('tileload tileerror');
    layer.on('tileload', () => ok++);
    layer.on('tileerror', () => { err++; if (err >= 8 && ok === 0 && m._cur === name) { useBase(m, isDark() ? FB_DARK : FB_LIGHT); mapNotice(m, '브이월드 지도를 불러오지 못해 기본 지도로 바꿨습니다 (인증키·인터넷 확인)'); } });
  }
}
L.Path.prototype.options.bubblingMouseEvents = false;   // 원·격자 클릭(상세 보기)은 반경 지정으로 번지지 않음
let FEAT_CLICK = 0;                                         // 도형·마커를 누른 직후의 지도 클릭은 무시
L.Path.addInitHook(function () { this.on('click', () => { FEAT_CLICK = Date.now(); }); });
L.Marker.addInitHook(function () { this.on('click', () => { FEAT_CLICK = Date.now(); }); });
function makeMap(id, opt = {}) {
  if (MAPS[id]) { setTimeout(() => MAPS[id].invalidateSize(), 30); return MAPS[id]; }
  const m = L.map(id, { preferCanvas: true, zoomControl: true, attributionControl: true }).setView(opt.center || [36.795, 127.01], opt.zoom || 11);
  m._tl = tileLayers(); useBase(m, vkey() ? (isDark() ? BASE_DARK : BASE_LIGHT) : (isDark() ? FB_DARK : FB_LIGHT));
  L.control.layers(m._tl, overlayLayers(), { position: 'topright', collapsed: true }).addTo(m);
  m.on('baselayerchange', e => { m._cur = e.name; });
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m);
  if (opt.bnd !== false) {
    m._bnd = L.geoJSON(D.bnd, { style: () => ({ color: css('--ink-2'), weight: 1, opacity: .55, fill: false, interactive: false }) }).addTo(m);
  }
  m.on('click', e => { if (!GEOF.click || Date.now() - FEAT_CLICK < 400 || (e.originalEvent && e.originalEvent._stopped)) return; setGeo(e.latlng.lat, e.latlng.lng, { k: '지도', label: `지도 클릭 (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`, prec: '-' }); });
  if (GEOF.on) m.fitBounds(L.latLng(GEOF.lat, GEOF.lon).toBounds(GEOF.R * 2.4), { animate: false });
  MAPS[id] = m; geoDraw(m); setTimeout(() => m.invalidateSize(), 50);
  return m;
}
function isDark() { const t = document.documentElement.dataset.theme; if (t) return t === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function legendCtl(m, html) {
  if (m._leg) m.removeControl(m._leg);
  const c = L.control({ position: 'bottomleft' }); c.onAdd = () => { const d = L.DomUtil.create('div', 'mlegend'); d.innerHTML = html; return d; }; c.addTo(m); m._leg = c;
}

/* ---------- 전체 공통 반경 필터 ---------- */
// 켜지면 모든 탭이 '중심점 반경 R 안' 데이터만으로 분석됩니다. 실거래·사업장은 위치 정밀도(prec) 조건도 함께 적용.
const GEOF = { on: false, lat: null, lon: null, R: 500, info: null, prec: new Set(['A', 'B', 'C']), click: true };
const RADII = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
const rLabel = r => r >= 1000 ? (r / 1000).toFixed(1).replace('.0', '') + 'km' : r + 'm';
const gCell = c => !GEOF.on || X.gm.cell[c], gTx = i => !GEOF.on || X.gm.tx[i], gNps = i => !GEOF.on || X.gm.nps[i], gSt = i => !GEOF.on || X.gm.st[i], gCx = c => !GEOF.on || X.gm.cx[c];
function computeGeoMask() {
  const { lat, lon, R } = GEOF, k = Math.cos(lat * Math.PI / 180), R2 = R * R, PR = 'ABCDE';
  const inR = (la, lo) => { const dx = (lo - lon) * 111320 * k, dy = (la - lat) * 110574; return dx * dx + dy * dy <= R2; };
  const cell = Uint8Array.from(X.pop.lat, (la, i) => inR(la, X.pop.lon[i]));
  const st = Uint8Array.from(X.st.lat, (la, i) => inR(la, X.st.lon[i]));
  const tl = D.tx.locs, tlIn = Uint8Array.from(tl.lat, (la, i) => inR(la / 1e5, tl.lon[i] / 1e5) && GEOF.prec.has(tl.p[i]));
  const tx = Uint8Array.from(D.tx.loc, L => tlIn[L]);
  const nl = D.nps.locs, nlIn = Uint8Array.from(nl.lat, (la, i) => inR(la / 1e5, nl.lon[i] / 1e5) && GEOF.prec.has(nl.p[i]));
  const nps = Uint8Array.from(D.nps.loc, L => nlIn[L]);
  const cx = Uint8Array.from(X.cx, x => inR(x.lat, x.lon) && GEOF.prec.has(x.p));
  X.gm = { cell, st, tx, nps, cx };
}
function geoDraw(m) {
  const maps = m ? [m] : Object.values(MAPS);
  for (const mp of maps) {
    if (mp._geo) { mp.removeLayer(mp._geo); mp._geo = null; }
    if (!GEOF.on) continue;
    const g = L.layerGroup([
      L.circle([GEOF.lat, GEOF.lon], { radius: GEOF.R, color: '#d03b3b', weight: 2.5, dashArray: null, fill: true, fillOpacity: .03, interactive: false }),
      L.circleMarker([GEOF.lat, GEOF.lon], { radius: 6, color: '#fff', weight: 3, fillColor: '#d03b3b', fillOpacity: 1, interactive: false }),
    ]);
    g.addTo(mp); mp._geo = g;
  }
}
function geoStatus() {
  const bar = $('#geobar'); if (!bar) return;
  bar.classList.toggle('on', GEOF.on); $('#g-off').style.display = GEOF.on ? '' : 'none'; $('#g-r').value = GEOF.R;
  $('#g-st').innerHTML = GEOF.on
    ? `<b>적용 중</b> · ${esc((GEOF.info && GEOF.info.label) || '')} 반경 <b>${rLabel(GEOF.R)}</b><span class="gst-more"> — 모든 탭이 이 반경 안 데이터로 분석됩니다 <span style="color:var(--muted)">(실거래·사업장 정밀도 ${[...GEOF.prec].sort().join('·')})</span></span>`
    : '꺼짐<span class="gst-more"> · 주소를 입력하거나 <b>아무 탭의 지도나 클릭</b>하면 모든 탭이 반경 안 분석으로 바뀝니다</span>';
  $$('.gonly').forEach(e => e.style.display = GEOF.on ? '' : 'none');
  $$('.gchip').forEach(e => { e.style.display = GEOF.on ? '' : 'none'; e.innerHTML = GEOF.on ? `📍 반경 필터 적용 중: ${esc((GEOF.info && GEOF.info.label) || '')} · ${rLabel(GEOF.R)}` : ''; });
}
function geoRefresh(fly) {
  if (GEOF.on) computeGeoMask();
  geoDraw(); geoStatus();
  Object.values(VIEWS).forEach(V => { V._stale = true; });
  renderActive();
  if (fly && GEOF.on) { const b = L.latLng(GEOF.lat, GEOF.lon).toBounds(GEOF.R * 2.4); Object.values(MAPS).forEach(m => { if (m.getContainer().offsetParent) m.fitBounds(b, { animate: false }); }); }
}
function setGeo(lat, lon, info, fly = false) { Object.assign(GEOF, { on: true, lat, lon, info: info || { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}` } }); if (VIEWS.rad._init) VIEWS.rad.moved = true; geoRefresh(fly); }
function setGeoR(r) { GEOF.R = r; if (GEOF.on) geoRefresh(false); else geoStatus(); if (VIEWS.rad._init) VIEWS.rad.syncR(); }
function clearGeo() { GEOF.on = false; geoRefresh(false); }

/* 주소·단지·상호 자동완성 (브이월드로 주소 좌표 정밀화) */
function resolvePick(c) {
  if (c.vw || ((c.k === '도로명' || c.k === '지번') && vkey()))
    return GEO.vworld(c.vw ? c.q : c.label, vkey()).catch(err => { if (c.vw) throw err; return Object.assign({}, c, { sub: (c.sub || '') + ' · 브이월드 확인 실패, 데이터 기준 근사' }); });
  return Promise.resolve(c);
}
function attachSearch(inp, sug, onPick, onMsg = () => { }) {
  let cur = [], on = -1, tm;
  const draw = () => {
    sug.innerHTML = cur.map((c, k) => `<div data-k="${k}" class="${k === on ? 'on' : ''}"><span class="k">${esc(c.k)}</span><span>${esc(c.label)}</span><span class="a">${esc(c.sub || '')}${c.prec ? ' · 정밀도 ' + c.prec : ''}</span></div>`).join('') || (inp.value.trim() ? '<div><span class="a" style="max-width:none;margin:0">일치하는 결과가 없습니다. 도로명+건물번호 또는 동·리+번지로 입력해 보세요</span></div>' : '');
    sug.style.display = sug.innerHTML ? 'block' : 'none';
    $$('div[data-k]', sug).forEach(d => d.onmousedown = e => { e.preventDefault(); pick(cur[+d.dataset.k]); });
  };
  const pick = c => {
    sug.style.display = 'none'; inp.value = c.label; onMsg('위치를 확인하는 중…');
    resolvePick(c).then(v => { inp.value = v.label; onMsg(''); onPick(v); }).catch(err => onMsg(`<span class="dn">브이월드 검색 결과 없음 (${esc(err.message)})</span> — 단지명·상호명으로 검색하거나 지도를 클릭하세요.`));
  };
  inp.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { const q = inp.value.trim(); cur = GEO.search(q); if (vkey() && q.length >= 3 && /\d/.test(q) && !cur.some(c => c.k === '도로명' || c.k === '지번')) cur.unshift({ k: '브이월드', label: `'${q}' 주소 검색`, sub: '브이월드 지오코딩', prec: 'A', vw: true, q }); on = -1; draw(); }, 120); };
  inp.onkeydown = e => {
    if (e.key === 'ArrowDown') { on = Math.min(cur.length - 1, on + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { on = Math.max(0, on - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (cur.length) pick(cur[Math.max(0, on)]); else if (inp.value.trim()) { if (vkey()) pick({ k: '브이월드', label: inp.value.trim(), q: inp.value.trim(), vw: true }); else onMsg('데이터에 없는 주소입니다. 브이월드 인증키를 [반경 분석 › 고급]에 넣으면 모든 주소를 검색할 수 있어요.'); } }
    else if (e.key === 'Escape') sug.style.display = 'none';
  };
  inp.onblur = () => setTimeout(() => sug.style.display = 'none', 150); inp.onfocus = () => { if (cur.length) draw(); };
}
function initGeoBar() {
  fillSelect($('#g-r'), RADII.map(r => [r, '반경 ' + rLabel(r)]), GEOF.R);
  $('#g-r').onchange = () => setGeoR(+$('#g-r').value);
  $('#g-off').onclick = () => { $('#g-q').value = ''; clearGeo(); };
  $('#g-click').onchange = () => { GEOF.click = $('#g-click').checked; };
  attachSearch($('#g-q'), $('#g-sug'), v => setGeo(v.lat, v.lon, v, true), msg => { if (msg) $('#g-st').innerHTML = msg; else geoStatus(); });
  geoStatus();
}

/* ---------- 탭 ---------- */
const VIEWS = {};
let CUR = 'ov';
const TAB_META = [
  { id: 'ov', ic: '📊', t: '종합 개요', en: 'Overview' }, { id: 'pop', ic: '👥', t: '인구 구조', en: 'Population' },
  { id: 'sale', ic: '🏢', t: '매매 시장', en: 'Sales' }, { id: 'rent', ic: '🔑', t: '전월세 시장', en: 'Rental' },
  { id: 'job', ic: '🏭', t: '일자리·사업장', en: 'Jobs' }, { id: 'store', ic: '🏪', t: '상권 분석', en: 'Commercial' },
  { id: 'cmp', ic: '🆚', t: '연도 비교', en: 'Compare' }, { id: 'rad', ic: '🎯', t: '반경 분석', en: 'Radius' },
  { id: 'meth', ic: 'ℹ️', t: '데이터·방법론', en: 'Methodology' }];
const ANALYSIS = TAB_META.map(t => t.id);
let ALL_IO = null;
function renderActive() {
  if (CUR === 'all') { ANALYSIS.forEach(k => { const V = VIEWS[k]; if (V && V._init && V._allShown) V.render(); }); return; }
  const V = VIEWS[CUR]; if (V && V._init) V.render();
}
function buildAllHeads() {
  TAB_META.forEach((t, i) => {
    const sec = $('#v-' + t.id); if (!sec || $('.allhead', sec)) return;
    const h = document.createElement('div'); h.className = 'allhead';
    h.innerHTML = `<span class="ah-n">${String(i + 1).padStart(2, '0')} / 09</span><span class="ah-ic">${t.ic}</span><b>${t.t}</b><small>${t.en}</small><span style="flex:1"></span><button class="icon-btn" data-go="${t.id}">이 탭만 크게 보기 →</button>`;
    sec.prepend(h); $('button', h).onclick = () => show(t.id);
  });
}
function enterAll() {
  document.body.classList.add('allmode'); buildAllHeads();
  $$('.view').forEach(s => s.classList.toggle('on', s.id !== 'v-home'));
  ANALYSIS.forEach(k => { VIEWS[k]._allShown = false; });
  if (!ALL_IO) ALL_IO = new IntersectionObserver(es => {
    if (CUR !== 'all') return;
    es.forEach(e => {
      if (!e.isIntersecting) return; const V = VIEWS[e.target.id.slice(2)]; if (!V || V._allShown) return;
      V._allShown = true; if (!V._init) { V.init(); V._init = true; } V.render();
      setTimeout(() => Object.values(MAPS).forEach(m => { if (m.getContainer().offsetParent) m.invalidateSize(); }), 80);
    });
  }, { rootMargin: '500px 0px' });
  ANALYSIS.forEach(k => ALL_IO.observe($('#v-' + k)));
}
function show(v, opt = {}) {
  CUR = v;
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
  if (v === 'all') enterAll();
  else {
    document.body.classList.remove('allmode');
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
    const V = VIEWS[v];
    if (V) { if (!V._init) { V.init(); V._init = true; } V.render(); }
  }
  Object.values(MAPS).forEach(m => setTimeout(() => { if (!m.getContainer().offsetParent) return; m.invalidateSize(); m.panBy([1, 0], { animate: false }); m.panBy([-1, 0], { animate: false }); }, 60));
  try { history.replaceState(null, '', '#' + v); } catch (e) { }
  if (!opt.keepScroll) window.scrollTo({ top: 0 });
  const tb = $(`.tab[data-v="${v}"]`); if (tb && tb.scrollIntoView) tb.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function rerenderAll() {
  Object.keys(CH).forEach(k => { try { CH[k].dispose(); } catch (e) { } delete CH[k]; });
  Object.values(MAPS).forEach(m => {
    const pair = [[BASE_LIGHT, BASE_DARK], [FB_LIGHT, FB_DARK]].find(p => p.includes(m._cur));
    if (pair) { const want = pair[isDark() ? 1 : 0]; if (m._cur !== want) useBase(m, want); }
    if (m._bnd) m._bnd.setStyle({ color: css('--ink-2') });
  });
  Object.values(VIEWS).forEach(V => { V._dirty = true; });
  renderActive();
}
