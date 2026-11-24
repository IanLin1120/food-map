package com.ian.foodmap;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

/* 防誤刪：啟用「裝置管理員」後，系統不允許直接解除安裝，必須先到設定把它停用。
   要停用時會先把手機鎖起來，必須輸入手機的解鎖密碼／指紋才能繼續。 */
public class Guard extends DeviceAdminReceiver {
    static ComponentName cn(Context c) { return new ComponentName(c, Guard.class); }
    static boolean on(Context c) { DevicePolicyManager d = (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE); return d != null && d.isAdminActive(cn(c)); }
    static void off(Context c) { DevicePolicyManager d = (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE); if (d != null && d.isAdminActive(cn(c))) d.removeActiveAdmin(cn(c)); }
    static Intent ask(Context c) {
        Intent i = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, cn(c));
        i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "開啟後，日日帳本不能被直接解除安裝；要刪除時必須先停用這個保護，並輸入手機的解鎖密碼確認，避免不小心刪掉而遺失帳本資料。");
        return i;
    }
    @Override public CharSequence onDisableRequested(Context c, Intent intent) {
        try { DevicePolicyManager d = (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE); if (d != null) d.lockNow(); } catch (Exception e) {}
        return "停用後日日帳本就可以被解除安裝，帳本資料會一起刪除。確定不是誤按嗎？建議先到「設定 → 備份」備份資料。";
    }
    @Override public void onEnabled(Context c, Intent intent) { MainActivity.emit("guard", "{\"on\":true}"); }
    @Override public void onDisabled(Context c, Intent intent) { MainActivity.emit("guard", "{\"on\":false}"); }
}
