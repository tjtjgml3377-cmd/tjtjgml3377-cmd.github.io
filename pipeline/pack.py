# ※ 원자료(실거래 엑셀·인구 격자·국민연금·소상공인)는 저장소에 포함하지 않았습니다.
#    RAW_DIR(원자료 폴더)·WORK_DIR(작업 폴더) 환경변수로 경로를 지정하세요.
#    파일 이름 패턴(glob)은 최초 작업 때 업로드한 파일 이름에 맞춰져 있어 새 자료에는 조정이 필요할 수 있습니다.
"""대시보드용 데이터 패키징 → data.js (window.D)"""
import os
import json, math
import numpy as np, pandas as pd, geopandas as gpd
from pyproj import Transformer

S = os.environ.get('WORK_DIR', 'work/')
M = S + 'master/'
tr = pd.read_parquet(M + 'transactions_geo.parquet')
nps = pd.read_parquet(M + 'nps_geo.parquet')
st = pd.read_parquet(M + 'stores.parquet')
pop = pd.read_parquet(M + 'pop_grid.parquet')
grid = pd.read_csv(M + 'grid_geom.csv')
BND = gpd.read_file(S + 'bnd/asan_2025.gpkg')

DONGS = ['염치읍', '배방읍', '송악면', '탕정면', '음봉면', '둔포면', '영인면', '인주면', '선장면', '도고면', '신창면',
         '온양1동', '온양2동', '온양3동', '온양4동', '온양5동', '온양6동']
DI = {d: i for i, d in enumerate(DONGS)}
BASE = pd.Timestamp('2021-10-01')

def enc(s, order=None):
    s = s.fillna('').astype(str)
    vocab = order or sorted(s.unique().tolist())
    idx = {v: i for i, v in enumerate(vocab)}
    return [idx[v] for v in s], vocab

def ll(v):  # 위경도 → 정수(1e-5도 ≈ 1m)
    return int(round(v * 1e5))

D = {'dongs': DONGS}

# ---------- 경계 ----------
b = BND.copy()
b['geometry'] = b.geometry.simplify(15)
b = b.to_crs(4326)
feats = []
for _, r in b.iterrows():
    gj = json.loads(gpd.GeoSeries([r.geometry]).to_json())['features'][0]['geometry']
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 5), round(c[1], 5)]
    gj['coordinates'] = rnd(gj['coordinates'])
    feats.append({'type': 'Feature', 'properties': {'d': DI[r['읍면동']]}, 'geometry': gj})
D['bnd'] = {'type': 'FeatureCollection', 'features': feats}

# ---------- 인구 ----------
AGES = ['유아', '초등학생', '중학생', '고등학생', '20대', '30대', '40대', '50대', '60대', '70대', '80대', '90대', '100세이상']
YEARS = [2021, 2022, 2023, 2024, 2025]
pop['총'] = pop[AGES].sum(axis=1)
active = pop.groupby('gid')['총'].sum()
active = active[active > 0].index
pp = pop[pop['gid'].isin(active)]
T = Transformer.from_crs(5179, 4326, always_xy=True)
g = grid[grid['gid'].isin(active)].copy()
xy = g['geometry'].str.extract(r'POLYGON \(\((\d+) (\d+)').astype(float)
lon, lat = T.transform((xy[0] + 50).values, (xy[1] + 50).values)
g['lat'], g['lon'] = lat, lon
g = g.reset_index(drop=True)
gi = {k: i for i, k in enumerate(g['gid'])}
vals = np.zeros((len(g), len(YEARS), 2, len(AGES)), dtype=int)
for r in pp.itertuples(index=False):
    pass
arr = pp[['gid', '연도', '성별'] + AGES].values
for row in arr:
    vals[gi[row[0]], YEARS.index(int(row[1])), 0 if row[2] == '남성' else 1, :] = row[3:]
D['pop'] = {
    'ages': ['유아', '초등', '중학', '고교', '20대', '30대', '40대', '50대', '60대', '70대', '80대', '90대', '100+'],
    'years': YEARS,
    'gid': g['gid'].tolist(),
    'lat': [ll(v) for v in g['lat']], 'lon': [ll(v) for v in g['lon']],
    'd': [DI.get(x, -1) if isinstance(x, str) else -1 for x in g['읍면동']],
    'v': vals.reshape(len(g), -1).tolist(),
    'note': '유소년(0~14세 추정, 타 연령과 중복) 제외. 5명 이하 비공개(0) 추정.'
}

# ---------- 실거래 ----------
tr = tr.reset_index(drop=True)
TYPES = ['아파트', '오피스텔', '연립다세대', '단독다가구']
tr['deal'] = np.where(tr['거래'] == '매매', 0, np.where(tr['전월세구분'] == '전세', 1, 2))
tr['day'] = (tr['계약일자'] - BASE).dt.days
tr['amt'] = np.where(tr['deal'] == 0, tr['거래금액(만원)'], tr['보증금(만원)']).astype(float)
tr['rent'] = tr['월세금(만원)'].fillna(0)
tr['cxname'] = tr['단지명'].fillna(tr.get('건물명'))
tr.loc[tr['유형'] == '단독다가구', 'cxname'] = None
tr['cxkey'] = np.where(tr['cxname'].notna(), tr['cxname'].astype(str) + '|' + tr['beop'], None)
cx = tr[tr['cxkey'].notna()].groupby('cxkey').agg(n=('cxname', 'first'), b=('beop', 'first'), t=('유형', 'first'),
                                                    lat=('lat', 'median'), lon=('lon', 'median'), d=('읍면동', 'first'),
                                                    road=('도로명', 'first'), jb=('번지', 'first'), by=('건축년도', 'median'),
                                                    prec=('prec', 'min'))
cx = cx.reset_index()
cxi = {k: i for i, k in enumerate(cx['cxkey'])}
locs = tr[['lat', 'lon', 'prec']].copy()
locs['k'] = locs['lat'].round(5).astype(str) + ',' + locs['lon'].round(5).astype(str) + locs['prec']
lu = locs.drop_duplicates('k').reset_index(drop=True)
lui = {k: i for i, k in enumerate(lu['k'])}
flags = (tr['해제'].astype(int)
         + (tr['거래유형'].astype(str) == '직거래').astype(int) * 2
         + (tr['계약구분'].astype(str) == '갱신').astype(int) * 4
         + (tr['갱신요구권 사용'].astype(str) == '사용').astype(int) * 8
         + (tr['주택유형'].astype(str) == '다가구').astype(int) * 16
         + (tr['계약구분'].astype(str) == '신규').astype(int) * 32)
PARTY = ['-', '개인', '법인', '공공기관', '기타']
pmap = {p: i for i, p in enumerate(PARTY)}
beop_codes, beop_vocab = enc(tr['beop'])
road_codes, road_vocab = enc(tr['도로조건'].replace('-', ''))
D['tx'] = {
    'types': TYPES, 'deals': ['매매', '전세', '월세'], 'beops': beop_vocab, 'roadcond': road_vocab, 'party': PARTY,
    'base': '2021-10-01',
    't': [TYPES.index(x) for x in tr['유형']],
    'k': tr['deal'].astype(int).tolist(),
    'd': [DI[x] for x in tr['읍면동']],
    'b': beop_codes,
    'day': tr['day'].astype(int).tolist(),
    'a': tr['amt'].fillna(0).round().astype(int).tolist(),
    'r': tr['rent'].round().astype(int).tolist(),
    'ar': (tr['면적'].fillna(0) * 10).round().astype(int).tolist(),
    'la': (tr['대지면적(㎡)'].fillna(0) * 10).round().astype(int).tolist(),
    'by': tr['건축년도'].fillna(0).astype(int).tolist(),
    'fl': tr['층'].fillna(-99).astype(int).tolist(),
    'cx': [cxi.get(k, -1) if k else -1 for k in tr['cxkey']],
    'loc': [lui[k] for k in locs['k']],
    'f': flags.astype(int).tolist(),
    'pa': (tr['종전계약 보증금(만원)'].fillna(0)).round().astype(int).tolist(),
    'pr': (tr['종전계약 월세(만원)'].fillna(0)).round().astype(int).tolist(),
    'buy': [pmap.get(str(x), 0) for x in tr['매수자']],
    'sel': [pmap.get(str(x), 0) for x in tr['매도자']],
    'rc': road_codes,
    'locs': {'lat': [ll(v) for v in lu['lat']], 'lon': [ll(v) for v in lu['lon']], 'p': lu['prec'].tolist()},
    'cxs': {'n': cx['n'].tolist(), 'b': cx['b'].tolist(), 't': [TYPES.index(x) for x in cx['t']],
            'lat': [ll(v) for v in cx['lat']], 'lon': [ll(v) for v in cx['lon']], 'd': [DI[x] for x in cx['d']],
            'road': cx['road'].fillna('').tolist(), 'jb': cx['jb'].fillna('').astype(str).tolist(),
            'by': cx['by'].fillna(0).astype(int).tolist(), 'p': cx['prec'].tolist()},
}

# ---------- 국민연금 ----------
nps = nps.reset_index(drop=True)
MONTHS = sorted(nps['기준월'].unique().tolist())
name_c, name_v = enc(nps['사업장명'])
ind_c, ind_v = enc(nps['사업장업종코드명'].replace({'nan': '미분류', '해당없음': '해당없음(미분류)'}))
nl = nps[['lat', 'lon', 'prec']].copy()
nl['k'] = nl['lat'].round(5).astype(str) + ',' + nl['lon'].round(5).astype(str) + nl['prec']
nlu = nl.drop_duplicates('k').reset_index(drop=True)
nlui = {k: i for i, k in enumerate(nlu['k'])}
D['nps'] = {
    'months': MONTHS, 'names': name_v, 'inds': ind_v,
    'm': [MONTHS.index(x) for x in nps['기준월']],
    'n': name_c, 'i': ind_c,
    'corp': (nps['형태'] == '법인').astype(int).tolist(),
    'act': (nps['상태'] == '등록').astype(int).tolist(),
    'd': [DI[x] for x in nps['읍면동']],
    'loc': [nlui[k] for k in nl['k']],
    'e': nps['가입자수'].fillna(0).astype(int).tolist(),
    'nw': nps['신규취득자수'].fillna(0).astype(int).tolist(),
    'ls': nps['상실가입자수'].fillna(0).astype(int).tolist(),
    'fee': (nps['당월고지금액'].fillna(0) / 1000).round().astype(int).tolist(),   # 천원
    'since': pd.to_datetime(nps['적용일자'], errors='coerce').dt.year.fillna(0).astype(int).tolist(),
    'locs': {'lat': [ll(v) for v in nlu['lat']], 'lon': [ll(v) for v in nlu['lon']], 'p': nlu['prec'].tolist()},
}

# ---------- 소상공인 (원본 39개 필드 전부) ----------
FIELDS = ['상가업소번호', '상호명', '지점명', '상권업종대분류코드', '상권업종대분류명', '상권업종중분류코드', '상권업종중분류명',
          '상권업종소분류코드', '상권업종소분류명', '표준산업분류코드', '표준산업분류명', '시도코드', '시도명', '시군구코드',
          '시군구명', '행정동코드', '행정동명', '법정동코드', '법정동명', '지번코드', '대지구분코드', '대지구분명', '지번본번지',
          '지번부번지', '지번주소', '도로명코드', '도로명', '건물본번지', '건물부번지', '건물관리번호', '건물명', '도로명주소',
          '구우편번호', '신우편번호', '동정보', '층정보', '호정보', '경도', '위도']
def fmt(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ''
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        return str(int(v))
    return str(v)
cols = {}
for f in FIELDS:
    if f in ('경도', '위도'):
        continue
    s = st[f].map(fmt) if st[f].dtype != object else st[f].fillna('').astype(str)
    codes, vocab = enc(s)
    cols[f] = {'c': codes, 'v': vocab}
D['st'] = {'fields': [f for f in FIELDS if f not in ('경도', '위도')], 'cols': cols,
           'lat': [ll(v) for v in st['위도']], 'lon': [ll(v) for v in st['경도']],
           'd': [DI.get(x, -1) for x in st['행정동명']]}

out = 'window.D=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';'
open(S + 'data.js', 'w').write(out)
print('data.js MB', round(len(out.encode()) / 1e6, 2))
for k in D:
    print(k, round(len(json.dumps(D[k], ensure_ascii=False, separators=(',', ':')).encode()) / 1e6, 2))
print('cells', len(g), 'tx', len(tr), 'cx', len(cx), 'locs', len(lu), 'nps', len(nps), 'nlocs', len(nlu))

# ---------- 이진 압축 (typed array + base64) ----------
import base64
def pack(a):
    a = np.asarray(a)
    if a.dtype.kind == 'f':
        a = np.round(a).astype(np.int64)
    lo, hi = int(a.min()) if len(a) else 0, int(a.max()) if len(a) else 0
    for dt, code in ((np.uint8, 'u8'), (np.int8, 'i8'), (np.uint16, 'u16'), (np.int16, 'i16'), (np.int32, 'i32')):
        info = np.iinfo(dt)
        if lo >= info.min and hi <= info.max:
            return {'$': code, 'b': base64.b64encode(a.astype(dt).tobytes()).decode()}
    raise ValueError('range')

def packobj(o):
    if isinstance(o, dict):
        return {k: packobj(v) for k, v in o.items()}
    if isinstance(o, list) and len(o) > 64 and all(isinstance(x, (int, np.integer)) and not isinstance(x, bool) for x in o[:200]):
        return pack(o)
    return o

D2 = dict(D)
D2['tx'] = packobj(D['tx']); D2['nps'] = packobj(D['nps'])
D2['st'] = dict(D['st']); D2['st']['cols'] = {f: {'c': pack(v['c']), 'v': v['v']} for f, v in D['st']['cols'].items()}
D2['st']['lat'] = pack(D['st']['lat']); D2['st']['lon'] = pack(D['st']['lon']); D2['st']['d'] = pack(D['st']['d'])
pv = np.array(D['pop']['v']).reshape(-1)
D2['pop'] = dict(D['pop']); D2['pop']['v'] = pack(pv); D2['pop']['lat'] = pack(D['pop']['lat']); D2['pop']['lon'] = pack(D['pop']['lon']); D2['pop']['d'] = pack(D['pop']['d'])
out = 'window.D=' + json.dumps(D2, ensure_ascii=False, separators=(',', ':')) + ';'
open(S + 'data.js', 'w').write(out)
print('packed data.js MB', round(len(out.encode()) / 1e6, 2))
for k in D2:
    print(' ', k, round(len(json.dumps(D2[k], ensure_ascii=False, separators=(',', ':')).encode()) / 1e6, 2))
json.dump({'pop_total': {str(y): int(vals[:, i].sum()) for i, y in enumerate(YEARS)}}, open(S + 'check.json', 'w'))

# ---------- gzip 압축 (브라우저 DecompressionStream으로 해제) ----------
import gzip
raw = json.dumps(D2, ensure_ascii=False, separators=(',', ':')).encode()
gz = gzip.compress(raw, 9)
raw1 = json.dumps(D, ensure_ascii=False, separators=(',', ':')).encode()
gz1 = gzip.compress(raw1, 9)
print('gzip(packed)', round(len(gz) / 1e6, 2), 'gzip(plain)', round(len(gz1) / 1e6, 2))
best = gz1 if len(gz1) < len(gz) else gz
open(S + 'data_gz.js', 'w').write('window.DZ="' + base64.b64encode(best).decode() + '";')
print('data_gz.js MB', round(len(base64.b64encode(best)) / 1e6, 2), 'plain' if best is gz1 else 'packed')
