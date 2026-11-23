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
const GFOLDER = '日日帳本備份', gFolderName = () => (S.gd || {}).folder || GFOLDER;
/* Google 雲端資料夾：Google 只讓 App 看到它自己建立的資料夾，所以可以選以前建立的，或建立一個新名字的資料夾 */
async function gPickFolder() {
  try { busy('讀取 Google 雲端…'); const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false`); const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`)).json(); busy(false);
    const L = j.files || [], sh = sheet({title: '📁 Google 雲端資料夾', html: `<div class="small muted" style="margin:-.2rem 0 .6rem">Google 只允許 App 看到它自己建立的資料夾。建立後會出現在你的雲端硬碟「我的雲端硬碟」裡，可以自己搬到別的資料夾，App 仍然找得到。</div><div class="actList">${L.map(f => `<button data-id="${f.id}" data-n="${esc(f.name)}">📁 ${esc(f.name)}${(S.gd || {}).folderId === f.id ? '　✓' : ''}</button>`).join('')}<button data-a="mk">＋ 建立新資料夾</button></div>`});
    sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(10);
      if (t.dataset.id) { S.gd = Object.assign(S.gd || {}, {folder: t.dataset.n, folderId: t.dataset.id}); saveS(); sh.close(); toast('✅ 之後會備份到「' + t.dataset.n + '」'); if (curTab === 'AccC') renderAccCfg(); return; }
      const n = ((await askText('新資料夾名稱', '日日帳本備份')) || '').trim(); if (!n) return; busy('建立資料夾…');
      try { const c = await (await gFetch('https://www.googleapis.com/drive/v3/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: n, mimeType: 'application/vnd.google-apps.folder'})})).json(); S.gd = Object.assign(S.gd || {}, {folder: n, folderId: c.id}); saveS(); busy(false); sh.close(); toast('✅ 已建立並選擇「' + n + '」'); if (curTab === 'AccC') renderAccCfg(); } catch (er) { busy(false); cloudErr('g', er); } };
  } catch (e) { busy(false); cloudErr('g', e); }
}
async function gFolder() {
  if ((S.gd || {}).folderId) return S.gd.folderId;
  const q = encodeURIComponent(`name='${gFolderName()}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`)).json(); if (j.files && j.files.length) return j.files[0].id;
  const c = await (await gFetch('https://www.googleapis.com/drive/v3/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: gFolderName(), mimeType: 'application/vnd.google-apps.folder'})})).json(); return c.id;
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
const HCB = {}; let hcbN = 0; window.__http = (id, r) => { const f = HCB[id]; if (f) { delete HCB[id]; f(r || {}); } };
function nativeHttp(method, url, ctype, b64) { return new Promise((ok, no) => { const id = 'h' + (++hcbN); HCB[id] = r => r.err ? no(new Error(r.err)) : ok(r); NB.http(id, method, url, ctype || '', b64 || ''); setTimeout(() => { if (HCB[id]) { delete HCB[id]; no(new Error('連線逾時')); } }, 300000); }); }
/* 先用一般 fetch；被跨網域擋下時（App 裡）改用原生連線 */
async function xfetchJson(url, body) {
  try { const r = await fetch(url, body ? {method: 'POST', body} : {}); return await r.json(); }
  catch (e) { if (!(IS_APP && NB.http)) throw e;
    if (!body) { const r = await nativeHttp('GET', url); return JSON.parse(r.text); }
    const bd = '----rizhang' + Date.now(), parts = []; for (const [k, v] of body.entries()) { parts.push(`--${bd}\r\nContent-Disposition: form-data; name="${k}"${v instanceof Blob ? `; filename="${v.name || 'file'}"\r\nContent-Type: ${v.type || 'application/octet-stream'}` : ''}\r\n\r\n`, v, '\r\n'); } parts.push(`--${bd}--\r\n`);
    const r = await nativeHttp('POST', url, 'multipart/form-data; boundary=' + bd, await blobB64(new Blob(parts))); return JSON.parse(r.text); }
}
async function xfetchBlob(url) { try { const r = await fetch(url); if (!r.ok) throw new Error('下載失敗（' + r.status + '）'); return await r.blob(); } catch (e) { if (!(IS_APP && NB.http)) throw e; const r = await nativeHttp('GET', url); return new Blob([r.text], {type: 'application/json'}); } }
async function pApi(method, params, body) {
  const pc = S.pc || {}, host = params.host || pc.host || 'api.pcloud.com'; delete params.host;
  delete params._re; const q = new URLSearchParams(Object.assign({}, pc.auth && !params.username && !params.token ? {auth: pc.auth} : {}, params));
  const j = await xfetchJson(`https://${host}/${method}?${q}`, body);
  if (j.result !== 0) {
    /* 登入過期：有記住密碼就自動重新登入一次 */
    if ((j.result === 1000 || j.result === 2000 || j.result === 2094) && pc.auth && !params.username && !params._re) { if (pc.pw && await pAutoLogin()) return pApi(method, Object.assign({}, params, {_re: 1}), body); S.pc = Object.assign({}, pc, {auth: ''}); saveS(); }
    const e = new Error('pCloud：' + (j.error || '錯誤 ' + j.result)); e.code = j.result; e.data = j; throw e; }
  return j;
}
/* 帳號、密碼記在這支手機上（不會放進雲端備份），登入過期時自動重新登入；兩步驟驗證會跳出輸入驗證碼 */
const pwEnc = p => btoa(unescape(encodeURIComponent(p))), pwDec = p => { try { return decodeURIComponent(escape(atob(p))); } catch (e) { return ''; } };
async function pAutoLogin() { const pc = S.pc || {}; if (!pc.email || !pc.pw) return false; try { const auth = await pDoLogin(pc.host, pc.email, pwDec(pc.pw), false); S.pc = Object.assign({}, pc, {auth}); saveS(); return true; } catch (e) { return false; } }
async function pDoLogin(host, em, pw, interactive) {
  try { const j = await pApi('userinfo', {host, getauth: 1, logout: 1, username: em, password: pw, device: '日日帳本 App'}); return j.auth; }
  catch (e) {
    if (e.code === 2297 || /two.?factor|tfa|2fa|驗證碼|code/i.test(e.message)) {   /* 需要兩步驟驗證 */
      const tok = e.data && e.data.token; if (!tok) throw new Error('這個帳號開了兩步驟驗證，但 pCloud 沒有回傳驗證用的代碼，請稍後再試');
      if (!interactive) throw e;
      const code = ((await askText('pCloud 兩步驟驗證：請輸入驗證器 App 或簡訊收到的 6 位數驗證碼', '', '例如 123456')) || '').replace(/\s/g, ''); if (!code) throw new Error('沒有輸入驗證碼');
      const j = await pApi('tfa_login', {host, token: tok, code, trustdevice: 1, device: '日日帳本 App'}); return j.auth;
    }
    throw e; }
}
function pLoginForm() {
  return new Promise(res => { let done = false; const sh = sheet({title: '☁️ 登入 pCloud', onClose() { if (!done) res(false); }, foot: '<button class="btn pri" data-a="ok">登入</button>'});
    const pc = S.pc || {}; let host = pc.host || 'api.pcloud.com', keep = pc.keep !== false;
    sh.body.innerHTML = `<div class="field"><label>pCloud 帳號（Email）</label><input id="pcE" type="email" autocomplete="username" value="${esc(pc.email || '')}"></div><div class="field"><label>密碼</label><input id="pcP" type="password" autocomplete="current-password" value="${pc.pw ? esc(pwDec(pc.pw)) : ''}"></div>
      <button class="ckRow ${keep ? 'on' : ''}" data-a="keep"><span class="acCk"></span>記住帳號密碼（只存在這支手機，登入過期時自動重新登入）</button>
      <div class="lbl">帳號所在的資料中心</div><div class="dkSeg" style="grid-template-columns:1fr 1fr"><button data-h="api.pcloud.com" class="${host === 'api.pcloud.com' ? 'on' : ''}">美國</button><button data-h="eapi.pcloud.com" class="${host !== 'api.pcloud.com' ? 'on' : ''}">歐洲</button></div>
      <div class="small muted" style="margin-top:.7rem">有開兩步驟驗證的帳號，按登入後會請你輸入驗證碼，並把這支手機設為信任裝置，之後不用再輸入。不確定資料中心的話，先選美國，登入失敗再換歐洲。</div>`;
    sh.body.onclick = e => { const t = e.target.closest('button'); if (!t) return; buzz(8); if (t.dataset.h) { host = t.dataset.h; $$('[data-h]', sh.body).forEach(b => b.classList.toggle('on', b === t)); } else if (t.dataset.a === 'keep') { keep = !keep; t.classList.toggle('on', keep); } };
    sh.foot.onclick = async () => { const em = $('#pcE', sh.body).value.trim(), pw = $('#pcP', sh.body).value; if (!em || !pw) { toast('請輸入帳號和密碼'); return; } busy('登入 pCloud…');
      try { busy(false); const auth = await pDoLogin(host, em, pw, true); S.pc = {auth, host, email: em, keep, pw: keep ? pwEnc(pw) : ''}; saveS(); toast('✅ 已登入 pCloud'); done = true; sh.close(); res(true); if (curTab === 'AccC') renderAccCfg(); }
      catch (err) { busy(false); toast(err.message + (/2321|location|資料中心/i.test(err.message) || err.code === 2321 ? '（請換另一個資料中心）' : ''), 5000); } }; });
}
/* pCloud 登入：優先用 App 內的 pCloud 官網登入（可以用 Google 登入、兩步驟驗證、彈出視窗都不擋），也可以改用帳號密碼 */
function pLogin() {
  if (!(IS_APP && NB.pcWeb)) return pLoginForm();
  return new Promise(res => { let done = false; const sh = sheet({title: '☁️ 登入 pCloud', onClose() { if (!done) res(false); }, html: `<div class="actList"><button data-a="web">🌐 用 pCloud 網頁登入（推薦）<small style="display:block;color:var(--muted)">跟在瀏覽器登入一樣，可以用 Google／Apple 帳號、兩步驟驗證，並讓瀏覽器記住密碼</small></button><button data-a="pw">🔑 輸入帳號密碼登入</button></div>`});
    sh.body.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(10); done = true; sh.close(); res(t.dataset.a === 'web' ? await pWebLogin() : await pLoginForm()); }; });
}
function pWebLogin() {
  return new Promise(res => { const tried = new Set(); let ok = false;
    window.__pcWeb = async r => { if (ok) return; if (r.cancel) { res(false); return; }
      for (const c of r.cands || []) { if (tried.has(c)) continue; tried.add(c);
        for (const host of ['api.pcloud.com', 'eapi.pcloud.com']) { try { const j = await pApi('userinfo', {host, auth: c}); if (ok) return; ok = true; S.pc = Object.assign({}, S.pc || {}, {auth: c, host, email: j.email || '', web: 1}); saveS(); NB.pcWebClose(); buzz(40); toast('✅ 已登入 pCloud：' + (j.email || '')); res(true); if (curTab === 'AccC') renderAccCfg(); return; } catch (e) {} } } };
    NB.pcWeb(); });
}
/* 選雲端資料夾 */
async function pPickFolder() {
  if (!(S.pc || {}).auth && !await pLogin()) return; let stack = [{id: 0, name: 'pCloud'}];
  const sh = sheet({title: '📁 選擇 pCloud 資料夾', full: true, foot: '<button class="btn" data-a="mk">＋ 新資料夾</button><button class="btn pri" data-a="use">選這個資料夾</button>'});
  const draw = async () => { const cur = stack[stack.length - 1]; sh.body.innerHTML = '<div class="empty"><span class="spin"></span> 讀取中…</div>';
    try { const j = await pApi('listfolder', {folderid: cur.id, nofiles: 1}); const L = (j.metadata.contents || []).filter(f => f.isfolder).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
      sh.body.innerHTML = `<div class="fpPath">${stack.map((x, i) => `<button data-up="${i}">${esc(x.name)}</button>`).join('<span>›</span>')}</div><div class="fpL">${L.map(f => `<button class="fpR" data-id="${f.folderid}" data-n="${esc(f.name)}">📁 <span>${esc(f.name)}</span><i>›</i></button>`).join('') || '<div class="empty">這裡沒有子資料夾</div>'}</div>`;
    } catch (e) { sh.body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; } };
  draw();
  sh.body.onclick = e => { const t = e.target.closest('button'); if (!t) return; buzz(8); if (t.dataset.up != null) { stack = stack.slice(0, +t.dataset.up + 1); draw(); } else if (t.dataset.id) { stack.push({id: +t.dataset.id, name: t.dataset.n}); draw(); } };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const cur = stack[stack.length - 1];
    if (b.dataset.a === 'mk') { const n = ((await askText('新資料夾名稱', '日日帳本備份')) || '').trim(); if (!n) return; try { const j = await pApi('createfolderifnotexists', {folderid: cur.id, name: n}); stack.push({id: j.metadata.folderid, name: n}); draw(); } catch (er) { toast(er.message); } return; }
    S.pc = Object.assign(S.pc || {}, {folder: {id: cur.id, path: '/' + stack.slice(1).map(x => x.name).join('/')}}); saveS(); sh.close(); toast('✅ 之後會備份到 ' + S.pc.folder.path); if (curTab === 'AccC') renderAccCfg(); };
}
async function pFolder() { const f = (S.pc || {}).folder; if (f && f.id != null) return f.id; const j = await pApi('createfolderifnotexists', {path: '/' + GFOLDER}); return j.metadata.folderid; }
async function pUpload(blob, name) {
  const fid = await pFolder(), fd = new FormData(); fd.append('file', blob, name); await pApi('uploadfile', {folderid: fid, filename: name, nopartial: 1}, fd);
  try { const L = await pList(fid); for (const f of L.slice(10)) await pApi('deletefile', {fileid: f.id}); } catch (e) {}
}
async function pList(fid) { fid = fid || await pFolder(); const j = await pApi('listfolder', {folderid: fid}); return (j.metadata.contents || []).filter(f => !f.isfolder && /\.json$/i.test(f.name)).map(f => ({id: f.fileid, name: f.name, size: f.size, t: Date.parse(f.created)})).sort((a, b) => b.t - a.t); }
async function pGet(f) { const j = await pApi('getfilelink', {fileid: f.id}); return xfetchBlob('https://' + j.hosts[0] + j.path); }

/* ---------- 共用：上傳／還原 ---------- */
function gUnregHelp(msg) {
  let gi = {}; try { gi = JSON.parse(NB.gInfo()); } catch (e) {}
  sheet({title: '☁️ Google 雲端還不能用', full: true, html: `<p>Google 拒絕了這次登入。最常見的原因是這個 App 還沒在 Google Cloud 登記（旅行日記登記的是旅行日記自己，日日帳本要另外登記一次）：</p>
    <ol class="invSteps"><li>打開 <b>Google Cloud Console</b>（console.cloud.google.com），用旅行日記那個專案即可</li><li>「API 和服務 → 程式庫」確認 <b>Google Drive API</b> 已啟用</li><li>「API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID」，類型選 <b>Android</b></li>
    <li>套件名稱填：<br><span class="sel">${esc(gi.pkg || 'com.ian.foodmap')}</span></li><li>SHA-1 憑證指紋填：<br><span class="sel" style="word-break:break-all">${esc(gi.sha1 || '')}</span></li><li>如果 OAuth 同意畫面是「測試」狀態，記得把你的 Gmail 加到「測試使用者」</li><li>建立後等 5 分鐘左右，回到這裡再按一次「上傳備份」</li></ol>
    <div class="small muted">Google 回覆：${esc(msg || '')}</div>`});
}
function cloudErr(kind, e) {
  const m = String(e && e.message || e); if (/已取消/.test(m)) { toast('已取消'); return; }
  /* Google 登入失敗（例如回覆 ERROR、UNREGISTERED）幾乎都是還沒在 Google Cloud 登記這個 App */
  if (kind === 'g' && (/GERR:|UNREG|unregistered|invalid_?audience|invalid_?client|^ERROR$|授權/i.test(m))) { gUnregHelp(m.replace(/^GERR:/, '')); return; }
  toast('❌ ' + m, 5000);
}
async function cloudUp(kind) {
  try { if (kind === 'p' && !(S.pc || {}).auth && !await pLogin()) return;
    busy('打包資料和圖片…'); const blob = await makeBackupBlob(), name = backupName(); busy(`上傳到 ${kind === 'g' ? 'Google 雲端' : 'pCloud'}…（${(blob.size / 1048576).toFixed(1)} MB）`);
    if (kind === 'g') await gUpload(blob, name); else await pUpload(blob, name);
    const k = kind === 'g' ? 'gd' : 'pc'; S[k] = Object.assign(S[k] || {}, {last: Date.now()}); saveS(); busy(false); buzz(40); toast(`✅ 已備份到 ${kind === 'g' ? 'Google 雲端' : 'pCloud'}：${name}`, 4500); if (curTab === 'AccC') renderAccCfg();
  } catch (e) { busy(false); cloudErr(kind, e); }
}
async function cloudDown(kind) {
  try { if (kind === 'p' && !(S.pc || {}).auth && !await pLogin()) return;
    busy('讀取雲端的備份…'); const L = kind === 'g' ? await gList() : await pList(); busy(false);
    if (!L.length) { toast('雲端還沒有備份'); return; }
    const f = await new Promise(res => { let done = false; const sh = sheet({title: '選擇要還原的備份', onClose() { if (!done) res(null); }, html: `<div class="actList">${L.map((x, i) => `<button data-i="${i}">📦 ${esc(x.name.replace(/\.json$/, ''))}<small style="display:block;color:var(--muted)">${new Date(x.t).toLocaleString('zh-TW')}・${(x.size / 1048576).toFixed(1)} MB</small></button>`).join('')}</div>`});
      sh.body.onclick = e => { const t = e.target.closest('[data-i]'); if (!t) return; buzz(10); done = true; sh.close(); res(L[+t.dataset.i]); }; });
    if (!f) return; if (!await ask(`用「${f.name}」取代這台手機上的所有資料（收藏、點餐、分帳、發票、記帳、資產、食譜、圖片）？`, '還原', true)) return;
    busy('下載備份…'); const j = JSON.parse(await (kind === 'g' ? await gGet(f) : await pGet(f)).text()); busy('還原中…'); await applyBackup(j); busy(false); toast('✅ 還原完成，重新開啟中…', 2000); setTimeout(() => location.reload(), 900);
  } catch (e) { busy(false); cloudErr(kind, e); }
}

/* ---------- 手機內建儲存：完整備份／還原 ---------- */
function localBackup() { exportBackup(); }
function localRestore() { importBackup(); }

/* ---------- 快速換機：同一個 Wi-Fi，舊手機顯示 QR Code，新手機掃描後直接把整個日日帳本（含圖片）傳過去 ---------- */
async function xferSend() {
  if (!(IS_APP && NB.xferStart)) { toast('快速換機要在 Android App 裡使用'); return; }
  try { busy('打包資料和圖片…'); const blob = await makeBackupBlob(); const CH = 768 * 1024; let off = 0, first = true;
    while (off < blob.size) { busy(`準備傳送…${Math.round(off / blob.size * 100)}%`); const b64 = await blobB64(blob.slice(off, off + CH)); if (!NB.tmpWrite('xfer_out.json', b64, !first)) throw new Error('寫入暫存檔失敗'); first = false; off += CH; }
    const info = JSON.parse(NB.xferStart()); busy(false); if (info.err || !info.ip) throw new Error(info.err || '找不到這支手機的 Wi-Fi 位址，請先連上 Wi-Fi');
    const url = `http://${info.ip}:${info.port}/${info.tok}`, qr = qrcode(0, 'M'); qr.addData('RIZHANG:' + url); qr.make();
    const sh = sheet({title: '📲 快速換機：在新手機掃描', full: true, onClose() { NB.xferStop(); window.__xferSent = null; }, html: `<div class="xfQR">${qr.createSvgTag({cellSize: 6, margin: 2, scalable: true})}</div>
      <ol class="invSteps"><li>兩支手機連同一個 Wi-Fi（或新手機連舊手機的熱點）</li><li>新手機打開日日帳本 → 記帳 → 設定 →「📷 掃描 QR Code 接收」</li><li>掃描上面的 QR Code，傳完會自動還原，<b>這個畫面請先不要關閉</b></li></ol>
      <div class="small muted">要傳的資料：${(blob.size / 1048576).toFixed(1)} MB（收藏、點餐、分帳、發票、記帳、資產、食譜、設定和所有圖片）</div><div class="xfSt" id="xfSt">等待新手機連線…</div>`});
    window.__xferSent = () => { buzz(60); const st = $('#xfSt', sh.body); if (st) st.innerHTML = '✅ 已經傳送完成！新手機會自動還原。'; };
  } catch (e) { busy(false); toast('❌ ' + e.message, 5000); }
}
function qrScanOnce(title, test) {
  return new Promise(res => { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('這台手機不支援相機掃描'); res(null); return; }
    let stream = null, stop = false, done = false; const sh = sheet({title, full: true, onClose() { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); if (!done) res(null); }});
    sh.body.innerHTML = `<div class="scanBox"><video id="qsV" playsinline muted></video><div class="scFrame"><i></i><i></i></div><div class="scTip" id="qsT">把 QR Code 放進框裡</div></div>`;
    const v = $('#qsV', sh.body), cv = document.createElement('canvas'), g = cv.getContext('2d', {willReadFrequently: true});
    const tick = () => { if (stop) return; if (v.readyState >= 2 && v.videoWidth) { const sc = Math.min(1, 800 / v.videoWidth); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc); g.drawImage(v, 0, 0, cv.width, cv.height);
        try { const c = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height); if (c && c.data && (!test || test(c.data))) { done = true; buzz(60); sh.close(); res(c.data); return; } } catch (e) {} } requestAnimationFrame(tick); };
    navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false}).then(s2 => { stream = s2; if (stop) { s2.getTracks().forEach(t => t.stop()); return; } v.srcObject = s2; v.play().catch(() => {}); tick(); })
      .catch(er => { $('#qsT', sh.body).textContent = '❌ 打不開相機：' + (er.name === 'NotAllowedError' ? '請允許日日帳本使用相機' : er.message); }); });
}
async function xferRecv() {
  if (!(IS_APP && NB.xferGet)) { toast('快速換機要在 Android App 裡使用'); return; }
  const txt = await qrScanOnce('📷 掃描舊手機上的換機 QR Code', t => /^RIZHANG:http/.test(t)); if (!txt) return;
  const url = txt.replace(/^RIZHANG:/, ''); busy('從舊手機接收資料…');
  const r = await new Promise(ok => { const id = 'x' + Date.now(); window.__xferGot = (i, v) => { if (i === id) ok(v); }; NB.xferGet(id, url); });
  if (r.err) { busy(false); toast('❌ 連不到舊手機：' + r.err + '（請確認兩支手機在同一個 Wi-Fi）', 6000); return; }
  try { const CH = 768 * 1024, parts = []; for (let off = 0; off < r.size; off += CH) { busy(`讀取資料…${Math.round(off / r.size * 100)}%`); const b = atob(NB.tmpRead('xfer_in.json', off, CH)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); parts.push(u); }
    const j = JSON.parse(await new Blob(parts).text()); busy(false);
    if (!await ask(`收到 ${(r.size / 1048576).toFixed(1)} MB 的資料（${j.places.length} 間收藏${j.acc ? '、' + (j.acc.recs || []).length + ' 筆記帳' : ''}）。用它取代這支手機上的資料嗎？`, '還原', true)) return;
    busy('還原中…'); await applyBackup(j); busy(false); toast('✅ 換機完成，重新開啟中…', 2000); setTimeout(() => location.reload(), 900);
  } catch (e) { busy(false); toast('❌ ' + e.message, 5000); }
}
