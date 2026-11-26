export interface WhatsAppReceiptItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface WhatsAppReceiptPayload {
  storeName?: string;
  outletName: string;
  branchAddress?: string;
  orderNumber: string;
  orderType?: string;
  customerName?: string;
  customerQueueName?: string;
  customerPhone?: string;
  cashierName?: string;
  paymentMethod: string;
  createdAt?: string;
  items: WhatsAppReceiptItem[];
  subtotal?: number;
  discountAmount?: number;
  serviceChargeAmount?: number;
  taxAmount?: number;
  taxName?: string;
  taxRate?: number;
  taxMode?: "inclusive" | "exclusive" | string;
  total: number;
  cashReceived?: number;
  changeAmount?: number;
  footerMessage?: string;
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(amount) || 0));
}

export function normalizeWhatsAppPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  const digits = String(rawPhone).replace(/\D/g, "");
  if (!digits || digits.length < 9) return "";
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith("8")) {
    return `62${digits}`;
  }
  if (digits.startsWith("62")) {
    return digits;
  }
  return digits;
}

export function buildWhatsAppReceiptText(payload: WhatsAppReceiptPayload): string {
  const storeTitle = (payload.storeName || "Kebab's Choice").trim();
  const dateLabel = payload.createdAt
    ? new Date(payload.createdAt).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const lines: string[] = [];
  lines.push(`*${storeTitle.toUpperCase()}*`);
  lines.push(`Cabang: ${payload.outletName || "Outlet"}`);
  if (payload.branchAddress) {
    lines.push(payload.branchAddress);
  }
  lines.push("--------------------------------");
  lines.push(`No. Order: *#${payload.orderNumber}*`);
  lines.push(`Waktu: ${dateLabel}`);
  if (payload.orderType) {
    lines.push(`Tipe: ${payload.orderType.replace(/_/g, " ").toUpperCase()}`);
  }
  const customerDisplay = payload.customerName || payload.customerQueueName;
  if (customerDisplay) {
    lines.push(`Pelanggan: ${customerDisplay}`);
  }
  if (payload.cashierName) {
    lines.push(`Kasir: ${payload.cashierName}`);
  }
  lines.push("--------------------------------");

  for (const item of payload.items || []) {
    lines.push(`${item.quantity}x ${item.name}`);
    lines.push(`   ${formatIdr(item.price)} = *${formatIdr(item.subtotal)}*`);
  }

  lines.push("--------------------------------");
  if (payload.subtotal !== undefined) {
    lines.push(`Subtotal: ${formatIdr(payload.subtotal)}`);
  }
  if (payload.discountAmount && payload.discountAmount > 0) {
    lines.push(`Diskon: -${formatIdr(payload.discountAmount)}`);
  }
  if (payload.serviceChargeAmount && payload.serviceChargeAmount > 0) {
    lines.push(`Layanan: +${formatIdr(payload.serviceChargeAmount)}`);
  }
  if (payload.taxAmount && payload.taxAmount > 0) {
    const rateLabel = payload.taxRate ? ` (${payload.taxRate}%)` : "";
    const modeLabel = payload.taxMode === "inclusive" ? " [Include]" : "";
    lines.push(
      `${payload.taxName || "PB1"}${rateLabel}${modeLabel}: ${
        payload.taxMode === "inclusive"
          ? formatIdr(payload.taxAmount)
          : `+${formatIdr(payload.taxAmount)}`
      }`,
    );
  }
  lines.push(`*TOTAL: ${formatIdr(payload.total)}*`);
  lines.push(`Metode Bayar: ${(payload.paymentMethod || "CASH").toUpperCase()}`);

  if ((payload.paymentMethod || "").toUpperCase() === "CASH" && payload.cashReceived !== undefined) {
    const change = payload.changeAmount ?? Math.max(0, payload.cashReceived - payload.total);
    lines.push(`Tunai: ${formatIdr(payload.cashReceived)}`);
    lines.push(`Kembalian: ${formatIdr(change)}`);
  }

  lines.push("--------------------------------");
  lines.push(payload.footerMessage || "Terima kasih atas pesanan Anda di Kebab's Choice!");

  return lines.join("\n");
}

export function buildWhatsAppReceiptUrl(
  payload: WhatsAppReceiptPayload,
  explicitPhone?: string | null,
): string {
  const normalizedPhone = normalizeWhatsAppPhone(explicitPhone ?? payload.customerPhone);
  const receiptText = buildWhatsAppReceiptText(payload);
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(receiptText)}`
    : `https://wa.me/?text=${encodeURIComponent(receiptText)}`;
}

export function openWhatsAppReceipt(
  payload: WhatsAppReceiptPayload,
  explicitPhone?: string | null,
): void {
  if (typeof window === "undefined") return;
  const url = buildWhatsAppReceiptUrl(payload, explicitPhone);
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
