/* ============================================================
   版本與更新（與 Terra 瀏覽器／網頁擷取、AI 全能翻譯相同的機制）
   - version.json：最新介面版本（線上更新，不用重裝）與 APK 版本
   - apks.json：所有 APK 版本清單，可下載任一版
   - index.html：最新介面；App 下載後存在 IndexedDB（fm-ota），下次開啟由開機程式套用
   ============================================================ */
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function dialog(title, html, btns) {
  const w = el('<div class="shWrap center"><div class="shBg"></div><div class="dlg"><h3 class="dlgT"></h3><div class="dlgB"></div><div class="dlgBtns"></div></div></div>');
  $('.dlgT', w).textContent = title; $('.dlgB', w).innerHTML = html;
  const me = {el: w, closed: false, close() { if (me.closed) return; me.closed = true; const i = sheets.indexOf(me); if (i >= 0) sheets.splice(i, 1); w.classList.remove('on'); setTimeout(() => w.remove(), 220); }};
  btns.forEach((b, i) => { const x = el(`<button class="btn block ${i === 0 && btns.length > 1 ? 'pri' : ''}"></button>`); x.textContent = b[0]; x.onclick = () => { me.close(); if (b[1]) b[1](); }; $('.dlgBtns', w).append(x); });
  $('.shBg', w).onclick = () => me.close(); document.body.append(w); w.offsetHeight; w.classList.add('on'); sheets.push(me); return me;
}
var Upd = {
  gt(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] || 0, q = y[i] || 0; if (p !== q) return p > q; } return false; },
  apk() { try { return (IS_APP && NB.version && NB.version()) || ''; } catch (e) { return ''; } },
  autoOn() { return S.autoUpd !== false; },
  native() { return !!(IS_APP && NB.installApk); },
  say(t) { const st = $('#updSt'); if (st) st.textContent = t; },
  boot() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.onResume(); });
    if (!this.autoOn()) return; setTimeout(() => this.auto(), 4000);
  },
  auto() { if (!this.autoOn() || this.isOpen() || sheets.length || (this.instAt && Date.now() - this.instAt < 10 * 60e3)) return;   /* 正在下載安裝新版時不重複提醒 */
    lsSet('fm.updAt', Date.now()); this.check(false); },
  async getJson(name) {
    const r = await fetch(GH.pages + name + '?t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error(r.status === 404 ? 'GitHub 上還沒有發布版本（請確認已開啟 GitHub Pages）' : 'HTTP ' + r.status); return r.json();
  },
  idb() { return new Promise((res, rej) => { const q = indexedDB.open('fm-ota', 1); q.onupgradeneeded = () => { q.result.createObjectStore('f'); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async store(html) { const db = await this.idb(); await new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(html, 'html'); t.oncomplete = res; t.onerror = () => rej(t.error); }); db.close(); },
  async check(manual) {
    const self = this;
    try {
      this.say('檢查中…');
      const v = await this.getJson('version.json'); lsSet('fm.updLast', {v, t: Date.now()});
      const apk = this.apk(), apkNew = IS_APP && apk && v.apkName && this.gt(v.apkName, apk), must = IS_APP && v.minApk && apk && this.gt(v.minApk, apk);
      const apkDlg = must => { this.say('有新版 APK v' + (v.apkName || v.app) + (must ? '（需要重新安裝）' : ''));
        this.dialog('🎉 有新版 APK v' + esc(v.apkName || v.app), (v.notes ? esc(v.notes) + '<br><br>' : '') + (must ? '這次是大改版（手機端程式有更新），需要安裝新的 APK。' : '手機端程式有更新，建議安裝新的 APK。') +
          (this.native() ? '按「下載並安裝」會直接在 App 裡下載，完成後跳出系統的「更新」確認；' : '') + '會直接覆蓋舊版，收藏、菜單、食譜與設定都會保留。',
          [[this.native() ? '⬇ 下載並安裝' : '⬇ 下載最新版 APK', () => self.installLatest()], ['稍後', () => { if (!must) lsSet('fm.apkSnooze', {v: v.apkName, t: Date.now()}); }]]); };
      if (must) { apkDlg(true); return; }
      const snz = lsGet('fm.apkSnooze', null), snoozed = !manual && snz && snz.v === v.apkName && Date.now() - snz.t < 12 * 3600e3;
      if (apkNew && !this.gt(v.app, APP_VERSION)) { if (!snoozed) apkDlg(false); else this.say('有新版 APK v' + v.apkName); return; }
      if (!this.gt(v.app, APP_VERSION)) { this.say('已經是最新版本 v' + APP_VERSION); if (manual) toast('已經是最新版本 v' + APP_VERSION); return; }
      if (!IS_APP) { this.say('有新版本 v' + v.app);
        if (manual) this.dialog('有新版本 v' + esc(v.app), (v.notes ? esc(v.notes) + '<br><br>' : '') + '網頁版請開啟 GitHub 上的最新網頁版，或重新下載 HTML 檔。', [['🌐 開啟最新網頁版', () => openUrl(GH.pages)], ['稍後', null]]); return; }
      this.say('下載新版本 v' + v.app + '…');
      const r = await fetch(GH.pages + 'index.html?t=' + Date.now(), {cache: 'no-store'}); if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      if (html.indexOf("const APP_VERSION = '" + v.app + "'") < 0 || html.length < 200000) throw new Error('下載不完整，稍後再試');
      await this.store(html); lsSet('fm.ota', {ver: v.app, minApk: v.minApk || ''}); try { localStorage.removeItem('fm.otaFail'); } catch (e) {}
      this.say('已下載 v' + v.app + '，重新開啟後套用');
      this.dialog('已下載新版本 v' + esc(v.app), v.notes ? esc(v.notes) : '介面與功能更新', [['🔄 立即套用', () => location.reload()], ['下次開啟時套用', null]]);
    } catch (e) { const m = e instanceof TypeError ? '網路連線失敗' : e.message; this.say('無法檢查更新：' + m); if (manual) toast('無法檢查更新：' + m, 3500); }
  },
  async releases() {
    this.dialog('⬇ 下載 APK', '<div id="relL" class="small muted">讀取 GitHub 版本清單中…</div>', [['關閉', null]]);
    try { const L = await this.getJson('apks.json'), apk = this.apk(), box = $('#relL'); if (!box) return; box.className = '';
      box.innerHTML = L.length ? L.map((x, i) => `<div class="relR"><div class="grow"><b>v${esc(x.v)}</b>${i === 0 ? ' <span class="vTag" style="background:#5f9a5a">最新</span>' : ''}${apk && x.v === apk ? ' <span class="vTag" style="background:#a2613a">目前安裝</span>' : ''}
        <div class="small muted">${esc(x.date || '')}${x.size ? '・' + (x.size / 1048576).toFixed(1) + ' MB' : ''}</div>${x.notes ? `<div class="small muted relN">${esc(x.notes)}</div>` : ''}</div>
        <button class="btn sm ${i === 0 ? 'pri' : ''}" data-v="${esc(x.v)}" data-u="${esc(GH.pages + 'apk/' + encodeURIComponent(x.file))}">⬇</button></div>`).join('') : '<div class="small muted">GitHub 上還沒有可下載的 APK</div>';
      $$('[data-u]', box).forEach(b => { b.onclick = () => this.install(b.dataset.u, b.dataset.v); });
    } catch (e) { const box = $('#relL'); if (box) box.textContent = '⚠️ 無法讀取版本清單：' + (e instanceof TypeError ? '網路連線失敗' : e.message); }
  },
  async installLatest() { try { const L = await this.getJson('apks.json'); if (!L.length) throw new Error('沒有可下載的 APK'); this.install(GH.pages + 'apk/' + encodeURIComponent(L[0].file), L[0].v); }
    catch (e) { toast('無法取得版本清單：' + e.message, 3500); this.releases(); } },
  install(url, v) {
    const self = this;
    if (!this.native()) { openUrl(url); toast('已用瀏覽器開始下載，完成後點通知安裝（直接覆蓋安裝，資料會保留）', 4500); return; }
    if (!NB.canInstall()) { this.pend = {url, v};
      this.dialog('需要允許安裝', '第一次在 App 內更新，需要允許「食光地圖」安裝應用程式。按「前往設定」打開「允許來自這個來源的應用程式」，回到 App 後會自動繼續下載安裝。',
        [['前往設定', () => NB.askInstall()], ['改用瀏覽器下載', () => { self.pend = null; openUrl(url); }], ['取消', () => { self.pend = null; }]]); return; }
    this.pend = null; this.instUrl = url; this.instAt = Date.now();
    this.dialog('⬇ 更新到 v' + esc(v || ''), '<div id="apkTx" class="small muted">準備下載…</div><div class="prog" style="margin-top:8px"><i id="apkBar" style="width:0%"></i></div>', [['在背景繼續', null]]);
    NB.installApk(url);
  },
  onResume() {
    if (this.autoOn() && Date.now() - lsGet('fm.updAt', 0) > 30 * 60e3) setTimeout(() => this.auto(), 1500);
    if (this.pend && this.native() && NB.canInstall()) { const p = this.pend; this.pend = null; setTimeout(() => this.install(p.url, p.v), 400); }
  },
  /* 原生端回報下載／安裝進度 */
  onApk(d) {
    try { d = typeof d === 'string' ? JSON.parse(d) : d; } catch (e) { return; }
    const set = (t, p) => { const tx = $('#apkTx'), bar = $('#apkBar'); if (tx) tx.textContent = t; if (bar && p != null) bar.style.width = Math.round(p * 100) + '%'; };
    if (d.state === 'download') set(d.pct >= 0 ? '下載中 ' + Math.round(d.pct * 100) + '%' : '下載中…', d.pct >= 0 ? d.pct : null);
    else if (d.state === 'installing') set('下載完成，準備安裝…', 1);
    else if (d.state === 'confirm') set('請在系統視窗按「更新」；安裝完成後重新開啟 App 就是新版本（收藏、菜單、食譜與設定都保留）', 1);
    else if (d.state === 'done') { this.instAt = 0; set('✓ 安裝完成', 1); toast('✓ 已更新完成'); }
    else if (d.state === 'error') { this.instAt = 0; const u = this.instUrl; this.dialog('更新沒有完成', esc(d.msg || '未知錯誤') + '<br><br>可以改用瀏覽器下載 APK，再點通知安裝（直接覆蓋舊版）。', [['改用瀏覽器下載', () => { if (u) openUrl(u); }], ['關閉', null]]); }
  },
  restore() { this.dialog('還原為 APK 內建版本？', '會刪除線上下載的新版介面，改回這支 APK 內建的版本。收藏、菜單、食譜與設定不受影響。', [['還原', () => { try { localStorage.removeItem('fm.ota'); } catch (e) {} location.replace(location.pathname + '#builtin'); location.reload(); }], ['取消', null]]); },
  share() { const url = GH.pages + 'download.html'; if (IS_APP && NB.share) NB.share('食光地圖 App 下載：' + url); else if (navigator.share) navigator.share({title: '食光地圖', url}).catch(() => {}); else copyText(url); },
  dialog(title, html, btns) { if (this.dlg) this.dlg.close(); this.dlg = dialog(title, html, btns); return this.dlg; },
  isOpen() { return !!(this.dlg && !this.dlg.closed); },
  /* 設定頁的「版本與更新」卡片 */
  card() {
    const last = lsGet('fm.updLast', null), apk = this.apk(), ota = window.__OTA || (lsGet('fm.ota', null) || {}).ver;
    const row = (a, ic, t, s, extra) => `<button class="setR" data-a="${a}" style="width:100%;text-align:left"><span style="font-size:1.3rem">${ic}</span><div class="t"><b>${t}</b><small>${s}</small>${extra || ''}</div><span class="muted">›</span></button>`;
    return `<div class="setR"><div class="t"><b>自動更新</b><small>開啟 App 時從 GitHub 下載最新版介面與功能（不用重新安裝 APK）；大改版才需要下載新 APK</small></div><button class="sw2 ${this.autoOn() ? 'on' : ''}" data-sw="autoUpd" role="switch" aria-checked="${this.autoOn()}"></button></div>` +
      row('updChk', '🔄', '檢查更新', '目前版本 v' + APP_VERSION + (IS_APP ? '・APK v' + (apk || '?') : '・網頁版') + (window.__OTA ? '（已線上更新）' : ''),
        `<small id="updSt">${last ? '上次檢查 ' + new Date(last.t).toLocaleString('zh-TW', {hour12: false}).slice(0, -3) + (last.v && this.gt(last.v.app, APP_VERSION) ? '・有新版本 v' + esc(last.v.app) : '') : ''}</small>`) +
      (IS_APP ? row('updApk', '⬇', '下載 APK 到手機', '可選最新版或任一舊版本') : row('updWeb', '🌐', '開啟線上最新網頁版', 'GitHub Pages 上永遠是最新版')) +
      (IS_APP && ota ? row('updBack', '↩️', '還原為 APK 內建版本', '線上更新後有問題時使用（v' + esc(window.APP_BUILTIN || '') + '）') : '') +
      row('updShare', '📤', '分享這個 App', '傳下載網址給朋友：網址固定不變，打開永遠是最新版 APK');
  }
};
