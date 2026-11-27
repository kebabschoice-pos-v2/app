/**
 * Render a thermal-style receipt onto an HTML5 <canvas> (580px wide, crisp white
 * background) and export it as a real PNG `File` so it can be shared to WhatsApp
 * as an IMAGE via the Web Share API (Android tablet: Bagikan -> WhatsApp).
 */
import {
  normalizeWhatsAppPhone,
  openWhatsAppReceipt,
  type WhatsAppReceiptPayload,
} from "@/lib/whatsapp-receipt";

export const RECEIPT_IMAGE_WIDTH = 580;

export interface ReceiptImageItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  /** Optional variant / modifier line printed under the item name */
  variant?: string | null;
  notes?: string | null;
}

export interface ReceiptImagePayload extends Omit<WhatsAppReceiptPayload, "items"> {
  items: ReceiptImageItem[];
  ojolOrderCode?: string | null;
  tableNumber?: string | null;
}

export type ShareReceiptImageResult = "shared" | "cancelled" | "downloaded" | "text";

const PAD_X = 30;
const CONTENT_W = RECEIPT_IMAGE_WIDTH - PAD_X * 2;
const FONT_STACK = `"Inter", "Roboto", "Segoe UI", Arial, sans-serif`;
const MONO_STACK = `"Roboto Mono", "Consolas", "Menlo", monospace`;
const INK = "#111111";
const MUTED = "#555555";

function formatIdr(amount: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Math.round(Number(amount) || 0),
  )}`;
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return safe.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeFilePart(value: string): string {
  return String(value || "order").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "order";
}

export function getReceiptImageFileName(orderNumber: string): string {
  return `struk-${sanitizeFilePart(orderNumber)}.png`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text || "").split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      // Hard-break very long single words
      let chunk = word;
      while (ctx.measureText(chunk).width > maxWidth && chunk.length > 1) {
        let cut = chunk.length - 1;
        while (cut > 1 && ctx.measureText(chunk.slice(0, cut)).width > maxWidth) cut--;
        lines.push(chunk.slice(0, cut));
        chunk = chunk.slice(cut);
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Draws the receipt; when `draw` is false only measures and returns the total height. */
function layoutReceipt(
  ctx: CanvasRenderingContext2D,
  payload: ReceiptImagePayload,
  draw: boolean,
): number {
  let y = 34;
  const font = (size: number, weight = 500, mono = false) =>
    `${weight} ${size}px ${mono ? MONO_STACK : FONT_STACK}`;

  const centered = (text: string, size: number, weight = 500, color = INK, gap = 6) => {
    ctx.font = font(size, weight);
    for (const line of wrapText(ctx, text, CONTENT_W)) {
      if (draw) {
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(line, RECEIPT_IMAGE_WIDTH / 2, y + size);
      }
      y += size + gap;
    }
  };

  const row = (
    label: string,
    value: string,
    opts: { size?: number; weight?: number; color?: string; valueColor?: string; mono?: boolean } = {},
  ) => {
    const size = opts.size ?? 20;
    const weight = opts.weight ?? 500;
    ctx.font = font(size, weight, opts.mono);
    const valueWidth = Math.min(ctx.measureText(value).width, CONTENT_W * 0.62);
    const labelLines = wrapText(ctx, label, CONTENT_W - valueWidth - 14);
    labelLines.forEach((line, idx) => {
      if (draw) {
        ctx.textAlign = "left";
        ctx.fillStyle = opts.color ?? INK;
        ctx.fillText(line, PAD_X, y + size);
        if (idx === 0) {
          ctx.textAlign = "right";
          ctx.fillStyle = opts.valueColor ?? opts.color ?? INK;
          ctx.fillText(value, RECEIPT_IMAGE_WIDTH - PAD_X, y + size, CONTENT_W * 0.62);
        }
      }
      y += size + 8;
    });
  };

  const divider = (dashed = true) => {
    y += 6;
    if (draw) {
      ctx.save();
      ctx.strokeStyle = "#222222";
      ctx.lineWidth = 2;
      ctx.setLineDash(dashed ? [9, 7] : []);
      ctx.beginPath();
      ctx.moveTo(PAD_X, y);
      ctx.lineTo(RECEIPT_IMAGE_WIDTH - PAD_X, y);
      ctx.stroke();
      ctx.restore();
    }
    y += 16;
  };

  // ---- Header: Nama Outlet + Alamat ----
  const storeTitle = (payload.storeName || "Kebab's Choice").trim().toUpperCase();
  centered(storeTitle, 32, 800, INK, 8);
  if (payload.outletName) centered(`Cabang: ${payload.outletName}`, 20, 600, INK);
  if (payload.branchAddress) centered(payload.branchAddress, 18, 400, MUTED);
  divider();

  // ---- Order meta ----
  row("No. Order", `#${payload.orderNumber}`, { weight: 700 });
  const queue = payload.customerQueueName || "";
  if (queue) row("Antrean", queue, { size: 24, weight: 800 });
  if (payload.ojolOrderCode) row("Kode Ojol", String(payload.ojolOrderCode), { weight: 700 });
  row("Tanggal", formatDate(payload.createdAt));
  if (payload.cashierName) row("Kasir", payload.cashierName);
  if (payload.customerName && payload.customerName !== queue) row("Pelanggan", payload.customerName);
  if (payload.orderType) {
    const typeLabel = payload.orderType.replace(/_/g, " ").toUpperCase();
    row("Tipe", payload.tableNumber ? `${typeLabel} (Meja ${payload.tableNumber})` : typeLabel);
  }
  divider();

  // ---- Items ----
  for (const item of payload.items || []) {
    const rawName = String(item.name || "").trim();
    const rawVariant = String(item.variant || "").trim();
    const variantAlreadyInName =
      Boolean(rawVariant) && rawName.toLowerCase().includes(rawVariant.toLowerCase());
    ctx.font = font(21, 700);
    for (const line of wrapText(ctx, rawName, CONTENT_W)) {
      if (draw) {
        ctx.textAlign = "left";
        ctx.fillStyle = INK;
        ctx.fillText(line, PAD_X, y + 21);
      }
      y += 28;
    }
    const extra = [
      !variantAlreadyInName ? rawVariant : "",
      item.notes ? `"${item.notes}"` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    if (extra) {
      ctx.font = font(17, 500);
      for (const line of wrapText(ctx, extra, CONTENT_W - 16)) {
        if (draw) {
          ctx.textAlign = "left";
          ctx.fillStyle = MUTED;
          ctx.fillText(line, PAD_X + 16, y + 17);
        }
        y += 24;
      }
    }
    row(`  ${item.quantity} x ${formatIdr(item.price)}`, formatIdr(item.subtotal), {
      size: 19,
      color: MUTED,
      valueColor: INK,
      mono: true,
    });
    y += 4;
  }
  divider();

  // ---- Totals ----
  if (payload.subtotal !== undefined) row("Subtotal", formatIdr(payload.subtotal));
  if (payload.discountAmount && payload.discountAmount > 0) {
    row("Diskon", `-${formatIdr(payload.discountAmount)}`, { valueColor: "#B91C1C" });
  }
  if (payload.serviceChargeAmount && payload.serviceChargeAmount > 0) {
    row("Layanan", `+${formatIdr(payload.serviceChargeAmount)}`);
  }
  if (payload.taxAmount && payload.taxAmount > 0) {
    const rateLabel = payload.taxRate ? ` (${payload.taxRate}%)` : "";
    const inclusive = payload.taxMode === "inclusive";
    row(
      `${payload.taxName || "PB1"}${rateLabel}${inclusive ? " Include" : ""}`,
      inclusive ? formatIdr(payload.taxAmount) : `+${formatIdr(payload.taxAmount)}`,
    );
  }
  divider(false);
  row("TOTAL", formatIdr(payload.total), { size: 28, weight: 800 });
  row("Metode Bayar", (payload.paymentMethod || "CASH").toUpperCase(), { weight: 600 });
  const isCash = (payload.paymentMethod || "").toUpperCase() === "CASH";
  if (isCash) {
    const cash = payload.cashReceived ?? payload.total;
    const change = payload.changeAmount ?? Math.max(0, cash - payload.total);
    row("Tunai", formatIdr(cash));
    row("Kembalian", formatIdr(change), { weight: 800, size: 22 });
  }
  divider();

  // ---- Footer ----
  centered(payload.footerMessage || "Terima kasih atas kunjungan Anda!", 19, 600, INK);
  y += 22;
  return Math.ceil(y);
}

/** Draw the receipt onto a new 580px canvas (browser only). */
export function renderReceiptCanvas(payload: ReceiptImagePayload): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_IMAGE_WIDTH;
  canvas.height = 200;
  const measureCtx = canvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas 2D tidak didukung perangkat ini.");
  const height = layoutReceipt(measureCtx, payload, false);

  canvas.height = Math.max(240, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung perangkat ini.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "alphabetic";
  layoutReceipt(ctx, payload, true);
  return canvas;
}

/** Render the receipt and return it as a PNG `File` named `struk-<orderNumber>.png`. */
export async function buildReceiptPngFile(payload: ReceiptImagePayload): Promise<File> {
  const canvas = renderReceiptCanvas(payload);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar struk."))), "image/png");
  });
  return new File([blob], getReceiptImageFileName(payload.orderNumber), { type: "image/png" });
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function isNativeCapacitor(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * "Kirim Struk WA": share the receipt as a real PNG image through the Web Share API
 * (`navigator.share({ files: [pngFile], title: "Struk KebabsChoice" })`).
 * Fallbacks: download PNG + open WhatsApp text chat (desktop), or WhatsApp text only
 * (native WebView / canvas unavailable).
 */
export async function shareReceiptImage(
  payload: ReceiptImagePayload,
  explicitPhone?: string | null,
): Promise<ShareReceiptImageResult> {
  if (typeof window === "undefined") return "text";
  const textPayload: WhatsAppReceiptPayload = {
    ...payload,
    items: (payload.items || []).map((it) => ({
      name: it.variant ? `${it.name} (${it.variant})` : it.name,
      quantity: it.quantity,
      price: it.price,
      subtotal: it.subtotal,
    })),
  };

  let pngFile: File | null = null;
  try {
    pngFile = await buildReceiptPngFile(payload);
  } catch (err) {
    console.warn("[Receipt Image] Gagal render struk PNG, fallback teks WA:", err);
  }

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (pngFile && typeof nav.share === "function") {
    const shareData: ShareData = { files: [pngFile], title: "Struk KebabsChoice" };
    let canShareFiles = true;
    if (typeof nav.canShare === "function") {
      try {
        canShareFiles = nav.canShare(shareData) || nav.canShare({ files: [pngFile] });
      } catch {
        canShareFiles = false;
      }
    }
    if (canShareFiles) {
      try {
        await nav.share({ files: [pngFile], title: "Struk KebabsChoice" });
        return "shared";
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return "cancelled";
        console.warn("[Receipt Image] navigator.share gagal, fallback:", err);
      }
    }
  }

  // Desktop / browsers without file sharing: save PNG so it can be attached, then open WA chat.
  if (pngFile && !isNativeCapacitor()) {
    downloadFile(pngFile);
    openWhatsAppReceipt(textPayload, normalizeWhatsAppPhone(explicitPhone ?? payload.customerPhone) || undefined);
    return "downloaded";
  }

  openWhatsAppReceipt(textPayload, explicitPhone ?? payload.customerPhone);
  return "text";
}
