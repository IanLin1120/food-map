/* ============================================================
   行政區外框（縣市、鄉鎮市區，資料與做法同「台灣即時天氣預報」）＋ 離線地圖（行跡導航 GitHub 上的圖磚資料包）
   ============================================================ */
const TW = {towns: [], counties: {}, names: [], ready: false,
  init() {
    if (this.ready || !window.TW_TOPO || !window.topojson) return this.ready; const t = window.TW_TOPO, fc = topojson.feature(t, t.objects.towns), byC = {};
    fc.features.forEach((f, i) => { const p = f.properties, town = {i, name: p.t, county: p.c, geom: f.geometry, bbox: this.bbox(f.geometry)}; this.towns.push(town); (byC[p.c] = byC[p.c] || []).push(town); });
    const order = ['臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];
    this.names = order.filter(c => byC[c]).concat(Object.keys(byC).filter(c => !order.includes(c)));
    for (const c of this.names) { const geom = topojson.merge(t, t.objects.towns.geometries.filter(g => g.properties.c === c));
      this.counties[c] = {name: c, geom, bbox: this.bbox(geom), towns: byC[c].slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))}; }
    return this.ready = true;
  },
  bbox(g) { let a = 180, b = 90, c = -180, d = -90; const ring = r => { for (const p of r) { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0]; if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; } };
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly => ring(poly[0])); return [a, b, c, d]; },
  inRing(r, x, y) { let inside = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; },
  inGeom(g, x, y) { for (const poly of (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) { if (!this.inRing(poly[0], x, y)) continue; let hole = false; for (let k = 1; k < poly.length; k++) if (this.inRing(poly[k], x, y)) { hole = true; break; } if (!hole) return true; } return false; },
  townAt(lon, lat) { for (const t of this.towns) { const b = t.bbox; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue; if (this.inGeom(t.geom, lon, lat)) return t; } return null; }
};
var Area = {cache: new Map(), hideList: false,
  /* 這間店在不在目前選取的區域裡（沒選區域＝全部都算） */
  has(p) { const a = S.area; if (!a || !TW.ready) return true; let t = this.cache.get(p.id); if (t === undefined || t.lat !== p.lat || t.lon !== p.lon) { const tw = TW.townAt(p.lon, p.lat); t = {lat: p.lat, lon: p.lon, c: tw ? tw.county : '', t: tw ? tw.name : ''}; this.cache.set(p.id, t); }
    return t.c === a.c && (!a.t || t.t === a.t); },
  init() {
    if (!TW.init()) { $('#areaBar').classList.add('hide'); return; }
    if (S.area && !TW.counties[S.area.c]) S.area = null;
    const c = $('#arC'), t = $('#arT'); c.innerHTML = '<option value="">縣市</option>' + TW.names.map(n => `<option>${n}</option>`).join('');
    c.onchange = () => this.set(c.value ? {c: c.value, t: ''} : null, true); t.onchange = () => this.set(c.value ? {c: c.value, t: t.value} : null, true);
    $('#arX').onclick = () => this.set(null);
    $('#arMe').onclick = () => { const go = (lon, lat) => { const tw = TW.townAt(lon, lat); if (!tw) { toast('這個位置不在台灣的行政區範圍內'); return; } this.set({c: tw.county, t: tw.name}, true); };
      if (M.meLL) { go(M.meLL[1], M.meLL[0]); return; } if (!navigator.geolocation) { if (M.map) { const k = M.map.getCenter(); go(k.lng, k.lat); } return; }
      toast('定位中…'); navigator.geolocation.getCurrentPosition(p => go(p.coords.longitude, p.coords.latitude), () => { if (M.map) { const k = M.map.getCenter(); go(k.lng, k.lat); toast('無法定位，改用地圖中心所在的區域'); } }, {enableHighAccuracy: true, timeout: 8000, maximumAge: 60000}); };
    this.ui();
  },
  ui() { const a = S.area, c = $('#arC'), t = $('#arT'); c.value = a ? a.c : ''; t.innerHTML = '<option value="">' + (a ? '全部鄉鎮市區' : '鄉鎮市區') + '</option>' + (a ? TW.counties[a.c].towns.map(x => `<option>${x.name}</option>`).join('') : ''); t.value = a ? a.t || '' : ''; t.disabled = !a;
    $('#arX').classList.toggle('hide', !a); c.classList.toggle('on', !!a); t.classList.toggle('on', !!(a && a.t)); },
  set(a, fit) { S.area = a && a.c ? {c: a.c, t: a.t || ''} : null; saveS(); this.hideList = false; this.ui(); this.draw(); M.sel = null; M.draft = null; if (M.temp) { M.temp.remove(); M.temp = null; }
    renderChips(); syncMarkers(); if (S.area) { this.card(); if (fit) this.fit(); } else hideCard(); if (curTab === 'Fav') renderFav(); },
  cur() { const a = S.area; if (!a) return null; const co = TW.counties[a.c]; return a.t ? co.towns.find(x => x.name === a.t) || co : co; },
  fit() { if (!M.map) return; const g = this.cur(); if (!g) return; const b = g.bbox; M.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {padding: {top: 190, bottom: 240, left: 30, right: 60}, duration: 800, pitch: 0, bearing: 0, maxZoom: 15}); },
  /* 點地圖：區域模式下，點到哪個鄉鎮市區就切到那一區 */
  tap(lon, lat) { if (!S.area || !TW.ready) return; const tw = TW.townAt(lon, lat); if (!tw) return; if (tw.county === S.area.c && tw.name === S.area.t) { if (this.hideList) { this.hideList = false; this.card(); } return; } buzz(15); this.set({c: tw.county, t: tw.name}, false); },
  /* 在地圖上畫外框：縣市粗框、縣內各鄉鎮細線、選取的鄉鎮上色 */
  draw() { const m = M.map; if (!m || !TW.ready || !m.isStyleLoaded()) { if (m && TW.ready) m.once('idle', () => this.draw()); return; }
    const a = S.area, co = a && TW.counties[a.c], fc = f => ({type: 'FeatureCollection', features: f}), ft = g => ({type: 'Feature', properties: {}, geometry: g}), tw = a && a.t && co.towns.find(x => x.name === a.t);
    const data = {'ar-t': fc(co ? co.towns.map(x => ft(x.geom)) : []), 'ar-c': fc(co ? [ft(co.geom)] : []), 'ar-s': fc(tw ? [ft(tw.geom)] : [])};
    try { for (const k in data) { if (m.getSource(k)) m.getSource(k).setData(data[k]); else m.addSource(k, {type: 'geojson', data: data[k]}); }
      if (!m.getLayer('ar-t-line')) { const col = '#9a5a34';
        m.addLayer({id: 'ar-s-fill', type: 'fill', source: 'ar-s', paint: {'fill-color': col, 'fill-opacity': .14}});
        m.addLayer({id: 'ar-t-line', type: 'line', source: 'ar-t', paint: {'line-color': col, 'line-width': 1.2, 'line-opacity': .55}});
        m.addLayer({id: 'ar-c-line', type: 'line', source: 'ar-c', layout: {'line-join': 'round'}, paint: {'line-color': col, 'line-width': 3, 'line-opacity': .9}});
        m.addLayer({id: 'ar-s-line', type: 'line', source: 'ar-s', layout: {'line-join': 'round'}, paint: {'line-color': col, 'line-width': 4}}); } } catch (e) {} },
  /* 下方清冊：這一區（再依上方分類篩選）的所有收藏 */
  card() { const a = S.area; if (!a) return; const ps = placesShown(M.filter), f = M.filter === 'all' ? null : (M.filter === '' ? UNCAT : catOf(M.filter));
    showCard(`<div class="row"><div class="grow"><h3>${esc(a.c)}${a.t ? ' ' + esc(a.t) : ''}</h3><div class="small muted">${f ? esc(f.icon + ' ' + f.name) + ' · ' : ''}${ps.length} 間收藏${a.t ? '' : ' · 點地圖上的鄉鎮市區可只看那一區'}</div></div><button class="ic" data-a="ax" aria-label="收起清冊">✕</button></div>
      <div class="arList">${ps.map(p => { const c = catOf(p.cat), st = stateHtml(p); return `<button class="res" data-a="ap" data-id="${p.id}"><span class="rIc" style="background:${c.color}">${esc(c.icon)}</span><span class="grow"><b>${esc(p.name)}</b><small>${st ? `<span class="row" style="gap:.3rem;display:inline-flex">${st}</span> · ` : ''}${esc(p.addr || '')}</small></span></button>`; }).join('') || '<div class="resNote">這一區還沒有' + (f ? '「' + esc(f.name) + '」的' : '') + '收藏</div>'}</div>`); }
};

/* ---------------- 離線地圖 ---------------- */
const RDB = 'https://github.com/IanLin1120/xingji-roaddata/releases/download/data/';
var Off = {tjUrl: 'https://tiles.openfreemap.org/planet', st: lsGet('fm.off', {packs: {}, extras: false, t: 0}), job: null, cbs: {}, inited: false,
  native() { return !!(IS_APP && NB.packGet); },
  has() { return this.native() && Object.keys(this.st.packs).length > 0; },
  save() { lsSet('fm.off', this.st); },
  /* 線上圖磚網址（OpenFreeMap 每週換版本路徑，所以要定期重抓） */
  async tpl(force) { const c = lsGet('fm.tj', null); if (c && c.u && !force && Date.now() - c.t < 12 * 3600e3) return c.u; if (this.tjP) return this.tjP;
    this.tjP = (async () => { try { const j = await jfetch(this.tjUrl, null, 12000); if (j && j.tiles && j.tiles[0]) { lsSet('fm.tj', {u: j.tiles[0], t: Date.now()}); return j.tiles[0]; } } catch (e) {} return c && c.u || null; })(); const u = await this.tjP; this.tjP = null; return u; },
  init() { if (this.inited) return; this.inited = true; const self = this, buf = async r => ({data: await r.arrayBuffer()});
    maplibregl.addProtocol('fmt', async (p, ac) => { const k = p.url.slice(6);
      if (self.has()) { try { const r = await fetch(location.origin + '/vt/' + k); if (r.ok) return buf(r); } catch (e) {} }
      let u = await self.tpl(); if (!u) throw new Error('沒有網路，這個範圍也還沒下載離線地圖'); const [z, x, y] = k.split('/'), mk = t => t.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      let r = await fetch(mk(u), {signal: ac.signal}); if (r.status === 404 && !self.tplRetry) { self.tplRetry = 1; const n = await self.tpl(true); if (n && n !== u) r = await fetch(mk(n), {signal: ac.signal}); }
      if (!r.ok) throw new Error('tile ' + r.status); return buf(r); });
    maplibregl.addProtocol('fmc', async (p, ac) => { const real = p.url.slice(6), out = async r => ({data: p.type === 'json' ? await r.json() : await r.arrayBuffer()});
      if (self.native() && self.st.extras) { try { const r = await fetch(location.origin + '/oc?u=' + encodeURIComponent(real)); if (r.ok) return out(r); } catch (e) {} }
      const r = await fetch(real, {signal: ac.signal}); if (!r.ok) throw new Error('res ' + r.status); return out(r); });
    this.tpl();
    if (this.native()) { try { const l = JSON.parse(NB.offList() || '{}'); if (l.packs) { const ks = new Set(l.packs.map(x => x.k)); Object.keys(this.st.packs).forEach(k => { if (!ks.has(k)) delete this.st.packs[k]; }); l.packs.forEach(x => { if (!this.st.packs[x.k]) this.st.packs[x.k] = {size: x.size, n: x.n}; }); this.save(); } } catch (e) {} }
  },
  async man() { const j = await jfetch(RDB + 'manifest.json?' + Math.floor(Date.now() / 36e5), null, 20000); if (!j || !j.vec || !j.vec.packs) throw new Error('GitHub 上找不到地圖資料包'); return j; },
  bytes() { return Object.values(this.st.packs).reduce((n, x) => n + (x.size || 0), 0); },
  /* 原生端回報：{id, s:'prog'|'done'|'err', a, b, msg} */
  onNative(d) { try { d = typeof d === 'string' ? JSON.parse(d) : d; } catch (e) { return; } const f = this.cbs[d.id]; if (f) f(d); },
  get(kind, url, key, onProg) { return new Promise((res, rej) => { const id = 'o' + uid(); this.cbs[id] = d => { if (d.s === 'prog') { if (onProg) onProg(d.a, d.b); return; } delete this.cbs[id]; if (d.s === 'done') res(d); else rej(new Error(d.msg || '下載失敗')); };
    if (kind === 'pack') NB.packGet(id, url, key); else NB.cacheGet(id, url); }); },
  async start(boxes, label) {
    if (!this.native()) { toast('離線地圖需要 APK v1.2.0 以上'); return; } if (this.job) { toast('已經在下載中'); return; }
    let m; try { this.say('讀取 GitHub 資料清單…'); m = await this.man(); } catch (e) { this.say('❌ ' + e.message); return; }
    const P = m.vec.packs, hit = b => !boxes || boxes.some(x => !(x[2] <= b[0] || x[0] >= b[2] || x[3] <= b[1] || x[1] >= b[3]));
    const keys = Object.keys(P).filter(k => (k === 'base' || hit(P[k].bb)) && !(this.st.packs[k] && this.st.t === m.t));
    const total = keys.reduce((n, k) => n + P[k].size, 0);
    if (!keys.length && this.st.extras) { this.say('這個範圍已經下載過了（資料日期 ' + dateName(m.t) + '）'); toast('這個範圍已經是最新的離線地圖'); return; }
    if (total > 30e6 && !await ask(`要下載「${label}」的離線地圖嗎？\n大約 ${(total / 1048576).toFixed(0)} MB（解壓後會佔用更多空間），建議用 Wi-Fi。`, '開始下載')) { this.say(''); return; }
    const job = this.job = {label, keys, total, done: 0, cur: {}, fail: [], cancel: false}; let i = 0;
    const upd = () => { const d = job.done + Object.values(job.cur).reduce((a, b) => a + b, 0); this.say(`下載「${label}」… ${(d / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`, total ? d / total : 0, true); };
    const worker = async () => { while (i < keys.length && !job.cancel) { const k = keys[i++], e = P[k]; let ok = false;
      for (let t = 0; t < 3 && !ok && !job.cancel; t++) { try { const d = await this.get('pack', RDB + e.f, k, a => { job.cur[k] = Math.min(a, e.size); upd(); }); this.st.packs[k] = {size: e.size, n: d.a}; ok = true; } catch (er) { await sleep(1500); } }
      delete job.cur[k]; if (ok) { job.done += e.size; this.save(); } else job.fail.push(k); upd(); } };
    upd(); await Promise.all([worker(), worker(), worker()]);
    /* 字型與圖示（沒有它們，離線時地圖上的文字會出不來） */
    if (!job.cancel) { this.say('下載地圖字型與圖示…', 1, true); const rs = M.rawStyle || {}, ex = [];
      if (typeof rs.glyphs === 'string') (rs.fonts || []).forEach(f => ['0-255', '256-511', '8192-8447', '12288-12543', '65280-65535'].forEach(r => ex.push(rs.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r))));
      if (typeof rs.sprite === 'string') ['.json', '.png', '@2x.json', '@2x.png'].forEach(x => ex.push(rs.sprite + x));
      let bad = 0; for (const u of ex) { if (job.cancel) break; try { await this.get('cache', u); } catch (e) { bad++; } } if (ex.length && bad < ex.length / 2) this.st.extras = true; }
    if (!job.fail.length && !job.cancel) this.st.t = m.t; this.save(); this.job = null;
    const msg = job.cancel ? '已停止下載（已下載的部分可以使用）' : job.fail.length ? `下載完成，但有 ${job.fail.length} 個區塊失敗，請再按一次下載補齊` : `✅「${label}」離線地圖下載完成`;
    this.say(msg); toast(msg, 3500); buzz(30); if (curTab === 'Set') renderSet();
  },
  stop() { if (this.job) { this.job.cancel = true; if (NB.offCancel) NB.offCancel(); } },
  async clear() { if (!await ask('確定要刪除所有離線地圖嗎？\n（收藏、菜單、食譜不受影響；之後地圖改回上網讀取）', '刪除', true)) return; try { NB.offDelete('*'); } catch (e) {} this.st = {packs: {}, extras: false, t: 0}; this.save(); toast('已刪除離線地圖'); renderSet(); },
  say(t, p, run) { this.msg = t; this.pct = run ? p : null; const o = $('#offSt'); if (o) o.innerHTML = esc(t || '') + (run ? `<div class="prog" style="margin-top:6px"><i style="width:${Math.round((p || 0) * 100)}%"></i></div>` : ''); const b = $('#offStop'); if (b) b.classList.toggle('hide', !run); },
  viewBoxes() { const b = M.map.getBounds(); return [[b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]]; },
  card() {
    if (!IS_APP) return `<div class="setR"><div class="t"><b>離線地圖</b><small>只有 Android App 可以下載離線地圖；網頁版需要連線才能顯示地圖。</small></div></div>`;
    if (!this.native()) return `<div class="setR"><div class="t"><b>離線地圖</b><small>需要 APK v1.2.0 以上。請到下方「版本與更新 → 下載 APK 到手機」安裝新版。</small></div></div>`;
    const n = Object.keys(this.st.packs).length, a = S.area, g = a && Area.cur();
    return `<div class="setR col"><div class="t"><b>離線地圖</b><small>從行跡導航的 GitHub 資料庫（每週更新）下載 3D 地圖資料，沒有網路也能看地圖。${n ? `<br>目前已下載 ${n} 個區塊，約 ${(this.bytes() / 1048576).toFixed(0)} MB${this.st.t ? '・資料日期 ' + dateName(this.st.t) : ''}${this.st.extras ? '' : '・⚠️ 字型尚未下載完成'}` : '<br>目前尚未下載。'}</small></div>
      <div class="row wrap">${g ? `<button class="btn sm pri" data-a="offArea">⬇ 下載「${esc(a.t || a.c)}」</button>` : ''}<button class="btn sm ${g ? '' : 'pri'}" data-a="offView">⬇ 下載目前地圖畫面範圍</button><button class="btn sm" data-a="offAll">⬇ 下載全台灣</button>${n ? '<button class="btn sm danger" data-a="offDel">刪除離線地圖</button>' : ''}<button class="btn sm danger ${this.job ? '' : 'hide'}" id="offStop" data-a="offStop">停止</button></div>
      <div class="testOut" id="offSt">${esc(this.msg || '')}${this.job && this.pct != null ? `<div class="prog" style="margin-top:6px"><i style="width:${Math.round(this.pct * 100)}%"></i></div>` : ''}</div></div>`;
  },
  act(a) { if (a === 'offStop') return this.stop(); if (a === 'offDel') return this.clear(); if (a === 'offAll') return this.start(null, '全台灣');
    if (a === 'offArea') { const g = Area.cur(), b = g.bbox; return this.start([[b[1], b[0], b[3], b[2]]], S.area.t || S.area.c); }
    if (a === 'offView') { if (!M.map) return toast('地圖尚未就緒'); return this.start(this.viewBoxes(), '目前地圖畫面'); } }
};
