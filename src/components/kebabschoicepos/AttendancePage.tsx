import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Clock,
  Calendar,
  LogOut,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Store,
  Laptop,
  Smartphone,
  Eye,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import {
  recordAttendance,
  getAttendanceList,
  getStaffShifts,
  getHRStaffProfiles,
  updateHRStaffProfile,
  getRosterSchedule,
  formatLocalDateWIB,
  type StaffAttendance,
  type StaffShift,
  type StaffProfile,
  type MonthlyRosterSchedule,
} from "@/services/hr.service";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";
import { getStaffList, isOutletDeviceAccount, isOwnerAccount, type StaffItem } from "@/services/staff.service";
import {
  ensureFaceModelsLoaded,
  extractFaceDescriptorFromElement,
  FACE_MATCH_THRESHOLD,
  getCachedFaceDescriptor,
  isValidFaceDescriptor,
  saveCachedFaceDescriptor,
  verifyFaceMatch,
} from "@/lib/face-biometrics";
import { playPosSound } from "@/lib/pos-sound";

interface AttendancePageProps {
  initialTab?: "in" | "out" | "history" | "shifts";
  snapshot?: any;
  profile?: any;
  onRefresh?: () => Promise<void> | void;
}

export function AttendancePage({
  initialTab = "in",
  snapshot,
  profile,
  onRefresh,
}: AttendancePageProps) {
  const [tab, setTab] = useState<"in" | "out" | "history" | "shifts">(initialTab);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [rosterSchedule, setRosterSchedule] = useState<MonthlyRosterSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedOutletState, setResolvedOutletState] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_active_outlet");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id && parsed.id !== "all" && parsed.id !== "default") {
            return { id: parsed.id, name: parsed.name || "Cabang Aktif" };
          }
        }
        const savedId =
          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
          localStorage.getItem("kebabschoicepos_active_outlet_id");
        if (savedId && savedId !== "all" && savedId !== "default") {
          const matched = (snapshot?.outlets as any[])?.find((o: any) => o.id === savedId);
          return { id: savedId, name: matched?.name || "Cabang Aktif" };
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    const syncActiveOutlet = () => {
      resolveActiveStaffOutlet()
        .then((res) => {
          if (res && res.outletId && res.outletId !== "default") {
            setResolvedOutletState({ id: res.outletId, name: res.outletName });
          }
        })
        .catch(() => undefined);
    };
    syncActiveOutlet();

    const handleOutletChanged = (e: any) => {
      if (e?.detail?.outletId) {
        const nextId = e.detail.outletId;
        const nextName =
          e.detail.outletName ||
          (snapshot?.outlets as any[])?.find((o: any) => o.id === nextId)?.name ||
          "Cabang Aktif";
        setResolvedOutletState({ id: nextId, name: nextName });
      } else {
        syncActiveOutlet();
      }
    };
    window.addEventListener("outlet:changed", handleOutletChanged);
    return () => window.removeEventListener("outlet:changed", handleOutletChanged);
  }, [snapshot?.assignedOutletId, snapshot?.outlets]);

  // Active Outlet: Prioritize resolved staff/owner outlet, then snapshot assigned outlet
  const activeOutlet =
    resolvedOutletState ||
    (snapshot?.assignedOutletId
      ? (snapshot?.outlets as any[])?.find((o: any) => o.id === snapshot.assignedOutletId)
      : null) ||
    snapshot?.outlets?.[0] || {
      id: "out-main",
      name: "Outlet Utama",
    };

  // Selected Employee for Attendance
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  // Branch staff filtered for active outlet (strictly operational branch staff, excluding OWNER)
  const branchStaffProfiles = useMemo(() => {
    const nonOwners = staffList.filter(
      (s) => !isOwnerAccount(s) && s.full_name.trim().toLowerCase() !== "iky",
    );
    const filtered = nonOwners.filter(
      (s) => !s.outlet_id || s.outlet_id === activeOutlet.id || s.outlet_id === "all",
    );
    return filtered.length > 0 ? filtered : nonOwners;
  }, [staffList, activeOutlet.id]);

  // Always keep selectedStaffId synced to a valid operational member of branchStaffProfiles
  useEffect(() => {
    if (branchStaffProfiles.length === 0) return;
    const isStillValid = branchStaffProfiles.some((p) => p.user_id === selectedStaffId);
    if (!selectedStaffId || !isStillValid) {
      const activeCashier =
        typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_active_cashier_name")
          : null;
      const found =
        (activeCashier && activeCashier.trim().toLowerCase() !== "iky"
          ? branchStaffProfiles.find(
              (p) => p.full_name.trim().toLowerCase() === activeCashier.trim().toLowerCase(),
            )
          : null) ||
        branchStaffProfiles.find((p) => p.user_id === profile?.id && !isOwnerAccount(p)) ||
        branchStaffProfiles[0];
      if (found) setSelectedStaffId(found.user_id);
    }
  }, [branchStaffProfiles, selectedStaffId, profile?.id]);

  // Camera & Real Biometric Face Recognition State (Tanpa PIN Karyawan)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnrollingFace, setIsEnrollingFace] = useState(false);
  const [forceReEnrollMode, setForceReEnrollMode] = useState(false);
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [faceRejectMessage, setFaceRejectMessage] = useState<string | null>(null);
  const [lastMatchDistance, setLastMatchDistance] = useState<number | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [, setCapturedSnapshot] = useState<string | null>(null);

  const canManageFaceReEnroll = useMemo(() => {
    const r = String(snapshot?.role || "").toLowerCase();
    return ["owner", "admin", "hq", "manager"].includes(r);
  }, [snapshot?.role]);

  useEffect(() => {
    setFaceRejectMessage(null);
    setLastMatchDistance(null);
    setForceReEnrollMode(false);
  }, [selectedStaffId, tab]);

  // Success Confirmation Modal
  const [successRecord, setSuccessRecord] = useState<StaffAttendance | null>(null);

  // Image preview modal in history
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  async function loadData() {
    try {
      setLoading(true);
      await resolveAuthenticatedUser().catch(() => null);
      const now = new Date();

      // Resolve active outlet dynamically from profile / session
      let targetOutletId = activeOutlet.id;
      let targetOutletName = activeOutlet.name;
      try {
        const resolved = await resolveActiveStaffOutlet(profile?.id);
        if (resolved && resolved.outletId) {
          targetOutletId = resolved.outletId;
          targetOutletName = resolved.outletName || targetOutletName;
          setResolvedOutletState({ id: resolved.outletId, name: targetOutletName });
        }
      } catch {}

      const [profiles, rawStaffList, shiftList, attList, roster] = await Promise.all([
        getHRStaffProfiles(snapshot?.businessId).catch(() => [] as StaffProfile[]),
        getStaffList().catch(() => [] as StaffItem[]),
        getStaffShifts(targetOutletId).catch(() => [] as StaffShift[]),
        getAttendanceList({ outletId: targetOutletId }).catch(() => [] as StaffAttendance[]),
        getRosterSchedule(targetOutletId, now.getMonth() + 1, now.getFullYear()).catch(
          () => null,
        ),
      ]);

      // Unify HR profiles + getStaffList() + snapshot.outlets roster (strictly operational branch staff, excluding OWNER)
      const nonOwnerInitial = profiles.filter(
        (p) => !isOwnerAccount(p) && p.full_name.trim().toLowerCase() !== "iky",
      );
      const mergedProfiles: StaffProfile[] = [...nonOwnerInitial];
      const seenKeys = new Set<string>(nonOwnerInitial.map((p) => p.user_id));
      const seenNames = new Set<string>(nonOwnerInitial.map((p) => p.full_name.trim().toLowerCase()));
      const outletListForCheck = (snapshot?.outlets as any[]) || [];

      for (const st of rawStaffList) {
        const key = st.user_id || st.id;
        const cleanName = String(st.name || "").trim();
        if (
          !key ||
          !cleanName ||
          cleanName.toLowerCase() === "iky" ||
          seenKeys.has(key) ||
          seenNames.has(cleanName.toLowerCase()) ||
          isOutletDeviceAccount(st, outletListForCheck) ||
          isOwnerAccount(st)
        ) {
          continue;
        }
        seenKeys.add(key);
        seenNames.add(cleanName.toLowerCase());
        mergedProfiles.push({
          id: `hr-prof-${key}`,
          user_id: key,
          outlet_id: st.outlet_id || null,
          outlet_name: st.outlet_name || st.outlet || targetOutletName,
          full_name: cleanName,
          phone: "-",
          address: "-",
          avatar_url: st.avatar_url || null,
          face_descriptor: getCachedFaceDescriptor(key, cleanName) || null,
          job_title:
            st.role === "manager"
              ? "Store Manager"
              : st.role === "cashier"
                ? "Kasir POS"
                : "Staff Operasional",
          role: st.role || "cashier",
          employment_status: "Tetap",
          join_date: "2026-01-01",
        } as StaffProfile);
      }

      for (const out of outletListForCheck) {
        const s = (out?.settings && typeof out.settings === "object" ? out.settings : {}) as any;
        const rosterArr: any[] = Array.isArray(s.outlet_staff_roster) ? s.outlet_staff_roster : [];
        for (const emp of rosterArr) {
          const cleanName = String(emp.name || emp.full_name || "").trim();
          if (
            !cleanName ||
            cleanName.toLowerCase() === "iky" ||
            isOutletDeviceAccount(emp, outletListForCheck) ||
            isOwnerAccount(emp)
          ) {
            continue;
          }
          const key =
            emp.user_id ||
            emp.id ||
            `emp-${out.id}-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          if (seenKeys.has(key) || seenNames.has(cleanName.toLowerCase())) continue;
          seenKeys.add(key);
          seenNames.add(cleanName.toLowerCase());
          mergedProfiles.push({
            id: `hr-prof-${key}`,
            user_id: key,
            outlet_id: out.id || null,
            outlet_name: out.name || targetOutletName,
            full_name: cleanName,
            phone: emp.phone || "-",
            address: emp.address || "-",
            avatar_url: emp.avatar_url || null,
            face_descriptor: isValidFaceDescriptor(emp.face_descriptor)
              ? emp.face_descriptor
              : getCachedFaceDescriptor(key, cleanName) || null,
            job_title: emp.job_title || "Kasir POS",
            role: (emp.role as any) || "cashier",
            employment_status: emp.employment_status || "Tetap",
            join_date: "2026-01-01",
          } as StaffProfile);
        }
      }

      setStaffList(mergedProfiles);
      setShifts(shiftList);
      setAttendances(attList);
      if (roster) setRosterSchedule(roster);

      // Preselect active cashier from shift or first available operational branch staff member (never Owner)
      if (mergedProfiles.length > 0) {
        const activeCashier =
          typeof window !== "undefined"
            ? localStorage.getItem("kebabschoicepos_active_cashier_name")
            : null;
        const outletProfiles = mergedProfiles.filter(
          (p) => !p.outlet_id || p.outlet_id === targetOutletId || p.outlet_id === "all",
        );
        const candidateProfiles = outletProfiles.length > 0 ? outletProfiles : mergedProfiles;
        const currentIsValid = candidateProfiles.some((p) => p.user_id === selectedStaffId);
        if (!selectedStaffId || !currentIsValid) {
          const found =
            (activeCashier && activeCashier.trim().toLowerCase() !== "iky"
              ? candidateProfiles.find(
                  (p) => p.full_name.trim().toLowerCase() === activeCashier.trim().toLowerCase(),
                )
              : null) ||
            candidateProfiles.find((p) => p.user_id === profile?.id && !isOwnerAccount(p)) ||
            candidateProfiles[0];
          if (found) setSelectedStaffId(found.user_id);
        }
      }
    } catch (err) {
      console.error("[AttendancePage] Load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const snapshotOutletsCount = Array.isArray(snapshot?.outlets) ? snapshot.outlets.length : 0;

  useEffect(() => {
    loadData();
    const handleShiftsUpdate = () => {
      getStaffShifts(activeOutlet.id).then(setShifts).catch(() => {});
    };
    const handleSync = () => {
      loadData();
    };
    window.addEventListener("hr:shifts-updated", handleShiftsUpdate);
    window.addEventListener("app:snapshot-ready", handleSync);
    window.addEventListener("outlet:changed", handleSync);
    window.addEventListener("outlet:staff-updated", handleSync);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        loadData();
      }
    });
    return () => {
      window.removeEventListener("hr:shifts-updated", handleShiftsUpdate);
      window.removeEventListener("app:snapshot-ready", handleSync);
      window.removeEventListener("outlet:changed", handleSync);
      window.removeEventListener("outlet:staff-updated", handleSync);
      subscription.unsubscribe();
    };
  }, [activeOutlet.id, snapshot?.businessId, snapshotOutletsCount]);

  // Camera Management
  async function startCamera() {
    try {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraActive(true);
        }
      } else {
        setCameraError("Perangkat kamera tidak didukung pada browser ini.");
      }
    } catch (err) {
      console.warn("[startCamera] Camera access error:", err);
      setCameraError("Kamera tidak dapat diakses atau izin kamera ditolak.");
      setIsCameraActive(false);
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }

  useEffect(() => {
    if (tab === "in" || tab === "out") {
      startCamera();
      ensureFaceModelsLoaded()
        .then((ok) => setFaceModelsReady(ok))
        .catch(() => setFaceModelsReady(false));
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [tab]);

  // Capture live frame into hidden canvas and return JPEG dataURL
  function captureLiveCanvasFrame(): { canvas: HTMLCanvasElement; dataUrl: string } | null {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      return null;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      canvas,
      dataUrl: canvas.toDataURL("image/jpeg", 0.86),
    };
  }

  const selectedStaffProfile = useMemo(
    () => staffList.find((s) => s.user_id === selectedStaffId) || null,
    [staffList, selectedStaffId],
  );

  const selectedStaffDescriptor = useMemo(() => {
    if (!selectedStaffProfile) return null;
    if (isValidFaceDescriptor(selectedStaffProfile.face_descriptor)) {
      return selectedStaffProfile.face_descriptor;
    }
    return getCachedFaceDescriptor(
      selectedStaffProfile.user_id,
      selectedStaffProfile.full_name,
    );
  }, [selectedStaffProfile]);

  const isFirstTimeEnrollmentNeeded =
    Boolean(selectedStaffProfile) && (!selectedStaffDescriptor || forceReEnrollMode);

  // Enroll First-Time (or Manager Re-Enroll) Real 128D Face Descriptor
  async function handleEnrollFaceDescriptor() {
    const staff = selectedStaffProfile;
    if (!staff) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    if (!isCameraActive) {
      toast.error("Aktifkan kamera terlebih dahulu untuk mendaftarkan wajah.");
      return;
    }

    setFaceRejectMessage(null);
    setIsEnrollingFace(true);
    setScanProgress(30);

    try {
      const captured = captureLiveCanvasFrame();
      if (!captured) {
        toast.error("Kamera belum siap menangkap gambar wajah.");
        return;
      }
      setScanProgress(65);
      const detection = await extractFaceDescriptorFromElement(captured.canvas);
      if (!detection) {
        const msg = `Wajah ${staff.full_name} belum terdeteksi jelas di kamera. Hadapkan wajah lurus ke kamera dengan cahaya cukup.`;
        setFaceRejectMessage(msg);
        toast.error(msg);
        return;
      }

      setScanProgress(90);
      saveCachedFaceDescriptor(staff.user_id, staff.full_name, detection.descriptor);
      await updateHRStaffProfile(staff.user_id, {
        full_name: staff.full_name,
        outlet_id: staff.outlet_id,
        role: staff.role,
        job_title: staff.job_title,
        employment_status: staff.employment_status,
        avatar_url: captured.dataUrl,
        face_descriptor: detection.descriptor,
      });

      setStaffList((prev) =>
        prev.map((s) =>
          s.user_id === staff.user_id
            ? { ...s, avatar_url: captured.dataUrl, face_descriptor: detection.descriptor }
            : s,
        ),
      );
      setForceReEnrollMode(false);
      playPosSound("success");
      toast.success(`Wajah biometrik ${staff.full_name} berhasil didaftarkan!`, {
        description: "Sekarang silakan ketuk tombol Absen untuk verifikasi kehadiran.",
      });
    } catch (err: any) {
      console.error("[handleEnrollFaceDescriptor] Error:", err);
      toast.error(err?.message || "Gagal mendaftarkan biometrik wajah");
    } finally {
      setIsEnrollingFace(false);
      setScanProgress(0);
    }
  }

  // Trigger Real Biometric Face Descriptor Match & Record Attendance (Tanpa PIN)
  async function handleScanAndVerify() {
    const staff = selectedStaffProfile;
    if (!staff) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }

    const registeredDesc = selectedStaffDescriptor;
    if (!registeredDesc) {
      const msg = `${staff.full_name} belum mendaftarkan wajah biometrik. Daftarkan wajah terlebih dahulu.`;
      setFaceRejectMessage(msg);
      toast.error(msg);
      return;
    }

    if (!isCameraActive) {
      const msg = "Kamera belum aktif. Aktifkan kamera terlebih dahulu untuk verifikasi wajah asli.";
      setFaceRejectMessage(msg);
      toast.error(msg);
      return;
    }

    setFaceRejectMessage(null);
    setLastMatchDistance(null);
    setIsScanning(true);
    setScanProgress(25);

    try {
      const captured = captureLiveCanvasFrame();
      if (!captured) {
        throw new Error("Kamera belum siap menangkap gambar.");
      }

      setScanProgress(60);
      const liveDetection = await extractFaceDescriptorFromElement(captured.canvas);
      if (!liveDetection) {
        const msg =
          "Wajah tidak terdeteksi jelas di kamera. Posisikan wajah lurus di tengah frame dengan pencahayaan cukup.";
        setFaceRejectMessage(msg);
        toast.error(msg);
        return;
      }

      setScanProgress(85);
      const matchResult = verifyFaceMatch(
        liveDetection.descriptor,
        registeredDesc,
        FACE_MATCH_THRESHOLD,
      );
      setLastMatchDistance(matchResult.distance);

      if (!matchResult.matched) {
        const rejectMsg = `Wajah tidak cocok dengan data ${staff.full_name}. Pastikan memilih nama sendiri.`;
        setFaceRejectMessage(rejectMsg);
        toast.error(rejectMsg, {
          description: `Jarak biometrik ${matchResult.distance.toFixed(2)} > batas maksimal ${FACE_MATCH_THRESHOLD.toFixed(2)}`,
        });
        return;
      }

      setScanProgress(100);
      setCapturedSnapshot(captured.dataUrl);

      const result = await recordAttendance({
        userId: staff.user_id,
        staffName: staff.full_name,
        outletId: activeOutlet.id,
        outletName: activeOutlet.name || "Outlet Cabang",
        type: tab === "out" ? "out" : "in",
        faceSnapshotUrl: captured.dataUrl,
      });

      playPosSound("success");
      setSuccessRecord(result);
      const statusLabel =
        result.status === "late"
          ? `Terlambat ${result.late_minutes ? `(${result.late_minutes} menit)` : ""}`
          : "Tepat Waktu";
      toast.success(
        `Absensi ${tab === "out" ? "Keluar" : "Masuk"} berhasil dicatat! Status: ${statusLabel}`,
      );

      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      console.error("[handleScanAndVerify] Error:", err);
      toast.error(err?.message || "Gagal memverifikasi absensi wajah");
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  }

  return (
    <div className="space-y-3 pb-6">
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Compact Top Bar: Title + Navigation Tabs */}
      <div className="rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-primary font-bold text-[11px] uppercase tracking-wider">
                <Store className="size-3 shrink-0" />
                <span className="truncate">{activeOutlet.name} · Biometrik Wajah Asli</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight truncate">
                Absensi & Jadwal Shift Karyawan
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setTab("in")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                tab === "in"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="size-3.5" />
              <span>Absensi Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("out")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                tab === "out"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogOut className="size-3.5" />
              <span>Absensi Keluar</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("history")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                tab === "history"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="size-3.5" />
              <span>Riwayat</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("shifts")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                tab === "shifts"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5" />
              <span>Jadwal Shift</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1 & 2. ABSENSI MASUK & KELUAR — 2 KOLOM KOMPAK TABLET     */}
      {/* ======================================================== */}
      {(tab === "in" || tab === "out") && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* KOLOM KIRI (md:col-span-5): Kamera Kompak (max-w-[260px] aspect-[4/3] mx-auto) */}
          <div className="md:col-span-5 rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                <h3 className="font-bold text-xs sm:text-sm">
                  {tab === "in" ? "Kamera Masuk Kerja" : "Kamera Pulang Shift"}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {faceModelsReady ? "128D Siap" : "Memuat AI..."}
              </span>
            </div>

            {/* Compact Camera Frame (max-w-[260px] aspect-[4/3] mx-auto) */}
            <div className="relative max-w-[260px] aspect-[4/3] w-full mx-auto overflow-hidden rounded-xl bg-slate-950 border border-border/80 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`size-full object-cover scale-x-[-1] ${isCameraActive ? "block" : "hidden"}`}
              />

              {!isCameraActive && (
                <div className="relative z-10 text-center p-3 space-y-2">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-white/10 text-white/85 border border-white/15">
                    <Camera className="size-5" />
                  </div>
                  <p className="text-xs font-bold text-white/95 leading-snug">
                    {cameraError || "Kamera Belum Aktif"}
                  </p>
                  <Button
                    type="button"
                    onClick={startCamera}
                    size="sm"
                    className="h-7 rounded-lg text-xs font-bold gap-1 shadow-brand"
                  >
                    <Camera className="size-3.5" />
                    Aktifkan Kamera
                  </Button>
                </div>
              )}

              {/* Compact Oval Face Guide */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div
                    className={cn(
                      "w-28 h-36 rounded-full border-2 transition-all relative",
                      isScanning || isEnrollingFace
                        ? "border-emerald-400 scale-105"
                        : faceRejectMessage
                          ? "border-rose-500"
                          : "border-primary/70",
                    )}
                  />
                  <div className="mt-1.5 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    {isScanning || isEnrollingFace
                      ? `Memindai... ${scanProgress}%`
                      : "Posisikan Wajah Lurus"}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>Tanpa PIN · Verifikasi Biometrik</span>
              <button
                type="button"
                onClick={startCamera}
                className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="size-3" />
                Refresh Kamera
              </button>
            </div>
          </div>

          {/* KOLOM KANAN (md:col-span-7): Pilih Staf, Status Kecocokan Wajah & Tombol Aksi */}
          <div className="md:col-span-7 rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
              <div>
                <h3 className="font-bold text-sm">Pilih Karyawan & Verifikasi Wajah</h3>
                <p className="text-[11px] text-muted-foreground">
                  Cabang aktif: <strong>{activeOutlet.name}</strong> (Toleransi keterlambatan 15 menit)
                </p>
              </div>
              {selectedStaffDescriptor && canManageFaceReEnroll && !forceReEnrollMode && (
                <button
                  type="button"
                  onClick={() => setForceReEnrollMode(true)}
                  className="rounded-lg border border-border bg-secondary/70 hover:bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground cursor-pointer shrink-0"
                >
                  Daftar Ulang Wajah
                </button>
              )}
            </div>

            {/* Quick Staff Selection Pills */}
            <div className="flex flex-wrap gap-1.5">
              {branchStaffProfiles.map((st) => {
                const isSelected = selectedStaffId === st.user_id;
                const hasFace =
                  isValidFaceDescriptor(st.face_descriptor) ||
                  Boolean(getCachedFaceDescriptor(st.user_id, st.full_name));
                return (
                  <button
                    key={st.user_id}
                    type="button"
                    onClick={() => {
                      playPosSound("option");
                      setSelectedStaffId(st.user_id);
                    }}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-secondary/50 hover:bg-secondary text-foreground border-border/80",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        hasFace
                          ? isSelected
                            ? "bg-white"
                            : "bg-emerald-500"
                          : "bg-rose-500",
                      )}
                    />
                    <span>{st.full_name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Staff Status & Biometric Badge */}
            {(() => {
              const cur = selectedStaffProfile;
              if (!cur) return null;
              const todayStr = formatLocalDateWIB();
              const todayInRecord = attendances.find(
                (a) => a.user_id === selectedStaffId && a.type === "in" && a.date === todayStr,
              );
              const todayOutRecord = attendances.find(
                (a) => a.user_id === selectedStaffId && a.type === "out" && a.date === todayStr,
              );
              const inTime = todayInRecord?.check_in_time || todayInRecord?.created_at;
              const outTime = todayOutRecord?.check_out_time || todayOutRecord?.created_at;

              return (
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {cur.avatar_url ? (
                        <img
                          src={cur.avatar_url}
                          alt={cur.full_name}
                          className="size-10 rounded-lg object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-black text-sm shrink-0">
                          {cur.full_name ? cur.full_name.charAt(0).toUpperCase() : "U"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {cur.full_name}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {cur.job_title} · {cur.employment_status}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 border",
                        selectedStaffDescriptor
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
                      )}
                    >
                      {selectedStaffDescriptor ? "Wajah Terdaftar" : "Wajah Belum Terdaftar"}
                    </span>
                  </div>

                  {/* Ringkasan Kehadiran Hari Ini (Tanpa Data Gaji) */}
                  <div className="border-t border-border/60 pt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Jam Masuk:</span>
                      <strong className="text-foreground">
                        {inTime
                          ? new Date(inTime).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Jam Keluar:</span>
                      <strong className="text-foreground">
                        {outTime
                          ? new Date(outTime).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">
                        Status Kehadiran Hari Ini:
                      </span>
                      <span
                        className={cn(
                          "inline-block mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold",
                          todayInRecord?.status === "on_time"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : todayInRecord?.status === "late"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {todayInRecord
                          ? todayInRecord.status === "late"
                            ? "Terlambat"
                            : "Tepat Waktu"
                          : "Belum Absen"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Alert Penolakan Biometrik jika Wajah Tidak Cocok */}
            {faceRejectMessage && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-start gap-2"
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="space-y-0.5">
                  <p>{faceRejectMessage}</p>
                  {lastMatchDistance !== null && Number.isFinite(lastMatchDistance) && (
                    <p className="text-[11px] font-medium opacity-85">
                      Selisih vektor wajah: {lastMatchDistance.toFixed(2)} (Batas cocok maksimal{" "}
                      {FACE_MATCH_THRESHOLD.toFixed(2)})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Mode Daftarkan Wajah Pertama Kali vs Tombol Absen */}
            {isFirstTimeEnrollmentNeeded ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground">
                    {forceReEnrollMode
                      ? `Perbarui Biometrik Wajah — ${selectedStaffProfile?.full_name}`
                      : `Daftarkan Wajah Pertama Kali — ${selectedStaffProfile?.full_name}`}
                  </p>
                  {forceReEnrollMode && (
                    <button
                      type="button"
                      onClick={() => setForceReEnrollMode(false)}
                      className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Karyawan yang belum mendaftarkan wajah tidak dapat langsung absen. Hadapkan wajah{" "}
                  <strong>{selectedStaffProfile?.full_name}</strong> ke kamera untuk menyimpan
                  vektor biometrik 128-angka pertama kali.
                </p>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleEnrollFaceDescriptor}
                  disabled={isEnrollingFace || !selectedStaffId}
                  className="w-full h-11 rounded-xl font-bold shadow-brand gap-2 text-xs sm:text-sm active:scale-95 transition-transform duration-100"
                >
                  {isEnrollingFace ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Menyimpan Vektor Wajah ({scanProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="size-4" />
                      <span>Daftarkan Wajah {selectedStaffProfile?.full_name}</span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={handleScanAndVerify}
                disabled={isScanning || !selectedStaffId}
                className="w-full h-11 rounded-xl font-bold shadow-brand gap-2 text-xs sm:text-sm active:scale-95 transition-transform duration-100"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Memverifikasi Wajah Asli ({scanProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Camera className="size-4" />
                    <span>
                      {tab === "in"
                        ? `Verifikasi Wajah & Absen Masuk`
                        : `Verifikasi Wajah & Absen Pulang`}
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. RIWAYAT ABSENSI                                       */}
      {/* ======================================================== */}
      {tab === "history" && (
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-base">Riwayat Kehadiran Cabang</h3>
              <p className="text-xs text-muted-foreground">
                Semua log absensi biometrik wajah yang tercatat di {activeOutlet.name}
              </p>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              Total {attendances.length} Catatan
            </span>
          </div>

          {attendances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              Belum ada riwayat absensi tercatat di cabang ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Verifikasi Wajah</th>
                    <th className="px-4 py-3">Nama Karyawan</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Waktu Absen</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {attendances.map((item, idx) => {
                    const time = item.check_in_time || item.check_out_time || item.created_at;
                    const dateFormatted = new Date(time).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const timeFormatted = new Date(time).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr key={`att-hist-${item.id || idx}-${idx}`} className="hover:bg-muted/20">
                        {/* Snapshot thumbnail */}
                        <td className="px-4 py-3">
                          {item.face_snapshot_url ? (
                            <button
                              onClick={() =>
                                setPreviewImage({
                                  url: item.face_snapshot_url!,
                                  name: item.staff_name,
                                })
                              }
                              className="size-10 rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all flex items-center justify-center bg-muted/40"
                              title="Klik untuk perbesar foto wajah"
                            >
                              <img
                                src={item.face_snapshot_url}
                                alt={item.staff_name}
                                className="size-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="size-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground">
                              <UserCheck className="size-4" />
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 font-bold text-foreground">{item.staff_name}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 font-bold uppercase text-[0.68rem] ${
                              item.type === "in"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-foreground/75"
                            }`}
                          >
                            {item.type === "in" ? "Masuk" : "Keluar"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground block">
                            {timeFormatted}
                          </span>
                          <span className="text-[0.68rem] text-muted-foreground">
                            {dateFormatted}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
                              item.status === "on_time"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-foreground/75"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                item.status === "on_time" ? "bg-emerald-500" : "bg-muted-foreground"
                              }`}
                            />
                            {item.status === "on_time"
                              ? "Tepat Waktu"
                              : item.late_minutes
                                ? `Terlambat (${item.late_minutes} mnt)`
                                : "Terlambat"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground text-[0.68rem] max-w-xs truncate">
                          {item.device}
                        </td>

                        <td className="px-4 py-3 text-muted-foreground text-[0.72rem]">
                          {item.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. JADWAL SHIFT KARYAWAN                                 */}
      {/* ======================================================== */}
      {tab === "shifts" && (
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-base">Jadwal Shift Kerja Operasional</h3>
            <p className="text-xs text-muted-foreground">
              Konfigurasi jam kerja dan penugasan shift karyawan di {activeOutlet.name}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {shifts.map((s, idx) => (
              <div
                key={`shift-card-${s.id || idx}-${idx}`}
                className="rounded-2xl border border-border bg-muted/15 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-foreground">{s.shift_name}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-bold text-primary">
                    Toleransi: {s.grace_period_minutes} mnt
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[0.68rem] text-muted-foreground font-semibold uppercase">
                    Jam Kerja
                  </span>
                  <p className="text-lg font-mono font-bold text-foreground">
                    {s.start_time} - {s.end_time} WIB
                  </p>
                </div>

                <div className="border-t border-border/60 pt-3">
                  <span className="text-[0.68rem] text-muted-foreground font-semibold block mb-1.5">
                    Karyawan Ditugaskan
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {staffList.slice(0, 3).map((st) => (
                      <span
                        key={st.user_id}
                        className="rounded-lg bg-card border border-border px-2 py-1 text-[0.68rem] font-bold text-foreground"
                      >
                        {st.full_name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Read-Only Weekly Roster Schedule Matrix */}
          {rosterSchedule && rosterSchedule.weeks && rosterSchedule.weeks.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide text-foreground">
                    Matriks Jadwal Shift Mingguan — {activeOutlet.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Jadwal rotasi shift mingguan tersinkronisasi langsung dari HQ.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-rose-500 inline-block" />
                    Pagi
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-primary inline-block" />
                    Malam
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-sky-500 inline-block" />
                    OFF
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {rosterSchedule.weeks.map((week) => (
                  <div
                    key={week.weekNumber}
                    className="rounded-xl border border-border overflow-hidden"
                  >
                    <div className="bg-muted/40 px-3 py-1.5 text-xs font-bold text-foreground flex items-center justify-between border-b border-border">
                      <span>Minggu {week.weekNumber}</span>
                      <span className="text-[11px] font-mono text-muted-foreground font-normal">
                        {week.startDate} s/d {week.endDate}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border text-muted-foreground font-bold">
                            <th className="px-3 py-2 w-32 border-r border-border">Slot Shift</th>
                            {week.days.map((d) => (
                              <th
                                key={d.dateStr}
                                className={`px-2 py-2 text-center border-r border-border min-w-[90px] ${
                                  d.isToday
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black ring-1 ring-emerald-500/30"
                                    : d.isCurrentMonth
                                      ? "text-foreground"
                                      : "text-muted-foreground/40 bg-muted/5"
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span>{d.dayName}</span>
                                  {d.isToday && (
                                    <span className="bg-emerald-600 text-white text-[8px] px-1 py-0.2 rounded font-black uppercase">
                                      HARI INI
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono font-semibold text-muted-foreground">
                                  {d.dayLabel || `Tgl ${d.dayNumber}`}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {week.rows.map((row) => {
                            const isPagi = row.shiftType === "pagi";
                            const isOff = row.shiftType === "off";
                            return (
                              <tr
                                key={row.id}
                                className="border-b border-border hover:bg-muted/10 transition-colors"
                              >
                                <td className="px-3 py-2 font-bold border-r border-border">
                                  <span
                                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                      isPagi
                                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                                        : isOff
                                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                        : "bg-muted text-foreground"
                                    }`}
                                  >
                                    {row.label}
                                  </span>
                                </td>
                                {week.days.map((d) => {
                                  const cell = row.days[d.dateStr];
                                  if (!cell || !cell.staffName || cell.staffName === "-") {
                                    return (
                                      <td
                                        key={d.dateStr}
                                        className="p-1.5 text-center border-r border-border text-muted-foreground/40"
                                      >
                                        -
                                      </td>
                                    );
                                  }
                                  const isCellOff =
                                    cell.status === "OFF" || cell.shiftType === "off";
                                  const isCellSakit = cell.status === "SAKIT";
                                  const isCellIzin = cell.status === "IZIN";

                                  return (
                                    <td
                                      key={d.dateStr}
                                      className="p-1.5 text-center border-r border-border"
                                    >
                                      <div
                                        className={`rounded-lg px-1.5 py-1 text-[11px] font-bold truncate ${
                                          isCellOff
                                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                            : isCellSakit
                                            ? "bg-muted text-foreground/75"
                                            : isCellIzin
                                            ? "bg-muted text-foreground/75"
                                            : isPagi
                                            ? "bg-rose-500/5 text-foreground"
                                            : "bg-muted/30 text-foreground"
                                        }`}
                                      >
                                        {cell.staffName}
                                        {cell.status !== "NORMAL" && (
                                          <span className="block text-[8.5px] font-semibold uppercase">
                                            [{cell.status}]
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUCCESS CONFIRMATION MODAL                               */}
      {/* ======================================================== */}
      {successRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-float text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-lg font-black">
                Absensi {successRecord.type === "in" ? "Masuk" : "Keluar"} Berhasil!
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Biometrik wajah terverifikasi secara sah ke sistem HR.
              </p>
            </div>

            {/* Snapshot Preview */}
            {successRecord.face_snapshot_url && (
              <div className="mx-auto size-32 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-md">
                <img
                  src={successRecord.face_snapshot_url}
                  alt={successRecord.staff_name}
                  className="size-full object-cover"
                />
              </div>
            )}

            {/* Attendance Details Card */}
            <div className="rounded-xl bg-muted/30 p-3 text-left text-xs space-y-1.5 border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Karyawan:</span>
                <strong className="text-foreground">{successRecord.staff_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waktu:</span>
                <span className="font-mono font-bold text-foreground">
                  {new Date(successRecord.created_at).toLocaleTimeString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outlet:</span>
                <span className="text-foreground">{successRecord.outlet_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status Kehadiran:</span>
                <span
                  className={`font-bold ${
                    successRecord.status === "on_time"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground/75"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                        successRecord.status === "on_time" ? "bg-emerald-500" : "bg-muted-foreground"
                      }`}
                    />
                    {successRecord.status === "on_time"
                      ? "Tepat Waktu"
                      : `Terlambat ${successRecord.late_minutes ? `(${successRecord.late_minutes} menit)` : ""}`}
                  </span>
                </span>
              </div>
            </div>

            <Button
              className="w-full rounded-xl font-bold shadow-brand"
              onClick={() => setSuccessRecord(null)}
            >
              Selesai & Tutup
            </Button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* IMAGE ENLARGEMENT MODAL                                  */}
      {/* ======================================================== */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-w-lg w-full rounded-2xl overflow-hidden bg-card border border-border p-4 shadow-float">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-6 right-6 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
            >
              <X className="size-4" />
            </button>
            <h4 className="text-sm font-bold mb-3">Foto Biometrik: {previewImage.name}</h4>
            <div className="aspect-4/3 rounded-xl overflow-hidden border border-border bg-black">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
