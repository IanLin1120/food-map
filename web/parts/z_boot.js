/* ---------- 啟動 ---------- */
(async function main() {
  try { const t = JSON.parse(localStorage.getItem('fm.theme') || 'null'); if (t) Object.assign(S, t); } catch (e) {}
  applyTheme();
  try { localStorage.removeItem('fm.otaFail'); } catch (e) {}
  try { await loadAll(); } catch (e) { console.error(e); }
  try { await loadAcc(); } catch (e) { console.error(e); }
  applyTheme(); modeUI(); initViewer(); initChips(); initSearch(); initCard(); initFav(); initRec(); initMeal(); initShop(); initInv(); initAcc(); initSet();
  $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { buzz(8); showTab(b.dataset.tab); } });
  $('#fb3d').onclick = () => { if (!M.map) return; const to3 = M.map.getPitch() <= 5; S.map3d = to3; saveS(); buzz(10); M.map.easeTo({pitch: to3 ? 55 : 0, duration: 500}); };
  $('#fbZin').onclick = () => { buzz(10); if (M.map) M.map.zoomIn({duration: 250}); }; $('#fbZout').onclick = () => { buzz(10); if (M.map) M.map.zoomOut({duration: 250}); };
  $('#fbN').onclick = () => { if (M.map) M.map.easeTo({bearing: 0, duration: 400}); };
  $('#fbMe').onclick = () => { S.locOn = true; saveS(); locateMe(); }; $('#fbAdd').onclick = openAdd;
  window.addEventListener('resize', mapResize);
  Area.init(); renderChips(); updCounts();
  await initMap();
  if (S.inAcc) { if (AccLock.open()) showTab('Acc'); else { showTab('Acc'); } }
  AccLock.paint();
  if (!S.onboard) welcome();
  Upd.boot();
  Share.check(); document.addEventListener('visibilitychange', () => { if (!document.hidden) { setTimeout(() => Share.check(), 300); setTimeout(() => Quick.check(), 200); } });
  setTimeout(() => { Quick.check(); accWidgetPush(); }, 400);
  window.__ready = true;
})();

/* 下拉選單：不用系統那個白底的原生選單，改成跟 App 一樣風格的底部清單；按鈕一樣大、對齊，文字不會跑出去 */
(() => {
  let last = 0;
  const label = sel => { const r = sel.closest('.setR,.field,label'); const t = sel.getAttribute('aria-label') || (r && (r.querySelector('b,label') || {}).textContent) || (sel.options[0] && sel.options[0].disabled ? sel.options[0].textContent : '') || '請選擇'; return String(t).trim().slice(0, 24); };
  function pick(sel) { if (Date.now() - last < 400) return; last = Date.now(); buzz(8);
    const groups = []; [...sel.children].forEach(c => { if (c.tagName === 'OPTGROUP') groups.push({g: c.label, L: [...c.children]}); else { const g = groups[groups.length - 1]; if (g && g.g == null) g.L.push(c); else groups.push({g: null, L: [c]}); } });
    const all = [...sel.options].filter(o => !o.hidden), mx = Math.max(...all.map(o => [...o.textContent.trim()].length)), cols = mx <= 5 ? 3 : mx <= 9 ? 2 : 1;
    const sh = sheet({title: label(sel)}), cur = sel.value;
    sh.body.innerHTML = groups.map(g => `${g.g ? `<div class="spkG">${esc(g.g)}</div>` : ''}<div class="spk c${cols}">${g.L.filter(o => !o.hidden).map(o => `<button data-v="${esc(o.value)}" class="${o.value === cur ? 'on' : ''}" ${o.disabled ? 'disabled' : ''}>${o.value === cur ? '<i>✓</i>' : ''}<span>${esc(o.textContent.trim())}</span></button>`).join('')}</div>`).join('');
    requestAnimationFrame(() => { const on = $('.spk .on', sh.body); if (on) on.scrollIntoView({block: 'center'}); });
    sh.body.onclick = e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; buzz(10); sh.close(); if (sel.value !== b.dataset.v) { sel.value = b.dataset.v; sel.dispatchEvent(new Event('input', {bubbles: true})); sel.dispatchEvent(new Event('change', {bubbles: true})); } }; }
  const skip = s => !s || s.multiple || s.disabled || s.dataset.native != null;
  document.addEventListener('pointerdown', e => { const s = e.target.closest && e.target.closest('select'); if (skip(s)) return; e.preventDefault(); }, true);
  document.addEventListener('mousedown', e => { const s = e.target.closest && e.target.closest('select'); if (skip(s)) return; e.preventDefault(); }, true);
  document.addEventListener('click', e => { const s = e.target.closest && e.target.closest('select'); if (skip(s)) return; e.preventDefault(); s.blur(); pick(s); }, true);
  document.addEventListener('keydown', e => { const s = e.target; if (s && s.tagName === 'SELECT' && !skip(s) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(s); } }, true);
})();

/* 長名稱一行放不下時，自動把字縮小到剛好放得下（最小 8px），不換行、不裁切 */
(() => { let q = false;
  const fit = () => { q = false; document.querySelectorAll('.acN.lg:not([data-fit])').forEach(e => { if (!e.offsetParent) return; e.dataset.fit = 1; let f = parseFloat(getComputedStyle(e).fontSize) || 13; e.style.fontSize = ''; while (e.scrollWidth > e.clientWidth + 1 && f > 8) { f -= .5; e.style.fontSize = f + 'px'; } }); };
  new MutationObserver(() => { if (!q) { q = true; requestAnimationFrame(() => requestAnimationFrame(fit)); } }).observe(document.body, {childList: true, subtree: true}); })();
