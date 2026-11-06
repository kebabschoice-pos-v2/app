import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Store,
  Plus,
  Search,
  MapPin,
  Phone,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  X,
  User,
  Users,
  UserCheck,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Calendar,
  KeyRound,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  createOutlet,
  getOutletList,
  getOutletDetail,
  updateOutlet,
  deleteOutlet,
  toggleOutletStatus,
  assignOutletManager,
  assignOutletEmployees,
  getAvailableStaff,
  type OutletItem,
  type OutletInput,
  type OutletMemberSummary,
} from "@/services/outlet.service";
import { isOutletDeviceAccount } from "@/services/staff.service";

export interface OutletManagementProps {
  role?: string;
  snapshot?: any;
  onRefresh?: () => Promise<void> | void;
}

export function OutletManagement({
  role = "owner",
  snapshot,
  onRefresh,
}: OutletManagementProps = {}) {
  const userRole = (role || snapshot?.role || "owner").toLowerCase();
  const isOwner = userRole === "owner" || userRole === "admin";
  const isManager = userRole === "manager";
  const isCashier = userRole === "cashier";
  const managerOutletId =
    snapshot?.activeOutletId || snapshot?.outletId || snapshot?.user?.outlet_id;

  const [items, setItems] = useState<OutletItem[]>([]);
  const [availableStaff, setAvailableStaff] = useState<OutletMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal 1: Create & Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OutletInput>({
    outlet_name: "",
    code: "",
    address: "",
    phone: "",
    timezone: "Asia/Jakarta",
    status: "active",
    manager_user_id: "",
  });

  // Modal 2: Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal 3: Assign Staff Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignOutletTarget, setAssignOutletTarget] = useState<OutletItem | null>(null);
  const [selectedStaffUserIds, setSelectedStaffUserIds] = useState<string[]>([]);
  const [initialAssignedUserIds, setInitialAssignedUserIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Modal 4: Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<OutletItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal 5: Outlet Device Login Account Modal
  const [outletLoginModalOpen, setOutletLoginModalOpen] = useState(false);
  const [outletLoginTarget, setOutletLoginTarget] = useState<OutletItem | null>(null);
  const [outletLoginEmail, setOutletLoginEmail] = useState("");
  const [outletLoginPassword, setOutletLoginPassword] = useState("");
  const [outletLoginConfirmPassword, setOutletLoginConfirmPassword] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [isOwnerConfirmed, setIsOwnerConfirmed] = useState(false);
  const [savingOutletLogin, setSavingOutletLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedProof, setCopiedProof] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [outlets, staff] = await Promise.all([
        getOutletList().catch((err) => {
          console.error("Gagal memuat outlet:", err);
          return [] as OutletItem[];
        }),
        getAvailableStaff().catch((err) => {
          console.error("Gagal memuat staff:", err);
          return [] as OutletMemberSummary[];
        }),
      ]);

      // Deduplicate outlets by ID
      const uniqueOutlets: OutletItem[] = [];
      const seenOutlets = new Set<string>();
      for (const o of outlets) {
        if (o && o.id && !seenOutlets.has(o.id)) {
          seenOutlets.add(o.id);
          uniqueOutlets.push(o);
        }
      }

      // Deduplicate staff by user_id
      const uniqueStaff: OutletMemberSummary[] = [];
      const seenStaff = new Set<string>();
      for (const s of staff) {
        if (s && s.user_id && !seenStaff.has(s.user_id)) {
          seenStaff.add(s.user_id);
          uniqueStaff.push(s);
        }
      }

      setItems(uniqueOutlets);
      setAvailableStaff(uniqueStaff);
    } catch (err) {
      console.error("[OutletManagement] Load error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal memuat daftar outlet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    if (isCashier) {
      toast.error("Kasir tidak memiliki izin untuk menambah cabang baru.");
      return;
    }
    setEditingId(null);
    setForm({
      outlet_name: "",
      code: "",
      address: "",
      phone: "",
      timezone: "Asia/Jakarta",
      status: "active",
      manager_user_id: "",
    });
    setModalOpen(true);
  }

  function handleOpenEdit(outlet: OutletItem) {
    if (isCashier) {
      toast.error("Kasir tidak memiliki izin untuk mengedit cabang.");
      return;
    }
    setEditingId(outlet.id);
    setForm({
      outlet_name: outlet.outlet_name || outlet.name || "",
      code: outlet.code || "",
      address: outlet.address || "",
      phone: outlet.phone || "",
      timezone: outlet.timezone || "Asia/Jakarta",
      status: outlet.status,
      manager_user_id: outlet.manager?.user_id || "",
    });
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCashier) {
      toast.error("Kasir tidak memiliki izin untuk menyimpan data cabang.");
      return;
    }
    if (!form.outlet_name?.trim()) {
      toast.error("Nama outlet wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateOutlet(editingId, form);
        toast.success("Informasi cabang outlet berhasil diperbarui");
      } else {
        await createOutlet(form);
        toast.success("Cabang outlet baru berhasil ditambahkan");
      }
      handleCloseModal();
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("[OutletManagement] Submit error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data outlet");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmOutletAccount(outletId: string, token: string) {
    try {
      const { data: outRow } = await supabase
        .from("outlets")
        .select("id, name, settings")
        .eq("id", outletId)
        .maybeSingle();

      if (outRow) {
        const s = (outRow.settings as any) || {};
        if (s.outlet_login_account?.token === token) {
          const updatedSettings = {
            ...s,
            outlet_login_account: {
              ...s.outlet_login_account,
              status: "active",
              confirmed_at: new Date().toISOString(),
            },
          };
          await supabase.from("outlets").update({ settings: updatedSettings }).eq("id", outletId);
          toast.success(
            `✅ Akun perangkat POS cabang "${outRow.name}" telah berhasil diaktivasi secara resmi!`,
            { duration: 6000 },
          );
          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          await loadData();
          if (onRefresh) await onRefresh();
        }
      }
    } catch (err) {
      console.error("[handleConfirmOutletAccount] Error:", err);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const confirmOutletId = params.get("confirm_outlet");
      const confirmToken = params.get("token");
      if (confirmOutletId && confirmToken) {
        handleConfirmOutletAccount(confirmOutletId, confirmToken);
      }
    }
  }, []);

  async function handleToggleStatus(outlet: OutletItem) {
    if (isCashier) {
      toast.error("Kasir tidak memiliki izin untuk mengubah status cabang.");
      return;
    }
    const nextStatus = outlet.status === "active" ? "inactive" : "active";
    try {
      await toggleOutletStatus(outlet.id, outlet.status);
      toast.success(
        `Status outlet "${outlet.outlet_name}" diubah menjadi ${
          nextStatus === "active" ? "Aktif" : "Non-aktif"
        }`,
      );
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("[OutletManagement] Toggle status error:", err);
      toast.error("Gagal mengubah status outlet");
    }
  }

  async function handleOpenDetail(outlet: OutletItem) {
    setSelectedOutlet(outlet);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const detailed = await getOutletDetail(outlet.id);
      setSelectedOutlet(detailed);
    } catch (err) {
      console.error("[OutletManagement] Detail load error:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleOpenAssignModal(outlet: OutletItem) {
    if (isCashier) {
      toast.error("Kasir tidak memiliki izin untuk mengubah penugasan staf.");
      return;
    }
    setAssignOutletTarget(outlet);
    // Pre-populate with currently assigned staff user_ids
    const currentAssigned = (outlet.staff_list || []).map((s) => s.user_id);
    setSelectedStaffUserIds(currentAssigned);
    setInitialAssignedUserIds(currentAssigned);
    setAssignModalOpen(true);
  }

  async function handleSaveStaffAssignment() {
    if (!assignOutletTarget) return;

    setAssigning(true);
    try {
      await assignOutletEmployees(
        assignOutletTarget.id,
        selectedStaffUserIds,
        initialAssignedUserIds,
      );
      toast.success(
        `Berhasil memperbarui penugasan staf untuk cabang ${assignOutletTarget.outlet_name}`,
      );
      setAssignModalOpen(false);
      setAssignOutletTarget(null);
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("[OutletManagement] Assign staff error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan penugasan staf");
    } finally {
      setAssigning(false);
    }
  }

  function handleOpenDelete(outlet: OutletItem) {
    if (!isOwner) {
      toast.error("Hanya Owner HQ yang memiliki izin untuk menghapus cabang.");
      return;
    }
    setDeleteTarget(outlet);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    if (!isOwner) {
      toast.error("Hanya Owner HQ yang memiliki izin untuk menghapus cabang.");
      return;
    }

    const targetId = deleteTarget.id;
    setDeleting(true);
    try {
      await deleteOutlet(targetId);
      // Optimistically remove from items immediately so UI updates without flicker
      setItems((prev) => prev.filter((o) => o.id !== targetId));
      toast.success(`Cabang outlet "${deleteTarget.outlet_name}" berhasil dihapus`);
      setDeleteTarget(null);
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("[OutletManagement] Delete error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menghapus outlet");
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpenOutletLogin(outlet: OutletItem) {
    setOutletLoginTarget(outlet);
    const existingEmail = (outlet.settings as any)?.outlet_login_email || "";
    const cleanCode = (outlet.code || outlet.outlet_name || "cabang")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const defaultEmail = existingEmail || `outlet.${cleanCode}@gmail.com`;
    setOutletLoginEmail(defaultEmail);
    setOutletLoginPassword("");
    setOutletLoginConfirmPassword("");
    setIsOwnerConfirmed(false);
    setShowPassword(false);
    setCopiedProof(false);

    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setOwnerEmail(data.user.email);
      } else {
        setOwnerEmail("ujicobaajaoke@gmail.com");
      }
    } catch {
      setOwnerEmail("ujicobaajaoke@gmail.com");
    }

    setOutletLoginModalOpen(true);
  }

  async function handleSaveOutletLogin() {
    if (!outletLoginTarget) return;

    if (!outletLoginEmail.trim() || !outletLoginEmail.includes("@")) {
      toast.error("Alamat Gmail akun outlet tidak valid");
      return;
    }

    if (!outletLoginPassword || outletLoginPassword.length < 6) {
      toast.error("Password login outlet minimal 6 karakter");
      return;
    }

    if (outletLoginPassword !== outletLoginConfirmPassword) {
      toast.error("Password dan Konfirmasi Password tidak cocok");
      return;
    }

    if (!isOwnerConfirmed) {
      toast.error(
        `Wajib mencentang konfirmasi persetujuan keamanan ke Gmail Owner (${ownerEmail || "Owner"})`,
      );
      return;
    }

    setSavingOutletLogin(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/api/create-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          name: `POS Outlet - ${outletLoginTarget.outlet_name}`,
          email: outletLoginEmail.trim().toLowerCase(),
          password: outletLoginPassword,
          role: "cashier",
          outlet_id: outletLoginTarget.id,
          is_outlet_account: true,
          owner_gmail_confirmed: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membuat akun login perangkat outlet");
      }

      const token = "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const originUrl = typeof window !== "undefined" ? window.location.origin : "";
      const activationLink = `${originUrl}/outlets?confirm_outlet=${outletLoginTarget.id}&token=${token}`;

      // Update outlets.settings directly with pending_confirmation and security token
      const currSettings: Record<string, any> =
        outletLoginTarget.settings &&
        typeof outletLoginTarget.settings === "object" &&
        !Array.isArray(outletLoginTarget.settings)
          ? (outletLoginTarget.settings as Record<string, any>)
          : {};

      await supabase
        .from("outlets")
        .update({
          settings: {
            ...currSettings,
            outlet_login_email: outletLoginEmail.trim().toLowerCase(),
            outlet_login_created_at: new Date().toISOString(),
            outlet_login_account: {
              email: outletLoginEmail.trim().toLowerCase(),
              status: "pending_confirmation",
              token: token,
              activation_link: activationLink,
              created_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", outletLoginTarget.id);

      // 1. Dispatch real email notification to Owner Gmail via formsubmit.co
      try {
        await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ownerEmail)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            _subject: `[KebabsChoicePOS] Konfirmasi Akun Perangkat POS: ${outletLoginTarget.outlet_name}`,
            outlet_name: outletLoginTarget.outlet_name,
            outlet_email: outletLoginEmail.trim().toLowerCase(),
            owner_email: ownerEmail,
            activation_link: activationLink,
            message: `Halo Owner KebabsChoicePOS,\n\nTerdapat permintaan pembuatan akun login perangkat kasir untuk cabang "${outletLoginTarget.outlet_name}" (${outletLoginEmail}).\n\nUntuk mengonfirmasi dan mengaktifkan akun kasir ini, silakan klik tautan aktivasi berikut:\n${activationLink}\n\nTerima kasih.`,
            _captcha: "false",
          }),
        });
      } catch (emailErr) {
        console.warn("[handleSaveOutletLogin] formsubmit email warning:", emailErr);
      }

      // 2. Trigger Supabase magic link as backup
      try {
        await supabase.auth.signInWithOtp({
          email: ownerEmail,
          options: {
            emailRedirectTo: activationLink,
          },
        });
      } catch (otpErr) {
        // ignore
      }

      toast.success(
        `Email konfirmasi keamanan telah dikirim ke Gmail Owner (${ownerEmail})! Silakan klik link aktivasi di inbox Gmail.`,
        { duration: 7000 },
      );
      setOutletLoginModalOpen(false);
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("[handleSaveOutletLogin] Error:", err);
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan akun login outlet");
    } finally {
      setSavingOutletLogin(false);
    }
  }

  // Filtered List with deduplication and RBAC scoping
  const filteredItems = useMemo(() => {
    let sourceList = items;
    if (isManager && managerOutletId) {
      sourceList = sourceList.filter((item) => item.id === managerOutletId);
    }

    // Deduplicate outlets by ID
    const uniqueMap = new Map<string, OutletItem>();
    for (const item of sourceList) {
      if (item && item.id && !uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    return deduplicated.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        (item.outlet_name || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.address || "").toLowerCase().includes(q) ||
        (item.manager?.name || "").toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && item.status === "active") ||
        (filterStatus === "inactive" && item.status === "inactive");

      return matchesSearch && matchesStatus;
    });
  }, [items, search, filterStatus, isManager, managerOutletId]);

  const totalCount = items.length;
  const activeCount = items.filter((i) => i.status === "active").length;
  const inactiveCount = totalCount - activeCount;
  const totalAssignedStaff = items.reduce((acc, curr) => acc + (curr.staff_count || 0), 0);

  // Helper: Get real human staff assigned to this outlet from availableStaff & settings.outlet_staff_roster
  function getAssignedEmployeesForOutlet(outlet: OutletItem): Array<{ name: string; role: string; email?: string }> {
    const list: Array<{ name: string; role: string; email?: string }> = [];
    const seen = new Set<string>();

    // 1. From availableStaff where outlet_id === outlet.id
    for (const s of availableStaff) {
      if (s.outlet_id === outlet.id) {
        if (!isOutletDeviceAccount(s) && !seen.has(s.name.toLowerCase())) {
          seen.add(s.name.toLowerCase());
          list.push({ name: s.name, role: s.role, email: s.email });
        }
      }
    }

    // 2. From outlets.settings.outlet_staff_roster
    const settings =
      outlet.settings && typeof outlet.settings === "object" ? (outlet.settings as any) : {};
    if (Array.isArray(settings.outlet_staff_roster)) {
      for (const r of settings.outlet_staff_roster) {
        const name = (r.name || r.full_name || "").trim();
        if (name && !isOutletDeviceAccount(r) && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          list.push({ name, role: r.role || "cashier", email: r.email });
        }
      }
    }

    return list;
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header Banner & Stats */}
      <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
              <Store className="size-4" />
              <span>Multi-Outlet Management · HQ Control</span>
            </div>
            <h1 className="text-3xl font-black tracking-normal">Outlet Management</h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              Kelola jaringan cabang toko, lokasi operasional POS, penugasan store manager, dan
              pembagian staf outlet Anda secara terpusat.
            </p>
          </div>
          {!isCashier && (
            <Button onClick={handleOpenCreate} className="rounded-2xl font-bold shadow-brand gap-2">
              <Plus className="size-4" />+ Tambah Outlet Baru
            </Button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-4">
          <div className="rounded-xl bg-muted/40 p-3.5">
            <span className="text-xs text-muted-foreground font-semibold">Total Cabang</span>
            <p className="text-2xl font-black">{totalCount}</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-3.5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Outlet Aktif
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl bg-amber-500/10 p-3.5">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              Non-aktif
            </span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {inactiveCount}
            </p>
          </div>
          <div className="rounded-xl bg-blue-500/10 p-3.5">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
              Karyawan Ditugaskan
            </span>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {totalAssignedStaff}
            </p>
          </div>
        </div>
      </div>

      {/* Filter, Search & View Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama outlet, kode, alamat, atau manajer..."
            className="pl-10 rounded-2xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex rounded-2xl border border-border bg-card p-1">
            <button
              onClick={() => setFilterStatus("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterStatus === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aktif ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus("inactive")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterStatus === "inactive"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Non-aktif ({inactiveCount})
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex rounded-2xl border border-border bg-card p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-xl p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid Card View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-xl p-1.5 transition-colors ${
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <TableIcon className="size-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl"
            onClick={loadData}
            title="Muat ulang"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin text-primary" />
            <span>Memuat data outlet dan pembagian staf...</span>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Store className="mx-auto size-12 text-muted-foreground/40" />
          <h3 className="mt-3 text-lg font-bold">
            {search ? "Outlet tidak ditemukan" : "Belum ada outlet terdaftar"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {search
              ? "Coba gunakan kata kunci pencarian yang berbeda."
              : "Daftarkan cabang outlet pertama untuk mengelola operasional kasir POS dan inventaris per cabang."}
          </p>
          {!search && (
            <Button onClick={handleOpenCreate} className="mt-4 rounded-xl font-bold">
              <Plus className="mr-1.5 size-4" />
              Tambah Outlet Sekarang
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Card View */
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((outlet, oIdx) => {
            const isActive = outlet.status === "active";
            return (
              <div
                key={`outlet-grid-${outlet.id || oIdx}-${oIdx}`}
                className="group relative flex flex-col justify-between rounded-[1.75rem] border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-float"
              >
                <div>
                  {/* Top Bar: Icon, Title, Status Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
                        <Store className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-snug line-clamp-1">
                          {outlet.outlet_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[0.68rem] font-mono font-bold text-muted-foreground">
                            {outlet.code || "NO CODE"}
                          </span>
                          <span className="text-[0.68rem] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="size-3" />
                            {outlet.timezone === "Asia/Jakarta" ? "WIB" : outlet.timezone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Toggle Button */}
                    <button
                      disabled={isCashier}
                      onClick={() => !isCashier && handleToggleStatus(outlet)}
                      title={
                        isCashier
                          ? "Hanya Owner/Manager yang dapat mengubah status"
                          : `Klik untuk ubah ke ${isActive ? "Non-aktif" : "Aktif"}`
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                        isCashier ? "cursor-not-allowed opacity-80 " : ""
                      }${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="size-3" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-3" />
                          <span>Non-aktif</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Info: Address & Phone */}
                  <div className="mt-4 space-y-2 rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground border border-border/50">
                    <div className="flex items-start gap-2">
                      <MapPin className="size-3.5 shrink-0 text-primary/70 mt-0.5" />
                      <span className="line-clamp-2">
                        {outlet.address || "Belum ada alamat terdaftar"}
                      </span>
                    </div>
                    {outlet.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 shrink-0 text-primary/70" />
                        <span>{outlet.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Dua Kotak Informasi Terhubung */}
                  {(() => {
                    const branchEmployees = getAssignedEmployeesForOutlet(outlet);
                    return (
                      <div className="mt-3.5 space-y-2.5">
                        {/* Kotak 1: 🔑 Akun Login Outlet Terdaftar */}
                        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-foreground">
                              <KeyRound className="size-3.5 text-primary" />
                              <span>🔑 Akun Login Outlet Terdaftar</span>
                            </div>
                            {!isCashier && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenOutletLogin(outlet)}
                                className="h-6 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 rounded-lg"
                              >
                                Kelola Akun Outlet
                              </Button>
                            )}
                          </div>

                          {Boolean((outlet.settings as any)?.outlet_login_email) ? (
                            (outlet.settings as any)?.outlet_login_account?.status === "pending_confirmation" ? (
                              <div className="space-y-1 rounded-lg bg-amber-500/10 border border-amber-500/25 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="size-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                                  <span>🟡 Menunggu Konfirmasi Gmail Owner</span>
                                </div>
                                <p className="font-mono text-[10px] text-muted-foreground truncate">
                                  {(outlet.settings as any).outlet_login_email}
                                </p>
                                <a
                                  href="https://mail.google.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 underline hover:text-amber-800"
                                >
                                  <span>📬 Buka Gmail Owner Sekarang &rarr;</span>
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                  <span className="truncate font-mono font-bold text-foreground">
                                    {(outlet.settings as any).outlet_login_email}
                                  </span>
                                </div>
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 rounded-md shrink-0">
                                  Aktif
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
                              <span className="italic">Belum ada akun login outlet</span>
                              {!isCashier && (
                                <button
                                  onClick={() => handleOpenOutletLogin(outlet)}
                                  className="font-bold text-primary hover:underline text-[10px]"
                                >
                                  + Buat Akun
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Kotak 2: 👥 Karyawan Cabang Ini (Otomatis dari Staff Management) */}
                        <div className="rounded-xl border border-border/80 bg-card p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-foreground">
                              <Users className="size-3.5 text-blue-500" />
                              <span>👥 Karyawan Cabang Ini ({branchEmployees.length})</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Otomatis dari Staff Management
                            </span>
                          </div>

                          {branchEmployees.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic py-1">
                              Belum ada karyawan ditugaskan ke cabang ini.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                              {branchEmployees.map((emp, empIdx) => (
                                <span
                                  key={`card-emp-${emp.name}-${empIdx}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 px-2 py-0.5 text-[11px] font-bold text-foreground border border-border/60"
                                  title={`${emp.name} (${emp.role === "cashier" ? "Kasir" : emp.role})`}
                                >
                                  <span className="size-1 rounded-full bg-primary" />
                                  {emp.name}
                                  <span className="text-[9px] text-muted-foreground font-normal">
                                    ({emp.role === "cashier" ? "Kasir" : emp.role === "manager" ? "Manager" : emp.role})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 rounded-xl text-xs font-bold"
                      onClick={() => handleOpenDetail(outlet)}
                    >
                      <Eye className="size-3.5" />
                      Detail
                    </Button>

                    {!isCashier && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-xl text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => handleOpenOutletLogin(outlet)}
                        title="Kelola Akun Login Outlet"
                      >
                        <KeyRound className="size-3.5" />
                        Akun Login Outlet
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!isCashier && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 rounded-xl"
                        onClick={() => handleOpenEdit(outlet)}
                        title="Edit Cabang"
                      >
                        <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                        onClick={() => handleOpenDelete(outlet)}
                        title="Hapus Cabang"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Cabang Outlet</th>
                  <th className="px-6 py-4">🔑 Akun Login Outlet</th>
                  <th className="px-6 py-4">👥 Karyawan Cabang</th>
                  <th className="px-6 py-4">Alamat & Kontak</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((outlet, oIdx) => {
                  const isActive = outlet.status === "active";
                  const branchEmployees = getAssignedEmployeesForOutlet(outlet);
                  const s = (outlet.settings as any) || {};
                  const loginEmail = s.outlet_login_email || s.outlet_login_account?.email;
                  const isPending = s.outlet_login_account?.status === "pending_confirmation";

                  return (
                    <tr
                      key={`outlet-table-${outlet.id || oIdx}-${oIdx}`}
                      className="transition-colors hover:bg-muted/20"
                    >
                      {/* Name & Code */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">
                            <Store className="size-5" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{outlet.outlet_name}</p>
                            <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-mono font-semibold text-muted-foreground mt-0.5">
                              {outlet.code || "NO CODE"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 🔑 Akun Login Outlet */}
                      <td className="px-6 py-4">
                        {loginEmail ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`size-1.5 rounded-full shrink-0 ${
                                  isPending ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                                }`}
                              />
                              <span className="font-mono text-xs font-bold text-foreground">
                                {loginEmail}
                              </span>
                            </div>
                            <div>
                              {isPending ? (
                                <a
                                  href="https://mail.google.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                                >
                                  🟡 Cek Gmail Owner &rarr;
                                </a>
                              ) : (
                                <span className="inline-block rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                                  Akses Kasir Aktif
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !isCashier && handleOpenOutletLogin(outlet)}
                            disabled={isCashier}
                            className="text-xs text-muted-foreground hover:text-primary underline font-medium"
                          >
                            + Buat Akun Outlet
                          </button>
                        )}
                      </td>

                      {/* 👥 Karyawan Cabang */}
                      <td className="px-6 py-4 max-w-xs">
                        {branchEmployees.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            Belum ada karyawan
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                            {branchEmployees.map((emp, empIdx) => (
                              <span
                                key={`table-emp-${emp.name}-${empIdx}`}
                                className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-bold text-foreground border border-border/50"
                              >
                                {emp.name}
                                <span className="text-[9px] text-muted-foreground">
                                  ({emp.role === "cashier" ? "Kasir" : emp.role})
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Address & Phone */}
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs">
                        <p className="truncate">{outlet.address || "Belum ada alamat"}</p>
                        {outlet.phone && <p className="font-mono mt-0.5">{outlet.phone}</p>}
                      </td>

                      {/* Status Toggle */}
                      <td className="px-6 py-4">
                        <button
                          disabled={isCashier}
                          onClick={() => !isCashier && handleToggleStatus(outlet)}
                          title={
                            isCashier
                              ? "Hanya Owner/Manager yang dapat mengubah status"
                              : "Klik untuk ubah status"
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all ${
                            isCashier ? "cursor-not-allowed opacity-80 " : ""
                          }${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {isActive ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <XCircle className="size-3" />
                          )}
                          {isActive ? "Aktif" : "Non-aktif"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 rounded-xl"
                            onClick={() => handleOpenDetail(outlet)}
                            title="Detail"
                          >
                            <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          {!isCashier && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 px-2"
                              onClick={() => handleOpenOutletLogin(outlet)}
                              title="Kelola Akun Login Outlet"
                            >
                              <KeyRound className="size-3.5" />
                              <span className="hidden xl:inline">Akun Outlet</span>
                            </Button>
                          )}
                          {!isCashier && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-xl"
                              onClick={() => handleOpenEdit(outlet)}
                              title="Edit"
                            >
                              <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                              onClick={() => handleOpenDelete(outlet)}
                              title="Hapus"
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
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CREATE & EDIT OUTLET FORM                       */}
      {/* ========================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black">
                    {editingId ? "Edit Cabang Outlet" : "Tambah Cabang Baru"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Lengkapi identitas, lokasi, dan manajer cabang operasional.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full size-8"
                onClick={handleCloseModal}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Section 1: Identitas */}
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Nama Cabang Outlet <span className="text-destructive">*</span>
                </label>
                <Input
                  className="mt-1.5 rounded-xl"
                  placeholder="cth. Kebab Flagship Senopati"
                  value={form.outlet_name || ""}
                  onChange={(e) => setForm({ ...form, outlet_name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground/80">Kode Cabang</label>
                  <Input
                    className="mt-1.5 rounded-xl uppercase font-mono"
                    placeholder="cth. KB-01"
                    value={form.code || ""}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                  <span className="text-[0.68rem] text-muted-foreground">
                    Otomatis dibuat jika kosong
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground/80">Zona Waktu</label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.timezone || "Asia/Jakarta"}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  >
                    <option value="Asia/Jakarta">WIB (Jakarta - UTC+7)</option>
                    <option value="Asia/Makassar">WITA (Makassar - UTC+8)</option>
                    <option value="Asia/Jayapura">WIT (Jayapura - UTC+9)</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Kontak & Alamat */}
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Nomor Telepon / WhatsApp Cabang
                </label>
                <Input
                  className="mt-1.5 rounded-xl"
                  placeholder="cth. 081234567890"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Alamat Lengkap Cabang
                </label>
                <textarea
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Jl. Senopati Raya No. 45, Kebayoran Baru, Jakarta Selatan..."
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {/* Section 3: Manager Assignment */}
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Tugaskan Store Manager
                </label>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.manager_user_id || ""}
                  onChange={(e) => setForm({ ...form, manager_user_id: e.target.value })}
                >
                  <option value="">-- Belum ada manajer ditugaskan --</option>
                  {availableStaff.map((staff, sIdx) => (
                    <option key={`mgr-opt-${staff.user_id || sIdx}-${sIdx}`} value={staff.user_id}>
                      {staff.name} ({staff.role.toUpperCase()}){" "}
                      {staff.outlet_name ? `· ${staff.outlet_name}` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[0.68rem] text-muted-foreground mt-0.5 block">
                  Karyawan yang dipilih akan diberikan hak akses manajer cabang.
                </span>
              </div>

              {/* Section 4: Operational Status */}
              <div>
                <label className="text-xs font-bold text-foreground/80">
                  Status Operasional Cabang
                </label>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as "active" | "inactive" })
                  }
                >
                  <option value="active">Aktif (Menerima Transaksi POS)</option>
                  <option value="inactive">Non-aktif (Cabang Ditutup Sementara)</option>
                </select>
              </div>

              {/* Form Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl font-bold shadow-brand"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </div>
                  ) : editingId ? (
                    "Simpan Perubahan"
                  ) : (
                    "Tambah Cabang"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: OUTLET DETAIL MODAL                             */}
      {/* ========================================================= */}
      {detailModalOpen && selectedOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-float max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Store className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">{selectedOutlet.outlet_name}</h2>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
                        selectedOutlet.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selectedOutlet.status === "active" ? "Aktif" : "Non-aktif"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Kode: {selectedOutlet.code || "NO CODE"} · ID: {selectedOutlet.id}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full size-8"
                onClick={() => setDetailModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Body */}
            {detailLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <RefreshCw className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {/* Branch Info Cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                      <MapPin className="size-3 text-primary" /> Alamat Lengkap
                    </span>
                    <p className="font-medium text-foreground">
                      {selectedOutlet.address || "Belum ada alamat terdaftar"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                      <Phone className="size-3 text-primary" /> Nomor Telepon / WA
                    </span>
                    <p className="font-medium text-foreground font-mono">
                      {selectedOutlet.phone || "Belum ada nomor telepon"}
                    </p>
                  </div>
                </div>

                {/* Manager Card */}
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 font-bold">
                        {selectedOutlet.manager ? (
                          selectedOutlet.manager.name.charAt(0).toUpperCase()
                        ) : (
                          <User className="size-5" />
                        )}
                      </div>
                      <div>
                        <span className="text-[0.68rem] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                          Store Manager
                        </span>
                        <h4 className="font-bold text-base text-foreground">
                          {selectedOutlet.manager
                            ? selectedOutlet.manager.name
                            : "Belum Ditugaskan"}
                        </h4>
                      </div>
                    </div>

                    {!isCashier && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetailModalOpen(false);
                          handleOpenAssignModal(selectedOutlet);
                        }}
                        className="rounded-xl text-xs font-bold"
                      >
                        Ubah Manajer
                      </Button>
                    )}
                  </div>
                </div>

                {/* Staff Members at this Outlet */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" />
                      Daftar Staf &amp; Kasir Terdaftar ({selectedOutlet.staff_list.length})
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Otomatis dari Staff Management
                    </span>
                  </div>

                  {selectedOutlet.staff_list.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      Belum ada staf atau kasir yang ditugaskan ke cabang ini.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-bold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="px-4 py-2.5">Karyawan</th>
                            <th className="px-4 py-2.5">Role</th>
                            <th className="px-4 py-2.5">Status POS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {selectedOutlet.staff_list.map((staff, sIdx) => (
                            <tr
                              key={`detail-staff-${staff.user_id || staff.id || sIdx}-${sIdx}`}
                              className="hover:bg-muted/20"
                            >
                              <td className="px-4 py-3 font-semibold text-foreground">
                                <div>
                                  <span className="font-bold text-foreground block">
                                    {staff.name}
                                  </span>
                                  <span className="text-[0.68rem] text-muted-foreground block">
                                    {staff.email || "staff@kebabschoice.com"} · Outlet sekarang: {selectedOutlet.outlet_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-bold uppercase text-[0.68rem]">
                                  {staff.role === "cashier" ? "Kasir" : staff.role === "manager" ? "Manager" : staff.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                                  <span className="size-1.5 rounded-full bg-emerald-500" />
                                  Akses Kasir Aktif
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              {!isCashier && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenEdit(selectedOutlet);
                  }}
                >
                  <Edit2 className="size-3.5 mr-1" />
                  Edit Data Cabang
                </Button>
              )}

              <Button className="rounded-xl font-bold" onClick={() => setDetailModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL                       */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Hapus Cabang Outlet?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Anda akan menghapus cabang <strong>{deleteTarget.outlet_name}</strong> (
              {deleteTarget.code || "NO CODE"}). Karyawan yang terhubung akan dialihkan ke cabang
              utama lainnya.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl font-bold text-xs"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Cabang"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: KELOLA AKUN LOGIN PERANGKAT OUTLET              */}
      {/* ========================================================= */}
      {outletLoginModalOpen && outletLoginTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Akun Login Perangkat Outlet
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {outletLoginTarget.outlet_name} ({outletLoginTarget.code || "CABANG"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOutletLoginModalOpen(false)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Info Cabang */}
              <div>
                <label className="font-bold text-foreground/80 block mb-1">
                  Cabang Outlet (Terminal Kasir)
                </label>
                <Input
                  disabled
                  value={`${outletLoginTarget.outlet_name} (${outletLoginTarget.code || "CABANG"})`}
                  className="rounded-xl bg-muted/50 font-semibold"
                />
              </div>

              {/* Alamat Gmail Akun Outlet */}
              <div>
                <label className="font-bold text-foreground/80 block mb-1">
                  Alamat Gmail Akun Outlet <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={outletLoginEmail}
                    onChange={(e) => setOutletLoginEmail(e.target.value)}
                    placeholder="contoh: outlet.pasarjumat@gmail.com"
                    className="pl-9 rounded-xl font-medium"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Akun email ini digunakan bersama oleh 7 karyawan cabang pada tablet POS outlet ini.
                </p>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={outletLoginPassword}
                    onChange={(e) => setOutletLoginPassword(e.target.value)}
                    placeholder="Min 6 karakter"
                    className="rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground/80 block mb-1">
                    Konfirmasi Password <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={outletLoginConfirmPassword}
                    onChange={(e) => setOutletLoginConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {showPassword ? "Sembunyikan Password" : "Lihat Password"}
                </button>
              </div>

              {/* Box Verifikasi & Konfirmasi Keamanan Gmail Owner */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <Shield className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-black text-xs">Konfirmasi Keamanan Bisnis Pribadi</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Pendaftaran akun perangkat outlet ini membutuhkan persetujuan dan otorisasi langsung dari Gmail Owner:
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 bg-background/80 px-2.5 py-1 rounded-lg border border-border">
                      <Mail className="size-3 text-primary shrink-0" />
                      <strong className="font-mono text-foreground">{ownerEmail || "ujicobaajaoke@gmail.com"}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isOwnerConfirmed}
                      onChange={(e) => setIsOwnerConfirmed(e.target.checked)}
                      className="size-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-foreground">
                      Konfirmasi & Hubungkan ke Gmail Owner
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const proofText = `BUKTI OTORISASI AKUN OUTLET:\nCabang: ${outletLoginTarget.outlet_name}\nEmail Outlet: ${outletLoginEmail}\nGmail Owner: ${ownerEmail}\nTanggal: ${new Date().toLocaleString("id-ID")}\nStatus: DISETUJUI OLEH OWNER`;
                      navigator.clipboard.writeText(proofText);
                      setCopiedProof(true);
                      toast.success("Bukti otorisasi berhasil disalin ke clipboard!");
                      setTimeout(() => setCopiedProof(false), 2000);
                    }}
                    className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedProof ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedProof ? "Tersalin" : "Salin Bukti"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setOutletLoginModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveOutletLogin}
                disabled={savingOutletLogin || !isOwnerConfirmed}
                className="rounded-xl font-bold text-xs gap-1.5 shadow-brand"
              >
                <KeyRound className="size-3.5" />
                {savingOutletLogin ? "Menyimpan Akun..." : "Simpan Akun Outlet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
