package com.kebabschoice.pos;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PaymentNotificationListener — Mendengarkan notifikasi pembayaran QRIS masuk
 * dari aplikasi merchant & perbankan (Shopee Partner, ShopeePay, GoPay/GoBiz, DANA, OVO,
 * BCA, BRI, Mandiri, BNI, SeaBank, dsb.) di tablet kasir Android untuk melunaskan tagihan
 * QRIS di POS secara otomatis ketika nominal cocok, sekaligus menyimpan 5 log diagnostik terakhir.
 */
public class PaymentNotificationListener extends NotificationListenerService {

    private static final int MAX_RECENT_NOTIFICATIONS = 5;

    public static final class RecentNotificationLog {
        public final String packageName;
        public final String title;
        public final String text;
        public final long parsedAmount;
        public final boolean matched;
        public final long timestamp;

        public RecentNotificationLog(
            String packageName,
            String title,
            String text,
            long parsedAmount,
            boolean matched,
            long timestamp
        ) {
            this.packageName = packageName != null ? packageName : "";
            this.title = title != null ? title : "";
            this.text = text != null ? text : "";
            this.parsedAmount = parsedAmount;
            this.matched = matched;
            this.timestamp = timestamp;
        }
    }

    private static final LinkedList<RecentNotificationLog> RECENT_NOTIFICATIONS = new LinkedList<>();

    private static final Set<String> IGNORED_SYSTEM_PACKAGES = new HashSet<>(Arrays.asList(
        "android",
        "com.android.systemui",
        "com.android.providers.downloads",
        "com.google.android.gms",
        "com.google.android.inputmethod.latin",
        "com.kebabschoice.pos"
    ));

    private static final Set<String> MONITORED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.shopee.merchant.id",
        "com.shopee.partner",
        "com.shopee.partner.id",
        "com.shopee.id",
        "com.shopee.pos",
        "com.airpay.id",
        "com.gojek.resto",
        "com.gojek.gopaymerchant",
        "com.gojek.app",
        "id.dana",
        "id.dana.bisnis",
        "ovo.id",
        "com.bca",
        "com.bca.merchant",
        "id.co.bri.brimo",
        "id.co.bri.brimerchant",
        "bmri.livinmerchant",
        "src.com.bni",
        "id.co.seabank.app"
    ));

    private static final String[] MONITORED_PACKAGE_TOKENS = new String[] {
        "shopee",
        "airpay",
        "spay",
        "gopay",
        "dana",
        "ovo",
        "qris",
        "merchant",
        "bca",
        "bri",
        "mandiri",
        "bni",
        "seabank"
    };

    private static final String[] PAYMENT_KEYWORDS = new String[] {
        "transaksi berhasil",
        "diterima",
        "menerima",
        "terima",
        "berhasil",
        "masuk",
        "dibayar",
        "pembayaran",
        "sukses",
        "received",
        "paid",
        "payment",
        "qris"
    };

    private static final String[] PROMO_BLOCKLIST = new String[] {
        "cashback",
        "voucher",
        "diskon",
        "promo",
        "gratis"
    };

    // Prioritas 1: nominal dengan awalan mata uang (Rp9.900, Rp 9.900, Rp9,900, Rp 9.900,00, IDR 9.900)
    private static final Pattern RUPIAH_PREFIX_PATTERN = Pattern.compile(
        "(?i)(?:rp\\.?|idr)\\s*([0-9]+(?:[.,][0-9]+)*)"
    );

    // Prioritas 2: nominal ribuan bertitik/koma tanpa awalan Rp (mis. "9.900", "22.000,00", "1.250.500")
    private static final Pattern BARE_GROUPED_AMOUNT_PATTERN = Pattern.compile(
        "(?<![0-9.,:/-])([1-9][0-9]{0,2}(?:[.,][0-9]{3})+(?:[.,][0-9]{2})?)(?![0-9])"
    );

    // Cache sederhana agar notifikasi yang di-update ulang oleh OS tidak memicu duplikasi
    private final Map<String, Long> recentFingerprints = new LinkedHashMap<String, Long>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > 50;
        }
    };

    public static List<RecentNotificationLog> getRecentNotificationLogs() {
        synchronized (RECENT_NOTIFICATIONS) {
            return new ArrayList<>(RECENT_NOTIFICATIONS);
        }
    }

    static void recordRecentNotification(
        String packageName,
        String title,
        String text,
        long parsedAmount,
        boolean matched,
        long timestamp
    ) {
        synchronized (RECENT_NOTIFICATIONS) {
            if (!RECENT_NOTIFICATIONS.isEmpty()) {
                RecentNotificationLog head = RECENT_NOTIFICATIONS.getFirst();
                if (
                    head.packageName.equals(packageName)
                        && head.title.equals(title)
                        && head.text.equals(text)
                        && head.matched == matched
                        && Math.abs(timestamp - head.timestamp) < 2500L
                ) {
                    return;
                }
            }
            RECENT_NOTIFICATIONS.addFirst(
                new RecentNotificationLog(
                    packageName,
                    title,
                    text,
                    parsedAmount > 0L ? parsedAmount : 0L,
                    matched,
                    timestamp
                )
            );
            while (RECENT_NOTIFICATIONS.size() > MAX_RECENT_NOTIFICATIONS) {
                RECENT_NOTIFICATIONS.removeLast();
            }
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null || packageName.trim().isEmpty()) {
            return;
        }
        String trimmedPkg = packageName.trim();
        String lowerPkg = trimmedPkg.toLowerCase(Locale.ROOT);
        if (IGNORED_SYSTEM_PACKAGES.contains(lowerPkg)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) {
            return;
        }

        Bundle extras = notification.extras;
        String title = extras != null
            ? charSeqToString(extras.getCharSequence(Notification.EXTRA_TITLE))
            : "";
        String text = extras != null
            ? charSeqToString(extras.getCharSequence(Notification.EXTRA_TEXT))
            : "";
        String bigText = extras != null
            ? charSeqToString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT))
            : "";
        String subText = extras != null
            ? charSeqToString(extras.getCharSequence(Notification.EXTRA_SUB_TEXT))
            : "";
        String infoText = extras != null
            ? charSeqToString(extras.getCharSequence(Notification.EXTRA_INFO_TEXT))
            : "";
        String ticker = charSeqToString(notification.tickerText);

        String effectiveBody = !bigText.isEmpty() ? bigText : (!text.isEmpty() ? text : ticker);
        String combined = (title + " " + effectiveBody + " " + text + " " + subText + " " + infoText + " " + ticker).trim();
        if (combined.isEmpty()) {
            return;
        }

        boolean isMerchantPkg = isMonitoredMerchantPackage(trimmedPkg);
        boolean isOngoing = (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0;
        if (!isMerchantPkg && isOngoing) {
            return;
        }

        boolean validPaymentText = isValidIncomingPaymentText(combined);
        long amount = extractRupiahAmount(combined);
        boolean matched = isMerchantPkg && validPaymentText && amount > 0L;
        long timestamp = System.currentTimeMillis();

        // Simpan ke 5 riwayat notifikasi terakhir untuk diagnostik di halaman Profil tablet
        recordRecentNotification(
            trimmedPkg,
            title,
            effectiveBody,
            amount > 0L ? amount : 0L,
            matched,
            timestamp
        );

        if (!matched) {
            return;
        }

        String fingerprint = lowerPkg + "|" + amount + "|" + effectiveBody;
        synchronized (recentFingerprints) {
            Long prev = recentFingerprints.get(fingerprint);
            if (prev != null && Math.abs(timestamp - prev) < 3000L) {
                return;
            }
            recentFingerprints.put(fingerprint, timestamp);
        }

        PaymentAutoConfirmPlugin.dispatchPaymentNotification(
            trimmedPkg,
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
        if ("com.kebabschoice.pos".equals(lower)) {
            return false;
        }
        if (MONITORED_PACKAGES.contains(lower)) {
            return true;
        }
        for (String token : MONITORED_PACKAGE_TOKENS) {
            if (lower.contains(token)) {
                return true;
            }
        }
        return false;
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

        Matcher prefixedMatcher = RUPIAH_PREFIX_PATTERN.matcher(rawText);
        while (prefixedMatcher.find()) {
            long parsed = parseRupiahNumberToken(prefixedMatcher.group(1));
            if (parsed > 0L) {
                return parsed;
            }
        }

        Matcher bareMatcher = BARE_GROUPED_AMOUNT_PATTERN.matcher(rawText);
        while (bareMatcher.find()) {
            long parsed = parseRupiahNumberToken(bareMatcher.group(1));
            if (parsed > 0L) {
                return parsed;
            }
        }

        return -1L;
    }

    private static long parseRupiahNumberToken(String rawNum) {
        if (rawNum == null || rawNum.isEmpty()) {
            return -1L;
        }
        // Hapus akhiran sen 2 digit (mis. ",00" atau ".00"), tetapi jaga ribuan 3 digit (".000" / ",000")
        String withoutCents = rawNum.trim().replaceFirst("[.,]\\d{2}$", "");
        String digitsOnly = withoutCents.replaceAll("[^0-9]", "");
        if (digitsOnly.isEmpty()) {
            return -1L;
        }
        try {
            long parsed = Long.parseLong(digitsOnly);
            return parsed > 0L ? parsed : -1L;
        } catch (NumberFormatException ignored) {
            return -1L;
        }
    }

    private static String charSeqToString(CharSequence cs) {
        return cs != null ? cs.toString().trim() : "";
    }
}
