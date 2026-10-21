/* =================== 전월세 =================== */
const JR_BANDS = [0, 50, 65, 75, 90, 110, 9999];
const jrBand = a => { for (let k = 1; k < JR_BANDS.length; k++) if (a <= JR_BANDS[k]) return k - 1; return JR_BANDS.length - 2; };
function buildJeonseRatio() {      // 아파트: (단지, 면적대, 연도)별 매매·전세 중앙값
  if (X.jr) return X.jr;
  const T = D.tx, g = {};
  for (let i = 0; i < X.tx.n; i++) {
    if (T.t[i] !== 0 || T.cx[i] < 0 || (T.f[i] & 1) || T.k[i] === 2) continue;
    const a = T.ar[i] / 10; if (!(a > 0)) continue;
    const k = T.cx[i] + '|' + jrBand(a) + '|' + X.tx.ay[i];
    const r = g[k] = g[k] || { s: [], j: [], w: [], cx: T.cx[i], b: jrBand(a), y: X.tx.ay[i] };
    (T.k[i] === 0 ? r.s : r.j).push(T.a[i]);
  }
  const out = [];
  for (const r of Object.values(g)) if (r.s.length >= 2 && r.j.length >= 2) { const sm = median(r.s), jm = median(r.j); out.push({ cx: r.cx, b: r.b, y: r.y, sm, jm, ratio: jm / sm * 100, ns: r.s.length, nj: r.j.length }); }
  X.jr = out; X.jrMap = g; return out;
}
VIEWS.rent = {
  type: 0,
  init() {
    segInit($('#rent-type'), D.tx.types.map((t, i) => [String(i), t]), '0', v => { this.type = +v; this.render(); });
    fillSelect($('#rent-dong'), dongOpts(), '-1'); fillSelect($('#rent-area'), AREA_BANDS, 'all');
    fillSelect($('#rent-y0'), AY.map(y => [y, ayLabel(y)]), 2021); fillSelect($('#rent-y1'), AY.map(y => [y, ayLabel(y)]), 2025);
    fillSelect($('#rent-jr-y'), AY.map(y => [y, ayLabel(y)]), 2025);
    ['#rent-dong', '#rent-area', '#rent-y0', '#rent-y1'].forEach(s => $(s).onchange = () => this.render());
    $('#rent-jr-y').onchange = () => this.jr();
    segInit($('#rent-mm'), null, 'jeon', () => this.map());
  },
  filt(o = {}) {
    const T = D.tx, ds = +$('#rent-dong').value, ab = $('#rent-area').value, y0 = Math.min(+$('#rent-y0').value, +$('#rent-y1').value), y1 = Math.max(+$('#rent-y0').value, +$('#rent-y1').value);
    const ty = o.type ?? this.type;
    return txIdx(i => T.k[i] > 0 && (ty < 0 || T.t[i] === ty) && (o.skipDong || ds < 0 || T.d[i] === ds) && X.tx.ay[i] >= y0 && X.tx.ay[i] <= y1 && inArea(ab, T.ar[i] / 10) && (o.k == null || T.k[i] === o.k) && gTx(i));
  },
  render() {
    const T = D.tx, t = TK(), idx = this.filt();
    this.idx = idx; this.map();
    const J = idx.filter(i => T.k[i] === 1), W = idx.filter(i => T.k[i] === 2);
    const ren = idx.filter(i => T.f[i] & 4), right = ren.filter(i => T.f[i] & 8), known = idx.filter(i => T.f[i] & 36);
    $('#rent-kpis').innerHTML = kpiHTML([
      { l: '전세 계약', v: fN(J.length), u: '건', d: `보증금 중앙값 ${fMan(median(J.map(i => T.a[i])))}` },
      { l: '월세 계약', v: fN(W.length), u: '건', d: `보증금 중앙값 ${fMan(median(W.map(i => T.a[i])))}` },
      { l: '월세 비중', v: idx.length ? (W.length / idx.length * 100).toFixed(1) : '–', u: '%', d: '전월세 계약 중 월세' },
      { l: '월세 중앙값', v: fN(median(W.map(i => T.r[i]))), u: '만원', d: `평균 ${fN(mean(W.map(i => T.r[i])), 1)}만원` },
      { l: '갱신 계약 비중', v: known.length ? (ren.length / known.length * 100).toFixed(1) : '–', u: '%', d: '신규·갱신 구분이 있는 계약 기준' },
      { l: '갱신요구권 사용률', v: ren.length ? (right.length / ren.length * 100).toFixed(1) : '–', u: '%', d: '갱신 계약 중 사용' },
    ]);
    // 월세화 (분기, 유형별)
    const nQ = Math.ceil(X.tx.nYM / 3), qLab = Array.from({ length: nQ }, (_, q) => { const l = ymLabel(q * 3); return l.slice(2, 4) + '.' + (Math.floor((+l.slice(5) - 1) / 3) + 1) + 'Q'; });
    const allT = this.filt({ type: -1 });
    const ser = D.tx.types.map((nm, ty) => { const tot = new Array(nQ).fill(0), w = new Array(nQ).fill(0); for (const i of allT) if (T.t[i] === ty) { const q = Math.floor(X.tx.ym[i] / 3); tot[q]++; if (T.k[i] === 2) w[q]++; } return { name: nm, type: 'line', data: tot.map((n, q) => n >= 10 ? +(w[q] / n * 100).toFixed(1) : null), lineStyle: { width: ty === this.type ? 3 : 1.6, color: SER()[ty] }, itemStyle: { color: SER()[ty] }, symbolSize: ty === this.type ? 6 : 4, connectNulls: true, endLabel: { show: true, color: t.ink2, fontSize: 10.5, formatter: p => nm } }; });
    setOpt('rent-share', base({ tooltip: { trigger: 'axis', valueFormatter: v => v == null ? '–' : v + '%' }, legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 70, top: 34, bottom: 4, containLabel: true }, xAxis: xCat(qLab, { boundaryGap: false }), yAxis: yVal({ max: 100, axisLabel: { color: t.muted, formatter: '{value}%' } }), series: ser }));
    // 전세 추세
    if (J.length > 20) { const mb = monthlyBand(J, i => T.a[i], X.tx.nYM); setOpt('rent-jeonse', bandOpt(mb.q, mb.ma, '만원', '전세 보증금')); } else emptyChart('rent-jeonse', '전세 계약이 적어 추세를 그리지 않습니다');
    // 월세 히스토그램
    const wr = W.map(i => T.r[i]).filter(v => v > 0);
    const ho = histKdeOpt(wr, '만원', '월세(만원)'); if (ho) setOpt('rent-mhist', ho); else emptyChart('rent-mhist');
    // 박스플롯 월세 by dong
    const Wall = this.filt({ skipDong: true, k: 2 }); const byD = D.dongs.map((nm, d) => ({ nm, d, v: [] })); for (const i of Wall) if (T.r[i] > 0) byD[T.d[i]].v.push(T.r[i]);
    const bx = byD.filter(r => r.v.length >= 5).map(r => ({ ...r, b: boxStats(r.v) })).sort((a, b) => b.b[2] - a.b[2]); const ds = +$('#rent-dong').value;
    if (bx.length) setOpt('rent-box', base({
      tooltip: { trigger: 'item', formatter: p => { const r = bx[p.dataIndex]; return `<b>${r.nm}</b> (n=${fN(r.v.length)})<br>25% ${fN(r.b[1])} · <b>중앙 ${fN(r.b[2])}</b> · 75% ${fN(r.b[3])} 만원`; } },
      grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true }, xAxis: xCat(bx.map(r => r.nm), { axisLabel: { color: t.ink2, fontSize: 11, interval: 0, rotate: 30 } }), yAxis: yVal({ name: '만원' }),
      series: [{ type: 'boxplot', data: bx.map(r => ({ value: r.b, itemStyle: { color: mix(r.d === ds ? css('--brand') : css('--s1'), t.surf, .78), borderColor: r.d === ds ? css('--brand') : css('--s1'), borderWidth: 1.5 } })) }],
    })); else emptyChart('rent-box');
    // 전월세전환율 (아파트)
    buildJeonseRatio(); const conv = {}; const convD = {};
    for (let i = 0; i < X.tx.n; i++) {
      if (T.t[i] !== 0 || T.k[i] !== 2 || T.cx[i] < 0 || !gTx(i)) continue; const a = T.ar[i] / 10; if (!(a > 0)) continue;
      if (ds >= 0 && T.d[i] !== ds) continue;
      const g = X.jrMap[T.cx[i] + '|' + jrBand(a) + '|' + X.tx.ay[i]]; if (!g || g.j.length < 2) continue;
      const jm = median(g.j); if (jm - T.a[i] <= 500) continue;
      const rate = T.r[i] * 12 / (jm - T.a[i]) * 100; if (!(rate > 0 && rate < 20)) continue;
      (conv[X.tx.ay[i]] = conv[X.tx.ay[i]] || []).push(rate);
    }
    const cy = AY.filter(y => conv[y] && conv[y].length >= 5);
    if (cy.length) setOpt('rent-conv', base({
      tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>전환율 중앙값 ${ps[0].value}% (n=${fN(conv[cy[ps[0].dataIndex]].length)})` },
      grid: { left: 8, right: 16, top: 20, bottom: 4, containLabel: true }, xAxis: xCat(cy.map(ayShort)), yAxis: yVal({ axisLabel: { color: t.muted, formatter: '{value}%' } }),
      series: [{ type: 'bar', data: cy.map(y => +median(conv[y]).toFixed(2)), itemStyle: barStyle(css('--s1')), barWidth: '45%', label: { show: true, position: 'top', color: t.ink2, formatter: '{c}%' } }],
    })); else emptyChart('rent-conv', '아파트 월세·전세가 함께 있는 단지가 부족합니다');
    // 갱신
    const yrs = AY; const rr = yrs.map(y => { const s = idx.filter(i => X.tx.ay[i] === y && (T.f[i] & 36)); const r = s.filter(i => T.f[i] & 4); return [s.length ? r.length / s.length * 100 : null, r.length ? r.filter(i => T.f[i] & 8).length / r.length * 100 : null]; });
    setOpt('rent-renew', base({
      tooltip: { trigger: 'axis', valueFormatter: v => v == null ? '–' : v.toFixed(1) + '%' }, legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } },
      grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true }, xAxis: xCat(yrs.map(ayShort)), yAxis: yVal({ max: 100, axisLabel: { color: t.muted, formatter: '{value}%' } }),
      series: [{ name: '갱신 계약 비중', type: 'bar', data: rr.map(r => r[0] == null ? null : +r[0].toFixed(1)), itemStyle: barStyle(mix(css('--s1'), t.surf, .3)), barWidth: '45%' },
        { name: '갱신요구권 사용 비중', type: 'line', data: rr.map(r => r[1] == null ? null : +r[1].toFixed(1)), lineStyle: { width: 2.5, color: css('--s2') }, itemStyle: { color: css('--s2'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 8 }],
    }));
    const rc = idx.filter(i => (T.f[i] & 4) && T.k[i] === 1 && T.pa[i] > 0).map(i => (T.a[i] / T.pa[i] - 1) * 100).filter(v => v > -60 && v < 100);
    const ho2 = histKdeOpt(rc, '%', '변동률(%)'); if (ho2 && rc.length >= 20) { setOpt('rent-renewchg', ho2); const c = chart('rent-renewchg'); c.setOption({ xAxis: { axisLabel: { formatter: v => v + '%' } } }); } else emptyChart('rent-renewchg', '전세 갱신 계약이 적습니다');
    // 면적 vs 월세
    const xs = [], ys = []; for (const i of W) { const a = T.ar[i] / 10; if (a > 0 && T.a[i] < 10000 && T.r[i] > 0) { xs.push(a); ys.push(T.r[i]); } }
    scatterReg('rent-scatter', xs, ys, '면적(㎡)', '월세(만원)', '#rent-ols', b => `${fN(b, 2)}만원/㎡`);
    this.jr();
  },
  map() {
    const m = makeMap('rent-map', { zoom: 11 }), mm = segVal($('#rent-mm')), T = D.tx, idx = this.idx || [], ds = +$('#rent-dong').value;
    let sub = idx, fn = null, metric;
    if (mm === 'jeon') { sub = idx.filter(i => T.k[i] === 1); fn = i => T.a[i]; metric = { l: '전세 보증금 중앙값', agg: 'median', fmt: fMan }; }
    else if (mm === 'wol') { sub = idx.filter(i => T.k[i] === 2); fn = i => T.r[i]; metric = { l: '월세 중앙값 (만원)', agg: 'median', fmt: v => fN(v) + '만' }; }
    else if (mm === 'share') { fn = i => T.k[i] === 2 ? 100 : 0; metric = { l: '월세 비중 (%)', agg: 'mean', minN: 3, fmt: v => fN(v, 0) + '%' }; }
    else metric = { l: '전월세 계약 건수', agg: 'count', fmt: v => fN(v) + '건' };
    drawLocMap(m, txLocAgg(sub, fn), metric, { fit: ds >= 0 });
    if (ds < 0 && this._mds !== ds && !GEOF.on) m.setView([36.80, 127.02], 11); this._mds = ds;
  },
  jr() {
    const t = TK(), y = +$('#rent-jr-y').value, ds = +$('#rent-dong').value;
    const rows = buildJeonseRatio().filter(r => r.y === y && (ds < 0 || X.cx[r.cx].d === ds) && r.ratio < 200 && gCx(r.cx));
    if (rows.length < 3) { emptyChart('rent-jr', '해당 연도에 비교 가능한 단지가 부족합니다'); $('#rent-jr-t').innerHTML = ''; return; }
    const bins = [[0, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 100], [100, 200]];
    const cnt = bins.map(([a, b]) => rows.filter(r => r.ratio >= a && r.ratio < b).length);
    const colr = k => k >= 4 ? css('--critical') : k === 3 ? css('--serious') : css('--s1');
    setOpt('rent-jr', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>전세가율 ${ps[0].name}</b><br>${ps[0].value}개 (단지×면적대)` },
      grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      xAxis: xCat(bins.map(([a, b]) => b === 200 ? '100%+' : `${a}~${b}%`)), yAxis: yVal({ name: '단지·면적대 수' }),
      series: [{ type: 'bar', barWidth: '62%', data: cnt.map((v, k) => ({ value: v, itemStyle: barStyle(colr(k)) })), label: { show: true, position: 'top', color: t.ink2, fontSize: 11 } }],
      graphic: { type: 'text', right: 10, top: 2, style: { text: `중앙값 ${median(rows.map(r => r.ratio)).toFixed(1)}% · n=${rows.length} · 주황=관찰(70~80%) · 빨강=주의(80%+)`, fill: t.muted, fontSize: 11, fontFamily: FONT } },
    }));
    const bl = ['50㎡↓', '50~65㎡', '65~75㎡', '75~90㎡', '90~110㎡', '110㎡↑'];
    renderTable($('#rent-jr-t'), [
      { k: 'n', l: '단지' }, { k: 'dong', l: '읍면동' }, { k: 'band', l: '면적대' },
      { k: 'ratio', l: '전세가율', n: 1, f: v => `${v.toFixed(0)}% ${v >= 80 ? '<span class="badge b-crit">⚠ 주의</span>' : v >= 70 ? '<span class="badge b-ser">관찰</span>' : '<span class="badge b-good">✓ 양호</span>'}` },
      { k: 'sm', l: '매매 중앙', n: 1, f: v => fMan(v) }, { k: 'jm', l: '전세 중앙', n: 1, f: v => fMan(v) }, { k: 'cnt', l: '건수(매/전)' }],
      rows.map((r, i) => ({ _id: i, n: X.cx[r.cx].n, dong: D.dongs[X.cx[r.cx].d], band: bl[r.b], ratio: r.ratio, sm: r.sm, jm: r.jm, cnt: `${r.ns}/${r.nj}` })), { sortKey: 'ratio', limit: 300 });
  },
};
