/* =================== 연도 비교 (A년 vs B년) =================== */
// 시점 맞춤: 인구=그해 10월 · 실거래=그해 10.21~다음해 10.20 · 국민연금=그해 8~9월 자료(2022~2026)
const CMP_POP = { all: [...Array(13).keys()], c3040: [5, 6], c2039: [4, 5], c60: [8, 9, 10, 11, 12], c0019: [0, 1, 2, 3] };
const CMP_METRICS = [
  { id: 'pop', l: '인구 (명)', src: 'pop', ages: CMP_POP.all },
  { id: 'pop3040', l: '30~40대 인구 (명)', src: 'pop', ages: CMP_POP.c3040 },
  { id: 'pop2039', l: '20~39세 인구 (명)', src: 'pop', ages: CMP_POP.c2039 },
  { id: 'pop0019', l: '0~19세 인구 (명)', src: 'pop', ages: CMP_POP.c0019 },
  { id: 'pop60', l: '60세 이상 인구 (명)', src: 'pop', ages: CMP_POP.c60 },
  { id: 'pp', l: '매매 평당가 중앙값 (만원/전용 3.3㎡)', src: 'tx', ok: (T, i) => T.k[i] === 0 && !(T.f[i] & 1), val: i => X.tx.pp[i], agg: 'median', fmt: v => fN(v) + '만' },
  { id: 'amt', l: '매매 거래금액 중앙값', src: 'tx', ok: (T, i) => T.k[i] === 0 && !(T.f[i] & 1), val: i => D.tx.a[i], agg: 'median', fmt: fMan },
  { id: 'svol', l: '매매 거래량 (건)', src: 'tx', ok: (T, i) => T.k[i] === 0 && !(T.f[i] & 1), agg: 'count' },
  { id: 'jeon', l: '전세 보증금 중앙값', src: 'tx', ok: (T, i) => T.k[i] === 1, val: i => D.tx.a[i], agg: 'median', fmt: fMan },
  { id: 'wol', l: '월세 중앙값 (만원)', src: 'tx', ok: (T, i) => T.k[i] === 2, val: i => D.tx.r[i], agg: 'median', fmt: v => fN(v) + '만' },
  { id: 'wshare', l: '월세 비중 (%)', src: 'tx', ok: (T, i) => T.k[i] > 0, val: i => D.tx.k[i] === 2 ? 100 : 0, agg: 'mean', minN: 3, fmt: v => fN(v, 1) + '%' },
  { id: 'rvol', l: '전월세 계약량 (건)', src: 'tx', ok: (T, i) => T.k[i] > 0, agg: 'count' },
  { id: 'emp', l: '종사자 (국민연금 법인 가입자, 명)', src: 'nps' },
  { id: 'site', l: '사업장 수 (국민연금 법인, 곳)', src: 'nps', count: true },
];
const CMP_PRESETS = [[2025, 2022], [2024, 2021], [2025, 2021], [2025, 2024], [2023, 2021], [2026, 2022]];
VIEWS.cmp = {
  init() {
    fillSelect($('#cmp-metric'), CMP_METRICS.map(m => [m.id, m.l]), 'pop');
    fillSelect($('#cmp-type'), [['-1', '전체 유형'], ...D.tx.types.map((t, i) => [String(i), t])], '0');
    fillSelect($('#cmp-dong'), dongOpts(), '-1');
    $('#cmp-pre').innerHTML = CMP_PRESETS.map(([a, b]) => `<button data-a="${a}" data-b="${b}">${String(a).slice(2)}년 vs ${String(b).slice(2)}년</button>`).join('');
    $$('#cmp-pre button').forEach(bt => bt.onclick = () => { this.setYears(+bt.dataset.a, +bt.dataset.b); this.render(); });
    ['#cmp-metric', '#cmp-type', '#cmp-dong', '#cmp-a', '#cmp-b'].forEach(s => $(s).onchange = () => { if (s === '#cmp-metric') this.setYears(+$('#cmp-a').value, +$('#cmp-b').value); this.render(); });
    this.setYears(2025, 2022);
  },
  metric() { return CMP_METRICS.find(m => m.id === $('#cmp-metric').value); },
  years(m) { return m.src === 'nps' ? D.nps.months.map(s => +s.slice(0, 4)) : AY; },
  setYears(a, b) {
    const m = this.metric(), ys = this.years(m), clamp = y => ys.includes(y) ? y : (y > ys[ys.length - 1] ? ys[ys.length - 1] : ys[0]);
    const lab = y => m.src === 'pop' ? `${y}년 10월` : m.src === 'tx' ? `${y}년 (${ayLabel(y)})` : `${y}년 (${D.nps.months[ys.indexOf(y)]})`;
    fillSelect($('#cmp-a'), ys.map(y => [y, lab(y)]), clamp(a)); fillSelect($('#cmp-b'), ys.map(y => [y, lab(y)]), clamp(b));
    $('#cmp-type').disabled = m.src !== 'tx';
    $$('#cmp-pre button').forEach(bt => { const ok = ys.includes(+bt.dataset.a) && ys.includes(+bt.dataset.b); bt.disabled = !ok; bt.style.opacity = ok ? 1 : .4; bt.classList.toggle('on', +bt.dataset.a === +$('#cmp-a').value && +bt.dataset.b === +$('#cmp-b').value); });
  },
  /* 연도 y의 공간 단위별 값: [{key, lat, lon, v, n, d, name}] */
  units(m, y) {
    const out = new Map(), ty = +$('#cmp-type').value;
    if (m.src === 'pop') {
      const yi = D.pop.years.indexOf(y);
      for (let c = 0; c < X.pop.nc; c++) { if (!gCell(c)) continue; let s = 0; for (const a of m.ages) s += X.popAt(c, yi, 0, a) + X.popAt(c, yi, 1, a); out.set(c, { key: c, lat: X.pop.lat[c], lon: X.pop.lon[c], v: s, n: s, d: X.pop.d[c], grid: true }); }
    } else if (m.src === 'tx') {
      const T = D.tx, idx = []; for (let i = 0; i < X.tx.n; i++) if (X.tx.ay[i] === y && (ty < 0 || T.t[i] === ty) && m.ok(T, i) && gTx(i)) idx.push(i);
      for (const o of txLocAgg(idx, m.val || null).values()) { const v = aggVal(o, m.agg); if (v == null || (m.minN && o.n < m.minN)) continue; const [la, lo] = locLL(o.L); out.set(o.L, { key: o.L, lat: la, lon: lo, v, n: o.n, d: T.d[o.i0], o }); }
      this._idx = this._idx || {}; this._idx[y] = idx;
    } else {
      const N = D.nps, mi = D.nps.months.findIndex(s => +s.slice(0, 4) === y);
      for (let i = 0; i < X.nps.n; i++) {
        if (N.m[i] !== mi || !N.act[i] || !N.corp[i] || !gNps(i)) continue; const k = N.loc[i];
        const u = out.get(k) || { key: k, lat: X.nps.lat[i], lon: X.nps.lon[i], v: 0, n: 0, d: N.d[i], names: [] };
        u.v += m.count ? 1 : N.e[i]; u.n++; if (u.names.length < 4) u.names.push(N.names[N.n[i]] + ` (${N.e[i]}명)`); out.set(k, u);
      }
    }
    return out;
  },
  /* 읍면동·전체 집계 */
  dongVals(m, y) {
    const res = D.dongs.map(() => ({ v: null, n: 0 })), all = { v: null, n: 0 };
    if (m.src === 'tx') {
      const T = D.tx, idx = this._idx[y], by = D.dongs.map(() => []), al = [];
      for (const i of idx) { const v = m.val ? m.val(i) : 1; if (!isFinite(v)) continue; by[T.d[i]].push(v); al.push(v); }
      const ag = a => m.agg === 'count' ? a.length : !a.length ? null : m.agg === 'mean' ? mean(a) : median(a);
      by.forEach((a, d) => { res[d] = { v: a.length >= (m.agg === 'count' ? 0 : 3) ? ag(a) : null, n: a.length }; }); return { res, all: { v: ag(al), n: al.length } };
    }
    const U = this.units(m, y); let s = 0;
    for (const u of U.values()) { if (u.d >= 0) { res[u.d].v = (res[u.d].v || 0) + u.v; res[u.d].n += u.n; } s += u.v; }
    res.forEach(r => { if (r.v == null) r.v = 0; });
    return { res, all: { v: s, n: s } };
  },
  render() {
    const m = this.metric(), A = +$('#cmp-a').value, B = +$('#cmp-b').value, ds = +$('#cmp-dong').value, t = TK();
    this.setYears(A, B); this._idx = {};
    const fmt = m.fmt || (v => fN(v)), isCount = m.src !== 'tx' || m.agg === 'count';
    const UA = this.units(m, A), UB = this.units(m, B);
    const inDong = u => ds < 0 || u.d === ds;
    // 변화(단위별): 건수형은 없으면 0, 중앙값형은 두 해 모두 있을 때만
    const keys = new Set([...UA.keys(), ...UB.keys()]), diff = [];
    for (const k of keys) { const a = UA.get(k), b = UB.get(k); if (!a && !b) continue; if (!isCount && (!a || !b)) continue; const u = a || b; const dv = (a ? a.v : 0) - (b ? b.v : 0); if (isCount && dv === 0 && !(a && a.v) && !(b && b.v)) continue; diff.push(Object.assign({}, u, { v: dv, a: a ? a.v : 0, b: b ? b.v : 0, na: a ? a.n : 0, nb: b ? b.n : 0 })); }
    const lab = y => m.src === 'pop' ? `${y}년 10월` : m.src === 'tx' ? ayShort(y) : D.nps.months[D.nps.months.findIndex(s => +s.slice(0, 4) === y)];
    $('#cmp-ta').textContent = `A: ${lab(A)}`; $('#cmp-tb').textContent = `B: ${lab(B)}`; $('#cmp-td').textContent = `변화 지도 (A − B)`;
    const ty = +$('#cmp-type').value, tyl = m.src === 'tx' ? (ty < 0 ? '전체 유형' : D.tx.types[ty]) + ' · ' : '';
    $('#cmp-sub').innerHTML = `${tyl}<b>${esc(m.l)}</b> — A ${lab(A)} vs B ${lab(B)} · 두 지도는 <b>같은 색 눈금</b>을 쓰고 함께 움직입니다`;
    // 지도 3개
    const vals = [...UA.values(), ...UB.values()].filter(inDong).map(u => u.v).filter(v => !isCount || v > 0);
    const sc = turboScale(vals, { sqrt: isCount });
    const dsc = turboScale(diff.filter(inDong).map(u => u.v).filter(v => v !== 0), { sym: true });
    const maps = ['cmp-mapA', 'cmp-mapB', 'cmp-mapD'].map(id => makeMap(id, { zoom: 11 }));
    const pop = (u, y) => m.src === 'pop' ? `<b>격자 ${D.pop.gid[u.key]}</b> (${D.dongs[u.d] || ''})` : m.src === 'tx' ? locName(u.o) : `<b>사업장</b> (위치 근사)<br>${u.names.map(esc).join('<br>')}`;
    const drawSet = (mp, U, scale, title, isDiff) => {
      if (mp._cl) mp.removeLayer(mp._cl); const g = L.layerGroup(); mp._cl = g;
      const arr = [...U].filter(inDong).filter(u => isDiff ? true : (isCount ? u.v > 0 : true));
      const mxN = Math.max(1, ...arr.map(u => isDiff ? Math.max(u.na || 0, u.nb || 0) : u.n));
      for (const u of arr) {
        const col = scale.f(u.v), tip = () => isDiff ? `${pop(u)}<br>A ${fmt(u.a)} · B ${fmt(u.b)}<br><b>변화 ${u.v > 0 ? '+' : ''}${fmt(u.v)}</b>${!isCount && u.b ? ` (${fP((u.a / u.b - 1) * 100)})` : ''}` : `${pop(u)}<br><b>${esc(m.l)}: ${fmt(u.v)}</b>${m.src === 'tx' ? `<br>거래 ${fN(u.n)}건` : ''}`;
        if (u.grid || m.src === 'pop') L.rectangle([[u.lat - .000452, u.lon - .000561], [u.lat + .000452, u.lon + .000561]], { stroke: false, fillColor: col, fillOpacity: .8 }).bindPopup(tip).addTo(g);
        else L.circleMarker([u.lat, u.lon], { radius: 4 + 12 * Math.sqrt((isDiff ? Math.max(u.na, u.nb) : u.n) / mxN), color: css('--surface'), weight: 1, fillColor: col, fillOpacity: .85 }).bindPopup(tip).addTo(g);
      }
      g.addTo(mp); legendCtl(mp, turboLegend(title, scale, isDiff ? (v => fmt(Math.abs(v))) : fmt, isDiff ? (isCount ? '없는 곳은 0으로 계산' : '두 해 모두 값이 있는 곳만') : (m.src === 'pop' ? '100m 격자' : '원 크기 = 건수')));
      return arr.length;
    };
    const nA = drawSet(maps[0], UA.values(), sc, `${esc(m.l)} · A`, false), nB = drawSet(maps[1], UB.values(), sc, `${esc(m.l)} · B`, false), nD = drawSet(maps[2], diff, dsc, `변화 (A−B)`, true);
    // 동기화
    if (!this._sync) {
      this._sync = true; let lock = false;
      maps.forEach(a => a.on('move', () => { if (lock) return; lock = true; maps.forEach(b => { if (b !== a) b.setView(a.getCenter(), a.getZoom(), { animate: false }); }); lock = false; }));
    }
    const fitKey = ds + '|' + m.src + '|' + (GEOF.on ? GEOF.lat + ',' + GEOF.lon + ',' + GEOF.R : 'off');
    const refit = () => { if (GEOF.on) { maps[0].fitBounds(L.latLng(GEOF.lat, GEOF.lon).toBounds(GEOF.R * 2.4)); return; } const bb = ds >= 0 ? dongBounds(ds) : null; if (bb) maps[0].fitBounds(bb.pad(.05)); else maps[0].setView([36.80, 127.02], 11); };
    if (this._fit !== fitKey) { this._fit = fitKey; refit(); }
    setTimeout(() => { maps.forEach(x => x.invalidateSize({ pan: false })); const c = maps[0].getCenter(), z = maps[0].getZoom(); maps.forEach(x => { x.setView(c, z, { animate: false }); x.panBy([1, 0], { animate: false }); x.panBy([-1, 0], { animate: false }); }); }, 150);
    // 집계
    const DA = this.dongVals(m, A), DB = this.dongVals(m, B);
    const a0 = ds >= 0 ? DA.res[ds].v : DA.all.v, b0 = ds >= 0 ? DB.res[ds].v : DB.all.v;
    const rows = D.dongs.map((nm, d) => ({ _id: d, nm, a: DA.res[d].v, b: DB.res[d].v, na: DA.res[d].n, nb: DB.res[d].n })).map(r => Object.assign(r, { dv: r.a != null && r.b != null ? r.a - r.b : null, pc: r.a != null && r.b ? (r.a / r.b - 1) * 100 : null }));
    const up = rows.filter(r => r.dv > 0).length, dn = rows.filter(r => r.dv < 0).length, best = rows.filter(r => r.pc != null && (m.src !== 'pop' || r.b >= 1000)).sort((x, y) => y.pc - x.pc);
    $('#cmp-kpis').innerHTML = kpiHTML([
      { l: `A · ${lab(A)}${ds >= 0 ? ' · ' + D.dongs[ds] : ''}${GEOF.on ? ' · 반경 내' : ''}`, v: a0 == null ? '–' : fmt(a0) },
      { l: `B · ${lab(B)}${ds >= 0 ? ' · ' + D.dongs[ds] : ''}${GEOF.on ? ' · 반경 내' : ''}`, v: b0 == null ? '–' : fmt(b0) },
      { l: '변화 (A − B)', v: a0 != null && b0 != null ? (a0 - b0 > 0 ? '+' : '') + fmt(a0 - b0) : '–', d: a0 != null && b0 ? delta(a0, b0) : '&nbsp;' },
      { l: '증가 · 감소 읍면동', v: `${up} · ${dn}`, u: '곳', d: `비교 불가 ${17 - up - dn}곳` },
      { l: '변화율 1위 (인구 1천↑)', v: best[0] ? best[0].nm : '–', d: best[0] ? fP(best[0].pc) : '&nbsp;' },
      { l: '변화율 꼴찌', v: best.length ? best[best.length - 1].nm : '–', d: best.length ? fP(best[best.length - 1].pc) : '&nbsp;' },
    ]);
    // 덤벨
    const dr = rows.filter(r => r.a != null && r.b != null).sort((x, y) => (x.pc ?? 0) - (y.pc ?? 0));
    if (dr.length) setOpt('cmp-dumb', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = dr[ps[0].dataIndex]; return `<b>${r.nm}</b><br>A ${fmt(r.a)} · B ${fmt(r.b)}<br>변화 ${r.dv > 0 ? '+' : ''}${fmt(r.dv)} ${r.pc != null ? '(' + fP(r.pc) + ')' : ''}`; } },
      legend: { top: 0, data: ['A ' + lab(A), 'B ' + lab(B)], textStyle: { color: t.ink2 } }, grid: { left: 8, right: 24, top: 30, bottom: 4, containLabel: true },
      xAxis: yVal({ scale: true, axisLabel: { color: t.muted, formatter: v => m.fmt ? m.fmt(v).replace(/ .*/, '') : compact(v) } }), yAxis: xCat(dr.map(r => r.nm), { axisLabel: { color: t.ink2, fontSize: 11 } }),
      series: [
        { type: 'custom', silent: true, renderItem: (p, api) => { const y = api.value(0), a = api.coord([api.value(1), y]), b = api.coord([api.value(2), y]); return { type: 'line', shape: { x1: b[0], y1: b[1], x2: a[0], y2: a[1] }, style: { stroke: api.value(1) >= api.value(2) ? turbo(.88) : turbo(.12), lineWidth: 3, opacity: .75 } }; }, encode: { x: [1, 2], y: 0 }, data: dr.map((r, i) => [i, r.a, r.b]), z: 1 },
        { name: 'B ' + lab(B), type: 'scatter', data: dr.map((r, i) => [r.b, i]), symbolSize: 10, itemStyle: { color: t.other, borderColor: t.surf, borderWidth: 2 }, z: 2 },
        { name: 'A ' + lab(A), type: 'scatter', data: dr.map((r, i) => [r.a, i]), symbolSize: 12, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 2 }, z: 3 },
      ],
    })); else emptyChart('cmp-dumb', '두 해 모두 값이 있는 읍면동이 없습니다');
    // 변화율 막대
    const pr = rows.filter(r => r.pc != null).sort((x, y) => y.pc - x.pc);
    const mxp = Math.max(1, ...pr.map(r => Math.abs(r.pc)));
    if (pr.length) setOpt('cmp-rate', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = pr[ps[0].dataIndex]; return `<b>${r.nm}</b><br>${fP(r.pc)} (${fmt(r.b)} → ${fmt(r.a)})${m.src === 'pop' && r.b < 1000 ? '<br><span style="color:var(--muted)">인구 격자 비공개가 많아 신뢰도 낮음</span>' : ''}`; } },
      grid: { left: 8, right: 16, top: 12, bottom: 4, containLabel: true },
      xAxis: xCat(pr.map(r => r.nm), { axisLabel: { color: t.ink2, fontSize: 11, interval: 0, rotate: 30 } }), yAxis: yVal({ axisLabel: { color: t.muted, formatter: '{value}%' } }),
      series: [{ type: 'bar', barWidth: '60%', data: pr.map(r => ({ value: +r.pc.toFixed(1), itemStyle: { color: turbo(.5 + Math.max(-1, Math.min(1, r.pc / mxp)) / 2), borderRadius: r.pc >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4], opacity: m.src === 'pop' && r.b < 1000 ? .35 : 1 } })), label: { show: true, position: 'top', color: t.ink2, fontSize: 10, formatter: p => (p.value > 0 ? '+' : '') + p.value + '%' } }],
    })); else emptyChart('cmp-rate');
    // 표
    const pc = v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${fP(v)}</span>`;
    renderTable($('#cmp-table'), [{ k: 'nm', l: '읍면동' }, { k: 'b', l: 'B ' + lab(B), n: 1, f: v => v == null ? '–' : fmt(v) }, { k: 'a', l: 'A ' + lab(A), n: 1, f: v => v == null ? '–' : fmt(v) },
      { k: 'dv', l: '변화 (A−B)', n: 1, f: v => v == null ? '–' : `<span class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${v > 0 ? '+' : ''}${fmt(v)}</span>` }, { k: 'pc', l: '변화율', n: 1, f: pc },
      ...(m.src === 'tx' && m.agg !== 'count' ? [{ k: 'nb', l: 'B 건수', n: 1, f: v => fN(v) }, { k: 'na', l: 'A 건수', n: 1, f: v => fN(v) }] : [])],
      rows, { sortKey: 'pc', sel: ds >= 0 ? ds : null, onRow: id => { $('#cmp-dong').value = id; this.render(); } });
    $('#cmp-note').innerHTML = m.src === 'tx' && m.agg === 'median' ? '⚠ 중앙값 비교는 그해 <b>어떤 집이 거래됐는지(구성 효과)</b>에 영향을 받습니다. 같은 단지끼리 비교한 실제 가격 변화는 [매매 시장] 탭의 <b>동일단지 체인지수</b>를 함께 보세요.'
      : m.src === 'pop' ? '⚠ 인구 격자는 5명 이하 칸이 0으로 공개된 것으로 추정되어, 인구가 적은 면 지역(송악·선장·도고·영인)은 증감이 과장되거나 축소될 수 있습니다(흐린 막대).'
        : m.src === 'nps' ? '⚠ 국민연금 자료는 22~24년이 법인만이라 비교는 법인 기준으로 합니다. 본사 일괄 신고 사업장(예: 2023년 영인면 모트라스)은 실제 근무지와 다를 수 있습니다.' : '';
  },
};
