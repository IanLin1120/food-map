/* ---------- 啟動 ---------- */
(async function main() {
  try { const t = JSON.parse(localStorage.getItem('fm.theme') || 'null'); if (t) Object.assign(S, t); } catch (e) {}
  applyTheme();
  try { localStorage.removeItem('fm.otaFail'); } catch (e) {}
  try { await loadAll(); } catch (e) { console.error(e); }
  applyTheme(); modeUI(); initViewer(); initChips(); initSearch(); initCard(); initFav(); initRec(); initMeal(); initShop(); initInv(); initAcc(); initSet();
  $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { buzz(8); showTab(b.dataset.tab); } });
  $('#fb3d').onclick = () => { if (!M.map) return; const to3 = M.map.getPitch() <= 5; S.map3d = to3; saveS(); buzz(10); M.map.easeTo({pitch: to3 ? 55 : 0, duration: 500}); };
  $('#fbN').onclick = () => { if (M.map) M.map.easeTo({bearing: 0, duration: 400}); };
  $('#fbMe').onclick = () => { S.locOn = true; saveS(); locateMe(); }; $('#fbAdd').onclick = openAdd;
  window.addEventListener('resize', mapResize);
  Area.init(); renderChips(); updCounts();
  await initMap();
  if (!S.onboard) welcome();
  Upd.boot();
  Share.check(); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => Share.check(), 300); });
  window.__ready = true;
})();
