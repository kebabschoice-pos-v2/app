import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Search,
  Store,
  Shield,
  ShieldCheck,
  Trash2,
  Eye,
  KeyRound,
  Mail,
  User,
  CheckCircle2,
  RefreshCw,
  Building2,
  ArrowLeft,
  Lock,
  Building,
  AlertTriangle,
  X,
  EyeOff,
  UserCheck,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Phone,
  MapPin,
  Briefcase,
  Award,
  Printer,
  ChevronRight,
  Filter,
  Check,
  Camera,
  Upload,
  Download,
  FileUp,
  Sparkles,
  PlusCircle,
  CalendarRange,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getManagerPermissions,
  saveManagerPermissions,
  type ManagerPermissions,
  DEFAULT_MANAGER_PERMISSIONS as INITIAL_MGR_PERMS,
} from "@/services/manager-permissions.service";
import {
  getStaffList,
  createStaffAccount,
  createBranchEmployee,
  deleteStaffAccount,
  isOutletDeviceAccount,
  type StaffItem,
  type CreateStaffInput,
} from "@/services/staff.service";
import { getOutletList, transferStaffToOutlet, type OutletItem } from "@/services/outlet.service";
import {
  getHRStaffProfiles,
  updateHRStaffProfile,
  getAttendanceList,
  getStaffShifts,
  saveStaffShifts,
  generateMonthlyPayrollList,
  updatePayrollStatus,
  getRosterSchedule,
  saveRosterSchedule,
  generateAutomaticRoster,
  type StaffProfile,
  type StaffAttendance,
  type StaffShift,
  type StaffPayroll,
  type MonthlyRosterSchedule,
  type WeeklyRosterWeek,
  type WeekSlotRow,
  type DailyScheduleCell,
} from "@/services/hr.service";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/integrations/supabase/role-resolver";

export function StaffManagement() {
  // Navigation Tabs: staff (Daftar & Profil), attendance (Rekap Absensi), shifts (Jadwal Shift), payroll (Penggajian), manager_permissions (Hak Akses Manager)
  const [activeTab, setActiveTab] = useState<"staff" | "attendance" | "shifts" | "payroll" | "manager_permissions">(
    "staff",
  );
  const [viewMode, setViewMode] = useState<"list" | "create">("list");

  // Manager Permissions State
  const [systemManagerPerms, setSystemManagerPerms] = useState<ManagerPermissions>(INITIAL_MGR_PERMS);
  const [savingManagerPerms, setSavingManagerPerms] = useState(false);

  // Core Data
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [hrProfiles, setHrProfiles] = useState<StaffProfile[]>([]);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [payrolls, setPayrolls] = useState<StaffPayroll[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [outletFilter, setOutletFilter] = useState<string>("all");

  // Payroll Period Filters (defaults to current month/year)
  const [payrollMonth, setPayrollMonth] = useState<number>(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());

  // Detail Modal State (Full HR Profile)
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [editingProfile, setEditingProfile] = useState<StaffProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Payslip Modal State
  const [selectedPayslip, setSelectedPayslip] = useState<StaffPayroll | null>(null);

  // Shift Edit Modal State
  const [editingShift, setEditingShift] = useState<StaffShift | null>(null);
  const [savingShift, setSavingShift] = useState(false);

  // Weekly Roster Schedule States
  const [rosterOutletId, setRosterOutletId] = useState<string>("all");
  const [rosterMonth, setRosterMonth] = useState<number>(new Date().getMonth() + 1);
  const [rosterYear, setRosterYear] = useState<number>(new Date().getFullYear());
  const [rosterSchedule, setRosterSchedule] = useState<MonthlyRosterSchedule | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [activeRosterWeekTab, setActiveRosterWeekTab] = useState<number>(0); // 0 = Semua Minggu, 1..5

  // Cell Edit Modal State
  const [cellEditModal, setCellEditModal] = useState<{
    weekIndex: number;
    rowId: string;
    dateStr: string;
    dayName: string;
    dayNumber: number;
    cell: DailyScheduleCell;
  } | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState("");
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<StaffItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Biometric Face Registration Modal State
  const [faceModalStaff, setFaceModalStaff] = useState<StaffItem | null>(null);
  const [faceModalProfile, setFaceModalProfile] = useState<StaffProfile | null>(null);
  const [faceCapturedPhoto, setFaceCapturedPhoto] = useState<string | null>(null);
  const [isFaceCameraActive, setIsFaceCameraActive] = useState(false);
  const [faceCameraError, setFaceCameraError] = useState<string | null>(null);
  const [savingFace, setSavingFace] = useState(false);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Create Staff Form State (including HR fields)
  const [form, setForm] = useState<
    CreateStaffInput & {
      confirmPassword?: string;
      phone?: string;
      address?: string;
      job_title?: string;
      gender?: "male" | "female";
      employment_status?: "Tetap" | "Kontrak" | "Probation" | "Magang";
      base_salary?: number;
      daily_allowance?: number;
      late_deduction?: number;
      absence_deduction?: number;
      default_shift?: "Shift Pagi" | "Shift Sore" | "Shift Malam" | "Full/Rolling";
    }
  >({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "cashier",
    outlet_id: "",
    phone: "",
    address: "",
    job_title: "Kasir POS",
    gender: "male",
    employment_status: "Tetap",
    base_salary: 2000000,
    daily_allowance: 25000,
    late_deduction: 20000,
    absence_deduction: 80000,
    default_shift: "Shift Pagi",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const HQ_PERMISSIONS_CONFIG = [
    { key: "reports", label: "Laporan & Analytics", desc: "Akses omset & performa cabang" },
    { key: "inventory", label: "Inventory & Stok Bahan Baku (BOM)", desc: "Akses bahan baku, stok opname & resep" },
    { key: "menu", label: "Manajemen Menu & Kategori", desc: "Akses daftar menu, edit harga & varian" },
    { key: "staff_schedule", label: "Jadwal Shift & Karyawan", desc: "Akses jadwal kerja mingguan cabang" },
    { key: "payroll", label: "Penggajian (Payroll)", desc: "Akses kalkulasi gaji & slip karyawan" },
    { key: "outlets", label: "Manajemen Cabang & Terminal", desc: "Akses data outlet & pengaturan terminal POS" },
    { key: "settings", label: "Pengaturan Sistem & Printer", desc: "Akses setting printer, struk & pajak" },
  ];
  const DEFAULT_MANAGER_PERMISSIONS = ["reports", "inventory", "menu", "staff_schedule"];
  const [managerPermissions, setManagerPermissions] = useState<string[]>(DEFAULT_MANAGER_PERMISSIONS);
  const [ownerGmailConfirmed, setOwnerGmailConfirmed] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("ujicobaajaoke@gmail.com");

  // Edit modal role & promotion states
  const [editRole, setEditRole] = useState<string>("cashier");
  const [editOutletId, setEditOutletId] = useState<string>("");
  const [editManagerEmail, setEditManagerEmail] = useState<string>("");
  const [editManagerPassword, setEditManagerPassword] = useState<string>("");
  const [editManagerPermissions, setEditManagerPermissions] = useState<string[]>(DEFAULT_MANAGER_PERMISSIONS);
  const [editOwnerGmailConfirmed, setEditOwnerGmailConfirmed] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [staffData, outletData, profilesData, attData, shiftData, prData, directOutletsRes] = await Promise.all([
        getStaffList().catch(() => [] as StaffItem[]),
        getOutletList().catch(() => [] as OutletItem[]),
        getHRStaffProfiles().catch(() => [] as StaffProfile[]),
        getAttendanceList().catch(() => [] as StaffAttendance[]),
        getStaffShifts().catch(() => [] as StaffShift[]),
        generateMonthlyPayrollList(payrollMonth, payrollYear).catch(() => [] as StaffPayroll[]),
        (async () => {
          try {
            const res = await supabase.from("outlets").select("id, name, code, address, phone, settings, active");
            return (res.data || []) as any[];
          } catch {
            return [] as any[];
          }
        })(),
      ]);

      // Deduplicate and merge outlets from getOutletList() and direct query
      const uniqueOutlets: OutletItem[] = [];
      const seenOutlets = new Set<string>();

      const addOutletIfValid = (o: any) => {
        if (!o || !o.id || seenOutlets.has(o.id)) return;
        const isArchived = Boolean((o.settings as any)?.archived) || o.active === false;
        if (isArchived) return;
        seenOutlets.add(o.id);
        uniqueOutlets.push({
          id: o.id,
          name: o.name || o.outlet_name || "Outlet Cabang",
          outlet_name: o.outlet_name || o.name || "Outlet Cabang",
          code: o.code || "",
          address: o.address || "",
          phone: o.phone || "",
          status: o.status || (o.active !== false ? "active" : "inactive"),
          created_at: o.created_at || new Date().toISOString(),
          settings: o.settings || {},
          staff_count: o.staff_count || 0,
        } as any as OutletItem);
      };

      for (const o of outletData) addOutletIfValid(o);
      for (const o of directOutletsRes) addOutletIfValid(o);

      // Also check if any staff has an outlet_id & outlet_name not yet in uniqueOutlets
      for (const s of staffData) {
        if (s.outlet_id && !seenOutlets.has(s.outlet_id)) {
          seenOutlets.add(s.outlet_id);
          uniqueOutlets.push({
            id: s.outlet_id,
            name: s.outlet_name || s.outlet || "Outlet Cabang",
            outlet_name: s.outlet_name || s.outlet || "Outlet Cabang",
            code: s.outlet_code || "",
            address: "",
            phone: "",
            status: "active",
            created_at: new Date().toISOString(),
            settings: {},
            staff_count: 0,
          } as any as OutletItem);
        }
      }

      // Deduplicate staff list by user_id || id, filtering out device accounts
      const uniqueStaff: StaffItem[] = [];
      const seenStaff = new Set<string>();
      for (const s of staffData) {
        const key = s.user_id || s.id;
        if (key && !seenStaff.has(key) && !isOutletDeviceAccount(s, uniqueOutlets)) {
          seenStaff.add(key);
          uniqueStaff.push(s);
        }
      }

      // Extract all branch employees directly from uniqueOutlets.settings.outlet_staff_roster
      for (const out of uniqueOutlets) {
        const setObj = out.settings && typeof out.settings === "object" ? (out.settings as any) : {};
        const roster: any[] = Array.isArray(setObj.outlet_staff_roster) ? setObj.outlet_staff_roster : [];
        for (const emp of roster) {
          const empId =
            emp.user_id ||
            emp.id ||
            `emp-${out.id}-${(emp.name || emp.full_name || "").toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          if (!seenStaff.has(empId) && !isOutletDeviceAccount(emp, uniqueOutlets)) {
            seenStaff.add(empId);
            uniqueStaff.push({
              id: empId,
              user_id: empId,
              name: emp.name || emp.full_name || "Karyawan Cabang",
              email: emp.email || "",
              avatar_url: emp.avatar_url || null,
              role: (emp.role as any) || "cashier",
              outlet: out.name,
              outlet_name: out.name,
              outlet_id: out.id,
              outlet_code: out.code || "",
              created_at: emp.created_at || new Date().toISOString(),
              status: emp.status || "active",
              gender: emp.gender || "male",
            });
          }
        }
      }

      const existingProfiles = profilesData.filter(
        (p: StaffProfile) => !isOutletDeviceAccount(p, uniqueOutlets),
      );
      const profileMap = new Map(existingProfiles.map((p) => [p.user_id || p.id, p]));

      const fullProfiles: StaffProfile[] = [...existingProfiles];
      for (const st of uniqueStaff) {
        const staffKey = st.user_id || st.id;
        if (!profileMap.has(staffKey)) {
          const synthProfile: StaffProfile = {
            id: `prof-${staffKey}`,
            user_id: staffKey,
            full_name: st.name,
            phone: "-",
            address: "-",
            avatar_url: st.avatar_url || null,
            join_date: st.created_at,
            job_title: st.role === "manager" ? "Manager Cabang" : "Kasir POS",
            role: st.role,
            gender: st.gender || "male",
            employment_status: "Tetap",
            base_salary: 2000000,
            daily_allowance: 25000,
            late_deduction: 20000,
            absence_deduction: 80000,
            default_shift: "Shift Pagi",
            outlet_id: st.outlet_id || null,
            outlet_name: st.outlet_name || st.outlet || undefined,
            created_at: st.created_at,
          };
          fullProfiles.push(synthProfile);
          profileMap.set(staffKey, synthProfile);
        }
      }

      setStaffList(uniqueStaff);
      setOutlets(uniqueOutlets);
      setHrProfiles(fullProfiles);
      setAttendances(attData);
      setShifts(shiftData);
      setPayrolls(prData.filter((pr: StaffPayroll) => !isOutletDeviceAccount(pr, uniqueOutlets)));

      if (uniqueOutlets.length > 0) {
        setForm((prev) => ({
          ...prev,
          outlet_id: prev.outlet_id || uniqueOutlets[0]?.id || "",
        }));
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          if (authData.user.email) {
            setOwnerEmail(authData.user.email);
          }
          const role = await getUserRole(authData.user.id);
          setCurrentUserRole(role);
          if (role === "cashier" && (activeTab === "payroll" || (activeTab as string) === "manager_permissions")) {
            setActiveTab("staff");
          }
        }
      } catch {
        // ignore
      }

      // Load System Manager Permissions
      try {
        const perms = await getManagerPermissions();
        setSystemManagerPerms(perms);
      } catch {}

      // Pre-select first outlet if available
      const firstOutlet = uniqueOutlets[0];
      if (uniqueOutlets.length > 0 && !form.outlet_id && firstOutlet) {
        setForm((prev) => ({ ...prev, outlet_id: firstOutlet.id }));
      }
      if (uniqueOutlets.length > 0 && (!rosterOutletId || rosterOutletId === "all") && firstOutlet) {
        setRosterOutletId(firstOutlet.id);
      }
    } catch (err) {
      console.error("[StaffManagement] Load error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal memuat data staff & HR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    loadData().finally(() => {
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    const handleShiftsUpdate = () => {
      getStaffShifts().then(setShifts).catch(() => {});
    };
    window.addEventListener("hr:shifts-updated", handleShiftsUpdate);
    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener("hr:shifts-updated", handleShiftsUpdate);
    };
  }, [payrollMonth, payrollYear]);

  async function loadRosterData(
    outletId = rosterOutletId,
    month = rosterMonth,
    year = rosterYear,
  ) {
    try {
      setRosterLoading(true);
      const targetOutlet = outlets.find((o) => o.id === outletId);
      const outletStaffNames = (
        outletId === "all" ? staffList : staffList.filter((s) => s.outlet_id === outletId)
      ).map((s) => s.name);

      const schedule = await getRosterSchedule(
        outletId,
        month,
        year,
        outletStaffNames.length > 0 ? outletStaffNames : undefined,
      );
      if (targetOutlet && schedule.outletName !== targetOutlet.name) {
        schedule.outletName = targetOutlet.name;
      }
      setRosterSchedule(schedule);
    } catch (err) {
      console.error("[StaffManagement] Error loading roster:", err);
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "shifts") {
      loadRosterData(rosterOutletId, rosterMonth, rosterYear);
    }
  }, [activeTab, rosterOutletId, rosterMonth, rosterYear, staffList.length, outlets.length]);

  async function handleGenerateRoster() {
    const targetOutlet = outlets.find((o) => o.id === rosterOutletId);
    const branchStaff = (
      rosterOutletId === "all" ? staffList : staffList.filter((s) => s.outlet_id === rosterOutletId)
    );
    const staffInputs = branchStaff.map((s) => {
      const hr = getProfileForStaff(s.user_id || s.id);
      return {
        name: s.name,
        gender: (hr?.gender || (s as any).gender || "male") as "male" | "female",
      };
    });

    const generated = generateAutomaticRoster(
      rosterOutletId,
      targetOutlet?.name || "Semua Cabang (HQ)",
      rosterMonth,
      rosterYear,
      staffInputs,
    );
    setRosterSchedule(generated);
    await saveRosterSchedule(generated);
    toast.success("⚡ Jadwal rotasi shift otomatis berhasil digenerate!");
  }

  function handleSaveCellEdit(
    newStaffName: string,
    newStatus: DailyScheduleCell["status"],
    newShiftType: DailyScheduleCell["shiftType"],
    newNote?: string,
  ) {
    if (!cellEditModal || !rosterSchedule) return;
    const updated = { ...rosterSchedule };
    const week = updated.weeks[cellEditModal.weekIndex];
    if (!week) return;
    const row = week.rows.find((r) => r.id === cellEditModal.rowId);
    if (!row) return;

    row.days[cellEditModal.dateStr] = {
      staffName: newStaffName.trim() || "-",
      status: newStatus,
      shiftType: newShiftType,
      note: newNote?.trim() || undefined,
    };

    setRosterSchedule({ ...updated });
    saveRosterSchedule(updated);
    setCellEditModal(null);
    toast.success("Jadwal sel berhasil diperbarui!");
  }

  function handleAddSlotRow(weekIndex: number, shiftType: "pagi" | "malam" | "off") {
    if (!rosterSchedule) return;
    const updated = { ...rosterSchedule };
    const week = updated.weeks[weekIndex];
    if (!week) return;

    const countOfType = week.rows.filter((r) => r.shiftType === shiftType).length + 1;
    const label =
      shiftType === "pagi"
        ? `Shift Pagi #${countOfType}`
        : shiftType === "malam"
        ? `Shift Malam #${countOfType}`
        : `Libur (OFF #${countOfType})`;

    const newRowId = `${week.weekNumber}-slot-${shiftType}-${Date.now()}`;
    const newDays: Record<string, DailyScheduleCell> = {};
    for (const d of week.days) {
      newDays[d.dateStr] = {
        staffName: "-",
        status: shiftType === "off" ? "OFF" : "NORMAL",
        shiftType,
      };
    }

    week.rows.push({
      id: newRowId,
      shiftType,
      label,
      days: newDays,
    });

    setRosterSchedule({ ...updated });
    saveRosterSchedule(updated);
    toast.success(`Slot baru "${label}" berhasil ditambahkan ke Minggu ${week.weekNumber}`);
  }

  function handleDeleteSlotRow(weekIndex: number, rowId: string) {
    if (!rosterSchedule) return;
    const updated = { ...rosterSchedule };
    const week = updated.weeks[weekIndex];
    if (!week) return;

    week.rows = week.rows.filter((r) => r.id !== rowId);
    setRosterSchedule({ ...updated });
    saveRosterSchedule(updated);
    toast.success("Slot baris shift berhasil dihapus");
  }

  const rosterRecapList = useMemo(() => {
    if (!rosterSchedule) return [];
    const map = new Map<
      string,
      {
        staffName: string;
        pagi: number;
        malam: number;
        totalMasuk: number;
        totalOff: number;
        izinSakit: number;
        totalHari: number;
      }
    >();

    const activeOutletStaff = (
      rosterOutletId === "all" ? staffList : staffList.filter((s) => s.outlet_id === rosterOutletId)
    ).map((s) => s.name);

    for (const name of activeOutletStaff) {
      map.set(name.toLowerCase(), {
        staffName: name,
        pagi: 0,
        malam: 0,
        totalMasuk: 0,
        totalOff: 0,
        izinSakit: 0,
        totalHari: 0,
      });
    }

    for (const week of rosterSchedule.weeks) {
      for (const row of week.rows) {
        for (const day of week.days) {
          if (!day.isCurrentMonth) continue;
          const cell = row.days[day.dateStr];
          if (!cell || !cell.staffName || cell.staffName === "-") continue;

          const key = cell.staffName.trim().toLowerCase();
          let entry = map.get(key);
          if (!entry) {
            entry = {
              staffName: cell.staffName.trim(),
              pagi: 0,
              malam: 0,
              totalMasuk: 0,
              totalOff: 0,
              izinSakit: 0,
              totalHari: 0,
            };
            map.set(key, entry);
          }

          if (cell.status === "SAKIT" || cell.status === "IZIN") {
            entry.izinSakit++;
            entry.totalHari++;
          } else if (cell.status === "OFF" || cell.shiftType === "off") {
            entry.totalOff++;
            entry.totalHari++;
          } else if (cell.shiftType === "pagi") {
            entry.pagi++;
            entry.totalMasuk++;
            entry.totalHari++;
          } else if (cell.shiftType === "malam") {
            entry.malam++;
            entry.totalMasuk++;
            entry.totalHari++;
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalMasuk - a.totalMasuk);
  }, [rosterSchedule, rosterOutletId, staffList]);

  function handleExportCSV() {
    if (!rosterSchedule) return;
    const outletObj = outlets.find((o) => o.id === rosterOutletId);
    const outletName = outletObj?.name || "Semua Cabang";
    let csv = "\uFEFF";
    csv += `JADWAL KEHADIRAN | ${outletName} - Periode ${rosterMonth}/${rosterYear}\n\n`;
    csv += "Minggu,Slot Shift,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu\n";

    for (const week of rosterSchedule.weeks) {
      for (const row of week.rows) {
        const dayValues = week.days.map((d) => {
          const cell = row.days[d.dateStr];
          if (!cell || !cell.staffName) return "-";
          return cell.status !== "NORMAL" ? `${cell.staffName} [${cell.status}]` : cell.staffName;
        });
        csv += `"Minggu ${week.weekNumber}","${row.label}",${dayValues.map((v) => `"${v}"`).join(",")}\n`;
      }
    }

    csv += "\n\nREKAPITULASI KEHADIRAN JADWAL KARYAWAN\n";
    csv += "Karyawan,Shift Pagi,Shift Malam,Total Masuk,Total Libur (OFF),Izin / Sakit,Total Hari\n";
    for (const item of rosterRecapList) {
      csv += `"${item.staffName}",${item.pagi},${item.malam},${item.totalMasuk},${item.totalOff},${item.izinSakit},${item.totalHari}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Jadwal_Shift_${outletName.replace(/\s+/g, "_")}_${rosterYear}_${rosterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File CSV berhasil diexport!");
  }

  function handleParseAndApplyImport(text: string) {
    if (!text.trim()) {
      toast.error("Teks jadwal tidak boleh kosong");
      return;
    }

    try {
      const targetOutlet = outlets.find((o) => o.id === rosterOutletId);
      const outletStaffNames = (
        rosterOutletId === "all" ? staffList : staffList.filter((s) => s.outlet_id === rosterOutletId)
      ).map((s) => s.name);

      const baseSchedule = generateAutomaticRoster(
        rosterOutletId,
        targetOutlet?.name || "Semua Cabang (HQ)",
        rosterMonth,
        rosterYear,
        outletStaffNames,
      );

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      let appliedCount = 0;

      for (const line of lines) {
        const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
        const tokens = line.split(delimiter).map((t) => t.trim().replace(/^["']|["']$/g, ""));
        if (tokens.length < 2) continue;

        let matchedDateStr: string | null = null;
        const first = tokens[0]!;
        if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
          matchedDateStr = first;
        } else if (/^\d{1,2}$/.test(first)) {
          const dayNum = parseInt(first, 10);
          if (dayNum >= 1 && dayNum <= 31) {
            const padM = String(rosterMonth).padStart(2, "0");
            const padD = String(dayNum).padStart(2, "0");
            matchedDateStr = `${rosterYear}-${padM}-${padD}`;
          }
        }

        if (matchedDateStr) {
          const assignedStaff = tokens.slice(1);
          for (const week of baseSchedule.weeks) {
            week.rows.forEach((row, rowIdx) => {
              if (row.days[matchedDateStr!]) {
                const staff = assignedStaff[rowIdx];
                if (staff && staff !== "-" && staff !== "") {
                  const isOff =
                    row.shiftType === "off" ||
                    staff.toUpperCase().includes("OFF") ||
                    staff.toUpperCase().includes("LIBUR");
                  const isSakit = staff.toUpperCase().includes("SAKIT");
                  const isIzin = staff.toUpperCase().includes("IZIN");
                  const cleanName = staff.replace(/\s*\(.*?\)\s*/g, "").trim();

                  row.days[matchedDateStr!] = {
                    staffName: cleanName || staff,
                    status: isSakit ? "SAKIT" : isIzin ? "IZIN" : isOff ? "OFF" : "NORMAL",
                    shiftType: row.shiftType,
                  };
                  appliedCount++;
                }
              }
            });
          }
        }
      }

      if (appliedCount > 0) {
        setRosterSchedule(baseSchedule);
        saveRosterSchedule(baseSchedule);
        setIsImportModalOpen(false);
        setImportRawText("");
        toast.success(`Berhasil mengimpor jadwal (${appliedCount} slot terpetakan)!`);
      } else {
        const extractedNames = Array.from(
          new Set(
            text
              .split(/[\n,;\t]+/)
              .map((w) => w.trim().replace(/^["']|["']$/g, ""))
              .filter(
                (w) =>
                  w.length >= 3 &&
                  !/^\d+$/.test(w) &&
                  !/^(shift|pagi|malam|libur|off|senin|selasa|rabu|kamis|jumat|sabtu|minggu|minggu\s*\d+)$/i.test(
                    w,
                  ),
              ),
          ),
        );

        if (extractedNames.length >= 2) {
          const customGenerated = generateAutomaticRoster(
            rosterOutletId,
            targetOutlet?.name || "Semua Cabang (HQ)",
            rosterMonth,
            rosterYear,
            extractedNames,
          );
          setRosterSchedule(customGenerated);
          saveRosterSchedule(customGenerated);
          setIsImportModalOpen(false);
          setImportRawText("");
          toast.success(
            `Berhasil mengimpor & merotasikan jadwal untuk ${extractedNames.length} nama karyawan!`,
          );
        } else {
          toast.error(
            "Format file/teks belum dikenali. Gunakan file CSV atau teks dengan daftar tanggal & nama staf.",
          );
        }
      }
    } catch (err) {
      console.error("[handleParseAndApplyImport] Error:", err);
      toast.error("Gagal memproses file import");
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Nama lengkap staff wajib diisi");
      return;
    }

    if (form.role !== "owner" && outlets.length > 0 && !form.outlet_id) {
      toast.error("Silakan pilih cabang outlet untuk penempatan ini");
      return;
    }

    // MODE 1: Data Karyawan Cabang (Kasir, Crew, Admin Cabang - Tanpa Akun Login Email / Password)
    if (form.role !== "manager") {
      setSubmitting(true);
      try {
        const targetOutletId = form.outlet_id || outlets[0]?.id || "";
        const newEmployee = await createBranchEmployee({
          name: form.name.trim(),
          outlet_id: targetOutletId,
          role: form.role as any,
          job_title: form.job_title || (form.role === "crew" ? "Kru Operasional" : form.role === "admin" ? "Admin Cabang" : "Kasir POS"),
          gender: form.gender || "male",
          phone: form.phone || "",
          address: form.address || "",
          employment_status: form.employment_status || "Tetap",
          base_salary: Number(form.base_salary) || 2000000,
          daily_allowance: Number(form.daily_allowance) || 25000,
          late_deduction: Number(form.late_deduction) || 20000,
          absence_deduction: Number(form.absence_deduction) || 80000,
          default_shift: form.default_shift || "Shift Pagi",
        });

        // Also associate staff ID into shift's assigned_staff_ids
        if (shifts && shifts.length > 0 && form.default_shift) {
          const matchedShift = shifts.find(
            (s) => s.shift_name.toLowerCase().includes((form.default_shift || "").toLowerCase()),
          );
          if (matchedShift && !matchedShift.assigned_staff_ids.includes(newEmployee.user_id)) {
            const updated = shifts.map((s) =>
              s.id === matchedShift.id
                ? { ...s, assigned_staff_ids: [...s.assigned_staff_ids, newEmployee.user_id] }
                : s,
            );
            await saveStaffShifts(updated).catch(() => {});
          }
        }

        toast.success(
          `Data karyawan "${newEmployee.name}" (${form.role.toUpperCase()}) berhasil ditambahkan ke cabang (Tanpa perlu email/password)`,
        );

        // Reset form
        setForm({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "cashier",
          outlet_id: outlets[0]?.id || "",
          phone: "",
          address: "",
          job_title: "Kasir POS",
          gender: "male",
          employment_status: "Tetap",
          base_salary: 2000000,
          daily_allowance: 25000,
          late_deduction: 20000,
          absence_deduction: 80000,
          default_shift: "Shift Pagi",
        });
        setOwnerGmailConfirmed(false);
        setManagerPermissions(DEFAULT_MANAGER_PERMISSIONS);

        setViewMode("list");
        await loadData();
      } catch (err) {
        console.error("[StaffManagement] Create error:", err);
        toast.error(err instanceof Error ? err.message : "Gagal menambahkan data karyawan");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // MODE 2: Store Manager HQ (Wajib Email, Password, & Persetujuan Gmail Owner)
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.error("Alamat email Gmail Store Manager tidak valid");
      return;
    }

    if (!form.password || form.password.length < 6) {
      toast.error("Password Store Manager minimal 6 karakter");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Password dan Konfirmasi Password tidak cocok");
      return;
    }

    if (!ownerGmailConfirmed) {
      toast.error("Persetujuan otorisasi Owner Gmail wajib dicentang untuk membuat akun Store Manager!");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateStaffInput = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: "manager",
        outlet_id: form.outlet_id || null,
        manager_permissions: managerPermissions,
        owner_gmail_confirmed: true,
      };

      const newAccount = await createStaffAccount(payload);
      toast.success(`Akun Store Manager untuk "${payload.name}" berhasil dibuat dengan akses HQ`);

      // Persist manager permissions to outlets.settings
      if (newAccount?.user_id && form.outlet_id) {
        const targetOut = outlets.find((o) => o.id === form.outlet_id);
        if (targetOut) {
          const s: Record<string, any> =
            targetOut.settings && typeof targetOut.settings === "object" && !Array.isArray(targetOut.settings)
              ? { ...(targetOut.settings as any) }
              : {};
          const mp = { ...(s.manager_permissions || {}) };
          mp[newAccount.user_id] = managerPermissions;
          s.manager_permissions = mp;
          await supabase.from("outlets").update({ settings: s }).eq("id", targetOut.id);
        }
      }

      // Save additional HR Profile data
      if (newAccount?.user_id) {
        await updateHRStaffProfile(newAccount.user_id, {
          full_name: form.name.trim(),
          phone: form.phone || "081234567890",
          address: form.address || "Jl. Kebon Jeruk No. 12, Jakarta",
          job_title: form.job_title || "Store Manager",
          gender: form.gender || "male",
          employment_status: form.employment_status || "Tetap",
          base_salary: Number(form.base_salary) || 3500000,
          daily_allowance: Number(form.daily_allowance) || 35000,
          late_deduction: Number(form.late_deduction) || 20000,
          absence_deduction: Number(form.absence_deduction) || 80000,
          default_shift: form.default_shift || "Shift Pagi",
          role: "manager",
          outlet_id: form.outlet_id || null,
        });

        // Also associate staff ID into shift's assigned_staff_ids
        if (shifts && shifts.length > 0 && form.default_shift) {
          const matchedShift = shifts.find(
            (s) => s.shift_name.toLowerCase().includes((form.default_shift || "").toLowerCase()),
          );
          if (matchedShift && !matchedShift.assigned_staff_ids.includes(newAccount.user_id)) {
            const updated = shifts.map((s) =>
              s.id === matchedShift.id
                ? { ...s, assigned_staff_ids: [...s.assigned_staff_ids, newAccount.user_id] }
                : s,
            );
            await saveStaffShifts(updated).catch(() => {});
          }
        }
      }

      // Reset form
      setForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "cashier",
        outlet_id: outlets[0]?.id || "",
        phone: "",
        address: "",
        job_title: "Kasir POS",
        employment_status: "Tetap",
        base_salary: 2000000,
        daily_allowance: 25000,
        late_deduction: 20000,
        absence_deduction: 80000,
        default_shift: "Shift Pagi",
      });
      setOwnerGmailConfirmed(false);
      setManagerPermissions(DEFAULT_MANAGER_PERMISSIONS);

      setViewMode("list");
      await loadData();
    } catch (err) {
      console.error("[StaffManagement] Create error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal membuat akun Store Manager");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickTransferStaff(staff: StaffItem, newOutletId: string) {
    if (staff.outlet_id === newOutletId) return;
    try {
      toast.loading(`Memindahkan cabang ${staff.name}...`, { id: "quick-transfer" });
      await transferStaffToOutlet(staff.user_id, newOutletId || null);
      toast.success(`Cabang ${staff.name} berhasil dipindahkan`, { id: "quick-transfer" });
      await loadData();
    } catch (err: any) {
      toast.error("Gagal memindahkan cabang staf", { id: "quick-transfer", description: err.message });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteStaffAccount(deleteTarget.user_id);
      toast.success(`Akun staff "${deleteTarget.name}" berhasil dihapus`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error("[StaffManagement] Delete error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menghapus staff");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveProfileEdit() {
    if (!editingProfile) return;
    setSavingProfile(true);
    try {
      // 1. Check if outlet changed
      if (editOutletId && editOutletId !== selectedStaff?.outlet_id) {
        await transferStaffToOutlet(editingProfile.user_id, editOutletId || null);
      }

      // 2. If promoted to manager and password provided, create/link account
      if (editRole === "manager" && editManagerPassword) {
        if (editManagerPassword.length < 6) {
          toast.error("Password Store Manager minimal 6 karakter");
          setSavingProfile(false);
          return;
        }
        if (!editOwnerGmailConfirmed) {
          toast.error("Persetujuan otorisasi Owner Gmail wajib dicentang untuk hak akses Store Manager");
          setSavingProfile(false);
          return;
        }
        await createStaffAccount({
          name: editingProfile.full_name,
          email: editManagerEmail || `${editingProfile.full_name.toLowerCase().replace(/\s+/g, "")}@kebabschoice.com`,
          password: editManagerPassword,
          role: "manager",
          outlet_id: editOutletId || editingProfile.outlet_id || null,
          manager_permissions: editManagerPermissions,
          owner_gmail_confirmed: true,
        });
      }

      // 3. Update manager_permissions in outlets.settings if manager
      const finalOutletId = editOutletId || editingProfile.outlet_id;
      if (editRole === "manager" && finalOutletId) {
        const targetOut = outlets.find((o) => o.id === finalOutletId);
        if (targetOut) {
          const s: Record<string, any> =
            targetOut.settings && typeof targetOut.settings === "object" && !Array.isArray(targetOut.settings)
              ? { ...(targetOut.settings as any) }
              : {};
          const mp = { ...(s.manager_permissions || {}) };
          mp[editingProfile.user_id] = editManagerPermissions;
          s.manager_permissions = mp;
          await supabase.from("outlets").update({ settings: s }).eq("id", targetOut.id);
        }
      }

      // 4. Update HR Profile
      await updateHRStaffProfile(editingProfile.user_id, {
        ...editingProfile,
        role: editRole as any,
        outlet_id: finalOutletId,
      });

      // 5. Also sync shift assignment if default_shift is configured
      if (editingProfile.default_shift && shifts.length > 0) {
        const matchedShift = shifts.find((s) =>
          s.shift_name.toLowerCase().includes((editingProfile.default_shift || "").toLowerCase()),
        );
        if (matchedShift && !matchedShift.assigned_staff_ids.includes(editingProfile.user_id)) {
          const updatedShifts = shifts.map((s) =>
            s.id === matchedShift.id
              ? { ...s, assigned_staff_ids: [...s.assigned_staff_ids, editingProfile.user_id] }
              : s,
          );
          await saveStaffShifts(updatedShifts).catch(() => {});
          setShifts(updatedShifts);
        }
      }

      toast.success(`Profil HR "${editingProfile.full_name}" berhasil diperbarui`);
      setEditingProfile(null);
      await loadData();
    } catch (err) {
      console.error("[handleSaveProfileEdit] Error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil HR");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveShiftEdit() {
    if (!editingShift) return;
    setSavingShift(true);
    try {
      const updated = shifts.map((s) => (s.id === editingShift.id ? editingShift : s));
      await saveStaffShifts(updated);
      setShifts(updated);
      toast.success(`Jadwal "${editingShift.shift_name}" berhasil diperbarui`);
      setEditingShift(null);
    } catch (err) {
      console.error("[handleSaveShiftEdit] Error:", err);
      toast.error("Gagal menyimpan jadwal shift");
    } finally {
      setSavingShift(false);
    }
  }

  async function handlePaySalary(payroll: StaffPayroll) {
    try {
      await updatePayrollStatus(payroll.id, "paid");
      toast.success(`Gaji ${payroll.staff_name} berhasil ditandai dibayar!`);
      await loadData();
    } catch (err) {
      console.error("[handlePaySalary] Error:", err);
      toast.error("Gagal memproses pembayaran gaji");
    }
  }

  // Biometric Face Registration Camera Handlers
  async function startFaceCamera() {
    try {
      setFaceCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        faceVideoRef.current.play();
        setIsFaceCameraActive(true);
      }
    } catch (err: any) {
      console.warn("Face registration camera access failed:", err);
      setFaceCameraError("Kamera tidak dapat diakses atau izin kamera ditolak.");
    }
  }

  function stopFaceCamera() {
    if (faceVideoRef.current && faceVideoRef.current.srcObject) {
      const stream = faceVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      faceVideoRef.current.srcObject = null;
    }
    setIsFaceCameraActive(false);
  }

  function captureFaceSnapshot() {
    if (faceVideoRef.current && faceCanvasRef.current) {
      const video = faceVideoRef.current;
      const canvas = faceCanvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setFaceCapturedPhoto(dataUrl);
        stopFaceCamera();
      }
    }
  }

  function handleFaceFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFaceCapturedPhoto(reader.result);
        stopFaceCamera();
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveFaceRegistration() {
    if (!faceModalStaff || !faceCapturedPhoto) return;
    try {
      setSavingFace(true);
      await updateHRStaffProfile(faceModalStaff.user_id, {
        avatar_url: faceCapturedPhoto,
      });
      toast.success(`Foto biometrik ${faceModalStaff.name} berhasil disimpan!`);
      if (editingProfile && editingProfile.user_id === faceModalStaff.user_id) {
        setEditingProfile({ ...editingProfile, avatar_url: faceCapturedPhoto });
      }
      stopFaceCamera();
      setFaceModalStaff(null);
      setFaceModalProfile(null);
      setFaceCapturedPhoto(null);
      await loadData();
    } catch (err) {
      toast.error("Gagal menyimpan foto biometrik");
    } finally {
      setSavingFace(false);
    }
  }

  // Filtered staff list with deduplication
  const filteredStaff = useMemo(() => {
    const uniqueMap = new Map<string, StaffItem>();
    for (const item of staffList) {
      const key = item.user_id || item.id;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    return deduplicated.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.email.toLowerCase().includes(search.toLowerCase()) ||
        (item.outlet_name || "").toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" || item.role.toLowerCase() === roleFilter.toLowerCase();

      const matchesOutlet =
        outletFilter === "all" ||
        (outletFilter === "unassigned" ? !item.outlet_id : item.outlet_id === outletFilter);

      return matchesSearch && matchesRole && matchesOutlet;
    });
  }, [staffList, search, roleFilter, outletFilter]);

  const totalStaff = staffList.length;
  const totalCashiers = staffList.filter((s) => s.role === "cashier").length;
  const totalManagers = staffList.filter((s) => s.role === "manager" || s.role === "admin").length;

  const roleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "admin":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "manager":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "cashier":
      default:
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
  };

  // Merge staff item with HR Profile
  const getProfileForStaff = (userId: string): StaffProfile => {
    return (
      hrProfiles.find((p) => p.user_id === userId) || {
        id: `hr-${userId}`,
        user_id: userId,
        outlet_id: null,
        full_name: "Staff",
        phone: "081234567890",
        address: "Jakarta",
        avatar_url: null,
        job_title: "Kasir POS",
        role: "cashier",
        employment_status: "Tetap",
        join_date: "2026-01-01",
        base_salary: 2000000,
        daily_allowance: 25000,
        late_deduction: 20000,
        absence_deduction: 80000,
      }
    );
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & HR NAVIGATION TABS                       */}
      {/* ======================================================== */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-0.5">
                <Building2 className="size-3.5" />
                <span>Enterprise HR & People Management · HQ</span>
              </div>
              <h1 className="text-3xl font-black tracking-normal">Staff & Human Resources</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kelola profil staf, hak akses RBAC, rekap absensi biometrik wajah, shift, dan
                payroll gaji.
              </p>
            </div>
          </div>

          {/* Action Button: Tambah Staff Baru */}
          {activeTab === "staff" && viewMode === "list" && (
            <Button
              onClick={() => setViewMode("create")}
              className="rounded-2xl font-bold shadow-brand gap-2"
            >
              <UserPlus className="size-4" />Tambah Karyawan Baru
            </Button>
          )}
        </div>

        {/* HR Sub-Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <button
            onClick={() => {
              setActiveTab("staff");
              setViewMode("list");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "staff"
                ? "bg-primary text-primary-foreground shadow-brand"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            <span>1. Profil & Akun Karyawan</span>
            <span className="rounded-full bg-black/15 dark:bg-white/20 px-2 py-0.2 text-[0.65rem]">
              {totalStaff}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "attendance"
                ? "bg-primary text-primary-foreground shadow-brand"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <UserCheck className="size-3.5" />
            <span>2. Rekap Absensi & Wajah</span>
            <span className="rounded-full bg-black/15 dark:bg-white/20 px-2 py-0.2 text-[0.65rem]">
              {attendances.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("shifts")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "shifts"
                ? "bg-primary text-primary-foreground shadow-brand"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Calendar className="size-3.5" />
            <span>3. Jadwal Shift Kerja</span>
            <span className="rounded-full bg-black/15 dark:bg-white/20 px-2 py-0.2 text-[0.65rem]">
              {shifts.length}
            </span>
          </button>

          {currentUserRole !== "cashier" && (
            <button
              onClick={() => setActiveTab("payroll")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "payroll"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <DollarSign className="size-3.5" />
              <span>4. Payroll & Penggajian</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 text-[0.65rem] font-bold">
                Auto Sync
              </span>
            </button>
          )}

          {currentUserRole !== "cashier" && (
            <button
              onClick={() => setActiveTab("manager_permissions")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "manager_permissions"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>5. 🎛️ Hak Akses Manager</span>
              <span className="rounded-full bg-primary/20 text-primary px-2 py-0.2 text-[0.65rem] font-black">
                HQ Control
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PROFIL & AKUN KARYAWAN (STAFF DIRECTORY)         */}
      {/* ======================================================== */}
      {activeTab === "staff" && viewMode === "list" && (
        <div className="space-y-5">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="text-xs text-muted-foreground font-semibold">Total Karyawan</span>
              <p className="text-2xl font-black">{totalStaff}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-soft">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Kasir & Barista POS
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totalCashiers}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-soft">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                Store Manager & Admin
              </span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {totalManagers}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="text-xs text-muted-foreground font-semibold">Outlet Terlayani</span>
              <p className="text-2xl font-black">{outlets.length} Cabang</p>
            </div>
          </div>

          {/* Banner Akun Login Outlet Terdaftar per Cabang */}
          <div className="rounded-[1.75rem] border border-border bg-gradient-to-r from-primary/5 via-primary/[0.02] to-card p-5 shadow-soft space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-foreground">
                    🔑 Akun Login Outlet Terdaftar per Cabang (Perangkat POS Tablet)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Akun perangkat kasir cabang dipisahkan 100% dari data karyawan &amp; jadwal shift.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/outlets";
                  }
                }}
                className="h-8 rounded-xl text-xs font-bold gap-1.5 self-start sm:self-auto border-primary/30 text-primary hover:bg-primary/10"
              >
                <Store className="size-3.5" />
                <span>Buka Manajemen Outlet &rarr;</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {outlets.length === 0 ? (
                <div className="col-span-full py-3 text-center text-xs text-muted-foreground italic">
                  Belum ada cabang outlet terdaftar.
                </div>
              ) : (
                outlets.map((out) => {
                  const s = (out.settings as any) || {};
                  const loginEmail = s.outlet_login_email || s.outlet_login_account?.email;
                  const isPending = s.outlet_login_account?.status === "pending_confirmation";
                  return (
                    <div
                      key={`outlet-acc-${out.id}`}
                      className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Store className="size-3 text-primary shrink-0" />
                          <p className="font-bold text-xs truncate text-foreground">
                            {out.outlet_name || out.name}
                          </p>
                        </div>
                        {loginEmail ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`size-1.5 rounded-full shrink-0 ${
                                isPending ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                              }`}
                            />
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              {loginEmail}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">
                            Belum dibuat akun login
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isPending
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/25"
                            : loginEmail
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isPending ? "Menunggu Konfirmasi" : loginEmail ? "Aktif" : "Belum Ada"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama karyawan, email, outlet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                aria-label="Filter cabang staf"
                className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Semua Cabang ({totalStaff} Staf)</option>
                {outlets.map((o) => {
                  const count = staffList.filter((s) => s.outlet_id === o.id).length;
                  return (
                    <option key={o.id} value={o.id}>
                      {o.name || o.outlet_name} ({count} Staf)
                    </option>
                  );
                })}
                {staffList.filter((s) => !s.outlet_id).length > 0 && (
                  <option value="unassigned">
                    Belum Ditugaskan ({staffList.filter((s) => !s.outlet_id).length} Staf)
                  </option>
                )}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">Semua Role</option>
                <option value="cashier">Kasir POS</option>
                <option value="manager">Store Manager</option>
                <option value="admin">Administrator</option>
                <option value="owner">Owner HQ</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="rounded-xl h-10 gap-1.5 text-xs font-bold"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </Button>
            </div>
          </div>

          {/* Table List of Staff with HR details */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase font-bold text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Karyawan</th>
                    <th className="px-6 py-4">Jabatan & Role</th>
                    <th className="px-6 py-4">Cabang Outlet</th>
                    <th className="px-6 py-4">Status & Masuk</th>
                    {currentUserRole !== "cashier" && <th className="px-6 py-4">Gaji Pokok</th>}
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStaff.map((staff, sIdx) => {
                    const hr = getProfileForStaff(staff.user_id);
                    return (
                      <tr
                        key={`staff-row-${staff.user_id || staff.id || sIdx}-${sIdx}`}
                        className="transition-colors hover:bg-muted/20"
                      >
                        {/* Avatar & Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              {hr.avatar_url ? (
                                <img
                                  src={hr.avatar_url}
                                  alt={staff.name}
                                  className="size-10 shrink-0 rounded-xl object-cover border border-border"
                                />
                              ) : (
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">
                                  {staff.name ? staff.name.charAt(0).toUpperCase() : "U"}
                                </div>
                              )}
                              {hr.avatar_url && (
                                <span
                                  className="absolute -bottom-1 -right-1 size-3 bg-emerald-500 border-2 border-card rounded-full"
                                  title="Biometrik Wajah Aktif"
                                />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-foreground">{staff.name}</p>
                                {(hr.gender || (staff as any).gender) === "female" ? (
                                  <span
                                    className="inline-flex items-center justify-center size-4 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-400 text-[9px] font-black"
                                    title="Perempuan (P)"
                                  >
                                    P
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center justify-center size-4 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[9px] font-black"
                                    title="Laki-laki (L)"
                                  >
                                    L
                                  </span>
                                )}
                              </div>
                              <span className="text-[0.68rem] text-muted-foreground block">
                                {staff.email}
                              </span>
                              <span className="text-[0.68rem] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="size-2.5 text-primary" />
                                {hr.phone}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Jabatan & Role */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground text-xs block">
                            {hr.job_title}
                          </span>
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 font-bold uppercase text-[0.65rem] mt-1 ${roleBadgeStyle(
                              staff.role,
                            )}`}
                          >
                            {staff.role}
                          </span>
                        </td>

                        {/* Cabang Outlet with Quick Mutation */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                              <Store className="size-3.5 text-primary shrink-0" />
                              <span>{staff.outlet_name || "Belum Ditugaskan"}</span>
                            </div>
                            {staff.role !== "owner" && (
                              <select
                                value={staff.outlet_id || ""}
                                onChange={(e) => handleQuickTransferStaff(staff, e.target.value)}
                                aria-label={`Mutasi cabang untuk ${staff.name}`}
                                className="h-7 w-fit max-w-[170px] rounded-lg border border-input bg-muted/40 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground focus:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                              >
                                <option value="" disabled={!staff.outlet_id}>
                                  {staff.outlet_id ? "Pindah Cabang..." : "Pilih Cabang..."}
                                </option>
                                {outlets.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    → {o.name || o.outlet_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Status Kerja & Tanggal Masuk */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {hr.employment_status}
                          </span>
                          <span className="text-[0.68rem] text-muted-foreground block mt-1">
                            Masuk: {hr.join_date}
                          </span>
                        </td>

                        {/* Gaji Pokok */}
                        {currentUserRole !== "cashier" && (
                          <td className="px-6 py-4 font-mono font-bold text-foreground">
                            Rp{Number(hr.base_salary || 0).toLocaleString("id-ID")}
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-xl text-primary hover:bg-primary/10"
                              onClick={() => {
                                setFaceModalStaff(staff);
                                setFaceModalProfile(hr);
                                setFaceCapturedPhoto(hr.avatar_url || null);
                                startFaceCamera();
                              }}
                              title="Daftar / Ubah Foto Wajah Biometrik"
                            >
                              <Camera className="size-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-xl"
                              onClick={() => {
                                setSelectedStaff(staff);
                                setEditingProfile(hr);
                                setEditRole(staff.role || "cashier");
                                setEditOutletId(staff.outlet_id || "");
                                setEditManagerEmail(staff.email || "");
                                setEditManagerPassword("");
                                setEditOwnerGmailConfirmed(false);
                                const targetOut = outlets.find((o) => o.id === staff.outlet_id);
                                const targetSettings =
                                  targetOut?.settings && typeof targetOut.settings === "object"
                                    ? (targetOut.settings as any)
                                    : {};
                                const existingPerms =
                                  targetSettings?.manager_permissions?.[staff.user_id] ||
                                  DEFAULT_MANAGER_PERMISSIONS;
                                setEditManagerPermissions(existingPerms);
                              }}
                              title="Lihat & Edit Profil HR"
                            >
                              <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>

                            {staff.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(staff)}
                                title="Hapus Akun Karyawan"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM: TAMBAH KARYAWAN BARU LENGKAP                       */}
      {/* ======================================================== */}
      {activeTab === "staff" && viewMode === "create" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => setViewMode("list")}
            >
              <ArrowLeft className="size-4" />
              Kembali ke Daftar Karyawan
            </Button>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              HQ HR · Tambah Data Lengkap Karyawan
            </span>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Section 1: Profil Pribadi & Akun Login */}
              <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <User className="size-4 text-primary" />
                  <h2 className="text-base font-bold">1. Informasi Pribadi Karyawan</h2>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">Nama Lengkap *</label>
                  <Input
                    required
                    placeholder="cth. Ahmad Fauzi"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1.5 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Nomor HP / WhatsApp
                    </label>
                    <Input
                      placeholder="081234567890"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Jabatan Pekerjaan
                    </label>
                    <Input
                      placeholder={form.role === "manager" ? "Store Manager" : form.role === "crew" ? "Kru Operasional" : form.role === "admin" ? "Admin Cabang" : "Kasir POS"}
                      value={form.job_title}
                      onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Jenis Kelamin (Gender) *
                    </label>
                    <select
                      value={form.gender || "male"}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as "male" | "female" })}
                      className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="male">👨 Laki-laki (Cowok)</option>
                      <option value="female">👩 Perempuan (Cewek)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Alamat Tempat Tinggal
                    </label>
                    <Input
                      placeholder="Jl. Senopati Raya No. 45, Jakarta Selatan"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                </div>

                {form.role !== "manager" ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <strong className="font-bold">Karyawan Cabang (Tanpa Email/Password):</strong> Karyawan ini tidak memerlukan email atau password login terpisah. Cukup login 1x menggunakan akun terminal outlet, dan nama karyawan ini akan otomatis muncul pada dropdown Kasir Bertugas di POS tablet serta absensi biometrik.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        🔑 Akun Login Store Manager (Akses HQ)
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground/80">
                        Email Gmail Store Manager *
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="manager.cabang@gmail.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1.5 rounded-xl bg-background"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-foreground/80">Password Login *</label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="Min. 6 karakter"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="rounded-xl bg-background pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-foreground/80">
                          Konfirmasi Password *
                        </label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            placeholder="Ulangi password"
                            value={form.confirmPassword}
                            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                            className="rounded-xl bg-background pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Owner Gmail Authorization Box */}
                    <div className="rounded-xl border border-primary/20 bg-background/80 p-3 space-y-2">
                      <div className="text-[11px] text-muted-foreground">
                        🛡️ Otorisasi Keamanan Owner:
                      </div>
                      <div className="text-xs font-mono font-bold text-primary">
                        {ownerEmail || "ujicobaajaoke@gmail.com"}
                      </div>
                      <label className="flex items-start gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ownerGmailConfirmed}
                          onChange={(e) => setOwnerGmailConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-input size-4 text-primary"
                        />
                        <span className="text-[11px] font-medium text-foreground leading-snug">
                          Saya selaku Owner telah menyetujui pembuatan akun Store Manager ini untuk mengakses menu HQ.
                        </span>
                      </label>
                    </div>

                    {/* HQ Menu Permissions Checklist */}
                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-bold text-foreground/80 block">
                        🛡️ Hak Akses Menu HQ (Store Manager)
                      </label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {HQ_PERMISSIONS_CONFIG.map((p) => {
                          const isChecked = managerPermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={cn(
                                "flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors",
                                isChecked
                                  ? "border-primary/40 bg-primary/5 text-foreground"
                                  : "border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setManagerPermissions([...managerPermissions, p.key]);
                                  } else {
                                    setManagerPermissions(managerPermissions.filter((k) => k !== p.key));
                                  }
                                }}
                                className="mt-0.5 rounded border-input size-3.5 text-primary"
                              />
                              <div>
                                <div className="font-bold text-xs">{p.label}</div>
                                <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Section 2: Penempatan Outlet & Skema Penggajian HR */}
              <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Briefcase className="size-4 text-primary" />
                  <h2 className="text-base font-bold">2. Penempatan Outlet & Gaji HR</h2>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Role Sistem (Hak Akses) *
                  </label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="cashier">Kasir POS Cabang (Default - Tanpa Akun Email)</option>
                    <option value="crew">Kru Operasional / Grill / Prep (Tanpa Akun Email)</option>
                    <option value="admin">Admin Cabang (Tanpa Akun Email)</option>
                    <option value="manager">Store Manager (Akses HQ — Butuh Akun Gmail & Password)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">Cabang Penugasan *</label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.outlet_id || ""}
                    onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
                    required
                  >
                    {outlets.length === 0 ? (
                      <option value="" disabled>-- Belum ada cabang terdaftar --</option>
                    ) : (
                      outlets.map((outlet, oIdx) => (
                        <option key={`staff-outlet-${outlet.id || oIdx}-${oIdx}`} value={outlet.id}>
                          📍 {outlet.outlet_name || outlet.name} ({outlet.code || "CABANG"})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">
                    Jadwal Shift Default *
                  </label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                    value={form.default_shift || "Shift Pagi"}
                    onChange={(e) => setForm({ ...form, default_shift: e.target.value as any })}
                  >
                    {shifts && shifts.length > 0 ? (
                      shifts.map((s) => (
                        <option key={s.id} value={s.shift_name}>
                          {s.shift_name} ({s.start_time} - {s.end_time})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Shift Pagi">Shift Pagi (07:00 - 16:00)</option>
                        <option value="Shift Malam">Shift Malam (13:00 - 22:00)</option>
                      </>
                    )}
                    <option value="Full/Rolling">Full / Rolling (Fleksibel Cabang)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Jenis Kelamin (Gender) *
                    </label>
                    <select
                      className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold"
                      value={form.gender || "male"}
                      onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    >
                      <option value="male">👨 Laki-laki (L)</option>
                      <option value="female">👩 Perempuan (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Status Kepegawaian
                    </label>
                    <select
                      className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={form.employment_status}
                      onChange={(e) =>
                        setForm({ ...form, employment_status: e.target.value as any })
                      }
                    >
                      <option value="Tetap">Tetap</option>
                      <option value="Kontrak">Kontrak</option>
                      <option value="Probation">Probation</option>
                      <option value="Magang">Magang</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground/80">
                      Gaji Pokok Bulanan (Rp)
                    </label>
                    <Input
                      type="number"
                      value={form.base_salary}
                      onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })}
                      className="mt-1.5 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <label className="text-[0.68rem] font-bold text-muted-foreground block">
                      Tunjangan Harian
                    </label>
                    <Input
                      type="number"
                      value={form.daily_allowance}
                      onChange={(e) =>
                        setForm({ ...form, daily_allowance: Number(e.target.value) })
                      }
                      className="mt-1 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[0.68rem] font-bold text-muted-foreground block">
                      Potongan Terlambat
                    </label>
                    <Input
                      type="number"
                      value={form.late_deduction}
                      onChange={(e) => setForm({ ...form, late_deduction: Number(e.target.value) })}
                      className="mt-1 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[0.68rem] font-bold text-muted-foreground block">
                      Potongan Mangkir
                    </label>
                    <Input
                      type="number"
                      value={form.absence_deduction}
                      onChange={(e) =>
                        setForm({ ...form, absence_deduction: Number(e.target.value) })
                      }
                      className="mt-1 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => setViewMode("list")}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl font-bold shadow-brand"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Menyimpan Data..."
                      : form.role === "manager"
                      ? "Buat Akun Store Manager HQ"
                      : "Simpan Karyawan Cabang"}
                  </Button>
                </div>
              </section>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REKAP ABSENSI & WAJAH (ATTENDANCE LOGS)          */}
      {/* ======================================================== */}
      {activeTab === "attendance" && (
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-base">Rekapitulasi Absensi Wajah Seluruh Cabang</h3>
              <p className="text-xs text-muted-foreground">
                Data kehadiran real-time dari pemindaian biometrik kamera POS
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="rounded-xl text-xs gap-1"
            >
              <RefreshCw className="size-3" /> Refresh Log
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Verifikasi Wajah</th>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Cabang Outlet</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Perangkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {attendances.map((item, idx) => (
                  <tr key={`hq-att-${item.id || idx}-${idx}`} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      {item.face_snapshot_url ? (
                        <div className="size-10 rounded-xl overflow-hidden border border-border bg-muted/40">
                          <img
                            src={item.face_snapshot_url}
                            alt={item.staff_name}
                            className="size-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground">
                          <UserCheck className="size-4" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{item.staff_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.outlet_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 font-bold uppercase text-[0.65rem] ${
                          item.type === "in"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {item.type === "in" ? "Masuk" : "Keluar"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {new Date(item.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[0.68rem] ${
                          item.status === "on_time"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {item.status === "on_time"
                          ? "🟢 Tepat Waktu"
                          : `🟠 Terlambat ${item.late_minutes ? `(${item.late_minutes} mnt)` : ""}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-[0.68rem] max-w-xs truncate">
                      {item.device}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MANAJEMEN SHIFT KERJA                            */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* TAB 3: MANAJEMEN SHIFT KERJA & JADWAL MINGGUAN MULTI-CABANG */}
      {/* ======================================================== */}
      {activeTab === "shifts" && (
        <div className="space-y-6">
          {/* 1. Master Shift Configuration Cards */}
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Konfigurasi Master Shift Seluruh Cabang
                </h3>
                <p className="text-xs text-muted-foreground">
                  Jam kerja operasional, toleransi keterlambatan, dan acuan evaluasi absensi kasir &
                  kru.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {shifts.map((s, idx) => (
                <div
                  key={`hq-shift-${s.id || idx}-${idx}`}
                  className="rounded-2xl border border-border bg-card p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{s.shift_name}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.68rem] font-bold text-primary">
                      Toleransi: {s.grace_period_minutes} Menit
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[0.68rem] text-muted-foreground font-semibold uppercase">
                      Rentang Waktu Shift
                    </span>
                    <p className="text-xl font-mono font-bold text-foreground">
                      {s.start_time} - {s.end_time} WIB
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Check-in setelah jam <strong>{s.start_time}</strong> (+{s.grace_period_minutes}
                    m) otomatis tercatat <strong>Terlambat</strong> dan memotong tunjangan kehadiran
                    di payroll.
                  </p>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[0.68rem] text-muted-foreground font-semibold">
                      Status: Aktif
                    </span>
                    {currentUserRole !== "cashier" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg text-[0.68rem] font-bold"
                        onClick={() => setEditingShift(s)}
                      >
                        Ubah Shift
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Interactive Weekly Roster Schedule Toolbar */}
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
                  <CalendarRange className="size-4" />
                  <span>Multi-Branch Operational Matrix</span>
                </div>
                <h3 className="text-xl font-black text-foreground">
                  Jadwal Shift Kerja Mingguan & Rotasi Karyawan
                </h3>
                <p className="text-xs text-muted-foreground">
                  Atur penugasan Shift Pagi, Shift Malam, dan Libur (OFF) per cabang secara fleksibel
                  dan tersinkronisasi langsung ke POS kasir.
                </p>
              </div>

              {/* Toolbar Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Outlet Selector */}
                <div className="flex items-center gap-1.5">
                  <Store className="size-3.5 text-muted-foreground" />
                  <select
                    suppressHydrationWarning
                    value={rosterOutletId}
                    onChange={(e) => setRosterOutletId(e.target.value)}
                    className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
                  >
                    <option value="all">Semua Cabang (HQ)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.outlet_name || o.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month & Year Selectors */}
                <select
                  suppressHydrationWarning
                  value={rosterMonth}
                  onChange={(e) => setRosterMonth(Number(e.target.value))}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
                >
                  <option value={1}>Januari</option>
                  <option value={2}>Februari</option>
                  <option value={3}>Maret</option>
                  <option value={4}>April</option>
                  <option value={5}>Mei</option>
                  <option value={6}>Juni</option>
                  <option value={7}>Juli</option>
                  <option value={8}>Agustus</option>
                  <option value={9}>September</option>
                  <option value={10}>Oktober</option>
                  <option value={11}>November</option>
                  <option value={12}>Desember</option>
                </select>

                <select
                  suppressHydrationWarning
                  value={rosterYear}
                  onChange={(e) => setRosterYear(Number(e.target.value))}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                {/* Actions */}
                {currentUserRole !== "cashier" && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleGenerateRoster}
                      className="h-9 rounded-xl font-bold gap-1.5 text-xs shadow-brand"
                    >
                      <Sparkles className="size-3.5" />
                      <span>⚡ Generate Jadwal Otomatis</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsImportModalOpen(true)}
                      className="h-9 rounded-xl font-bold gap-1.5 text-xs"
                    >
                      <FileUp className="size-3.5" />
                      <span>📄 Import Jadwal (PDF / CSV)</span>
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="h-9 rounded-xl font-bold gap-1.5 text-xs"
                >
                  <Download className="size-3.5" />
                  <span>📥 Export CSV</span>
                </Button>
              </div>
            </div>

            {/* Today Indicator & Quick Jump Banner */}
            {(() => {
              const today = new Date();
              const todayDateStr = today.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const todayWeek = rosterSchedule?.weeks.find((w) =>
                w.days.some((d) => d.isToday),
              );
              const todayWeekNum = todayWeek ? todayWeek.weekNumber : null;

              return (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-foreground">
                      📍 Hari Ini: {todayDateStr} {todayWeekNum ? `(Minggu ${todayWeekNum})` : ""}
                    </span>
                  </div>
                  {todayWeekNum && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl font-bold text-xs gap-1.5 border-primary/30 bg-card hover:bg-primary/20 text-primary w-fit"
                      onClick={() => setActiveRosterWeekTab(todayWeekNum)}
                    >
                      <Sparkles className="size-3.5" />
                      Lompat ke Minggu Hari Ini (Minggu {todayWeekNum})
                    </Button>
                  )}
                </div>
              );
            })()}

            {/* Week Tab Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveRosterWeekTab(0)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeRosterWeekTab === 0
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Semua Minggu (1 - 5)
              </button>
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setActiveRosterWeekTab(w)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    activeRosterWeekTab === w
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Minggu {w}
                </button>
              ))}
            </div>

            {/* Roster Header Banner */}
            <div className="flex items-center justify-between rounded-xl bg-muted/30 border border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-foreground uppercase tracking-wider">
                  JADWAL KEHADIRAN |{" "}
                  {(
                    outlets.find((o) => o.id === rosterOutletId)?.name || "SEMUA CABANG (HQ)"
                  ).toUpperCase()}{" "}
                  —{" "}
                  {[
                    "Januari",
                    "Februari",
                    "Maret",
                    "April",
                    "Mei",
                    "Juni",
                    "Juli",
                    "Agustus",
                    "September",
                    "Oktober",
                    "November",
                    "Desember",
                  ][rosterMonth - 1]?.toUpperCase()}{" "}
                  {rosterYear}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                  Shift Pagi (2 slot)
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-primary/80 inline-block" />
                  Shift Malam (4 slot)
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-sky-500/80 inline-block" />
                  Libur / OFF
                </span>
              </div>
            </div>

            {/* Weekly Tables */}
            {rosterLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground text-xs font-bold">
                <RefreshCw className="size-5 animate-spin mr-2" />
                Memuat jadwal shift...
              </div>
            ) : rosterSchedule && rosterSchedule.weeks.length > 0 ? (
              <div className="space-y-6">
                {rosterSchedule.weeks
                  .filter((w) => activeRosterWeekTab === 0 || w.weekNumber === activeRosterWeekTab)
                  .map((week, weekIdx) => {
                    const actualWeekIdx = rosterSchedule.weeks.findIndex(
                      (w) => w.weekNumber === week.weekNumber,
                    );
                    return (
                      <div
                        key={`week-block-${week.weekNumber}`}
                        className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs"
                      >
                        {/* Week Header */}
                        <div className="flex items-center justify-between bg-muted/40 px-4 py-2.5 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-primary text-primary-foreground font-black text-xs px-2.5 py-0.5">
                              Minggu {week.weekNumber}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground">
                              Periode: {week.startDate} s/d {week.endDate}
                            </span>
                          </div>

                          {currentUserRole !== "cashier" && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                                Tambah Slot:
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 rounded-lg font-bold"
                                onClick={() => handleAddSlotRow(actualWeekIdx, "pagi")}
                              >
                                + Pagi
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 rounded-lg font-bold"
                                onClick={() => handleAddSlotRow(actualWeekIdx, "malam")}
                              >
                                + Malam
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 rounded-lg font-bold"
                                onClick={() => handleAddSlotRow(actualWeekIdx, "off")}
                              >
                                + OFF
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Schedule Matrix Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-muted/20 border-b border-border text-muted-foreground font-bold">
                                <th className="px-3 py-2.5 w-20 border-r border-border text-center">
                                  Minggu
                                </th>
                                <th className="px-3 py-2.5 w-36 border-r border-border">
                                  Slot Shift
                                </th>
                                {week.days.map((day) => (
                                  <th
                                    key={day.dateStr}
                                    className={cn(
                                      "px-3 py-2.5 text-center border-r border-border min-w-[110px] transition-colors",
                                      day.isToday
                                        ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-b-2 border-b-emerald-500"
                                        : day.isCurrentMonth
                                        ? "text-foreground"
                                        : "text-muted-foreground/50 bg-muted/10",
                                    )}
                                  >
                                    <div className="font-bold flex items-center justify-center gap-1.5">
                                      <span>{day.dayName}</span>
                                      {day.isToday && (
                                        <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-xs">
                                          HARI INI
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-[11px] font-mono",
                                        day.isToday
                                          ? "text-emerald-700 dark:text-emerald-300 font-extrabold"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {day.dayLabel || `Tgl ${day.dayNumber}`}
                                    </div>
                                  </th>
                                ))}
                                {currentUserRole !== "cashier" && (
                                  <th className="px-2 py-2.5 w-12 text-center">Aksi</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {week.rows.map((row) => {
                                const isPagi = row.shiftType === "pagi";
                                const isOff = row.shiftType === "off";

                                return (
                                  <tr
                                    key={row.id}
                                    className="border-b border-border hover:bg-muted/15 transition-colors"
                                  >
                                    <td className="px-3 py-2 text-center font-bold text-muted-foreground border-r border-border">
                                      W{week.weekNumber}
                                    </td>
                                    <td className="px-3 py-2 border-r border-border font-bold">
                                      <span
                                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-bold ${
                                          isPagi
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                                            : isOff
                                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                            : "bg-muted text-foreground border border-border"
                                        }`}
                                      >
                                        {row.label}
                                      </span>
                                    </td>

                                    {week.days.map((day) => {
                                      const cell = row.days[day.dateStr] || {
                                        staffName: "-",
                                        status: isOff ? "OFF" : "NORMAL",
                                        shiftType: row.shiftType,
                                      };

                                      const isCellOff =
                                        cell.status === "OFF" || cell.shiftType === "off";
                                      const isCellSakit = cell.status === "SAKIT";
                                      const isCellIzin = cell.status === "IZIN";

                                      return (
                                        <td
                                          key={day.dateStr}
                                          className={`p-1.5 border-r border-border text-center ${
                                            !day.isCurrentMonth ? "bg-muted/5 opacity-50" : ""
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            disabled={currentUserRole === "cashier"}
                                            onClick={() =>
                                              setCellEditModal({
                                                weekIndex: actualWeekIdx,
                                                rowId: row.id,
                                                dateStr: day.dateStr,
                                                dayName: day.dayName,
                                                dayNumber: day.dayNumber,
                                                cell,
                                              })
                                            }
                                            className={`w-full text-center rounded-xl px-2 py-2 transition-all font-bold text-xs ${
                                              currentUserRole !== "cashier"
                                                ? "hover:ring-2 hover:ring-primary cursor-pointer"
                                                : "cursor-default"
                                            } ${
                                              isCellOff
                                                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                                : isCellSakit
                                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                                : isCellIzin
                                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                                : isPagi
                                                ? "bg-rose-500/5 text-foreground hover:bg-rose-500/10 border border-rose-500/15"
                                                : "bg-muted/30 text-foreground hover:bg-muted/60 border border-border/40"
                                            }`}
                                          >
                                            <div className="flex items-center justify-center gap-1 truncate font-black">
                                              <span>{cell.staffName}</span>
                                              {cell.staffName && cell.staffName !== "-" && (
                                                (() => {
                                                  const matchedStaff = staffList.find(
                                                    (s) => s.name.trim().toLowerCase() === cell.staffName.trim().toLowerCase(),
                                                  );
                                                  const hr = matchedStaff ? getProfileForStaff(matchedStaff.user_id || matchedStaff.id) : null;
                                                  const g = hr?.gender || (matchedStaff as any)?.gender;
                                                  if (g === "female") {
                                                    return (
                                                      <span
                                                        className="inline-flex items-center justify-center size-3.5 rounded-full bg-pink-500/20 text-pink-600 dark:text-pink-400 text-[8px] font-black shrink-0"
                                                        title="Perempuan (P)"
                                                      >
                                                        P
                                                      </span>
                                                    );
                                                  }
                                                  if (g === "male") {
                                                    return (
                                                      <span
                                                        className="inline-flex items-center justify-center size-3.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-black shrink-0"
                                                        title="Laki-laki (L)"
                                                      >
                                                        L
                                                      </span>
                                                    );
                                                  }
                                                  return null;
                                                })()
                                              )}
                                            </div>
                                            {cell.status !== "NORMAL" && (
                                              <span className="text-[9px] uppercase tracking-wider block font-bold mt-0.5">
                                                [{cell.status}]
                                              </span>
                                            )}
                                          </button>
                                        </td>
                                      );
                                    })}

                                    {currentUserRole !== "cashier" && (
                                      <td className="px-2 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteSlotRow(actualWeekIdx, row.id)
                                          }
                                          className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                                          title="Hapus baris slot ini"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {/* 3. REKAPITULASI KEHADIRAN JADWAL KARYAWAN */}
            <div className="mt-8 rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide text-foreground">
                    REKAPITULASI KEHADIRAN JADWAL KARYAWAN |{" "}
                    {[
                      "Januari",
                      "Februari",
                      "Maret",
                      "April",
                      "Mei",
                      "Juni",
                      "Juli",
                      "Agustus",
                      "September",
                      "Oktober",
                      "November",
                      "Desember",
                    ][rosterMonth - 1]?.toUpperCase()}{" "}
                    {rosterYear}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Perhitungan real-time distribusi hari kerja (Shift Pagi & Malam), jatah libur
                    (OFF), dan absensi izin/sakit.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-bold w-fit">
                  {rosterRecapList.length} Staf Terdata
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Nama Karyawan</th>
                      <th className="px-4 py-3 text-center">Shift Pagi</th>
                      <th className="px-4 py-3 text-center">Shift Malam</th>
                      <th className="px-4 py-3 text-center font-black text-foreground">
                        Total Masuk
                      </th>
                      <th className="px-4 py-3 text-center">Total Libur (OFF)</th>
                      <th className="px-4 py-3 text-center">Izin / Sakit</th>
                      <th className="px-4 py-3 text-center font-black">Total Hari</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rosterRecapList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                          Belum ada data jadwal untuk periode ini. Klik "⚡ Generate Jadwal Otomatis".
                        </td>
                      </tr>
                    ) : (
                      rosterRecapList.map((item) => (
                        <tr
                          key={item.staffName}
                          className="hover:bg-muted/15 transition-colors font-medium"
                        >
                          <td className="px-4 py-3 font-bold text-foreground">{item.staffName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold text-xs">
                              {item.pagi} hari
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-lg bg-primary/10 text-primary px-2 py-0.5 font-bold text-xs">
                              {item.malam} hari
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black text-emerald-600 dark:text-emerald-400">
                            {item.totalMasuk} hari
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 font-bold text-xs">
                              {item.totalOff} hari
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-muted-foreground">
                            {item.izinSakit} hari
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                            {item.totalHari} hari
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PAYROLL & PENGGAJIAN TERHUBUNG ABSENSI          */}
      {/* ======================================================== */}
      {activeTab === "payroll" && currentUserRole !== "cashier" && (
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft space-y-5">
          {/* Header & Period Selector */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-0.5">
                <DollarSign className="size-3.5" />
                <span>Attendance-Linked Payroll Engine</span>
              </div>
              <h3 className="text-xl font-black">Payroll & Penggajian Karyawan</h3>
              <p className="text-xs text-muted-foreground">
                Data kehadiran (hari hadir, keterlambatan, dan mangkir) otomatis mengkalkulasi
                potongan & tunjangan gaji bersih.
              </p>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Periode:</span>
              <select
                suppressHydrationWarning
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(Number(e.target.value))}
                className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
              >
                <option value={1}>Januari</option>
                <option value={2}>Februari</option>
                <option value={3}>Maret</option>
                <option value={4}>April</option>
                <option value={5}>Mei</option>
                <option value={6}>Juni</option>
                <option value={7}>Juli</option>
                <option value={8}>Agustus</option>
                <option value={9}>September</option>
                <option value={10}>Oktober</option>
                <option value={11}>November</option>
                <option value={12}>Desember</option>
              </select>

              <select
                suppressHydrationWarning
                value={payrollYear}
                onChange={(e) => setPayrollYear(Number(e.target.value))}
                className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>

              <Button size="sm" onClick={loadData} className="rounded-xl font-bold h-9">
                Hitung Ulang
              </Button>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-4 py-3">Outlet</th>
                  <th className="px-4 py-3">Gaji Pokok</th>
                  <th className="px-4 py-3">Kehadiran (Absensi)</th>
                  <th className="px-4 py-3">Tunjangan (+)</th>
                  <th className="px-4 py-3">Potongan (-)</th>
                  <th className="px-4 py-3">Bonus (+)</th>
                  <th className="px-4 py-3">Total Gaji (Net)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {payrolls.map((pr, pIdx) => (
                  <tr key={`payroll-row-${pr.id || pIdx}-${pIdx}`} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold text-foreground">{pr.staff_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pr.outlet_name}</td>
                    <td className="px-4 py-3 font-mono">
                      Rp{Number(pr.base_salary || 0).toLocaleString("id-ID")}
                    </td>

                    {/* Attendance Metrics */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-emerald-600 block">
                          {pr.total_days_present || 0} Hari Hadir
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground block">
                          {pr.total_times_late || 0}x Telat &bull; {pr.total_days_absent || 0} Hari
                          Mangkir
                        </span>
                      </div>
                    </td>

                    {/* Allowance */}
                    <td className="px-4 py-3 font-mono text-emerald-600">
                      +Rp{Number(pr.allowance_amount || 0).toLocaleString("id-ID")}
                    </td>

                    {/* Deductions */}
                    <td className="px-4 py-3 font-mono text-destructive">
                      -Rp{Number(pr.deduction_amount || 0).toLocaleString("id-ID")}
                    </td>

                    {/* Bonus */}
                    <td className="px-4 py-3 font-mono text-blue-600">
                      +Rp{Number(pr.bonus_amount || 0).toLocaleString("id-ID")}
                    </td>

                    {/* Net Salary */}
                    <td className="px-4 py-3 font-mono font-black text-foreground text-sm">
                      Rp{Number(pr.net_salary || 0).toLocaleString("id-ID")}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 font-bold uppercase text-[0.65rem] ${
                          pr.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {pr.status === "paid" ? "Dibayar" : "Draft"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[0.68rem] font-bold gap-1"
                          onClick={() => setSelectedPayslip(pr)}
                        >
                          <FileText className="size-3" />
                          Slip Gaji
                        </Button>

                        {pr.status !== "paid" && (
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-[0.68rem] font-bold shadow-brand gap-1"
                            onClick={() => handlePaySalary(pr)}
                          >
                            <Check className="size-3" />
                            Bayar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: PENGATURAN HAK AKSES ROLE MANAGER (HQ CONTROL)     */}
      {/* ======================================================== */}
      {activeTab === "manager_permissions" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="rounded-[2rem] border border-border bg-card/85 p-6 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="size-5 text-primary" />
                  <span>🎛️ Pengaturan Hak Akses Role Manager (Bisa Di-ON/OFF-kan)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Kontrol tegas hak akses peran Manager cabang. Nilai disimpan ke database Supabase (outlets.settings) &amp; cache lokal.
                </p>
              </div>

              <Button
                type="button"
                onClick={async () => {
                  setSavingManagerPerms(true);
                  try {
                    await saveManagerPermissions(systemManagerPerms);
                    toast.success("Pengaturan Hak Akses Role Manager berhasil disimpan!");
                  } catch {
                    toast.error("Gagal menyimpan hak akses manager");
                  } finally {
                    setSavingManagerPerms(false);
                  }
                }}
                disabled={savingManagerPerms}
                className="rounded-2xl font-bold shadow-brand gap-2"
              >
                {savingManagerPerms ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                <span>Simpan Pengaturan Hak Akses</span>
              </Button>
            </div>

            {/* Scope Cabang */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <label className="text-xs font-black text-foreground flex items-center gap-2">
                <Store className="size-4 text-primary" />
                <span>Scope Cabang yang Dikelola Manager (branch_scope)</span>
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md pt-1">
                <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  systemManagerPerms.branch_scope !== "all" ? "bg-background border-primary shadow-xs" : "bg-card border-border hover:bg-muted"
                }`}>
                  <input
                    type="radio"
                    name="branch_scope"
                    checked={systemManagerPerms.branch_scope !== "all"}
                    onChange={() => setSystemManagerPerms((prev) => ({ ...prev, branch_scope: "single" }))}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">Single Branch (Hanya Cabang Tugas)</p>
                    <p className="text-[10px] text-muted-foreground">Default aman: manager hanya akses 1 cabang tempatnya ditugaskan</p>
                  </div>
                </label>

                <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  systemManagerPerms.branch_scope === "all" ? "bg-background border-primary shadow-xs" : "bg-card border-border hover:bg-muted"
                }`}>
                  <input
                    type="radio"
                    name="branch_scope"
                    checked={systemManagerPerms.branch_scope === "all"}
                    onChange={() => setSystemManagerPerms((prev) => ({ ...prev, branch_scope: "all" }))}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground">All Branches (Seluruh Cabang HQ)</p>
                    <p className="text-[10px] text-muted-foreground">Manager dapat melihat data seluruh cabang outlet</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 6 Permission Toggles */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* 1. can_manage_inventory */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground">1. Akses Inventaris &amp; Bahan Baku (can_manage_inventory)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Izinkan Manager mencatat restock masuk, stok keluar, dan stok opname bahan baku di cabang.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_manage_inventory}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_manage_inventory: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>

              {/* 2. can_manage_staff_shift */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground">2. Atur Shift &amp; Jadwal Karyawan (can_manage_staff_shift)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Izinkan Manager mengedit roster shift mingguan staf dan menyetujui absensi kasir.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_manage_staff_shift}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_manage_staff_shift: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>

              {/* 3. can_view_branch_reports */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground">3. Lihat Laporan Penjualan Cabang (can_view_branch_reports)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Izinkan Manager melihat ringkasan omzet, analitik produk terlaris, dan riwayat pesanan cabang.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_view_branch_reports}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_view_branch_reports: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>

              {/* 4. can_spend_ingredient_pockets */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground">4. Pakai Saldo Tabungan Belanja (can_spend_ingredient_pockets)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Izinkan Manager mencairkan saldo tabungan bahan baku untuk restock fisik langsung.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_spend_ingredient_pockets}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_spend_ingredient_pockets: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>

              {/* 5. can_edit_menu_recipes (Default: OFF) */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <span>5. Edit Resep &amp; Harga Modal HPP (can_edit_menu_recipes)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 font-bold">Sensitif</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Default OFF. Jika dinonaktifkan, Manager dilarang merubah takaran resep dan harga modal HPP menu.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_edit_menu_recipes}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_edit_menu_recipes: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>

              {/* 6. can_view_owner_net_profit (Default: OFF) */}
              <div className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <span>6. Lihat Laba Bersih Murni Owner (can_view_owner_net_profit)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 font-bold">Rahasia Owner</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Default OFF. Jika dinonaktifkan, kartu &quot;Sisa Laba Murni Owner&quot; di Alokasi Keuangan disembunyikan/dikunci untuk Manager.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemManagerPerms.can_view_owner_net_profit}
                  onChange={(e) => setSystemManagerPerms((p) => ({ ...p, can_view_owner_net_profit: e.target.checked }))}
                  className="size-5 accent-primary rounded cursor-pointer mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT PROFIL HR LENGKAP                            */}
      {/* ======================================================== */}
      {editingProfile && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-black">Edit Profil HR & Kompensasi</h3>
                <p className="text-xs text-muted-foreground">{editingProfile.full_name}</p>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Foto Biometrik & Face Registration */}
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {editingProfile.avatar_url ? (
                    <img
                      src={editingProfile.avatar_url}
                      alt={editingProfile.full_name}
                      className="size-14 rounded-2xl object-cover border border-primary/40 shadow-xs"
                    />
                  ) : (
                    <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl">
                      {editingProfile.full_name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-xs text-foreground">
                      Pendaftaran Wajah Biometrik
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {editingProfile.avatar_url
                        ? "✓ Foto biometrik aktif untuk absensi wajah POS"
                        : "Belum terdaftar untuk absensi wajah di POS"}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFaceModalStaff(selectedStaff);
                    setFaceModalProfile(editingProfile);
                    setFaceCapturedPhoto(editingProfile.avatar_url || null);
                    startFaceCamera();
                  }}
                  className="rounded-xl text-xs font-bold gap-1.5 shrink-0"
                >
                  <Camera className="size-3.5 text-primary" />
                  {editingProfile.avatar_url ? "Ubah Foto Wajah" : "Daftar Wajah"}
                </Button>
              </div>

              <div>
                <label className="font-bold text-foreground/80 block mb-1">Nama Lengkap</label>
                <Input
                  value={editingProfile.full_name}
                  onChange={(e) =>
                    setEditingProfile({ ...editingProfile, full_name: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Nomor Telepon / WA
                  </label>
                  <Input
                    value={editingProfile.phone}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, phone: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Jabatan Pekerjaan
                  </label>
                  <Input
                    value={editingProfile.job_title}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, job_title: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Jenis Kelamin (Gender)
                  </label>
                  <select
                    value={editingProfile.gender || "male"}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        gender: e.target.value as "male" | "female",
                      })
                    }
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="male">👨 Laki-laki (Cowok)</option>
                    <option value="female">👩 Perempuan (Cewek)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">Alamat Domisili</label>
                  <Input
                    value={editingProfile.address}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, address: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">Role / Jabatan Sistem</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="cashier">Kasir POS Cabang</option>
                    <option value="crew">Kru Operasional / Prep</option>
                    <option value="admin">Admin Cabang</option>
                    <option value="manager">Store Manager (Akses HQ)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">Cabang Penugasan</label>
                  <select
                    value={editOutletId}
                    onChange={(e) => setEditOutletId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {outlets.map((outlet, oIdx) => (
                      <option key={`edit-outlet-${outlet.id || oIdx}-${oIdx}`} value={outlet.id}>
                        {outlet.outlet_name || outlet.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* If Role is Store Manager, show HQ credentials and permissions */}
              {editRole === "manager" && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      🔑 Akses Login HQ Store Manager
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block text-[10px] uppercase mb-1">
                      Email Gmail Store Manager
                    </label>
                    <Input
                      type="email"
                      value={editManagerEmail}
                      onChange={(e) => setEditManagerEmail(e.target.value)}
                      placeholder="manager@kebabschoice.com"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block text-[10px] uppercase mb-1">
                      Password Baru (Kosongkan jika tidak diubah)
                    </label>
                    <Input
                      type="password"
                      value={editManagerPassword}
                      onChange={(e) => setEditManagerPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>

                  {editManagerPassword && (
                    <div className="rounded-xl border border-primary/20 bg-background/80 p-2.5 space-y-1.5">
                      <div className="text-[10px] text-muted-foreground">
                        🛡️ Otorisasi Owner: <span className="font-mono font-bold text-primary">{ownerEmail || "ujicobaajaoke@gmail.com"}</span>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editOwnerGmailConfirmed}
                          onChange={(e) => setEditOwnerGmailConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-input size-3.5 text-primary"
                        />
                        <span className="text-[10px] text-foreground leading-snug">
                          Saya selaku Owner mengizinkan pembuatan / pembaruan kredensial Store Manager ini.
                        </span>
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-muted-foreground block text-[10px] uppercase mb-1.5">
                      🛡️ Hak Akses Menu HQ (Store Manager)
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {HQ_PERMISSIONS_CONFIG.map((p) => {
                        const isChecked = editManagerPermissions.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors",
                              isChecked
                                ? "border-primary/40 bg-primary/5 text-foreground"
                                : "border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/40",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditManagerPermissions([...editManagerPermissions, p.key]);
                                } else {
                                  setEditManagerPermissions(
                                    editManagerPermissions.filter((k) => k !== p.key),
                                  );
                                }
                              }}
                              className="rounded border-input size-3.5 text-primary"
                            />
                            <div className="flex items-center justify-between flex-1">
                              <span className="font-bold text-xs">{p.label}</span>
                              <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Status Kepegawaian
                  </label>
                  <select
                    value={editingProfile.employment_status}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        employment_status: e.target.value as any,
                      })
                    }
                    className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold"
                  >
                    <option value="Tetap">Tetap</option>
                    <option value="Kontrak">Kontrak</option>
                    <option value="Probation">Probation</option>
                    <option value="Magang">Magang</option>
                  </select>
                </div>
                {currentUserRole !== "cashier" && (
                  <div>
                    <label className="font-bold text-foreground/80 block mb-1">
                      Gaji Pokok (Rp)
                    </label>
                    <Input
                      type="number"
                      value={editingProfile.base_salary}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          base_salary: Number(e.target.value),
                        })
                      }
                      className="rounded-xl font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-foreground/80 block mb-1">
                  Jadwal Shift Default
                </label>
                <select
                  value={editingProfile.default_shift || "Shift Pagi"}
                  onChange={(e) =>
                    setEditingProfile({ ...editingProfile, default_shift: e.target.value })
                  }
                  className="w-full h-10 rounded-xl border border-input bg-card px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {shifts && shifts.length > 0 ? (
                    shifts.map((s) => (
                      <option key={s.id} value={s.shift_name}>
                        {s.shift_name} ({s.start_time} - {s.end_time})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Shift Pagi">Shift Pagi (07:00 - 16:00)</option>
                      <option value="Shift Malam">Shift Malam (13:00 - 22:00)</option>
                    </>
                  )}
                  <option value="Full/Rolling">Full / Rolling (Fleksibel Cabang)</option>
                </select>
              </div>

              {currentUserRole !== "cashier" && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <label className="font-bold text-muted-foreground block text-[0.68rem]">
                      Tunjangan/Hari (Rp)
                    </label>
                    <Input
                      type="number"
                      value={editingProfile.daily_allowance}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          daily_allowance: Number(e.target.value),
                        })
                      }
                      className="rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground block text-[0.68rem]">
                      Potongan Telat (Rp)
                    </label>
                    <Input
                      type="number"
                      value={editingProfile.late_deduction}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          late_deduction: Number(e.target.value),
                        })
                      }
                      className="rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground block text-[0.68rem]">
                      Potongan Mangkir (Rp)
                    </label>
                    <Input
                      type="number"
                      value={editingProfile.absence_deduction}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          absence_deduction: Number(e.target.value),
                        })
                      }
                      className="rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setEditingProfile(null)}
                className="rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveProfileEdit}
                disabled={savingProfile}
                className="rounded-xl font-bold shadow-brand"
              >
                {savingProfile ? "Menyimpan..." : "Simpan Perubahan HR"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT JADWAL SHIFT                                 */}
      {/* ======================================================== */}
      {editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-black">Edit Jadwal Shift</h3>
                <p className="text-xs text-muted-foreground">{editingShift.shift_name}</p>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground/80 block mb-1">Nama Shift</label>
                <Input
                  value={editingShift.shift_name}
                  onChange={(e) => setEditingShift({ ...editingShift, shift_name: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">Jam Mulai</label>
                  <Input
                    type="time"
                    value={editingShift.start_time}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, start_time: e.target.value })
                    }
                    className="rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">Jam Selesai</label>
                  <Input
                    type="time"
                    value={editingShift.end_time}
                    onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                    className="rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground/80 block mb-1">
                  Toleransi Keterlambatan (Menit)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={editingShift.grace_period_minutes}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      grace_period_minutes: Number(e.target.value) || 0,
                    })
                  }
                  className="rounded-xl font-mono"
                />
                <span className="text-[0.68rem] text-muted-foreground mt-1 block">
                  Check-in setelah jam mulai + toleransi akan tercatat Terlambat.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingShift(null)}
                className="rounded-xl"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSaveShiftEdit}
                disabled={savingShift}
                className="rounded-xl font-bold shadow-brand"
              >
                {savingShift ? "Menyimpan..." : "Simpan Shift"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CETAK SLIP GAJI                                   */}
      {/* ======================================================== */}
      {selectedPayslip && currentUserRole !== "cashier" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <h3 className="text-base font-black">Slip Gaji Karyawan</h3>
              </div>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Slip Paper Preview */}
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 space-y-4 text-xs">
              <div className="text-center border-b border-border pb-3">
                <h4 className="font-black text-sm uppercase tracking-wide text-foreground">
                  Kebabs Choice POS
                </h4>
                <p className="text-[0.68rem] text-muted-foreground">
                  {selectedPayslip.outlet_name || "Outlet Pusat"}
                </p>
                <p className="text-[0.68rem] text-primary font-bold mt-1">
                  SLIP GAJI PERIODE {selectedPayslip.period_month}/{selectedPayslip.period_year}
                </p>
              </div>

              <div className="space-y-1.5 border-b border-border pb-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama Karyawan:</span>
                  <strong className="text-foreground">{selectedPayslip.staff_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hari Kehadiran:</span>
                  <span className="font-bold text-foreground">
                    {selectedPayslip.total_days_present} Hari
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keterlambatan:</span>
                  <span className="font-bold text-amber-600">
                    {selectedPayslip.total_times_late} Kali
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tidak Masuk (Mangkir):</span>
                  <span className="font-bold text-destructive">
                    {selectedPayslip.total_days_absent} Hari
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-border pb-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gaji Pokok:</span>
                  <span className="font-mono font-semibold">
                    Rp{Number(selectedPayslip.base_salary || 0).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Tunjangan Kehadiran:</span>
                  <span className="font-mono font-semibold">
                    +Rp{Number(selectedPayslip.allowance_amount || 0).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Bonus / Insentif:</span>
                  <span className="font-mono font-semibold">
                    +Rp{Number(selectedPayslip.bonus_amount || 0).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Potongan Absensi:</span>
                  <span className="font-mono font-semibold">
                    -Rp{Number(selectedPayslip.deduction_amount || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm font-black pt-1">
                <span>TOTAL GAJI DITERIMA:</span>
                <span className="font-mono text-base text-primary">
                  Rp{Number(selectedPayslip.net_salary || 0).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="text-center pt-2 text-[0.65rem] text-muted-foreground italic">
                Status: {selectedPayslip.status === "paid" ? "LUNAS / DIBAYARKAN" : "DRAFT"}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl font-bold gap-1 text-xs"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="size-3.5" />
                Cetak Slip
              </Button>
              <Button
                className="rounded-xl font-bold shadow-brand text-xs"
                onClick={() => setSelectedPayslip(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: HAPUS AKUN KARYAWAN                               */}
      {/* ======================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Hapus Akun Karyawan?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tindakan ini akan menghapus akses login untuk karyawan ini.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">Karyawan: </span>
              <strong className="text-foreground">{deleteTarget.name}</strong> ({deleteTarget.email}
              )
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                className="rounded-xl"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl font-bold"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DAFTAR WAJAH BIOMETRIK KARYAWAN                   */}
      {/* ======================================================== */}
      {faceModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Camera className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Daftar Wajah Biometrik</h3>
                  <p className="text-xs text-muted-foreground">
                    {faceModalStaff.name} ({faceModalStaff.role.toUpperCase()})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopFaceCamera();
                  setFaceModalStaff(null);
                  setFaceModalProfile(null);
                  setFaceCapturedPhoto(null);
                }}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Hidden canvas & file input */}
            <canvas ref={faceCanvasRef} className="hidden" />
            <input
              type="file"
              ref={faceFileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFaceFileUpload}
            />

            {/* Camera Viewport or Captured Photo Preview */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-900 border border-border flex items-center justify-center">
              {faceCapturedPhoto ? (
                <div className="relative size-full">
                  <img
                    src={faceCapturedPhoto}
                    alt="Foto Biometrik"
                    className="size-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 text-center text-white text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Foto Wajah Siap Digunakan untuk Absensi POS</span>
                  </div>
                </div>
              ) : isFaceCameraActive ? (
                <div className="relative size-full flex items-center justify-center">
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="size-full object-cover scale-x-[-1]"
                  />
                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="size-52 rounded-full border-2 border-dashed border-primary/80 shadow-[0_0_30px_rgba(234,88,12,0.3)] animate-pulse" />
                  </div>
                  <div className="absolute top-3 inset-x-3 text-center pointer-events-none">
                    <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      Posisikan wajah Anda di dalam lingkaran
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground border border-border">
                    <Camera className="size-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Kamera Belum Aktif</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {faceCameraError ||
                        "Nyalakan webcam untuk mengambil foto wajah atau unggah file foto."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={startFaceCamera}
                      className="rounded-xl text-xs font-bold gap-1.5"
                    >
                      <Camera className="size-3.5" />
                      Nyalakan Kamera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => faceFileInputRef.current?.click()}
                      className="rounded-xl text-xs font-bold gap-1.5"
                    >
                      <Upload className="size-3.5" />
                      Pilih dari File
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  stopFaceCamera();
                  setFaceModalStaff(null);
                  setFaceModalProfile(null);
                  setFaceCapturedPhoto(null);
                }}
                className="rounded-xl text-xs font-bold"
              >
                Batal
              </Button>

              <div className="flex items-center gap-2">
                {faceCapturedPhoto ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFaceCapturedPhoto(null);
                        startFaceCamera();
                      }}
                      className="rounded-xl text-xs font-bold"
                    >
                      Ambil Ulang
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveFaceRegistration}
                      disabled={savingFace}
                      className="rounded-xl text-xs font-bold shadow-brand gap-1.5"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {savingFace ? "Menyimpan..." : "Simpan Wajah Biometrik"}
                    </Button>
                  </>
                ) : isFaceCameraActive ? (
                  <Button
                    type="button"
                    onClick={captureFaceSnapshot}
                    className="rounded-xl text-xs font-bold shadow-brand gap-1.5"
                  >
                    <Camera className="size-3.5" />
                    Ambil Foto Wajah
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: EDIT CELL JADWAL SHIFT MINGGUAN                 */}
      {/* ======================================================== */}
      {cellEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Ubah Jadwal Slot Kehadiran</h3>
                <p className="text-xs text-muted-foreground">
                  {cellEditModal.dayName}, Tgl {cellEditModal.dayNumber} ({cellEditModal.dateStr})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCellEditModal(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formEl = e.currentTarget as HTMLFormElement;
                const staffName = (
                  formEl.elements.namedItem("cellStaffName") as HTMLInputElement
                ).value;
                const status = (
                  formEl.elements.namedItem("cellStatus") as HTMLSelectElement
                ).value as any;
                const shiftType = (
                  formEl.elements.namedItem("cellShiftType") as HTMLSelectElement
                ).value as any;
                const note = (formEl.elements.namedItem("cellNote") as HTMLInputElement).value;
                handleSaveCellEdit(staffName, status, shiftType, note);
              }}
              className="space-y-4"
            >
              {/* Staff Selector */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Nama Karyawan Bertugas
                </label>
                <div className="relative mt-1">
                  <Input
                    name="cellStaffName"
                    defaultValue={
                      cellEditModal.cell.staffName !== "-" ? cellEditModal.cell.staffName : ""
                    }
                    placeholder="Pilih atau ketik nama karyawan"
                    className="rounded-xl text-xs font-bold"
                    list="staff-name-suggestions"
                    required
                  />
                  <datalist id="staff-name-suggestions">
                    {staffList.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {staffList.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(ev) => {
                        const input = ev.currentTarget.form?.elements.namedItem(
                          "cellStaffName",
                        ) as HTMLInputElement;
                        if (input) input.value = s.name;
                      }}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Kehadiran & Tipe Shift */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground">Status Kehadiran</label>
                  <select
                    name="cellStatus"
                    defaultValue={cellEditModal.cell.status}
                    className="mt-1 w-full h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
                  >
                    <option value="NORMAL">NORMAL (Masuk Kerja)</option>
                    <option value="OFF">OFF (Libur Mingguan)</option>
                    <option value="SAKIT">SAKIT (Izin Sakit)</option>
                    <option value="IZIN">IZIN (Cuti / Keperluan)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">Tipe Shift</label>
                  <select
                    name="cellShiftType"
                    defaultValue={cellEditModal.cell.shiftType}
                    className="mt-1 w-full h-9 rounded-xl border border-input bg-card px-3 text-xs font-bold shadow-xs"
                  >
                    <option value="pagi">Shift Pagi (08:00 - 16:00)</option>
                    <option value="malam">Shift Malam (16:00 - 00:00)</option>
                    <option value="off">Libur (OFF)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Catatan Khusus (Opsional)
                </label>
                <Input
                  name="cellNote"
                  defaultValue={cellEditModal.cell.note || ""}
                  placeholder="Contoh: Tukar shift dengan Rehan"
                  className="mt-1 rounded-xl text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCellEditModal(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-xs font-bold shadow-brand gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  Simpan Jadwal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: IMPORT JADWAL SHIFT (PDF / CSV / TEKS)          */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  📄 Import Jadwal Shift (PDF / CSV / Teks)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Unggah file CSV/TXT atau tempel teks jadwal hasil copy dari PDF / Excel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRawText("");
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* File upload input */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Pilih File Jadwal (.csv, .tsv, .txt, .pdf)
                </label>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string;
                        if (content) {
                          setImportRawText(content);
                          toast.success(`File "${file.name}" berhasil dibaca!`);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => importFileInputRef.current?.click()}
                  className="w-full rounded-xl text-xs font-bold h-10 gap-2 border-dashed border-2"
                >
                  <FileUp className="size-4" />
                  <span>Klik untuk Browse File (.csv / .tsv / .txt / .pdf)</span>
                </Button>
              </div>

              {/* Raw Text / Paste Area */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Atau Tempel / Ketik Teks Jadwal di Sini:
                </label>
                <textarea
                  rows={7}
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  placeholder={`Format 1 (CSV dengan Tanggal & Nama):
1, Tofik, Adnan, Rehan, Cipa, Emil, Ica, Azkia (OFF)
2, Adnan, Rehan, Cipa, Emil, Ica, Azkia, Tofik (OFF)

Format 2 (Daftar Nama Staf untuk Auto-Rotasi):
Tofik, Adnan, Rehan, Cipa, Emil, Ica, Azkia`}
                  className="w-full rounded-xl border border-input bg-card p-3 text-xs font-mono shadow-xs resize-none"
                />
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  Sistem otomatis mendeteksi format tanggal, delimiter koma/tab, serta status (OFF,
                  Sakit, Izin).
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRawText("");
                }}
                className="rounded-xl text-xs font-bold"
              >
                Batal
              </Button>

              <Button
                type="button"
                disabled={!importRawText.trim()}
                onClick={() => handleParseAndApplyImport(importRawText)}
                className="rounded-xl text-xs font-bold shadow-brand gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                Terapkan Jadwal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
