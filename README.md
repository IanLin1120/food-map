# 食光地圖（Food Map）

把愛店插上旗子的**美食地圖**＋**我的食譜**。Android APK（WebView 外殼＋單檔網頁介面）＋網頁版，附「版本與更新」系統（做法與 [web-saver](https://github.com/IanLin1120/web-saver) 相同）。

- 網頁版：https://ianlin1120.github.io/food-map/
- 下載頁（固定網址，永遠是最新版 APK）：https://ianlin1120.github.io/food-map/download.html
- 每次 push 到 `main` 並改了 `VERSION` / `web/` / `app/`，GitHub Actions 會自動建置簽章 APK，放進 `apk/`，並更新 `apks.json`、`version.json`、`index.html`（App 內的更新就是讀這幾個檔案）。

## 四個分頁
1. **地圖**：3D 向量地圖（MapLibre＋OpenFreeMap）、Google Places 搜尋、分類旗子、長按插旗收藏；縣市／鄉鎮市區外框與分區清冊；離線地圖（下載 [xingji-roaddata](https://github.com/IanLin1120/xingji-roaddata) Releases 的向量圖磚資料包）。
2. **收藏**：依分類查看所有店家的地址、營業時間、菜單；拖曳排序。
3. **食譜**：一般食譜與「份量比例表」兩種模板，資料夾分類，可從截圖用 AI 匯入。
4. **設定**：主題配色、金鑰（含圖文教學）、導航軟體、備份、**版本與更新**。

## 發新版
1. 改 `VERSION`（例如 1.1.1），寫 `RELEASE_NOTES.txt`。
2. push 到 main → 等 Actions 跑完 → App 內「檢查更新」就會看到。
   - 只改網頁介面（`web/`）而沒有改原生程式：手機收到的是「線上更新」，不用重裝 APK。
   - 改了 `app/`（原生）：請同時把 `version.json` 的 `minApk` 調到新版號（或在 Actions 設環境變數 `MIN_APK`），App 會要求安裝新 APK。

## 一次性設定
1. Settings → Pages → Source: `main` / root。
2. Settings → Secrets and variables → Actions，新增：`KEYSTORE_B64`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD`（簽章金鑰請自己保管，換金鑰會讓舊版無法覆蓋更新）。

## 目錄
- `web/`：網頁介面原始碼（`parts/*.js`、`app.css`、`shell.html`、`ota_boot.js`），`python3 web/build.py` 組合成單檔 `web/dist/index.html`。
- `app/`：Android 外殼（`MainActivity.java`、`Updater.java` App 內更新、`Offline.java` 離線地圖）。
- `tools/build_apk.sh`：不用 Gradle 的本機建置（aapt → javac → dx → zipalign → apksigner）。
- 根目錄的 `index.html`、`version.json`、`apks.json`、`apk/`：GitHub Pages 發布內容，由 Actions 自動更新。
