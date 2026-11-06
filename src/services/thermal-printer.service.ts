/**
 * Direct Thermal Printing & Cash Drawer Service (ESC/POS)
 * Supports Web Bluetooth & Web USB API with automatic fallback to window.print()
 * Fully SSR-safe: all navigator/window calls are guarded with client-side checks.
 */

export type PaperSize = "58mm" | "80mm";
export type PrinterConnectionType = "bluetooth" | "usb" | "none";
export type PrinterConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ConnectedPrinterInfo {
  type: PrinterConnectionType;
  name: string;
  status: PrinterConnectionStatus;
  paperSize: PaperSize;
  openCashDrawerOnCash: boolean;
}

export interface ThermalReceiptItem {
  name: string;
  variantName?: string | null;
  quantity?: number;
  qty?: number;
  price: number;
  subtotal: number;
}

export interface ThermalReceiptPayload {
  storeName: string;
  outletName?: string;
  address?: string;
  phone?: string;
  headerMessage?: string;
  footerMessage?: string;
  orderNumber: string;
  cashierName?: string;
  customerName?: string | null;
  paymentMethod: string;
  createdAt?: string;
  date?: string;
  items: ThermalReceiptItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  cashTendered?: number;
  change?: number;
  paperSize?: PaperSize;
  autoCut?: boolean;
  openDrawer?: boolean;
}

// Check if running on client browser (SSR-safe guard)
export function isClient(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return true;
}

// Check Web Bluetooth API support
export function isBluetoothSupported(): boolean {
  return isClient() && "bluetooth" in navigator;
}

// Check Web USB API support
export function isUsbSupported(): boolean {
  return isClient() && "usb" in navigator;
}

/**
 * Standard ESC/POS Command Byte Sequences
 */
export const ESC_POS = {
  INIT: [0x1b, 0x40], // Initialize printer
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  TEXT_NORMAL: [0x1d, 0x21, 0x00],
  TEXT_DOUBLE_HEIGHT: [0x1d, 0x21, 0x01],
  TEXT_DOUBLE_WIDTH: [0x1d, 0x21, 0x10],
  TEXT_DOUBLE_SIZE: [0x1d, 0x21, 0x11],
  LINE_FEED: [0x0a],
  PAPER_CUT_FULL: [0x1d, 0x56, 0x00],
  PAPER_CUT_PARTIAL: [0x1d, 0x56, 0x42, 0x00],
  // Cash Drawer kick pulse: ESC p m t1 t2 (hex: 1B 70 00 19 FA)
  CASH_DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  CASH_DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
};

// Common Bluetooth Printer Service UUIDs
const BT_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

// In-memory active connection state
let activeBtDevice: any = null;
let activeBtCharacteristic: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: number = 1;

let currentPrinterInfo: ConnectedPrinterInfo = {
  type: "none",
  name: "Belum Terhubung",
  status: "disconnected",
  paperSize: "58mm",
  openCashDrawerOnCash: true,
};

const statusListeners = new Set<(info: ConnectedPrinterInfo) => void>();

function notifyListeners() {
  statusListeners.forEach((fn) => {
    try {
      fn({ ...currentPrinterInfo });
    } catch (e) {
      console.warn("[ThermalPrinter] Listener error:", e);
    }
  });
}

/**
 * Load saved printer settings from localStorage
 */
export function getSavedPrinterConfig(): {
  paperSize: PaperSize;
  openCashDrawer: boolean;
  autoCut: boolean;
} {
  if (!isClient()) {
    return { paperSize: "58mm", openCashDrawer: true, autoCut: true };
  }
  try {
    const raw = localStorage.getItem("kebabschoicepos_printer_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        paperSize: parsed.paperSize === "80mm" ? "80mm" : "58mm",
        openCashDrawer: parsed.openCashDrawer !== false,
        autoCut: parsed.autoCut !== false,
      };
    }
  } catch {}
  return { paperSize: "58mm", openCashDrawer: true, autoCut: true };
}

/**
 * Get current connected printer information
 */
export function getConnectedPrinter(): ConnectedPrinterInfo {
  return { ...currentPrinterInfo };
}

/**
 * Subscribe to printer connection status changes
 */
export function subscribePrinterStatus(callback: (info: ConnectedPrinterInfo) => void): () => void {
  statusListeners.add(callback);
  callback({ ...currentPrinterInfo });
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Format string pad helper for thermal receipt lines
 */
function padLine(left: string, right: string, maxLen: number): string {
  const combinedLen = left.length + right.length;
  if (combinedLen >= maxLen) {
    const availForLeft = Math.max(1, maxLen - right.length - 1);
    const trimmedLeft = left.substring(0, availForLeft);
    const spaceCount = Math.max(1, maxLen - trimmedLeft.length - right.length);
    return trimmedLeft + " ".repeat(spaceCount) + right;
  }
  const spaces = " ".repeat(maxLen - combinedLen);
  return left + spaces + right;
}

function formatCurrency(num: number): string {
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

/**
 * Encode receipt data to ESC/POS binary buffer
 */
export function encodeEscPosReceipt(payload: ThermalReceiptPayload): Uint8Array {
  const bytes: number[] = [];
  const encoder = new TextEncoder();

  const appendBytes = (arr: number[]) => {
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      if (b !== undefined) bytes.push(b);
    }
  };

  const appendText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      const b = encoded[i];
      if (b !== undefined) bytes.push(b);
    }
  };

  const appendLine = (text = "") => {
    appendText(text + "\n");
  };

  const maxChars = payload.paperSize === "80mm" ? 48 : 32;
  const divider = "-".repeat(maxChars);

  // 1. Initialize
  appendBytes(ESC_POS.INIT);

  // 2. Header (Center)
  appendBytes(ESC_POS.ALIGN_CENTER);
  appendBytes(ESC_POS.BOLD_ON);
  appendBytes(ESC_POS.TEXT_DOUBLE_SIZE);
  appendLine(payload.storeName || "KEBAB'S CHOICE");
  appendBytes(ESC_POS.TEXT_NORMAL);
  appendBytes(ESC_POS.BOLD_OFF);

  if (payload.outletName) {
    appendLine(`Cabang: ${payload.outletName}`);
  }
  if (payload.address) {
    appendLine(payload.address);
  }
  if (payload.phone) {
    appendLine(`Telp: ${payload.phone}`);
  }
  if (payload.headerMessage) {
    appendLine(payload.headerMessage);
  }

  // Divider
  appendLine(divider);

  // 3. Order Metadata (Left)
  const rawDate = payload.createdAt || payload.date || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const isValidDate = !isNaN(dateObj.getTime());
  const timeStr = isValidDate
    ? dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dateStr = isValidDate ? dateObj.toLocaleDateString("id-ID") : String(rawDate);

  appendBytes(ESC_POS.ALIGN_LEFT);
  appendLine(padLine(`No: ${payload.orderNumber}`, payload.paymentMethod.toUpperCase(), maxChars));
  appendLine(padLine(`Waktu: ${timeStr}`, dateStr, maxChars));
  if (payload.cashierName) {
    appendLine(`Kasir: ${payload.cashierName}`);
  }
  if (payload.customerName) {
    appendLine(`Pelanggan: ${payload.customerName}`);
  }

  // Divider
  appendLine(divider);

  // 4. Items List
  for (const it of payload.items) {
    appendLine(it.name);
    if (it.variantName) {
      appendLine(`  [${it.variantName}]`);
    }
    const itemQty = it.quantity ?? it.qty ?? 1;
    const qtyPrice = `  ${itemQty} x ${formatCurrency(it.price)}`;
    const subtotalStr = formatCurrency(it.subtotal);
    appendLine(padLine(qtyPrice, subtotalStr, maxChars));
  }

  // Divider
  appendLine(divider);

  // 5. Totals
  if (payload.discount && payload.discount > 0) {
    appendLine(padLine("Diskon Promosi", `-${formatCurrency(payload.discount)}`, maxChars));
  }
  if (payload.tax && payload.tax > 0) {
    appendLine(padLine("Pajak Resto (PB1)", formatCurrency(payload.tax), maxChars));
  }

  appendBytes(ESC_POS.BOLD_ON);
  appendLine(padLine("TOTAL", formatCurrency(payload.total), maxChars));
  appendBytes(ESC_POS.BOLD_OFF);

  if (payload.cashTendered && payload.cashTendered > 0) {
    appendLine(padLine("Tunai Diterima", formatCurrency(payload.cashTendered), maxChars));
    const change = Math.max(0, payload.change ?? payload.cashTendered - payload.total);
    appendLine(padLine("Kembalian", formatCurrency(change), maxChars));
  }

  // Divider
  appendLine(divider);

  // 6. Footer (Center)
  appendBytes(ESC_POS.ALIGN_CENTER);
  if (payload.footerMessage) {
    appendLine(payload.footerMessage);
  } else {
    appendLine("Terima kasih atas kunjungan Anda!");
    appendLine("Sajian Kebab Pilihan Keluarga");
  }

  // Feed 4 lines before cut
  appendLine();
  appendLine();
  appendLine();

  // 7. Pulse Kick Cash Drawer if requested
  if (payload.openDrawer) {
    appendBytes(ESC_POS.CASH_DRAWER_KICK_PIN2);
  }

  // 8. Auto-cut paper if requested
  if (payload.autoCut !== false) {
    appendBytes(ESC_POS.PAPER_CUT_PARTIAL);
  }

  return new Uint8Array(bytes);
}

export const buildEscPosReceipt = encodeEscPosReceipt;

/**
 * Write binary buffer in chunks to Bluetooth characteristic to avoid GATT buffer overflow
 */
async function sendToBtCharacteristic(characteristic: any, data: Uint8Array): Promise<void> {
  const CHUNK_SIZE = 100;
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.subarray(offset, Math.min(offset + CHUNK_SIZE, data.length));
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // Small breathing pause for printer MCU buffer
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Connect to Thermal Printer via Web Bluetooth
 */
export async function connectBluetoothPrinter(): Promise<boolean> {
  if (!isBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth API tidak didukung pada browser ini (Gunakan Chrome/Edge di desktop atau Android).",
    );
  }

  try {
    currentPrinterInfo.status = "connecting";
    notifyListeners();

    const nav = navigator as any;
    const device = await nav.bluetooth
      .requestDevice({
        filters: [{ services: BT_SERVICE_UUIDS }],
        optionalServices: BT_SERVICE_UUIDS,
      })
      .catch(async () => {
        // Fallback: accept all devices
        return await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: BT_SERVICE_UUIDS,
        });
      });

    if (!device) {
      currentPrinterInfo.status = "disconnected";
      notifyListeners();
      return false;
    }

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Gagal terhubung ke GATT server Bluetooth.");

    let targetCharacteristic: any = null;

    // Search for writable characteristic across matching services
    for (const uuid of BT_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(uuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties?.write || char.properties?.writeValueWithoutResponse) {
            targetCharacteristic = char;
            break;
          }
        }
      } catch {
        // service not present on this device
      }
      if (targetCharacteristic) break;
    }

    if (!targetCharacteristic) {
      throw new Error("Karakteristik write ESC/POS tidak ditemukan pada printer Bluetooth ini.");
    }

    activeBtDevice = device;
    activeBtCharacteristic = targetCharacteristic;
    const cfg = getSavedPrinterConfig();

    currentPrinterInfo = {
      type: "bluetooth",
      name: device.name || "Bluetooth Thermal Printer",
      status: "connected",
      paperSize: cfg.paperSize,
      openCashDrawerOnCash: cfg.openCashDrawer,
    };

    device.addEventListener("gattserverdisconnected", () => {
      activeBtDevice = null;
      activeBtCharacteristic = null;
      currentPrinterInfo = {
        type: "none",
        name: "Belum Terhubung",
        status: "disconnected",
        paperSize: cfg.paperSize,
        openCashDrawerOnCash: cfg.openCashDrawer,
      };
      notifyListeners();
    });

    notifyListeners();
    return true;
  } catch (err: any) {
    currentPrinterInfo.status = "disconnected";
    notifyListeners();
    throw err;
  }
}

/**
 * Connect to Thermal Printer via Web USB Direct
 */
export async function connectUsbPrinter(): Promise<boolean> {
  if (!isUsbSupported()) {
    throw new Error("Web USB API tidak didukung pada browser ini (Gunakan Chrome/Edge).");
  }

  try {
    currentPrinterInfo.status = "connecting";
    notifyListeners();

    const nav = navigator as any;
    const device = await nav.usb.requestDevice({ filters: [] });
    if (!device) {
      currentPrinterInfo.status = "disconnected";
      notifyListeners();
      return false;
    }

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find interface and bulk out endpoint
    let targetInterfaceNum = 0;
    let targetEndpointNum = 1;

    const configuration = device.configuration;
    if (configuration && configuration.interfaces) {
      for (const iface of configuration.interfaces) {
        for (const alt of iface.alternates || []) {
          for (const ep of alt.endpoints || []) {
            if (ep.direction === "out" && ep.type === "bulk") {
              targetInterfaceNum = iface.interfaceNumber;
              targetEndpointNum = ep.endpointNumber;
              break;
            }
          }
        }
      }
    }

    await device.claimInterface(targetInterfaceNum);

    activeUsbDevice = device;
    activeUsbEndpoint = targetEndpointNum;
    const cfg = getSavedPrinterConfig();

    currentPrinterInfo = {
      type: "usb",
      name: device.productName || "USB Thermal Printer",
      status: "connected",
      paperSize: cfg.paperSize,
      openCashDrawerOnCash: cfg.openCashDrawer,
    };

    notifyListeners();
    return true;
  } catch (err: any) {
    currentPrinterInfo.status = "disconnected";
    notifyListeners();
    throw err;
  }
}

/**
 * Disconnect current active printer
 */
export async function disconnectPrinter(): Promise<void> {
  try {
    if (activeBtDevice && activeBtDevice.gatt?.connected) {
      activeBtDevice.gatt.disconnect();
    }
    if (activeUsbDevice) {
      await activeUsbDevice.close();
    }
  } catch (e) {
    console.warn("[ThermalPrinter] Disconnect warning:", e);
  } finally {
    activeBtDevice = null;
    activeBtCharacteristic = null;
    activeUsbDevice = null;
    const cfg = getSavedPrinterConfig();
    currentPrinterInfo = {
      type: "none",
      name: "Belum Terhubung",
      status: "disconnected",
      paperSize: cfg.paperSize,
      openCashDrawerOnCash: cfg.openCashDrawer,
    };
    notifyListeners();
  }
}

/**
 * Send Cash Drawer Pulse Kick (hex: 1B 70 00 19 FA)
 */
export async function kickCashDrawer(): Promise<boolean> {
  const kickBytes = new Uint8Array(ESC_POS.CASH_DRAWER_KICK_PIN2);
  try {
    if (currentPrinterInfo.status === "connected" && activeBtCharacteristic) {
      await sendToBtCharacteristic(activeBtCharacteristic, kickBytes);
      return true;
    }
    if (currentPrinterInfo.status === "connected" && activeUsbDevice) {
      await activeUsbDevice.transferOut(activeUsbEndpoint, kickBytes);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[ThermalPrinter] Cash drawer kick error:", err);
    return false;
  }
}

/**
 * Print receipt directly via Thermal Printer (BT/USB), with graceful fallback to window.print()
 */
export async function printReceipt(
  payload: ThermalReceiptPayload,
): Promise<{ success: boolean; mode: "thermal" | "browser" }> {
  const cfg = getSavedPrinterConfig();
  const effectivePaperSize = payload.paperSize || cfg.paperSize;
  const effectivePayload: ThermalReceiptPayload = {
    ...payload,
    paperSize: effectivePaperSize,
    autoCut: payload.autoCut ?? cfg.autoCut,
    openDrawer:
      payload.openDrawer ?? (cfg.openCashDrawer && payload.paymentMethod.toLowerCase() === "cash"),
  };

  // 1. Try Direct Thermal Printing if connected
  if (currentPrinterInfo.status === "connected") {
    try {
      const buffer = encodeEscPosReceipt(effectivePayload);
      if (activeBtCharacteristic) {
        await sendToBtCharacteristic(activeBtCharacteristic, buffer);
        return { success: true, mode: "thermal" };
      }
      if (activeUsbDevice) {
        await activeUsbDevice.transferOut(activeUsbEndpoint, buffer);
        return { success: true, mode: "thermal" };
      }
    } catch (err) {
      console.warn("[ThermalPrinter] Direct print failed, falling back to browser print:", err);
    }
  }

  // 2. Fallback to Browser Print
  if (isClient() && typeof window.print === "function") {
    window.print();
    return { success: true, mode: "browser" };
  }

  return { success: false, mode: "browser" };
}

/**
 * Execute a test print
 */
export async function testThermalPrint(): Promise<{
  success: boolean;
  mode: "thermal" | "browser";
}> {
  const cfg = getSavedPrinterConfig();
  const testPayload: ThermalReceiptPayload = {
    storeName: "KEBAB'S CHOICE",
    outletName: "Outlet Uji Coba",
    address: "Jl. Operasional POS Kasir",
    phone: "0859-1066-60608",
    headerMessage: "UJI COBA CETAK STRUK THERMAL",
    orderNumber: "TEST-001",
    cashierName: "Kasir Tester",
    paymentMethod: "CASH",
    createdAt: new Date().toISOString(),
    items: [
      {
        name: "Kebab Beef Jumbo (Pedas)",
        variantName: "Pedas Sedang",
        quantity: 1,
        price: 32000,
        subtotal: 32000,
      },
      {
        name: "Es Teh Manis Nusantara",
        quantity: 1,
        price: 8000,
        subtotal: 8000,
      },
    ],
    total: 40000,
    cashTendered: 50000,
    change: 10000,
    paperSize: cfg.paperSize,
    autoCut: cfg.autoCut,
    openDrawer: cfg.openCashDrawer,
    footerMessage: "Direct Thermal Printing ESC/POS Sukses!",
  };

  return await printReceipt(testPayload);
}
