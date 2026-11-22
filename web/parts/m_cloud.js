/* ============================================================
   雲端備份：Google 雲端硬碟（App 用手機上的 Google 帳戶登入）、pCloud（帳號密碼登入取得權杖）
   上傳的是整個日日帳本的備份檔（含所有圖片、記帳、資產），放在雲端的「日日帳本備份」資料夾
   ============================================================ */
const GCB = {}; let gcbN = 0;
window.__gtok = (id, r) => { const f = GCB[id]; if (f) { delete GCB[id]; f(r || {}); } };
function gToken() {
  if (!(IS_APP && NB.gToken)) return Promise.reject(new Error('Google 雲端備份要在 Android App 裡使用'));
  return new Promise((ok, no) => { const id = 'g' + (++gcbN); GCB[id] = r => { if (r.email) { S.gd = Object.assign(S.gd || {}, {email: r.email}); saveS(); } r.token ? ok(r.token) : no(new Error(r.err || '無法取得授權')); }; NB.gToken(id); setTimeout(() => { if (GCB[id]) { delete GCB[id]; no(new Error('登入逾時，請再試一次')); } }, 120000); });
}
async function gFetch(url, opt = {}, retry) {
  const t = await gToken(); const r = await fetch(url, Object.assign({}, opt, {headers: Object.assign({}, opt.headers || {}, {Authorization: 'Bearer ' + t})}));
  if (r.status === 401 && !retry) { try { NB.gDrop(t); } catch (e) {} return gFetch(url, opt, true); }
  if (!r.ok) { let m = r.status + ''; try { const j = await r.json(); m = (j.error && (j.error.message || j.error)) || m; } catch (e) {} throw new Error('Google 雲端：' + m); } return r;
}
const GFOLDER = '日日帳本備份';
async function gFolder() {
  const q = encodeURIComponent(`name='${GFOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`)).json(); if (j.files && j.files.length) return j.files[0].id;
  const c = await (await gFetch('https://www.googleapis.com/drive/v3/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: GFOLDER, mimeType: 'application/vnd.google-apps.folder'})})).json(); return c.id;
}
async function gUpload(blob, name) {
  const fid = await gFolder();
  const r = await gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {method: 'POST', headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json', 'X-Upload-Content-Length': String(blob.size)}, body: JSON.stringify({name, parents: [fid], mimeType: 'application/json'})});
  const loc = r.headers.get('Location'); if (!loc) throw new Error('Google 雲端沒有回傳上傳位址');
  const t = await gToken(), up = await fetch(loc, {method: 'PUT', headers: {Authorization: 'Bearer ' + t, 'Content-Type': 'application/json'}, body: blob}); if (!up.ok) throw new Error('上傳失敗（' + up.status + '）');
  /* 只保留最近 10 份 */
  try { const L = await gList(fid); for (const f of L.slice(10)) await gFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {method: 'DELETE'}); } catch (e) {}
}
async function gList(fid) { fid = fid || await gFolder(); const q = encodeURIComponent(`'${fid}' in parents and trashed=false`); const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)&pageSize=50`)).json(); return (j.files || []).map(f => ({id: f.id, name: f.name, size: +f.size || 0, t: Date.parse(f.createdTime)})); }
async function gGet(f) { return (await gFetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).blob(); }

/* ---------- pCloud ---------- */
async function pApi(method, params, body) {
  const pc = S.pc || {}, host = params.host || pc.host || 'api.pcloud.com'; delete params.host;
  const q = new URLSearchParams(Object.assign({}, pc.auth && !params.username ? {auth: pc.auth} : {}, params));
  const r = await fetch(`https://${host}/${method}?${q}`, body ? {method: 'POST', body} : {}); const j = await r.json();
  if (j.result !== 0) { if (j.result === 1000 || j.result === 2000 || j.result === 2094) { S.pc = {}; saveS(); } throw new Error('pCloud：' + (j.error || '錯誤 ' + j.result)); } return j;
}
function pLogin() {
  return new Promise(res => { let done = false; const sh = sheet({title: '☁️ 登入 pCloud', onClose() { if (!done) res(false); }, foot: '<button class="btn pri" data-a="ok">登入</button>'});
    let host = 'api.pcloud.com';
    sh.body.innerHTML = `<div class="field"><label>pCloud 帳號（Email）</label><input id="pcE" type="email" autocomplete="username" value="${esc((S.pc || {}).email || '')}"></div><div class="field"><label>密碼</label><input id="pcP" type="password" autocomplete="current-password"></div>
      <div class="lbl">帳號所在的資料中心</div><div class="dkSeg"><button data-h="api.pcloud.com" class="on">美國</button><button data-h="eapi.pcloud.com">歐洲</button></div>
      <div class="small muted" style="margin-top:.7rem">密碼只用來向 pCloud 取得登入權杖，不會儲存。如果帳號有開兩步驟驗證，請先在 pCloud 網站暫時關閉，或改用 Google 雲端。不確定資料中心的話，先選美國，登入失敗再換歐洲。</div>`;
    sh.body.onclick = e => { const t = e.target.closest('[data-h]'); if (!t) return; buzz(8); host = t.dataset.h; $$('[data-h]', sh.body).forEach(b => b.classList.toggle('on', b === t)); };
    sh.foot.onclick = async () => { const em = $('#pcE', sh.body).value.trim(), pw = $('#pcP', sh.body).value; if (!em || !pw) { toast('請輸入帳號和密碼'); return; } busy('登入 pCloud…');
      try { const j = await pApi('userinfo', {host, getauth: 1, logout: 1, username: em, password: pw, device: '日日帳本 App'}); S.pc = {auth: j.auth, host, email: j.email || em}; saveS(); busy(false); toast('✅ 已登入 pCloud'); done = true; sh.close(); res(true); }
      catch (err) { busy(false); toast(err.message + (/2321|location/i.test(err.message) ? '（請換另一個資料中心）' : ''), 5000); } }; });
}
async function pFolder() { const j = await pApi('createfolderifnotexists', {path: '/' + GFOLDER}); return j.metadata.folderid; }
async function pUpload(blob, name) {
  const fid = await pFolder(), fd = new FormData(); fd.append('file', blob, name); await pApi('uploadfile', {folderid: fid, filename: name, nopartial: 1}, fd);
  try { const L = await pList(fid); for (const f of L.slice(10)) await pApi('deletefile', {fileid: f.id}); } catch (e) {}
}
async function pList(fid) { fid = fid || await pFolder(); const j = await pApi('listfolder', {folderid: fid}); return (j.metadata.contents || []).filter(f => !f.isfolder && /\.json$/i.test(f.name)).map(f => ({id: f.fileid, name: f.name, size: f.size, t: Date.parse(f.created)})).sort((a, b) => b.t - a.t); }
async function pGet(f) { const j = await pApi('getfilelink', {fileid: f.id}); const r = await fetch('https://' + j.hosts[0] + j.path); if (!r.ok) throw new Error('下載失敗（' + r.status + '）'); return r.blob(); }

/* ---------- 共用：上傳／還原 ---------- */
function gUnregHelp(msg) {
  let gi = {}; try { gi = JSON.parse(NB.gInfo()); } catch (e) {}
  sheet({title: '☁️ 第一次使用 Google 雲端備份', full: true, html: `<p>Google 需要先登記這個 App 才允許它存取雲端硬碟（跟旅行日記一樣，只要設定一次）：</p>
    <ol class="invSteps"><li>打開 <b>Google Cloud Console</b>（console.cloud.google.com），用旅行日記那個專案即可</li><li>「API 和服務 → 程式庫」確認 <b>Google Drive API</b> 已啟用</li><li>「API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID」，類型選 <b>Android</b></li>
    <li>套件名稱填：<br><span class="sel">${esc(gi.pkg || 'com.ian.foodmap')}</span></li><li>SHA-1 憑證指紋填：<br><span class="sel" style="word-break:break-all">${esc(gi.sha1 || '')}</span></li><li>建立後回到這裡，再按一次「上傳備份」</li></ol>
    <div class="small muted">Google 回覆：${esc(msg || '')}</div>`});
}
async function cloudUp(kind) {
  try { if (kind === 'p' && !(S.pc || {}).auth && !await pLogin()) return;
    busy('打包資料和圖片…'); const blob = await makeBackupBlob(), name = backupName(); busy(`上傳到 ${kind === 'g' ? 'Google 雲端' : 'pCloud'}…（${(blob.size / 1048576).toFixed(1)} MB）`);
    if (kind === 'g') await gUpload(blob, name); else await pUpload(blob, name);
    const k = kind === 'g' ? 'gd' : 'pc'; S[k] = Object.assign(S[k] || {}, {last: Date.now()}); saveS(); busy(false); buzz(40); toast(`✅ 已備份到 ${kind === 'g' ? 'Google 雲端' : 'pCloud'}：${name}`, 4500); if (curTab === 'AccC') renderAccCfg();
  } catch (e) { busy(false); if (/UNREG|unregistered|invalid_?audience|invalid_?client/i.test(e.message)) gUnregHelp(e.message); else toast('❌ ' + e.message, 5000); }
}
async function cloudDown(kind) {
  try { if (kind === 'p' && !(S.pc || {}).auth && !await pLogin()) return;
    busy('讀取雲端的備份…'); const L = kind === 'g' ? await gList() : await pList(); busy(false);
    if (!L.length) { toast('雲端還沒有備份'); return; }
    const f = await new Promise(res => { let done = false; const sh = sheet({title: '選擇要還原的備份', onClose() { if (!done) res(null); }, html: `<div class="actList">${L.map((x, i) => `<button data-i="${i}">📦 ${esc(x.name.replace(/\.json$/, ''))}<small style="display:block;color:var(--muted)">${new Date(x.t).toLocaleString('zh-TW')}・${(x.size / 1048576).toFixed(1)} MB</small></button>`).join('')}</div>`});
      sh.body.onclick = e => { const t = e.target.closest('[data-i]'); if (!t) return; buzz(10); done = true; sh.close(); res(L[+t.dataset.i]); }; });
    if (!f) return; if (!await ask(`用「${f.name}」取代這台手機上的所有資料（收藏、點餐、分帳、發票、記帳、資產、食譜、圖片）？`, '還原', true)) return;
    busy('下載備份…'); const j = JSON.parse(await (kind === 'g' ? await gGet(f) : await pGet(f)).text()); busy('還原中…'); await applyBackup(j); busy(false); toast('✅ 還原完成，重新開啟中…', 2000); setTimeout(() => location.reload(), 900);
  } catch (e) { busy(false); if (/UNREG|unregistered|invalid_?audience|invalid_?client/i.test(e.message)) gUnregHelp(e.message); else toast('❌ ' + e.message, 5000); }
}
