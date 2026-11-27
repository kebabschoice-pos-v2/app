package com.kebabschoice.pos;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * AppUpdate — Pengunduh & pemasang update `.apk` langsung di dalam aplikasi Android (tanpa browser).
 *
 * - Mengunduh `.apk` dari GitHub Releases di background thread ke `cacheDir/updates/KebabsChoicePOS.apk`.
 * - Memancarkan event `apkDownloadProgress` (`{ percent: 0..100, downloadedBytes, totalBytes }`).
 * - Saat mencapai `100%`, langsung membuka dialog Update Android via `Intent.ACTION_VIEW` + `FileProvider`
 *   dengan tipe `application/vnd.android.package-archive` dan
 *   `FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK`.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    public static final String EVENT_APK_DOWNLOAD_PROGRESS = "apkDownloadProgress";
    private static final String UPDATES_SUBDIR = "updates";
    private static final String APK_FILE_NAME = "KebabsChoicePOS.apk";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final int MAX_REDIRECTS = 6;
    private static final int CONNECT_TIMEOUT_MS = 20000;
    private static final int READ_TIMEOUT_MS = 45000;

    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static final ExecutorService DOWNLOAD_EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean DOWNLOAD_IN_PROGRESS = new AtomicBoolean(false);

    public AppUpdatePlugin() {
        super();
    }

    @PluginMethod
    public void downloadAndInstallApk(final PluginCall call) {
        final Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context Android tidak tersedia.");
            return;
        }

        final String rawUrl = call.getString("url");
        if (TextUtils.isEmpty(rawUrl)) {
            call.reject("URL unduhan APK kosong.");
            return;
        }

        final String cleanUrl = rawUrl.trim();
        final String lowerUrl = cleanUrl.toLowerCase(Locale.ROOT);
        if (!lowerUrl.startsWith("https://") && !lowerUrl.startsWith("http://")) {
            call.reject("URL unduhan APK harus menggunakan protokol HTTP/HTTPS.");
            return;
        }

        if (!DOWNLOAD_IN_PROGRESS.compareAndSet(false, true)) {
            call.reject("Unduhan pembaruan sedang berlangsung.");
            return;
        }

        final Context appContext = ctx.getApplicationContext();

        DOWNLOAD_EXECUTOR.execute(() -> {
            HttpURLConnection conn = null;
            File tempFile = null;
            try {
                File updatesDir = new File(appContext.getCacheDir(), UPDATES_SUBDIR);
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new IOException("Gagal menyiapkan folder cache unduhan pembaruan.");
                }

                File targetApk = new File(updatesDir, APK_FILE_NAME);
                tempFile = new File(updatesDir, APK_FILE_NAME + ".part");
                if (tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tempFile.delete();
                }

                emitProgress(0, 0L, 0L);

                conn = openConnectionWithRedirects(cleanUrl, MAX_REDIRECTS);
                int status = conn.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) {
                    throw new IOException("Gagal mengunduh file pembaruan (HTTP " + status + ").");
                }

                long totalBytes = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                    ? conn.getContentLengthLong()
                    : conn.getContentLength();
                if (totalBytes < 0L) {
                    totalBytes = 0L;
                }

                emitProgress(0, 0L, totalBytes);

                long downloadedBytes = 0L;
                int lastPercent = 0;
                long lastEmitTime = System.currentTimeMillis();

                try (
                    InputStream in = new BufferedInputStream(conn.getInputStream(), 32 * 1024);
                    FileOutputStream fos = new FileOutputStream(tempFile)
                ) {
                    byte[] buffer = new byte[16 * 1024];
                    int readCount;
                    while ((readCount = in.read(buffer)) != -1) {
                        fos.write(buffer, 0, readCount);
                        downloadedBytes += readCount;

                        int percent;
                        if (totalBytes > 0L) {
                            percent = (int) Math.min(99L, (downloadedBytes * 100L) / totalBytes);
                        } else {
                            long estimatedTotal = Math.max(downloadedBytes + (2L * 1024L * 1024L), 8L * 1024L * 1024L);
                            percent = (int) Math.min(95L, (downloadedBytes * 95L) / estimatedTotal);
                        }

                        long now = System.currentTimeMillis();
                        if (percent != lastPercent || (now - lastEmitTime) >= 150L) {
                            lastPercent = percent;
                            lastEmitTime = now;
                            emitProgress(percent, downloadedBytes, totalBytes);
                        }
                    }
                    fos.flush();
                    try {
                        fos.getFD().sync();
                    } catch (Exception ignored) {
                    }
                }

                if (downloadedBytes < 1024L) {
                    throw new IOException("File APK hasil unduhan tidak valid atau kosong.");
                }

                if (targetApk.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    targetApk.delete();
                }
                if (!tempFile.renameTo(targetApk)) {
                    throw new IOException("Gagal menyimpan file APK ke cache pembaruan.");
                }

                final long finalDownloaded = downloadedBytes;
                final long finalTotal = totalBytes > 0L ? totalBytes : downloadedBytes;
                emitProgress(100, finalDownloaded, finalTotal);

                MAIN_HANDLER.post(() -> {
                    try {
                        launchPackageInstaller(appContext, targetApk);
                        JSObject result = new JSObject();
                        result.put("installedPrompted", true);
                        result.put("percent", 100);
                        result.put("downloadedBytes", finalDownloaded);
                        result.put("totalBytes", finalTotal);
                        call.resolve(result);
                    } catch (Exception installErr) {
                        call.reject("Unduhan selesai, namun gagal membuka installer Android: " + installErr.getMessage());
                    }
                });
            } catch (final Exception err) {
                if (tempFile != null && tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tempFile.delete();
                }
                final String message = err.getMessage() != null
                    ? err.getMessage()
                    : "Terjadi kendala jaringan saat mengunduh pembaruan.";
                MAIN_HANDLER.post(() -> call.reject(message));
            } finally {
                if (conn != null) {
                    try {
                        conn.disconnect();
                    } catch (Exception ignored) {
                    }
                }
                DOWNLOAD_IN_PROGRESS.set(false);
            }
        });
    }

    private void emitProgress(final int percent, final long downloadedBytes, final long totalBytes) {
        final int clamped = Math.max(0, Math.min(100, percent));
        MAIN_HANDLER.post(() -> {
            JSObject payload = new JSObject();
            payload.put("percent", clamped);
            payload.put("downloadedBytes", downloadedBytes);
            payload.put("totalBytes", totalBytes);
            notifyListeners(EVENT_APK_DOWNLOAD_PROGRESS, payload, false);
        });
    }

    private void launchPackageInstaller(Context appContext, File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            appContext,
            appContext.getPackageName() + ".fileprovider",
            apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, APK_MIME_TYPE);
        installIntent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK
        );

        Activity activity = getActivity();
        Context launchContext = activity != null ? activity : appContext;

        try {
            launchContext.startActivity(installIntent);
        } catch (SecurityException secErr) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + appContext.getPackageName())
                );
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                launchContext.startActivity(settingsIntent);
                return;
            }
            throw secErr;
        }
    }

    private static HttpURLConnection openConnectionWithRedirects(
        String startUrl,
        int maxRedirects
    ) throws IOException {
        String currentUrl = startUrl;
        for (int hop = 0; hop <= maxRedirects; hop++) {
            URL urlObj = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) urlObj.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setUseCaches(false);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/octet-stream,*/*");
            conn.setRequestProperty("User-Agent", "KebabsChoicePOS-Android-Updater/2.0");

            int code = conn.getResponseCode();
            if (
                code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307 ||
                code == 308
            ) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (TextUtils.isEmpty(location)) {
                    throw new IOException("Redirect unduhan APK tidak memiliki header Location.");
                }
                currentUrl = new URL(urlObj, location).toString();
                continue;
            }
            return conn;
        }
        throw new IOException("Terlalu banyak pengalihan (redirect) saat mengunduh APK.");
    }
}
