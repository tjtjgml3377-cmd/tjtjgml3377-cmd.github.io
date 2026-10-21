/* =================== 인구 =================== */
const AGE_GROUPS = [['0~19세(유아~고교)', [0, 1, 2, 3]], ['20~39세', [4, 5]], ['40~59세', [6, 7]], ['60세 이상', [8, 9, 10, 11, 12]]];
function popAgg(dsel, yi, cellFilter) {   // dsel: -1=전체
  const r = { m: new Array(X.pop.NA).fill(0), f: new Array(X.pop.NA).fill(0) };
  for (let c = 0; c < X.pop.nc; c++) {
    if (dsel >= 0 && X.pop.d[c] !== dsel) continue;
    if (!gCell(c)) continue;
    if (cellFilter && !cellFilter(c)) continue;
    for (let a = 0; a < X.pop.NA; a++) { r.m[a] += X.popAt(c, yi, 0, a); r.f[a] += X.popAt(c, yi, 1, a); }
  }
  return r;
}
function pyramidOpt(cur, cmp, labCur, labCmp) {
  const t = TK(), ages = D.pop.ages;
  const mx = Math.max(...cur.m, ...cur.f, ...(cmp ? cmp.m.concat(cmp.f) : [0]));
  const ser = [];
  if (cmp) ser.push(
    { name: labCmp + ' 남', type: 'bar', stack: 'c', barGap: '-100%', data: cmp.m.map(v => -v), itemStyle: { color: mix(css('--s1'), t.surf, .65), borderRadius: [4, 0, 0, 4] }, barWidth: '78%', z: 1 },
    { name: labCmp + ' 여', type: 'bar', stack: 'c', data: cmp.f, itemStyle: { color: mix(css('--s2'), t.surf, .65), borderRadius: [0, 4, 4, 0] }, z: 1 });
  ser.push(
    { name: labCur + ' 남', type: 'bar', stack: 'p', data: cur.m.map(v => -v), itemStyle: { color: css('--s1'), borderRadius: [4, 0, 0, 4] }, barWidth: cmp ? '46%' : '70%', z: 2 },
    { name: labCur + ' 여', type: 'bar', stack: 'p', data: cur.f, itemStyle: { color: css('--s2'), borderRadius: [0, 4, 4, 0] }, z: 2 });
  return base({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].name}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: ${fN(Math.abs(p.value))}명`).join('<br>') },
    legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } },
    grid: { left: 8, right: 16, top: 52, bottom: 4, containLabel: true },
    xAxis: yVal({ min: -mx * 1.05, max: mx * 1.05, axisLabel: { color: t.muted, formatter: v => compact(Math.abs(v)) } }),
    yAxis: xCat(ages, { axisLabel: { color: t.ink2, fontSize: 11 } }),
    series: ser,
  });
}
VIEWS.pop = {
  init() {
    const yrs = D.pop.years.map((y, i) => [String(i), y + '년 10월']);
    fillSelect($('#pop-dong'), dongOpts(), '-1'); fillSelect($('#pop-y'), yrs, '4'); fillSelect($('#pop-y0'), yrs, '0');
    fillSelect($('#pop-age'), [['all', '전체 연령'], ['3040', '30~40대'], ['2039', '20~39세'], ['kid', '0~19세'], ['60', '60세 이상'], ...D.pop.ages.map((a, i) => ['a' + i, a])], 'all');
    ['#pop-dong', '#pop-y', '#pop-y0', '#pop-age'].forEach(s => $(s).onchange = () => this.render());
    segInit($('#pop-mode'), null, 'lvl', () => this.render());
  },
  ageIdx(v) { return v === 'all' ? [...Array(13).keys()] : v === '3040' ? [5, 6] : v === '2039' ? [4, 5] : v === 'kid' ? [0, 1, 2, 3] : v === '60' ? [8, 9, 10, 11, 12] : [+v.slice(1)]; },
  render() {
    const ds = +$('#pop-dong').value, yi = +$('#pop-y').value, y0 = +$('#pop-y0').value, Y = D.pop.years;
    const cur = popAgg(ds, yi), cmp = popAgg(ds, y0), t = TK();
    const tc = popTotal(cur), t0 = popTotal(cmp);
    const sexRatio = sum(cur.m) / Math.max(1, sum(cur.f)) * 100;
    const kids = AKID.reduce((s, a) => s + cur.m[a] + cur.f[a], 0), old = A60.reduce((s, a) => s + cur.m[a] + cur.f[a], 0);
    $('#pop-kpis').innerHTML = kpiHTML([
      { l: `총인구 (${Y[yi]})`, v: fN(tc), u: '명', d: delta(tc, t0) + ` vs ${Y[y0]}` },
      { l: '30~40대 비중', v: (share(cur, A3040) || 0).toFixed(1), u: '%', d: delta(share(cur, A3040), share(cmp, A3040), true) },
      { l: '20~39세 비중 (청년층)', v: (share(cur, [4, 5]) || 0).toFixed(1), u: '%', d: delta(share(cur, [4, 5]), share(cmp, [4, 5]), true) },
      { l: '60세 이상 비중', v: (share(cur, A60) || 0).toFixed(1), u: '%', d: delta(share(cur, A60), share(cmp, A60), true) },
      { l: '노령화지수 (60+ ÷ 0~19세 ×100)', v: kids ? fN(old / kids * 100) : '–', d: '추정 · 연령 구간 차이' },
      { l: '성비 (여성 100명당 남성)', v: fN(sexRatio, 1), d: '산업단지 지역일수록 높음' },
    ]);
    setOpt('pop-pyr', pyramidOpt(cur, y0 !== yi ? cmp : null, String(Y[yi]), String(Y[y0])));
    // 연령구조
    const struct = AGE_GROUPS.map(([, idx]) => Y.map((_, i) => { const p = popAgg(ds, i); const tt = popTotal(p); return tt ? idx.reduce((s, a) => s + p.m[a] + p.f[a], 0) / tt * 100 : 0; }));
    const ramp = [css('--q2'), css('--q4'), css('--q5'), css('--q7')];
    setOpt('pop-struct', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => v.toFixed(1) + '%' },
      legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 8, top: 50, bottom: 4, containLabel: true },
      xAxis: xCat(Y.map(String)), yAxis: yVal({ max: 100, axisLabel: { color: t.muted, formatter: '{value}%' } }),
      series: AGE_GROUPS.map(([nm], gi) => ({ name: nm, type: 'bar', stack: 's', data: struct[gi].map(v => +v.toFixed(2)), itemStyle: { color: ramp[gi], borderColor: t.surf, borderWidth: 1 }, barWidth: '58%' })),
    }));
    // 연령대 증감
    const chg = D.pop.ages.map((_, a) => (cur.m[a] + cur.f[a]) - (cmp.m[a] + cmp.f[a]));
    const mxc = Math.max(1, ...chg.map(Math.abs));
    setOpt('pop-agechg', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].name}</b><br>${Y[y0]}→${Y[yi]}: ${ps[0].value > 0 ? '+' : ''}${fN(ps[0].value)}명` },
      grid: { left: 8, right: 16, top: 12, bottom: 4, containLabel: true },
      xAxis: xCat(D.pop.ages, { axisLabel: { color: t.muted, fontSize: 10.5, interval: 0, rotate: 40 } }), yAxis: yVal(),
      series: [{ type: 'bar', data: chg.map(v => ({ value: v, itemStyle: { color: v >= 0 ? css('--dv-pos') : css('--dv-neg'), borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })), barWidth: '64%' }],
    }));
    // 추이
    const tr = Y.map((_, i) => popAgg(ds, i));
    setOpt('pop-trend', base({
      tooltip: { trigger: 'axis', valueFormatter: v => fN(v) + '명' }, legend: { top: 0, textStyle: { color: t.ink2 } },
      grid: { left: 8, right: 34, top: 34, bottom: 4, containLabel: true },
      xAxis: xCat(Y.map(String), { boundaryGap: false }), yAxis: yVal({ scale: true }),
      series: [
        { name: '남성', type: 'line', data: tr.map(p => sum(p.m)), lineStyle: { width: 2, color: css('--s1') }, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 8, endLabel: { show: true, color: t.ink2, formatter: '남' } },
        { name: '여성', type: 'line', data: tr.map(p => sum(p.f)), lineStyle: { width: 2, color: css('--s2') }, itemStyle: { color: css('--s2'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 8, endLabel: { show: true, color: t.ink2, formatter: '여' } },
      ],
    }));
    // 읍면동 증감
    const pc = popByDong(yi, true), p0 = popByDong(y0, true);
    const rows = D.dongs.map((nm, d) => ({ nm, d, v: popTotal(pc[d]) - popTotal(p0[d]), b: popTotal(p0[d]) })).sort((a, b) => b.v - a.v);
    setOpt('pop-dongchg', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.nm}</b><br>${Y[y0]} ${fN(r.b)}명 → ${Y[yi]} ${fN(r.b + r.v)}명<br>증감 ${r.v > 0 ? '+' : ''}${fN(r.v)}명 (${r.b ? fP(r.v / r.b * 100) : '–'})`; } },
      grid: { left: 8, right: 16, top: 12, bottom: 4, containLabel: true },
      xAxis: xCat(rows.map(r => r.nm), { axisLabel: { color: t.ink2, fontSize: 11, interval: 0, rotate: 30 } }), yAxis: yVal(),
      series: [{ type: 'bar', barWidth: '60%', data: rows.map(r => ({ value: r.v, itemStyle: { color: r.d === ds ? css('--brand') : (r.v >= 0 ? css('--dv-pos') : css('--dv-neg')), borderRadius: r.v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })), label: { show: true, position: 'top', color: t.ink2, fontSize: 10.5, formatter: p => (p.value > 0 ? '+' : '') + compact(p.value) } }],
    }));
    this.map(ds, yi, y0);
  },
  map(ds, yi, y0) {
    const m = makeMap('pop-map', { zoom: 11 });
    if (m._cells) m.removeLayer(m._cells);
    const mode = segVal($('#pop-mode')), idx = this.ageIdx($('#pop-age').value), Y = D.pop.years;
    const val = (c, y) => idx.reduce((s, a) => s + X.popAt(c, y, 0, a) + X.popAt(c, y, 1, a), 0);
    const cells = []; for (let c = 0; c < X.pop.nc; c++) { if ((ds >= 0 && X.pop.d[c] !== ds) || !gCell(c)) continue; const v = mode === 'lvl' ? val(c, yi) : val(c, yi) - val(c, y0); if (mode === 'lvl' ? v > 0 : v !== 0) cells.push([c, v]); }
    const g = L.layerGroup(); const dLat = 0.000452, dLon = 0.000561;
    const sc = turboScale(cells.map(x => x[1]), mode === 'lvl' ? { sqrt: true } : { sym: true });
    for (const [c, v] of cells) {
      const col = sc.f(v);
      const la = X.pop.lat[c], lo2 = X.pop.lon[c];
      const r = L.rectangle([[la - dLat, lo2 - dLon], [la + dLat, lo2 + dLon]], { stroke: false, fillColor: col, fillOpacity: .78 });
      r.on('click', () => {
        const rows = D.pop.ages.map((a, i) => `<tr><td>${a}</td><td style="text-align:right">${X.popAt(c, yi, 0, i)}</td><td style="text-align:right">${X.popAt(c, yi, 1, i)}</td></tr>`).join('');
        const tot = y => { let s = 0; for (let a = 0; a < 13; a++) s += X.popAt(c, y, 0, a) + X.popAt(c, y, 1, a); return s; };
        L.popup().setLatLng([la, lo2]).setContent(`<b>${D.dongs[X.pop.d[c]] || ''} 격자 ${D.pop.gid[c]}</b><br>${Y[yi]}: ${fN(tot(yi))}명 · ${Y[y0]}: ${fN(tot(y0))}명<br>5년 추이: ${Y.map((_, y) => fN(tot(y))).join(' → ')}<table style="margin-top:4px;font-size:11.5px"><tr><th>연령</th><th>남</th><th>여</th></tr>${rows}</table>`).openOn(m);
      });
      g.addLayer(r);
    }
    g.addTo(m); m._cells = g;
    if (ds >= 0 && cells.length) { const b = L.latLngBounds(cells.map(([c]) => [X.pop.lat[c], X.pop.lon[c]])); m.fitBounds(b.pad(.15)); }
    else if (!m._fitted && !GEOF.on) { m.setView([36.79, 127.02], 11); m._fitted = true; }
    if (mode === 'lvl') legendCtl(m, turboLegend(`인구 (${Y[yi]}, 명/100m 격자)`, sc, v => fN(v), '터보 색상 · 제곱근 눈금'));
    else legendCtl(m, turboLegend(`증감 (${Y[y0]}→${Y[yi]}, 명)`, sc, v => fN(Math.abs(v)), '5명 이하 비공개로 0 처리된 칸 주의'));
  },
};
