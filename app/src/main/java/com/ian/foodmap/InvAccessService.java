package com.ian.foodmap;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 發票區的「協助工具讀取」：
 * 使用者在食光帳本按「開始」後（armed），切到發票 App 時畫面上會出現小面板：
 *   📥 讀取這頁   ⏬ 捲動讀取列表   🔁 自動讀取全部明細   ✓ 完成
 * 讀到的文字（依畫面位置排成一行一行）寫進 files/inv_inbox.json，回到食光帳本時由網頁解析成發票。
 * 只在使用者按按鈕時讀取，不在背景收集。
 */
public class InvAccessService extends AccessibilityService {
    static InvAccessService me;
    static final Pattern NO = Pattern.compile("([A-Z]{2})-?(\\d{8})");
    WindowManager wm;
    LinearLayout panel;
    TextView state;
    final Handler h = new Handler(Looper.getMainLooper());
    String fgPkg = "";
    boolean autoRun = false;
    final Set<String> visited = new HashSet<>();
    int autoCount = 0, noNew = 0;

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("inv", MODE_PRIVATE); }
    static boolean armed(Context c) { return sp(c).getBoolean("armed", false); }

    @Override
    protected void onServiceConnected() { me = this; wm = (WindowManager) getSystemService(WINDOW_SERVICE); refresh(); }

    @Override
    public void onDestroy() { hidePanel(); me = null; super.onDestroy(); }

    @Override
    public void onInterrupt() { }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && e.getPackageName() != null) {
            String p = e.getPackageName().toString();
            if (!p.equals("com.android.systemui")) { fgPkg = p; refresh(); }
        }
    }

    /** 只有「已開始」而且前景不是食光帳本自己時才顯示面板 */
    void refresh() {
        boolean show = armed(this) && !getPackageName().equals(fgPkg) && !fgPkg.isEmpty();
        if (show) showPanel(); else if (!autoRun) hidePanel();
    }

    static void rearm(Context c) { if (me != null) me.h.post(new Runnable() { public void run() { me.refresh(); } }); }

    GradientDrawable bg(String fill, float dp) { GradientDrawable g = new GradientDrawable(); g.setColor(Color.parseColor(fill)); g.setCornerRadius(6 * dp); return g; }

    Button btn(String t, String fill, String fg, float dp) {
        Button b = new Button(this); b.setText(t); b.setAllCaps(false); b.setTextSize(13); b.setTextColor(Color.parseColor(fg));
        b.setBackground(bg(fill, dp)); b.setPadding((int) (10 * dp), 0, (int) (10 * dp), 0); b.setMinWidth(0); b.setMinimumWidth(0);
        return b;
    }

    void showPanel() {
        if (panel != null || wm == null) return;
        final float dp = getResources().getDisplayMetrics().density;
        panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackground(bg("#F2EFE5D3", dp)); int pd = (int) (8 * dp); panel.setPadding(pd, pd, pd, pd); panel.setElevation(12 * dp);
        state = new TextView(this); state.setText("🧾 食光帳本・發票讀取（按住這行可以拖曳）"); state.setTextColor(Color.parseColor("#3a2c22")); state.setTextSize(12);
        state.setPadding(0, 0, 0, (int) (6 * dp));
        LinearLayout r1 = new LinearLayout(this), r2 = new LinearLayout(this);
        Button bRead = btn("📥 讀取這頁", "#5a7a44", "#ffffff", dp), bScroll = btn("⏬ 捲動讀取列表", "#e6d8bf", "#3a2c22", dp);
        Button bAuto = btn("🔁 自動讀取全部明細", "#c2633a", "#ffffff", dp), bDone = btn("✓ 完成", "#e6d8bf", "#3a2c22", dp);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, (int) (40 * dp), 1f); lp.setMargins((int) (3 * dp), (int) (3 * dp), (int) (3 * dp), (int) (3 * dp));
        r1.addView(bRead, lp); r1.addView(bScroll, new LinearLayout.LayoutParams(lp)); r2.addView(bAuto, new LinearLayout.LayoutParams(lp)); r2.addView(bDone, new LinearLayout.LayoutParams(lp));
        panel.addView(state); panel.addView(r1); panel.addView(r2);
        final WindowManager.LayoutParams wp = new WindowManager.LayoutParams((int) (330 * dp), WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        wp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL; wp.y = (int) (90 * dp);
        state.setOnTouchListener(new View.OnTouchListener() {
            float sy; int oy;
            public boolean onTouch(View v, MotionEvent ev) {
                if (ev.getAction() == MotionEvent.ACTION_DOWN) { sy = ev.getRawY(); oy = wp.y; return true; }
                if (ev.getAction() == MotionEvent.ACTION_MOVE) { wp.y = Math.max(0, oy - (int) (ev.getRawY() - sy)); try { wm.updateViewLayout(panel, wp); } catch (Exception x) { } return true; }
                return false;
            }
        });
        bRead.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { readOnce(); } });
        bScroll.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { scrollRead(); } });
        bAuto.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { if (autoRun) stopAuto("已停止"); else startAuto(); } });
        bDone.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finishAll(); } });
        try { wm.addView(panel, wp); } catch (Exception x) { panel = null; }
    }

    void hidePanel() { if (panel != null) { try { wm.removeView(panel); } catch (Exception x) { } panel = null; } }

    void say(String t) { if (state != null) state.setText(t); }

    /* ---------- 讀畫面：所有看得到的文字，依位置排成一行一行 ---------- */
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
            for (int i = 0; i < n.getChildCount(); i++) { AccessibilityNodeInfo c = n.getChild(i); collect(c, out, depth + 1); }
        } catch (Exception x) { }
    }

    List<String> lines() {
        List<T> L = new ArrayList<>(); AccessibilityNodeInfo root = getRootInActiveWindow(); collect(root, L, 0);
        Collections.sort(L, new java.util.Comparator<T>() { public int compare(T a, T b) { return a.y != b.y ? a.y - b.y : a.x - b.x; } });
        List<String> out = new ArrayList<>(); List<T> cur = new ArrayList<>(); int cy = -9999, ch = 1;
        for (T t : L) {
            if (cur.isEmpty() || Math.abs(t.y - cy) <= Math.max(ch, t.h) * 0.45) { cur.add(t); if (cur.size() == 1) { cy = t.y; ch = t.h; } }
            else { out.add(join(cur)); cur = new ArrayList<>(); cur.add(t); cy = t.y; ch = t.h; }
        }
        if (!cur.isEmpty()) out.add(join(cur));
        return out;
    }

    String join(List<T> c) {
        Collections.sort(c, new java.util.Comparator<T>() { public int compare(T a, T b) { return a.x - b.x; } }); StringBuilder sb = new StringBuilder(); String last = null;
        for (T t : c) { if (t.t.equals(last)) continue; if (sb.length() > 0) sb.append(" \t "); sb.append(t.t); last = t.t; }
        return sb.toString();
    }

    void save(String mode, List<List<String>> pages) {
        try {
            File f = new File(getFilesDir(), "inv_inbox.json"); JSONArray arr = new JSONArray();
            if (f.exists()) { byte[] b = new byte[(int) f.length()]; FileInputStream in = new FileInputStream(f); in.read(b); in.close(); try { arr = new JSONArray(new String(b, "UTF-8")); } catch (Exception x) { arr = new JSONArray(); } }
            JSONObject o = new JSONObject(); o.put("mode", mode); o.put("pkg", fgPkg); o.put("at", System.currentTimeMillis());
            JSONArray ps = new JSONArray(); for (List<String> p : pages) { JSONArray a = new JSONArray(); for (String s : p) a.put(s); ps.put(a); } o.put("pages", ps);
            arr.put(o); FileOutputStream out = new FileOutputStream(f); out.write(arr.toString().getBytes("UTF-8")); out.close();
        } catch (Exception x) { }
    }

    void readOnce() {
        List<String> L = lines(); List<List<String>> P = new ArrayList<>(); P.add(L); save("page", P);
        int n = countNos(L); say("✅ 已讀取這頁（" + (n > 0 ? "看到 " + n + " 張發票" : "沒看到發票號碼") + "）"); toast("已讀取，回到食光帳本就會出現");
    }

    int countNos(List<String> L) { Set<String> s = new HashSet<>(); for (String l : L) { Matcher m = NO.matcher(l); while (m.find()) s.add(m.group(1) + m.group(2)); } return s.size(); }

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

    /* 列表：一路往下捲，每捲一次讀一次，直到捲不動 */
    void scrollRead() {
        final List<List<String>> pages = new ArrayList<>(); say("⏬ 捲動讀取中…");
        final Runnable[] step = new Runnable[1];
        step[0] = new Runnable() {
            int i = 0; String last = "";
            public void run() {
                List<String> L = lines(); String sig = L.toString();
                if (!sig.equals(last)) pages.add(L); last = sig;
                AccessibilityNodeInfo sc = scroller(getRootInActiveWindow(), 0);
                boolean ok = sc != null && sc.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
                if (ok && i++ < 60) { say("⏬ 捲動讀取中…第 " + pages.size() + " 頁"); h.postDelayed(step[0], 700); }
                else { save("scroll", pages); int n = 0; for (List<String> p : pages) n += countNos(p); say("✅ 列表讀完（約 " + n + " 筆）"); toast("列表已讀取，回到食光帳本就會出現"); }
            }
        };
        h.post(step[0]);
    }

    /* ---------- 自動讀取全部明細：點開列表上的每一張發票 → 讀 → 返回 → 下一張 ---------- */
    void startAuto() { autoRun = true; visited.clear(); autoCount = 0; noNew = 0; say("🔁 自動讀取中…（再按一次停止）"); h.postDelayed(autoStep, 400); }

    void stopAuto(String why) { autoRun = false; h.removeCallbacks(autoStep); say("⏹ " + why + "，共讀 " + autoCount + " 張明細"); refresh(); }

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
            if (autoCount >= 300) { stopAuto("已達 300 張上限"); return; }
            AccessibilityNodeInfo n = findNo(getRootInActiveWindow(), 0);
            if (n != null) {
                AccessibilityNodeInfo c = n; int up = 0; while (c != null && !c.isClickable() && up++ < 8) c = c.getParent();
                if (c == null || !c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) { h.postDelayed(this, 200); return; }
                noNew = 0;
                h.postDelayed(new Runnable() {
                    public void run() {
                        if (!autoRun) return;
                        List<List<String>> P = new ArrayList<>(); P.add(lines()); save("detail", P); autoCount++;
                        say("🔁 自動讀取中…已讀 " + autoCount + " 張（再按一次停止）");
                        performGlobalAction(GLOBAL_ACTION_BACK);
                        h.postDelayed(autoStep, 1100);
                    }
                }, 1500);
                return;
            }
            AccessibilityNodeInfo sc = scroller(getRootInActiveWindow(), 0);
            if (sc != null && sc.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) && noNew++ < 3) { h.postDelayed(this, 800); return; }
            stopAuto("全部讀完");
            toast("明細已讀取完成，回到食光帳本就會出現");
        }
    };

    void finishAll() {
        autoRun = false; h.removeCallbacks(autoStep); sp(this).edit().putBoolean("armed", false).apply(); hidePanel();
        Intent i = new Intent(this, MainActivity.class); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try { startActivity(i); } catch (Exception x) { }
    }

    void toast(String t) { try { Toast.makeText(this, t, Toast.LENGTH_SHORT).show(); } catch (Exception x) { } }

    /* ---------- 給 MainActivity 用 ---------- */
    static String takeInbox(Context c) {
        try {
            File f = new File(c.getFilesDir(), "inv_inbox.json"); if (!f.exists()) return "";
            byte[] b = new byte[(int) f.length()]; FileInputStream in = new FileInputStream(f); in.read(b); in.close(); f.delete(); return new String(b, "UTF-8");
        } catch (Exception x) { return ""; }
    }
}
