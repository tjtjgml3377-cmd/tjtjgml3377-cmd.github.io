/* =================== 상권 (소상공인 전 필드) =================== */
const EMPTY = '(빈값)';
const stLab = v => v === '' ? EMPTY : v;
VIEWS.store = {
  filters: [], page: 0,
  init() {
    const F = D.st.fields.map(f => [f, f]);
    fillSelect($('#st-fa'), F, '상권업종대분류명'); fillSelect($('#st-fb'), F, '행정동명'); fillSelect($('#st-ff'), F, '상권업종중분류명');
    $('#st-fa').onchange = $('#st-fb').onchange = $('#st-n').onchange = () => this.render();
    segInit($('#st-ct'), null, 'bar', () => this.chartA());
    segInit($('#st-xn'), null, 'n', () => this.cross());
    $('#st-ff').onchange = () => this.fillVals(); this.fillVals();
    $('#st-add').onclick = () => { const f = $('#st-ff').value, v = $('#st-fv').value; if (v === '') return; this.addFilter(f, v === EMPTY ? '' : v); $('#st-fv').value = ''; };
    $('#st-fv').onkeydown = e => { if (e.key === 'Enter') $('#st-add').click(); };
    let tm; $('#st-q').oninput = () => { clearTimeout(tm); tm = setTimeout(() => { this.page = 0; this.table(); }, 200); };
    $('#st-csv').onclick = () => this.csv();
  },
  fillVals() {
    const f = $('#st-ff').value, col = X.stCol(f), cnt = new Map();
    for (const c of col.c) cnt.set(c, (cnt.get(c) || 0) + 1);
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 600);
    $('#st-fv-list').innerHTML = top.map(([c, n]) => `<option value="${esc(stLab(col.v[c]))}">${n}곳</option>`).join('');
  },
  addFilter(f, v) { if (!this.filters.some(x => x.f === f && x.v === v)) this.filters.push({ f, v }); this.page = 0; this.render(); },
  idx() {
    const fs = this.filters.map(x => { const col = X.stCol(x.f); const ci = col.v.indexOf(x.v); return [col.c, ci]; });
    const out = []; for (let i = 0; i < X.st.n; i++) { let ok = true; for (const [c, ci] of fs) if (c[i] !== ci) { ok = false; break; } if (ok && gSt(i)) out.push(i); }
    return out;
  },
  counts(f, idx) { const col = X.stCol(f), m = new Map(); for (const i of idx) m.set(col.c[i], (m.get(col.c[i]) || 0) + 1); return [...m.entries()].map(([c, n]) => [stLab(col.v[c]), n]).sort((a, b) => b[1] - a[1]); },
  render() {
    $('#st-chips').innerHTML = this.filters.length ? '<span class="note" style="margin-right:6px">적용된 조건:</span>' + this.filters.map((x, k) => `<span class="chip">${esc(x.f)} = ${esc(stLab(x.v))}<button data-k="${k}" title="조건 삭제">×</button></span>`).join('') + ' <button class="icon-btn" id="st-clr" style="padding:3px 8px">모두 지우기</button>' : '<span class="note">조건 없음 — 막대·조각·셀을 클릭하면 그 값이 조건으로 추가됩니다.</span>';
    $$('#st-chips .chip button').forEach(b => b.onclick = () => { this.filters.splice(+b.dataset.k, 1); this.render(); });
    if ($('#st-clr')) $('#st-clr').onclick = () => { this.filters = []; this.render(); };
    this.I = this.idx();
    const fa = $('#st-fa').value, ca = this.counts(fa, this.I), n = this.I.length;
    const H = -sum(ca.map(([, k]) => { const p = k / n; return p * Math.log(p); }));
    const hhi = sum(ca.map(([, k]) => (k / n * 100) ** 2));
    $('#st-kpis').innerHTML = kpiHTML([
      { l: '상가 수 (조건 적용)', v: fN(n), u: '곳', d: `전체 ${fN(X.st.n)}곳의 ${(n / X.st.n * 100).toFixed(1)}%` },
      { l: `'${fa}' 고유값`, v: fN(ca.length), u: '개', d: `빈값 ${fN((ca.find(x => x[0] === EMPTY) || [0, 0])[1])}건` },
      { l: '최다 값', v: ca.length ? esc(ca[0][0]).slice(0, 14) : '–', d: ca.length ? `${fN(ca[0][1])}곳 · ${(ca[0][1] / n * 100).toFixed(1)}%` : '' },
      { l: '집중도 HHI', v: fN(hhi), d: hhi > 2500 ? '고집중 (>2,500)' : hhi > 1500 ? '중간 집중' : '분산' },
      { l: '섀넌 다양성 지수', v: H.toFixed(2), d: ca.length > 1 ? `균등도 ${(H / Math.log(ca.length)).toFixed(2)} (1=완전 균등)` : '' },
    ]);
    if (!n) { ['st-a', 'st-sun', 'st-x', 'st-lq', 'st-div'].forEach(id => emptyChart(id)); this.table(); this.map(); return; }
    this.chartA(); this.sun(); this.cross(); this.lq(); this.div(); this.map(); this.table();
  },
  chartA() {
    const fa = $('#st-fa').value, N = Math.max(3, Math.min(60, +$('#st-n').value || 15)), ca = this.counts(fa, this.I), n = this.I.length, t = TK(), ct = segVal($('#st-ct'));
    const top = ca.slice(0, N), rest = sum(ca.slice(N).map(x => x[1]));
    $('#st-a-t').textContent = `'${fa}' 분포`; $('#st-a-s').textContent = `상위 ${top.length}개${rest ? ` + 기타 ${ca.length - N}개(${fN(rest)}곳)` : ''} · 막대/조각을 누르면 조건으로 추가`;
    let opt;
    if (ct === 'tree') opt = base({ tooltip: { trigger: 'item', formatter: p => `<b>${esc(p.name)}</b><br>${fN(p.value)}곳 (${(p.value / n * 100).toFixed(1)}%)` }, series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, top: 4, left: 4, right: 4, bottom: 4, data: top.map(([k, v], j) => ({ name: k, value: v, itemStyle: { color: j < 3 ? '#184f95' : j < 10 ? '#256abf' : '#3987e5', borderColor: t.surf, borderWidth: 2 } })).concat(rest ? [{ name: '기타', value: rest, itemStyle: { color: t.other } }] : []), label: { color: '#fff', fontSize: 11.5, formatter: p => `${p.name}\n${fN(p.value)}` } }] });
    else if (ct === 'pie') {
      const pt = ca.slice(0, 6), pr = sum(ca.slice(6).map(x => x[1])), SC = SER();
      opt = base({ tooltip: { trigger: 'item', formatter: p => `<b>${esc(p.name)}</b><br>${fN(p.value)}곳 (${p.percent}%)` }, legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: t.ink2, fontSize: 11 } },
        series: [{ type: 'pie', radius: ['42%', '72%'], center: ['38%', '52%'], itemStyle: { borderColor: t.surf, borderWidth: 2 }, label: { color: t.ink2, formatter: '{d}%' }, data: pt.map(([k, v], j) => ({ name: k, value: v, itemStyle: { color: SC[j] } })).concat(pr ? [{ name: '기타', value: pr, itemStyle: { color: t.other } }] : []) }] });
    } else if (ct === 'pareto') {
      let acc = 0; const cum = top.map(([, v]) => +((acc += v) / n * 100).toFixed(1));
      const k80 = cum.findIndex(v => v >= 80);
      opt = base({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => v + '%' }, legend: { top: 0, textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true },
        xAxis: xCat(top.map(x => x[0].length > 10 ? x[0].slice(0, 10) + '…' : x[0]), { axisLabel: { color: t.muted, fontSize: 10.5, interval: 0, rotate: 40 } }), yAxis: yVal({ max: 100, axisLabel: { color: t.muted, formatter: '{value}%' } }),
        series: [{ name: '비중', type: 'bar', data: top.map(([, v]) => +(v / n * 100).toFixed(2)), itemStyle: barStyle(css('--s1')), barWidth: '62%' },
          { name: '누적 비중', type: 'line', data: cum, lineStyle: { width: 2, color: css('--s2') }, itemStyle: { color: css('--s2') }, symbolSize: 6, markLine: { silent: true, symbol: 'none', lineStyle: { color: t.ink2, width: 1 }, label: { color: t.ink2, formatter: k80 >= 0 ? `80% 도달: 상위 ${k80 + 1}개` : '80%' }, data: [{ yAxis: 80 }] } }] });
    } else {
      const rows = top.concat(rest ? [['기타', rest]] : []).reverse();
      opt = base({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${esc(ps[0].name)}</b><br>${fN(ps[0].value)}곳 (${(ps[0].value / n * 100).toFixed(1)}%)` }, grid: { left: 8, right: 56, top: 6, bottom: 4, containLabel: true },
        xAxis: yVal(), yAxis: xCat(rows.map(x => x[0]), { axisLabel: { color: t.ink2, fontSize: 11, width: 150, overflow: 'truncate' } }),
        series: [{ type: 'bar', data: rows.map(([k, v]) => ({ value: v, itemStyle: barStyle(k === '기타' ? t.other : css('--s1'), true) })), barWidth: '64%', label: { show: true, position: 'right', color: t.ink2, fontSize: 10.5, formatter: p => `${fN(p.value)} (${(p.value / n * 100).toFixed(1)}%)` } }] });
    }
    setOpt('st-a', opt);
    const c = chart('st-a'); c.off('click'); c.on('click', p => { const nm = p.name; if (!nm || nm === '기타' || nm.endsWith('…')) return; this.addFilter(fa, nm === EMPTY ? '' : nm); });
  },
  sun() {
    const L1 = X.stCol('상권업종대분류명'), L2 = X.stCol('상권업종중분류명'), L3 = X.stCol('상권업종소분류명'), tree = {};
    for (const i of this.I) { const a = L1.v[L1.c[i]], b = L2.v[L2.c[i]], c = L3.v[L3.c[i]]; const A = tree[a] = tree[a] || {}; const B = A[b] = A[b] || {}; B[c] = (B[c] || 0) + 1; }
    const SC = SER(), t = TK(), majors = Object.keys(tree).map(a => [a, sum(Object.values(tree[a]).flatMap(o => Object.values(o)))]).sort((x, y) => y[1] - x[1]);
    const colorOf = {}; majors.forEach(([a], j) => colorOf[a] = j < 7 ? SC[j] : t.other);
    const data = majors.map(([a]) => ({ name: a, itemStyle: { color: colorOf[a] }, children: Object.entries(tree[a]).map(([b, cs]) => ({ name: b, itemStyle: { color: mix(colorOf[a], t.surf, .25) }, children: Object.entries(cs).map(([c, v]) => ({ name: c, value: v, itemStyle: { color: mix(colorOf[a], t.surf, .5) } })) })) }));
    setOpt('st-sun', base({ tooltip: { trigger: 'item', formatter: p => `${esc(p.treePathInfo.slice(1).map(x => x.name).join(' › '))}<br><b>${fN(p.value)}곳</b>` },
      series: [{ type: 'sunburst', data, radius: ['12%', '96%'], sort: 'desc', nodeClick: 'rootToNode', itemStyle: { borderColor: t.surf, borderWidth: 1.5 }, label: { color: t.ink, fontSize: 10, minAngle: 9, rotate: 'radial' },
        levels: [{}, { r0: '12%', r: '42%', label: { fontSize: 11, color: '#fff', rotate: 'tangential' } }, { r0: '42%', r: '72%', label: { fontSize: 10 } }, { r0: '72%', r: '96%', label: { fontSize: 9, position: 'outside', padding: 2, silent: false, show: false } }] }] }));
  },
  cross() {
    const fa = $('#st-fa').value, fb = $('#st-fb').value, t = TK(), mode = segVal($('#st-xn'));
    if (fa === fb) { emptyChart('st-x', '필드 A와 B를 다르게 고르세요'); $('#st-x-s').textContent = ''; return; }
    const A = this.counts(fa, this.I).slice(0, 12).map(x => x[0]), B = this.counts(fb, this.I).slice(0, 12).map(x => x[0]);
    const ca = X.stCol(fa), cb = X.stCol(fb), ai = new Map(A.map((v, k) => [v, k])), bi = new Map(B.map((v, k) => [v, k]));
    const M = A.map(() => new Array(B.length).fill(0));
    for (const i of this.I) { const a = ai.get(stLab(ca.v[ca.c[i]])), b = bi.get(stLab(cb.v[cb.c[i]])); if (a != null && b != null) M[a][b]++; }
    const rs = M.map(r => sum(r)), cs = B.map((_, j) => sum(M.map(r => r[j]))), N = sum(rs);
    let chi = 0; for (let a = 0; a < A.length; a++) for (let b = 0; b < B.length; b++) { const e = rs[a] * cs[b] / N; if (e > 0) chi += (M[a][b] - e) ** 2 / e; }
    const V = N && Math.min(A.length, B.length) > 1 ? Math.sqrt(chi / (N * (Math.min(A.length, B.length) - 1))) : 0;
    $('#st-x-t').textContent = `교차분석: ${fa} × ${fb}`;
    $('#st-x-s').innerHTML = `각 상위 12개 · 크래머 V = <b>${V.toFixed(3)}</b> (${V < .1 ? '연관 거의 없음' : V < .3 ? '약한 연관' : V < .5 ? '중간 연관' : '강한 연관'}) · χ² = ${fN(chi)} · 셀 클릭=두 조건 추가`;
    const data = []; let mx = 0;
    for (let a = 0; a < A.length; a++) for (let b = 0; b < B.length; b++) { const v = mode === 'row' ? (rs[a] ? M[a][b] / rs[a] * 100 : 0) : mode === 'col' ? (cs[b] ? M[a][b] / cs[b] * 100 : 0) : M[a][b]; mx = Math.max(mx, v); data.push([b, a, +v.toFixed(1), M[a][b]]); }
    const tr = s => s.length > 9 ? s.slice(0, 9) + '…' : s;
    setOpt('st-x', base({
      tooltip: { trigger: 'item', formatter: p => `${esc(fa)}: <b>${esc(A[p.data[1]])}</b><br>${esc(fb)}: <b>${esc(B[p.data[0]])}</b><br>${fN(p.data[3])}곳${mode !== 'n' ? ` · ${p.data[2]}%` : ''}` },
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      xAxis: xCat(B.map(tr), { axisLabel: { color: t.ink2, fontSize: 10, rotate: 40, interval: 0 } }), yAxis: xCat(A.map(tr), { inverse: true, axisLabel: { color: t.ink2, fontSize: 10.5, interval: 0 } }),
      visualMap: { dimension: 2, min: 0, max: mx || 1, show: true, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 120, textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: [t.surf, ...SEQ().slice(1)] } },
      series: [{ type: 'heatmap', data, label: { show: A.length * B.length <= 144, fontSize: 9.5, color: t.ink, formatter: p => p.data[3] ? (mode === 'n' ? compact(p.data[2]) : p.data[2].toFixed(0)) : '' }, itemStyle: { borderColor: t.surf, borderWidth: 2 } }],
    }));
    const c = chart('st-x'); c.off('click'); c.on('click', p => { const a = A[p.data[1]], b = B[p.data[0]]; this.filters.push({ f: fa, v: a === EMPTY ? '' : a }, { f: fb, v: b === EMPTY ? '' : b }); this.render(); });
  },
  lq() {
    const L1 = X.stCol('상권업종대분류명'), cats = L1.v.slice().filter(v => v), t = TK();
    const ci = new Map(cats.map((v, k) => [v, k])), M = D.dongs.map(() => new Array(cats.length).fill(0));
    for (const i of this.I) { const d = X.st.d[i]; if (d < 0) continue; const k = ci.get(L1.v[L1.c[i]]); if (k != null) M[d][k]++; }
    const rs = M.map(r => sum(r)), cs = cats.map((_, k) => sum(M.map(r => r[k]))), N = sum(rs);
    const data = []; D.dongs.forEach((_, d) => cats.forEach((_, k) => { if (!rs[d] || !cs[k]) return; const lq = (M[d][k] / rs[d]) / (cs[k] / N); data.push([k, d, +Math.log2(Math.max(lq, 1 / 8)).toFixed(3), +lq.toFixed(2), M[d][k]]); }));
    setOpt('st-lq', base({
      tooltip: { trigger: 'item', formatter: p => `<b>${D.dongs[p.data[1]]} · ${cats[p.data[0]]}</b><br>LQ = <b>${p.data[3]}</b> (${p.data[4]}곳)<br>${p.data[3] > 1.2 ? '특화 업종' : p.data[3] < .8 ? '상대적으로 부족' : '평균 수준'}` },
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      xAxis: xCat(cats, { axisLabel: { color: t.ink2, fontSize: 10.5, interval: 0, rotate: 30 } }), yAxis: xCat(D.dongs, { inverse: true, axisLabel: { color: t.ink2, fontSize: 10.5, interval: 0 } }),
      visualMap: { dimension: 2, min: -2, max: 2, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 140, text: ['특화 ×4', '×¼ 부족'], textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: [css('--dv-neg'), css('--dv-mid'), css('--dv-pos')] }, calculable: false },
      series: [{ type: 'heatmap', data, label: { show: true, fontSize: 9.5, color: t.ink, formatter: p => p.data[3].toFixed(1) }, itemStyle: { borderColor: t.surf, borderWidth: 2 } }],
    }));
  },
  div() {
    const L2 = X.stCol('상권업종중분류명'), t = TK(), p25 = popByDong(4, true);
    const rows = D.dongs.map((nm, d) => { const m = new Map(); let n = 0; for (const i of this.I) if (X.st.d[i] === d) { n++; m.set(L2.c[i], (m.get(L2.c[i]) || 0) + 1); } const H = -sum([...m.values()].map(k => (k / n) * Math.log(k / n))); const pop = popTotal(p25[d]); return { nm, n, H: n ? H : null, pop, per: pop >= 1000 ? n / pop * 1000 : null }; }).sort((a, b) => (b.per ?? -1) - (a.per ?? -1));
    setOpt('st-div', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.nm}</b><br>상가 ${fN(r.n)}곳 · 인구 ${fN(r.pop)}명<br>1천 명당 ${r.per == null ? '– (인구 격자 비공개 많음)' : fN(r.per, 1) + '곳'}<br>섀넌 다양성(중분류) ${r.H == null ? '–' : r.H.toFixed(2)}`; } },
      grid: { left: 8, right: 44, top: 8, bottom: 4, containLabel: true }, xAxis: yVal(), yAxis: xCat(rows.map(r => r.nm), { inverse: true, axisLabel: { color: t.ink2, fontSize: 11 } }),
      series: [{ type: 'bar', data: rows.map(r => r.per == null ? null : +r.per.toFixed(1)), itemStyle: barStyle(css('--s1'), true), barWidth: '60%', label: { show: true, position: 'right', color: t.ink2, fontSize: 10.5, formatter: p => p.value == null ? '' : p.value } }],
    }));
  },
  map() {
    const m = makeMap('st-map', { zoom: 11 }); if (m._pts) m.removeLayer(m._pts);
    const fa = $('#st-fa').value, ca = this.counts(fa, this.I), top = ca.slice(0, 7).map(x => x[0]), SC = SER(), t = TK();
    const colOf = new Map(top.map((v, j) => [v, SC[j]])), col = X.stCol(fa), g = L.layerGroup();
    const L1 = X.stCol('상호명'), L3 = X.stCol('상권업종소분류명'), LA = X.stCol('도로명주소'), LF = X.stCol('층정보');
    for (const i of this.I) {
      const v = stLab(col.v[col.c[i]]), c = colOf.get(v) || t.other;
      L.circleMarker([X.st.lat[i], X.st.lon[i]], { radius: 4, weight: 1, color: t.surf, fillColor: c, fillOpacity: .85 })
        .bindPopup(() => `<b>${esc(L1.v[L1.c[i]])}</b><br>${esc(L3.v[L3.c[i]])}<br>${esc(LA.v[LA.c[i]])}${LF.v[LF.c[i]] ? ' · ' + esc(LF.v[LF.c[i]]) + '층' : ''}<br><span style="color:var(--muted)">${esc(fa)}: ${esc(v)}</span>`).addTo(g);
    }
    g.addTo(m); m._pts = g;
    legendCtl(m, `<b>${esc(fa)}</b><br>` + top.map((v, j) => `<span class="sw" style="background:${SC[j]}"></span>${esc(v.length > 14 ? v.slice(0, 14) + '…' : v)}`).join('<br>') + (ca.length > 7 ? `<br><span class="sw" style="background:${t.other}"></span>기타` : ''));
  },
  rowsQ() { const q = ($('#st-q').value || '').trim(); if (!q) return this.I; const a = X.stCol('상호명'), b = X.stCol('도로명주소'), c = X.stCol('지번주소'), d = X.stCol('건물명'); return this.I.filter(i => a.v[a.c[i]].includes(q) || b.v[b.c[i]].includes(q) || c.v[c.c[i]].includes(q) || d.v[d.c[i]].includes(q)); },
  table() {
    const R = this.rowsQ(), PG = 100, pages = Math.max(1, Math.ceil(R.length / PG)); this.page = Math.min(this.page, pages - 1);
    const cols = ['상호명', '지점명', '상권업종대분류명', '상권업종중분류명', '상권업종소분류명', '행정동명', '법정동명', '도로명주소', '건물명', '층정보'];
    const rows = R.slice(this.page * PG, (this.page + 1) * PG).map(i => Object.fromEntries([['_id', i], ...cols.map(f => [f, X.stVal(f, i)])]));
    $('#st-tbl-s').textContent = `조건·검색 결과 ${fN(R.length)}곳 · CSV는 원본 39개 필드 전체를 내려받습니다`;
    renderTable($('#st-tbl'), cols.map(f => ({ k: f, l: f.replace('상권업종', '') })), rows, { sortKey: '상호명', asc: true });
    $('#st-pg').innerHTML = `<button class="icon-btn" id="st-prev" ${this.page ? '' : 'disabled'}>‹ 이전</button> ${this.page + 1} / ${pages} 페이지 <button class="icon-btn" id="st-next" ${this.page < pages - 1 ? '' : 'disabled'}>다음 ›</button>`;
    $('#st-prev').onclick = () => { this.page--; this.table(); }; $('#st-next').onclick = () => { this.page++; this.table(); };
  },
  csv() {
    const R = this.rowsQ(), F = D.st.fields; const lines = [F.concat(['경도', '위도']).join(',')];
    const q = s => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    for (const i of R) lines.push(F.map(f => q(X.stVal(f, i))).concat([X.st.lon[i], X.st.lat[i]]).join(','));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `아산_상가_${R.length}곳.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};
