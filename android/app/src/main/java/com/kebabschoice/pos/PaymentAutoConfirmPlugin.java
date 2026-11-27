package com.kebabschoice.pos;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * PaymentAutoConfirm — Jembatan Capacitor antara PaymentNotificationListener
 * (NotificationListenerService Android) dan WebView POS Kasir.
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
