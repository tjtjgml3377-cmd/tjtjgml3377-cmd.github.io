/* =================== 🏠 홈 (메인 화면) =================== */
const HOME_TABS = {
  ov: { d: '17개 읍면동의 수요(사람·일자리)와 가격·거래를 한 화면에서 비교합니다.', li: ['KPI 8종 · 유망 입지 스코어', '수요 vs 가격 포지셔닝 · 상관행렬'] },
  pop: { d: '100m 격자 성별·연령 인구로 주택 수요의 이동을 봅니다.', li: ['두 연도 겹친 인구 피라미드', '격자 인구·증감 지도'] },
  sale: { d: '매매를 가격지수·지도·통계 그래프로 분석합니다.', li: ['동일단지 체인 가격지수', '실거래 지도 · 단지 랭킹'] },
  rent: { d: '전세·월세·갱신 흐름으로 임대 시장의 체온을 잽니다.', li: ['월세화 추이 · 전월세 지도', '전세가율 주의 단지'] },
  job: { d: '국민연금 사업장으로 종사자·업종·추정 소득을 봅니다.', li: ['업종 트리맵 · 고용 회전', '사업장 지도와 목록'] },
  store: { d: '상가정보 37개 필드를 골라 분포·교차·지도로 탐색합니다.', li: ['선버스트 · 입지계수 · 다양성', '조건 검색 · CSV 내려받기'] },
  cmp: { d: '같은 지표를 두 시점으로 나란히 놓고 변화를 봅니다.', li: ['25 vs 22 등 프리셋', 'A·B·변화 지도 · 덤벨 차트'] },
  rad: { d: '주소나 지도 클릭으로 반경 100m~2km 안을 분석합니다.', li: ['반경별 프로파일(100m 간격)', '반경 리포트 인쇄'] },
  meth: { d: '출처·처리 방법·위치 오차 실측·지표 정의를 공개합니다.', li: ['위치 정밀도 A~E 실측 오차', '지표 사전'] },
};
/* 아산 경계에 맞춘 투영 */
function asanProj(w, h, pad) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
  D.bnd.features.forEach(f => walk(f.geometry.coordinates));
  const k = Math.cos(36.8 * Math.PI / 180), sx = (x1 - x0) * k, sy = y1 - y0, s = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
  const ox = (w - sx * s) / 2, oy = (h - sy * s) / 2;
  const P = (lon, lat) => [ox + (lon - x0) * k * s, oy + (y1 - lat) * s];
  P.mPx = s / 110574;           // 1m 당 픽셀
  return P;
}
function drawArt(cv, kind) {
  if (!cv || !cv.clientWidth) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const P = asanProj(w, h, Math.max(8, w * .025));
  // 경계
  g.lineWidth = 1; g.strokeStyle = 'rgba(214,236,232,.30)'; g.fillStyle = 'rgba(255,255,255,.025)';
  const ring = r => { r.forEach((c, i) => { const [x, y] = P(c[0], c[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  D.bnd.features.forEach(f => { g.beginPath(); const gm = f.geometry; (gm.type === 'Polygon' ? [gm.coordinates] : gm.coordinates).forEach(poly => poly.forEach(ring)); g.fill(); g.stroke(); });
  const cell = Math.max(2.6, 140 * P.mPx);
  if (kind === 'pop' || kind === 'chg') {
    const val = c => { let s = 0; for (let a = 0; a < 13; a++) s += X.popAt(c, 4, 0, a) + X.popAt(c, 4, 1, a); return s; };
    const v0 = c => { let s = 0; for (let a = 0; a < 13; a++) s += X.popAt(c, 0, 0, a) + X.popAt(c, 0, 1, a); return s; };
    const vals = []; for (let c = 0; c < X.pop.nc; c++) vals.push(kind === 'pop' ? val(c) : val(c) - v0(c));
    const sc = kind === 'pop' ? turboScale(vals.filter(v => v > 0), { sqrt: true }) : turboScale(vals.filter(v => v !== 0), { sym: true });
    g.globalAlpha = .92;
    for (let c = 0; c < X.pop.nc; c++) { const v = vals[c]; if (kind === 'pop' ? v <= 0 : v === 0) continue; const [x, y] = P(X.pop.lon[c], X.pop.lat[c]); g.fillStyle = sc.f(v); g.fillRect(x - cell / 2, y - cell / 2, cell, cell); }
  } else if (kind === 'store') {
    const L1 = X.stCol('상권업종대분류명'), cnt = new Map(); for (const v of L1.c) cnt.set(v, (cnt.get(v) || 0) + 1);
    const order = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const pal = ['#3987e5', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4ec94e', '#9085e9'], col = new Map(order.map((v, j) => [v, j < 7 ? pal[j] : '#8a8a84']));
    g.globalAlpha = .85; const r = Math.max(1.5, w / 300);
    for (let i = 0; i < X.st.n; i++) { const [x, y] = P(X.st.lon[i], X.st.lat[i]); g.fillStyle = col.get(L1.c[i]); g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
  } else if (kind === 'price') {
    const T = D.tx, idx = []; for (let i = 0; i < X.tx.n; i++) if (T.t[i] === 0 && T.k[i] === 0 && !(T.f[i] & 1) && X.tx.ay[i] >= 2024) idx.push(i);
    const rows = [...txLocAgg(idx, i => X.tx.pp[i]).values()].map(o => ({ o, v: median(o.v) })).filter(r => r.v != null).sort((a, b) => b.o.n - a.o.n);
    const sc = turboScale(rows.map(r => r.v)), mx = Math.max(...rows.map(r => r.o.n));
    g.globalAlpha = .85;
    for (const r of rows) { const [la, lo] = locLL(r.o.L), [x, y] = P(lo, la); g.fillStyle = sc.f(r.v); g.beginPath(); g.arc(x, y, Math.max(2.4, (w / 55) * Math.sqrt(r.o.n / mx)), 0, 6.283); g.fill(); }
  }
  g.globalAlpha = 1;
}
VIEWS.home = {
  init() {
    // 9개 탭 카드
    $('#h-tabs').innerHTML = TAB_META.map((t, i) => `<div class="h-card${t.id === 'rad' ? ' feat' : ''}">
      ${t.id === 'rad' ? '<span class="h-badge">추천 시작점</span>' : ''}<span class="h-no">${String(i + 1).padStart(2, '0')}</span>
      <div class="h-hd"><span class="h-ic">${t.ic}</span><div><b>${t.t}</b><small>${t.en}</small></div></div>
      <div class="h-mini" id="hm-${t.id}"></div>
      <p>${HOME_TABS[t.id].d}</p><ul>${HOME_TABS[t.id].li.map(x => `<li>${x}</li>`).join('')}</ul>
      <button class="h-go" data-go="${t.id}">${t.t} 분석하기 <span>→</span></button></div>`).join('');
    $$('#v-home [data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
    // 핵심 수치(데이터에서 바로 계산)
    const c25 = popCity(4), c21 = popCity(0), P25 = popTotal(c25), P21 = popTotal(c21), M1 = D.nps.months.length - 1;
    const e1 = npsSum(M1, i => D.nps.corp[i]);
    const apA = X.cx.filter(x => x.t === 0).length;
    $('#h-stats').innerHTML = [[fN(X.tx.n), '건', '실거래 (5년 · 4개 유형)'], [fN(P25), '명', '인구 (2025.10 격자)'], [fN(e1.e), '명', `법인 종사자 (${D.nps.months[M1]})`],
      [fN(X.st.n), '곳', '상가 업소 · 37개 필드'], ['17', '개', '읍면동 · 100m 격자'], [fN(apA), '곳', '아파트 단지 (위치 확인)']].map(([v, u, l]) => `<div class="h-stat"><b>${v}<small>${u}</small></b><span>${l}</span></div>`).join('');
    $('#h-p1').textContent = fN(P25) + '명'; $('#h-p2').textContent = fP((P25 / P21 - 1) * 100);
    const contour = (id, w, hh, n, seed) => { const svg = $('#' + id); if (!svg) return; let r = seed, out = ''; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; }; const cx = w * (0.6 + rnd() * .25), cy = hh * (0.35 + rnd() * .3);
      for (let k = 1; k <= n; k++) { const rad = k * Math.max(w, hh) / (n * 1.1), pts = []; for (let j = 0; j <= 72; j++) { const a = j / 72 * Math.PI * 2, wob = 1 + .1 * Math.sin(a * 3 + k * .7) + .06 * Math.sin(a * 5 + k * 1.3) + .04 * Math.cos(a * 2 - k); pts.push((cx + Math.cos(a) * rad * wob * 1.35).toFixed(1) + ',' + (cy + Math.sin(a) * rad * wob * .8).toFixed(1)); }
        out += `<path d="M${pts.join('L')}Z" fill="none" stroke="${k % 5 === 0 ? 'rgba(233,185,73,.5)' : 'rgba(169,207,202,.24)'}" stroke-width="${k % 5 === 0 ? 1.4 : 1}"/>`; } svg.innerHTML = out; };
    contour('h-contour', 1200, 640, 26, 7); contour('h-contour2', 1200, 420, 18, 11); contour('h-contour3', 1200, 260, 14, 3);
    this._ro = new ResizeObserver(() => { clearTimeout(this._rt); this._rt = setTimeout(() => { if (CUR === 'home') this.art(); }, 150); });
    this._ro.observe($('#h-art'));
  },
  render() { this.art(); this.minis(); },
  art() { drawArt($('#h-art'), 'pop'); drawArt($('#h-g1'), 'store'); drawArt($('#h-g2'), 'price'); drawArt($('#h-g3'), 'chg'); },
  minis() {
    const t = TK(), S = SER(), mini = (id, opt) => setOpt('hm-' + id, Object.assign({ animation: false, grid: { left: 2, right: 2, top: 6, bottom: 2 }, xAxis: { show: false, type: 'category' }, yAxis: { show: false, type: 'value', scale: true }, tooltip: { show: false } }, opt));
    const T = D.tx;
    // ov: 읍면동 인구(2025) 막대
    const pd = popByDong(4).map(popTotal).map((v, d) => [D.dongs[d], v]).sort((a, b) => b[1] - a[1]);
    mini('ov', { xAxis: { show: false, type: 'category', data: pd.map(x => x[0]) }, yAxis: { show: false, type: 'value' }, series: [{ type: 'bar', data: pd.map(x => x[1]), itemStyle: { color: S[0], borderRadius: [2, 2, 0, 0] }, barCategoryGap: '25%' }] });
    // pop: 피라미드
    const cp = popCity(4);
    mini('pop', { grid: { left: 2, right: 2, top: 2, bottom: 2 }, xAxis: { show: false, type: 'value' }, yAxis: { show: false, type: 'category', data: D.pop.ages }, series: [{ type: 'bar', stack: 'p', data: cp.m.map(v => -v), itemStyle: { color: S[0] }, barWidth: '70%' }, { type: 'bar', stack: 'p', data: cp.f, itemStyle: { color: S[1] } }] });
    // sale: 동일단지 지수 vs 단순 중앙값
    const ci = chainIndex(i => T.t[i] === 0).idx, sm = AY.map(y => { const v = []; for (let i = 0; i < X.tx.n; i++) if (T.t[i] === 0 && T.k[i] === 0 && !(T.f[i] & 1) && X.tx.ay[i] === y && isFinite(X.tx.pp[i])) v.push(X.tx.pp[i]); return median(v); });
    mini('sale', { xAxis: { show: false, type: 'category', data: AY, boundaryGap: false }, series: [{ type: 'line', data: sm.map(v => v / sm[0] * 100), symbol: 'none', lineStyle: { color: t.other, width: 2 } }, { type: 'line', data: ci, symbol: 'none', lineStyle: { color: S[0], width: 2.5 }, areaStyle: { color: S[0], opacity: .08 } }] });
    // rent: 아파트 월세 비중(분기)
    const nQ = Math.ceil(X.tx.nYM / 3), tot = new Array(nQ).fill(0), wl = new Array(nQ).fill(0); for (let i = 0; i < X.tx.n; i++) if (T.k[i] > 0 && T.t[i] === 0) { const q = Math.floor(X.tx.ym[i] / 3); tot[q]++; if (T.k[i] === 2) wl[q]++; }
    mini('rent', { xAxis: { show: false, type: 'category', data: tot.map((_, q) => q), boundaryGap: false }, series: [{ type: 'line', data: tot.map((n, q) => n > 20 ? wl[q] / n * 100 : null), symbol: 'none', smooth: .3, lineStyle: { color: S[1], width: 2.5 }, areaStyle: { color: S[1], opacity: .1 } }] });
    // job: 가입자 추이
    const jt = D.nps.months.map((_, mi) => npsSum(mi, i => D.nps.corp[i]).e);
    mini('job', { xAxis: { show: false, type: 'category', data: D.nps.months, boundaryGap: false }, series: [{ type: 'line', data: jt, symbol: 'circle', symbolSize: 5, lineStyle: { color: S[2], width: 2.5 }, itemStyle: { color: S[2] }, areaStyle: { color: S[2], opacity: .1 } }] });
    // store: 대분류 상위 7
    const L1 = X.stCol('상권업종대분류명'), cnt = new Map(); for (const v of L1.c) cnt.set(v, (cnt.get(v) || 0) + 1);
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).reverse();
    mini('store', { grid: { left: 2, right: 2, top: 2, bottom: 2 }, xAxis: { show: false, type: 'value' }, yAxis: { show: false, type: 'category', data: top.map(x => x[0]) }, series: [{ type: 'bar', data: top.map(x => x[1]), itemStyle: { color: S[0], borderRadius: [0, 2, 2, 0] }, barWidth: '62%' }] });
    // cmp: 인구 2022 vs 2025 덤벨 (상위 6개 읍면동)
    const a = popByDong(4).map(popTotal), b = popByDong(1).map(popTotal), dd = D.dongs.map((n, d) => [n, a[d], b[d]]).sort((x, y) => y[1] - x[1]).slice(0, 6).reverse();
    mini('cmp', { grid: { left: 2, right: 6, top: 4, bottom: 4 }, xAxis: { show: false, type: 'value', scale: true }, yAxis: { show: false, type: 'category', data: dd.map(x => x[0]) },
      series: [{ type: 'custom', renderItem: (p, api) => { const y = api.value(0), A = api.coord([api.value(1), y]), B = api.coord([api.value(2), y]); return { type: 'line', shape: { x1: B[0], y1: B[1], x2: A[0], y2: A[1] }, style: { stroke: turbo(.85), lineWidth: 2.5 } }; }, encode: { x: [1, 2], y: 0 }, data: dd.map((x, i) => [i, x[1], x[2]]) },
        { type: 'scatter', data: dd.map((x, i) => [x[2], i]), symbolSize: 6, itemStyle: { color: t.other } }, { type: 'scatter', data: dd.map((x, i) => [x[1], i]), symbolSize: 7, itemStyle: { color: S[0] } }] });
    // rad: 동심원
    const ring = [5, 4, 3, 2, 1].map(r => ({ type: 'circle', shape: { cx: 0, cy: 0, r: r * 9 }, style: { stroke: r === 3 ? '#d03b3b' : turbo(.15 + r * .15), fill: 'none', lineWidth: r === 3 ? 2 : 1.2 } }));
    setOpt('hm-rad', { animation: false, graphic: [{ type: 'group', left: 'center', top: 'middle', children: ring.concat([{ type: 'circle', shape: { cx: 0, cy: 0, r: 4 }, style: { fill: '#d03b3b' } }]) }] });
    // meth: 위치 오차 중앙값 A/B/C (실측)
    mini('meth', { xAxis: { show: false, type: 'category', data: ['A', 'B', 'C'] }, yAxis: { show: false, type: 'value' }, series: [{ type: 'bar', data: [42, 43, 194], itemStyle: { color: p => turbo(.2 + p.dataIndex * .3), borderRadius: [3, 3, 0, 0] }, barWidth: '42%', label: { show: true, position: 'top', color: t.ink2, fontSize: 10, formatter: p => ['A', 'B', 'C'][p.dataIndex] + ' ' + p.value + 'm' } }] });
  },
};
