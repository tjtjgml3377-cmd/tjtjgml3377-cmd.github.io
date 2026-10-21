# ※ 원자료(실거래 엑셀·인구 격자·국민연금·소상공인)는 저장소에 포함하지 않았습니다.
#    RAW_DIR(원자료 폴더)·WORK_DIR(작업 폴더) 환경변수로 경로를 지정하세요.
#    파일 이름 패턴(glob)은 최초 작업 때 업로드한 파일 이름에 맞춰져 있어 새 자료에는 조정이 필요할 수 있습니다.
"""상가 좌표를 기준점으로 실거래·국민연금 위치 근사 + 대시보드용 JSON 패키징"""
import os
import json, re, math
import numpy as np, pandas as pd, geopandas as gpd
from pyproj import Transformer

S = os.environ.get('WORK_DIR', 'work/')
M = S + 'master/'
st = pd.read_parquet(M + 'stores.parquet')
tr = pd.read_parquet(M + 'transactions.parquet')
nps = pd.read_parquet(M + 'nps.parquet')
pop = pd.read_parquet(M + 'pop_grid.parquet')
grid = pd.read_csv(M + 'grid_geom.csv')
BND = gpd.read_file(S + 'bnd/asan_2025.gpkg')
DONGS = sorted(BND['읍면동'], key=lambda d: (not d.endswith('읍'), not d.endswith('면'), d))

# ---------------- 기준점 사전 ----------------
def split_road(addr):
    """'충청남도 아산시 배방읍 용연로 156-11' → ('용연로', 156, 11)"""
    m = re.search(r'(\S+(?:로|길)(?:\d+번길)?)\s+(\d+)(?:-(\d+))?\s*$', str(addr))
    if not m:
        return None
    return m.group(1), int(m.group(2)), int(m.group(3) or 0)

def beop_key(jibun_addr):
    """'충청남도 아산시 배방읍 장재리 1733' → '배방읍 장재리' / '충청남도 아산시 좌부동 223' → '좌부동'"""
    t = str(jibun_addr).split()
    t = t[2:]
    if t and t[0].endswith(('읍', '면')) and len(t) > 1 and t[1].endswith('리'):
        return ' '.join(t[:2])
    return t[0] if t else None

st['road_t'] = st['도로명주소'].map(split_road)
st['beop'] = st['지번주소'].map(beop_key)
st['jb_main'] = pd.to_numeric(st['지번본번지'], errors='coerce')
st['jb_sub'] = pd.to_numeric(st['지번부번지'], errors='coerce').fillna(0)
st['lat'], st['lon'] = st['위도'].astype(float), st['경도'].astype(float)
st['emd'] = st['행정동명']

road_exact, road_pts, jib_exact, jib_pts = {}, {}, {}, {}
for r in st.itertuples():
    if r.road_t:
        road, mn, sb = r.road_t
        road_exact.setdefault((road, mn, sb), []).append((r.lat, r.lon))
        road_pts.setdefault(road, []).append((mn, r.lat, r.lon, r.emd))
    if r.beop and not math.isnan(r.jb_main):
        jib_exact.setdefault((r.beop, int(r.jb_main), int(r.jb_sub)), []).append((r.lat, r.lon))
        jib_pts.setdefault(r.beop, []).append((int(r.jb_main), r.lat, r.lon))
avg = lambda L: (float(np.mean([a for a, _ in L])), float(np.mean([b for _, b in L])))
road_exact = {k: avg(v) for k, v in road_exact.items()}
jib_exact = {k: avg(v) for k, v in jib_exact.items()}
beop_cent = {k: avg([(a, b) for _, a, b in v]) for k, v in jib_pts.items()}
T = Transformer.from_crs(5179, 4326, always_xy=True)
emd_cent = {}
for _, r in BND.iterrows():
    c = r.geometry.representative_point()
    lon, lat = T.transform(c.x, c.y)
    emd_cent[r['읍면동']] = (lat, lon)

def hav(a, b):
    R = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))

def road_interp(road, num, emd=None):
    pts = road_pts.get(road)
    if not pts:
        return None
    if emd:
        sub = [p for p in pts if p[3] == emd]
        pts = sub or pts
    pts = sorted(pts)
    lo = [p for p in pts if p[0] <= num]
    hi = [p for p in pts if p[0] >= num]
    if lo and hi:
        a, b = lo[-1], hi[0]
        if a[0] == b[0]:
            return (a[1], a[2]), 'B'
        f = (num - a[0]) / (b[0] - a[0])
        ll = (a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]))
        return ll, ('B' if hav((a[1], a[2]), (b[1], b[2])) <= 400 else 'C')
    p = lo[-1] if lo else hi[0]
    return (p[1], p[2]), ('B' if abs(p[0] - num) <= 20 else 'C')

def road_centroid(road, emd=None, beop=None):
    pts = road_pts.get(road)
    if not pts:
        return None
    sub = [p for p in pts if emd and p[3] == emd] or pts
    return (float(np.median([p[1] for p in sub])), float(np.median([p[2] for p in sub])))

def jib_near(beop, main):
    pts = jib_pts.get(beop)
    if not pts:
        return None
    p = min(pts, key=lambda q: abs(q[0] - main))
    return (p[1], p[2]), ('B' if abs(p[0] - main) <= 3 else 'C')

# ---------------- 실거래 위치 ----------------
tr['beop'] = tr['시군구'].str.split().str[2:].str.join(' ')
loc_cache = {}
def locate_tx(r):
    emd = r['읍면동']
    beop = r['beop']
    road_str = str(r['도로명']) if pd.notna(r['도로명']) else ''
    rt = split_road('x ' + road_str)
    main = r.get('본번')
    sub = r.get('부번')
    key = (beop, main, sub, road_str, emd)
    if key in loc_cache:
        return loc_cache[key]
    res = None
    if pd.notna(main):
        k = (beop, int(main), int(sub if pd.notna(sub) else 0))
        if k in jib_exact:
            res = (jib_exact[k], 'A')
    if res is None and rt and rt[:3] in road_exact:
        res = (road_exact[rt[:3]], 'A')
    if res is None and rt:
        res = road_interp(rt[0], rt[1], emd)
    if res is None and pd.notna(main):
        res = jib_near(beop, int(main))
    if res is None and road_str:
        rn = road_str.split()[0]
        c = road_centroid(rn, emd)
        if c:
            res = (c, 'C')
    if res is None and beop in beop_cent:
        res = (beop_cent[beop], 'D')
    if res is None:
        res = (emd_cent[emd], 'E')
    loc_cache[key] = res
    return res

locs = tr.apply(locate_tx, axis=1)
tr['lat'] = [l[0][0] for l in locs]
tr['lon'] = [l[0][1] for l in locs]
tr['prec'] = [l[1] for l in locs]

# ---------------- 국민연금 위치 ----------------
def locate_nps(r):
    road = str(r['도로명'])
    c = road_centroid(road, r['읍면동']) if road and road != 'nan' and road != '충청남도' else None
    if c:
        return c, 'C'
    return emd_cent[r['읍면동']], 'E'
nl = nps.apply(locate_nps, axis=1)
nps['lat'] = [l[0][0] for l in nl]
nps['lon'] = [l[0][1] for l in nl]
nps['prec'] = [l[1] for l in nl]

print('TX precision by type\n', pd.crosstab(tr['유형'], tr['prec'], normalize='index').round(3))
print('NPS precision', nps['prec'].value_counts(normalize=True).round(3).to_dict())
# 품질점검: 배정된 좌표가 실제 읍면동 경계 안에 있는지
g = gpd.GeoDataFrame(tr[['읍면동', 'prec']], geometry=gpd.points_from_xy(tr['lon'], tr['lat']), crs=4326).to_crs(5179)
j = gpd.sjoin(g, BND[['읍면동', 'geometry']].rename(columns={'읍면동': 'chk'}), how='left', predicate='within')
j = j[~j.index.duplicated()]
print('TX 좌표-읍면동 일치율 by prec', (j['읍면동'] == j['chk']).groupby(j['prec']).mean().round(3).to_dict())

tr.to_parquet(M + 'transactions_geo.parquet')
nps.to_parquet(M + 'nps_geo.parquet')
import pickle
pickle.dump({'road_pts': road_pts, 'road_exact': road_exact, 'jib_pts': jib_pts, 'jib_exact': jib_exact,
             'beop_cent': beop_cent, 'emd_cent': emd_cent, 'DONGS': DONGS}, open(M + 'geo_dicts.pkl', 'wb'))
