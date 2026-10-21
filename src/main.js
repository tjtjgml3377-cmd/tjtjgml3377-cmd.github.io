/* =================== 방법론 =================== */
VIEWS.meth = {
  init() {
    const T = D.tx, cnt = {}; for (let i = 0; i < X.tx.n; i++) { const k = D.tx.types[T.t[i]] + '|' + D.tx.deals[T.k[i]]; cnt[k] = (cnt[k] || 0) + 1; }
    const pc = { A: 0, B: 0, C: 0, D: 0, E: 0 }; for (let i = 0; i < X.tx.n; i++) pc['ABCDE'[X.tx.prec[i]]]++;
    $('#meth-body').innerHTML = `
<h2>1. 사용한 데이터</h2>
<table class="t"><thead><tr><th>데이터</th><th>출처</th><th>기간·기준</th><th class="n">규모</th></tr></thead><tbody>
<tr><td>성별·연령별 인구 격자 (100m)</td><td>국토정보플랫폼 계열 격자 인구(사용자 제공 파일)</td><td>2021~2025년 각 10월</td><td class="n">${fN(X.pop.nc)}개 유인 격자</td></tr>
<tr><td>아파트·오피스텔·연립다세대·단독다가구 매매/전월세</td><td>국토교통부 실거래가 공개시스템</td><td>2021.10.21 ~ 2026.10.20 (계약일)</td><td class="n">${fN(X.tx.n)}건</td></tr>
<tr><td>국민연금 가입 사업장 내역</td><td>국민연금공단 (공공데이터포털)</td><td>${D.nps.months.join(', ')}</td><td class="n">${fN(X.nps.n)}행</td></tr>
<tr><td>상가(상권) 정보</td><td>소상공인시장진흥공단 (사용자 제공 파일)</td><td>기준일 파일에 미기재</td><td class="n">${fN(X.st.n)}곳 · 39개 필드</td></tr>
<tr><td>배경지도 · 지적도 · 주소검색</td><td>국토교통부 브이월드 (WMTS·WMS·주소 API)</td><td>실시간 호출</td><td class="n">일반·회색·야간·위성·하이브리드</td></tr>
<tr><td>행정동 경계</td><td>vuski/admdongkor (GitHub, 통계청 경계 기반)</td><td>2025.10 버전 (2021~2026 아산 17개 읍면동 변동 없음 확인)</td><td class="n">17개</td></tr>
</tbody></table>
<p>유형·거래별 건수: ${Object.entries(cnt).map(([k, v]) => `${k.replace('|', ' ')} ${fN(v)}`).join(' · ')}</p>
<h2>2. 처리 방법</h2>
<ul>
<li><b>분석연도</b>: 실거래는 그해 10월 21일 ~ 다음 해 10월 20일을 한 해로 묶었습니다(예: 2025 = 25.10.21~26.10.20). 인구(10월)와 시점을 맞추기 위함입니다.</li>
<li><b>중복 제거</b>: 파일 기간이 겹친 날짜(2024·2025년 10월 20일)만 정리했습니다. 번지가 가려져 같은 날·같은 금액으로 보이는 행은 실제로 다른 계약(다가구 여러 호실 등)일 수 있어 지우지 않았습니다.</li>
<li><b>해제 거래</b>: 매매 해제 신고가 있는 거래는 가격 지표에서 기본 제외합니다(매매 탭에서 포함 가능).</li>
<li><b>평당가</b>: 거래금액 ÷ (면적 ÷ 3.3058㎡). 아파트·오피스텔·연립다세대는 전용면적, 단독·다가구는 연면적 기준이라 직접 비교하면 안 됩니다.</li>
<li><b>읍면동 배정</b>: 실거래는 법정동·리 → 행정동 변환(상가 데이터의 법정동↔행정동 짝을 다수결), 두 행정동에 걸친 온천동은 도로명으로 세분했습니다. 국민연금은 행정동코드에 옛 코드가 섞여 있어 주소로 다시 배정했습니다.</li>
<li><b>지도 색상</b>: 모든 값 지도는 <b>터보(Turbo)</b> 색상표(d3 공식 수식)를 씁니다. 낮을수록 파랑 → 초록 → 노랑 → 빨강. 인구·건수는 제곱근 눈금, 증감은 0을 초록 가운데로 둔 대칭 눈금이며, 상·하위 2%는 끝 색으로 묶었습니다.</li>
<li><b>반경 필터(전체 탭)</b>: 맨 위 📍 바에서 주소를 검색하거나 아무 지도의 빈 곳을 클릭하면 중심이 정해지고, 반경(100m~2km) 안의 데이터만으로 인구·매매·전월세·일자리·상권·연도 비교·종합 KPI가 다시 계산됩니다. 인구는 100m 격자 중심, 상가는 실제 좌표, 실거래·사업장은 근사 좌표(기본 정밀도 A~C) 기준입니다. 원·격자를 누르면 상세가 열리고 중심은 바뀌지 않습니다. 종합 개요의 차트·표는 읍면동 비교용이라 반경을 적용하지 않습니다.</li>
<li><b>연도 비교</b>: A·B 지도는 같은 색 눈금을 공유합니다. 건수형 지표(인구·거래량·종사자)는 한쪽 해에 없으면 0으로, 중앙값형 지표(가격·보증금·월세)는 두 해 모두 있는 위치·읍면동만 비교합니다(읍면동 중앙값은 3건 이상).</li>
<li><b>인구 합계</b>: '유소년' 칸은 유아·초등·중학생과 겹치는 것으로 확인되어(유인 격자의 99.5%에서 유소년 ≥ 유아+초등+중학) 합계에서 뺐습니다. 인구는 격자 중심점이 속한 읍면동·반경으로 집계합니다.</li>
</ul>
<h2>3. 위치 정밀도 (반경 분석에 중요)</h2>
<p>실거래·사업장 원자료에는 좌표가 없습니다. 상가 ${fN(X.st.n)}곳의 실제 좌표를 기준점으로 다음 순서로 위치를 잡았습니다.</p>
<table class="t"><thead><tr><th>등급</th><th>방법</th><th>대략적 오차</th><th class="n">실거래 비중</th></tr></thead><tbody>
<tr><td><b>A</b></td><td>지번 또는 도로명주소가 상가 주소와 정확히 일치</td><td>중앙 42m · 90%가 95m 이내</td><td class="n">${(pc.A / X.tx.n * 100).toFixed(1)}%</td></tr>
<tr><td><b>B</b></td><td>같은 도로의 건물번호 사이를 보간 / 아주 가까운 번지</td><td>중앙 43m · 90%가 145m 이내</td><td class="n">${(pc.B / X.tx.n * 100).toFixed(1)}%</td></tr>
<tr><td><b>C</b></td><td>도로 단위 (단독·다가구는 번지 비공개, 국민연금은 도로명만 공개)</td><td>중앙 194m · 90%가 317m 이내 (최대 529m)</td><td class="n">${(pc.C / X.tx.n * 100).toFixed(1)}%</td></tr>
<tr><td><b>D</b></td><td>법정동·리 상가 중심</td><td>1km 이상 가능</td><td class="n">${(pc.D / X.tx.n * 100).toFixed(1)}%</td></tr>
<tr><td><b>E</b></td><td>읍면동 중심</td><td>매우 큼</td><td class="n">${(pc.E / X.tx.n * 100).toFixed(1)}%</td></tr>
</tbody></table>
<p>검증 ① 배정 좌표가 원래 읍면동 경계 안에 들어가는 비율: A 99.1% · B 96.8% · C 92.2%. ② 브이월드 지오코딩 좌표와의 거리 비교(2026.10.21, 표본 A 45건·B 45건·C 10건, 오차 값은 위 표). 반경 분석은 기본으로 A~C만 포함합니다. 주소 검색창의 도로명·지번은 브이월드로 정확한 좌표를 찾습니다.</p>
<h2>4. 유의사항 (꼭 읽어 주세요)</h2>
<div class="warnbox"><b>인구 격자 비공개</b> — 값이 0이 아닌 칸의 최솟값이 6이어서, 5명 이하 칸은 0으로 공개된 것으로 추정합니다. 마을이 흩어진 송악·선장·도고·영인면은 인구가 크게 과소 집계됩니다. 읍면동 공식 인구는 행정안전부 주민등록 인구통계를 확인하세요.</div>
<div class="warnbox"><b>국민연금</b> — 2022~2024년 파일은 법인만 들어 있어 연도 비교는 '법인만'이 공정합니다. 종사자는 사업장 소재지 기준이고 본사 일괄 신고 가능성이 있습니다(예: 영인면 모트라스(주) 2023년 4,832명 신규 등록). 1인 사업자·공무원은 빠져 있습니다.</div>
<div class="warnbox"><b>최근 거래</b> — 신고 기한(30일) 때문에 2026년 9~10월 계약은 아직 덜 반영됐을 수 있습니다.</div>
<div class="warnbox"><b>추정 월소득</b> — 당월 고지금액 ÷ 가입자 ÷ 보험료율(2025년까지 9%, 2026년 9.5%)로 구한 평균 기준소득월액입니다. 상한액이 있어 고소득 사업장은 과소 추정되며, 실제 급여와 다릅니다.</div>
<div class="warnbox"><b>상가 데이터</b> — 파일에 기준일이 없어 시점을 알 수 없습니다. 인구 대비 상가 밀도는 2025년 인구로 계산했습니다.</div>
<h2>5. 지표 사전</h2>
<table class="t"><tbody>
<tr><td><b>전세가율</b></td><td>같은 단지·같은 면적대·같은 분석연도의 전세 보증금 중앙값 ÷ 매매가 중앙값. 매매·전세 각 2건 이상일 때만 계산. 80% 이상 '주의', 70~80% '관찰'.</td></tr>
<tr><td><b>전월세전환율(추정)</b></td><td>월세 × 12 ÷ (같은 단지·면적대·연도 전세 중앙값 − 월세 보증금) × 100. 0~20% 범위만 사용.</td></tr>
<tr><td><b>입지계수 LQ</b></td><td>(읍면동 안 업종 비중) ÷ (아산 전체 업종 비중). 1보다 크면 그 업종이 특화된 곳.</td></tr>
<tr><td><b>HHI 집중도</b></td><td>각 값 비중(%)의 제곱합. 10,000=한 값 독점, 1,500 미만이면 분산.</td></tr>
<tr><td><b>섀넌 다양성 지수</b></td><td>−Σ p·ln p. 클수록 업종이 다양. 균등도 = H ÷ ln(값 개수).</td></tr>
<tr><td><b>크래머 V</b></td><td>교차표의 카이제곱으로 두 필드의 연관 강도(0~1)를 잰 값. 0.1 미만 거의 무관, 0.3 이상 중간, 0.5 이상 강함.</td></tr>
<tr><td><b>KDE</b></td><td>커널밀도추정. 히스토그램을 부드러운 곡선으로 추정(가우시안 커널, 실버만 대역폭).</td></tr>
<tr><td><b>OLS 회귀 · R²</b></td><td>최소제곱 직선 y = a + b·x. 기울기 b는 x가 1 늘 때 y 변화량, R²는 설명력(0~1).</td></tr>
<tr><td><b>IQR 밴드 · 박스플롯</b></td><td>25~75% 구간. 수염은 1.5×IQR 안의 최솟값·최댓값.</td></tr>
<tr><td><b>유망 입지 스코어</b></td><td>지표별 z점수를 가중합한 뒤 17개 읍면동 안에서 0~100점으로 환산한 상대 점수. 절대 평가가 아닙니다.</td></tr>
<tr><td><b>노령화지수</b></td><td>60세 이상 ÷ 0~19세 × 100. 데이터 연령 구간 때문에 통계청 정의(65세+ ÷ 0~14세)와 다릅니다.</td></tr>
</tbody></table>
<p class="note">이 대시보드는 공공데이터를 가공한 참고 자료이며, 투자·계약 판단의 유일한 근거로 사용해서는 안 됩니다.</p>`;
  },
  render() { },
};

/* =================== 시작 =================== */
(async function main() {
  try {
    try { const th = localStorage.getItem('termuni_theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { }
    D = await loadData();
    $('#loadmsg').textContent = '지표를 계산하는 중…';
    await new Promise(r => setTimeout(r, 10));
    prep(); buildIndicators();
    $$('.tab').forEach(t => t.onclick = () => show(t.dataset.v));
    initGeoBar();
    $('#themeBtn').onclick = () => { const next = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = next; try { localStorage.setItem('termuni_theme', next); } catch (e) { } rerenderAll(); };
    $('#printBtn').onclick = () => window.print();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) rerenderAll(); });
    $('#ft-gen').textContent = ' · 데이터 갱신: 2026.10';
    $('#loader').style.display = 'none';
    const h = (location.hash || '').slice(1); show(VIEWS[h] || h === 'all' ? h : 'home');
    window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1); if ((VIEWS[k] || k === 'all') && k !== CUR) show(k); });
    $('.brand').style.cursor = 'pointer'; $('.brand').onclick = () => show('home');
    $('#fabTop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    $('#loadmsg').innerHTML = `<span style="color:var(--critical)">불러오기 실패: ${esc(e.message)}</span>`;
  }
})();
