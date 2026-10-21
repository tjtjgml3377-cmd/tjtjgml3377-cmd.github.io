/* =================== 매매 =================== */
function monthlyBand(idx, valFn, nYM) {     // 월별 q1, med, q3 + 3MA
  const by = Array.from({ length: nYM }, () => []);
  for (const i of idx) { const v = valFn(i); if (isFinite(v)) by[X.tx.ym[i]].push(v); }
  const q = by.map(a => { if (a.length < 3) return [null, null, null, a.length]; const s = sorted(a); return [qs(s, .25), qs(s, .5), qs(s, .75), a.length]; });
  const ma = q.map((_, i) => { const w = q.slice(Math.max(0, i - 2), i + 1).filter(x => x[1] != null); return w.length ? mean(w.map(x => x[1])) : null; });
  return { q, ma };
}
function bandOpt(q, ma, unit, nm) {
  const t = TK(), labels = q.map((_, i) => ymLabel(i));
  const lo = q.map(x => x[0]), span = q.map(x => x[0] == null ? null : x[2] - x[0]);
  return base({
    tooltip: { trigger: 'axis', formatter: ps => { const i = ps[0].dataIndex, r = q[i]; return `<b>${labels[i]}</b><br>중앙값 ${fN(r[1])}${unit} (n=${r[3]})<br>25~75%: ${fN(r[0])} ~ ${fN(r[2])}<br>3개월 이동평균 ${fN(ma[i])}${unit}`; } },
    legend: { top: 0, data: [nm + ' 3개월 이동평균', '월 중앙값', '25~75% 구간'], textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true },
    xAxis: xCat(labels, { boundaryGap: false }), yAxis: yVal({ scale: true }),
    series: [
      { name: 'lo', type: 'line', data: lo, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, itemStyle: { color: css('--s1') }, connectNulls: true, silent: true, tooltip: { show: false } },
      { name: '25~75% 구간', type: 'line', data: span, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, itemStyle: { color: mix(css('--s1'), t.surf, .7) }, areaStyle: { color: css('--s1'), opacity: .14 }, connectNulls: true, silent: true },
      { name: '월 중앙값', type: 'line', data: q.map(x => x[1]), symbol: 'circle', symbolSize: 4, lineStyle: { width: 1, color: mix(css('--s1'), t.surf, .45) }, itemStyle: { color: mix(css('--s1'), t.surf, .45) }, connectNulls: false },
      { name: nm + ' 3개월 이동평균', type: 'line', data: ma, symbol: 'none', smooth: .2, lineStyle: { width: 2.5, color: css('--s1') }, itemStyle: { color: css('--s1') } },
    ],
  });
}
function histKdeOpt(vals, unit, xname) {
  const t = TK(); if (vals.length < 5) return null;
  const s = sorted(vals), lo = qs(s, .005), hi = qs(s, .995);
  const v2 = vals.filter(v => v >= lo && v <= hi);
  const { w, edges } = niceBins(lo, hi, 28);
  const cnt = new Array(edges.length - 1).fill(0);
  for (const v of v2) { const k = Math.min(cnt.length - 1, Math.floor((v - edges[0]) / w)); if (k >= 0) cnt[k]++; }
  const mids = edges.slice(0, -1).map(e => e + w / 2);
  const dens = kde(v2, mids).map(d => d * v2.length * w);
  const med = qs(s, .5), mn = mean(vals);
  return base({
    tooltip: { trigger: 'axis', formatter: ps => `<b>${fN(edges[ps[0].dataIndex])} ~ ${fN(edges[ps[0].dataIndex + 1])}${unit}</b><br>거래 ${fN(cnt[ps[0].dataIndex])}건` },
    grid: { left: 8, right: 16, top: 46, bottom: 4, containLabel: true },
    legend: { top: 0, data: ['거래 수', 'KDE 추정'], textStyle: { color: t.ink2, fontSize: 11 } },
    xAxis: xCat(mids.map(v => compact(v)), { name: xname, nameLocation: 'end', nameTextStyle: { color: t.muted, fontSize: 10 } }), yAxis: yVal(),
    series: [
      { name: '거래 수', type: 'bar', data: cnt, barCategoryGap: '8%', itemStyle: { color: mix(css('--s1'), t.surf, .35), borderRadius: [3, 3, 0, 0] } },
      { name: 'KDE 추정', type: 'line', data: dens.map(d => +d.toFixed(2)), smooth: true, symbol: 'none', lineStyle: { width: 2, color: css('--s2') }, itemStyle: { color: css('--s2') },
        markLine: { silent: true, symbol: 'none', label: { color: t.ink2, fontSize: 10.5, formatter: p => p.name }, lineStyle: { color: t.ink2, width: 1 }, data: [{ name: '중앙값 ' + compact(med), xAxis: Math.max(0, Math.min(mids.length - 1, Math.floor((med - edges[0]) / w))) }] } },
    ],
  });
}
function scatterReg(id, xs, ys, xname, yname, noteId, fmtB) {
  const t = TK(); const n = xs.length; if (n < 5) { emptyChart(id); if (noteId) $(noteId).textContent = ''; return; }
  const step = Math.max(1, Math.ceil(n / 4000)); const pts = []; for (let i = 0; i < n; i += step) pts.push([xs[i], ys[i]]);
  const r = ols(xs, ys); const sx = sorted(xs), x0 = qs(sx, .01), x1 = qs(sx, .99);
  const sy = sorted(ys), ylo = qs(sy, .005), yhi = qs(sy, .995);
  setOpt(id, base({
    tooltip: { trigger: 'item', formatter: p => p.seriesIndex === 0 ? `${xname} ${fN(p.data[0], 1)}<br>${yname} ${fN(p.data[1])}` : `회귀선 y = ${fN(r.a, 1)} + ${fN(r.b, 2)}x` },
    grid: { left: 8, right: 20, top: 16, bottom: 22, containLabel: true },
    xAxis: yVal({ name: xname, nameLocation: 'middle', nameGap: 24, min: Math.floor(x0), max: Math.ceil(x1), splitLine: { lineStyle: { color: t.grid } } }),
    yAxis: yVal({ name: yname, nameLocation: 'end', min: Math.max(0, Math.floor(ylo)), max: Math.ceil(yhi) }),
    series: [
      { type: 'scatter', data: pts, symbolSize: 5, itemStyle: { color: css('--s1'), opacity: .35 }, large: true },
      { type: 'line', data: [[x0, r.a + r.b * x0], [x1, r.a + r.b * x1]], symbol: 'none', lineStyle: { color: css('--s2'), width: 2.5 }, z: 5 },
    ],
  }));
  if (noteId) $(noteId).innerHTML = `회귀식: ${yname} ≈ ${fN(r.a, 1)} + <b>${fmtB ? fmtB(r.b) : fN(r.b, 2)}</b> × ${xname} · 결정계수 R² = <b>${r.r2.toFixed(3)}</b> (n=${fN(n)}) — R²가 1에 가까울수록 ${xname}로 ${yname}를 잘 설명합니다.`;
}

VIEWS.sale = {
  type: 0, cxSel: null,
  init() {
    segInit($('#sale-type'), D.tx.types.map((t, i) => [String(i), t]), '0', v => { this.type = +v; this.cxSel = null; this.render(); });
    fillSelect($('#sale-dong'), dongOpts(), '-1'); fillSelect($('#sale-area'), AREA_BANDS, 'all');
    fillSelect($('#sale-y0'), AY.map(y => [y, ayLabel(y)]), 2021); fillSelect($('#sale-y1'), AY.map(y => [y, ayLabel(y)]), 2025);
    fillSelect($('#sale-cal-y'), [2022, 2023, 2024, 2025, 2026].map(y => [y, y + '년']), 2025);
    ['#sale-dong', '#sale-area', '#sale-y0', '#sale-y1', '#sale-cancel'].forEach(s => $(s).onchange = () => this.render());
    $('#sale-cal-y').onchange = () => this.cal(); $('#sale-cx-q').oninput = () => this.cx();
    segInit($('#sale-mm'), null, 'pp', () => this.map());
  },
  filt(skipDong = false) {
    const T = D.tx, ds = +$('#sale-dong').value, ab = $('#sale-area').value, y0 = +$('#sale-y0').value, y1 = +$('#sale-y1').value, nc = $('#sale-cancel').checked, ty = this.type;
    return txIdx(i => T.k[i] === 0 && T.t[i] === ty && (skipDong || ds < 0 || T.d[i] === ds) && X.tx.ay[i] >= Math.min(y0, y1) && X.tx.ay[i] <= Math.max(y0, y1) && (!nc || !(T.f[i] & 1)) && inArea(ab, T.ar[i] / 10) && gTx(i));
  },
  render() {
    const T = D.tx, idx = this.filt(), t = TK();
    this.idx = idx;
    const pp = idx.map(i => X.tx.pp[i]).filter(isFinite), amt = idx.map(i => T.a[i]);
    const direct = idx.filter(i => T.f[i] & 2).length;
    const allY = txIdx(i => T.k[i] === 0 && T.t[i] === this.type && (+$('#sale-dong').value < 0 || T.d[i] === +$('#sale-dong').value) && X.tx.ay[i] >= Math.min(+$('#sale-y0').value, +$('#sale-y1').value) && X.tx.ay[i] <= Math.max(+$('#sale-y0').value, +$('#sale-y1').value) && gTx(i));
    const canc = allY.filter(i => T.f[i] & 1).length;
    const byY = AY.map(y => idx.filter(i => X.tx.ay[i] === y).map(i => X.tx.pp[i]).filter(isFinite));
    const yA = Math.min(+$('#sale-y0').value, +$('#sale-y1').value), yB = Math.max(+$('#sale-y0').value, +$('#sale-y1').value);
    const mA = byY[AY.indexOf(yA)].length ? median(byY[AY.indexOf(yA)]) : null, mB = byY[AY.indexOf(yB)].length ? median(byY[AY.indexOf(yB)]) : null;
    $('#sale-kpis').innerHTML = kpiHTML([
      { l: '거래 건수', v: fN(idx.length), u: '건', d: `연평균 ${fN(idx.length / (yB - yA + 1))}건` },
      { l: `평당가 중앙값 (${ayShort(yB)})`, v: fN(mB), u: '만원', d: mA && yA !== yB ? delta(mB, mA) + ` vs ${ayShort(yA)}` : '&nbsp;' },
      { l: '거래금액 중앙값', v: fMan(median(amt)), d: `평균 ${fMan(mean(amt))}` },
      { l: '㎡당 가격 중앙값', v: fN(median(pp) / PY), u: '만원/㎡', d: this.type === 3 ? '단독·다가구는 연면적 기준' : '전용면적 기준' },
      { l: '직거래 비율', v: idx.length ? (direct / idx.length * 100).toFixed(1) : '–', u: '%', d: '높으면 가족 간 거래 등 시세 왜곡 주의' },
      { l: '해제 거래 비율', v: allY.length ? (canc / allY.length * 100).toFixed(1) : '–', u: '%', d: `${fN(canc)}건 해제` },
    ]);
    this.map();
    if (!idx.length) { ['sale-vol', 'sale-trend', 'sale-box', 'sale-hist', 'sale-scatter', 'sale-age', 'sale-floor', 'sale-party', 'sale-cal'].forEach(id => emptyChart(id)); this.cx(); return; }
    // 월별 거래량
    const nYM = X.tx.nYM, vol = new Array(nYM).fill(0); for (const i of idx) vol[X.tx.ym[i]]++;
    setOpt('sale-vol', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fN(v) + '건' }, grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
      xAxis: xCat(vol.map((_, i) => ymLabel(i))), yAxis: yVal(),
      series: [{ type: 'bar', data: vol, itemStyle: barStyle(css('--s1')), barCategoryGap: '20%', markLine: { silent: true, symbol: 'none', lineStyle: { color: t.ink2, width: 1 }, label: { color: t.ink2, formatter: '월평균 {c}건', fontSize: 10.5, position: 'insideEndTop' }, data: [{ yAxis: Math.round(mean(vol.filter(v => v > 0))) }] } }],
    }));
    const mb = monthlyBand(idx, i => X.tx.pp[i], nYM);
    setOpt('sale-trend', bandOpt(mb.q, mb.ma, '만원', '평당가'));
    // 가격지수
    if (this.type === 3) { emptyChart('sale-index', '단독·다가구는 단지 식별이 불가해 동일단지 지수를 만들 수 없습니다'); $('#sale-index-n').textContent = ''; }
    else {
      const ds2 = +$('#sale-dong').value, ab2 = $('#sale-area').value, ty2 = this.type;
      const ci = chainIndex(i => T.t[i] === ty2 && (ds2 < 0 || T.d[i] === ds2) && inArea(ab2, T.ar[i] / 10) && gTx(i), 3);
      const sm = AY.map(y => { const v = []; for (let i = 0; i < X.tx.n; i++) if (T.k[i] === 0 && T.t[i] === ty2 && !(T.f[i] & 1) && X.tx.ay[i] === y && (ds2 < 0 || T.d[i] === ds2) && inArea(ab2, T.ar[i] / 10) && isFinite(X.tx.pp[i]) && gTx(i)) v.push(X.tx.pp[i]); return v.length >= 5 ? median(v) : null; });
      const b0 = sm[0]; const smi = sm.map(v => v != null && b0 ? +(v / b0 * 100).toFixed(1) : null);
      setOpt('sale-index', base({
        tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: ${p.value == null ? '–' : p.value}`).join('<br>') + `<br><span style="color:var(--muted)">비교 단지·면적대 쌍 ${ci.pairs[ps[0].dataIndex] || '-'}개</span>` },
        legend: { top: 0, textStyle: { color: t.ink2 } }, grid: { left: 8, right: 90, top: 34, bottom: 4, containLabel: true },
        xAxis: xCat(AY.map(ayShort), { boundaryGap: false }), yAxis: yVal({ scale: true, axisLabel: { color: t.muted, formatter: v => v } }),
        series: [{ name: '동일단지 체인지수', type: 'line', data: ci.idx.map(v => v == null ? null : +v.toFixed(1)), lineStyle: { width: 3, color: css('--s1') }, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 9, endLabel: { show: true, color: t.ink2, formatter: p => '동일단지 ' + p.value } },
          { name: '단순 중앙값 지수', type: 'line', data: smi, lineStyle: { width: 2, color: t.other }, itemStyle: { color: t.other }, symbolSize: 6, endLabel: { show: true, color: t.ink2, formatter: p => '단순 ' + p.value } }],
        graphic: undefined,
      }));
      const last = ci.idx[ci.idx.length - 1], ls = smi[smi.length - 1];
      $('#sale-index-n').innerHTML = last != null && ls != null ? `21-22 → 25-26: 동일단지 기준 <b>${fP(last - 100)}</b> vs 단순 중앙값 ${fP(ls - 100)} — 차이 ${fN(Math.abs(ls - last), 1)}%p가 '어떤 집이 거래됐나'의 변화(구성 효과)입니다.` : '비교 가능한 단지 쌍이 부족한 연도가 있습니다.';
    }
    // 박스플롯 by 읍면동
    const byD = D.dongs.map((nm, d) => ({ nm, d, v: [] }));
    const idxAll = this.filt(true); for (const i of idxAll) if (isFinite(X.tx.pp[i])) byD[T.d[i]].v.push(X.tx.pp[i]);
    const bx = byD.filter(r => r.v.length >= 5).map(r => ({ ...r, b: boxStats(r.v) })).sort((a, b) => b.b[2] - a.b[2]);
    const ds = +$('#sale-dong').value;
    setOpt('sale-box', base({
      tooltip: { trigger: 'item', formatter: p => { const r = bx[p.dataIndex]; return `<b>${r.nm}</b> (n=${fN(r.v.length)})<br>최소(수염) ${fN(r.b[0])}<br>25% ${fN(r.b[1])}<br><b>중앙값 ${fN(r.b[2])}</b><br>75% ${fN(r.b[3])}<br>최대(수염) ${fN(r.b[4])} 만원/3.3㎡`; } },
      grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
      xAxis: xCat(bx.map(r => r.nm), { axisLabel: { color: t.ink2, fontSize: 11, interval: 0, rotate: 30 } }), yAxis: yVal({ name: '만원/3.3㎡' }),
      series: [{ type: 'boxplot', data: bx.map(r => ({ value: r.b, itemStyle: { color: mix(r.d === ds ? css('--brand') : css('--s1'), t.surf, .78), borderColor: r.d === ds ? css('--brand') : css('--s1'), borderWidth: 1.5 } })), boxWidth: ['30%', '60%'] }],
    }));
    const ho = histKdeOpt(pp, '만원', '만원/3.3㎡'); if (ho) setOpt('sale-hist', ho); else emptyChart('sale-hist');
    // 회귀
    const xs = [], ys = []; for (const i of idx) { const a = T.ar[i] / 10; if (a > 0) { xs.push(a); ys.push(T.a[i]); } }
    scatterReg('sale-scatter', xs, ys, '면적(㎡)', '거래금액(만원)', '#sale-ols', b => `${fN(b, 1)}만원/㎡`);
    // 연식
    const pts = [], byB = {}; for (const i of idx) { const by = T.by[i]; if (by > 1950 && isFinite(X.tx.pp[i])) { pts.push([by, X.tx.pp[i]]); const k = Math.floor(by / 3) * 3; (byB[k] = byB[k] || []).push(X.tx.pp[i]); } }
    const bk = Object.keys(byB).map(Number).sort((a, b) => a - b).filter(k => byB[k].length >= 5);
    const st2 = Math.max(1, Math.ceil(pts.length / 4000)); const sp = pts.filter((_, i) => i % st2 === 0);
    const syy = sorted(pts.map(p => p[1]));
    setOpt('sale-age', base({
      tooltip: { trigger: 'item', formatter: p => p.seriesIndex === 0 ? `건축 ${p.data[0]}년 · ${fN(p.data[1])}만원/3.3㎡` : `${p.data[0]}~${p.data[0] + 2}년 준공 중앙값 ${fN(p.data[1])}만원 (n=${p.data[2]})` },
      grid: { left: 8, right: 20, top: 16, bottom: 22, containLabel: true },
      xAxis: yVal({ name: '건축연도', nameLocation: 'middle', nameGap: 24, scale: true, axisLabel: { color: t.muted, formatter: v => v } }),
      yAxis: yVal({ name: '만원/3.3㎡', min: 0, max: Math.ceil(qs(syy, .995) || 1) }),
      series: [{ type: 'scatter', data: sp, symbolSize: 5, itemStyle: { color: css('--s1'), opacity: .3 }, large: true },
        { type: 'line', data: bk.map(k => [k + 1, median(byB[k]), byB[k].length]), lineStyle: { color: css('--s2'), width: 2.5 }, itemStyle: { color: css('--s2'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 7, z: 5 }],
    }));
    // 층별
    const FB = [['1~3층', 1, 3], ['4~6층', 4, 6], ['7~10층', 7, 10], ['11~15층', 11, 15], ['16~20층', 16, 20], ['21층+', 21, 99]];
    const fl = FB.map(([l, a, b]) => { const v = idx.filter(i => T.fl[i] >= a && T.fl[i] <= b).map(i => X.tx.pp[i]).filter(isFinite); return { l, n: v.length, m: v.length >= 3 ? median(v) : null }; });
    if (this.type === 3) emptyChart('sale-floor', '단독·다가구는 층 정보가 없습니다');
    else setOpt('sale-floor', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].name}</b><br>중앙값 ${fN(ps[0].value)}만원/3.3㎡ (n=${fN(fl[ps[0].dataIndex].n)})` },
      grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true }, xAxis: xCat(fl.map(r => r.l)), yAxis: yVal({ scale: true }),
      series: [{ type: 'bar', data: fl.map(r => r.m), itemStyle: barStyle(css('--s1')), barWidth: '55%', label: { show: true, position: 'top', color: t.ink2, fontSize: 10.5, formatter: p => p.value ? fN(p.value) : '' } }],
    }));
    // 거래방식/주체 (연도별 100%)
    const yrs = AY.filter(y => y >= yA && y <= yB);
    const cats = [['중개거래', i => !(T.f[i] & 2)], ['직거래', i => T.f[i] & 2]];
    const buyers = [['매수 개인', 1], ['매수 법인', 2], ['매수 공공·기타', 3]];
    const sh = (y, f) => { const s = idx.filter(i => X.tx.ay[i] === y); return s.length ? s.filter(f).length / s.length * 100 : 0; };
    const shb = (y, c) => { const s = idx.filter(i => X.tx.ay[i] === y && T.buy[i] > 0); return s.length ? s.filter(i => c === 3 ? T.buy[i] >= 3 : T.buy[i] === c).length / s.length * 100 : null; };
    setOpt('sale-party', base({
      tooltip: { trigger: 'axis', valueFormatter: v => v == null ? '–' : v.toFixed(1) + '%' },
      legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 16, top: 50, bottom: 4, containLabel: true },
      xAxis: xCat(yrs.map(ayShort), { boundaryGap: false }), yAxis: yVal({ axisLabel: { color: t.muted, formatter: '{value}%' } }),
      series: [
        { name: '직거래 비율', type: 'line', data: yrs.map(y => +sh(y, cats[1][1]).toFixed(1)), lineStyle: { width: 2, color: css('--s2') }, itemStyle: { color: css('--s2') }, symbolSize: 7 },
        { name: '매수 법인 비율', type: 'line', data: yrs.map(y => { const v = shb(y, 2); return v == null ? null : +v.toFixed(1); }), lineStyle: { width: 2, color: css('--s3') }, itemStyle: { color: css('--s3') }, symbolSize: 7 },
        { name: '매도 법인 비율(분양·시행 등)', type: 'line', data: yrs.map(y => { const s = idx.filter(i => X.tx.ay[i] === y && T.sel[i] > 0); return s.length ? +(s.filter(i => T.sel[i] === 2).length / s.length * 100).toFixed(1) : null; }), lineStyle: { width: 2, color: css('--s1') }, itemStyle: { color: css('--s1') }, symbolSize: 7 },
      ],
    }));
    this.cal(); this.cx();
  },
  map() {
    const m = makeMap('sale-map', { zoom: 11 }), mm = segVal($('#sale-mm')), T = D.tx, ds = +$('#sale-dong').value;
    const metric = mm === 'pp' ? { l: '평당가 중앙값 (만원/전용 3.3㎡)', agg: 'median', fmt: v => fN(v) + '만' } : mm === 'amt' ? { l: '거래금액 중앙값', agg: 'median', fmt: fMan } : { l: '매매 거래 건수', agg: 'count', fmt: v => fN(v) + '건' };
    drawLocMap(m, txLocAgg(this.idx || [], mm === 'pp' ? i => X.tx.pp[i] : mm === 'amt' ? i => T.a[i] : null), metric, { fit: ds >= 0 });
    if (ds < 0 && this._mds !== ds && !GEOF.on) m.setView([36.80, 127.02], 11); this._mds = ds;
  },
  cal() {
    const T = D.tx, y = +$('#sale-cal-y').value, cnt = {};
    const ds = +$('#sale-dong').value, ab = $('#sale-area').value, nc = $('#sale-cancel').checked;
    for (let i = 0; i < X.tx.n; i++) {
      if (!gTx(i) || T.k[i] !== 0 || T.t[i] !== this.type || (ds >= 0 && T.d[i] !== ds) || (nc && (T.f[i] & 1)) || !inArea(ab, T.ar[i] / 10)) continue;
      const d = new Date(BASE_MS + T.day[i] * 864e5); if (d.getUTCFullYear() !== y) continue;
      const k = d.toISOString().slice(0, 10); cnt[k] = (cnt[k] || 0) + 1;
    }
    const data = Object.entries(cnt), mx = Math.max(1, ...Object.values(cnt)), t = TK();
    setOpt('sale-cal', base({
      tooltip: { trigger: 'item', formatter: p => `${p.data[0]}<br>${p.data[1]}건` },
      visualMap: { show: false, min: 0, max: mx, inRange: { color: SEQ() } },
      calendar: { range: String(y), top: 54, left: 30, right: 6, cellSize: ['auto', 13], yearLabel: { show: false }, dayLabel: { nameMap: ['일', '월', '화', '수', '목', '금', '토'], color: t.muted, fontSize: 9 }, monthLabel: { nameMap: 'ZH', color: t.muted, fontSize: 9, formatter: p => (+p.M) + '월' }, splitLine: { show: false }, itemStyle: { color: t.surf, borderColor: t.grid, borderWidth: 1 } },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
      graphic: { type: 'text', left: 4, top: 4, style: { text: `${y}년 ${fN(sum(Object.values(cnt)))}건 · 일 최대 ${mx}건`, fill: t.muted, fontSize: 11, fontFamily: FONT } },
    }));
  },
  cx() {
    const T = D.tx, q = ($('#sale-cx-q').value || '').trim().replace(/\s/g, ''), ds = +$('#sale-dong').value;
    if (this.type === 3) { $('#sale-cx').innerHTML = '<div class="empty">단독·다가구는 번지가 비공개라 단지 랭킹을 만들 수 없습니다.</div>'; $('#sale-cxd-card').style.display = 'none'; return; }
    const agg = {};
    const yA = Math.min(+$('#sale-y0').value, +$('#sale-y1').value), yB = Math.max(+$('#sale-y0').value, +$('#sale-y1').value);
    for (let i = 0; i < X.tx.n; i++) {
      if (T.t[i] !== this.type || T.cx[i] < 0 || (T.f[i] & 1) || (ds >= 0 && T.d[i] !== ds) || !gTx(i)) continue;
      const c = T.cx[i], a = agg[c] = agg[c] || { s: {}, j: {}, n: 0, last: -1 };
      const y = X.tx.ay[i];
      if (T.k[i] === 0) { (a.s[y] = a.s[y] || []).push(X.tx.pp[i]); if (y >= yA && y <= yB) a.n++; a.last = Math.max(a.last, T.day[i]); }
      else if (T.k[i] === 1) (a.j[y] = a.j[y] || []).push(T.a[i] / (T.ar[i] / 10 / PY));
    }
    const rows = [];
    for (const [c, a] of Object.entries(agg)) {
      const cx = X.cx[c]; if (q && !cx.n.replace(/\s/g, '').includes(q)) continue;
      const ys = Object.keys(a.s).map(Number).sort(); if (!ys.length) continue;
      const fy = ys[0], ly = ys[ys.length - 1];
      const mF = median(a.s[fy]), mL = median(a.s[ly]);
      const jrs = (X.jr || buildJeonseRatio()).filter(r => r.cx === +c); const jy = jrs.length ? Math.max(...jrs.map(r => r.y)) : null; const jl = jrs.filter(r => r.y === jy); const jr = jl.length ? sum(jl.map(r => r.ratio * Math.min(r.ns, r.nj))) / sum(jl.map(r => Math.min(r.ns, r.nj))) : null;
      rows.push({ _id: c, 단지: cx.n, 읍면동: D.dongs[cx.d], 위치: cx.b + ' ' + cx.jb, 건축: cx.by || null, 거래: a.n, 최근연도: ayShort(ly), 평당: mL, 첫해: fy !== ly ? mF : null, 변동: fy !== ly ? (mL / mF - 1) * 100 : null, 전세가율: jr, 최근: a.last >= 0 ? new Date(BASE_MS + a.last * 864e5).toISOString().slice(0, 10) : '' });
    }
    const pc = v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${fP(v)}</span>`;
    renderTable($('#sale-cx'), [
      { k: '단지', l: '단지·건물명' }, { k: '읍면동', l: '읍면동' }, { k: '위치', l: '지번' }, { k: '건축', l: '건축연도', n: 1, f: v => v || '–' },
      { k: '거래', l: '매매(기간)', n: 1, f: v => fN(v) }, { k: '최근연도', l: '최근 연도' }, { k: '평당', l: '최근 평당가(만원)', n: 1, f: v => fN(v) },
      { k: '첫해', l: '첫 연도 평당가', n: 1, f: v => v == null ? '–' : fN(v) }, { k: '변동', l: '변동률', n: 1, f: pc },
      { k: '전세가율', l: '전세가율', n: 1, f: v => v == null ? '–' : `${v.toFixed(0)}% ${v >= 80 ? '<span class="badge b-crit">⚠ 주의</span>' : v >= 70 ? '<span class="badge b-ser">관찰</span>' : ''}` },
      { k: '최근', l: '최근 거래일' }], rows, { sortKey: '거래', limit: 400, sel: this.cxSel, onRow: id => { this.cxSel = +id; this.cxDetail(+id); this.cx(); } });
    if (this.cxSel != null) this.cxDetail(this.cxSel); else $('#sale-cxd-card').style.display = 'none';
  },
  cxDetail(c) {
    const T = D.tx, cx = X.cx[c], t = TK(); $('#sale-cxd-card').style.display = '';
    $('#sale-cxd-t').textContent = `${cx.n} — 거래 이력 (${cx.b} ${cx.jb}${cx.road ? ', ' + cx.road : ''})`;
    const s = [], j = []; const dt = d => new Date(BASE_MS + d * 864e5).toISOString().slice(0, 10);
    for (let i = 0; i < X.tx.n; i++) { if (T.cx[i] !== c || (T.f[i] & 1)) continue; const a = T.ar[i] / 10; if (!(a > 0)) continue; if (T.k[i] === 0) s.push([dt(T.day[i]), Math.round(X.tx.pp[i]), a, T.a[i], T.fl[i]]); else if (T.k[i] === 1) j.push([dt(T.day[i]), Math.round(T.a[i] / (a / PY)), a, T.a[i], T.fl[i]]); }
    setOpt('sale-cxd', base({
      tooltip: { trigger: 'item', formatter: p => `${p.seriesName} ${p.data[0]}<br>전용 ${p.data[2]}㎡ · ${p.data[4] > -99 ? p.data[4] + '층 · ' : ''}${fMan(p.data[3])}<br>평당 ${fN(p.data[1])}만원` },
      legend: { top: 0, textStyle: { color: t.ink2 } }, grid: { left: 8, right: 20, top: 34, bottom: 4, containLabel: true },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisLabel: { color: t.muted }, splitLine: { show: false } }, yAxis: yVal({ name: '만원/3.3㎡', scale: true }),
      series: [{ name: '매매', type: 'scatter', data: s, symbolSize: 8, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 1.5 } },
        { name: '전세(보증금)', type: 'scatter', data: j, symbolSize: 7, symbol: 'diamond', itemStyle: { color: css('--s2'), borderColor: t.surf, borderWidth: 1.5 } }],
    }));
  },
};
