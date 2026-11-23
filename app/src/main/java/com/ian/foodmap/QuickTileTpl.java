package com.ian.foodmap;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/* 控制中心的「常用記帳」按鈕：打開常用紀錄，點一下就記好 */
public class QuickTileTpl extends TileService {
    @Override public void onStartListening() {
        Tile t = getQsTile(); if (t == null) return;
        t.setLabel("常用記帳"); t.setState(Tile.STATE_INACTIVE);
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle("日日帳本");
        t.updateTile();
    }
    @SuppressWarnings("deprecation")
    @Override public void onClick() {
        Intent i = new Intent(this, MainActivity.class).setAction("com.ian.foodmap.QUICK_tpl").putExtra("quick", "tpl").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 22, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        else startActivityAndCollapse(i);
    }
}
