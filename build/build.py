"""터무늬 대시보드 빌드 — src/ + data/ + 라이브러리를 하나의 HTML로 묶습니다.

사용법 (저장소 맨 위 폴더에서):
    npm install                      # echarts, leaflet 내려받기 (package.json)
    python build/build.py            # → index.html (공개판, 브이월드 키 없음)
    VWORLD_KEY=내키 python build/build.py --out dist/개인용.html   # 키를 넣은 개인용

※ 브이월드 키를 넣은 파일은 공개 저장소에 올리지 마세요(.gitignore 에서 dist/ 제외).
"""
import argparse, base64, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, NM = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'node_modules')
JS = ['core.js', 'tab_ov.js', 'tab_pop.js', 'tab_sale.js', 'tab_rent.js', 'tab_job.js', 'tab_store.js',
      'tab_cmp.js', 'tab_rad.js', 'tab_home.js', 'main.js']

ap = argparse.ArgumentParser()
ap.add_argument('--out', default=os.path.join(ROOT, 'index.html'))
args = ap.parse_args()

rd = lambda p: open(p, encoding='utf-8').read()
safe = lambda s: s.replace('</script', '<\\/script')
tpl = rd(os.path.join(SRC, 'template.html'))
lcss = rd(os.path.join(NM, 'leaflet/dist/leaflet.css'))
for img in ('layers.png', 'layers-2x.png', 'marker-icon.png'):
    b = base64.b64encode(open(os.path.join(NM, 'leaflet/dist/images', img), 'rb').read()).decode()
    lcss = lcss.replace(f'images/{img}', f'data:image/png;base64,{b}')
app = '\n'.join(rd(os.path.join(SRC, f)) for f in JS)
key = os.environ.get('VWORLD_KEY', '').strip()
app = re.sub(r"const VWORLD_KEY_DEFAULT = '[^']*';", f"const VWORLD_KEY_DEFAULT = '{key}';", app)
out = (tpl.replace('/*LEAFLET_CSS*/', lcss)
       .replace('<script>/*ECHARTS_JS*/</script>', '<script>' + safe(rd(os.path.join(NM, 'echarts/dist/echarts.min.js'))) + '</script>')
       .replace('<script>/*LEAFLET_JS*/</script>', '<script>' + safe(rd(os.path.join(NM, 'leaflet/dist/leaflet.js'))) + '</script>')
       .replace('<script>/*DATA_JS*/</script>', '<script>' + rd(os.path.join(ROOT, 'data/data_gz.js')) + '</script>')
       .replace('<script>/*APP_JS*/</script>', '<script>' + safe(app) + '</script>'))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, 'w', encoding='utf-8').write(out)
print(args.out, round(len(out.encode()) / 1e6, 2), 'MB', '(브이월드 키 포함)' if key else '(공개판 · 키 없음)')
