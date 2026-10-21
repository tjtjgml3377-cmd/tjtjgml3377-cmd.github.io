# ※ 원자료(실거래 엑셀·인구 격자·국민연금·소상공인)는 저장소에 포함하지 않았습니다.
#    RAW_DIR(원자료 폴더)·WORK_DIR(작업 폴더) 환경변수로 경로를 지정하세요.
#    파일 이름 패턴(glob)은 최초 작업 때 업로드한 파일 이름에 맞춰져 있어 새 자료에는 조정이 필요할 수 있습니다.
"""아산시 통합 데이터 마스터 구축 — 인구격자·실거래·국민연금·소상공인 → 읍면동 × 연도"""
import glob, os, re, warnings
import pandas as pd, geopandas as gpd
from shapely import wkt
warnings.filterwarnings('ignore')

UP = os.environ.get('RAW_DIR', 'raw/')
S = os.environ.get('WORK_DIR', 'work/')
OUT = S + 'master/'
os.makedirs(OUT, exist_ok=True)
def save(df, path):
    d = df.copy()
    for c in d.columns:
        if d[c].dtype == object:
            d[c] = d[c].where(d[c].isna(), d[c].astype(str))
    d.to_parquet(path)


BND = gpd.read_file(S + 'bnd/asan_2025.gpkg')[['읍면동', 'adm_cd2', 'geometry']]
DONGS = list(BND['읍면동'])

# ---------- 1. 인구격자 ----------
AGE = ['유아', '유소년', '초등학생', '중학생', '고등학생', '20대', '30대', '40대', '50대',
       '60대', '70대', '80대', '90대', '100세이상']
AGE_SUM = [a for a in AGE if a != '유소년']          # 유소년(0~14 추정)은 중복이라 합계 제외
pops = []
for p in glob.glob(UP + '*-10-________.xlsx'):
    df = pd.read_excel(p)
    df['연도'] = 2000 + int(df['구군'].str[:2].iloc[0])
    df['성별'] = df['구군'].str.extract(r'(남성|여성)$')[0]
    pops.append(df)
pop = pd.concat(pops, ignore_index=True)
dup = pop.duplicated(['연도', 'gid', '성별'])
pop_dups = int(dup.sum())
pop = pop[~dup]
cells = pop.drop_duplicates('gid')[['gid', 'geometry']].copy()
cg = gpd.GeoDataFrame(cells, geometry=cells.geometry.apply(wkt.loads), crs=5179)
cg['geometry'] = cg.centroid
cg = gpd.sjoin(cg, BND[['읍면동', 'geometry']], how='left', predicate='within')
pop = pop.merge(cg[['gid', '읍면동']], on='gid', how='left')
pop['총인구'] = pop[AGE_SUM].sum(axis=1)
save(pop.drop(columns=['geometry', '구군']), OUT + 'pop_grid.parquet')
cg[['gid', '읍면동']].merge(cells, on='gid').to_csv(OUT + 'grid_geom.csv', index=False)

# ---------- 2. 실거래 ----------
def load_rtms(p):
    raw = pd.read_excel(p, header=None)
    h = raw.index[raw[0].astype(str).str.strip() == 'NO'][0]
    df = pd.read_excel(p, header=h)
    sheet = pd.ExcelFile(p).sheet_names[0]
    m = re.match(r'(.+)\((매매|전월세)\)', sheet)
    df['유형'], df['거래'] = m.group(1), m.group(2)
    per = [str(v) for v in raw[0].head(15) if '계약일자' in str(v)][0]
    d = re.findall(r'\d{4}-\d{2}-\d{2}', per)
    df['기간시작'], df['기간끝'] = d[0], d[1]
    df['원본파일'] = os.path.basename(p)
    return df

trs = [load_rtms(p) for p in glob.glob(UP + '*.xlsx')
       if os.path.getsize(p) < 3_000_000 and re.search(r'_2[1-5][_-]2[2-6]\.xlsx$', p)]
tr = pd.concat(trs, ignore_index=True)
tr['계약일자'] = pd.to_datetime(tr['계약년월'].astype(str) + tr['계약일'].astype(int).astype(str).str.zfill(2), format='%Y%m%d')
# 분석연도: 10/21~다음해 10/20 → 시작연도 라벨 (예: 2021 = 21.10.21~22.10.20)
tr['분석연도'] = tr['계약일자'].apply(lambda d: d.year if (d.month, d.day) >= (10, 21) else d.year - 1)
tr = tr.drop(columns=['NO'])
# 중복 제거는 '파일 기간이 겹치는 날짜'만: 뒤 파일에서 앞 파일 기간끝 이하 날짜 행 제거
# (번지가 가려져 있어 같은 날·같은 금액 행도 서로 다른 계약일 수 있으므로 전체 중복제거는 하지 않음)
before = len(tr)
drop_idx = []
for (_, _), g in tr.groupby(['유형', '거래']):
    files = g.drop_duplicates('원본파일').sort_values('기간시작')[['원본파일', '기간시작', '기간끝']].values
    for i in range(1, len(files)):
        prev_end = pd.Timestamp(files[i - 1][2])
        drop_idx += list(g[(g['원본파일'] == files[i][0]) & (g['계약일자'] <= prev_end)].index)
tr = tr.drop(index=drop_idx)
tr_dups = before - len(tr)
num = lambda s: pd.to_numeric(s.astype(str).str.replace(',', '').str.strip().replace({'-': None, 'nan': None}), errors='coerce')
for c in ['거래금액(만원)', '보증금(만원)', '월세금(만원)', '종전계약 보증금(만원)', '종전계약 월세(만원)']:
    if c in tr: tr[c] = num(tr[c])
tr['면적'] = tr['전용면적(㎡)'].fillna(tr['계약면적(㎡)']).fillna(tr['연면적(㎡)'])
tr['해제'] = tr['해제사유발생일'].notna() & (tr['해제사유발생일'].astype(str).str.strip() != '-')
tr['전월세구분'] = tr['전월세구분'].where(tr['거래'] == '전월세')
parts = tr['시군구'].str.split()
tr['읍면동_법정'] = parts.str[2]
tr['리'] = parts.str[3]

# ---------- 4. 소상공인 (먼저 읽어서 법정동→행정동 매핑에 사용) ----------
st = pd.read_excel(glob.glob(UP + 'c0586230-*.xlsx')[0])
# 동 지역 법정동 → 행정동: 상가 위치(위경도) 기준 다수결 매핑 + 경계로 재검증
stg = gpd.GeoDataFrame(st, geometry=gpd.points_from_xy(st['경도'], st['위도']), crs=4326).to_crs(5179)
stg = gpd.sjoin(stg, BND[['읍면동', 'geometry']].rename(columns={'읍면동': '읍면동_경계'}), how='left', predicate='within')
st['읍면동'] = st['행정동명']
st['읍면동_경계'] = stg['읍면동_경계'].values
save(st.drop(columns=[]), OUT + 'stores.parquet')
dong_map = (st[~st['법정동명'].str.endswith(('읍', '면'))]
            .groupby(['법정동명', '행정동명']).size().rename('n').reset_index())
dong_map['share'] = dong_map['n'] / dong_map.groupby('법정동명')['n'].transform('sum')
dmap_major = dong_map.sort_values('share', ascending=False).drop_duplicates('법정동명')
mapping = dict(zip(dmap_major['법정동명'], dmap_major['행정동명']))
split_dongs = dong_map[dong_map['share'] < 0.999].groupby('법정동명').size()
dong_map.to_csv(OUT + '법정동_행정동_매핑.csv', index=False, encoding='utf-8-sig')

# 여러 행정동에 걸친 법정동(온천동 등)은 도로명 기준으로 세분: 상가 데이터의 (법정동, 도로명)→행정동 다수결
st['도로'] = st['도로명'].astype(str).str.split().str[-1]
base = lambda s: s.astype(str).str.replace(r'\d+번길$', '', regex=True)
st['도로base'] = base(st['도로'])
def road_major(col):
    m = (st[st['법정동명'].isin(split_dongs.index)].groupby(['법정동명', col, '행정동명']).size()
         .rename('n').reset_index().sort_values('n', ascending=False).drop_duplicates(['법정동명', col]))
    return {(a, b): c for a, b, c in m[['법정동명', col, '행정동명']].values}
ROAD_EXACT, ROAD_BASE = road_major('도로'), road_major('도로base')


def assign_dong(beop, road):
    """beop: 읍/면 또는 법정동 이름, road: 도로명(번길 포함 가능) → 행정동명"""
    beop = beop.astype(str); road = road.fillna('').astype(str)
    out = beop.where(beop.str.endswith(('읍', '면')), beop.map(mapping))
    how = pd.Series('읍면/법정동 단일', index=beop.index)
    how[~beop.str.endswith(('읍', '면'))] = '법정동→행정동 매핑'
    sp = beop.isin(split_dongs.index)
    ex = [ROAD_EXACT.get((b, r)) for b, r in zip(beop[sp], road[sp])]
    bs = [ROAD_BASE.get((b, r)) for b, r in zip(beop[sp], base(road[sp]))]
    res = [e or b2 for e, b2 in zip(ex, bs)]
    out[sp] = [r or o for r, o in zip(res, out[sp])]
    how[sp] = ['도로명 매칭' if r else '다수결(추정)' for r in res]
    return out, how


tr['읍면동'], tr['읍면동_배정방법'] = assign_dong(tr['읍면동_법정'], tr['도로명'])
tr_unmapped = tr.loc[tr['읍면동'].isna(), '읍면동_법정'].value_counts().to_dict()
save(tr, OUT + 'transactions.parquet')

# ---------- 3. 국민연금 ----------
nps = []
for p in glob.glob(UP + '*-2[2-6]09.xlsx'):
    df = pd.read_excel(p)
    df = df[df['사업장명'].notna() & (df['법정동주소광역시시군구코드'] == 200) & (df['법정동주소광역시도코드'] == 44)]
    df['기준월'] = pd.to_datetime(df['자료생성년월']).dt.strftime('%Y-%m')
    df['분석연도'] = pd.to_datetime(df['자료생성년월']).dt.year - 1   # 22.09 자료 ≈ 2021 분석연도(21.10~22.10) 말
    nps.append(df)
nps = pd.concat(nps, ignore_index=True)
nps['상태'] = nps['사업장가입상태코드 1 등록 2 탈퇴'].map({1: '등록', 2: '탈퇴'})
nps['형태'] = nps['사업장형태구분코드 1 법인 2 개인'].map({1: '법인', 2: '개인'})
# 행정동코드는 연도마다 구코드(4420054000 등)가 섞여 있어 신뢰 불가 → 주소(법정동/읍면 + 도로명)로 배정
nps['읍면동_법정'] = nps['사업장지번상세주소'].astype(str).str.split().str[2]
nps['도로명'] = nps['사업장도로명상세주소'].astype(str).str.split().str[-1]
nps['읍면동'], nps['읍면동_배정방법'] = assign_dong(nps['읍면동_법정'], nps['도로명'])
nps_unmapped = nps.loc[nps['읍면동'].isna(), '읍면동_법정'].value_counts().to_dict()
save(nps, OUT + 'nps.parquet')

# ---------- 요약 ----------
print('pop rows', len(pop), 'dups removed', pop_dups)
print(pop.groupby(['연도', '성별'])['총인구'].sum().unstack())
print('pop unassigned', pop[pop['읍면동'].isna()].groupby('연도')['총인구'].sum().to_dict())
print('tr rows', len(tr), 'dups removed', tr_dups, 'unmapped', tr_unmapped)
print(tr.groupby(['유형', '거래', '분석연도']).size().unstack())
print('해제', tr.groupby(['거래'])['해제'].sum().to_dict())
print('split 법정동 (여러 행정동 걸침):', split_dongs.to_dict())
print(dong_map[dong_map['법정동명'].isin(split_dongs.index)].to_string())
print('nps unmapped', nps_unmapped)
print(nps[nps['상태'] == '등록'].pivot_table(index='기준월', columns='형태', values='가입자수', aggfunc=['count', 'sum']))
print('stores', len(st), '행정동명 vs 경계 불일치', (st['읍면동'] != st['읍면동_경계']).sum())
print('tr 배정방법', tr['읍면동_배정방법'].value_counts().to_dict())
print('nps 배정방법', nps['읍면동_배정방법'].value_counts().to_dict())
print('tr 해제 제외 후', tr[~tr['해제']].groupby(['유형', '거래', '분석연도']).size().unstack())
