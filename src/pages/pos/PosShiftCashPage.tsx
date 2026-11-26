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
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cacheOutletCatalog, isOnline } from "@/services/offline-sync.service";
import { getOutletList, resolveActiveStaffOutlet } from "@/services/outlet.service";
import { getTodayOutletRoster, getStaffShifts, type StaffShift } from "@/services/hr.service";
import { getStaffList, isOwnerAccount, isOutletDeviceAccount, type StaffItem } from "@/services/staff.service";
import { formatRupiahInput, parseNumberFromDots } from "@/lib/input-formatters";
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
const ORDER_REVERSAL_MARKER = "[REVERSAL]";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function getShiftStorageKey(outletId?: string | null) {
  return outletId && outletId !== "all" && outletId !== "default"
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
  const [outletName, setOutletName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_active_outlet");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) return String(parsed.name);
        }
      } catch {}
    }
    return "Outlet Utama";
  });
  const [startingCashInput, setStartingCashInput] = useState("200.000");
  const [teamMembersInput, setTeamMembersInput] = useState("");
  const [todayRoster, setTodayRoster] = useState<{
    morningStaff: string[];
    nightStaff: string[];
    offOrLeaveStaff: { name: string; status: "OFF" | "SAKIT" | "IZIN"; note?: string }[];
  } | null>(null);
  const [branchStaffList, setBranchStaffList] = useState<StaffItem[]>([]);
  const [masterShifts, setMasterShifts] = useState<StaffShift[]>([]);

  // Available companion crew options: all branch crew & today's roster EXCEPT the selected cashier
  const availableCompanionCrew = useMemo(() => {
    const activeCashierLower = cashierName.trim().toLowerCase();
    const seen = new Set<string>();
    const list: Array<{ name: string; role?: string; shiftTag?: "Pagi" | "Malam" }> = [];

    const addCandidate = (rawName: string, role?: string) => {
      const clean = String(rawName || "").trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (lower === "iky" || lower === "owner" || String(role || "").toLowerCase() === "owner") return;
      if (lower === activeCashierLower || seen.has(lower)) return;
      seen.add(lower);
      const isMorning = todayRoster?.morningStaff.includes(clean);
      const isNight = todayRoster?.nightStaff.includes(clean);
      list.push({
        name: clean,
        role,
        shiftTag: isMorning ? "Pagi" : isNight ? "Malam" : undefined,
      });
    };

    branchStaffList.forEach((st) => addCandidate(st.name, st.role));
    (todayRoster?.morningStaff || []).forEach((n) => addCandidate(n));
    (todayRoster?.nightStaff || []).forEach((n) => addCandidate(n));
    return list;
  }, [branchStaffList, todayRoster, cashierName]);

  // Parsed companion crew array (always excluding the selected cashier)
  const selectedCompanionList = useMemo(() => {
    const activeCashierLower = cashierName.trim().toLowerCase();
    return teamMembersInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && s.toLowerCase() !== activeCashierLower);
  }, [teamMembersInput, cashierName]);

  // Ensure selected cashier is automatically removed from companion crew when cashier changes
  useEffect(() => {
    const activeCashierLower = cashierName.trim().toLowerCase();
    if (!activeCashierLower) return;
    setTeamMembersInput((prev) => {
      if (!prev.trim()) return prev;
      const filtered = prev
        .split(",")
        .map((s) => s.trim())
        .filter((s) => Boolean(s) && s.toLowerCase() !== activeCashierLower);
      const joined = filtered.join(", ");
      return joined === prev ? prev : joined;
    });
  }, [cashierName]);

  const toggleCompanionMember = (memberName: string) => {
    const targetLower = memberName.trim().toLowerCase();
    const exists = selectedCompanionList.some((n) => n.toLowerCase() === targetLower);
    const nextList = exists
      ? selectedCompanionList.filter((n) => n.toLowerCase() !== targetLower)
      : [...selectedCompanionList, memberName.trim()];
    setTeamMembersInput(nextList.join(", "));
  };

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
  const [isScheduleAccordionOpen, setIsScheduleAccordionOpen] = useState(false);

  // Load shifts and user details on mount and whenever active POS branch changes
  const [outletReloadTick, setOutletReloadTick] = useState(0);
  const [outletNameMap, setOutletNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleOutletChanged = (e: any) => {
      if (e?.detail?.outletName) {
        setOutletName(String(e.detail.outletName));
      }
      if (e?.detail?.outletId) {
        setOutletId(String(e.detail.outletId));
      }
      setActiveShift(null);
      setOutletReloadTick((prev) => prev + 1);
    };
    window.addEventListener("outlet:changed", handleOutletChanged);
    return () => window.removeEventListener("outlet:changed", handleOutletChanged);
  }, []);

  useEffect(() => {
    // 1. Initial quick load from local storage (strictly matching active outlet if selected)
    try {
      const currentStoredOid =
        typeof window !== "undefined"
          ? localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
            localStorage.getItem("kebabschoicepos_active_outlet_id")
          : null;
      const savedActive =
        (currentStoredOid ? localStorage.getItem(getShiftStorageKey(currentStoredOid)) : null) ||
        localStorage.getItem(STORAGE_ACTIVE_SHIFT);
      if (savedActive) {
        const parsedShift = JSON.parse(savedActive);
        if (
          !currentStoredOid ||
          currentStoredOid === "all" ||
          !parsedShift.outletId ||
          parsedShift.outletId === currentStoredOid
        ) {
          setActiveShift(parsedShift);
        } else {
          setActiveShift(null);
        }
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

        // Fetch User's Business ID (respecting active business in localStorage if owned/membered)
        const [{ data: ownedBusList }, { data: memBusList }] = await Promise.all([
          supabase
            .from("businesses")
            .select("id")
            .eq("owner_id", data.user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("business_members")
            .select("business_id, role")
            .eq("user_id", data.user.id),
        ]);
        const isCurrentUserOwner =
          (Array.isArray(ownedBusList) && ownedBusList.length > 0) ||
          (memBusList || []).some((m: any) => String(m?.role || "").toLowerCase() === "owner") ||
          (typeof window !== "undefined" &&
            localStorage.getItem("kebabschoicepos_user_role") === "owner");

        // Owner can enter POS to monitor/inspect without becoming the default shift cashier
        if (!isCurrentUserOwner && resolvedCashier.trim().toLowerCase() !== "iky") {
          setCashierName(resolvedCashier);
        }

        const bizIds = Array.from(
          new Set([
            ...(ownedBusList || []).map((b) => b.id),
            ...(memBusList || []).map((m) => m.business_id),
          ].filter(Boolean)),
        );
        const savedBid =
          typeof window !== "undefined"
            ? localStorage.getItem("kebabschoicepos_active_business_id") || ""
            : "";
        let resolvedBid = (savedBid && bizIds.includes(savedBid) ? savedBid : bizIds[0]) || undefined;

        // Resolve Active Outlet using strict isolation + Owner localStorage active branch override
        const resolvedStaffOutlet = await resolveActiveStaffOutlet(data.user.id);
        let resolvedOid = resolvedStaffOutlet.outletId || "default";
        let resolvedOname = resolvedStaffOutlet.outletName || "Outlet Utama";

        // Load outlet map for resolving historical outlet names reliably
        const allUserOutlets = await getOutletList().catch(() => []);
        const oMap: Record<string, string> = {};
        for (const o of allUserOutlets) {
          if (o?.id && (o.name || o.outlet_name)) {
            oMap[o.id] = o.name || o.outlet_name;
          }
        }
        setOutletNameMap(oMap);

        if (resolvedOid && oMap[resolvedOid]) {
          resolvedOname = oMap[resolvedOid]!;
        }

        if (resolvedOid && resolvedOid !== "default" && resolvedOid !== "all") {
          try {
            const { data: outRow } = await supabase
              .from("outlets")
              .select("id, name, business_id")
              .eq("id", resolvedOid)
              .maybeSingle();
            if (outRow?.name) {
              resolvedOname = outRow.name;
              oMap[outRow.id] = outRow.name;
            }
            if (outRow?.business_id) {
              resolvedBid = outRow.business_id;
            }
          } catch {}
        }

        if (resolvedBid) setBusinessId(resolvedBid);
        setOutletId(resolvedOid);
        setOutletName(resolvedOname);

        // Load today's staff roster from HR service (strictly excluding Owner)
        getTodayOutletRoster(resolvedOid).then((roster) => {
          const cleanRoster = {
            morningStaff: (roster.morningStaff || []).filter(
              (n) => n && n.trim().toLowerCase() !== "iky" && n.trim().toLowerCase() !== "owner",
            ),
            nightStaff: (roster.nightStaff || []).filter(
              (n) => n && n.trim().toLowerCase() !== "iky" && n.trim().toLowerCase() !== "owner",
            ),
            offOrLeaveStaff: (roster.offOrLeaveStaff || []).filter(
              (o) =>
                o?.name &&
                o.name.trim().toLowerCase() !== "iky" &&
                o.name.trim().toLowerCase() !== "owner",
            ),
          };
          setTodayRoster(cleanRoster);
          setTeamMembersInput((prev) => {
            if (prev.trim()) return prev;
            const currentHour = new Date().getHours();
            if (currentHour < 15 && cleanRoster.morningStaff.length > 0) {
              return cleanRoster.morningStaff.join(", ");
            } else if (currentHour >= 15 && cleanRoster.nightStaff.length > 0) {
              return cleanRoster.nightStaff.join(", ");
            }
            return prev;
          });
        });

        // Load operational branch staff for quick cashier picker (strictly excluding Owner)
        getStaffList()
          .then((list) => {
            const combinedStaff: StaffItem[] = [...list];
            const seenNames = new Set(combinedStaff.map((s) => s.name.trim().toLowerCase()));
            for (const o of allUserOutlets) {
              if (resolvedOid && resolvedOid !== "all" && resolvedOid !== "default" && o.id !== resolvedOid) {
                continue;
              }
              const sObj = (o.settings && typeof o.settings === "object" ? o.settings : {}) as any;
              const rosterArr: any[] = Array.isArray(sObj.outlet_staff_roster) ? sObj.outlet_staff_roster : [];
              for (const emp of rosterArr) {
                if (isOwnerAccount(emp) || isOutletDeviceAccount(emp)) continue;
                const nm = String(emp.name || emp.full_name || "").trim();
                if (!nm || nm.toLowerCase() === "iky" || seenNames.has(nm.toLowerCase())) continue;
                seenNames.add(nm.toLowerCase());
                combinedStaff.push({
                  id: emp.id || emp.user_id || `emp-${o.id}-${nm}`,
                  user_id: emp.user_id || emp.id || `emp-${o.id}-${nm}`,
                  name: nm,
                  email: emp.email || "",
                  avatar_url: emp.avatar_url || null,
                  role: (emp.role as any) || "cashier",
                  outlet: o.name || resolvedOname,
                  outlet_name: o.name || resolvedOname,
                  outlet_id: o.id,
                  outlet_code: o.code || "",
                  created_at: emp.created_at || new Date().toISOString(),
                  status: "active",
                });
              }
            }

            const filtered = combinedStaff.filter(
              (s) =>
                !isOwnerAccount(s) &&
                s.name.trim().toLowerCase() !== "iky" &&
                (!s.outlet_id || s.outlet_id === resolvedOid || s.outlet_id === "all"),
            );
            setBranchStaffList(filtered);

            const savedCashier = localStorage.getItem("kebabschoicepos_active_cashier_name");
            const isSavedCashierValidStaff =
              savedCashier &&
              savedCashier.trim().toLowerCase() !== "iky" &&
              (!isCurrentUserOwner ||
                savedCashier.trim().toLowerCase() !== resolvedCashier.trim().toLowerCase()) &&
              filtered.some((st) => st.name.trim().toLowerCase() === savedCashier.trim().toLowerCase());

            if (isSavedCashierValidStaff && savedCashier) {
              setCashierName(savedCashier);
            } else if (filtered.length > 0) {
              const currentHour = new Date().getHours();
              getTodayOutletRoster(resolvedOid)
                .then((roster) => {
                  const scheduled = (
                    currentHour < 15
                      ? roster?.morningStaff || []
                      : roster?.nightStaff || []
                  ).filter((n) => n.trim().toLowerCase() !== "iky");
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

        // 3. Sync active shift from Supabase pos_shifts table strictly filtered by business_id & outlet_id
        if (resolvedBid) {
          try {
            let openShiftQuery = supabase
              .from("pos_shifts" as any)
              .select("*")
              .eq("business_id", resolvedBid)
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
              const startVal = Number(row.opening_cash || row.starting_cash) || 0;
              const cashSalesVal = Number(row.cash_sales) || 0;
              const cashInVal = Number(row.total_cash_in) || 0;
              const cashOutVal = Number(row.total_cash_out) || 0;
              const computedExp = startVal + cashSalesVal + cashInVal - cashOutVal;
              const liveShift: PosShift = {
                id: row.id,
                cashierName: row.cashier_name || resolvedCashier,
                cashierId: row.cashier_id || row.user_id,
                teamMembers: row.team_members || (row.notes?.startsWith("Kru:") ? row.notes : undefined),
                outletName: row.outlet_name || (row.outlet_id ? oMap[row.outlet_id] : null) || resolvedOname,
                outletId: row.outlet_id || resolvedOid,
                startingCash: startVal,
                startTime: row.start_time || row.opened_at,
                status: "open",
                cashSales: cashSalesVal,
                totalCashIn: cashInVal,
                totalCashOut: cashOutVal,
                expectedEndingCash: computedExp,
                notes: row.notes,
              };
              setActiveShift(liveShift);
              localStorage.setItem(getShiftStorageKey(resolvedOid), JSON.stringify(liveShift));
              localStorage.setItem(STORAGE_ACTIVE_SHIFT, JSON.stringify(liveShift));

              // Load cash movements for this shift (strictly business-scoped)
              const { data: movRows } = await supabase
                .from("cash_movements" as any)
                .select("*")
                .eq("business_id", resolvedBid)
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

            // Load recent closed shifts history from DB strictly filtered by business_id & outlet_id
            let historyQuery = supabase
              .from("pos_shifts" as any)
              .select("*")
              .eq("business_id", resolvedBid)
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
              // Reconcile cash_in / cash_out for closed shifts directly from shift-scoped cash_movements
              // (excludes [REVERSAL] entries and eliminates stale unscoped ghost movements e.g. Syfa +Rp 100.000 discrepancy)
              const histShiftIds = historyRows.map((h: any) => h.id).filter(Boolean);
              const verifiedInByShift: Record<string, number> = {};
              const verifiedOutByShift: Record<string, number> = {};
              let verifiedMovementsLoaded = false;

              if (histShiftIds.length > 0) {
                try {
                  const { data: histMovRows, error: histMovErr } = await supabase
                    .from("cash_movements" as any)
                    .select("shift_id, type, amount, description")
                    .eq("business_id", resolvedBid)
                    .in("shift_id", histShiftIds);
                  if (!histMovErr && Array.isArray(histMovRows)) {
                    verifiedMovementsLoaded = true;
                    for (const m of histMovRows as any[]) {
                      const sid = m.shift_id;
                      if (!sid) continue;
                      const desc = String(m.description || "");
                      if (desc.startsWith(ORDER_REVERSAL_MARKER)) continue;
                      const amt = Number(m.amount) || 0;
                      if (m.type === "in") {
                        verifiedInByShift[sid] = (verifiedInByShift[sid] || 0) + amt;
                      } else if (m.type === "out") {
                        verifiedOutByShift[sid] = (verifiedOutByShift[sid] || 0) + amt;
                      }
                    }
                  }
                } catch {}
              }

              const mappedHistory: PosShift[] = historyRows.map((h: any) => {
                const startVal = Number(h.opening_cash || h.starting_cash) || 0;
                const cashSalesVal = Number(h.cash_sales) || 0;
                const cashInVal = verifiedMovementsLoaded
                  ? Number(verifiedInByShift[h.id] || 0)
                  : Number(h.total_cash_in) || 0;
                const cashOutVal = verifiedMovementsLoaded
                  ? Number(verifiedOutByShift[h.id] || 0)
                  : Number(h.total_cash_out) || 0;
                const expectedVal = startVal + cashSalesVal + cashInVal - cashOutVal;
                const actualVal =
                  h.actual_ending_cash !== null && h.actual_ending_cash !== undefined
                    ? Number(h.actual_ending_cash)
                    : h.ending_cash !== null && h.ending_cash !== undefined
                      ? Number(h.ending_cash)
                      : expectedVal;
                const diffVal = actualVal - expectedVal;
                const resolvedHistOutletName =
                  (h.outlet_name && String(h.outlet_name).trim()) ||
                  (h.outlet_id ? oMap[h.outlet_id] : null) ||
                  resolvedOname ||
                  "Outlet Utama";

                // Self-heal stale variance / total_cash_out in pos_shifts if DB had unscoped movement residue
                if (
                  verifiedMovementsLoaded &&
                  (Number(h.total_cash_in || 0) !== cashInVal ||
                    Number(h.total_cash_out || 0) !== cashOutVal ||
                    Number(h.expected_ending_cash || 0) !== expectedVal ||
                    Number(h.cash_difference || 0) !== diffVal)
                ) {
                  Promise.resolve(
                    supabase
                      .from("pos_shifts" as any)
                      .update({
                        total_cash_in: cashInVal,
                        total_cash_out: cashOutVal,
                        expected_ending_cash: expectedVal,
                        cash_difference: diffVal,
                      })
                      .eq("id", h.id),
                  ).catch(() => {});
                }

                return {
                  id: h.id,
                  cashierName: h.cashier_name || "Kasir",
                  cashierId: h.cashier_id || h.user_id,
                  teamMembers: h.team_members,
                  outletName: resolvedHistOutletName,
                  outletId: h.outlet_id || resolvedOid,
                  startingCash: startVal,
                  startTime: h.start_time || h.opened_at,
                  endTime: h.end_time || h.closed_at,
                  status: "closed",
                  cashSales: cashSalesVal,
                  totalCashIn: cashInVal,
                  totalCashOut: cashOutVal,
                  expectedEndingCash: expectedVal,
                  actualEndingCash: actualVal,
                  cashDifference: diffVal,
                  notes: h.notes,
                };
              });
              setShiftHistory(mappedHistory);
              localStorage.setItem(STORAGE_HISTORY, JSON.stringify(mappedHistory));
            } else {
              setShiftHistory([]);
            }
          } catch (dbShiftErr) {
            console.warn("[PosShift] Could not load from DB, using local state:", dbShiftErr);
          }
        }
      }
    });
  }, [outletReloadTick]);

  // Live order sales during active shift (Cash vs Non-cash like QRIS/Transfer)
  const [liveCashSales, setLiveCashSales] = useState(0);
  const [liveNonCashSales, setLiveNonCashSales] = useState(0);
  const [liveOrderCount, setLiveOrderCount] = useState(0);
  const [hasLoadedLiveSales, setHasLoadedLiveSales] = useState(false);

  // Poll / sync sales_orders for active shift (strictly business_id + outlet_id + enum-safe status="paid")
  useEffect(() => {
    if (!activeShift?.startTime || !businessId) {
      setLiveCashSales(0);
      setLiveNonCashSales(0);
      setLiveOrderCount(0);
      setHasLoadedLiveSales(false);
      return;
    }

    const fetchShiftSales = async () => {
      try {
        // Use .eq("status", "paid") so Postgres enum public.order_status ('draft','paid','refunded','cancelled')
        // never rejects the query with "invalid input value for enum order_status: 'completed'"
        let q = supabase
          .from("sales_orders")
          .select("*")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("created_at", activeShift.startTime);

        const targetOid = activeShift.outletId || outletId;
        if (targetOid && targetOid !== "all" && targetOid !== "default") {
          q = q.eq("outlet_id", targetOid);
        }

        let { data: orders, error } = await q;

        // Safe fallback if a legacy schema uses a text status column with other paid labels
        if (error) {
          const fallbackQuery = supabase
            .from("sales_orders")
            .select("*")
            .eq("business_id", businessId)
            .gte("created_at", activeShift.startTime);
          const fallbackScoped =
            targetOid && targetOid !== "all" && targetOid !== "default"
              ? fallbackQuery.eq("outlet_id", targetOid)
              : fallbackQuery;
          const fallbackRes = await fallbackScoped;
          if (fallbackRes.error) throw fallbackRes.error;
          orders = (fallbackRes.data || []).filter((row: any) => {
            const st = String(row.status || "").toLowerCase();
            return st === "paid" || st === "completed";
          });
        }

        let cashSum = 0;
        let nonCashSum = 0;
        let count = 0;

        (orders || []).forEach((o: any) => {
          count++;
          const tot = Number((o as any).total ?? (o as any).total_amount ?? 0);
          const method = String(o.payment_method || "cash").toLowerCase();
          if (method === "cash" || method === "tunai") {
            cashSum += tot;
          } else {
            nonCashSum += tot;
          }
        });

        setLiveCashSales(cashSum);
        setLiveNonCashSales(nonCashSum);
        setLiveOrderCount(count);
        setHasLoadedLiveSales(true);
      } catch (err) {
        console.warn("[PosShift] fetchShiftSales warning:", err);
      }
    };

    fetchShiftSales();
    const timer = setInterval(fetchShiftSales, 10000);
    return () => clearInterval(timer);
  }, [activeShift?.startTime, activeShift?.outletId, outletId, businessId]);

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
    // Exclude refund/void reversal movements tagged with ORDER_REVERSAL_MARKER because
    // a refunded/voided order is no longer status="paid" and is already excluded from liveCashSales.
    return currentShiftMovements
      .filter(
        (m) =>
          m.type === "out" &&
          !String(m.notes || "").startsWith(ORDER_REVERSAL_MARKER),
      )
      .reduce((sum, m) => sum + m.amount, 0);
  }, [currentShiftMovements]);

  // Real Cash Sales: ALWAYS use liveCashSales from the database when online (never Math.max with cached shift.cashSales,
  // which would mask voids/refunds and hide real cash discrepancies!). Only fall back to cached cashSales when offline.
  const effectiveCashSales = useMemo(() => {
    if (isOnline() && hasLoadedLiveSales) {
      return liveCashSales;
    }
    if (!isOnline()) {
      return Number(activeShift?.cashSales) || 0;
    }
    return liveCashSales;
  }, [liveCashSales, hasLoadedLiveSales, activeShift?.cashSales]);

  // Expected Cash calculation:
  // Saldo Awal + Penjualan Cash + Cash In - Cash Out = Saldo Akhir
  const expectedEndingCash = useMemo(() => {
    if (!activeShift) return 0;
    const start = Number(activeShift.startingCash) || 0;
    return start + effectiveCashSales + totalCashIn - totalCashOut;
  }, [activeShift, effectiveCashSales, totalCashIn, totalCashOut]);

  // Handle Open Shift (DB Persistence + LocalStorage)
  const handleOpenShift = async () => {
    const startCash = parseNumberFromDots(startingCashInput);
    if (startCash < 0) {
      toast.error("Modal awal tidak valid");
      return;
    }

    if (!businessId) {
      toast.error("Bisnis belum terdeteksi. Muat ulang halaman lalu coba lagi.");
      return;
    }

    const localShiftId = `shift-${Date.now()}`;
    let createdShiftId = localShiftId;
    let persistedToDatabase = false;
    const teamMembers = teamMembersInput.trim() || undefined;
    const startTimeIso = new Date().toISOString();
    const safeOutletUuid = isValidUuid(outletId) ? outletId : null;
    const safeUserUuid = isValidUuid(userId) ? userId : null;

    if (isOnline()) {
      try {
        let { data: inserted, error: insertErr } = await supabase
          .from("pos_shifts" as any)
          .insert({
            business_id: businessId,
            outlet_id: safeOutletUuid,
            cashier_id: safeUserUuid,
            cashier_name: cashierName,
            team_members: teamMembers,
            outlet_name: outletName,
            opening_cash: startCash,
            start_time: startTimeIso,
            status: "open",
            cash_sales: 0,
            total_cash_in: 0,
            total_cash_out: 0,
            expected_ending_cash: startCash,
            notes: teamMembers ? `Kru: ${teamMembers}` : null,
          })
          .select("id")
          .maybeSingle();

        // Fallback to core columns in 20260930000000_pos_shifts_and_cash_movements.sql if team_members column is absent
        if (insertErr) {
          console.warn("[pos_shifts] Retrying open shift insert without optional columns:", insertErr.message);
          const retryRes = await supabase
            .from("pos_shifts" as any)
            .insert({
              business_id: businessId,
              outlet_id: safeOutletUuid,
              cashier_id: safeUserUuid,
              cashier_name: cashierName,
              outlet_name: outletName,
              opening_cash: startCash,
              start_time: startTimeIso,
              status: "open",
              cash_sales: 0,
              total_cash_in: 0,
              total_cash_out: 0,
              expected_ending_cash: startCash,
              notes: teamMembers ? `Kru: ${teamMembers}` : null,
            })
            .select("id")
            .maybeSingle();
          inserted = retryRes.data;
          insertErr = retryRes.error;
        }

        // Second fallback for schemas using starting_cash & user_id
        if (insertErr) {
          console.warn("[pos_shifts] Retrying open shift insert with starting_cash/user_id schema:", insertErr.message);
          const retryRes2 = await supabase
            .from("pos_shifts" as any)
            .insert({
              business_id: businessId,
              outlet_id: safeOutletUuid,
              user_id: safeUserUuid,
              cashier_name: cashierName,
              outlet_name: outletName,
              starting_cash: startCash,
              start_time: startTimeIso,
              status: "open",
              cash_sales: 0,
              total_cash_in: 0,
              total_cash_out: 0,
              expected_ending_cash: startCash,
              notes: teamMembers ? `Kru: ${teamMembers}` : null,
            })
            .select("id")
            .maybeSingle();
          inserted = retryRes2.data;
          insertErr = retryRes2.error;
        }

        if (insertErr || !(inserted as any)?.id) {
          console.error("[pos_shifts] Gagal menyimpan buka shift ke database:", insertErr);
          toast.error("Gagal membuka shift di database", {
            description: insertErr?.message || "Shift tidak dapat disimpan ke server. Periksa koneksi/izin lalu coba lagi.",
          });
          return;
        }

        createdShiftId = (inserted as any).id;
        persistedToDatabase = true;
      } catch (err: any) {
        if (isOnline()) {
          toast.error("Gagal membuka shift di database", {
            description: err?.message || "Terjadi kesalahan saat menyimpan shift ke server.",
          });
          return;
        }
        console.warn("[pos_shifts] Offline fallback for open shift:", err);
      }
    }

    const newShift: PosShift = {
      id: createdShiftId,
      cashierName,
      cashierId: userId || undefined,
      teamMembers,
      outletName,
      outletId: outletId || undefined,
      startingCash: startCash,
      startTime: startTimeIso,
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
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
    }

    // Cache catalog outlet (menu, kategori, varian) ke IndexedDB saat buka shift (scoped by business_id)
    try {
      let catalogQuery = supabase.from("products").select("*");
      if (businessId) {
        catalogQuery = catalogQuery.eq("business_id", businessId);
      }
      catalogQuery.then(({ data: prods }) => {
        cacheOutletCatalog(outletId || "all", {
          businessId,
          products: prods || [],
        }).catch(() => {});
      });
    } catch {}

    toast.success(`Shift kasir dibuka untuk ${cashierName}`, {
      description: persistedToDatabase
        ? `Modal Kas Awal: ${formatRupiah(startCash)} (Tersimpan ke Database & Lokal)`
        : `Modal Kas Awal: ${formatRupiah(startCash)} (Mode Offline — Tersimpan Lokal)`,
    });
  };

  // Handle Add Cash Movement (Cash In / Cash Out)
  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      toast.error("Tidak ada shift aktif. Buka shift terlebih dahulu.");
      return;
    }

    const amount = parseNumberFromDots(movementAmount);
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
      const isDbShift = isValidUuid(activeShift.id);
      const localShiftNote = !isDbShift ? ` [Ref Shift Lokal: ${activeShift.id}]` : "";
      const { data: inserted, error } = await supabase
        .from("cash_movements" as any)
        .insert({
          business_id: businessId,
          outlet_id: isValidUuid(outletId) ? outletId : null,
          shift_id: isDbShift ? activeShift.id : null,
          type: movementType,
          amount,
          description: `${movementNotes.trim()}${localShiftNote}`,
        })
        .select("id")
        .maybeSingle();

      if (!error && (inserted as any)?.id) {
        movementDbId = (inserted as any).id;
      } else if (error) {
        console.warn("[cash_movements] DB insert error:", error.message);
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

    const actual = parseNumberFromDots(actualCashInput);
    const computedExpected =
      (Number(activeShift.startingCash) || 0) + effectiveCashSales + totalCashIn - totalCashOut;
    const diff = actual - computedExpected;
    const endTime = new Date().toISOString();
    const resolvedCloseOutletName =
      (activeShift.outletName && activeShift.outletName.trim()) ||
      (activeShift.outletId ? outletNameMap[activeShift.outletId] : null) ||
      outletName ||
      "Outlet Utama";

    if (isValidUuid(activeShift.id)) {
      if (!businessId) {
        toast.error("Bisnis tidak terdeteksi. Muat ulang halaman lalu coba tutup shift lagi.");
        return;
      }
      try {
        let { data: closedRows, error: closeErr } = await supabase
          .from("pos_shifts" as any)
          .update({
            end_time: endTime,
            status: "closed",
            outlet_name: resolvedCloseOutletName,
            cash_sales: effectiveCashSales,
            total_cash_in: totalCashIn,
            total_cash_out: totalCashOut,
            expected_ending_cash: computedExpected,
            actual_ending_cash: actual,
            cash_difference: diff,
            notes: closingNotes,
            updated_at: endTime,
          })
          .eq("id", activeShift.id)
          .eq("business_id", businessId)
          .eq("status", "open")
          .select("id");

        if (closeErr) {
          console.warn("[pos_shifts] Retrying close shift with ending_cash schema:", closeErr.message);
          const retryClose = await supabase
            .from("pos_shifts" as any)
            .update({
              end_time: endTime,
              status: "closed",
              outlet_name: resolvedCloseOutletName,
              cash_sales: effectiveCashSales,
              total_cash_in: totalCashIn,
              total_cash_out: totalCashOut,
              expected_ending_cash: computedExpected,
              ending_cash: actual,
              notes: closingNotes,
              updated_at: endTime,
            })
            .eq("id", activeShift.id)
            .eq("business_id", businessId)
            .eq("status", "open")
            .select("id");
          closedRows = retryClose.data;
          closeErr = retryClose.error;
        }

        if (closeErr || !closedRows || closedRows.length === 0) {
          console.error("[pos_shifts] Gagal menutup shift di database:", closeErr);
          toast.error("Gagal menutup shift di database", {
            description:
              closeErr?.message ||
              "Shift sudah ditutup di terminal lain atau tidak ditemukan. Muat ulang halaman untuk sinkronisasi.",
          });
          return;
        }
      } catch (err: any) {
        console.error("[pos_shifts] DB close update exception:", err);
        toast.error("Gagal menutup shift di database", {
          description: err?.message || "Periksa koneksi internet lalu coba tutup shift kembali.",
        });
        return;
      }
    }

    const closedShift: PosShift = {
      ...activeShift,
      outletName: resolvedCloseOutletName,
      endTime,
      status: "closed",
      cashSales: effectiveCashSales,
      totalCashIn,
      totalCashOut,
      expectedEndingCash: computedExpected,
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
    if (outletId) {
      localStorage.removeItem(getShiftStorageKey(outletId));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
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
    <div className="space-y-3 w-full max-w-none pb-6">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
              Shift & Kas Laci Kasir
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Cabang: <strong className="text-foreground">{outletName}</strong> · Buka shift, mutasi kas, & rekonsiliasi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeShift ? (
            <Badge
              variant="outline"
              className="bg-success-soft text-success border-success/30 px-2.5 py-1 text-xs font-bold"
            >
              Shift Aktif: {activeShift.cashierName}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-destructive/10 text-destructive border-destructive/30 px-2.5 py-1 text-xs font-bold"
            >
              Shift Tutup
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content: Shift Closed vs Shift Active */}
      {!activeShift ? (
        /* SAAT SHIFT TUTUP: 1 KARTU RINGKAS TERPUSAT (max-w-lg mx-auto) */
        <div className="max-w-lg mx-auto space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Clock className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground leading-tight">
                    Buka Shift Kasir Baru
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Pilih kasir, kru pendamping, & modal awal laci kas.
                  </p>
                </div>
              </div>
            </div>

            {/* Baris Outlet Aktif (Locked ReadOnly) & Nama Kasir */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-bold text-foreground">Outlet Aktif</Label>
                <div className="relative mt-1">
                  <Store className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={outletName}
                    readOnly
                    aria-readonly="true"
                    placeholder="Outlet Cabang"
                    className="h-9 pl-8 rounded-xl bg-muted/50 text-xs font-bold text-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Nama Kasir Bertugas *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    placeholder="Nama Kasir Bertugas"
                    className="h-9 pl-8 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Quick Select Staff Pills */}
            {branchStaffList.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Pilih Cepat Kasir Cabang:
                </span>
                <div className="flex flex-wrap gap-1.5">
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
                          "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 active:scale-95",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-secondary/60 hover:bg-secondary text-foreground border-border/80",
                        )}
                      >
                        <User className="size-3" />
                        <span>{st.name}</span>
                        {(isMorning || isNight) && (
                          <span
                            className={cn(
                              "text-[10px] px-1 rounded font-bold",
                              isSelected ? "bg-white/20 text-white" : "bg-muted text-foreground/75",
                            )}
                          >
                            {isMorning ? "Pagi" : "Malam"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Kru Pendamping (Otomatis Mengecualikan Kasir Terpilih) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Kru Pendamping (Opsional)
                </Label>
                {selectedCompanionList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTeamMembersInput("")}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Reset ({selectedCompanionList.length})
                  </button>
                )}
              </div>

              {availableCompanionCrew.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/25 p-2">
                  {availableCompanionCrew.map((crew) => {
                    const isPicked = selectedCompanionList.some(
                      (n) => n.toLowerCase() === crew.name.toLowerCase(),
                    );
                    return (
                      <button
                        key={crew.name}
                        type="button"
                        onClick={() => toggleCompanionMember(crew.name)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95",
                          isPicked
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-card hover:bg-secondary text-foreground border-border/80",
                        )}
                      >
                        <Users className="size-3 shrink-0" />
                        <span>{crew.name}</span>
                        {crew.shiftTag && (
                          <span
                            className={cn(
                              "text-[10px] px-1 rounded font-bold",
                              isPicked ? "bg-white/20 text-white" : "bg-muted text-foreground/75",
                            )}
                          >
                            {crew.shiftTag}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20 px-2.5 py-1.5">
                  Tidak ada kru pendamping lain selain {cashierName}.
                </p>
              )}

              {/* Accordion Collapsible Jadwal Tim Cabang Hari Ini */}
              <div className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsScheduleAccordionOpen((prev) => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-foreground/85 hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" />
                    <span>Jadwal Tim Cabang Hari Ini</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-150",
                      isScheduleAccordionOpen && "rotate-180",
                    )}
                  />
                </button>

                {isScheduleAccordionOpen && (
                  <div className="px-3 pb-3 pt-1.5 border-t border-border/60 space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border/60 bg-card p-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-foreground">
                            Shift Pagi {morningHours}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] font-bold rounded"
                            onClick={() => {
                              if (todayRoster?.morningStaff && todayRoster.morningStaff.length > 0) {
                                const activeLower = cashierName.trim().toLowerCase();
                                const companions = todayRoster.morningStaff.filter(
                                  (n) => n.trim().toLowerCase() !== activeLower,
                                );
                                setTeamMembersInput(companions.join(", "));
                                toast.success("Kru pendamping Shift Pagi dipilih");
                              }
                            }}
                          >
                            Isi Pagi
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {todayRoster?.morningStaff && todayRoster.morningStaff.length > 0
                            ? todayRoster.morningStaff.join(", ")
                            : "Belum ada jadwal"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-card p-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-foreground">
                            Shift Malam {nightHours}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] font-bold rounded"
                            onClick={() => {
                              if (todayRoster?.nightStaff && todayRoster.nightStaff.length > 0) {
                                const activeLower = cashierName.trim().toLowerCase();
                                const companions = todayRoster.nightStaff.filter(
                                  (n) => n.trim().toLowerCase() !== activeLower,
                                );
                                setTeamMembersInput(companions.join(", "));
                                toast.success("Kru pendamping Shift Malam dipilih");
                              }
                            }}
                          >
                            Isi Malam
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {todayRoster?.nightStaff && todayRoster.nightStaff.length > 0
                            ? todayRoster.nightStaff.join(", ")
                            : "Belum ada jadwal"}
                        </p>
                      </div>
                    </div>

                    {todayRoster?.offOrLeaveStaff && todayRoster.offOrLeaveStaff.length > 0 && (
                      <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground">OFF/Izin:</span>
                        {todayRoster.offOrLeaveStaff.map((st, i) => (
                          <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                            {st.name} ({st.status})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Awal Cepat */}
            <div>
              <Label className="text-xs font-bold text-foreground">
                Modal Awal Kasir (Uang Kembalian)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={startingCashInput}
                  onChange={(e) => setStartingCashInput(formatRupiahInput(e.target.value))}
                  placeholder="200.000"
                  className="h-9 pl-9 rounded-xl font-bold text-sm tabular-nums"
                />
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {[100000, 200000, 300000, 500000].map((preset) => {
                  const formattedPreset = formatRupiahInput(preset);
                  const isCurrent = parseNumberFromDots(startingCashInput) === preset;
                  return (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={isCurrent ? "default" : "outline"}
                      onClick={() => setStartingCashInput(formattedPreset)}
                      className="h-8 rounded-lg text-xs font-bold tabular-nums px-2"
                    >
                      {formattedPreset}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleOpenShift}
              className="w-full h-11 rounded-xl font-black text-sm shadow-brand active:scale-95 transition-transform duration-100"
            >
              Buka Shift Sekarang
            </Button>
          </div>
        </div>
      ) : (
        /* SAAT SHIFT AKTIF: 4 KARTU KPI SEJAJAR 1 BARIS + 2 KOLOM BAWAH */
        <div className="space-y-4">
          {/* 4 Kartu KPI Sejajar 1 Baris di Atas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Modal Awal
              </span>
              <div className="text-lg xl:text-xl font-black text-foreground tabular-nums mt-0.5">
                {formatRupiah(activeShift.startingCash)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="size-3" />
                Mulai{" "}
                {new Date(activeShift.startTime).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Penjualan Tunai
              </span>
              <div className="text-lg xl:text-xl font-black text-success tabular-nums mt-0.5">
                +{formatRupiah(effectiveCashSales)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {liveOrderCount} order ({formatRupiah(liveNonCashSales)} Non-Tunai)
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Kas Masuk/Keluar
              </span>
              <div className="text-sm xl:text-base font-black text-foreground tabular-nums mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-success">+{formatRupiah(totalCashIn)}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">-{formatRupiah(totalCashOut)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {currentShiftMovements.length} mutasi kas
              </div>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                Ekspektasi Kas
              </span>
              <div className="text-lg xl:text-xl font-black text-primary tabular-nums mt-0.5">
                {formatRupiah(expectedEndingCash)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Modal + Tunai + In - Out</div>
            </div>
          </div>

          {/* 2 Kolom di Bawah: Kiri = + Kas Masuk / - Kas Keluar / Tutup Shift, Kanan = Riwayat Shift */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* KOLOM KIRI (md:col-span-5): + Kas Masuk, - Kas Keluar & Tutup Shift */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <Calculator className="size-4 text-primary" />
                  Aksi Kas Laci (+ Kas Masuk / - Kas Keluar)
                </h3>

                <form onSubmit={handleAddMovement} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMovementType("in")}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        movementType === "in"
                          ? "bg-success text-success-foreground border-success shadow-xs"
                          : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                      }`}
                    >
                      <ArrowDownLeft className="size-3.5" />
                      + Kas Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType("out")}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        movementType === "out"
                          ? "bg-destructive text-destructive-foreground border-destructive shadow-xs"
                          : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                      }`}
                    >
                      <ArrowUpRight className="size-3.5" />
                      - Kas Keluar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Nominal (Rp)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={movementAmount}
                        onChange={(e) => setMovementAmount(formatRupiahInput(e.target.value))}
                        placeholder="50.000"
                        className="mt-1 h-9 rounded-xl text-xs font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-foreground">Keterangan</Label>
                      <Input
                        value={movementNotes}
                        onChange={(e) => setMovementNotes(e.target.value)}
                        placeholder={
                          movementType === "in" ? "Modal receh" : "Beli es batu / gas"
                        }
                        className="mt-1 h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="w-full h-9 rounded-xl text-xs font-bold">
                    <Plus className="size-3.5 mr-1" />
                    Simpan Mutasi Kas
                  </Button>
                </form>

                {currentShiftMovements.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-1.5 max-h-36 overflow-y-auto">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      Mutasi Shift Ini ({currentShiftMovements.length})
                    </span>
                    {currentShiftMovements.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-b-0"
                      >
                        <span className="truncate text-foreground font-medium">{m.notes}</span>
                        <span
                          className={cn(
                            "font-bold tabular-nums shrink-0",
                            m.type === "in" ? "text-success" : "text-destructive",
                          )}
                        >
                          {m.type === "in" ? "+" : "-"}
                          {formatRupiah(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kartu Tutup Shift */}
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-foreground">Tutup Shift & Rekonsiliasi</h4>
                  <p className="text-xs text-muted-foreground">
                    Hitung uang fisik laci kasir saat pergantian shift.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="h-10 rounded-xl font-bold px-4 text-xs shrink-0 shadow-xs active:scale-95 transition-transform duration-100"
                >
                  Tutup Shift
                </Button>
              </div>
            </div>

            {/* KOLOM KANAN (md:col-span-7): Riwayat Shift */}
            <div className="md:col-span-7 rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-primary" />
                  Riwayat Shift
                </h3>
                <span className="text-xs text-muted-foreground font-semibold">
                  {shiftHistory.length} shift selesai
                </span>
              </div>

              {shiftHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Belum ada riwayat penutupan shift sebelumnya di cabang ini.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0 bg-card">
                      <tr>
                        <th className="py-2 px-2 font-bold">Waktu</th>
                        <th className="py-2 px-2 font-bold">Kasir</th>
                        <th className="py-2 px-2 font-bold text-right">Modal</th>
                        <th className="py-2 px-2 font-bold text-right">Tunai</th>
                        <th className="py-2 px-2 font-bold text-right">Fisik</th>
                        <th className="py-2 px-2 font-bold text-right">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {shiftHistory.map((s) => {
                        const openingCash = Number(s.startingCash ?? (s as any).opening_cash) || 0;
                        const cashSales = Number(s.cashSales ?? (s as any).cash_sales) || 0;
                        const cashIn = Number(s.totalCashIn ?? (s as any).total_cash_in) || 0;
                        const cashOut = Number(s.totalCashOut ?? (s as any).total_cash_out) || 0;
                        const expectedCash = openingCash + cashSales + cashIn - cashOut;
                        const actualCash =
                          s.actualEndingCash !== undefined && s.actualEndingCash !== null
                            ? Number(s.actualEndingCash)
                            : expectedCash;
                        const variance = actualCash - expectedCash;
                        const rowOutletName =
                          (s.outletName && s.outletName.trim()) ||
                          (s.outletId ? outletNameMap[s.outletId] : null) ||
                          outletName ||
                          "Outlet Utama";

                        return (
                          <tr key={s.id} className="hover:bg-secondary/40 transition-colors">
                            <td className="py-2.5 px-2 font-medium whitespace-nowrap">
                              <div>{new Date(s.startTime).toLocaleDateString("id-ID")}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(s.startTime).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {s.endTime
                                  ? ` - ${new Date(s.endTime).toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}`
                                  : ""}
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="font-bold text-foreground">{s.cashierName}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {rowOutletName}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums">
                              {formatRupiah(openingCash)}
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-success font-semibold">
                              +{formatRupiah(cashSales)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-foreground tabular-nums">
                              {formatRupiah(actualCash)}
                            </td>
                            <td
                              className={cn(
                                "py-2.5 px-2 text-right font-bold tabular-nums",
                                variance === 0
                                  ? "text-muted-foreground"
                                  : variance > 0
                                    ? "text-success"
                                    : "text-destructive",
                              )}
                            >
                              {variance > 0 ? `+${formatRupiah(variance)}` : formatRupiah(variance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG CLOSE SHIFT (BLIND CASH COUNT ENTERPRISE) */}
      {isClosingModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Rekonsiliasi & Tutup Shift
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hitung fisik uang tunai di laci kasir sebelum menutup shift.
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

            <div className="rounded-xl bg-secondary/60 p-3.5 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal Awal:</span>
                <span className="tabular-nums font-bold text-foreground">
                  {formatRupiah(activeShift.startingCash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penjualan Tunai POS:</span>
                <span className="tabular-nums font-bold text-foreground">
                  +{formatRupiah(effectiveCashSales)}
                </span>
              </div>
              {liveNonCashSales > 0 && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Penjualan Non-Tunai (QRIS/EDC):</span>
                  <span className="tabular-nums">{formatRupiah(liveNonCashSales)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kas Masuk / Keluar:</span>
                <span className="tabular-nums font-bold text-foreground">
                  +{formatRupiah(totalCashIn)} / -{formatRupiah(totalCashOut)}
                </span>
              </div>
              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm">
                <span className="text-foreground">Ekspektasi Kas Sistem:</span>
                <span className="text-primary font-black tabular-nums">
                  {formatRupiah(expectedEndingCash)}
                </span>
              </div>
            </div>

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
                    type="text"
                    inputMode="numeric"
                    value={actualCashInput}
                    onChange={(e) => {
                      setActualCashInput(formatRupiahInput(e.target.value));
                    }}
                    placeholder="Contoh: 200.000"
                    className="pl-10 rounded-xl font-black text-base tabular-nums"
                    autoFocus
                  />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Sesuai Sistem", val: expectedEndingCash },
                    { label: "100.000", val: 100000 },
                    { label: "200.000", val: 200000 },
                    { label: "500.000", val: 500000 },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant={
                        actualCashInput !== "" &&
                        parseNumberFromDots(actualCashInput) === preset.val
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setActualCashInput(formatRupiahInput(preset.val))}
                      className="h-8 rounded-xl text-xs font-bold tabular-nums px-1.5"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {actualCashInput !== "" && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold space-y-0.5 ${
                    parseNumberFromDots(actualCashInput) - expectedEndingCash === 0
                      ? "bg-success-soft text-success border-success/30"
                      : parseNumberFromDots(actualCashInput) - expectedEndingCash > 0
                        ? "bg-muted text-foreground/75 border-border"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-wider text-[10px]">
                      {parseNumberFromDots(actualCashInput) - expectedEndingCash === 0
                        ? "Status: PAS / IMPAS (Selisih Rp 0)"
                        : parseNumberFromDots(actualCashInput) - expectedEndingCash > 0
                          ? "Status: SELISIH LEBIH"
                          : "Status: SELISIH KURANG"}
                    </span>
                    <span className="font-black text-sm tabular-nums">
                      {formatRupiah(parseNumberFromDots(actualCashInput) - expectedEndingCash)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs font-bold text-foreground">Catatan Penutupan Shift</Label>
                <Input
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Catatan serah terima shift..."
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                className="rounded-xl font-bold text-xs"
                onClick={() => {
                  setIsClosingModalOpen(false);
                  setIsCountRevealed(false);
                }}
              >
                Batal
              </Button>

              <Button
                variant="destructive"
                className="rounded-xl font-black text-xs shadow-xs"
                onClick={handleCloseShift}
                disabled={!actualCashInput}
              >
                Konfirmasi & Tutup Shift
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
