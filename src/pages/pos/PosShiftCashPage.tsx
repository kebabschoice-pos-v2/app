import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Receipt,
  User,
  Store,
  Calendar,
  Users,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cacheOutletCatalog } from "@/services/offline-sync.service";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";
import { getTodayOutletRoster, getStaffShifts, type StaffShift } from "@/services/hr.service";
import { getStaffList, type StaffItem } from "@/services/staff.service";
import { cn } from "@/lib/utils";

interface CashMovement {
  id: string;
  shiftId: string;
  type: "in" | "out";
  amount: number;
  notes: string;
  timestamp: string;
}

interface PosShift {
  id: string;
  cashierName: string;
  cashierId?: string;
  teamMembers?: string;
  outletName: string;
  outletId?: string;
  startingCash: number;
  startTime: string;
  endTime?: string;
  status: "open" | "closed";
  cashSales: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedEndingCash: number;
  actualEndingCash?: number;
  cashDifference?: number;
  notes?: string;
}

const STORAGE_ACTIVE_SHIFT = "kebabschoicepos_active_shift";
const STORAGE_MOVEMENTS = "kebabschoicepos_cash_movements";
const STORAGE_HISTORY = "kebabschoicepos_shift_history";

function getShiftStorageKey(outletId?: string | null) {
  return outletId && outletId !== "all"
    ? `kebabschoicepos_active_shift_${outletId}`
    : STORAGE_ACTIVE_SHIFT;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PosShiftCashPage() {
  const { t } = useTranslation();
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [shiftHistory, setShiftHistory] = useState<PosShift[]>([]);

  // DB Identifiers
  const [userId, setUserId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);

  // Opening shift modal/form states
  const [cashierName, setCashierName] = useState("Kasir");
  const [outletName, setOutletName] = useState("Outlet");
  const [startingCashInput, setStartingCashInput] = useState("200000");
  const [teamMembersInput, setTeamMembersInput] = useState("");
  const [todayRoster, setTodayRoster] = useState<{
    morningStaff: string[];
    nightStaff: string[];
    offOrLeaveStaff: { name: string; status: "OFF" | "SAKIT" | "IZIN"; note?: string }[];
  } | null>(null);
  const [branchStaffList, setBranchStaffList] = useState<StaffItem[]>([]);
  const [masterShifts, setMasterShifts] = useState<StaffShift[]>([]);

  useEffect(() => {
    getStaffShifts().then(setMasterShifts).catch(() => {});
    const handleShiftsUpdate = () => {
      getStaffShifts().then(setMasterShifts).catch(() => {});
    };
    window.addEventListener("hr:shifts-updated", handleShiftsUpdate);
    return () => window.removeEventListener("hr:shifts-updated", handleShiftsUpdate);
  }, []);

  // Cash movement form states
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNotes, setMovementNotes] = useState("");

  // Closing shift form states (Blind Cash Count)
  const [actualCashInput, setActualCashInput] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isCountRevealed, setIsCountRevealed] = useState(false);

  // Load shifts and user details on mount
  useEffect(() => {
    // 1. Initial quick load from local storage
    try {
      const savedActive = localStorage.getItem(STORAGE_ACTIVE_SHIFT);
      if (savedActive) {
        setActiveShift(JSON.parse(savedActive));
      }
      const savedMovements = localStorage.getItem(STORAGE_MOVEMENTS);
      if (savedMovements) {
        setMovements(JSON.parse(savedMovements));
      }
      const savedHistory = localStorage.getItem(STORAGE_HISTORY);
      if (savedHistory) {
        setShiftHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to parse shift storage:", e);
    }

    // 2. Fetch authenticated user, business, and strict active outlet resolution
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        const emailName = data.user.email?.split("@")[0] || "Kasir";

        // Fetch Profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        const resolvedCashier =
          prof?.display_name || emailName.charAt(0).toUpperCase() + emailName.slice(1);
        setCashierName(resolvedCashier);

        // Fetch User's Business ID
        const { data: ownedBus } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", data.user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let resolvedBid = ownedBus?.id;
        if (!resolvedBid) {
          const { data: memBus } = await supabase
            .from("business_members")
            .select("business_id")
            .eq("user_id", data.user.id)
            .limit(1)
            .maybeSingle();
          resolvedBid = memBus?.business_id;
        }
        if (resolvedBid) setBusinessId(resolvedBid);

        // Resolve Active Outlet using strict 5-tier isolation
        const resolvedStaffOutlet = await resolveActiveStaffOutlet(data.user.id);
        const resolvedOid = resolvedStaffOutlet.outletId || "default";
        const resolvedOname = resolvedStaffOutlet.outletName || "Outlet Utama";

        setOutletId(resolvedOid);
        setOutletName(resolvedOname);

        // Load today's staff roster from HR service
        getTodayOutletRoster(resolvedOid).then((roster) => {
          setTodayRoster(roster);
          setTeamMembersInput((prev) => {
            if (prev.trim()) return prev;
            const currentHour = new Date().getHours();
            if (currentHour < 15 && roster.morningStaff.length > 0) {
              return roster.morningStaff.join(", ");
            } else if (currentHour >= 15 && roster.nightStaff.length > 0) {
              return roster.nightStaff.join(", ");
            }
            return prev;
          });
        });

        // Load branch staff for quick cashier picker
        getStaffList()
          .then((list) => {
            const filtered = list.filter(
              (s) => !s.outlet_id || s.outlet_id === resolvedOid || s.outlet_id === "all",
            );
            setBranchStaffList(filtered);

            const savedCashier = localStorage.getItem("kebabschoicepos_active_cashier_name");
            if (savedCashier) {
              setCashierName(savedCashier);
            } else if (filtered.length > 0) {
              const currentHour = new Date().getHours();
              getTodayOutletRoster(resolvedOid)
                .then((roster) => {
                  const scheduled =
                    currentHour < 15
                      ? roster?.morningStaff || []
                      : roster?.nightStaff || [];
                  const match = filtered.find((st) => scheduled.includes(st.name));
                  if (match) {
                    setCashierName(match.name);
                  } else {
                    setCashierName(filtered[0]?.name || "");
                  }
                })
                .catch(() => {
                  setCashierName(filtered[0]?.name || "");
                });
            }
          })
          .catch(() => {});

        // Re-read local storage specifically for this outlet
        const outletSpecificShift = localStorage.getItem(getShiftStorageKey(resolvedOid));
        if (outletSpecificShift) {
          try {
            setActiveShift(JSON.parse(outletSpecificShift));
          } catch {}
        }

        // 3. Sync active shift from Supabase pos_shifts table strictly filtered by outlet_id
        try {
          let openShiftQuery = supabase
            .from("pos_shifts" as any)
            .select("*")
            .eq("status", "open");

          if (resolvedOid && resolvedOid !== "default" && resolvedOid !== "all") {
            openShiftQuery = openShiftQuery.eq("outlet_id", resolvedOid);
          }

          let openShiftRows: any[] | null = null;
          try {
            const { data: ordRows, error: ordErr } = await openShiftQuery
              .order("start_time", { ascending: false })
              .limit(1);
            if (ordErr) throw ordErr;
            openShiftRows = ordRows;
          } catch {
            const { data: fallbackRows } = await openShiftQuery
              .order("created_at", { ascending: false })
              .limit(1);
            openShiftRows = fallbackRows;
          }

          if (openShiftRows && openShiftRows.length > 0) {
            const row: any = openShiftRows[0];
            const liveShift: PosShift = {
              id: row.id,
              cashierName: row.cashier_name || resolvedCashier,
              cashierId: row.cashier_id,
              teamMembers: row.team_members || (row.notes?.startsWith("Kru:") ? row.notes : undefined),
              outletName: row.outlet_name || resolvedOname,
              outletId: row.outlet_id || resolvedOid,
              startingCash: Number(row.opening_cash ?? row.starting_cash) || 0,
              startTime: row.start_time || row.opened_at,
              status: "open",
              cashSales: Number(row.cash_sales) || 0,
              totalCashIn: Number(row.total_cash_in) || 0,
              totalCashOut: Number(row.total_cash_out) || 0,
              expectedEndingCash: Number(row.expected_ending_cash) || Number(row.opening_cash ?? row.starting_cash) || 0,
              notes: row.notes,
            };
            setActiveShift(liveShift);
            localStorage.setItem(getShiftStorageKey(resolvedOid), JSON.stringify(liveShift));
            localStorage.setItem(STORAGE_ACTIVE_SHIFT, JSON.stringify(liveShift));

            // Load cash movements for this shift
            const { data: movRows } = await supabase
              .from("cash_movements" as any)
              .select("*")
              .eq("shift_id", row.id)
              .order("created_at", { ascending: false });

            if (movRows && movRows.length > 0) {
              const mappedMovs: CashMovement[] = movRows.map((m: any) => ({
                id: m.id,
                shiftId: m.shift_id,
                type: m.type as "in" | "out",
                amount: Number(m.amount) || 0,
                notes: m.description || m.reason || "",
                timestamp: m.created_at,
              }));
              setMovements(mappedMovs);
              localStorage.setItem(STORAGE_MOVEMENTS, JSON.stringify(mappedMovs));
            }
          }

          // Load recent closed shifts history from DB strictly filtered by outlet_id
          let historyQuery = supabase
            .from("pos_shifts" as any)
            .select("*")
            .eq("status", "closed");

          if (resolvedOid && resolvedOid !== "default" && resolvedOid !== "all") {
            historyQuery = historyQuery.eq("outlet_id", resolvedOid);
          }

          let historyRows: any[] | null = null;
          try {
            const { data: histData, error: histErr } = await historyQuery
              .order("end_time", { ascending: false })
              .limit(20);
            if (histErr) throw histErr;
            historyRows = histData;
          } catch {
            const { data: fallbackHist } = await historyQuery
              .order("created_at", { ascending: false })
              .limit(20);
            historyRows = fallbackHist;
          }

          if (historyRows && historyRows.length > 0) {
            const mappedHistory: PosShift[] = historyRows.map((h: any) => ({
              id: h.id,
              cashierName: h.cashier_name,
              cashierId: h.cashier_id,
              teamMembers: h.team_members,
              outletName: h.outlet_name,
              outletId: h.outlet_id,
              startingCash: Number(h.opening_cash ?? h.starting_cash) || 0,
              startTime: h.start_time || h.opened_at,
              endTime: h.end_time || h.closed_at,
              status: "closed",
              cashSales: Number(h.cash_sales) || 0,
              totalCashIn: Number(h.total_cash_in) || 0,
              totalCashOut: Number(h.total_cash_out) || 0,
              expectedEndingCash: Number(h.expected_ending_cash) || 0,
              actualEndingCash: Number(h.actual_ending_cash) || 0,
              cashDifference: Number(h.cash_difference) || 0,
              notes: h.notes,
            }));
            setShiftHistory(mappedHistory);
            localStorage.setItem(STORAGE_HISTORY, JSON.stringify(mappedHistory));
          }
        } catch (dbShiftErr) {
          console.warn("[PosShift] Could not load from DB, using local state:", dbShiftErr);
        }
      }
    });
  }, []);

  // Compute live cash metrics for active shift
  const currentShiftMovements = useMemo(() => {
    if (!activeShift) return [];
    return movements.filter((m) => m.shiftId === activeShift.id);
  }, [movements, activeShift]);

  const totalCashIn = useMemo(() => {
    return currentShiftMovements
      .filter((m) => m.type === "in")
      .reduce((sum, m) => sum + m.amount, 0);
  }, [currentShiftMovements]);

  const totalCashOut = useMemo(() => {
    return currentShiftMovements
      .filter((m) => m.type === "out")
      .reduce((sum, m) => sum + m.amount, 0);
  }, [currentShiftMovements]);

  // Expected Cash calculation:
  // Saldo Awal + Penjualan Cash + Cash In - Cash Out = Saldo Akhir
  const expectedEndingCash = useMemo(() => {
    if (!activeShift) return 0;
    const start = Number(activeShift.startingCash) || 0;
    const sales = Number(activeShift.cashSales) || 0;
    return start + sales + totalCashIn - totalCashOut;
  }, [activeShift, totalCashIn, totalCashOut]);

  // Handle Open Shift (DB Persistence + LocalStorage)
  const handleOpenShift = async () => {
    const startCash = Number(startingCashInput.replace(/\D/g, "")) || 0;
    if (startCash < 0) {
      toast.error("Modal awal tidak valid");
      return;
    }

    const localShiftId = `shift-${Date.now()}`;
    let createdShiftId = localShiftId;
    const teamMembers = teamMembersInput.trim() || undefined;

    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("pos_shifts" as any)
        .insert({
          business_id: businessId,
          outlet_id: outletId,
          cashier_id: userId,
          cashier_name: cashierName,
          team_members: teamMembers,
          outlet_name: outletName,
          opening_cash: startCash,
          start_time: new Date().toISOString(),
          status: "open",
          cash_sales: 0,
          total_cash_in: 0,
          total_cash_out: 0,
          expected_ending_cash: startCash,
          notes: teamMembers ? `Kru: ${teamMembers}` : null,
        })
        .select("id")
        .maybeSingle();

      if (!insertErr && (inserted as any)?.id) {
        createdShiftId = (inserted as any).id;
      }
    } catch (err) {
      console.warn("[pos_shifts] DB insert warning, falling back to local:", err);
    }

    const newShift: PosShift = {
      id: createdShiftId,
      cashierName,
      cashierId: userId || undefined,
      teamMembers,
      outletName,
      outletId: outletId || undefined,
      startingCash: startCash,
      startTime: new Date().toISOString(),
      status: "open",
      cashSales: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      expectedEndingCash: startCash,
      notes: teamMembers ? `Kru: ${teamMembers}` : undefined,
    };

    setActiveShift(newShift);
    localStorage.setItem(getShiftStorageKey(outletId), JSON.stringify(newShift));
    localStorage.setItem(STORAGE_ACTIVE_SHIFT, JSON.stringify(newShift));
    localStorage.setItem("kebabschoicepos_active_cashier_name", cashierName);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:cashier-changed", { detail: { cashierName } }));
    }

    // Cache catalog outlet (menu, kategori, varian) ke IndexedDB saat buka shift
    try {
      supabase
        .from("products")
        .select("*")
        .then(({ data: prods }) => {
          cacheOutletCatalog(outletId || "all", {
            businessId,
            products: prods || [],
          }).catch(() => {});
        });
    } catch {}

    toast.success(`Shift kasir dibuka untuk ${cashierName}`, {
      description: `Modal Kas Awal: ${formatRupiah(startCash)} (Tersimpan ke Database & Lokal)`,
    });
  };

  // Handle Add Cash Movement (Cash In / Cash Out)
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      toast.error("Tidak ada shift aktif. Buka shift terlebih dahulu.");
      return;
    }

    const amount = Number(movementAmount.replace(/\D/g, "")) || 0;
    if (amount <= 0) {
      toast.error("Nominal harus lebih dari Rp 0");
      return;
    }

    if (!movementNotes.trim()) {
      toast.error("Keterangan wajib diisi");
      return;
    }

    const newMovementId = `mov-${Date.now()}`;
    let movementDbId = newMovementId;

    try {
      const isDbShift = !activeShift.id.startsWith("shift-");
      const { data: inserted, error } = await supabase
        .from("cash_movements" as any)
        .insert({
          business_id: businessId,
          outlet_id: outletId,
          shift_id: isDbShift ? activeShift.id : null,
          type: movementType,
          amount,
          description: movementNotes.trim(),
        })
        .select("id")
        .maybeSingle();

      if (!error && (inserted as any)?.id) {
        movementDbId = (inserted as any).id;
      }
    } catch (err) {
      console.warn("[cash_movements] DB insert warning, local saved:", err);
    }

    const newMovement: CashMovement = {
      id: movementDbId,
      shiftId: activeShift.id,
      type: movementType,
      amount,
      notes: movementNotes.trim(),
      timestamp: new Date().toISOString(),
    };

    const updated = [newMovement, ...movements];
    setMovements(updated);
    localStorage.setItem(STORAGE_MOVEMENTS, JSON.stringify(updated));

    setMovementAmount("");
    setMovementNotes("");

    toast.success(
      movementType === "in" ? "Cash In berhasil dicatat" : "Cash Out berhasil dicatat",
      {
        description: `${formatRupiah(amount)} - ${newMovement.notes}`,
      },
    );
  };

  // Handle Close Shift (DB Update + LocalStorage)
  const handleCloseShift = async () => {
    if (!activeShift) return;

    const actual = Number(actualCashInput.replace(/\D/g, "")) || 0;
    const diff = actual - expectedEndingCash;
    const endTime = new Date().toISOString();

    try {
      if (!activeShift.id.startsWith("shift-")) {
        await supabase
          .from("pos_shifts" as any)
          .update({
            end_time: endTime,
            status: "closed",
            total_cash_in: totalCashIn,
            total_cash_out: totalCashOut,
            expected_ending_cash: expectedEndingCash,
            actual_ending_cash: actual,
            cash_difference: diff,
            notes: closingNotes,
            updated_at: endTime,
          })
          .eq("id", activeShift.id);
      }
    } catch (err) {
      console.warn("[pos_shifts] DB close update warning, local saved:", err);
    }

    const closedShift: PosShift = {
      ...activeShift,
      endTime,
      status: "closed",
      totalCashIn,
      totalCashOut,
      expectedEndingCash,
      actualEndingCash: actual,
      cashDifference: diff,
      notes: closingNotes,
    };

    const updatedHistory = [closedShift, ...shiftHistory];
    setShiftHistory(updatedHistory);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updatedHistory));

    // Clear active shift from both global and outlet-specific storage keys
    setActiveShift(null);
    localStorage.removeItem(STORAGE_ACTIVE_SHIFT);
    localStorage.removeItem("kebabschoicepos_active_cashier_name");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:cashier-changed", { detail: { cashierName: null } }));
    }
    if (activeShift.outletId) {
      localStorage.removeItem(getShiftStorageKey(activeShift.outletId));
    }
    setIsClosingModalOpen(false);
    setIsCountRevealed(false);
    setActualCashInput("");
    setClosingNotes("");

    toast.success("Shift kasir resmi ditutup", {
      description: `Saldo Akhir Kas: ${formatRupiah(actual)} (Selisih: ${formatRupiah(diff)})`,
    });
  };

  const morningShift = masterShifts.find((s) => s.shift_name.toLowerCase().includes("pagi"));
  const nightShift = masterShifts.find((s) => s.shift_name.toLowerCase().includes("malam"));
  const morningHours = morningShift
    ? `(${morningShift.start_time} - ${morningShift.end_time})`
    : "(07:00 - 16:00)";
  const nightHours = nightShift
    ? `(${nightShift.start_time} - ${nightShift.end_time})`
    : "(13:00 - 22:00)";

  return (
    <div className="space-y-6 w-full max-w-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Wallet className="size-7 text-primary" />
            Shift & Cash Management (Kasir POS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buka shift kasir, pencatatan kas masuk/keluar, dan rekonsiliasi saldo akhir otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShift ? (
            <Badge
              variant="outline"
              className="bg-success-soft text-success border-success/30 px-3 py-1 font-bold"
            >
              ● Shift Aktif: {activeShift.cashierName}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/30 px-3 py-1 font-bold"
            >
              ○ Kasir Belum Buka Shift
            </Badge>
          )}
        </div>
      </div>

      {/* Main Grid: Shift Status & Controls */}
      {!activeShift ? (
        /* OPEN SHIFT CARD */
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-card max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Buka Shift Kasir Baru</h2>
              <p className="text-xs text-muted-foreground">
                Isi saldo modal awal kas sebelum memulai transaksi POS.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-bold text-foreground">Nama Kasir Bertugas *</Label>
                <span className="text-[10px] text-muted-foreground">
                  Pilih cepat kru cabang atau ketik manual
                </span>
              </div>

              {/* Quick Select Staff Pills */}
              {branchStaffList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {branchStaffList.map((st) => {
                    const isMorning = todayRoster?.morningStaff.includes(st.name);
                    const isNight = todayRoster?.nightStaff.includes(st.name);
                    const isSelected =
                      cashierName.trim().toLowerCase() === st.name.trim().toLowerCase();

                    return (
                      <button
                        key={st.user_id || st.id}
                        type="button"
                        onClick={() => setCashierName(st.name)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-secondary/60 hover:bg-secondary text-foreground border-border/80",
                        )}
                      >
                        <User className="size-3" />
                        <span>{st.name}</span>
                        {isMorning && (
                          <span
                            className={cn(
                              "text-[9px] px-1 py-0.2 rounded font-black",
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            ☀️ Pagi
                          </span>
                        )}
                        {isNight && (
                          <span
                            className={cn(
                              "text-[9px] px-1 py-0.2 rounded font-black",
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-sky-500/20 text-sky-600 dark:text-sky-400",
                            )}
                          >
                            🌙 Malam
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cashier input with manual edit support */}
              <div className="relative">
                <User className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <Input
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  placeholder="Nama Kasir Bertugas"
                  className="pl-10 rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">Outlet Aktif</Label>
              <div className="relative mt-1">
                <Store className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <Input
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  placeholder="Outlet Cabang"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Kru Pendamping / Tim Shift (Opsional)</span>
                <span className="text-[10px] text-muted-foreground">Koki, Grill, Dapur</span>
              </Label>
              <div className="relative mt-1">
                <Users className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <Input
                  value={teamMembersInput}
                  onChange={(e) => setTeamMembersInput(e.target.value)}
                  placeholder="Contoh: Budi (Grill), Siti (Prep)"
                  className="pl-10 rounded-xl"
                />
              </div>

              {/* Jadwal Tim Cabang Hari Ini (Sinkron HR) Card */}
              <div className="mt-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      📅 Jadwal Tim Cabang Hari Ini (Sinkron HR)
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {new Date().toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Shift Pagi */}
                  <div className="rounded-xl border border-border/60 bg-card p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-rose-600 dark:text-rose-400">
                        ☀️ Shift Pagi {morningHours}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-5 px-2 text-[10px] font-bold rounded-md"
                        onClick={() => {
                          if (todayRoster?.morningStaff && todayRoster.morningStaff.length > 0) {
                            setTeamMembersInput(todayRoster.morningStaff.join(", "));
                            toast.success("Kru Shift Pagi dimasukkan ke tim shift");
                          }
                        }}
                      >
                        Isi Kru Pagi
                      </Button>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground truncate">
                      {todayRoster?.morningStaff && todayRoster.morningStaff.length > 0
                        ? todayRoster.morningStaff.join(", ")
                        : "Belum ada jadwal"}
                    </p>
                  </div>

                  {/* Shift Malam */}
                  <div className="rounded-xl border border-border/60 bg-card p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-sky-600 dark:text-sky-400">
                        🌙 Shift Malam {nightHours}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-5 px-2 text-[10px] font-bold rounded-md"
                        onClick={() => {
                          if (todayRoster?.nightStaff && todayRoster.nightStaff.length > 0) {
                            setTeamMembersInput(todayRoster.nightStaff.join(", "));
                            toast.success("Kru Shift Malam dimasukkan ke tim shift");
                          }
                        }}
                      >
                        Isi Kru Malam
                      </Button>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground truncate">
                      {todayRoster?.nightStaff && todayRoster.nightStaff.length > 0
                        ? todayRoster.nightStaff.join(", ")
                        : "Belum ada jadwal"}
                    </p>
                  </div>
                </div>

                {todayRoster?.offOrLeaveStaff && todayRoster.offOrLeaveStaff.length > 0 && (
                  <div className="pt-1 border-t border-border/40 text-[10.5px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">Libur / Cuti / OFF:</span>
                    {todayRoster.offOrLeaveStaff.map((st, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold"
                      >
                        {st.name} ({st.status})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">
                Saldo Awal (Modal Kas Kasir)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="number"
                  value={startingCashInput}
                  onChange={(e) => setStartingCashInput(e.target.value)}
                  placeholder="200000"
                  className="pl-10 rounded-xl font-bold text-base"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Modal uang kecil pecahan untuk kembalian pelanggan.
              </p>
            </div>

            <Button
              onClick={handleOpenShift}
              className="w-full rounded-2xl font-black py-6 text-base shadow-brand mt-4"
            >
              Mulai & Buka Shift Sekarang
            </Button>
          </div>
        </div>
      ) : (
        /* ACTIVE SHIFT DASHBOARD */
        <div className="space-y-6">
          {/* Shift Metrics 4-Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Saldo Awal (Modal)
              </span>
              <div className="text-xl font-black text-foreground mt-1">
                {formatRupiah(activeShift.startingCash)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="size-3" />
                Mulai:{" "}
                {new Date(activeShift.startTime).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Penjualan Tunai
              </span>
              <div className="text-xl font-black text-success mt-1">
                +{formatRupiah(activeShift.cashSales)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Otomatis dari order POS tunai
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Cash In & Out
              </span>
              <div className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
                <span className="text-success text-base">+{formatRupiah(totalCashIn)}</span>
                <span className="text-destructive text-base">-{formatRupiah(totalCashOut)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {currentShiftMovements.length} mutasi tercatat
              </div>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Saldo Kas Akhir (Expected)
              </span>
              <div className="text-2xl font-black text-primary mt-1">
                {formatRupiah(expectedEndingCash)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Modal + Cash + In - Out</div>
            </div>
          </div>

          {/* Action Row: Cash Movement & Close Shift Trigger */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Cash Movement */}
            <div className="lg:col-span-1 rounded-3xl border border-border bg-card p-5 shadow-card">
              <h3 className="font-black text-base text-foreground flex items-center gap-2 mb-4">
                <Calculator className="size-5 text-primary" />
                Catat Cash In / Cash Out
              </h3>

              <form onSubmit={handleAddMovement} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType("in")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      movementType === "in"
                        ? "bg-success text-success-foreground border-success shadow-sm"
                        : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                    }`}
                  >
                    <ArrowDownLeft className="size-4" />
                    Cash In (Masuk)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("out")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      movementType === "out"
                        ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                        : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                    }`}
                  >
                    <ArrowUpRight className="size-4" />
                    Cash Out (Keluar)
                  </button>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">Nominal (Rp)</Label>
                  <Input
                    type="number"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="mt-1 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">Keterangan / Alasan</Label>
                  <Input
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder={
                      movementType === "in" ? "Tambah modal receh" : "Beli es batu / gas"
                    }
                    className="mt-1 rounded-xl"
                  />
                </div>

                <Button type="submit" className="w-full rounded-xl font-bold">
                  <Plus className="size-4 mr-1.5" />
                  Simpan Mutasi Kas
                </Button>
              </form>
            </div>

            {/* List of Movements & Closing Section */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-base text-foreground flex items-center gap-2">
                    <Receipt className="size-5 text-primary" />
                    Mutasi Kas Shift Berjalan
                  </h3>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {currentShiftMovements.length} transaksi
                  </span>
                </div>

                {currentShiftMovements.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Belum ada pencatatan Cash In / Cash Out pada shift ini.
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-56 overflow-y-auto">
                    {currentShiftMovements.map((m) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-8 rounded-xl flex items-center justify-center ${
                              m.type === "in"
                                ? "bg-success-soft text-success"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {m.type === "in" ? (
                              <ArrowDownLeft className="size-4" />
                            ) : (
                              <ArrowUpRight className="size-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{m.notes}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(m.timestamp).toLocaleTimeString("id-ID")} WIB
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-black ${
                            m.type === "in" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {m.type === "in" ? "+" : "-"}
                          {formatRupiah(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Shift Box */}
              <div className="rounded-3xl border border-border bg-card p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-base text-foreground">
                    Selesaikan Shift & Rekonsiliasi
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hitung uang tunai fisik di laci kasir dan cocokkan dengan sistem sebelum serah
                    terima.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="rounded-2xl font-bold px-6 shrink-0 shadow-sm"
                >
                  Tutup Shift Sekarang
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG CLOSE SHIFT (BLIND CASH COUNT ENTERPRISE) */}
      {isClosingModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Rekonsiliasi & Tutup Shift (Blind Count)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Protokol anti-curang: Kasir menghitung fisik laci kasir secara buta sebelum audit sistem.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full size-8 p-0"
                onClick={() => {
                  setIsClosingModalOpen(false);
                  setIsCountRevealed(false);
                }}
              >
                ✕
              </Button>
            </div>

            {/* Blind Count Notice */}
            {!isCountRevealed ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
                <ShieldCheck className="size-6 text-primary shrink-0" />
                <div className="text-xs">
                  <p className="font-black text-foreground">Blind Cash Count Mode Aktif</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Kalkulasi sistem disembunyikan. Hitung seluruh fisik uang kertas dan koin di laci kasir secara jujur.
                  </p>
                </div>
              </div>
            ) : (
              /* Calculations Breakdown Revealed After Count */
              <div className="rounded-2xl bg-secondary/60 p-4 space-y-2 text-xs font-semibold animate-in fade-in duration-300">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Awal (Modal):</span>
                  <span>{formatRupiah(activeShift.startingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Penjualan Tunai POS:</span>
                  <span className="text-success">+{formatRupiah(activeShift.cashSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cash In:</span>
                  <span className="text-success">+{formatRupiah(totalCashIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cash Out:</span>
                  <span className="text-destructive">-{formatRupiah(totalCashOut)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                  <span className="text-foreground">Ekspektasi Sistem:</span>
                  <span className="text-primary font-black">{formatRupiah(expectedEndingCash)}</span>
                </div>
              </div>
            )}

            {/* Actual Cash Input */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Uang Fisik Aktual di Laci Kasir</span>
                  {isCountRevealed && (
                    <button
                      type="button"
                      onClick={() => setIsCountRevealed(false)}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      Koreksi Hitungan
                    </button>
                  )}
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    type="number"
                    value={actualCashInput}
                    onChange={(e) => {
                      setActualCashInput(e.target.value);
                      if (isCountRevealed) setIsCountRevealed(false);
                    }}
                    placeholder="Masukkan total uang riil di laci kas"
                    className="pl-10 rounded-xl font-black text-base"
                    autoFocus
                  />
                </div>
              </div>

              {/* Reveal Result & Discrepancy Status */}
              {isCountRevealed && actualCashInput !== "" && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-bold space-y-1 ${
                    Number(actualCashInput) - expectedEndingCash === 0
                      ? "bg-success-soft text-success border-success/30"
                      : Number(actualCashInput) - expectedEndingCash > 0
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-wider text-[10px]">
                      {Number(actualCashInput) - expectedEndingCash === 0
                        ? "✓ Status: PAS / IMPAS"
                        : Number(actualCashInput) - expectedEndingCash > 0
                          ? "▲ Status: SELISIH LEBIH (OVERAGE)"
                          : "▼ Status: SELISIH KURANG (SHORTAGE)"}
                    </span>
                    <span className="font-black text-sm">
                      {formatRupiah(Number(actualCashInput) - expectedEndingCash)}
                    </span>
                  </div>
                  <p className="text-[10px] font-normal opacity-80">
                    Fisik: {formatRupiah(Number(actualCashInput))} vs Sistem: {formatRupiah(expectedEndingCash)}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-foreground">Catatan Penutupan Shift</Label>
                <Input
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Catatan untuk kasir shift berikutnya / keterangan selisih..."
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                onClick={() => {
                  setIsClosingModalOpen(false);
                  setIsCountRevealed(false);
                }}
              >
                Batal
              </Button>

              {!isCountRevealed ? (
                <Button
                  type="button"
                  className="rounded-xl font-black shadow-brand"
                  disabled={!actualCashInput}
                  onClick={() => {
                    if (!actualCashInput) {
                      toast.error("Masukkan jumlah uang fisik terlebih dahulu");
                      return;
                    }
                    setIsCountRevealed(true);
                  }}
                >
                  <Eye className="size-4 mr-1.5" />
                  Verifikasi Uang Fisik
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="rounded-xl font-black shadow-sm"
                  onClick={handleCloseShift}
                  disabled={!actualCashInput}
                >
                  Konfirmasi & Tutup Shift Resmi
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHIFT HISTORY LOG TABLE */}
      {shiftHistory.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-foreground flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              Riwayat Shift Kasir Terdahulu
            </h3>
            <span className="text-xs text-muted-foreground">
              {shiftHistory.length} shift selesai
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 font-bold">Waktu Mulai - Selesai</th>
                  <th className="py-2.5 font-bold">Kasir</th>
                  <th className="py-2.5 font-bold">Outlet</th>
                  <th className="py-2.5 font-bold text-right">Modal Awal</th>
                  <th className="py-2.5 font-bold text-right">Penjualan Cash</th>
                  <th className="py-2.5 font-bold text-right">Kas Riil</th>
                  <th className="py-2.5 font-bold text-right">Selisih</th>
                  <th className="py-2.5 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shiftHistory.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3 font-medium">
                      <div>{new Date(s.startTime).toLocaleDateString("id-ID")}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(s.startTime).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {s.endTime
                          ? ` - ${new Date(s.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </div>
                    </td>
                    <td className="py-3 font-bold text-foreground">{s.cashierName}</td>
                    <td className="py-3 text-muted-foreground">{s.outletName}</td>
                    <td className="py-3 text-right font-medium">{formatRupiah(s.startingCash)}</td>
                    <td className="py-3 text-right font-medium text-success">
                      +{formatRupiah(s.cashSales)}
                    </td>
                    <td className="py-3 text-right font-bold text-foreground">
                      {formatRupiah(s.actualEndingCash ?? s.expectedEndingCash)}
                    </td>
                    <td
                      className={`py-3 text-right font-bold ${
                        (s.cashDifference ?? 0) === 0
                          ? "text-muted-foreground"
                          : (s.cashDifference ?? 0) > 0
                            ? "text-success"
                            : "text-destructive"
                      }`}
                    >
                      {formatRupiah(s.cashDifference ?? 0)}
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className="bg-success-soft text-success text-[10px]">
                        Ditutup
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
