package com.kebabschoice.pos;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.webkit.PermissionRequest;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final String RAWBT_PACKAGE = "ru.a402d.rawbtprinter";

    private PermissionRequest pendingWebPermission;
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin native custom harus didaftarkan sebelum super.onCreate()
        registerPlugin(WhatsAppLauncherPlugin.class);
        registerPlugin(BluetoothPrinterPlugin.class);

        cameraPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                PermissionRequest req = pendingWebPermission;
                pendingWebPermission = null;
                if (req == null) return;
                if (granted) grantAllowedResources(req);
                else req.deny();
            }
        );

        super.onCreate(savedInstanceState);

        if (bridge != null) {
            WebView webView = bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            webView.setWebChromeClient(new PosWebChromeClient(bridge));
            bridge.setWebViewClient(new PosWebViewClient(bridge));
        }
    }

    // ---------------------------------------------------------------------
    // Kamera WebView (absensi wajah): izinkan getUserMedia setelah izin Android disetujui
    // ---------------------------------------------------------------------
    private boolean hasPermission(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void grantAllowedResources(PermissionRequest request) {
        List<String> allowed = new ArrayList<>();
        for (String res : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res) && hasPermission(Manifest.permission.CAMERA)) {
                allowed.add(res);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res) && hasPermission(Manifest.permission.RECORD_AUDIO)) {
                allowed.add(res);
            }
        }
        if (allowed.isEmpty()) request.deny();
        else request.grant(allowed.toArray(new String[0]));
    }

    private class PosWebChromeClient extends BridgeWebChromeClient {
        PosWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> {
                boolean wantsCamera = false;
                for (String res : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) wantsCamera = true;
                }
                if (wantsCamera && !hasPermission(Manifest.permission.CAMERA)) {
                    if (pendingWebPermission != null) pendingWebPermission.deny();
                    pendingWebPermission = request;
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                } else {
                    grantAllowedResources(request);
                }
            });
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                return false;
            }
            // Tangkap window.open(..., "_blank") / <a target="_blank"> (mis. Kirim Struk WA)
            // dan teruskan ke sistem Android tanpa menggeser halaman POS utama.
            WebView tempWebView = new WebView(MainActivity.this);
            tempWebView.setWebViewClient(new WebViewClient() {
                private boolean handled = false;

                private void handleTarget(Uri targetUri) {
                    if (handled || targetUri == null) return;
                    handled = true;
                    if (isExternalAppLink(targetUri)) {
                        openExternally(MainActivity.this, targetUri);
                    } else {
                        openView(MainActivity.this, targetUri);
                    }
                    tempWebView.destroy();
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    handleTarget(req.getUrl());
                    return true;
                }

                @SuppressWarnings("deprecation")
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    handleTarget(Uri.parse(url));
                    return true;
                }
            });
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(tempWebView);
            resultMsg.sendToTarget();
            return true;
        }
    }

    // ---------------------------------------------------------------------
    // Link eksternal: rawbt:, intent:, whatsapp:, wa.me -> diteruskan ke sistem Android
    // ---------------------------------------------------------------------
    private class PosWebViewClient extends BridgeWebViewClient {
        PosWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (isExternalAppLink(url)) {
                openExternally(MainActivity.this, url);
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri parsed = url != null ? Uri.parse(url) : null;
            if (isExternalAppLink(parsed)) {
                openExternally(MainActivity.this, parsed);
                return true;
            }
            return super.shouldOverrideUrlLoading(view, url);
        }
    }

    static boolean isExternalAppLink(Uri url) {
        if (url == null || url.getScheme() == null) return false;
        String scheme = url.getScheme().toLowerCase(Locale.ROOT);
        switch (scheme) {
            case "rawbt":
            case "intent":
            case "whatsapp":
            case "tel":
            case "mailto":
            case "sms":
            case "market":
                return true;
            case "http":
            case "https":
                String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
                return host.equals("wa.me")
                    || host.equals("api.whatsapp.com")
                    || host.equals("chat.whatsapp.com")
                    || host.equals("web.whatsapp.com")
                    || host.equals("play.google.com");
            default:
                return false;
        }
    }

    static void openExternally(Context context, Uri url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(Locale.ROOT);
        try {
            Intent intent;
            if ("intent".equals(scheme)) {
                intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                intent.setSelector(null);
                try {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null) {
                        openView(context, Uri.parse(fallback));
                    } else if (intent.getPackage() != null) {
                        openPlayStore(context, intent.getPackage());
                    }
                }
                return;
            }
            openView(context, url);
        } catch (ActivityNotFoundException e) {
            if ("rawbt".equals(scheme)) openPlayStore(context, RAWBT_PACKAGE);
        } catch (Exception ignored) {
            // URL tidak valid — abaikan agar WebView tidak crash
        }
    }

    private static void openView(Context context, Uri url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, url);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    private static void openPlayStore(Context context, String pkg) {
        try {
            openView(context, Uri.parse("market://details?id=" + pkg));
        } catch (ActivityNotFoundException e) {
            try {
                openView(context, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
            } catch (Exception ignored) {
            }
        }
    }
}
