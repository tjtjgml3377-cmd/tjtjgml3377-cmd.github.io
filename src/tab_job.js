/* =================== 일자리 (국민연금) =================== */
const feeRate = m => (D.nps.months[m] >= '2026-01' ? 0.095 : 0.09);
VIEWS.job = {
  init() {
    const ms = D.nps.months.map((m, i) => [String(i), m.replace('-', '.') + ' 기준']);
    fillSelect($('#job-m'), ms, String(ms.length - 1)); fillSelect($('#job-m0'), ms, '0'); fillSelect($('#job-dong'), dongOpts(), '-1');
    ['#job-m', '#job-m0', '#job-dong'].forEach(s => $(s).onchange = () => this.render());
    segInit($('#job-corp'), null, '1', () => this.render());
    let tm; $('#job-q').oninput = () => { clearTimeout(tm); tm = setTimeout(() => this.render(), 250); };
    $('#job-tq').oninput = () => this.table();
  },
  match(i) {
    const N = D.nps, ds = +$('#job-dong').value, corp = segVal($('#job-corp')) === '1', q = ($('#job-q').value || '').trim();
    if (!N.act[i] || !gNps(i)) return false; if (corp && !N.corp[i]) return false; if (ds >= 0 && N.d[i] !== ds) return false;
    if (q && !N.inds[N.i[i]].includes(q) && !N.names[N.n[i]].includes(q)) return false; return true;
  },
  render() {
    const N = D.nps, t = TK(), m = +$('#job-m').value, m0 = +$('#job-m0').value, M = N.months;
    const cur = [], prev = []; for (let i = 0; i < X.nps.n; i++) { if (!this.match(i)) continue; if (N.m[i] === m) cur.push(i); if (N.m[i] === m0) prev.push(i); }
    this.cur = cur; this.prev = prev;
    const E = sum(cur.map(i => N.e[i])), E0 = sum(prev.map(i => N.e[i]));
    const fee = sum(cur.map(i => N.fee[i])) * 1000, inc = E ? fee / E / feeRate(m) : null;
    const fee0 = sum(prev.map(i => N.fee[i])) * 1000, inc0 = E0 ? fee0 / E0 / feeRate(m0) : null;
    const nw = sum(cur.map(i => N.nw[i])), ls = sum(cur.map(i => N.ls[i]));
    $('#job-kpis').innerHTML = kpiHTML([
      { l: '가입 사업장', v: fN(cur.length), u: '곳', d: delta(cur.length, prev.length) + ` vs ${M[m0]}` },
      { l: '가입자 (종사자)', v: fN(E), u: '명', d: delta(E, E0) + ` vs ${M[m0]}` },
      { l: '사업장당 평균 가입자', v: cur.length ? fN(E / cur.length, 1) : '–', u: '명', d: '&nbsp;' },
      { l: '추정 평균 월소득 (기준소득월액)', v: inc ? fN(inc / 10000) : '–', u: '만원', d: inc0 ? delta(inc, inc0) + ' · 상한 적용으로 과소추정' : '추정' },
      { l: '당월 신규 취득', v: fN(nw), u: '명', d: `상실 ${fN(ls)}명 · 순증 ${nw - ls >= 0 ? '+' : ''}${fN(nw - ls)}` },
    ]);
    // 트리맵
    const byI = {}; for (const i of cur) { const k = N.inds[N.i[i]]; byI[k] = (byI[k] || 0) + N.e[i]; }
    const ti = Object.entries(byI).sort((a, b) => b[1] - a[1]); const top = ti.slice(0, 80), rest = sum(ti.slice(80).map(x => x[1]));
    const SC = SER();
    const tdata = top.map(([k, v], j) => ({ name: k, value: v, itemStyle: { color: j < 3 ? '#184f95' : j < 10 ? '#256abf' : '#3987e5', borderColor: t.surf, borderWidth: 2, gapWidth: 2 } }));
    if (rest) tdata.push({ name: `기타 ${ti.length - 80}개 업종`, value: rest, itemStyle: { color: t.other } });
    if (tdata.length) setOpt('job-tree', base({
      tooltip: { trigger: 'item', formatter: p => `<b>${esc(p.name)}</b><br>가입자 ${fN(p.value)}명 (${(p.value / E * 100).toFixed(1)}%)` },
      series: [{ type: 'treemap', data: tdata, roam: false, nodeClick: false, breadcrumb: { show: false }, top: 4, left: 4, right: 4, bottom: 4, label: { show: true, color: '#fff', fontSize: 11.5, formatter: p => `${p.name}\n${fN(p.value)}명`, overflow: 'truncate' }, upperLabel: { show: false } }],
    })); else emptyChart('job-tree');
    chart('job-tree').off('click'); chart('job-tree').on('click', p => { if (!p.name.startsWith('기타 ')) { $('#job-q').value = p.name; this.render(); } });
    // 읍면동 증감
    const dd = D.dongs.map((nm, d) => { let a = 0, b = 0; for (const i of cur) if (N.d[i] === d) a += N.e[i]; for (const i of prev) if (N.d[i] === d) b += N.e[i]; return { nm, d, v: a - b, a, b }; }).sort((x, y) => y.v - x.v);
    setOpt('job-dongchg', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = dd[ps[0].dataIndex]; return `<b>${r.nm}</b><br>${M[m0]} ${fN(r.b)}명 → ${M[m]} ${fN(r.a)}명<br>증감 ${r.v >= 0 ? '+' : ''}${fN(r.v)}명`; } },
      grid: { left: 8, right: 40, top: 8, bottom: 4, containLabel: true }, xAxis: yVal(), yAxis: xCat(dd.map(r => r.nm), { inverse: true, axisLabel: { color: t.ink2, fontSize: 11 } }),
      series: [{ type: 'bar', barWidth: '60%', data: dd.map(r => ({ value: r.v, itemStyle: { color: r.v >= 0 ? css('--dv-pos') : css('--dv-neg'), borderRadius: r.v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })), label: { show: true, position: 'right', color: t.ink2, fontSize: 10.5, formatter: p => (p.value > 0 ? '+' : '') + compact(p.value) } }],
    }));
    // 추이
    const tr = M.map((_, mi) => { let e = 0, s = 0; for (let i = 0; i < X.nps.n; i++) if (N.m[i] === mi && this.match(i)) { e += N.e[i]; s++; } return [e, s]; });
    setOpt('job-trend', base({
      tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>가입자 ${fN(tr[ps[0].dataIndex][0])}명<br>사업장 ${fN(tr[ps[0].dataIndex][1])}곳` },
      grid: { left: 8, right: 30, top: 20, bottom: 4, containLabel: true }, xAxis: xCat(M, { boundaryGap: false }), yAxis: yVal({ scale: true }),
      series: [{ type: 'line', data: tr.map(x => x[0]), lineStyle: { width: 2.5, color: css('--s1') }, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 8, areaStyle: { color: css('--s1'), opacity: .08 }, label: { show: true, color: t.ink2, fontSize: 10.5, formatter: p => compact(p.value) } }],
    }));
    // 규모
    const SB = [['1~4명', 1, 4], ['5~9명', 5, 9], ['10~29명', 10, 29], ['30~99명', 30, 99], ['100~299명', 100, 299], ['300명+', 300, 1e9]];
    const sb = SB.map(([l, a, b]) => { const s = cur.filter(i => N.e[i] >= a && N.e[i] <= b); return { l, n: s.length, e: sum(s.map(i => N.e[i])) }; });
    const ramp = [css('--q2'), css('--q3'), css('--q4'), css('--q5'), css('--q6'), css('--q7')];
    setOpt('job-size', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = sb[ps[0].dataIndex]; return `<b>${r.l}</b><br>사업장 ${fN(r.n)}곳<br>가입자 ${fN(r.e)}명 (${E ? (r.e / E * 100).toFixed(1) : 0}%)`; } },
      grid: { left: 8, right: 16, top: 20, bottom: 4, containLabel: true }, xAxis: xCat(sb.map(r => r.l), { axisLabel: { color: t.muted, interval: 0, fontSize: 10.5 } }), yAxis: yVal({ name: '사업장 수' }),
      series: [{ type: 'bar', barWidth: '58%', data: sb.map((r, k) => ({ value: r.n, itemStyle: barStyle(ramp[k]) })), label: { show: true, position: 'top', color: t.ink2, fontSize: 10.5 } }],
    }));
    // 고용 회전
    const turn = {}; for (const i of cur) { const k = N.inds[N.i[i]]; const r = turn[k] = turn[k] || [0, 0]; r[0] += N.nw[i]; r[1] += N.ls[i]; }
    const tt = Object.entries(turn).sort((a, b) => (b[1][0] + b[1][1]) - (a[1][0] + a[1][1])).slice(0, 12).reverse();
    setOpt('job-turn', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${esc(tt[ps[0].dataIndex][0])}</b><br>신규 ${fN(tt[ps[0].dataIndex][1][0])}명 · 상실 ${fN(tt[ps[0].dataIndex][1][1])}명` },
      legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      xAxis: yVal({ axisLabel: { color: t.muted, formatter: v => compact(Math.abs(v)) } }), yAxis: xCat(tt.map(x => x[0].length > 12 ? x[0].slice(0, 12) + '…' : x[0]), { axisLabel: { color: t.ink2, fontSize: 10.5 } }),
      series: [{ name: '신규 취득', type: 'bar', stack: 'x', data: tt.map(x => x[1][0]), itemStyle: { color: css('--dv-pos'), borderRadius: [0, 4, 4, 0] } }, { name: '상실', type: 'bar', stack: 'x', data: tt.map(x => -x[1][1]), itemStyle: { color: css('--dv-neg'), borderRadius: [4, 0, 0, 4] } }],
    }));
    this.map(); this.table();
  },
  map() {
    const N = D.nps, m = makeMap('job-map', { zoom: 11 }); if (m._pts) m.removeLayer(m._pts);
    const g = L.layerGroup(); const mx = Math.max(1, ...this.cur.map(i => N.e[i]));
    const cur = this.cur.slice().sort((a, b) => N.e[b] - N.e[a]);
    const sc = turboScale(cur.map(i => N.e[i]), { sqrt: true, lo: 1 });
    for (const i of cur) {
      const r = 3 + 22 * Math.sqrt(N.e[i] / mx);
      L.circleMarker([X.nps.lat[i], X.nps.lon[i]], { radius: r, color: css('--surface'), weight: 1, fillColor: sc.f(N.e[i]), fillOpacity: .78 })
        .bindPopup(`<b>${esc(N.names[N.n[i]])}</b><br>${esc(N.inds[N.i[i]])}<br>${D.dongs[N.d[i]]} · 가입자 ${fN(N.e[i])}명<br><span style="color:var(--muted)">위치는 도로명 중심 근사</span>`).addTo(g);
    }
    g.addTo(m); m._pts = g;
    legendCtl(m, turboLegend(`사업장 가입자 수 (${D.nps.months[+$('#job-m').value]})`, sc, v => fN(v) + '명', `원 크기·색 = 가입자 수 · 최대 ${fN(mx)}명`));
  },
  table() {
    const N = D.nps, q = ($('#job-tq').value || '').trim(), m = +$('#job-m').value;
    const prevBy = {}; for (const i of this.prev) prevBy[N.names[N.n[i]] + '|' + N.d[i]] = (prevBy[N.names[N.n[i]] + '|' + N.d[i]] || 0) + N.e[i];
    const rows = this.cur.filter(i => !q || N.names[N.n[i]].includes(q)).map(i => {
      const k = N.names[N.n[i]] + '|' + N.d[i], p = prevBy[k];
      return { _id: i, nm: N.names[N.n[i]], ind: N.inds[N.i[i]], dong: D.dongs[N.d[i]], e: N.e[i], chg: p != null ? N.e[i] - p : null, inc: N.e[i] ? N.fee[i] * 1000 / N.e[i] / feeRate(m) / 10000 : null, since: N.since[i] || null, form: N.corp[i] ? '법인' : '개인' };
    });
    renderTable($('#job-table'), [{ k: 'nm', l: '사업장명' }, { k: 'ind', l: '업종' }, { k: 'dong', l: '읍면동' }, { k: 'form', l: '형태' },
      { k: 'e', l: '가입자', n: 1, f: v => fN(v) }, { k: 'chg', l: '증감(비교월)', n: 1, f: v => v == null ? '<span class="badge b-good">신규</span>' : `<span class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${v > 0 ? '+' : ''}${fN(v)}</span>` },
      { k: 'inc', l: '추정 월소득(만원)', n: 1, f: v => v == null ? '–' : fN(v) }, { k: 'since', l: '적용연도', n: 1, f: v => v || '–' }], rows, { sortKey: 'e', limit: 500 });
  },
};
