/**
 * Browser-only QR helpers (lazy-loaded so they never weigh on the first POS paint).
 *  - generateQrDataUrl: offline QR rendering (no external QR image API needed)
 *  - decodeQrFromImage: read the QR string from an uploaded QRIS sticker photo
 */

export async function generateQrDataUrl(
  text: string,
  options: { width?: number; margin?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H" } = {},
): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
    margin: options.margin ?? 2,
    width: options.width ?? 520,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar QRIS."));
    img.src = src;
  });
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

/**
 * Decode the first QR code found in an image (data URL / object URL / same-origin URL).
 * Tries the native BarcodeDetector (Chrome Android) first, then falls back to jsQR
 * on several scales. Returns null when no QR code could be read.
 */
export async function decodeQrFromImage(src: string): Promise<string | null> {
  if (typeof window === "undefined" || !src) return null;
  const img = await loadImage(src);

  const NativeDetector = (window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }).BarcodeDetector;
  if (NativeDetector) {
    try {
      const detector = new NativeDetector({ formats: ["qr_code"] });
      const found = await detector.detect(img);
      const value = found.find((f) => f.rawValue)?.rawValue;
      if (value) return value;
    } catch {
      /* fall through to jsQR */
    }
  }

  const jsQR = (await import("jsqr")).default;
  const naturalMax = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height) || 1;
  for (const target of [1000, 1600, 700, naturalMax]) {
    const scale = Math.min(1, target / naturalMax);
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const result = jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" });
    if (result?.data) return result.data;
  }
  return null;
}
