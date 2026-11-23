package com.ian.foodmap;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/* 控制中心的「記一筆」按鈕 */
public class QuickTile extends TileService {
    @Override public void onStartListening() {
        Tile t = getQsTile(); if (t == null) return;
        t.setLabel("記一筆"); t.setState(Tile.STATE_INACTIVE);
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle("日日帳本");
        t.updateTile();
    }
    @SuppressWarnings("deprecation")
    @Override public void onClick() {
        Intent i = new Intent(this, MainActivity.class).setAction("com.ian.foodmap.QUICK_out").putExtra("quick", "out").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 21, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        else startActivityAndCollapse(i);
    }
}
