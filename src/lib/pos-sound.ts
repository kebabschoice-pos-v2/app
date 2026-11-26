export type PosSoundMode = "off" | "beep" | "pop" | "chime";

export const POS_SOUND_OPTIONS: Array<{
  value: PosSoundMode;
  label: string;
  desc: string;
}> = [
  { value: "off", label: "Mati", desc: "Tanpa suara" },
  { value: "beep", label: "Beep Klasik", desc: "Default kasir" },
  { value: "pop", label: "Pop Lembut", desc: "Halus modern" },
  { value: "chime", label: "Chime", desc: "Nada jernih" },
];

export const STORAGE_POS_SOUND_KEY = "kebabschoicepos_sound_mode";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function isValidPosSoundMode(val: unknown): val is PosSoundMode {
  return val === "off" || val === "beep" || val === "pop" || val === "chime";
}

export function getStoredPosSoundMode(): PosSoundMode {
  if (typeof window === "undefined") return "beep";
  try {
    const saved = localStorage.getItem(STORAGE_POS_SOUND_KEY);
    if (isValidPosSoundMode(saved)) return saved;
  } catch {}
  return "beep";
}

export function savePosSoundMode(mode: PosSoundMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_POS_SOUND_KEY, mode);
  } catch {}
  window.dispatchEvent(new CustomEvent("pos:sound-changed", { detail: mode }));
}

function synthesizeSound(
  ctx: AudioContext,
  mode: Exclude<PosSoundMode, "off">,
  trigger: "tap" | "option" | "pay" | "success",
) {
  const now = ctx.currentTime;

  if (mode === "beep") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const baseFreq = trigger === "pay" || trigger === "success" ? 1046.5 : trigger === "option" ? 784 : 880;
    osc.frequency.setValueAtTime(baseFreq, now);
    if (trigger === "pay" || trigger === "success") {
      osc.frequency.setValueAtTime(1318.5, now + 0.055);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (trigger === "pay" || trigger === "success" ? 0.13 : 0.065));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
    return;
  }

  if (mode === "pop") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    const startFreq = trigger === "pay" || trigger === "success" ? 520 : trigger === "option" ? 360 : 420;
    const endFreq = trigger === "pay" || trigger === "success" ? 260 : 170;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
    return;
  }

  // "chime"
  const freqs =
    trigger === "pay" || trigger === "success"
      ? [659.25, 987.77]
      : trigger === "option"
        ? [587.33]
        : [659.25, 880];
  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const t0 = now + idx * 0.035;
    osc.frequency.setValueAtTime(f, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  });
}

export function playPosSound(trigger: "tap" | "option" | "pay" | "success" = "tap"): void {
  const mode = getStoredPosSoundMode();
  if (mode === "off") return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    synthesizeSound(ctx, mode, trigger);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function testPosSound(explicitMode?: PosSoundMode): void {
  const mode = explicitMode ?? getStoredPosSoundMode();
  if (mode === "off") return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    synthesizeSound(ctx, mode, "pay");
  } catch {}
}
