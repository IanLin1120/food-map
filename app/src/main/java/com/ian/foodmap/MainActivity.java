package com.ian.foodmap;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/** 食光地圖：把 assets/index.html 以 https://app.local/ 載入 WebView，並提供少量原生功能（震動、導航、選圖／拍照、定位、存檔）。 */
public class MainActivity extends Activity {
    static final String HOST = "app.local";
    static final int REQ_FILE = 11, REQ_GEO = 12;
    static MainActivity cur;
    WebView web;
    ValueCallback<Uri[]> fileCb;
    Uri camUri;
    GeolocationPermissions.Callback geoCb;
    String geoOrigin;
    OutputStream saveOut;
    Uri saveUri;
    String saveName;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        cur = this;
        getWindow().setStatusBarColor(Color.parseColor("#efe5d3"));
        getWindow().setNavigationBarColor(Color.parseColor("#efe5d3"));
        setBarsLight(true);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#efe5d3"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "NB");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
    }

    @Override
    protected void onDestroy() {
        if (cur == this) cur = null;
        super.onDestroy();
    }

    /** 原生 → 網頁的事件（目前只有 App 內更新的進度：window.Upd.onApk） */
    static void emit(String type, final String json) {
        final MainActivity a = cur;
        if (a == null || !"apk".equals(type)) return;
        a.runOnUiThread(new Runnable() {
            public void run() {
                try { a.web.evaluateJavascript("window.Upd&&Upd.onApk(" + org.json.JSONObject.quote(json) + ")", null); } catch (Throwable t) { }
            }
        });
    }

    void setBarsLight(boolean light) {
        int f = 0;
        if (light) {
            f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(f);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__back&&window.__back())?1:0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"1".equals(v)) moveTaskToBack(true);
            }
        });
    }

    static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    void openExternal(String url) {
        try {
            Intent i = url.startsWith("tel:") ? new Intent(Intent.ACTION_DIAL, Uri.parse(url)) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "無法開啟連結", Toast.LENGTH_SHORT).show();
        }
    }

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String p = u.getPath();
            if (p == null || p.equals("/") || p.isEmpty()) p = "/index.html";
            try {
                InputStream in = getAssets().open(p.substring(1));
                String m = mime(p);
                return new WebResourceResponse(m, m.startsWith("text/") || m.contains("json") || m.contains("javascript") ? "utf-8" : null, in);
            } catch (Exception e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new java.io.ByteArrayInputStream(new byte[0]));
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openExternal(u.toString());
            return true;
        }
    }

    class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCb != null) fileCb.onReceiveValue(null);
            fileCb = cb;
            camUri = null;
            boolean image = false;
            String[] acc = p.getAcceptTypes();
            if (acc != null) for (String a : acc) if (a != null && a.startsWith("image/")) image = true;
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType(image ? "image/*" : "*/*");
            if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            Intent chooser = Intent.createChooser(pick, image ? "選擇圖片或拍照" : "選擇檔案");
            if (image && Build.VERSION.SDK_INT >= 29) {
                try {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, "foodmap_" + System.currentTimeMillis() + ".jpg");
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/食光地圖");
                    camUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (camUri != null) {
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        cam.putExtra(MediaStore.EXTRA_OUTPUT, camUri);
                        cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                    }
                } catch (Exception e) {
                    camUri = null;
                }
            }
            try {
                startActivityForResult(chooser, REQ_FILE);
            } catch (Exception e) {
                dropCam();
                fileCb = null;
                cb.onReceiveValue(null);
                return true;
            }
            return true;
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                cb.invoke(origin, true, false);
                return;
            }
            geoCb = cb;
            geoOrigin = origin;
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GEO);
        }
    }

    void dropCam() {
        if (camUri != null) {
            try { getContentResolver().delete(camUri, null, null); } catch (Exception e) { }
            camUri = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == REQ_GEO && geoCb != null) {
            boolean ok = false;
            for (int r : res) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != REQ_FILE) { super.onActivityResult(req, res, data); return; }
        ValueCallback<Uri[]> cb = fileCb;
        fileCb = null;
        if (cb == null) { dropCam(); return; }
        ArrayList<Uri> out = new ArrayList<Uri>();
        if (res == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData cd = data.getClipData();
                for (int i = 0; i < cd.getItemCount(); i++) if (cd.getItemAt(i).getUri() != null) out.add(cd.getItemAt(i).getUri());
            } else if (data != null && data.getData() != null) {
                out.add(data.getData());
            }
            if (out.isEmpty() && camUri != null) { out.add(camUri); camUri = null; }
        }
        dropCam();
        cb.onReceiveValue(out.isEmpty() ? null : out.toArray(new Uri[0]));
    }

    class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;
                if (ms < 1) ms = 1;
                if (ms > 500) ms = 500;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms);
            } catch (Exception e) { }
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() { public void run() { openExternal(url); } });
        }

        /** 用指定的 App（pkg 留空＝顯示系統選單）開啟導航；失敗時改開 fallback 網址 */
        @JavascriptInterface
        public void openNav(final String pkg, final String uri, final String fallback) {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
                        if (pkg != null && !pkg.isEmpty()) i.setPackage(pkg); else i = Intent.createChooser(i, "選擇導航 App");
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception e) {
                        if (fallback != null && !fallback.isEmpty()) { Toast.makeText(MainActivity.this, "找不到這個 App，改用瀏覽器開啟", Toast.LENGTH_SHORT).show(); openExternal(fallback); }
                        else Toast.makeText(MainActivity.this, "手機裡找不到這個 App", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /** 原生連線（不受瀏覽器 CORS 限制）；完成後呼叫 window.__nbHttp(id, status, text)，status=0 代表連線失敗 */
        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String headersJson, final String body, final int timeoutMs) {
            new Thread(new Runnable() {
                public void run() {
                    int status = 0;
                    String text = "";
                    java.net.HttpURLConnection c = null;
                    try {
                        if (!url.startsWith("https://")) throw new Exception("https only");
                        c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(Math.max(10000, timeoutMs));
                        c.setRequestMethod(method);
                        org.json.JSONObject h = new org.json.JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
                        java.util.Iterator<String> it = h.keys();
                        while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, h.getString(k)); }
                        if (body != null && !body.isEmpty() && !"GET".equals(method)) {
                            c.setDoOutput(true);
                            OutputStream o = c.getOutputStream();
                            o.write(body.getBytes("UTF-8"));
                            o.close();
                        }
                        status = c.getResponseCode();
                        InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        if (in != null) { byte[] buf = new byte[16384]; int n; while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close(); }
                        text = bo.toString("UTF-8");
                    } catch (Exception e) {
                        status = 0;
                        text = String.valueOf(e.getMessage());
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    final String js = "window.__nbHttp&&window.__nbHttp(" + org.json.JSONObject.quote(id) + "," + status + "," + org.json.JSONObject.quote(text) + ")";
                    runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
                }
            }).start();
        }

        /* ---------- App 內更新 ---------- */
        @JavascriptInterface
        public boolean canInstall() {
            return getPackageManager().canRequestPackageInstalls();
        }

        @JavascriptInterface
        public void askInstall() {
            runOnUiThread(new Runnable() {
                public void run() {
                    try { startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Throwable t) { }
                }
            });
        }

        @JavascriptInterface
        public void installApk(String url) {
            Updater.start(MainActivity.this, url);
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType("text/plain");
                        i.putExtra(Intent.EXTRA_TEXT, text);
                        startActivity(Intent.createChooser(i, "分享"));
                    } catch (Throwable t) { }
                }
            });
        }

        @JavascriptInterface
        public void copy(String t) {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("text", t));
        }

        @JavascriptInterface
        public String paste() {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm == null || !cm.hasPrimaryClip()) return "";
                CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
                return t == null ? "" : t.toString();
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void setBars(final String color, final boolean light) {
            runOnUiThread(new Runnable() {
                public void run() {
                    try {
                        int c = Color.parseColor(color);
                        getWindow().setStatusBarColor(c);
                        getWindow().setNavigationBarColor(c);
                        web.setBackgroundColor(c);
                        setBarsLight(light);
                    } catch (Exception e) { }
                }
            });
        }

        /** 分段寫檔到「下載」資料夾（Android 9 以下寫到 App 專屬資料夾） */
        @JavascriptInterface
        public synchronized boolean saveBegin(String name, String mime) {
            try {
                if (saveOut != null) { try { saveOut.close(); } catch (Exception e) { } saveOut = null; }
                saveName = name;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    saveUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (saveUri == null) return false;
                    saveOut = getContentResolver().openOutputStream(saveUri);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) return false;
                    dir.mkdirs();
                    File f = new File(dir, name);
                    saveUri = null;
                    saveName = f.getAbsolutePath();
                    saveOut = new FileOutputStream(f);
                }
                return saveOut != null;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public synchronized boolean saveChunk(String b64) {
            try { if (saveOut == null) return false; saveOut.write(Base64.decode(b64, Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public synchronized String saveEnd() {
            try {
                if (saveOut == null) return "";
                saveOut.flush(); saveOut.close(); saveOut = null;
                if (saveUri != null && Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContentResolver().update(saveUri, cv, null, null);
                }
                return saveName;
            } catch (Exception e) { return ""; }
        }
    }
}
