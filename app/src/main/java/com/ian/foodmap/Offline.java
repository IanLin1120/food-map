package com.ian.foodmap;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.zip.GZIPInputStream;

/**
 * 離線地圖：下載行跡導航 GitHub（IanLin1120/xingji-roaddata，Releases「data」）上的向量圖磚資料包，
 * 邊下載邊解壓，存成 v_<key>.bin（圖磚本體）＋ v_<key>.idx（索引），再由 MainActivity 以 https://app.local/vt/z/x/y 提供給地圖。
 * 資料包格式（gzip 內）：[z:1][x:4][y:4][len:4][pbf] 重複。
 * 另外快取地圖字型與圖示（c_<sha1>），以 https://app.local/oc?u=<原網址> 提供。
 */
final class Offline {
    static final String PACK_SRC = "https://github.com/IanLin1120/xingji-roaddata/releases/download/";
    static final String RES_SRC = "https://tiles.openfreemap.org/";
    private static final Object LOCK = new Object();
    private static HashMap<Long, long[]> index;
    private static ArrayList<File> packFiles;
    private static HashMap<String, Integer> packNo;
    static volatile boolean cancel;

    static File dir(Context c) {
        File d = new File(c.getFilesDir(), "offmap");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static long key(int z, int x, int y) {
        return ((long) z << 56) | ((long) x << 28) | (long) y;
    }

    private static void load(Context c) {
        synchronized (LOCK) {
            if (index != null) return;
            index = new HashMap<Long, long[]>();
            packFiles = new ArrayList<File>();
            packNo = new HashMap<String, Integer>();
            File[] fs = dir(c).listFiles();
            if (fs == null) return;
            for (File f : fs) {
                String n = f.getName();
                if (n.startsWith("v_") && n.endsWith(".idx")) addIdx(c, n.substring(2, n.length() - 4));
            }
        }
    }

    private static void addIdx(Context c, String k) {
        File idx = new File(dir(c), "v_" + k + ".idx"), bin = new File(dir(c), "v_" + k + ".bin");
        if (!idx.exists() || !bin.exists()) return;
        int no = packFiles.size();
        packFiles.add(bin);
        packNo.put(k, no);
        DataInputStream in = null;
        try {
            in = new DataInputStream(new BufferedInputStream(new FileInputStream(idx), 65536));
            while (true) {
                int z = in.readUnsignedByte();
                int x = in.readInt(), y = in.readInt();
                long off = in.readLong();
                int len = in.readInt();
                index.put(key(z, x, y), new long[]{no, off, len});
            }
        } catch (EOFException e) {
            /* 讀完 */
        } catch (Exception e) {
            /* 索引壞掉就略過這一包 */
        } finally {
            try { if (in != null) in.close(); } catch (Exception e) { }
        }
    }

    /** 取出一片圖磚；沒有下載過就回傳 null */
    static byte[] tile(Context c, int z, int x, int y) {
        long[] e;
        File f;
        synchronized (LOCK) {
            load(c);
            e = index.get(key(z, x, y));
            if (e == null) return null;
            f = packFiles.get((int) e[0]);
        }
        RandomAccessFile raf = null;
        try {
            raf = new RandomAccessFile(f, "r");
            byte[] b = new byte[(int) e[2]];
            raf.seek(e[1]);
            raf.readFully(b);
            return b;
        } catch (Exception ex) {
            return null;
        } finally {
            try { if (raf != null) raf.close(); } catch (Exception ex) { }
        }
    }

    private static void report(String id, String s, long a, long b, String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("id", id).put("s", s).put("a", a).put("b", b).put("msg", msg == null ? "" : msg);
            MainActivity.emit("off", o.toString());
        } catch (Throwable t) { }
    }

    private static final class Counting extends FilterInputStream {
        long n;
        Counting(InputStream in) { super(in); }
        @Override public int read() throws IOException { int r = in.read(); if (r >= 0) n++; return r; }
        @Override public int read(byte[] b, int o, int l) throws IOException { int r = in.read(b, o, l); if (r > 0) n += r; return r; }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "FoodMap-Android");
        c.setRequestProperty("Accept-Encoding", "identity");
        int code = c.getResponseCode();
        if (code != 200) { c.disconnect(); throw new Exception("HTTP " + code); }
        return c;
    }

    /** 下載並解開一個圖磚資料包 */
    static void packGet(final Context ctx, final String id, final String url, final String k) {
        cancel = false;
        new Thread(new Runnable() {
            @Override public void run() {
                File tb = new File(dir(ctx), "v_" + k + ".bin.tmp"), ti = new File(dir(ctx), "v_" + k + ".idx.tmp");
                HttpURLConnection c = null;
                BufferedOutputStream bout = null;
                DataOutputStream iout = null;
                try {
                    if (url == null || !url.startsWith(PACK_SRC) || k == null || !k.matches("[A-Za-z0-9_]{1,24}")) throw new Exception("不是行跡導航的地圖資料");
                    c = open(url);
                    long total = c.getContentLength();
                    Counting cin = new Counting(c.getInputStream());
                    DataInputStream din = new DataInputStream(new BufferedInputStream(new GZIPInputStream(cin, 65536), 65536));
                    bout = new BufferedOutputStream(new FileOutputStream(tb), 1 << 16);
                    iout = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(ti), 1 << 15));
                    byte[] buf = new byte[1 << 16];
                    long off = 0, last = 0;
                    int n = 0;
                    while (true) {
                        int z = din.read();
                        if (z < 0) break;
                        int x = din.readInt(), y = din.readInt(), len = din.readInt();
                        if (len < 0 || len > 64000000) throw new Exception("資料包格式不正確");
                        int left = len;
                        while (left > 0) {
                            int r = din.read(buf, 0, Math.min(left, buf.length));
                            if (r < 0) throw new EOFException("資料包不完整");
                            bout.write(buf, 0, r);
                            left -= r;
                        }
                        iout.writeByte(z); iout.writeInt(x); iout.writeInt(y); iout.writeLong(off); iout.writeInt(len);
                        off += len;
                        n++;
                        if (cancel) throw new Exception("已停止下載");
                        long now = System.currentTimeMillis();
                        if (now - last > 400) { last = now; report(id, "prog", cin.n, total, null); }
                    }
                    bout.close(); bout = null;
                    iout.close(); iout = null;
                    File fb = new File(dir(ctx), "v_" + k + ".bin"), fi = new File(dir(ctx), "v_" + k + ".idx");
                    synchronized (LOCK) {
                        fb.delete(); fi.delete();
                        if (!tb.renameTo(fb) || !ti.renameTo(fi)) throw new Exception("無法寫入手機儲存空間");
                        index = null;   /* 下次讀圖磚時重新建立索引 */
                    }
                    report(id, "done", n, off, null);
                } catch (Throwable t) {
                    try { if (bout != null) bout.close(); } catch (Exception e) { }
                    try { if (iout != null) iout.close(); } catch (Exception e) { }
                    tb.delete(); ti.delete();
                    String m = t.getMessage();
                    report(id, "err", 0, 0, m == null || m.isEmpty() ? "下載失敗" : (t instanceof java.net.UnknownHostException || t instanceof java.net.SocketTimeoutException ? "網路連線失敗" : m));
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    private static String sha1(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /** 快取一個地圖字型／圖示檔 */
    static void cacheGet(final Context ctx, final String id, final String url) {
        new Thread(new Runnable() {
            @Override public void run() {
                HttpURLConnection c = null;
                File tmp = null;
                try {
                    if (url == null || !url.startsWith(RES_SRC)) throw new Exception("不是地圖資源");
                    File f = new File(dir(ctx), "c_" + sha1(url));
                    tmp = new File(dir(ctx), f.getName() + ".tmp" + Thread.currentThread().getId());
                    c = open(url);
                    InputStream in = c.getInputStream();
                    FileOutputStream out = new FileOutputStream(tmp);
                    byte[] buf = new byte[32768];
                    int r;
                    long n = 0;
                    while ((r = in.read(buf)) > 0) { out.write(buf, 0, r); n += r; }
                    out.close();
                    in.close();
                    f.delete();
                    if (!tmp.renameTo(f)) throw new Exception("無法寫入手機儲存空間");
                    report(id, "done", n, n, null);
                } catch (Throwable t) {
                    if (tmp != null) tmp.delete();
                    report(id, "err", 0, 0, t.getMessage());
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    static File cached(Context ctx, String url) {
        try {
            if (url == null) return null;
            File f = new File(dir(ctx), "c_" + sha1(url));
            return f.exists() ? f : null;
        } catch (Exception e) {
            return null;
        }
    }

    static String list(Context ctx) {
        try {
            JSONArray a = new JSONArray();
            File[] fs = dir(ctx).listFiles();
            if (fs != null) for (File f : fs) {
                String n = f.getName();
                if (!n.startsWith("v_") || !n.endsWith(".idx")) continue;
                String k = n.substring(2, n.length() - 4);
                File bin = new File(dir(ctx), "v_" + k + ".bin");
                if (!bin.exists()) continue;
                a.put(new JSONObject().put("k", k).put("size", bin.length()).put("n", f.length() / 21));
            }
            return new JSONObject().put("packs", a).toString();
        } catch (Exception e) {
            return "{\"packs\":[]}";
        }
    }

    static void deleteAll(Context ctx) {
        cancel = true;
        synchronized (LOCK) {
            File[] fs = dir(ctx).listFiles();
            if (fs != null) for (File f : fs) f.delete();
            index = null;
        }
    }
}
