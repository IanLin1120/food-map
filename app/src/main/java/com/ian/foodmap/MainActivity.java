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

/** 日日帳本：把 assets/index.html 以 https://app.local/ 載入 WebView，並提供少量原生功能（震動、導航、選圖／拍照、定位、存檔）。 */
public class MainActivity extends Activity {
    static final String HOST = "app.local";
    static final int REQ_FILE = 11, REQ_GEO = 12, REQ_LOC = 13, REQ_CAM = 14, REQ_GACC = 15, REQ_GCONSENT = 16;
    static final String GSCOPE = "oauth2:https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
    String gPendId = null;
    android.webkit.PermissionRequest camReq;
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
        handleShare(getIntent());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
    }

    /* ---------- 接收分享的圖片：複製到 cache/shared/，網頁用 https://app.local/shared/<名稱> 讀取 ---------- */
    final java.util.ArrayList<String> sharedPending = new java.util.ArrayList<String>();

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        handleShare(i);
    }

    java.io.File sharedDir() {
        java.io.File d = new java.io.File(getCacheDir(), "shared");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    void handleShare(Intent i) {
        if (i == null) return;
        String act = i.getAction();
        if (!Intent.ACTION_SEND.equals(act) && !Intent.ACTION_SEND_MULTIPLE.equals(act)) return;
        final java.util.ArrayList<Uri> uris = new java.util.ArrayList<Uri>();
        try {
            if (Intent.ACTION_SEND.equals(act)) {
                Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else {
                java.util.ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null) uris.addAll(l);
            }
            if (uris.isEmpty() && i.getClipData() != null) {
                ClipData cd = i.getClipData();
                for (int k = 0; k < cd.getItemCount(); k++) if (cd.getItemAt(k).getUri() != null) uris.add(cd.getItemAt(k).getUri());
            }
        } catch (Throwable t) { }
        i.setAction(null);   /* 避免轉螢幕重建時重複收一次 */
        if (uris.isEmpty()) return;
        new Thread(new Runnable() {
            public void run() {
                int n = 0;
                for (Uri u : uris) {
                    if (n >= 20) break;
                    try {
                        String name = "s" + System.currentTimeMillis() + "_" + n + ".img";
                        InputStream in = getContentResolver().openInputStream(u);
                        if (in == null) continue;
                        java.io.FileOutputStream out = new java.io.FileOutputStream(new java.io.File(sharedDir(), name));
                        byte[] buf = new byte[65536];
                        int r;
                        long tot = 0;
                        while ((r = in.read(buf)) > 0) { out.write(buf, 0, r); tot += r; if (tot > 40000000) break; }
                        out.close();
                        in.close();
                        synchronized (sharedPending) { sharedPending.add(name); }
                        n++;
                    } catch (Throwable t) { }
                }
                if (n > 0) emit("share", "{}");
            }
        }).start();
    }

    /* ---------- 讀取線上點餐網頁：在主畫面後面開一個看不見的 WebView，等內容載完後讀出全部文字 ---------- */
    void pageDone(String id, boolean ok, String jsLiteral) {
        web.evaluateJavascript("window.__nbPage&&window.__nbPage(" + org.json.JSONObject.quote(id) + "," + ok + "," + jsLiteral + ")", null);
    }

    void startPageRead(final String id, final String url) { startPageRead(id, url, false); }

    void startPageRead(final String id, final String url, final boolean full) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) { pageDone(id, false, org.json.JSONObject.quote("網址不正確")); return; }
        final android.widget.FrameLayout host = (android.widget.FrameLayout) findViewById(android.R.id.content);
        final WebView w = new WebView(this);
        WebSettings ws = w.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setBlockNetworkImage(!full);
        ws.setAllowFileAccess(false);
        host.addView(w, 0, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        final long t0 = android.os.SystemClock.uptimeMillis();
        final int[] last = {-1}, stable = {0};
        final boolean[] done = {false};
        final Runnable cleanup = new Runnable() { public void run() { try { host.removeView(w); w.stopLoading(); w.destroy(); } catch (Throwable t) { } } };
        final Runnable extract = new Runnable() {
            public void run() {
                if (done[0]) return;
                /* 文字＋連結＋大張圖片（菜單圖片通常是網頁裡最大的幾張） */
                String js = "(function(){var L=[],I=[],seen={},hs={};try{var as=document.querySelectorAll('a[href]');for(var i=0;i<as.length&&i<1500;i++){var a=as[i],hr=a.href||'';if(!hr||hr.indexOf('javascript:')==0)continue;"
                        + "var t=(a.innerText||'').trim();if(!t)t=(a.textContent||a.getAttribute('aria-label')||a.title||'').trim();if(!t){var gi=a.querySelector('img');if(gi)t=gi.alt||'';}t=t.replace(/\\s+/g,' ');"
                        + "var img=/\\.(jpe?g|png|webp|gif)(\\?|#|$)/i.test(hr),mn=/菜單|menu|drink|價目|飲品|飲料|餐點|價格/i.test(t+' '+hr);if(!(t.length>3||img||(mn&&t.length>=2)))continue;"
                        + "if(hs[hr+'|'+t])continue;hs[hr+'|'+t]=1;L.push({h:hr,t:t.slice(0,140),k:img?2:mn?1:0});}"
                        + "L.sort(function(x,y){return y.k-x.k;});L=L.slice(0,200);"
                        + "var im=document.querySelectorAll('img');for(var j=0;j<im.length&&I.length<60;j++){var g=im[j],s=g.currentSrc||g.src||g.getAttribute('data-src')||g.getAttribute('data-original')||g.getAttribute('data-lazy-src')||'';var w=g.naturalWidth||0,h=g.naturalHeight||0;"
                        + "if(!s||s.indexOf('data:')==0||seen[s])continue;if(w&&w<350&&h<350)continue;seen[s]=1;I.push({s:s,w:w,h:h,a:(g.alt||'').slice(0,80)});}}catch(e){}"
                        + "return JSON.stringify({t:document.title,u:location.href,x:(document.body?document.body.innerText:'').slice(0,150000),links:L,imgs:I});})()";
                w.evaluateJavascript(js, new ValueCallback<String>() {
                    public void onReceiveValue(String v) {
                        if (done[0]) return;
                        done[0] = true;
                        pageDone(id, v != null && !"null".equals(v), v == null || "null".equals(v) ? org.json.JSONObject.quote("讀不到網頁內容") : v);
                        h.post(cleanup);
                    }
                });
            }
        };
        final Runnable[] poll = new Runnable[1];
        poll[0] = new Runnable() {
            public void run() {
                if (done[0]) return;
                final long el = android.os.SystemClock.uptimeMillis() - t0;
                /* 一段一段往下捲，讓延遲載入的品項和圖片都出現；到底而且文字不再變多才算載完 */
                w.evaluateJavascript("(function(){try{var b=document.scrollingElement||document.body;window.scrollBy(0,innerHeight*1.6);return (document.body?document.body.innerText.length:0)*10+((b.scrollTop+innerHeight>=b.scrollHeight-8)?1:0)}catch(e){return 0}})()", new ValueCallback<String>() {
                    public void onReceiveValue(String v) {
                        long raw = 0;
                        try { raw = Long.parseLong(v == null ? "0" : v.replaceAll("[^0-9]", "")); } catch (Exception e) { }
                        int n = (int) (raw / 10);
                        boolean bottom = raw % 10 == 1;
                        if (n > 150 && n == last[0] && bottom) stable[0]++; else stable[0] = 0;
                        last[0] = n;
                        if ((stable[0] >= 2 && el > 5000) || el > (full ? 45000 : 40000)) extract.run(); else h.postDelayed(poll[0], 1000);
                    }
                });
            }
        };
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String sc = r.getUrl().getScheme();
                return !("http".equals(sc) || "https".equals(sc));   /* 不跳到 LINE、Google Play 等其他 App */
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, android.webkit.WebResourceError e) {
                if (r.isForMainFrame() && !done[0]) {
                    done[0] = true;
                    pageDone(id, false, org.json.JSONObject.quote("網頁打不開（" + e.getDescription() + "）"));
                    h.post(cleanup);
                }
            }
        });
        w.loadUrl(url);
        h.postDelayed(poll[0], 2500);
        h.postDelayed(new Runnable() { public void run() { if (!done[0]) extract.run(); } }, 50000);
    }

    /* ---------- 發票區：App 內打開財政部電子發票平台，使用者自己登入，按「讀取這一頁」把頁面上的發票傳回 ---------- */
    android.widget.LinearLayout invBox;
    WebView invWebV;

    void closeInvWeb() {
        if (invBox == null) return;
        try { ((ViewGroup) invBox.getParent()).removeView(invBox); invWebV.stopLoading(); invWebV.destroy(); } catch (Throwable t) { }
        invBox = null; invWebV = null;
    }

    void openInvWeb(String url) {
        if (url == null || !url.startsWith("https://")) return;
        closeInvWeb();
        final float dp = getResources().getDisplayMetrics().density;
        final android.widget.FrameLayout host = (android.widget.FrameLayout) findViewById(android.R.id.content);
        invBox = new android.widget.LinearLayout(this);
        invBox.setOrientation(android.widget.LinearLayout.VERTICAL);
        invBox.setBackgroundColor(Color.parseColor("#efe5d3"));
        invBox.setClickable(true);
        android.widget.LinearLayout bar = new android.widget.LinearLayout(this);
        bar.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        bar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        int pd = (int) (8 * dp);
        bar.setPadding(pd, pd, pd, pd);
        bar.setBackgroundColor(Color.parseColor("#efe5d3"));
        android.widget.Button close = new android.widget.Button(this);
        close.setText("✕ 關閉"); close.setAllCaps(false); close.setTextColor(Color.parseColor("#3a2c22"));
        close.setBackground(rounded("#e6d8bf", "#cdb994", dp));
        android.widget.Button read = new android.widget.Button(this);
        read.setText("📥 讀取這一頁"); read.setAllCaps(false); read.setTextColor(Color.WHITE);
        read.setTypeface(null, android.graphics.Typeface.BOLD);
        read.setBackground(rounded("#5a7a44", "#5a7a44", dp));
        android.widget.LinearLayout.LayoutParams lc = new android.widget.LinearLayout.LayoutParams(0, (int) (44 * dp), 1f);
        android.widget.LinearLayout.LayoutParams lr = new android.widget.LinearLayout.LayoutParams(0, (int) (44 * dp), 1.6f);
        lr.leftMargin = pd;
        bar.addView(close, lc); bar.addView(read, lr);
        invWebV = new WebView(this);
        WebSettings ws = invWebV.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true); ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false); ws.setSupportZoom(true); ws.setBuiltInZoomControls(true); ws.setDisplayZoomControls(false);
        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(invWebV, true);
        invWebV.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String sc = r.getUrl().getScheme();
                return !("http".equals(sc) || "https".equals(sc));
            }
        });
        invWebV.setWebChromeClient(new WebChromeClient());
        invBox.addView(bar, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        invBox.addView(invWebV, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        host.addView(invBox, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        close.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { closeInvWeb(); } });
        read.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                if (invWebV == null) return;
                /* 頁面文字＋所有表格（含同網域的 iframe） */
                String js = "(function(){function tb(doc,out){var ts=doc.querySelectorAll('table');for(var i=0;i<ts.length&&out.length<40;i++){var R=[],rs=ts[i].rows;for(var j=0;j<rs.length&&j<400;j++){var C=[];for(var k=0;k<rs[j].cells.length;k++)C.push((rs[j].cells[k].innerText||'').replace(/\\s+/g,' ').trim());R.push(C);}out.push(R);}"
                        + "var g=doc.querySelectorAll('[role=table],[class*=table],[class*=Table]');for(var a=0;a<g.length&&out.length<60;a++){if(g[a].tagName=='TABLE')continue;var rows=g[a].querySelectorAll('[role=row],[class*=row],[class*=Row],tr,li');if(rows.length<2)continue;var R2=[];for(var b=0;b<rows.length&&b<400;b++){var cs=rows[b].querySelectorAll('[role=cell],[role=columnheader],[class*=cell],[class*=Cell],[class*=col],td,th,span');var C2=[];for(var c=0;c<cs.length&&c<12;c++){var tx=(cs[c].innerText||'').replace(/\\s+/g,' ').trim();if(tx&&C2.indexOf(tx)<0)C2.push(tx);}if(C2.length>1)R2.push(C2);}if(R2.length>1)out.push(R2);}}"
                        + "var T=[],X='';try{tb(document,T);X=document.body.innerText;var fr=document.querySelectorAll('iframe');for(var f=0;f<fr.length;f++){try{var d=fr[f].contentDocument;if(d){tb(d,T);X+='\\n'+d.body.innerText;}}catch(e){}}}catch(e){}"
                        + "return JSON.stringify({u:location.href,t:document.title,x:X.slice(0,200000),tables:T});})()";
                invWebV.evaluateJavascript(js, new ValueCallback<String>() {
                    public void onReceiveValue(String val) {
                        if (val == null || "null".equals(val)) { Toast.makeText(MainActivity.this, "讀不到這一頁", Toast.LENGTH_SHORT).show(); return; }
                        web.evaluateJavascript("window.__invWeb&&window.__invWeb(" + val + ")", null);
                    }
                });
            }
        });
        invWebV.loadUrl(url);
    }


    /* ---------- pCloud 網頁登入：App 內打開 pCloud 官網，自己登入（支援兩步驟驗證、彈出視窗），登入後取出登入權杖 ---------- */
    android.widget.FrameLayout pcBox; WebView pcWebV, pcPop; android.os.Handler pcH = new android.os.Handler(android.os.Looper.getMainLooper()); Runnable pcPoll; boolean pcDone;
    void closePcWeb() {
        if (pcBox == null) return; pcH.removeCallbacksAndMessages(null);
        try { ((ViewGroup) pcBox.getParent()).removeView(pcBox); if (pcWebV != null) pcWebV.destroy(); if (pcPop != null) pcPop.destroy(); } catch (Throwable t) { }
        pcBox = null; pcWebV = null; pcPop = null;
    }
    void pcSend(String json) { final String js = "window.__pcWeb&&window.__pcWeb(" + json + ")"; web.evaluateJavascript(js, null); }
    WebView pcMakeWeb() {
        WebView w = new WebView(this); WebSettings ws = w.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true); ws.setDatabaseEnabled(true); ws.setSupportMultipleWindows(true); ws.setJavaScriptCanOpenWindowsAutomatically(true);
        ws.setUserAgentString(ws.getUserAgentString().replace("; wv", ""));
        android.webkit.CookieManager.getInstance().setAcceptCookie(true); android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(w, true);
        w.setWebViewClient(new WebViewClient() { @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { String sc = r.getUrl().getScheme(); return !("http".equals(sc) || "https".equals(sc)); } });
        w.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean user, android.os.Message msg) {
                /* 彈出視窗（例如 Google／Apple 登入）：疊一層新的 WebView 顯示，不阻擋 */
                if (pcPop != null) { try { pcBox.removeView(pcPop); pcPop.destroy(); } catch (Throwable t) { } }
                pcPop = pcMakeWeb(); pcBox.addView(pcPop, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                ((WebView.WebViewTransport) msg.obj).setWebView(pcPop); msg.sendToTarget(); return true;
            }
            @Override public void onCloseWindow(WebView w2) { if (w2 == pcPop) { try { pcBox.removeView(pcPop); pcPop.destroy(); } catch (Throwable t) { } pcPop = null; } }
        });
        return w;
    }
    void openPcWeb() {
        closePcWeb(); pcDone = false;
        final float dp = getResources().getDisplayMetrics().density;
        final android.widget.FrameLayout host = (android.widget.FrameLayout) findViewById(android.R.id.content);
        android.widget.LinearLayout col = new android.widget.LinearLayout(this); col.setOrientation(android.widget.LinearLayout.VERTICAL); col.setBackgroundColor(Color.parseColor("#efe5d3"));
        pcBox = new android.widget.FrameLayout(this); pcBox.setClickable(true);
        android.widget.LinearLayout bar = new android.widget.LinearLayout(this); bar.setGravity(android.view.Gravity.CENTER_VERTICAL); int pd = (int) (8 * dp); bar.setPadding(pd, pd + (int) getStatusBarH(), pd, pd);
        android.widget.Button close = new android.widget.Button(this); close.setText("✕ 關閉"); close.setAllCaps(false); close.setTextColor(Color.parseColor("#3a2c22")); close.setBackground(rounded("#e6d8bf", "#cdb994", dp));
        final android.widget.TextView tip = new android.widget.TextView(this); tip.setText("請登入 pCloud，登入完成會自動回到日日帳本"); tip.setTextColor(Color.parseColor("#5b4a3a")); tip.setPadding(pd, 0, 0, 0);
        bar.addView(close, new android.widget.LinearLayout.LayoutParams((int) (90 * dp), (int) (42 * dp))); bar.addView(tip, new android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        pcWebV = pcMakeWeb();
        col.addView(bar, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        col.addView(pcWebV, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        pcBox.addView(col, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        host.addView(pcBox, new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        close.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { closePcWeb(); pcSend("{\"cancel\":1}"); } });
        /* 每秒找一次登入權杖：網站的 cookie（含 httpOnly）和 localStorage */
        pcPoll = new Runnable() { public void run() {
            if (pcBox == null || pcDone) return;
            final org.json.JSONArray cand = new org.json.JSONArray(); android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
            for (String u : new String[]{"https://my.pcloud.com", "https://e.pcloud.com", "https://www.pcloud.com", "https://api.pcloud.com", "https://eapi.pcloud.com", "https://u.pcloud.link"}) {
                String ck = cm.getCookie(u); if (ck == null) continue;
                for (String kv : ck.split(";")) { String[] p = kv.trim().split("=", 2); if (p.length == 2 && p[0].toLowerCase().contains("auth") && p[1].length() >= 20) cand.put(p[1]); }
            }
            if (pcWebV != null) pcWebV.evaluateJavascript("(function(){var o=[];try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i),v=localStorage.getItem(k)||'';if(/auth/i.test(k)){var m=v.match(/[A-Za-z0-9]{20,}/g);if(m)o=o.concat(m);}}}catch(e){}return JSON.stringify(o);})()", new ValueCallback<String>() {
                public void onReceiveValue(String v) {
                    try { org.json.JSONArray a = new org.json.JSONArray(new org.json.JSONTokener(v).nextValue().toString()); for (int i = 0; i < a.length(); i++) cand.put(a.getString(i)); } catch (Exception e) { }
                    if (cand.length() > 0) pcSend("{\"cands\":" + cand.toString() + "}");
                    pcH.postDelayed(pcPoll, 1200);
                }
            }); else pcH.postDelayed(pcPoll, 1200);
        } };
        pcWebV.loadUrl("https://my.pcloud.com/#page=login"); pcH.postDelayed(pcPoll, 1500);
    }

    /* ---------- 快速換機：用同一個 Wi-Fi，在手機上開一個小伺服器把備份檔傳給另一支手機 ---------- */
    java.net.ServerSocket xfer; String xferTok;
    File xferFile(String n) { return new File(getCacheDir(), n); }

    android.graphics.drawable.GradientDrawable rounded(String fill, String stroke, float dp) {
        android.graphics.drawable.GradientDrawable g = new android.graphics.drawable.GradientDrawable();
        g.setColor(Color.parseColor(fill)); g.setCornerRadius(6 * dp); g.setStroke((int) Math.max(1, dp), Color.parseColor(stroke));
        return g;
    }

    float getStatusBarH() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    /* ---------- 原生定位：同時用 GPS、網路、整合定位，並立刻回報最後已知位置 ---------- */
    android.location.LocationManager lm;
    android.location.LocationListener locL;
    boolean locWant;

    boolean hasLocPerm() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    void sendLoc(android.location.Location l) {
        try {
            long age = (android.os.SystemClock.elapsedRealtimeNanos() - l.getElapsedRealtimeNanos()) / 1000000L;
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("lat", l.getLatitude()).put("lon", l.getLongitude()).put("acc", l.hasAccuracy() ? l.getAccuracy() : 999)
                    .put("t", System.currentTimeMillis() - Math.max(0, age)).put("p", l.getProvider());
            emit("loc", o.toString());
        } catch (Throwable t) { }
    }

    void sendLocErr(String code) {
        emit("loc", "{\"err\":\"" + code + "\"}");
    }

    void locBegin() {
        if (!hasLocPerm()) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
            return;
        }
        try {
            if (lm == null) lm = (android.location.LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) { sendLocErr("unavail"); return; }
            if (Build.VERSION.SDK_INT >= 28 && !lm.isLocationEnabled()) sendLocErr("off");
            if (locL == null) locL = new android.location.LocationListener() {
                @Override public void onLocationChanged(android.location.Location l) { sendLoc(l); }
                @Override public void onStatusChanged(String p, int st, Bundle b) { }
                @Override public void onProviderEnabled(String p) { }
                @Override public void onProviderDisabled(String p) { }
            };
            lm.removeUpdates(locL);
            android.location.Location best = null;
            for (String p : lm.getProviders(true)) {
                try {
                    android.location.Location l = lm.getLastKnownLocation(p);
                    if (l != null && (best == null || l.getElapsedRealtimeNanos() > best.getElapsedRealtimeNanos())) best = l;
                } catch (Throwable t) { }
                if ("passive".equals(p)) continue;
                try { lm.requestLocationUpdates(p, 1000L, 0f, locL, android.os.Looper.getMainLooper()); } catch (Throwable t) { }
            }
            if (best != null) sendLoc(best);
        } catch (Throwable t) {
            sendLocErr("unavail");
        }
    }

    void locEnd() {
        try { if (lm != null && locL != null) lm.removeUpdates(locL); } catch (Throwable t) { }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (locWant) locEnd();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (locWant && hasLocPerm()) locBegin();
    }

    @Override
    protected void onDestroy() {
        if (cur == this) cur = null;
        super.onDestroy();
    }

    /** 原生 → 網頁的事件（目前只有 App 內更新的進度：window.Upd.onApk） */
    static void emit(String type, final String json) {
        final MainActivity a = cur;
        if (a == null) return;
        final String fn = "apk".equals(type) ? "window.Upd&&Upd.onApk(" : "off".equals(type) ? "window.Off&&Off.onNative(" : "loc".equals(type) ? "window.Loc&&Loc.onNative(" : "share".equals(type) ? "window.Share&&Share.onNative(" : null;
        if (fn == null) return;
        a.runOnUiThread(new Runnable() {
            public void run() {
                try { a.web.evaluateJavascript(fn + org.json.JSONObject.quote(json) + ")", null); } catch (Throwable t) { }
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
        if (invBox != null) { if (invWebV != null && invWebV.canGoBack()) invWebV.goBack(); else closeInvWeb(); return; }
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
            /* 離線地圖：/vt/z/x/y＝已下載的圖磚，/oc?u=網址＝已快取的字型與圖示；沒有就回 404，網頁端會改上網抓 */
            if (p.startsWith("/shared/")) {
                String n = p.substring(8);
                java.io.File f = new java.io.File(sharedDir(), n);
                if (n.matches("s[0-9]+_[0-9]+\\.img") && f.exists()) {
                    try { return new WebResourceResponse("image/jpeg", null, new java.io.FileInputStream(f)); } catch (Throwable t) { }
                }
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new java.io.ByteArrayInputStream(new byte[0]));
            }
            if (p.startsWith("/vt/") || p.equals("/oc")) {
                try {
                    if (p.equals("/oc")) {
                        String src = u.getQueryParameter("u");
                        java.io.File f = Offline.cached(MainActivity.this, src);
                        if (f != null) {
                            String m = src.contains(".json") ? "application/json" : src.contains(".png") ? "image/png" : "application/x-protobuf";
                            return new WebResourceResponse(m, m.contains("json") ? "utf-8" : null, new java.io.FileInputStream(f));
                        }
                    } else {
                        String[] q = p.substring(4).split("/");
                        byte[] d = q.length == 3 ? Offline.tile(MainActivity.this, Integer.parseInt(q[0]), Integer.parseInt(q[1]), Integer.parseInt(q[2])) : null;
                        if (d != null) return new WebResourceResponse("application/x-protobuf", null, new java.io.ByteArrayInputStream(d));
                    }
                } catch (Throwable t) { }
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new java.io.ByteArrayInputStream(new byte[0]));
            }
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
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/日日帳本");
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

        /* 網頁要用相機（掃描發票 QR Code） */
        @Override
        public void onPermissionRequest(final android.webkit.PermissionRequest r) {
            runOnUiThread(new Runnable() { public void run() {
                boolean video = false;
                for (String x : r.getResources()) if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) video = true;
                if (!video) { r.deny(); return; }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) { r.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE}); return; }
                if (camReq != null) { try { camReq.deny(); } catch (Exception e) { } }
                camReq = r;
                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAM);
            } });
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
        if (req == REQ_CAM) {
            boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
            if (camReq != null) { try { if (ok) camReq.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else camReq.deny(); } catch (Exception e) { } camReq = null; }
            return;
        }
        if (req == REQ_LOC) {
            boolean ok = false;
            for (int r : res) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
            if (ok && locWant) locBegin(); else if (!ok) sendLocErr("denied");
            return;
        }
        if (req == REQ_GEO && geoCb != null) {
            boolean ok = false;
            for (int r : res) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
        }
    }


    /* ---------- Google 帳戶（雲端備份用）：系統的帳戶選擇器＋AccountManager 取得 Drive 權杖 ---------- */
    void gReply(String id, String token, String err) {
        try { org.json.JSONObject o = new org.json.JSONObject(); if (token != null) o.put("token", token); if (err != null) o.put("err", err);
            o.put("email", getSharedPreferences("g", MODE_PRIVATE).getString("acc", ""));
            final String js = "window.__gtok&&window.__gtok(" + org.json.JSONObject.quote(id) + "," + o.toString() + ")";
            runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
        } catch (Exception e) { }
    }
    android.accounts.Account gAccount() {
        String n = getSharedPreferences("g", MODE_PRIVATE).getString("acc", "");
        if (n.isEmpty()) return null;
        return new android.accounts.Account(n, "com.google");
    }
    void gFetch(final String id, final boolean allowUi) {
        final android.accounts.Account a = gAccount(); if (a == null) { gReply(id, null, "尚未選擇 Google 帳戶"); return; }
        gPendId = id;
        android.accounts.AccountManager.get(this).getAuthToken(a, GSCOPE, null, false, new android.accounts.AccountManagerCallback<Bundle>() {
            public void run(android.accounts.AccountManagerFuture<Bundle> f) {
                try {
                    Bundle b = f.getResult();
                    Intent need = (Intent) b.get(android.accounts.AccountManager.KEY_INTENT);
                    if (need != null) { if (allowUi) { need.setFlags(need.getFlags() & ~Intent.FLAG_ACTIVITY_NEW_TASK); startActivityForResult(need, REQ_GCONSENT); } else gReply(id, null, "需要授權"); return; }
                    String t = b.getString(android.accounts.AccountManager.KEY_AUTHTOKEN);
                    if (t != null) gReply(id, t, null); else gReply(id, null, "沒有拿到授權");
                } catch (android.accounts.OperationCanceledException e) { gReply(id, null, "已取消");
                } catch (Exception e) { String m = e.getClass().getSimpleName() + "：" + e.getMessage(); gReply(id, null, "GERR:" + m); }
            }
        }, null);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_GACC) {
            if (res == RESULT_OK && data != null && data.getStringExtra(android.accounts.AccountManager.KEY_ACCOUNT_NAME) != null) {
                getSharedPreferences("g", MODE_PRIVATE).edit().putString("acc", data.getStringExtra(android.accounts.AccountManager.KEY_ACCOUNT_NAME)).apply();
                gFetch(gPendId == null ? "signin" : gPendId, true);
            } else gReply(gPendId == null ? "signin" : gPendId, null, "已取消");
            return;
        }
        if (req == REQ_GCONSENT) { gFetch(gPendId == null ? "signin" : gPendId, false); return; }
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

        /** 可指定強度（1~255）的震動；手機不支援調整強度時只用時間長短 */
        @JavascriptInterface
        public void vibrate2(int ms, int amp) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) return;
                if (ms < 1) ms = 1;
                if (ms > 500) ms = 500;
                if (amp < 1) amp = 1;
                if (amp > 255) amp = 255;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, v.hasAmplitudeControl() ? amp : VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms);
            } catch (Exception e) { }
        }

        /* ---------- 讀取點餐網頁 ---------- */
        @JavascriptInterface
        public void pageText(final String id, final String url) {
            runOnUiThread(new Runnable() { public void run() { startPageRead(id, url, false); } });
        }

        /** 同 pageText，另外載入圖片並回傳網頁裡的連結與大張圖片（搜尋菜單用） */
        @JavascriptInterface
        public void pageRead(final String id, final String url, final boolean full) {
            runOnUiThread(new Runnable() { public void run() { startPageRead(id, url, full); } });
        }

        /* ---------- 分享進來的圖片 ---------- */
        @JavascriptInterface
        public String sharedTake() {
            org.json.JSONArray a = new org.json.JSONArray();
            synchronized (sharedPending) { for (String n : sharedPending) a.put(n); sharedPending.clear(); }
            return a.toString();
        }

        @JavascriptInterface
        public void sharedDone(String n) {
            if (n != null && n.matches("s[0-9]+_[0-9]+\\.img")) new java.io.File(sharedDir(), n).delete();
        }

        /* ---------- 定位 ---------- */
        @JavascriptInterface
        public void locStart() { runOnUiThread(new Runnable() { public void run() { locWant = true; locBegin(); } }); }

        @JavascriptInterface
        public void locStop() { runOnUiThread(new Runnable() { public void run() { locWant = false; locEnd(); } }); }

        @JavascriptInterface
        public boolean locHasPerm() { return hasLocPerm(); }

        /** 下載 Google 地圖相片（瀏覽器跨網域限制讀不到時用），完成後呼叫 window.__nbB64(id, ok, mime, base64) */
        @JavascriptInterface
        public void fetchB64(final String id, final String url) {
            new Thread(new Runnable() {
                public void run() {
                    boolean ok = false;
                    String mime = "image/jpeg", b64 = "";
                    java.net.HttpURLConnection c = null;
                    try {
                        Uri u = Uri.parse(url);
                        String h = u.getHost() == null ? "" : u.getHost();
                        boolean g = h.endsWith(".googleusercontent.com") || h.endsWith(".ggpht.com") || h.endsWith(".googleapis.com");
                        if (!("https".equals(u.getScheme()) || "http".equals(u.getScheme()))) throw new Exception("scheme");
                        c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(40000);
                        c.setInstanceFollowRedirects(true);
                        if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                        if (c.getContentType() != null) mime = c.getContentType().split(";")[0];
                        if (!g && !mime.startsWith("image/")) throw new Exception("not image");   /* 其他網站只允許下載圖片 */
                        InputStream in = c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[32768];
                        int n;
                        while ((n = in.read(buf)) > 0) { bo.write(buf, 0, n); if (bo.size() > 20000000) throw new Exception("too big"); }
                        in.close();
                        b64 = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
                        ok = true;
                    } catch (Exception e) {
                        ok = false;
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    final String js = "window.__nbB64&&window.__nbB64(" + org.json.JSONObject.quote(id) + "," + ok + "," + org.json.JSONObject.quote(mime) + "," + org.json.JSONObject.quote(b64) + ")";
                    runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
                }
            }).start();
        }

        /* ---------- 離線地圖 ---------- */
        @JavascriptInterface
        public void packGet(String id, String url, String key) { Offline.packGet(MainActivity.this, id, url, key); }

        @JavascriptInterface
        public void cacheGet(String id, String url) { Offline.cacheGet(MainActivity.this, id, url); }

        @JavascriptInterface
        public String offList() { return Offline.list(MainActivity.this); }

        @JavascriptInterface
        public void offDelete(String key) { Offline.deleteAll(MainActivity.this); }

        @JavascriptInterface
        public void offCancel() { Offline.cancel = true; }

        /* 發票區：協助工具讀取 */
        @JavascriptInterface
        public String invAccState() {
            try { String v = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
                return v != null && v.contains(getPackageName() + "/") && v.contains("InvAccessService") ? "on" : "off"; } catch (Exception e) { return "off"; }
        }
        @JavascriptInterface
        public void invAccArm(boolean on) { InvAccessService.sp(MainActivity.this).edit().putBoolean("armed", on).apply(); InvAccessService.rearm(MainActivity.this); }
        @JavascriptInterface
        public void invAccSettings() { runOnUiThread(new Runnable() { public void run() { try { startActivity(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)); } catch (Exception e) { } } }); }
        @JavascriptInterface
        public String invInbox() { return InvAccessService.takeInbox(MainActivity.this); }
        /* 找手機上名稱有「發票」的 App（給協助工具自動打開發票大師） */
        @JavascriptInterface
        public String invApps() {
            try { org.json.JSONArray a = new org.json.JSONArray(); android.content.pm.PackageManager pm = getPackageManager();
                Intent q = new Intent(Intent.ACTION_MAIN); q.addCategory(Intent.CATEGORY_LAUNCHER);
                for (android.content.pm.ResolveInfo r : pm.queryIntentActivities(q, 0)) { String lb = String.valueOf(r.loadLabel(pm)), pk = r.activityInfo.packageName;
                    if (pk.equals(getPackageName())) continue;
                    if (lb.contains("發票") || lb.contains("载具") || lb.contains("載具") || lb.toLowerCase().contains("invoice")) { org.json.JSONObject o = new org.json.JSONObject(); o.put("label", lb); o.put("pkg", pk); a.put(o); } }
                org.json.JSONObject res = new org.json.JSONObject(); res.put("apps", a); res.put("last", InvAccessService.sp(MainActivity.this).getString("lastPkg", "")); return res.toString();
            } catch (Exception e) { return "{\"apps\":[]}"; }
        }

        @JavascriptInterface
        public void openPkg(final String pkg) { runOnUiThread(new Runnable() { public void run() { try { Intent i = getPackageManager().getLaunchIntentForPackage(pkg); if (i != null) startActivity(i); } catch (Exception e) { } } }); }

        @JavascriptInterface
        public void invWeb(final String url) { runOnUiThread(new Runnable() { public void run() { openInvWeb(url); } }); }

        @JavascriptInterface
        public void gSignIn(final String id) { runOnUiThread(new Runnable() { public void run() {
            gPendId = id;
            try { Intent i = android.accounts.AccountManager.newChooseAccountIntent(gAccount(), null, new String[]{"com.google"}, null, null, null, null); startActivityForResult(i, REQ_GACC); }
            catch (Exception e) { gReply(id, null, String.valueOf(e.getMessage())); } } }); }

        @JavascriptInterface
        public void gToken(final String id) { runOnUiThread(new Runnable() { public void run() { if (gAccount() == null) gSignIn(id); else gFetch(id, true); } }); }

        @JavascriptInterface
        public void gDrop(String token) { try { android.accounts.AccountManager.get(MainActivity.this).invalidateAuthToken("com.google", token); } catch (Exception e) { } }

        @JavascriptInterface
        public void gSignOut() { getSharedPreferences("g", MODE_PRIVATE).edit().remove("acc").apply(); }

        /* 給 pCloud 用：WebView 跨網域被擋時改由原生端連線 */
        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String ctype, final String b64) {
            new Thread(new Runnable() { public void run() {
                org.json.JSONObject o = new org.json.JSONObject();
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setRequestMethod(method); c.setConnectTimeout(20000); c.setReadTimeout(180000);
                    if (b64 != null && b64.length() > 0) { byte[] body = Base64.decode(b64, Base64.NO_WRAP); c.setDoOutput(true); if (ctype != null && ctype.length() > 0) c.setRequestProperty("Content-Type", ctype); c.setFixedLengthStreamingMode(body.length); OutputStream os = c.getOutputStream(); os.write(body); os.close(); }
                    int code = c.getResponseCode(); InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n; if (in != null) { while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close(); }
                    o.put("status", code); o.put("text", new String(bo.toByteArray(), "UTF-8"));
                } catch (Exception e) { try { o.put("err", String.valueOf(e.getMessage())); } catch (Exception x) { } }
                final String js = "window.__http&&window.__http(" + org.json.JSONObject.quote(id) + "," + o.toString() + ")";
                runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
            } }).start();
        }

        @JavascriptInterface
        public void pcWeb() { runOnUiThread(new Runnable() { public void run() { openPcWeb(); } }); }
        @JavascriptInterface
        public void pcWebClose() { runOnUiThread(new Runnable() { public void run() { pcDone = true; closePcWeb(); } }); }

        /* 暫存檔：分段寫入／讀出（傳大檔用） */
        @JavascriptInterface
        public boolean tmpWrite(String name, String b64, boolean append) {
            try { FileOutputStream o = new FileOutputStream(xferFile(name), append); o.write(Base64.decode(b64, Base64.NO_WRAP)); o.close(); return true; } catch (Exception e) { return false; } }
        @JavascriptInterface
        public long tmpSize(String name) { return xferFile(name).length(); }
        @JavascriptInterface
        public String tmpRead(String name, long off, int len) {
            try { java.io.RandomAccessFile f = new java.io.RandomAccessFile(xferFile(name), "r"); f.seek(off); byte[] b = new byte[(int) Math.min(len, Math.max(0, f.length() - off))]; f.readFully(b); f.close(); return Base64.encodeToString(b, Base64.NO_WRAP); } catch (Exception e) { return ""; } }

        @JavascriptInterface
        public String xferStart() {
            try {
                if (xfer != null) try { xfer.close(); } catch (Exception e) { }
                xfer = new java.net.ServerSocket(0); xferTok = Long.toHexString(new java.security.SecureRandom().nextLong()).replace("-", "");
                final java.net.ServerSocket ss = xfer;
                new Thread(new Runnable() { public void run() {
                    while (!ss.isClosed()) { try { final java.net.Socket so = ss.accept(); new Thread(new Runnable() { public void run() {
                        try { java.io.BufferedReader rd = new java.io.BufferedReader(new java.io.InputStreamReader(so.getInputStream())); String line = rd.readLine(); OutputStream os = so.getOutputStream();
                            File f = xferFile("xfer_out.json");
                            if (line != null && line.contains("/" + xferTok) && f.exists()) {
                                os.write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + f.length() + "\r\nConnection: close\r\n\r\n").getBytes("UTF-8"));
                                java.io.FileInputStream in = new java.io.FileInputStream(f); byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) os.write(b, 0, n); in.close();
                                runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript("window.__xferSent&&window.__xferSent()", null); } });
                            } else os.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".getBytes("UTF-8"));
                            os.flush(); so.close(); } catch (Exception e) { } } }).start(); } catch (Exception e) { break; } }
                } }).start();
                String ip = "";
                for (java.net.NetworkInterface ni : java.util.Collections.list(java.net.NetworkInterface.getNetworkInterfaces())) {
                    if (!ni.isUp() || ni.isLoopback()) continue;
                    for (java.net.InetAddress a : java.util.Collections.list(ni.getInetAddresses())) if (a instanceof java.net.Inet4Address && a.isSiteLocalAddress()) { if (ip.isEmpty() || ni.getName().startsWith("wlan") || ni.getName().startsWith("ap")) ip = a.getHostAddress(); }
                }
                return "{\"ip\":\"" + ip + "\",\"port\":" + ss.getLocalPort() + ",\"tok\":\"" + xferTok + "\"}";
            } catch (Exception e) { return "{\"err\":" + org.json.JSONObject.quote(String.valueOf(e.getMessage())) + "}"; }
        }
        @JavascriptInterface
        public void xferStop() { try { if (xfer != null) xfer.close(); } catch (Exception e) { } xfer = null; xferFile("xfer_out.json").delete(); }
        @JavascriptInterface
        public void xferGet(final String id, final String url) {
            new Thread(new Runnable() { public void run() {
                String res;
                try { java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(120000);
                    InputStream in = c.getInputStream(); FileOutputStream o = new FileOutputStream(xferFile("xfer_in.json")); byte[] b = new byte[65536]; int n; long tot = 0;
                    while ((n = in.read(b)) > 0) { o.write(b, 0, n); tot += n; } o.close(); in.close(); res = "{\"size\":" + tot + "}";
                } catch (Exception e) { res = "{\"err\":" + org.json.JSONObject.quote(String.valueOf(e.getMessage())) + "}"; }
                final String js = "window.__xferGot&&window.__xferGot(" + org.json.JSONObject.quote(id) + "," + res + ")";
                runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
            } }).start();
        }

        @JavascriptInterface
        public String gInfo() {
            try { org.json.JSONObject o = new org.json.JSONObject(); o.put("pkg", getPackageName()); o.put("email", getSharedPreferences("g", MODE_PRIVATE).getString("acc", ""));
                android.content.pm.Signature[] sg = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES).signatures;
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-1"); byte[] d = md.digest(sg[0].toByteArray()); StringBuilder sb = new StringBuilder();
                for (int i = 0; i < d.length; i++) { if (i > 0) sb.append(':'); sb.append(String.format("%02X", d[i])); } o.put("sha1", sb.toString()); return o.toString();
            } catch (Exception e) { return "{}"; }
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
