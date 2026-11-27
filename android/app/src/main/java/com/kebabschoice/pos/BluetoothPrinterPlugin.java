package com.kebabschoice.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * BluetoothPrinter — Plugin Native Bluetooth Classic (SPP / RFCOMM) untuk cetak struk ESC/POS
 * langsung dari .apk Android tanpa aplikasi jembatan RawBT dan tanpa dialog print browser.
 *
 * Kompatibel dengan printer thermal kasir Bluetooth Classic 58mm/80mm:
 * Eppos, Panda, RPP02N, VSC, Blueprint, Iware, MTP-II, MTP-3, Xprinter, dll.
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetoothAndroid12",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    /** Standard Serial Port Profile (SPP) UUID */
    public static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private static final int WRITE_CHUNK_BYTES = 1024;
    private static final long FLUSH_SETTLE_MS = 120L;

    private final ExecutorService printExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "KebabsChoice-BT-SPP");
        thread.setDaemon(true);
        return thread;
    });

    private BluetoothAdapter getBluetoothAdapter() {
        Context ctx = getContext();
        if (ctx != null) {
            BluetoothManager manager = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager != null && manager.getAdapter() != null) {
                return manager.getAdapter();
            }
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasBluetoothPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        Context ctx = getContext();
        if (ctx == null) return false;
        boolean connectGranted =
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
        boolean scanGranted =
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
        return connectGranted && scanGranted;
    }

    /**
     * 1. Minta izin runtime BLUETOOTH_CONNECT & BLUETOOTH_SCAN (Android 12+)
     *    serta tampilkan dialog aktifkan Bluetooth bila sedang mati.
     */
    @PluginMethod
    public void ensureBluetoothEnabled(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki modul Bluetooth.");
            return;
        }

        if (!hasBluetoothPermissions()) {
            requestPermissionForAlias("bluetoothAndroid12", call, "onEnsureBluetoothPermissionsResult");
            return;
        }

        promptEnableBluetoothIfNeeded(call, adapter);
    }

    @PermissionCallback
    private void onEnsureBluetoothPermissionsResult(PluginCall call) {
        if (call == null) return;
        if (!hasBluetoothPermissions()) {
            call.reject(
                "Izin Bluetooth (Perangkat Terdekat) ditolak. Aktifkan izin di Pengaturan Aplikasi Android."
            );
            return;
        }
        promptEnableBluetoothIfNeeded(call, getBluetoothAdapter());
    }

    @SuppressLint("MissingPermission")
    private void promptEnableBluetoothIfNeeded(PluginCall call, BluetoothAdapter adapter) {
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki modul Bluetooth.");
            return;
        }

        if (adapter.isEnabled()) {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
            return;
        }

        try {
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(call, enableBtIntent, "onEnableBluetoothActivityResult");
        } catch (Exception e) {
            call.reject("Gagal menampilkan dialog aktifkan Bluetooth: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void onEnableBluetoothActivityResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        BluetoothAdapter adapter = getBluetoothAdapter();
        boolean isEnabled =
            (result != null && result.getResultCode() == Activity.RESULT_OK)
                || (adapter != null && adapter.isEnabled());

        if (isEnabled) {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
        } else {
            call.reject("Bluetooth belum diaktifkan pada tablet.");
        }
    }

    /**
     * 2. Kembalikan daftar perangkat Bluetooth yang sudah di-pair di tablet:
     *    { devices: [{ name, address }] }
     */
    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki modul Bluetooth.");
            return;
        }

        if (!hasBluetoothPermissions()) {
            requestPermissionForAlias("bluetoothAndroid12", call, "onListPairedPermissionsResult");
            return;
        }

        resolvePairedDevices(call, adapter);
    }

    @PermissionCallback
    private void onListPairedPermissionsResult(PluginCall call) {
        if (call == null) return;
        if (!hasBluetoothPermissions()) {
            call.reject("Izin Bluetooth diperlukan untuk membaca daftar printer ter-pair.");
            return;
        }
        resolvePairedDevices(call, getBluetoothAdapter());
    }

    @SuppressLint("MissingPermission")
    private void resolvePairedDevices(PluginCall call, BluetoothAdapter adapter) {
        Set<BluetoothDevice> bondedDevices =
            adapter != null ? adapter.getBondedDevices() : Collections.emptySet();

        List<BluetoothDevice> sortedList = new ArrayList<>();
        if (bondedDevices != null) {
            sortedList.addAll(bondedDevices);
        }

        // Urutkan perangkat yang terindikasi printer thermal di urutan teratas, tetap tampilkan semua
        Collections.sort(sortedList, (a, b) -> {
            boolean aPrinter = looksLikePrinter(a);
            boolean bPrinter = looksLikePrinter(b);
            if (aPrinter != bPrinter) {
                return aPrinter ? -1 : 1;
            }
            String nameA = safeDeviceName(a);
            String nameB = safeDeviceName(b);
            return nameA.compareToIgnoreCase(nameB);
        });

        JSArray devicesArray = new JSArray();
        for (BluetoothDevice device : sortedList) {
            if (device == null) continue;
            String address = device.getAddress();
            if (address == null || address.trim().isEmpty()) continue;

            JSObject item = new JSObject();
            item.put("name", safeDeviceName(device));
            item.put("address", address.trim());
            devicesArray.put(item);
        }

        JSObject ret = new JSObject();
        ret.put("devices", devicesArray);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private static String safeDeviceName(BluetoothDevice device) {
        if (device == null) return "Bluetooth Printer";
        String rawName = device.getName();
        if (rawName != null && !rawName.trim().isEmpty()) {
            return rawName.trim();
        }
        String addr = device.getAddress();
        return addr != null ? "Bluetooth " + addr : "Bluetooth Printer";
    }

    @SuppressLint("MissingPermission")
    private static boolean looksLikePrinter(BluetoothDevice device) {
        if (device == null) return false;
        BluetoothClass btClass = device.getBluetoothClass();
        if (btClass != null && btClass.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING) {
            return true;
        }
        String lower = safeDeviceName(device).toLowerCase(Locale.ROOT);
        return lower.contains("rpp")
            || lower.contains("eppos")
            || lower.contains("panda")
            || lower.contains("vsc")
            || lower.contains("blueprint")
            || lower.contains("iware")
            || lower.contains("pos")
            || lower.contains("mpt")
            || lower.contains("mtp")
            || lower.contains("printer")
            || lower.contains("thermal")
            || lower.contains("58")
            || lower.contains("80");
    }

    /**
     * 3. Buka createRfcommSocketToServiceRecord(SPP_UUID) di background thread,
     *    kirim byte ESC/POS dari Base64, flush, tutup socket rapi, dan kembalikan { ok: true }.
     */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printBase64(PluginCall call) {
        String rawAddress = call.getString("address");
        String rawBase64 = call.getString("base64");

        if (rawAddress == null || rawAddress.trim().isEmpty()) {
            call.reject("Alamat MAC printer Bluetooth (address) wajib diisi.");
            return;
        }
        if (rawBase64 == null || rawBase64.trim().isEmpty()) {
            call.reject("Payload struk Base64 tidak boleh kosong.");
            return;
        }

        final String address = rawAddress.trim().toUpperCase(Locale.ROOT);
        if (!BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Format alamat MAC Bluetooth tidak valid: " + address);
            return;
        }

        if (!hasBluetoothPermissions()) {
            call.reject("Izin Bluetooth belum diaktifkan. Hubungkan ulang printer Bluetooth.");
            return;
        }

        final BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak memiliki modul Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth tablet sedang mati. Aktifkan Bluetooth terlebih dahulu.");
            return;
        }

        final byte[] escPosBytes;
        try {
            String cleanBase64 = rawBase64.trim();
            int commaIdx = cleanBase64.indexOf(',');
            if (commaIdx >= 0 && commaIdx < cleanBase64.length() - 1) {
                cleanBase64 = cleanBase64.substring(commaIdx + 1);
            }
            escPosBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Data struk Base64 tidak valid: " + e.getMessage(), e);
            return;
        }

        if (escPosBytes == null || escPosBytes.length == 0) {
            call.reject("Data byte ESC/POS kosong.");
            return;
        }

        printExecutor.execute(() -> {
            BluetoothSocket socket = null;
            OutputStream outputStream = null;
            try {
                if (adapter.isDiscovering()) {
                    try {
                        adapter.cancelDiscovery();
                    } catch (Exception ignored) {
                    }
                }

                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = openSppSocket(device);
                outputStream = socket.getOutputStream();

                int offset = 0;
                while (offset < escPosBytes.length) {
                    int length = Math.min(WRITE_CHUNK_BYTES, escPosBytes.length - offset);
                    outputStream.write(escPosBytes, offset, length);
                    offset += length;
                }
                outputStream.flush();

                // Beri jeda singkat agar buffer UART printer thermal selesai menerima paket terakhir
                try {
                    Thread.sleep(FLUSH_SETTLE_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }

                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "Koneksi ke printer terputus";
                call.reject(
                    "Gagal mencetak ke printer Bluetooth (" + address + "): " + msg,
                    e
                );
            } finally {
                if (outputStream != null) {
                    try {
                        outputStream.close();
                    } catch (IOException ignored) {
                    }
                }
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (IOException ignored) {
                    }
                }
            }
        });
    }

    @SuppressLint("MissingPermission")
    private BluetoothSocket openSppSocket(BluetoothDevice device) throws IOException {
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            socket.connect();
            return socket;
        } catch (IOException primaryErr) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            // Fallback insecure RFCOMM SPP untuk printer thermal generasi lama (cth. beberapa RPP02N/MTP-II)
            BluetoothSocket fallbackSocket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            try {
                fallbackSocket.connect();
                return fallbackSocket;
            } catch (IOException fallbackErr) {
                try {
                    fallbackSocket.close();
                } catch (IOException ignored) {
                }
                throw primaryErr;
            }
        }
    }
}
