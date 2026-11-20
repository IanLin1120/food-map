package com.ian.foodmap;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 發票區的「協助工具讀取」：一顆可以拖曳的圓形懸浮按鈕。
 * 按一下 → 偵測畫面上的發票號碼：
 *   沒有 → 跳出「未偵測到發票號碼」
 *   明細頁 → 讀這一張
 *   列表頁 → 自動往下捲到底，讀出全部
 * 讀完跳出結果卡片：✓ 返回食光帳本／🔁 也讀取每張明細／繼續
 * 只在按按鈕時讀取，讀到的文字寫進 files/inv_inbox.json，回到食光帳本時由網頁解析。
 */
public class InvAccessService extends AccessibilityService {
    static InvAccessService me;
    static final Pattern NO = Pattern.compile("([A-Z]{2})-?(\\d{8})");
    WindowManager wm;
    TextView fab;
    WindowManager.LayoutParams fabLp;
    LinearLayout card;
    final Handler h = new Handler(Looper.getMainLooper());
    boolean ownFront = false, busy = false, autoRun = false;
    final Set<String> visited = new HashSet<>();
    int autoCount = 0, noNew = 0;
    float dp = 1;

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("inv", MODE_PRIVATE); }
    static boolean armed(Context c) { return sp(c).getBoolean("armed", false); }

    @Override
    protected void onServiceConnected() { me = this; wm = (WindowManager) getSystemService(WINDOW_SERVICE); dp = getResources().getDisplayMetrics().density; refresh(); }

    @Override
    public void onDestroy() { hideFab(); hideCard(); me = null; super.onDestroy(); }

    @Override
    public void onInterrupt() { }

    /* 只看「換成另一個 Activity」的事件；Toast、鍵盤、系統列、對話框不算，避免按鈕閃爍消失 */
    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || e.getPackageName() == null) return;
        String p = e.getPackageName().toString(), c = e.getClassName() == null ? "" : e.getClassName().toString();
        if (p.equals("com.android.systemui") || p.equals("android") || p.contains("inputmethod") || p.contains("keyboard")) return;
        if (p.equals(getPackageName())) { if (c.contains("MainActivity")) { ownFront = true; refresh(); } return; }
        if (c.startsWith("android.widget.") || c.contains("Toast") || c.contains("Dialog") || c.contains("PopupWindow")) return;
        ownFront = false; sp(this).edit().putString("fgPkg", p).apply(); refresh();
    }

    void refresh() { if (armed(this) && !ownFront) showFab(); else if (!busy) { hideFab(); hideCard(); } }

    static void rearm(Context c) { if (me != null) me.h.post(new Runnable() { public void run() { me.ownFront = false; me.refresh(); } }); }

    void vib(int ms) {
        try { Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE); if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms); } catch (Exception x) { }
    }

    GradientDrawable bg(String fill, float r) { GradientDrawable g = new GradientDrawable(); g.setColor(Color.parseColor(fill)); g.setCornerRadius(r); return g; }

    /* ---------- 圓形懸浮按鈕 ---------- */
    void showFab() {
        if (fab != null || wm == null) return;
        fab = new TextView(this); fab.setText("🧾"); fab.setTextSize(24); fab.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(Color.parseColor("#5a7a44")); g.setStroke((int) (3 * dp), Color.WHITE);
        fab.setBackground(g); fab.setElevation(10 * dp);
        int sz = (int) (60 * dp);
        fabLp = new WindowManager.LayoutParams(sz, sz, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        fabLp.gravity = Gravity.TOP | Gravity.START;
        SharedPreferences s = sp(this);
        fabLp.x = s.getInt("fx", getResources().getDisplayMetrics().widthPixels - sz - (int) (16 * dp));
        fabLp.y = s.getInt("fy", (int) (getResources().getDisplayMetrics().heightPixels * 0.62f));
        fab.setOnTouchListener(new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            public boolean onTouch(View v, MotionEvent ev) {
                switch (ev.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = ev.getRawX(); sy = ev.getRawY(); ox = fabLp.x; oy = fabLp.y; moved = false; vib(12); return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = ev.getRawX() - sx, dy = ev.getRawY() - sy;
                        if (!moved && Math.hypot(dx, dy) > 12 * dp) { moved = true; vib(20); }
                        if (moved) { fabLp.x = ox + (int) dx; fabLp.y = Math.max(0, oy + (int) dy); try { wm.updateViewLayout(fab, fabLp); } catch (Exception x) { } }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (moved) { vib(25); sp(InvAccessService.this).edit().putInt("fx", fabLp.x).putInt("fy", fabLp.y).apply(); }
                        else { vib(30); onTap(); }
                        return true;
                }
                return false;
            }
        });
        try { wm.addView(fab, fabLp); } catch (Exception x) { fab = null; }
    }

    void hideFab() { if (fab != null) { try { wm.removeView(fab); } catch (Exception x) { } fab = null; } }

    void fabText(String t) { if (fab != null) { fab.setText(t); fab.setTextSize(t.length() > 2 ? 13 : 24); } }

    /* ---------- 結果卡片 ---------- */
    void showCard(String title, String msg, String[] labels, final Runnable[] acts) {
        hideCard();
        card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); int pd = (int) (14 * dp); card.setPadding(pd, pd, pd, pd);
        card.setBackground(bg("#F7EFE5D3", 10 * dp)); card.setElevation(14 * dp);
        TextView t = new TextView(this); t.setText(title); t.setTextSize(17); t.setTypeface(null, Typeface.BOLD); t.setTextColor(Color.parseColor("#3a2c22")); card.addView(t);
        if (msg != null) { TextView m = new TextView(this); m.setText(msg); m.setTextSize(13); m.setTextColor(Color.parseColor("#6b5a48")); m.setPadding(0, (int) (6 * dp), 0, (int) (4 * dp)); card.addView(m); }
        for (int i = 0; i < labels.length; i++) {
            Button b = new Button(this); b.setText(labels[i]); b.setAllCaps(false); b.setTextSize(15);
            boolean pri = i == 0; b.setTextColor(pri ? Color.WHITE : Color.parseColor("#3a2c22")); b.setTypeface(null, pri ? Typeface.BOLD : Typeface.NORMAL);
            b.setBackground(bg(pri ? "#5a7a44" : "#e6d8bf", 6 * dp));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) (46 * dp)); lp.topMargin = (int) (8 * dp);
            final Runnable r = acts[i];
            b.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { vib(20); hideCard(); if (r != null) r.run(); } });
            card.addView(b, lp);
        }
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams((int) (300 * dp), WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.CENTER;
        try { wm.addView(card, lp); } catch (Exception x) { card = null; }
    }

    void hideCard() { if (card != null) { try { wm.removeView(card); } catch (Exception x) { } card = null; } }

    /* ---------- 讀畫面：所有看得到的文字，依位置排成一行一行（同一行用 tab 分欄） ---------- */
    static class T { String t; int x, y, h; }

    void collect(AccessibilityNodeInfo n, List<T> out, int depth) {
        if (n == null || depth > 60) return;
        try {
            if (n.isVisibleToUser()) {
                CharSequence cs = n.getText(); if (cs == null || cs.length() == 0) cs = n.getContentDescription();
                if (cs != null && cs.toString().trim().length() > 0) {
                    Rect r = new Rect(); n.getBoundsInScreen(r);
                    T t = new T(); t.t = cs.toString().replace('\n', ' ').trim(); t.x = r.left; t.y = r.centerY(); t.h = Math.max(1, r.height()); out.add(t);
                }
            }
            for (int i = 0; i < n.getChildCount(); i++) collect(n.getChild(i), out, depth + 1);
        } catch (Exception x) { }
    }

    List<String> lines() {
        List<T> L = new ArrayList<>(); collect(getRootInActiveWindow(), L, 0);
        Collections.sort(L, new Comparator<T>() { public int compare(T a, T b) { return a.y != b.y ? a.y - b.y : a.x - b.x; } });
        List<String> out = new ArrayList<>(); List<T> cur = new ArrayList<>(); int cy = 0, ch = 1;
        for (T t : L) {
            if (cur.isEmpty()) { cur.add(t); cy = t.y; ch = t.h; }
            else if (Math.abs(t.y - cy) <= Math.max(ch, t.h) * 0.45) cur.add(t);
            else { out.add(join(cur)); cur = new ArrayList<>(); cur.add(t); cy = t.y; ch = t.h; }
        }
        if (!cur.isEmpty()) out.add(join(cur));
        return out;
    }

    String join(List<T> c) {
        Collections.sort(c, new Comparator<T>() { public int compare(T a, T b) { return a.x - b.x; } });
        StringBuilder sb = new StringBuilder(); String last = null;
        for (T t : c) { if (t.t.equals(last)) continue; if (sb.length() > 0) sb.append(" \t "); sb.append(t.t); last = t.t; }
        return sb.toString();
    }

    Set<String> nos(List<String> L) { Set<String> s = new HashSet<>(); for (String l : L) { Matcher m = NO.matcher(l); while (m.find()) s.add(m.group(1) + m.group(2)); } return s; }

    boolean isDetail(List<String> L, int n) { String all = L.toString(); return n <= 2 && (all.contains("發票日期") || all.contains("消費店家") || all.contains("店家統編")); }

    void save(String mode, List<List<String>> pages) {
        try {
            File f = new File(getFilesDir(), "inv_inbox.json"); JSONArray arr = new JSONArray();
            if (f.exists()) { byte[] b = new byte[(int) f.length()]; FileInputStream in = new FileInputStream(f); in.read(b); in.close(); try { arr = new JSONArray(new String(b, "UTF-8")); } catch (Exception x) { arr = new JSONArray(); } }
            JSONObject o = new JSONObject(); o.put("mode", mode); o.put("pkg", sp(this).getString("fgPkg", "")); o.put("at", System.currentTimeMillis());
            JSONArray ps = new JSONArray(); for (List<String> p : pages) { JSONArray a = new JSONArray(); for (String s : p) a.put(s); ps.put(a); } o.put("pages", ps);
            arr.put(o); FileOutputStream out = new FileOutputStream(f); out.write(arr.toString().getBytes("UTF-8")); out.close();
            sp(this).edit().putString("lastPkg", sp(this).getString("fgPkg", "")).apply();
        } catch (Exception x) { }
    }

    final Runnable back = new Runnable() { public void run() { finishAll(); } };

    /* ---------- 按一下：偵測 → 明細讀一張／列表捲到底 ---------- */
    void onTap() {
        if (autoRun) { stopAuto(); return; }
        if (busy) return;
        hideCard();
        final List<String> L = lines(); final Set<String> s = nos(L);
        if (s.isEmpty()) {
            showCard("未偵測到發票號碼", "請打開發票明細或發票列表，再按一次 🧾", new String[]{"知道了"}, new Runnable[]{null});
            return;
        }
        if (isDetail(L, s.size())) {
            List<List<String>> P = new ArrayList<>(); P.add(L); save("detail", P); vib(40);
            showCard("✅ 已讀取 1 張發票明細", s.iterator().next(), new String[]{"✓ 返回食光帳本", "繼續讀取其他發票"}, new Runnable[]{back, null});
            return;
        }
        scrollAll();
    }

    AccessibilityNodeInfo scroller(AccessibilityNodeInfo n, int depth) {
        if (n == null || depth > 60) return null; AccessibilityNodeInfo best = null; int area = 0;
        try {
            if (n.isScrollable()) { Rect r = new Rect(); n.getBoundsInScreen(r); area = r.width() * r.height(); best = n; }
            for (int i = 0; i < n.getChildCount(); i++) {
                AccessibilityNodeInfo c = scroller(n.getChild(i), depth + 1);
                if (c != null) { Rect r = new Rect(); c.getBoundsInScreen(r); int a = r.width() * r.height(); if (a > area) { area = a; best = c; } }
            }
        } catch (Exception x) { }
        return best;
    }

    /* 列表：一路往下捲，每捲一次讀一次，直到捲不動或畫面不再變化 */
    void scrollAll() {
        busy = true; fabText("讀取中");
        final List<List<String>> pages = new ArrayList<>(); final Set<String> all = new HashSet<>();
        final Runnable[] step = new Runnable[1];
        step[0] = new Runnable() {
            int i = 0, same = 0; String last = "";
            public void run() {
                List<String> L = lines(); String sig = L.toString();
                if (!sig.equals(last)) { pages.add(L); all.addAll(nos(L)); same = 0; } else same++;
                last = sig; fabText(all.size() + "張");
                AccessibilityNodeInfo sc = scroller(getRootInActiveWindow(), 0);
                boolean ok = sc != null && sc.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
                if (ok && same < 2 && i++ < 80) { h.postDelayed(step[0], 650); return; }
                save("list", pages); busy = false; fabText("🧾"); vib(60);
                showCard("✅ 讀到 " + all.size() + " 張發票", "列表只有日期、店家和金額；要品項的話可以讓它自動一張一張打開明細讀取",
                        new String[]{"✓ 返回食光帳本", "🔁 也讀取每張明細", "繼續"}, new Runnable[]{back, new Runnable() { public void run() { startAuto(); } }, null});
            }
        };
        h.post(step[0]);
    }

    /* ---------- 自動讀取每張明細：先捲回最上面，再一張一張點開 → 讀 → 返回 ---------- */
    void startAuto() {
        autoRun = true; busy = true; visited.clear(); autoCount = 0; noNew = 0; fabText("⏹");
        final Runnable[] up = new Runnable[1];
        up[0] = new Runnable() { int i = 0; public void run() {
            AccessibilityNodeInfo sc = scroller(getRootInActiveWindow(), 0);
            if (sc != null && sc.performAction(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) && i++ < 80) h.postDelayed(up[0], 350); else h.postDelayed(autoStep, 500);
        } };
        h.post(up[0]);
    }

    void stopAuto() { autoRun = false; busy = false; h.removeCallbacks(autoStep); fabText("🧾"); vib(40); doneCard("⏹ 已停止"); }

    void doneCard(String head) { showCard(head + "，共讀 " + autoCount + " 張明細", null, new String[]{"✓ 返回食光帳本", "繼續"}, new Runnable[]{back, null}); }

    AccessibilityNodeInfo findNo(AccessibilityNodeInfo n, int depth) {
        if (n == null || depth > 60) return null;
        try {
            CharSequence cs = n.getText();
            if (cs != null && n.isVisibleToUser()) { Matcher m = NO.matcher(cs.toString()); if (m.find() && !visited.contains(m.group(1) + m.group(2))) { visited.add(m.group(1) + m.group(2)); return n; } }
            for (int i = 0; i < n.getChildCount(); i++) { AccessibilityNodeInfo c = findNo(n.getChild(i), depth + 1); if (c != null) return c; }
        } catch (Exception x) { }
        return null;
    }

    final Runnable autoStep = new Runnable() {
        public void run() {
            if (!autoRun) return;
            if (autoCount >= 300) { autoRun = false; busy = false; fabText("🧾"); doneCard("已達 300 張上限"); return; }
            AccessibilityNodeInfo n = findNo(getRootInActiveWindow(), 0);
            if (n != null) {
                AccessibilityNodeInfo c = n; int up = 0; while (c != null && !c.isClickable() && up++ < 8) c = c.getParent();
                if (c == null || !c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { h.postDelayed(this, 150); return; }
                noNew = 0;
                h.postDelayed(new Runnable() {
                    public void run() {
                        if (!autoRun) return;
                        List<List<String>> P = new ArrayList<>(); P.add(lines()); save("detail", P); autoCount++; fabText(autoCount + "張");
                        performGlobalAction(GLOBAL_ACTION_BACK);
                        h.postDelayed(autoStep, 1100);
                    }
                }, 1500);
                return;
            }
            AccessibilityNodeInfo sc = scroller(getRootInActiveWindow(), 0);
            if (sc != null && sc.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) && noNew++ < 3) { h.postDelayed(this, 800); return; }
            autoRun = false; busy = false; fabText("🧾"); vib(60); doneCard("✅ 全部讀完");
        }
    };

    void finishAll() {
        autoRun = false; busy = false; h.removeCallbacks(autoStep); sp(this).edit().putBoolean("armed", false).apply(); hideFab(); hideCard();
        Intent i = new Intent(this, MainActivity.class); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { startActivity(i); } catch (Exception x) { }
    }

    /* ---------- 給 MainActivity 用 ---------- */
    static String takeInbox(Context c) {
        try {
            File f = new File(c.getFilesDir(), "inv_inbox.json"); if (!f.exists()) return "";
            byte[] b = new byte[(int) f.length()]; FileInputStream in = new FileInputStream(f); in.read(b); in.close(); f.delete(); return new String(b, "UTF-8");
        } catch (Exception x) { return ""; }
    }
}
