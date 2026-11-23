package com.ian.foodmap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/* 開機或更新 App 後，把通知欄的快速記帳和小工具放回去 */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { try { Quick.postNotif(c); Quick.updateWidgets(c); } catch (Throwable t) { } }
}
