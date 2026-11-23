package com.ian.foodmap;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/* 桌面小工具：本月支出、收入、今天支出，加上「支出／收入／常用」按鈕 */
public class QuickWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { Quick.updateWidgets(c); }
    @Override public void onEnabled(Context c) { Quick.updateWidgets(c); }
}
