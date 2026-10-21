/* =================== 공통 지표 (읍면동) =================== */
function popByDong(yi, useMask) {          // [dong][13 ages][sex] 합 (useMask: 반경 필터 적용)
  const out = D.dongs.map(() => ({ m: new Array(X.pop.NA).fill(0), f: new Array(X.pop.NA).fill(0) }));
  for (let c = 0; c < X.pop.nc; c++) { const d = X.pop.d[c]; if (d < 0 || (useMask && !gCell(c))) continue; for (let a = 0; a < X.pop.NA; a++) { out[d].m[a] += X.popAt(c, yi, 0, a); out[d].f[a] += X.popAt(c, yi, 1, a); } }
  return out;
}
function popTotal(arr) { return sum(arr.m) + sum(arr.f); }
function popCity(yi) { const r = { m: new Array(X.pop.NA).fill(0), f: new Array(X.pop.NA).fill(0) }; for (let c = 0; c < X.pop.nc; c++) { if (!gCell(c)) continue; for (let a = 0; a < X.pop.NA; a++) { r.m[a] += X.popAt(c, yi, 0, a); r.f[a] += X.popAt(c, yi, 1, a); } } return r; }   // 경계 밖 격자 포함 전체
const A3040 = [5, 6], A60 = [8, 9, 10, 11, 12], AKID = [0, 1, 2, 3];
const share = (p, idx) => { const t = popTotal(p); return t ? idx.reduce((s, a) => s + p.m[a] + p.f[a], 0) / t * 100 : null; };

function npsSum(mi, filt) {       // filt(i) → bool
  const N = D.nps; let e = 0, s = 0, fee = 0;
  for (let i = 0; i < X.nps.n; i++) if (N.m[i] === mi && N.act[i] && filt(i)) { e += N.e[i]; s++; fee += N.fee[i]; }
  return { e, s, fee };
}
function txIdx(f) { const out = []; for (let i = 0; i < X.tx.n; i++) if (f(i)) out.push(i); return out; }

/* 동일단지 체인 가격지수: 같은 단지·같은 면적대의 연도 간 중앙값 비율을 기하평균(가중) → 연쇄 */
function chainIndex(rowOk, minPairs = 5) {
  const T = D.tx, g = new Map();
  for (let i = 0; i < X.tx.n; i++) {
    if (T.k[i] !== 0 || T.cx[i] < 0 || (T.f[i] & 1) || !isFinite(X.tx.pp[i]) || !rowOk(i)) continue;
    const k = T.cx[i] * 10 + jrBand(T.ar[i] / 10); let o = g.get(k); if (!o) g.set(k, o = {});
    (o[X.tx.ay[i]] = o[X.tx.ay[i]] || []).push(X.tx.pp[i]);
  }
  const med = new Map(); for (const [k, o] of g) { const m = {}; for (const y in o) m[y] = [median(o[y]), o[y].length]; med.set(k, m); }
  const idx = [100], pairs = [0];
  for (let j = 1; j < AY.length; j++) {
    const y0 = AY[j - 1], y1 = AY[j]; let sw = 0, sl = 0, np = 0;
    for (const m of med.values()) if (m[y0] && m[y1]) { const w = Math.min(m[y0][1], m[y1][1]); sw += w; sl += w * Math.log(m[y1][0] / m[y0][0]); np++; }
    pairs.push(np);
    idx.push(np >= minPairs && idx[j - 1] != null ? idx[j - 1] * Math.exp(sl / sw) : null);
  }
  return { idx, pairs };
}
function buildIndicators() {
  const T = D.tx, nD = D.dongs.length;
  const p21 = popByDong(0), p25 = popByDong(4);
  const M0 = 0, M1 = D.nps.months.length - 1;
  const ind = D.dongs.map((nm, d) => {
    const pop25 = popTotal(p25[d]), pop21 = popTotal(p21[d]);
    const e1 = npsSum(M1, i => D.nps.d[i] === d && D.nps.corp[i]).e, e0 = npsSum(M0, i => D.nps.d[i] === d && D.nps.corp[i]).e;
    const pp = { 2021: [], 2025: [] }; let trades = 0; const jeon = []; let rentN = 0, wolN = 0;
    for (let i = 0; i < X.tx.n; i++) {
      if (T.d[i] !== d) continue;
      const cancel = T.f[i] & 1;
      if (T.k[i] === 0 && !cancel) { trades++; if (T.t[i] === 0 && (X.tx.ay[i] === 2021 || X.tx.ay[i] === 2025) && isFinite(X.tx.pp[i])) pp[X.tx.ay[i]].push(X.tx.pp[i]); }
      if (T.k[i] > 0 && X.tx.ay[i] === 2025) { rentN++; if (T.k[i] === 2) wolN++; if (T.k[i] === 1 && T.t[i] === 0) jeon.push(T.a[i]); }
    }
    const stores = X.st.d.reduce((s, v) => s + (v === d ? 1 : 0), 0);
    const aptN = pp[2021].length + pp[2025].length;
    const ppm21 = pp[2021].length >= 10 ? median(pp[2021]) : null, ppm25 = pp[2025].length >= 10 ? median(pp[2025]) : null;
    const ci = chainIndex(i => T.t[i] === 0 && T.d[i] === d, 3), ciLast = ci.idx[ci.idx.length - 1];
    const popOK = pop21 >= 1000 && pop25 >= 1000;     // 인구 격자 비공개가 많은 면 지역은 인구 지표 제외
    return {
      d, 읍면동: nm, pop25, pop21, popOK, popChg: popOK ? (pop25 / pop21 - 1) * 100 : null,
      s3040: popOK ? share(p25[d], A3040) : null, s3040_21: share(p21[d], A3040), s60: popOK ? share(p25[d], A60) : null,
      ppMix: ppm21 && ppm25 ? (ppm25 / ppm21 - 1) * 100 : null,
      emp: e1, emp0: e0, empChg: e0 ? (e1 / e0 - 1) * 100 : null,
      pp25: ppm25, pp21: ppm21, ppChg: ciLast != null ? ciLast - 100 : null, aptN,
      trades, tradesPer1k: popOK ? trades / pop25 * 1000 : null,
      jeonse: jeon.length >= 10 ? median(jeon) : null, wolShare: rentN ? wolN / rentN * 100 : null,
      stores, storesPer1k: popOK ? stores / pop25 * 1000 : null,
    };
  });
  X.ind = ind;
}

/* =================== 종합 개요 =================== */
const SCORE_KEYS = [
  ['popChg', '인구 증가율', 25], ['s3040', '30~40대 비중', 15], ['empChg', '종사자 증가율', 15],
  ['ppChg', '평당가 상승률', 15], ['tradesPer1k', '거래 활성도', 15], ['storesPer1k', '상권 밀도', 15]];
VIEWS.ov = {
  sel: 1, w: Object.fromEntries(SCORE_KEYS.map(k => [k[0], k[2]])),
  init() {
    const box = $('#ov-weights');
    box.innerHTML = SCORE_KEYS.map(([k, l]) => `<div class="wrow"><span>${l}</span><input type="range" min="0" max="40" step="5" value="${this.w[k]}" data-k="${k}"><b data-o="${k}">${this.w[k]}</b></div>`).join('');
    $$('input', box).forEach(r => r.oninput = () => { this.w[r.dataset.k] = +r.value; $(`[data-o="${r.dataset.k}"]`, box).textContent = r.value; this.score(); });
  },
  render() {
    const I = X.ind;
    // KPI
    const c21 = popCity(0), c25 = popCity(4), M1 = D.nps.months.length - 1;
    const e1 = npsSum(M1, i => D.nps.corp[i] && gNps(i)), e0 = npsSum(0, i => D.nps.corp[i] && gNps(i));
    const T = D.tx; const a21 = [], a25 = [], j25 = [], j21 = [], w25 = [], w21 = [];
    for (let i = 0; i < X.tx.n; i++) {
      if (!gTx(i)) continue;
      const y = X.tx.ay[i];
      if (T.t[i] === 0 && T.k[i] === 0 && !(T.f[i] & 1) && isFinite(X.tx.pp[i])) { if (y === 2025) a25.push(X.tx.pp[i]); if (y === 2021) a21.push(X.tx.pp[i]); }
      if (T.t[i] === 0 && T.k[i] === 1) { if (y === 2025) j25.push(T.a[i]); if (y === 2021) j21.push(T.a[i]); }
      if (T.t[i] === 1 && T.k[i] === 2) { if (y === 2025) w25.push(T.r[i]); if (y === 2021) w21.push(T.r[i]); }
    }
    const P25 = popTotal(c25), P21 = popTotal(c21);
    $('#ov-kpis').innerHTML = kpiHTML([
      { l: '인구 (2025.10, 격자 합계)', v: fN(P25), u: '명', d: delta(P25, P21) + ' vs 2021' },
      { l: '30~40대 비중', v: share(c25, A3040).toFixed(1), u: '%', d: delta(share(c25, A3040), share(c21, A3040), true) + ' vs 2021' },
      { l: `법인 종사자 (${D.nps.months[M1]})`, v: fN(e1.e), u: '명', d: delta(e1.e, e0.e) + ` vs ${D.nps.months[0]}` },
      { l: '법인 사업장', v: fN(e1.s), u: '곳', d: delta(e1.s, e0.s) + ` vs ${D.nps.months[0]}` },
      { l: '아파트 평당가 중앙값 (전용 3.3㎡)', v: fN(median(a25)), u: '만원', d: (() => { const ci = chainIndex(i => D.tx.t[i] === 0 && gTx(i), 3).idx; const v = ci[ci.length - 1]; return `동일단지 지수 ${delta(v, 100)} · 단순 중앙값 ${fP((median(a25) / median(a21) - 1) * 100)}`; })() },
      { l: '아파트 전세 보증금 중앙값', v: fMan(median(j25)), d: delta(median(j25), median(j21)) + ' vs 21-22' },
      { l: '오피스텔 월세 중앙값', v: fN(median(w25)), u: '만원', d: delta(median(w25), median(w21)) + ' vs 21-22' },
      { l: '상가 업소 (소상공인)', v: fN(GEOF.on ? X.gm.st.reduce((s, v) => s + v, 0) : X.st.n), u: '곳', d: '기준일 미기재' },
    ]);
    this.bubble(); this.score(); this.corr(); this.table();
  },
  bubble() {
    const t = TK(); const pts = X.ind.filter(r => r.popChg != null && r.ppChg != null && r.aptN >= 30);
    const maxT = Math.max(...pts.map(r => r.trades));
    setOpt('ov-bubble', base({
      tooltip: { trigger: 'item', formatter: p => { const r = p.data.r; return `<b>${r.읍면동}</b><br>인구 증감률 ${fP(r.popChg)} (${fN(r.pop21)}→${fN(r.pop25)}명)<br>동일단지 가격지수 ${fP(r.ppChg)}<br>단순 중앙값 ${fN(r.pp21)}→${fN(r.pp25)}만원 (${fP(r.ppMix)}, 구성 변화 포함)<br>5년 매매 ${fN(r.trades)}건`; } },
      grid: { left: 12, right: 30, top: 24, bottom: 8, containLabel: true },
      xAxis: yVal({ name: '인구 증감률(%)', nameLocation: 'middle', nameGap: 26, axisLabel: { color: t.muted, formatter: v => v + '%' }, splitLine: { lineStyle: { color: t.grid } } }),
      yAxis: yVal({ name: '동일단지 가격 상승률(%)', nameLocation: 'middle', nameGap: 40, axisLabel: { color: t.muted, formatter: v => v + '%' } }),
      series: [{
        type: 'scatter', data: pts.map(r => ({ value: [r.popChg, r.ppChg], r, symbolSize: 10 + 40 * Math.sqrt(r.trades / maxT) })),
        itemStyle: { color: css('--s1'), opacity: .78, borderColor: t.surf, borderWidth: 2 },
        label: { show: true, formatter: p => p.data.r.읍면동, position: 'right', color: t.ink2, fontSize: 11 }, labelLayout: { hideOverlap: true },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.axis, type: 'solid', width: 1 }, label: { show: false }, data: [{ xAxis: 0 }, { yAxis: median(pts.map(r => r.ppChg)) }] },
      }],
    }));
    chart('ov-bubble').off('click'); chart('ov-bubble').on('click', p => { this.sel = p.data.r.d; this.radar(); this.table(); });
  },
  score() {
    const W = this.w, I = X.ind.filter(r => r.popOK);      // 인구 격자 비공개가 많은 면 지역은 평가 제외
    X.ind.forEach(r => r.score = null);
    const Z = Object.fromEntries(SCORE_KEYS.map(([k]) => [k, zs(I.map(r => r[k]))]));
    const tw = sum(Object.values(W)) || 1;
    const raw = I.map((r, i) => SCORE_KEYS.reduce((s, [k]) => s + Z[k][i] * W[k] / tw, 0));
    const lo = Math.min(...raw), hi = Math.max(...raw);
    I.forEach((r, i) => r.score = hi > lo ? (raw[i] - lo) / (hi - lo) * 100 : 50);
    const rs = I.slice().sort((a, b) => a.score - b.score);
    const t = TK();
    setOpt('ov-score', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rs[ps[0].dataIndex]; return `<b>${r.읍면동}</b> ${r.score.toFixed(0)}점<br>` + SCORE_KEYS.map(([k, l]) => `${l}: ${r[k] == null ? '–' : r[k].toFixed(1)}`).join('<br>'); } },
      grid: { left: 8, right: 34, top: 6, bottom: 4, containLabel: true },
      xAxis: yVal({ max: 100, splitNumber: 4 }), yAxis: xCat(rs.map(r => r.읍면동), { axisLabel: { color: t.ink2, fontSize: 11 } }),
      series: [{ type: 'bar', data: rs.map(r => ({ value: +r.score.toFixed(1), itemStyle: barStyle(r.d === this.sel ? css('--brand') : css('--s1'), true) })), barWidth: '62%', label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: p => p.value.toFixed(0) } }],
    }));
    chart('ov-score').off('click'); chart('ov-score').on('click', p => { this.sel = rs[p.dataIndex].d; this.score(); this.radar(); this.table(); });
    this.radar(); if (this._tblDone) this.table();
  },
  radar() {
    const I = X.ind, keys = SCORE_KEYS.concat([['s60', '60세+ 비중(낮을수록↑)', 0]]);
    const pr = Object.fromEntries(keys.map(([k]) => [k, pctRank(I.map(r => k === 's60' ? (r[k] == null ? null : -r[k]) : r[k]))]));
    const r = I[this.sel], t = TK();
    setOpt('ov-radar', base({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, top: 'auto', data: [r.읍면동, '아산 중앙값(50)'], textStyle: { color: t.ink2 } },
      radar: { indicator: keys.map(([, l]) => ({ name: l, max: 100 })), radius: '62%', center: ['50%', '48%'], axisName: { color: t.ink2, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: t.grid } } },
      series: [{
        type: 'radar', symbolSize: 6, data: [
          { name: '아산 중앙값(50)', value: keys.map(() => 50), lineStyle: { color: t.other, width: 1.5 }, itemStyle: { color: t.other }, areaStyle: { opacity: 0 } },
          { name: r.읍면동, value: keys.map(([k]) => pr[k][this.sel] ?? 0), lineStyle: { color: css('--brand'), width: 2 }, itemStyle: { color: css('--brand') }, areaStyle: { color: css('--brand'), opacity: .12 } }]
      }],
    }));
  },
  corr() {
    const keys = [['popChg', '인구증가율'], ['s3040', '30~40대%'], ['s60', '60세+%'], ['empChg', '종사자증가율'], ['pp25', '평당가'], ['ppChg', '평당가상승률'], ['tradesPer1k', '거래활성도'], ['jeonse', '전세보증금'], ['wolShare', '월세비중'], ['storesPer1k', '상가밀도']];
    const data = []; const I = X.ind;
    keys.forEach(([a], i) => keys.forEach(([b], j) => { const r = pearson(I.map(x => x[a]), I.map(x => x[b])); data.push([j, i, r == null ? '-' : +r.toFixed(2)]); }));
    const t = TK();
    setOpt('ov-corr', base({
      tooltip: { trigger: 'item', formatter: p => `${keys[p.data[1]][1]} × ${keys[p.data[0]][1]}<br>r = <b>${p.data[2]}</b>` },
      grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
      xAxis: xCat(keys.map(k => k[1]), { axisLabel: { color: t.ink2, fontSize: 10.5, rotate: 35, interval: 0 }, splitArea: { show: false } }),
      yAxis: xCat(keys.map(k => k[1]), { axisLabel: { color: t.ink2, fontSize: 10.5, interval: 0 }, inverse: true }),
      visualMap: { dimension: 2, min: -1, max: 1, calculable: true, orient: 'vertical', right: 0, top: 'middle', itemHeight: 160, text: ['+1', '-1'], textStyle: { color: t.muted }, inRange: { color: [css('--dv-pos'), css('--dv-mid'), css('--dv-neg')] } },
      series: [{ type: 'heatmap', data, label: { show: true, color: t.ink, fontSize: 10, formatter: p => p.data[2] === '-' ? '' : p.data[2].toFixed(1) }, itemStyle: { borderColor: t.surf, borderWidth: 2 } }],
    }));
  },
  table() {
    this._tblDone = true;
    const rows = X.ind.map(r => Object.assign({ _id: r.d }, r));
    const pc = v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${fP(v)}</span>`;
    renderTable($('#ov-table'), [
      { k: '읍면동', l: '읍면동' }, { k: 'score', l: '스코어', n: 1, f: v => v == null ? '–' : v.toFixed(0) },
      { k: 'pop25', l: '인구(25)', n: 1, f: v => fN(v) }, { k: 'popChg', l: '인구 증감', n: 1, f: pc },
      { k: 's3040', l: '30~40대%', n: 1, f: v => v == null ? '–' : v.toFixed(1) }, { k: 's60', l: '60세+%', n: 1, f: v => v == null ? '–' : v.toFixed(1) },
      { k: 'emp', l: '법인 종사자', n: 1, f: v => fN(v) }, { k: 'empChg', l: '종사자 증감', n: 1, f: pc },
      { k: 'pp25', l: '아파트 평당가(전용)', n: 1, f: v => v == null ? '–' : fN(v) + '만' }, { k: 'ppChg', l: '동일단지 상승', n: 1, f: pc }, { k: 'ppMix', l: '단순 중앙값 변화', n: 1, f: pc },
      { k: 'trades', l: '5년 매매', n: 1, f: v => fN(v) }, { k: 'jeonse', l: '아파트 전세', n: 1, f: v => v == null ? '–' : fMan(v) },
      { k: 'wolShare', l: '월세비중', n: 1, f: v => v == null ? '–' : v.toFixed(0) + '%' }, { k: 'stores', l: '상가', n: 1, f: v => fN(v) },
      { k: 'storesPer1k', l: '상가/천명', n: 1, f: v => v == null ? '–' : v.toFixed(0) },
    ], rows, { sortKey: 'score', sel: this.sel, onRow: id => { this.sel = +id; this.score(); } });
  },
};
