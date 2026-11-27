package com.kebabschoice.pos;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * PaymentAutoConfirm — Jembatan Capacitor antara PaymentNotificationListener
 * (NotificationListenerService Android), diagnostik notifikasi, serta pengecekan versi aplikasi (.apk).
 *
 * Event ke JS: "paymentNotificationReceived" -> { packageName, title, text, amount, timestamp }
 */
@CapacitorPlugin(name = "PaymentAutoConfirm")
public class PaymentAutoConfirmPlugin extends Plugin {

    public static final String EVENT_PAYMENT_NOTIFICATION = "paymentNotificationReceived";
    private static final String ENABLED_NOTIFICATION_LISTENERS = "enabled_notification_listeners";

    private static volatile PaymentAutoConfirmPlugin activeInstance;
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

    public PaymentAutoConfirmPlugin() {
        super();
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.handleOnDestroy();
    }

    static void dispatchPaymentNotification(
        final String packageName,
        final String title,
        final String text,
        final long amount,
        final long timestamp
    ) {
        final PaymentAutoConfirmPlugin instance = activeInstance;
        if (instance == null) {
            return;
        }
        MAIN_HANDLER.post(() -> {
            JSObject payload = new JSObject();
            payload.put("packageName", packageName);
            payload.put("title", title);
            payload.put("text", text);
            payload.put("amount", amount);
            payload.put("timestamp", timestamp);
            instance.notifyListeners(EVENT_PAYMENT_NOTIFICATION, payload, true);
        });
    }

    /**
     * 1. Cek apakah izin Akses Notifikasi sudah diaktifkan untuk paket aplikasi ini.
     */
    @PluginMethod
    public void isNotificationAccessEnabled(PluginCall call) {
        Context ctx = getContext();
        boolean enabled = isListenerEnabledForPackage(ctx);
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /**
     * 2. Buka halaman Pengaturan Akses Notifikasi Android agar Owner tinggal menggeser 1 saklar.
     */
    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context Android tidak tersedia.");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception primaryErr) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } catch (Exception fallbackErr) {
                call.reject("Gagal membuka Pengaturan Akses Notifikasi: " + primaryErr.getMessage());
            }
        }
    }

    /**
     * 3. Ambil 5 riwayat notifikasi terakhir yang diterima listener di memori untuk diagnostik di Profil.
     */
    @PluginMethod
    public void getRecentNotifications(PluginCall call) {
        List<PaymentNotificationListener.RecentNotificationLog> logs =
            PaymentNotificationListener.getRecentNotificationLogs();
        JSArray arr = new JSArray();
        for (PaymentNotificationListener.RecentNotificationLog item : logs) {
            JSObject obj = new JSObject();
            obj.put("packageName", item.packageName);
            obj.put("title", item.title);
            obj.put("text", item.text);
            obj.put("parsedAmount", item.parsedAmount);
            obj.put("matched", item.matched);
            obj.put("timestamp", item.timestamp);
            arr.put(obj);
        }
        JSObject ret = new JSObject();
        ret.put("notifications", arr);
        call.resolve(ret);
    }

    /**
     * 4. Ambil informasi versi native `.apk` terpasang (`versionName` & `versionCode`) dari PackageManager.
     */
    @PluginMethod
    public void getAppVersion(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context Android tidak tersedia.");
            return;
        }
        try {
            PackageInfo pInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pInfo = ctx.getPackageManager().getPackageInfo(
                    ctx.getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                pInfo = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            }
            String versionName = pInfo.versionName != null ? pInfo.versionName : "1.0.0";
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? pInfo.getLongVersionCode()
                : pInfo.versionCode;
            JSObject ret = new JSObject();
            ret.put("versionName", versionName);
            ret.put("versionCode", versionCode);
            ret.put("packageName", ctx.getPackageName());
            call.resolve(ret);
        } catch (Exception err) {
            call.reject("Gagal membaca versi aplikasi: " + err.getMessage());
        }
    }

    /**
     * 5. Buka URL eksternal (mis. browser_download_url `.apk` GitHub Release) di browser sistem Android.
     */
    @PluginMethod
    public void openDownloadUrl(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context Android tidak tersedia.");
            return;
        }
        String url = call.getString("url");
        if (TextUtils.isEmpty(url)) {
            call.reject("URL unduhan kosong.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception err) {
            call.reject("Gagal membuka URL unduhan: " + err.getMessage());
        }
    }

    private static boolean isListenerEnabledForPackage(Context context) {
        if (context == null) return false;
        String pkgName = context.getPackageName();
        String flat = Settings.Secure.getString(
            context.getContentResolver(),
            ENABLED_NOTIFICATION_LISTENERS
        );
        if (TextUtils.isEmpty(flat)) {
            return false;
        }
        String[] names = flat.split(":");
        for (String name : names) {
            ComponentName cn = ComponentName.unflattenFromString(name);
            if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                return true;
            }
        }
        return false;
    }
}
