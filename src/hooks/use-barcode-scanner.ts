import { useEffect, useRef } from "react";

export interface UseBarcodeScannerOptions {
  /**
   * Callback fired when a valid barcode/SKU is captured from a hardware scanner.
   */
  onScan: (barcode: string) => void;
  /**
   * Maximum interval in milliseconds between consecutive characters to be considered scanner input.
   * Hardware scanners typically emit characters with < 40ms intervals.
   * @default 40
   */
  maxIntervalMs?: number;
  /**
   * Minimum character length of a valid barcode.
   * @default 3
   */
  minBarcodeLength?: number;
  /**
   * Whether the scanner listener is currently active.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Helper to determine if an element is an interactive input or editable field.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target.closest("input, textarea, select, [contenteditable='true'], [role='search']")) {
    return true;
  }
  return false;
}

/**
 * Custom hook for capturing physical Barcode Scanner (Keyboard Wedge) inputs.
 * Detects rapid sequence of keystrokes (< 40ms inter-character latency) terminated by "Enter".
 * Automatically ignores input when the cashier is typing inside an <input> or <textarea>.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 40,
  minBarcodeLength = 3,
  enabled = true,
}: UseBarcodeScannerOptions): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<string>("");
  const timestampsRef = useRef<number[]>([]);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Ignore if focus cursor is inside an input, textarea, or manual search modal
      if (isEditableTarget(event.target)) {
        bufferRef.current = "";
        timestampsRef.current = [];
        return;
      }

      if (typeof document !== "undefined" && document.activeElement) {
        if (isEditableTarget(document.activeElement)) {
          bufferRef.current = "";
          timestampsRef.current = [];
          return;
        }
      }

      // Ignore modifier keys alone (Shift, Control, Alt, Meta)
      if (
        event.key === "Shift" ||
        event.key === "Control" ||
        event.key === "Alt" ||
        event.key === "Meta"
      ) {
        return;
      }

      const now = Date.now();

      // 2. Barcode scanner sends Enter key at end of barcode sequence
      if (event.key === "Enter") {
        const buffer = bufferRef.current.trim();
        const timestamps = timestampsRef.current;

        // Check if we have accumulated enough characters
        if (buffer.length >= minBarcodeLength && timestamps.length >= 2) {
          // Calculate intervals between consecutive keypresses
          let isRapid = true;
          for (let i = 1; i < timestamps.length; i++) {
            const prev = timestamps[i - 1];
            const curr = timestamps[i];
            if (prev !== undefined && curr !== undefined && curr - prev > maxIntervalMs) {
              isRapid = false;
              break;
            }
          }

          if (isRapid) {
            // Scanner sequence verified! Prevent default Enter behavior
            event.preventDefault();
            event.stopPropagation();
            onScanRef.current(buffer);
          }
        }

        // Always reset buffer after Enter
        bufferRef.current = "";
        timestampsRef.current = [];
        lastKeyTimeRef.current = 0;
        return;
      }

      // 3. Process single character keys (printable characters)
      if (event.key.length === 1) {
        const dt = now - lastKeyTimeRef.current;

        // If too much time has elapsed since the previous character, reset buffer with this key
        if (bufferRef.current.length > 0 && dt > maxIntervalMs) {
          bufferRef.current = event.key;
          timestampsRef.current = [now];
        } else {
          bufferRef.current += event.key;
          timestampsRef.current.push(now);
        }

        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minBarcodeLength]);
}
