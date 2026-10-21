/* =================== 주소 검색 엔진 (오프라인) =================== */
const GEO = {
  ready: false,
  norm: s => String(s || '').replace(/(^|\s)(충청남도|충남|아산시)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim(),
  ns: s => String(s || '').replace(/\s|\(|\)|아파트|·|,|\./g, ''),
  build() {
    if (this.ready) return;
    const RA = X.stCol('도로명주소'), JA = X.stCol('지번주소'), BN = X.stCol('건물명'), NM = X.stCol('상호명'), BR = X.stCol('지점명');
    this.roadPts = new Map(); this.roadExact = new Map(); this.jibPts = new Map(); this.jibExact = new Map(); this.bld = new Map(); this.riIdx = new Map();
    const reR = /(\S+(?:로|길)(?:\d+번길)?)\s+(\d+)(?:-(\d+))?\s*$/;
    for (let i = 0; i < X.st.n; i++) {
      const la = X.st.lat[i], lo = X.st.lon[i];
      const m = reR.exec(RA.v[RA.c[i]]);
      if (m) { const road = m[1], mn = +m[2], sb = +(m[3] || 0); (this.roadPts.get(road) || this.roadPts.set(road, []).get(road)).push([mn, la, lo, X.st.d[i]]); const k = `${road} ${mn}-${sb}`; (this.roadExact.get(k) || this.roadExact.set(k, []).get(k)).push([la, lo]); }
      const t = JA.v[JA.c[i]].split(' ').slice(2), last = t[t.length - 1] || '';
      const jm = /^(?:산)?(\d+)(?:-(\d+))?$/.exec(last);
      if (jm) {
        const bk = (t[0] && /[읍면]$/.test(t[0]) && t[1] && /리$/.test(t[1])) ? t[0] + ' ' + t[1] : t[0];
        (this.jibPts.get(bk) || this.jibPts.set(bk, []).get(bk)).push([+jm[1], +(jm[2] || 0), la, lo]);
        const k = `${bk} ${+jm[1]}-${+(jm[2] || 0)}`; (this.jibExact.get(k) || this.jibExact.set(k, []).get(k)).push([la, lo]);
      }
      const b = BN.v[BN.c[i]]; if (b) { const k = this.ns(b); (this.bld.get(k) || this.bld.set(k, { n: b, p: [] }).get(k)).p.push([la, lo]); }
    }
    for (const c of X.cx) { const m = /^(\d+)(?:-(\d+))?$/.exec(c.jb); if (m) { const k = `${c.b} ${+m[1]}-${+(m[2] || 0)}`; if (!this.jibExact.has(k)) this.jibExact.set(k, [[c.lat, c.lon]]); } }
    for (const bk of this.jibPts.keys()) { const ri = bk.split(' ').pop(); (this.riIdx.get(ri) || this.riIdx.set(ri, []).get(ri)).push(bk); }
    this.cent = (P, li, oi) => [median(P.map(p => p[li])), median(P.map(p => p[oi]))];
    this.dongCent = D.dongs.map((_, d) => { const P = []; for (let i = 0; i < X.st.n; i++) if (X.st.d[i] === d) P.push([X.st.lat[i], X.st.lon[i]]); return P.length ? this.cent(P, 0, 1) : null; });
    this.names = NM; this.branch = BR; this.ready = true;
  },
  interp(road, num) {
    const P = (this.roadPts.get(road) || []).slice().sort((a, b) => a[0] - b[0]); if (!P.length) return null;
    let lo = null, hi = null; for (const p of P) { if (p[0] <= num) lo = p; if (p[0] >= num && !hi) hi = p; }
    if (lo && hi) { if (lo[0] === hi[0]) return { lat: lo[1], lon: lo[2], prec: 'B' }; const f = (num - lo[0]) / (hi[0] - lo[0]); const lat = lo[1] + f * (hi[1] - lo[1]), lon = lo[2] + f * (hi[2] - lo[2]); return { lat, lon, prec: distM(lo[1], lo[2], hi[1], hi[2]) <= 400 ? 'B' : 'C' }; }
    const p = lo || hi; return { lat: p[1], lon: p[2], prec: Math.abs(p[0] - num) <= 20 ? 'B' : 'C' };
  },
  search(q) {
    this.build(); const out = [], qn = this.norm(q), qs2 = this.ns(qn); if (qs2.length < 1) return out;
    const push = (k, label, sub, lat, lon, prec) => { if (lat == null || !isFinite(lat)) return; if (out.some(o => o.label === label && o.k === k)) return; out.push({ k, label, sub, lat, lon, prec }); };
    // 1) 도로명 + 건물번호
    const mr = /(\S+(?:로|길)(?:\d+번길)?)\s*(\d+)(?:-(\d+))?/.exec(qn);
    if (mr && this.roadPts.has(mr[1])) {
      const k = `${mr[1]} ${+mr[2]}-${+(mr[3] || 0)}`, ex = this.roadExact.get(k);
      if (ex) push('도로명', `${mr[1]} ${mr[2]}${mr[3] ? '-' + mr[3] : ''}`, '정확 일치', mean(ex.map(p => p[0])), mean(ex.map(p => p[1])), 'A');
      else { const r = this.interp(mr[1], +mr[2]); if (r) push('도로명', `${mr[1]} ${mr[2]}${mr[3] ? '-' + mr[3] : ''}`, r.prec === 'B' ? '건물번호 보간(근사)' : '도로 위 추정(오차 큼)', r.lat, r.lon, r.prec); }
    }
    // 2) 지번
    const mj = /(?:(\S+[읍면])\s*)?(\S+?(?:[0-9]?동|리|가))\s*(?:산\s*)?(\d+)(?:-(\d+))?\s*$/.exec(qn);
    if (mj) {
      let keys = []; if (mj[1]) keys = [mj[1] + ' ' + mj[2]]; else keys = this.riIdx.get(mj[2]) || (this.jibPts.has(mj[2]) ? [mj[2]] : []);
      for (const bk of keys) {
        const ex = this.jibExact.get(`${bk} ${+mj[3]}-${+(mj[4] || 0)}`);
        if (ex) push('지번', `${bk} ${mj[3]}${mj[4] ? '-' + mj[4] : ''}`, '정확 일치', mean(ex.map(p => p[0])), mean(ex.map(p => p[1])), 'A');
        else { const P = this.jibPts.get(bk); if (P) { const p = P.reduce((a, b) => Math.abs(b[0] - mj[3]) < Math.abs(a[0] - mj[3]) ? b : a); push('지번', `${bk} ${mj[3]}${mj[4] ? '-' + mj[4] : ''}`, `가까운 번지(${p[0]}${p[1] ? '-' + p[1] : ''}) 기준 근사`, p[2], p[3], Math.abs(p[0] - mj[3]) <= 3 ? 'B' : 'C'); } }
      }
    }
    D.dongs.forEach((d, i) => { if (d === qn && this.dongCent[i]) push('읍면동', d, '행정동 상가 중심', this.dongCent[i][0], this.dongCent[i][1], 'E'); });
    // 3) 단지명
    for (const c of X.cx) if (this.ns(c.n).includes(qs2)) { push(D.tx.types[c.t], c.n, `${c.b} ${c.jb}`, c.lat, c.lon, c.p); if (out.length > 14) break; }
    // 4) 건물명
    let nb = 0; for (const [k, v] of this.bld) if (k.includes(qs2)) { push('건물', v.n, '상가 건물명', mean(v.p.map(p => p[0])), mean(v.p.map(p => p[1])), 'A'); if (++nb >= 5) break; }
    // 5) 동·리·읍면 / 도로명
    D.dongs.forEach((d, i) => { if (d.includes(qn) && this.dongCent[i]) push('읍면동', d, '행정동 상가 중심', this.dongCent[i][0], this.dongCent[i][1], 'E'); });
    for (const [bk, P] of this.jibPts) if (qs2.length >= 2 && this.ns(bk).includes(qs2)) { const c = this.cent(P, 2, 3); push('동·리', bk, '법정동·리 상가 중심', c[0], c[1], 'D'); if (out.length > 20) break; }
    if (!mr) for (const [r, P] of this.roadPts) if (qs2.length >= 2 && r.includes(qs2)) { const c = this.cent(P, 1, 2); push('도로', r, `도로 중심 (상가 ${P.length}곳)`, c[0], c[1], 'C'); if (out.length > 22) break; }
    // 6) 상호명
    if (qs2.length >= 2) { let ns = 0; const NM = this.names; for (let i = 0; i < X.st.n && ns < 8; i++) { const nm = NM.v[NM.c[i]]; if (this.ns(nm).includes(qs2)) { const br = this.branch.v[this.branch.c[i]]; push('상호', nm + (br ? ' ' + br : ''), X.stVal('도로명주소', i).replace('충청남도 아산시 ', ''), X.st.lat[i], X.st.lon[i], 'A'); ns++; } } }
    return out.slice(0, 14);
  },
  vworld(q, key) {
    const one = type => new Promise((res, rej) => {
      const cb = 'vw' + Math.random().toString(36).slice(2), s = document.createElement('script'); let done = false;
      window[cb] = d => { done = true; delete window[cb]; s.remove(); res(d); };
      s.onerror = () => { if (!done) rej(new Error('네트워크')); };
      s.src = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&refine=true&simple=false&format=json&type=${type}&key=${encodeURIComponent(key)}&callback=${cb}&address=${encodeURIComponent('충청남도 아산시 ' + this.norm(q))}`;
      document.head.appendChild(s); setTimeout(() => { if (!done) rej(new Error('시간 초과')); }, 8000);
    });
    return one('road').then(d => d?.response?.status === 'OK' ? d : one('parcel')).then(d => { if (d?.response?.status !== 'OK') throw new Error('결과 없음'); const p = d.response.result.point; return { k: '브이월드', label: d.response.refined?.text || q, sub: '브이월드 지오코딩', lat: +p.y, lon: +p.x, prec: 'A' }; });
  },
};

/* =================== 반경 분석 =================== */
const PREC_L = { A: '정확(중앙 오차 ~40m)', B: '근사(대부분 150m 이내)', C: '도로 단위(~200~500m)', D: '동·리 중심', E: '읍면동 중심' };
VIEWS.rad = {
  init() {
    attachSearch($('#r-q'), $('#r-sug'), v => setGeo(v.lat, v.lon, v, true), msg => { if (msg) $('#r-info').innerHTML = msg; });
    try { $('#r-vkey').value = localStorage.getItem('termuni_vkey') || ''; } catch (e) { }
    if (!VWORLD_KEY_DEFAULT) { $('#r-vnote').innerHTML = '이 공개판에는 브이월드 인증키가 들어 있지 않습니다. <b>브이월드(vworld.kr)에서 무료로 발급한 인증키</b>를 넣고 새로고침하면 브이월드 배경지도·위성·지적도·전체 주소검색이 켜집니다. 키는 이 브라우저에만 저장됩니다.'; $('#r-vkey').placeholder = '브이월드 인증키 입력'; $('#r-vkey').closest('details').open = true; }
    $('#r-vkey').onchange = () => { try { localStorage.setItem('termuni_vkey', $('#r-vkey').value.trim()); } catch (e) { } $('#r-info').innerHTML = '인증키를 저장했습니다. 지도에 반영하려면 페이지를 새로고침하세요.'; };
    const rb = $('#r-rb'); rb.innerHTML = [100, 200, 300, 500, 700, 1000, 1500, 2000].map(r => `<button data-r="${r}">${rLabel(r)}</button>`).join('');
    $$('button', rb).forEach(b => b.onclick = () => setGeoR(+b.dataset.r)); $('#r-r').oninput = () => setGeoR(+$('#r-r').value);
    $('#r-prec').innerHTML = Object.entries(PREC_L).map(([k, l]) => `<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="checkbox" data-p="${k}" ${GEOF.prec.has(k) ? 'checked' : ''}> <b>${k}</b> ${l}</label>`).join('');
    $$('#r-prec input').forEach(c => c.onchange = () => { c.checked ? GEOF.prec.add(c.dataset.p) : GEOF.prec.delete(c.dataset.p); geoRefresh(false); });
    $('#r-print').onclick = () => window.print();
    makeMap('r-map', { zoom: 11 });
    this.syncR(); this.moved = true;
  },
  syncR() { const r = GEOF.R; $('#r-r').value = r; $('#r-rv').textContent = rLabel(r); $$('#r-rb button').forEach(b => b.classList.toggle('on', +b.dataset.r === r)); },
  render() {
    this.syncR();
    if (!GEOF.on) { this.empty(); return; }
    if (this.moved || !this.center || this.center.lat !== GEOF.lat || this.center.lon !== GEOF.lon) { this.moved = false; this.setCenter(GEOF.lat, GEOF.lon, GEOF.info); }
    else this.compute();
  },
  empty() {
    const m = makeMap('r-map'); if (m._rl) { m.removeLayer(m._rl); m._rl = null; } if (m._leg) { m.removeControl(m._leg); m._leg = null; }
    this.center = null;
    $('#r-info').innerHTML = '<b>아직 중심이 없습니다.</b><br>위 검색창에 주소·단지명·상호를 입력하거나, <b>지도를 클릭</b>하세요. 지정한 반경은 <b>모든 탭</b>에 함께 적용됩니다.';
    $('#r-kpis').innerHTML = '';
    ['r-p1', 'r-p2', 'r-p3', 'r-p4', 'r-pyr', 'r-st', 'r-st2', 'r-price', 'r-rent'].forEach(id => emptyChart(id, '주소를 입력하거나 지도를 클릭하세요'));
    $('#r-cx').innerHTML = '<div class="empty">반경을 지정하면 단지 목록이 나옵니다</div>'; $('#r-job').innerHTML = '<div class="empty">반경을 지정하면 사업장 목록이 나옵니다</div>';
  },
  setCenter(lat, lon, info) {
    this.center = { lat, lon, info };
    const c = this.center, cosk = Math.cos(lat * Math.PI / 180);
    const dist = (la, lo) => { const dx = (lo - lon) * 111320 * cosk, dy = (la - lat) * 110574; return Math.sqrt(dx * dx + dy * dy); };
    c.dCell = Float32Array.from(X.pop.lat, (la, i) => dist(la, X.pop.lon[i]));
    c.dSt = Float32Array.from(X.st.lat, (la, i) => dist(la, X.st.lon[i]));
    const tl = D.tx.locs, dl = Float32Array.from(tl.lat, (la, i) => dist(la / 1e5, tl.lon[i] / 1e5));
    c.dTx = Float32Array.from(D.tx.loc, L => dl[L]);
    const nl = D.nps.locs, dn = Float32Array.from(nl.lat, (la, i) => dist(la / 1e5, nl.lon[i] / 1e5));
    c.dNps = Float32Array.from(D.nps.loc, L => dn[L]);
    c.dCx = X.cx.map(x => dist(x.lat, x.lon));
    this.compute();
  },
  compute() {
    const c = this.center, R = GEOF.R, T = D.tx, N = D.nps, t = TK(), PR = 'ABCDE';
    const precOK = p => GEOF.prec.has(PR[p]);
    const info = c.info || {};
    $('#r-info').innerHTML = `중심: <b>${esc(info.label || '')}</b><br><span style="color:var(--muted)">${esc(info.k || '')}${info.sub ? ' · ' + esc(info.sub) : ''} · 좌표 ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}${info.prec && info.prec !== '-' ? ' · 위치 정밀도 ' + info.prec : ''}</span>`;
    // ---- 지도
    const m = makeMap('r-map'); if (m._rl) m.removeLayer(m._rl); const g = L.layerGroup();
    const SC = SER(), L1 = X.stCol('상권업종대분류명'), majors = this.majors || (this.majors = (() => { const cnt = new Map(); for (const v of L1.c) cnt.set(v, (cnt.get(v) || 0) + 1); return [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); })());
    const mcol = new Map(majors.map((v, j) => [v, j < 7 ? SC[j] : t.other]));
    const dLat = 0.000452, dLon = 0.000561; const yi = 4;
    const cellsIn = []; for (let k = 0; k < X.pop.nc; k++) if (c.dCell[k] <= R) cellsIn.push(k);
    const cv = k => { let s = 0; for (let a = 0; a < 13; a++) s += X.popAt(k, yi, 0, a) + X.popAt(k, yi, 1, a); return s; };
    const cmax = Math.max(1, ...cellsIn.map(cv));
    const csc = turboScale(cellsIn.map(cv).filter(v => v > 0), { sqrt: true });
    for (const k of cellsIn) { const v = cv(k); if (!v) continue; L.rectangle([[X.pop.lat[k] - dLat, X.pop.lon[k] - dLon], [X.pop.lat[k] + dLat, X.pop.lon[k] + dLon]], { stroke: false, fillColor: csc.f(v), fillOpacity: .45, interactive: false }).addTo(g); }
    const stIn = []; for (let i = 0; i < X.st.n; i++) if (c.dSt[i] <= R) stIn.push(i);
    const NM = X.stCol('상호명'), SS = X.stCol('상권업종소분류명');
    for (const i of stIn) L.circleMarker([X.st.lat[i], X.st.lon[i]], { radius: 3.5, weight: 1, color: t.surf, fillColor: mcol.get(L1.c[i]), fillOpacity: .9 }).bindPopup(() => `<b>${esc(NM.v[NM.c[i]])}</b><br>${esc(SS.v[SS.c[i]])}<br>${fN(c.dSt[i])}m`).addTo(g);
    const cxIn = X.cx.map((x, i) => [x, c.dCx[i]]).filter(([x, d]) => d <= R && GEOF.prec.has(x.p));
    for (const [x, d] of cxIn) L.marker([x.lat, x.lon], { icon: L.divIcon({ className: '', html: `<div style="width:12px;height:12px;background:${SC[x.t]};border:2px solid ${t.surf};border-radius:2px;box-shadow:0 0 0 1px ${t.ink2}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }) }).bindPopup(`<b>${esc(x.n)}</b><br>${D.tx.types[x.t]} · ${esc(x.b)} ${esc(x.jb)}<br>중심에서 ${fN(d)}m`).addTo(g);
    const mLast = N.months.length - 1, npsIn = []; for (let i = 0; i < X.nps.n; i++) if (N.m[i] === mLast && N.act[i] && c.dNps[i] <= R && precOK(X.nps.prec[i])) npsIn.push(i);
    for (const i of npsIn) L.marker([X.nps.lat[i], X.nps.lon[i]], { icon: L.divIcon({ className: '', html: `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid ${css('--s7')};filter:drop-shadow(0 0 1px ${t.surf})"></div>`, iconSize: [14, 12], iconAnchor: [7, 8] }) }).bindPopup(`<b>${esc(N.names[N.n[i]])}</b><br>${esc(N.inds[N.i[i]])}<br>가입자 ${fN(N.e[i])}명 · 위치 근사`).addTo(g);
    g.addTo(m); m._rl = g; if (this._fitR !== R + '|' + c.lat) { this._fitR = R + '|' + c.lat; m.fitBounds(L.latLng(c.lat, c.lon).toBounds(R * 2.3)); }
    legendCtl(m, `<b>상가 업종(대분류)</b><br>` + majors.slice(0, 7).map((v, j) => `<span class="sw" style="background:${SC[j]}"></span>${esc(L1.v[v])}`).join('<br>') + `<br><span class="sw" style="background:${t.other}"></span>기타`);
    // ---- 집계
    const popIn = (yy) => { const r = { m: new Array(13).fill(0), f: new Array(13).fill(0) }; for (const k of cellsIn) for (let a = 0; a < 13; a++) { r.m[a] += X.popAt(k, yy, 0, a); r.f[a] += X.popAt(k, yy, 1, a); } return r; };
    const p25 = popIn(4), p21 = popIn(0), P25 = popTotal(p25), P21 = popTotal(p21);
    const txIn = []; for (let i = 0; i < X.tx.n; i++) if (c.dTx[i] <= R && precOK(X.tx.prec[i])) txIn.push(i);
    const sale = txIn.filter(i => T.k[i] === 0 && !(T.f[i] & 1));
    const aptY = y => sale.filter(i => T.t[i] === 0 && X.tx.ay[i] === y).map(i => X.tx.pp[i]).filter(isFinite);
    let aY = 2025; while (aY > 2021 && aptY(aY).length < 3) aY--;
    const ap = aptY(aY), jeon = txIn.filter(i => T.k[i] === 1 && T.t[i] === 0 && X.tx.ay[i] >= 2024).map(i => T.a[i]), wol = txIn.filter(i => T.k[i] === 2 && X.tx.ay[i] >= 2024).map(i => T.r[i]);
    const E = sum(npsIn.map(i => N.e[i]));
    $('#r-kpis').innerHTML = kpiHTML([
      { l: '인구 (2025, 격자 중심 기준)', v: fN(P25), u: '명', d: delta(P25, P21) + ' vs 2021' },
      { l: '30~40대 비중', v: P25 ? share(p25, A3040).toFixed(1) : '–', u: '%', d: P25 && P21 ? delta(share(p25, A3040), share(p21, A3040), true) : '&nbsp;' },
      { l: '상가 업소', v: fN(stIn.length), u: '곳', d: `${fN(stIn.length / (Math.PI * (R / 1000) ** 2), 0)}곳/㎢` },
      { l: `사업장·종사자 (${N.months[mLast]})`, v: fN(npsIn.length), u: '곳', d: `종사자 ${fN(E)}명` },
      { l: `아파트 평당가 중앙 (${ayShort(aY)})`, v: ap.length ? fN(median(ap)) : '–', u: ap.length ? '만원' : '', d: ap.length ? `n=${ap.length}` : '반경 내 거래 없음' },
      { l: '매매 거래 (5년, 전 유형)', v: fN(sale.length), u: '건', d: `전월세 ${fN(txIn.length - txIn.filter(i => T.k[i] === 0).length)}건` },
      { l: '아파트 전세 중앙 (24~25)', v: jeon.length ? fMan(median(jeon)) : '–', d: jeon.length ? `n=${jeon.length}` : '&nbsp;' },
      { l: '월세 중앙 (24~25, 전 유형)', v: wol.length ? fN(median(wol)) : '–', u: wol.length ? '만원' : '', d: wol.length ? `n=${wol.length}` : '&nbsp;' },
    ]);
    // ---- 반경 프로파일
    const NB = 20, acc = (dArr, w, ok) => { const b = new Float64Array(NB + 1); for (let i = 0; i < dArr.length; i++) { const d = dArr[i]; if (d > 2000 || (ok && !ok(i))) continue; b[Math.max(1, Math.ceil(d / 100))] += w ? w(i) : 1; } for (let k = 1; k <= NB; k++) b[k] += b[k - 1]; return Array.from(b.slice(1)); };
    const prof = [
      ['r-p1', '누적 인구(명, 2025)', acc(c.dCell, cv), css('--s1')],
      ['r-p2', '누적 상가(곳)', acc(c.dSt), css('--s2')],
      ['r-p3', `누적 종사자(명, ${N.months[mLast]})`, acc(c.dNps, i => N.e[i], i => N.m[i] === mLast && N.act[i] && precOK(X.nps.prec[i])), css('--s7')],
      ['r-p4', '누적 매매(건, 5년)', acc(c.dTx, null, i => T.k[i] === 0 && !(T.f[i] & 1) && precOK(X.tx.prec[i])), css('--s3')]];
    const xl = Array.from({ length: NB }, (_, k) => (k + 1) * 100);
    for (const [id, nm, data, col] of prof) setOpt(id, base({
      title: { text: nm, left: 0, top: 0, textStyle: { fontSize: 12, color: t.ink2, fontWeight: 600, fontFamily: FONT } },
      tooltip: { trigger: 'axis', formatter: ps => `반경 ${xl[ps[0].dataIndex]}m 이내<br><b>${fN(ps[0].value)}</b>` },
      grid: { left: 4, right: 10, top: 28, bottom: 4, containLabel: true },
      xAxis: xCat(xl.map(v => v >= 1000 ? v / 1000 + 'k' : v), { boundaryGap: false, axisLabel: { color: t.muted, fontSize: 10, interval: 3 } }), yAxis: yVal({ axisLabel: { color: t.muted, fontSize: 10, formatter: compact } }),
      series: [{ type: 'line', data, symbol: 'none', lineStyle: { width: 2, color: col }, areaStyle: { color: col, opacity: .1 },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: t.ink2, width: 1 }, label: { color: t.ink2, fontSize: 10, formatter: () => fN(data[R / 100 - 1]) }, data: [{ xAxis: R / 100 - 1 }] } }],
    }));
    // ---- 피라미드
    if (P25 + P21 > 0) setOpt('r-pyr', pyramidOpt(p25, p21, '2025', '2021')); else emptyChart('r-pyr', '반경 내 공개된 인구 격자가 없습니다(5명 이하 비공개)');
    // ---- 상권 구성 vs 아산
    const cntIn = new Map(), cntAll = new Map(); for (const i of stIn) cntIn.set(L1.c[i], (cntIn.get(L1.c[i]) || 0) + 1); for (const v of L1.c) cntAll.set(v, (cntAll.get(v) || 0) + 1);
    const cats = majors.slice().reverse();
    if (stIn.length) setOpt('r-st', base({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const k = cats[ps[0].dataIndex], a = (cntIn.get(k) || 0) / stIn.length, b = cntAll.get(k) / X.st.n; return `<b>${esc(L1.v[k])}</b><br>반경 내 ${(a * 100).toFixed(1)}% (${cntIn.get(k) || 0}곳)<br>아산 전체 ${(b * 100).toFixed(1)}%<br>입지계수 LQ ${(a / b).toFixed(2)}`; } },
      legend: { top: 0, data: ['반경 내', '아산 전체'], textStyle: { color: t.ink2, fontSize: 11 } }, grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      xAxis: yVal({ axisLabel: { color: t.muted, formatter: '{value}%' } }), yAxis: xCat(cats.map(k => L1.v[k]), { axisLabel: { color: t.ink2, fontSize: 10.5 } }),
      series: [{ name: '반경 내', type: 'bar', data: cats.map(k => +((cntIn.get(k) || 0) / stIn.length * 100).toFixed(1)), itemStyle: barStyle(css('--s1'), true), barGap: '10%' },
        { name: '아산 전체', type: 'bar', data: cats.map(k => +(cntAll.get(k) / X.st.n * 100).toFixed(1)), itemStyle: barStyle(t.other, true) }],
    })); else emptyChart('r-st', '반경 내 상가가 없습니다');
    const s2 = new Map(); for (const i of stIn) s2.set(SS.c[i], (s2.get(SS.c[i]) || 0) + 1);
    const top2 = [...s2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).reverse();
    if (top2.length) setOpt('r-st2', base({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => v + '곳' }, grid: { left: 8, right: 30, top: 8, bottom: 4, containLabel: true }, xAxis: yVal(), yAxis: xCat(top2.map(x => SS.v[x[0]]), { axisLabel: { color: t.ink2, fontSize: 10.5 } }), series: [{ type: 'bar', data: top2.map(x => x[1]), itemStyle: barStyle(css('--s1'), true), barWidth: '62%', label: { show: true, position: 'right', color: t.ink2, fontSize: 10.5 } }] })); else emptyChart('r-st2', '반경 내 상가가 없습니다');
    // ---- 가격 vs 아산
    const cityY = y => { const v = []; for (let i = 0; i < X.tx.n; i++) if (T.t[i] === 0 && T.k[i] === 0 && !(T.f[i] & 1) && X.tx.ay[i] === y && isFinite(X.tx.pp[i])) v.push(X.tx.pp[i]); return median(v); };
    if (!X.cityPP) X.cityPP = AY.map(cityY);
    const inY = AY.map(y => { const v = aptY(y); return v.length >= 3 ? Math.round(median(v)) : null; });
    setOpt('r-price', base({
      tooltip: { trigger: 'axis', valueFormatter: v => v == null ? '–' : fN(v) + '만원' }, legend: { top: 0, textStyle: { color: t.ink2 } }, grid: { left: 8, right: 60, top: 34, bottom: 4, containLabel: true },
      xAxis: xCat(AY.map(ayShort), { boundaryGap: false }), yAxis: yVal({ scale: true, name: '만원/3.3㎡' }),
      series: [{ name: '반경 내', type: 'line', data: inY, connectNulls: true, lineStyle: { width: 2.5, color: css('--s1') }, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 2 }, symbolSize: 8, endLabel: { show: true, color: t.ink2, formatter: '반경 내' } },
        { name: '아산 전체', type: 'line', data: X.cityPP.map(v => Math.round(v)), lineStyle: { width: 2, color: t.other }, itemStyle: { color: t.other }, symbolSize: 6, endLabel: { show: true, color: t.ink2, formatter: '아산' } }],
    }));
    const rj = AY.map(y => txIn.filter(i => T.k[i] === 1 && X.tx.ay[i] === y).length), rw = AY.map(y => txIn.filter(i => T.k[i] === 2 && X.tx.ay[i] === y).length);
    setOpt('r-rent', base({ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fN(v) + '건' }, legend: { top: 0, textStyle: { color: t.ink2 } }, grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true }, xAxis: xCat(AY.map(ayShort)), yAxis: yVal(),
      series: [{ name: '전세', type: 'bar', stack: 'r', data: rj, itemStyle: { color: css('--s1'), borderColor: t.surf, borderWidth: 1 }, barWidth: '50%' }, { name: '월세', type: 'bar', stack: 'r', data: rw, itemStyle: { color: css('--s2'), borderColor: t.surf, borderWidth: 1, borderRadius: [4, 4, 0, 0] } }] }));
    // ---- 단지 표
    buildJeonseRatio();
    const cxRows = cxIn.map(([x, d]) => {
      let n = 0, last = null, lastY = 0; const s = {}; for (const i of sale) if (T.cx[i] === x.i) { n++; (s[X.tx.ay[i]] = s[X.tx.ay[i]] || []).push(X.tx.pp[i]); }
      const ys = Object.keys(s).map(Number).sort(); if (ys.length) { lastY = ys[ys.length - 1]; last = median(s[lastY]); }
      const jr = X.jr.filter(r => r.cx === x.i).sort((a, b) => b.y - a.y)[0];
      return { _id: x.i, n: x.n, t: D.tx.types[x.t], d, by: x.by || null, cnt: n, pp: last, y: lastY ? ayShort(lastY) : '–', jr: jr ? jr.ratio : null };
    });
    renderTable($('#r-cx'), [{ k: 'n', l: '단지·건물' }, { k: 't', l: '유형' }, { k: 'd', l: '거리(m)', n: 1, f: v => fN(v) }, { k: 'by', l: '건축', n: 1, f: v => v || '–' }, { k: 'cnt', l: '매매(5년)', n: 1, f: v => fN(v) }, { k: 'pp', l: '최근 평당가', n: 1, f: v => v == null ? '–' : fN(v) + '만' }, { k: 'y', l: '연도' }, { k: 'jr', l: '전세가율', n: 1, f: v => v == null ? '–' : `${v.toFixed(0)}% ${v >= 80 ? '<span class="badge b-crit">⚠ 주의</span>' : ''}` }], cxRows, { sortKey: 'd', asc: true, limit: 300 });
    if (!cxRows.length) $('#r-cx').innerHTML = '<div class="empty">반경 내 단지 거래가 없습니다. 반경을 넓혀 보세요.</div>';
    renderTable($('#r-job'), [{ k: 'nm', l: '사업장' }, { k: 'ind', l: '업종' }, { k: 'e', l: '가입자', n: 1, f: v => fN(v) }, { k: 'p', l: '정밀도' }], npsIn.map(i => ({ _id: i, nm: N.names[N.n[i]], ind: N.inds[N.i[i]], e: N.e[i], p: 'ABCDE'[X.nps.prec[i]] })), { sortKey: 'e', limit: 300 });
    if (!npsIn.length) $('#r-job').innerHTML = '<div class="empty">반경 내 사업장이 없거나, 위치 정밀도 필터에서 제외되었습니다.</div>';
    this._needs = false;
  },
};
