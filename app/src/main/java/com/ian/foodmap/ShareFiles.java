package com.ian.foodmap;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/* 分享暫存檔給其他 App（例如把菜單照片傳給 Claude App）：只開放 cache/share 資料夾裡的檔案，唯讀 */
public class ShareFiles extends ContentProvider {
    static String auth(android.content.Context c) { return c.getPackageName() + ".share"; }
    static File dir(android.content.Context c) { File d = new File(c.getCacheDir(), "share"); d.mkdirs(); return d; }
    static Uri uri(android.content.Context c, File f) { return Uri.parse("content://" + auth(c) + "/" + Uri.encode(f.getName())); }
    private File fileOf(Uri u) throws FileNotFoundException {
        String n = u.getLastPathSegment(); if (n == null || n.contains("/") || n.contains("..")) throw new FileNotFoundException();
        File f = new File(dir(getContext()), n); if (!f.exists()) throw new FileNotFoundException(); return f;
    }
    @Override public boolean onCreate() { return true; }
    @Override public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException { return ParcelFileDescriptor.open(fileOf(u), ParcelFileDescriptor.MODE_READ_ONLY); }
    @Override public String getType(Uri u) { String n = String.valueOf(u.getLastPathSegment()).toLowerCase(); return n.endsWith(".png") ? "image/png" : n.endsWith(".webp") ? "image/webp" : "image/jpeg"; }
    @Override public Cursor query(Uri u, String[] proj, String sel, String[] args, String sort) {
        try { File f = fileOf(u); MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}); c.addRow(new Object[]{f.getName(), f.length()}); return c; } catch (Exception e) { return null; }
    }
    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
