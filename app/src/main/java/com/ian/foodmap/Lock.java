package com.ian.foodmap;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.CancellationSignal;
import android.util.Base64;

import org.json.JSONObject;

import java.security.SecureRandom;

/**
 * 記帳・對帳的上鎖：數字密碼（6～16 碼，只存加鹽的 PBKDF2 雜湊，不存密碼本身）＋指紋／臉部解鎖。
 * 跟 Terra 瀏覽器同一套做法：
 *  - 解鎖一次後，直到 App 被關掉（從最近使用劃掉、行程結束）或螢幕關閉前都不用再輸入
 *  - 連續輸錯 5 次起要等待（30 秒起跳、每多錯一次加倍，最多 1 小時），防止有人一直猜
 *  - 改密碼要先輸入舊密碼；移除密碼要輸入密碼
 */
final class Lock {
    private Lock() { }

    static volatile boolean session = false;

    private static SharedPreferences p(Context c) { return c.getSharedPreferences("acc_lock", Context.MODE_PRIVATE); }

    static boolean has(Context c) { return p(c).contains("hash"); }

    private static String hash(String pin, byte[] salt, int it) throws Exception {
        javax.crypto.SecretKeyFactory f;
        try { f = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256"); }
        catch (Throwable t) { f = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1"); }
        byte[] h = f.generateSecret(new javax.crypto.spec.PBEKeySpec(pin.toCharArray(), salt, it, 256)).getEncoded();
        return Base64.encodeToString(h, Base64.NO_WRAP);
    }

    private static boolean verify(Context c, String pin) {
        try {
            SharedPreferences s = p(c);
            byte[] salt = Base64.decode(s.getString("salt", ""), Base64.NO_WRAP);
            String want = s.getString("hash", "");
            String got = hash(pin == null ? "" : pin, salt, s.getInt("iter", 60000));
            return java.security.MessageDigest.isEqual(want.getBytes("UTF-8"), got.getBytes("UTF-8"));
        } catch (Throwable t) { return false; }
    }

    private static void fail(Context c) { int f = p(c).getInt("fails", 0) + 1; p(c).edit().putInt("fails", f).putLong("failAt", System.currentTimeMillis()).apply(); }

    /** 設定新密碼；已經有密碼時要先給正確的舊密碼 */
    static String set(Context c, String oldPin, String pin) {
        try {
            if (pin == null || !pin.matches("\\d{6,16}")) return "密碼要 6～16 位數字";
            if (has(c) && waitMs(c) > 0) return "輸錯太多次，請稍後再試";
            if (has(c) && !verify(c, oldPin)) { fail(c); return "舊密碼不正確"; }
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            p(c).edit().putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP)).putString("hash", hash(pin, salt, 60000)).putInt("iter", 60000)
                .putInt("fails", 0).putInt("len", pin.length()).apply();
            session = true;
            return "";
        } catch (Throwable t) { return "設定失敗：" + t.getMessage(); }
    }

    /** 密碼長度：輸入到這個長度就自動確認 */
    static int len(Context c) { return p(c).getInt("len", 0); }

    static String clear(Context c, String pin) {
        if (waitMs(c) > 0) return "輸錯太多次，請稍後再試";
        if (!verify(c, pin)) { fail(c); return "密碼錯誤"; }
        p(c).edit().remove("salt").remove("hash").remove("len").putInt("fails", 0).apply();
        session = false;
        return "";
    }

    static long waitMs(Context c) {
        int f = p(c).getInt("fails", 0);
        if (f < 5) return 0;
        long w = Math.min(3600000L, 30000L << Math.min(7, f - 5));
        return Math.max(0, p(c).getLong("failAt", 0) + w - System.currentTimeMillis());
    }

    static JSONObject check(Context c, String pin) {
        JSONObject o = new JSONObject();
        try {
            long w = waitMs(c);
            if (w > 0) return o.put("ok", false).put("fails", p(c).getInt("fails", 0)).put("wait", w);
            if (verify(c, pin)) { session = true; p(c).edit().putInt("fails", 0).apply(); return o.put("ok", true); }
            fail(c);
            o.put("ok", false).put("fails", p(c).getInt("fails", 0));
            long w2 = waitMs(c);
            if (w2 > 0) o.put("wait", w2);
        } catch (Throwable t) { /* ignore */ }
        return o;
    }

    /* ---------- 指紋／臉部解鎖 ---------- */
    static boolean bioAvailable(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                android.hardware.biometrics.BiometricManager bm = c.getSystemService(android.hardware.biometrics.BiometricManager.class);
                return bm.canAuthenticate(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG | android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK) == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS;
            }
            if (Build.VERSION.SDK_INT >= 29) {
                android.hardware.biometrics.BiometricManager bm = c.getSystemService(android.hardware.biometrics.BiometricManager.class);
                return bm.canAuthenticate() == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS;
            }
            return Build.VERSION.SDK_INT >= 28 && c.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_FINGERPRINT);
        } catch (Throwable t) { return false; }
    }

    static void bio(final MainActivity a, String title) {
        if (Build.VERSION.SDK_INT < 28) { emitBio(false, "這支手機不支援"); return; }
        try {
            android.hardware.biometrics.BiometricPrompt.Builder b = new android.hardware.biometrics.BiometricPrompt.Builder(a)
                .setTitle(title == null || title.isEmpty() ? "解鎖記帳" : title)
                .setSubtitle("使用指紋或臉部解鎖")
                .setNegativeButton("改用密碼", a.getMainExecutor(), new android.content.DialogInterface.OnClickListener() {
                    @Override public void onClick(android.content.DialogInterface d, int w) { emitBio(false, "cancel"); }
                });
            if (Build.VERSION.SDK_INT >= 30) b.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_STRONG | android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK);
            b.build().authenticate(new CancellationSignal(), a.getMainExecutor(), new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) { session = true; p(a).edit().putInt("fails", 0).apply(); emitBio(true, ""); }
                @Override public void onAuthenticationError(int code, CharSequence msg) { emitBio(false, String.valueOf(msg)); }
            });
        } catch (Throwable t) { emitBio(false, String.valueOf(t.getMessage())); }
    }

    private static void emitBio(boolean ok, String msg) {
        try { MainActivity.emit("lock", new JSONObject().put("bio", true).put("ok", ok).put("msg", msg).toString()); } catch (Throwable t) { /* ignore */ }
    }
}
