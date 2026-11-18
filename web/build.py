#!/usr/bin/env python3
"""組合單檔網頁：python3 web/build.py  →  web/dist/index.html，並複製到 APK 的 app/src/main/assets/"""
import os, shutil
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..')
ver = os.environ.get('VER') or open(os.path.join(root, 'VERSION')).read().strip()
R = lambda *p: open(os.path.join(here, *p), encoding='utf-8').read()

order = ['a_core', 'b_map', 'c_places', 'd_app', 'e_update', 'f_area', 'g_meal', 'z_boot']
app = '\n'.join(R('parts', n + '.js') for n in order).replace('__VER__', ver)
assert '</script' not in app.lower()
assert "const APP_VERSION = '" + ver + "'" in app          # 線上更新靠這一行確認下載到的版本
shell = R('shell.html').strip()
assert shell.startswith('<body>')
html = ('<!DOCTYPE html>\n<html lang="zh-Hant" data-theme="light">\n<head>\n<script>' + R('ota_boot.js').replace('__VER__', ver) + '</script>\n'
  '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n'
  '<meta name="theme-color" content="#efe5d3">\n<title>食光地圖</title>\n<link rel="icon" href="icon-192.png">\n'
  '<style>' + R('vendor', 'maplibre.css') + '</style>\n<style>' + R('app.css') + '</style>\n</head>\n' +
  shell.replace('</body>', '') + '\n<script>' + R('vendor', 'maplibre.js') + '</script>\n<script>' + R('vendor', 'topojson.js') + '</script>\n<script>' + R('vendor', 'tw_topo.js') + '</script>\n<script>' + app + '</script>\n</body>\n</html>\n')

dist = os.path.join(here, 'dist'); os.makedirs(dist, exist_ok=True)
open(os.path.join(dist, 'index.html'), 'w', encoding='utf-8').write(html)
assets = os.path.join(root, 'app', 'src', 'main', 'assets'); os.makedirs(assets, exist_ok=True)
shutil.copy(os.path.join(dist, 'index.html'), os.path.join(assets, 'index.html'))
for n in ['icon-192.png', 'icon-512.png']:
    shutil.copy(os.path.join(here, n), os.path.join(dist, n)); shutil.copy(os.path.join(here, n), os.path.join(assets, n))
print('built v%s  %d bytes' % (ver, len(html)))
