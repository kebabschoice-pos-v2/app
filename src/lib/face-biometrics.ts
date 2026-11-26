export const FACE_MATCH_THRESHOLD = 0.5;
export const FACE_DESCRIPTOR_LENGTH = 128;
export const STORAGE_FACE_DESCRIPTORS_KEY = "kebabschoicepos_face_descriptors_v1";

type FaceApiModule = typeof import("@vladmandic/face-api");

let faceApiPromise: Promise<FaceApiModule> | null = null;
let modelsLoadedPromise: Promise<boolean> | null = null;

async function getFaceApi(): Promise<FaceApiModule> {
  if (typeof window === "undefined") {
    throw new Error("Face biometrics hanya berjalan di browser.");
  }
  if (!faceApiPromise) {
    faceApiPromise = import("@vladmandic/face-api");
  }
  return faceApiPromise;
}

export async function ensureFaceModelsLoaded(modelBaseUrl = "/models"): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = (async () => {
      try {
        const faceapi = await getFaceApi();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelBaseUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl),
        ]);
        return true;
      } catch (err) {
        modelsLoadedPromise = null;
        console.error("[face-biometrics] Gagal memuat model pengenalan wajah:", err);
        return false;
      }
    })();
  }
  return modelsLoadedPromise;
}

export function isValidFaceDescriptor(desc: unknown): desc is number[] {
  return (
    Array.isArray(desc) &&
    desc.length === FACE_DESCRIPTOR_LENGTH &&
    desc.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function computeFaceEuclideanDistance(descA: number[], descB: number[]): number {
  if (!isValidFaceDescriptor(descA) || !isValidFaceDescriptor(descB)) {
    return Number.POSITIVE_INFINITY;
  }
  let sumSq = 0;
  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
    const diff = (descA[i] ?? 0) - (descB[i] ?? 0);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

export function verifyFaceMatch(
  liveDescriptor: number[],
  registeredDescriptor: number[],
  threshold = FACE_MATCH_THRESHOLD,
): {
  matched: boolean;
  distance: number;
  similarityPct: number;
} {
  const distance = computeFaceEuclideanDistance(liveDescriptor, registeredDescriptor);
  const matched = Number.isFinite(distance) && distance <= threshold;
  const similarityPct = Number.isFinite(distance)
    ? Math.max(0, Math.min(99, Math.round((1 - distance / 1.0) * 100)))
    : 0;
  return { matched, distance, similarityPct };
}

export async function extractFaceDescriptorFromElement(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<{ descriptor: number[]; score: number } | null> {
  const ready = await ensureFaceModelsLoaded();
  if (!ready) {
    throw new Error("Model biometrik wajah belum siap dimuat.");
  }
  const faceapi = await getFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.4,
  });
  const detection = await faceapi
    .detectSingleFace(source, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) {
    return null;
  }

  const descriptor = Array.from(detection.descriptor).map((n) => Number(n.toFixed(6)));
  if (!isValidFaceDescriptor(descriptor)) {
    return null;
  }
  return {
    descriptor,
    score: detection.detection.score,
  };
}

export async function extractFaceDescriptorFromDataUrl(
  dataUrl: string,
): Promise<{ descriptor: number[]; score: number } | null> {
  if (typeof window === "undefined" || !dataUrl) return null;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(e);
    el.src = dataUrl;
  });
  return extractFaceDescriptorFromElement(img);
}

function normalizeStaffKey(key?: string | null): string {
  return String(key || "").trim().toLowerCase();
}

export function getCachedFaceDescriptor(
  userId?: string | null,
  fullName?: string | null,
): number[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_FACE_DESCRIPTORS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number[]>;
    const byId = userId ? map[`id:${normalizeStaffKey(userId)}`] : undefined;
    if (isValidFaceDescriptor(byId)) return byId;
    const byName = fullName ? map[`name:${normalizeStaffKey(fullName)}`] : undefined;
    if (isValidFaceDescriptor(byName)) return byName;
  } catch {}
  return null;
}

export function saveCachedFaceDescriptor(
  userId: string,
  fullName: string,
  descriptor: number[],
): void {
  if (typeof window === "undefined" || !isValidFaceDescriptor(descriptor)) return;
  try {
    const raw = localStorage.getItem(STORAGE_FACE_DESCRIPTORS_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    if (userId) map[`id:${normalizeStaffKey(userId)}`] = descriptor;
    if (fullName) map[`name:${normalizeStaffKey(fullName)}`] = descriptor;
    localStorage.setItem(STORAGE_FACE_DESCRIPTORS_KEY, JSON.stringify(map));
  } catch {}
}
