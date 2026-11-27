package com.kebabschoice.pos;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PaymentNotificationListener — Mendengarkan notifikasi pembayaran QRIS masuk
 * dari aplikasi merchant resmi (Shopee Partner, GoBiz, DANA, OVO, dsb.) di tablet kasir Android
 * untuk melunaskan tagihan QRIS di POS secara otomatis ketika nominal cocok persis.
 */
public class PaymentNotificationListener extends NotificationListenerService {

    private static final Set<String> MONITORED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.shopee.merchant.id",
        "com.shopee.id",
        "com.shopee.pos",
        "com.airpay.id",
        "com.gojek.resto",
        "id.dana",
        "ovo.id"
    ));

    private static final String[] PAYMENT_KEYWORDS = new String[] {
        "diterima",
        "berhasil",
        "masuk",
        "dibayar",
        "pembayaran",
        "sukses",
        "received",
        "paid"
    };

    private static final String[] PROMO_BLOCKLIST = new String[] {
        "cashback",
        "voucher",
        "diskon",
        "promo",
        "gratis"
    };

    private static final Pattern RUPIAH_PATTERN = Pattern.compile(
        "(?i)(?:rp\\.?|idr)\\s*([0-9][0-9.,]*)"
    );

    // Cache sederhana agar notifikasi yang di-update ulang oleh OS tidak memicu duplikasi
    private final Map<String, Long> recentFingerprints = new LinkedHashMap<String, Long>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > 50;
        }
    };

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (!isMonitoredMerchantPackage(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) {
            return;
        }

        Bundle extras = notification.extras;
        String title = charSeqToString(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = charSeqToString(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = charSeqToString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String subText = charSeqToString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));

        String effectiveBody = !bigText.isEmpty() ? bigText : text;
        String combined = (title + " " + effectiveBody + " " + text + " " + subText).trim();
        if (combined.isEmpty()) {
            return;
        }

        if (!isValidIncomingPaymentText(combined)) {
            return;
        }

        long amount = extractRupiahAmount(combined);
        if (amount <= 0L) {
            return;
        }

        long timestamp = sbn.getPostTime() > 0L ? sbn.getPostTime() : System.currentTimeMillis();
        String fingerprint = packageName + "|" + amount + "|" + timestamp + "|" + effectiveBody;

        synchronized (recentFingerprints) {
            Long prev = recentFingerprints.get(fingerprint);
            if (prev != null && Math.abs(timestamp - prev) < 3000L) {
                return;
            }
            recentFingerprints.put(fingerprint, timestamp);
        }

        PaymentAutoConfirmPlugin.dispatchPaymentNotification(
            packageName,
            title,
            effectiveBody,
            amount,
            timestamp
        );
    }

    static boolean isMonitoredMerchantPackage(String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) {
            return false;
        }
        String lower = packageName.trim().toLowerCase(Locale.ROOT);
        if (MONITORED_PACKAGES.contains(lower)) {
            return true;
        }
        return lower.contains("shopee") || lower.contains("merchant");
    }

    static boolean isValidIncomingPaymentText(String rawText) {
        if (rawText == null || rawText.trim().isEmpty()) {
            return false;
        }
        String lower = rawText.toLowerCase(Locale.ROOT);

        for (String promoWord : PROMO_BLOCKLIST) {
            if (lower.contains(promoWord)) {
                return false;
            }
        }

        for (String kw : PAYMENT_KEYWORDS) {
            if (lower.contains(kw)) {
                return true;
            }
        }
        return false;
    }

    static long extractRupiahAmount(String rawText) {
        if (rawText == null || rawText.isEmpty()) {
            return -1L;
        }
        Matcher matcher = RUPIAH_PATTERN.matcher(rawText);
        while (matcher.find()) {
            String rawNum = matcher.group(1);
            if (rawNum == null || rawNum.isEmpty()) continue;

            // Hapus akhiran sen 2 digit (mis. ",00" atau ".00"), tetapi jaga ribuan 3 digit (".000")
            String withoutCents = rawNum.trim().replaceFirst("[.,]\\d{2}$", "");
            String digitsOnly = withoutCents.replaceAll("[^0-9]", "");
            if (digitsOnly.isEmpty()) continue;

            try {
                long parsed = Long.parseLong(digitsOnly);
                if (parsed > 0L) {
                    return parsed;
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return -1L;
    }

    private static String charSeqToString(CharSequence cs) {
        return cs != null ? cs.toString().trim() : "";
    }
}
