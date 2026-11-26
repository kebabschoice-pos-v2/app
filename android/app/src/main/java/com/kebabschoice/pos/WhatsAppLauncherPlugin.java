package com.kebabschoice.pos;

import android.content.Intent;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * WhatsAppLauncher — 1 tap langsung membuka HALAMAN UTAMA (daftar chat) WhatsApp.
 *
 * JS: WhatsAppLauncher.openWhatsApp({ package?: "auto" | "com.whatsapp" | "com.whatsapp.w4b" })
 *   -> { opened: true, package: "<pkg>" } atau { opened: false }
 */
@CapacitorPlugin(name = "WhatsAppLauncher")
public class WhatsAppLauncherPlugin extends Plugin {

    static final String WA_BUSINESS = "com.whatsapp.w4b";
    static final String WA_REGULAR = "com.whatsapp";

    @PluginMethod
    public void openWhatsApp(PluginCall call) {
        String preferred = call.getString("package", "auto");
        boolean clearTask = Boolean.TRUE.equals(call.getBoolean("clearTask", false));

        List<String> candidates = new ArrayList<>();
        if (WA_REGULAR.equals(preferred)) {
            candidates.add(WA_REGULAR);
            candidates.add(WA_BUSINESS);
        } else if (WA_BUSINESS.equals(preferred)) {
            candidates.add(WA_BUSINESS);
            candidates.add(WA_REGULAR);
        } else {
            // "auto": utamakan WhatsApp Business (akun toko), lalu WhatsApp biasa
            candidates.add(WA_BUSINESS);
            candidates.add(WA_REGULAR);
        }

        PackageManager pm = getContext().getPackageManager();
        for (String pkgName : candidates) {
            Intent intent = pm.getLaunchIntentForPackage(pkgName);
            if (intent == null) continue;
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (clearTask) {
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);
            }
            try {
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                ret.put("package", pkgName);
                call.resolve(ret);
                return;
            } catch (Exception ignored) {
                // Coba kandidat berikutnya
            }
        }

        JSObject ret = new JSObject();
        ret.put("opened", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        JSObject ret = new JSObject();
        ret.put("whatsapp", pm.getLaunchIntentForPackage(WA_REGULAR) != null);
        ret.put("whatsappBusiness", pm.getLaunchIntentForPackage(WA_BUSINESS) != null);
        call.resolve(ret);
    }
}
