package com.ian.foodmap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.widget.RemoteViews;

/* 快速記帳：桌面小工具、通知欄、控制中心共用的小工具 */
public class Quick {
    static final String CH = "quick"; static final int NID = 7101;

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("w", Context.MODE_PRIVATE); }

    /* 點了之後打開日日帳本，帶著要做的動作（out 支出、in 收入、tpl 常用、home 記帳頁） */
    static PendingIntent open(Context c, String act, int code) {
        Intent i = new Intent(c, MainActivity.class).setAction("com.ian.foodmap.QUICK_" + act).putExtra("quick", act)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static String get(Context c, String k, String d) {
        try { org.json.JSONObject o = new org.json.JSONObject(sp(c).getString("data", "{}")); return o.optString(k, d); } catch (Exception e) { return d; }
    }
    static int accent(Context c) { try { return Color.parseColor(get(c, "accent", "#a0562f")); } catch (Exception e) { return Color.parseColor("#a0562f"); } }

    static void updateWidgets(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, QuickWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quick);
        v.setTextViewText(R.id.w_month, get(c, "m", ""));
        v.setTextViewText(R.id.w_out, get(c, "out", "$0"));
        v.setTextViewText(R.id.w_inc, get(c, "inc", "$0"));
        v.setTextViewText(R.id.w_today, get(c, "today", "$0"));
        v.setInt(R.id.w_b_out_bg, "setColorFilter", accent(c));
        v.setOnClickPendingIntent(R.id.w_head, open(c, "home", 1));
        v.setOnClickPendingIntent(R.id.w_stats, open(c, "home", 1));
        v.setOnClickPendingIntent(R.id.w_b_out, open(c, "out", 2));
        v.setOnClickPendingIntent(R.id.w_b_in, open(c, "in", 3));
        v.setOnClickPendingIntent(R.id.w_b_tpl, open(c, "tpl", 4));
        m.updateAppWidget(ids, v);
    }

    static void postNotif(Context c) {
        if (!sp(c).getBoolean("qnotif", false)) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        NotificationChannel ch = new NotificationChannel(CH, "快速記帳", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("通知欄的快速記帳按鈕"); ch.setShowBadge(false); nm.createNotificationChannel(ch);
        Icon ic = Icon.createWithResource(c, R.drawable.ic_stat);
        Notification n = new Notification.Builder(c, CH).setSmallIcon(R.drawable.ic_stat).setColor(accent(c))
            .setContentTitle("日日帳本・快速記帳")
            .setContentText(get(c, "m", "") + " 支出 " + get(c, "out", "$0") + "・今天 " + get(c, "today", "$0"))
            .setOngoing(true).setShowWhen(false).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(open(c, "home", 11))
            .addAction(new Notification.Action.Builder(ic, "＋ 支出", open(c, "out", 12)).build())
            .addAction(new Notification.Action.Builder(ic, "＋ 收入", open(c, "in", 13)).build())
            .addAction(new Notification.Action.Builder(ic, "⭐ 常用", open(c, "tpl", 14)).build())
            .build();
        nm.notify(NID, n);
    }
    static void cancelNotif(Context c) { NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm != null) nm.cancel(NID); }
}
