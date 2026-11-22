import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  XCircle,
  RefreshCw,
  Eye,
  Trash2,
  Store,
  Send,
  X,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStockTransfers,
  createStockTransfer,
  updateStockTransferStatus,
  getInventoryItems,
  type StockTransferRecord,
  type StockTransferItemDetail,
  type InventoryItemDetail,
} from "@/services/inventory.service";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import { getBusinessOutlets, type MenuOutletInfo } from "@/services/menu.service";
import { isOutletDeletedOrArchived } from "@/services/outlet.service";
import { sanitizeQuantityInput, stripLeadingZeros } from "@/lib/input-formatters";

export function StockTransferPage() {
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDetail[]>([]);
  const [outlets, setOutlets] = useState<MenuOutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "requested" | "approved" | "sent" | "received" | "cancelled"
  >("all");

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [originOutletId, setOriginOutletId] = useState("");
  const [destinationOutletId, setDestinationOutletId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  // Dynamic transfer items
  const [transferItems, setTransferItems] = useState<
    {
      inventory_item_id: string;
      item_name: string;
      quantity: number;
      unit: string;
    }[]
  >([]);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferRecord | null>(null);
  const [updatingTransferId, setUpdatingTransferId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      await resolveAuthenticatedUser().catch(() => null);
      const [trfs, itms, outls] = await Promise.all([
        getStockTransfers(),
        getInventoryItems(),
        getBusinessOutlets(),
      ]);
      const activeOutls = (outls || []).filter((o) => !isOutletDeletedOrArchived(o));
      const activeOutletIds = new Set(activeOutls.map((o) => o.id));
      const activeItms =
        activeOutletIds.size > 0
          ? (itms || []).filter((i) => !i.outlet_id || activeOutletIds.has(i.outlet_id))
          : itms || [];
      setTransfers(trfs);
      setInventoryItems(activeItms);
      setOutlets(activeOutls);

      if (activeOutls.length >= 2 && activeOutls[0] && activeOutls[1]) {
        const nextOrigin =
          originOutletId && activeOutletIds.has(originOutletId)
            ? originOutletId
            : activeOutls[0].id;
        const nextDest =
          destinationOutletId &&
          activeOutletIds.has(destinationOutletId) &&
          destinationOutletId !== nextOrigin
            ? destinationOutletId
            : activeOutls.find((o) => o.id !== nextOrigin)?.id || "";
        setOriginOutletId(nextOrigin);
        setDestinationOutletId(nextDest);
      } else if (activeOutls.length === 1 && activeOutls[0]) {
        setOriginOutletId(activeOutls[0].id);
        setDestinationOutletId("");
      } else {
        setOriginOutletId("");
        setDestinationOutletId("");
      }
    } catch (err: any) {
      toast.error("Gagal memuat transfer stok", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const handleSync = () => {
      loadData();
    };
    window.addEventListener("inventory:updated", handleSync);
    window.addEventListener("app:snapshot-ready", handleSync);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        loadData();
      }
    });
    return () => {
      window.removeEventListener("inventory:updated", handleSync);
      window.removeEventListener("app:snapshot-ready", handleSync);
      subscription.unsubscribe();
    };
  }, []);

  // Exclude selected origin outlet from destination dropdown so transfer to same branch is impossible
  const destinationOutlets = useMemo(
    () => outlets.filter((o) => o.id !== originOutletId),
    [outlets, originOutletId],
  );

  // Filter raw materials strictly by origin outlet (actual sender stock, zero identical duplicates)
  function getItemsForOriginOutlet(targetOriginId: string): InventoryItemDetail[] {
    const exactMatch = targetOriginId
      ? inventoryItems.filter((i) => i.outlet_id === targetOriginId)
      : [];
    const fallbackMatch =
      exactMatch.length > 0
        ? exactMatch
        : inventoryItems.filter((i) => !i.outlet_id);
    const source = fallbackMatch.length > 0 ? fallbackMatch : inventoryItems;

    const dedup = new Map<string, InventoryItemDetail>();
    for (const it of source) {
      const key = (it.name || "").trim().toLowerCase() || it.id;
      const existing = dedup.get(key);
      if (!existing) {
        dedup.set(key, it);
      } else if (
        targetOriginId &&
        it.outlet_id === targetOriginId &&
        existing.outlet_id !== targetOriginId
      ) {
        dedup.set(key, it);
      }
    }
    return Array.from(dedup.values());
  }

  const originOutletItems = useMemo(
    () => getItemsForOriginOutlet(originOutletId),
    [inventoryItems, originOutletId],
  );

  function handleOriginOutletChange(nextOriginId: string) {
    setOriginOutletId(nextOriginId);
    // Ensure destination outlet is never the same as origin outlet
    if (!destinationOutletId || destinationOutletId === nextOriginId) {
      const nextDest = outlets.find((o) => o.id !== nextOriginId)?.id || "";
      setDestinationOutletId(nextDest);
    }
    // Re-sync line items to sender branch's stock items
    const nextItems = getItemsForOriginOutlet(nextOriginId);
    if (nextItems.length === 0) {
      setTransferItems([]);
      return;
    }
    setTransferItems((prev) => {
      if (prev.length === 0) {
        const first = nextItems[0]!;
        return [
          {
            inventory_item_id: first.id,
            item_name: first.name,
            quantity: 5,
            unit: first.unit,
          },
        ];
      }
      return prev.map((row) => {
        const sameId = nextItems.find((i) => i.id === row.inventory_item_id);
        const sameName = nextItems.find(
          (i) => i.name.trim().toLowerCase() === row.item_name.trim().toLowerCase(),
        );
        const target = sameId || sameName || nextItems[0]!;
        return {
          ...row,
          inventory_item_id: target.id,
          item_name: target.name,
          unit: target.unit,
        };
      });
    });
  }

  function handleOpenCreateModal() {
    if (inventoryItems.length === 0) {
      toast.error("Belum ada bahan baku di inventori untuk ditransfer.");
      return;
    }

    const initialOriginId = originOutletId || outlets[0]?.id || "";
    const initialDestId =
      destinationOutletId && destinationOutletId !== initialOriginId
        ? destinationOutletId
        : outlets.find((o) => o.id !== initialOriginId)?.id || "";
    setOriginOutletId(initialOriginId);
    setDestinationOutletId(initialDestId);

    if (outlets.length < 2) {
      toast.warning("Hanya ada 1 outlet aktif terdaftar.", {
        description:
          "Tambahkan cabang lain di Manajemen Outlet terlebih dahulu untuk melakukan transfer antar cabang.",
      });
    }

    setTransferNotes("");
    const scopedItems = getItemsForOriginOutlet(initialOriginId);
    const firstItem = scopedItems[0];
    if (firstItem) {
      setTransferItems([
        {
          inventory_item_id: firstItem.id,
          item_name: firstItem.name,
          quantity: 5,
          unit: firstItem.unit,
        },
      ]);
    } else {
      setTransferItems([]);
    }
    setCreateModalOpen(true);
  }

  function handleAddLineItem() {
    const defaultItem = originOutletItems[0];
    if (!defaultItem) return;
    setTransferItems((prev) => [
      ...prev,
      {
        inventory_item_id: defaultItem.id,
        item_name: defaultItem.name,
        quantity: 5,
        unit: defaultItem.unit,
      },
    ]);
  }

  function handleRemoveLineItem(index: number) {
    setTransferItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleItemChange(index: number, field: string, value: any) {
    setTransferItems((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      if (field === "inventory_item_id") {
        const found =
          originOutletItems.find((i) => i.id === value) ||
          inventoryItems.find((i) => i.id === value);
        if (found) {
          copy[index] = {
            ...cur,
            inventory_item_id: found.id,
            item_name: found.name,
            unit: found.unit,
          };
        }
      } else {
        copy[index] = {
          ...cur,
          [field]: value,
        };
      }
      return copy;
    });
  }

  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (transferItems.length === 0) {
      toast.error("Tambahkan minimal 1 item untuk ditransfer");
      return;
    }
    if (!destinationOutletId || originOutletId === destinationOutletId) {
      toast.error("Outlet tujuan harus berbeda dengan outlet asal", {
        description:
          "Pilih cabang tujuan yang berbeda atau tambahkan cabang baru di Manajemen Outlet.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const origin = outlets.find((o) => o.id === originOutletId);
      const dest = outlets.find((o) => o.id === destinationOutletId);

      const itemsPayload: StockTransferItemDetail[] = transferItems.map((ti) => ({
        inventory_item_id: ti.inventory_item_id,
        item_name: ti.item_name,
        quantity: Number(ti.quantity) || 0,
        unit: ti.unit,
      }));

      await createStockTransfer({
        origin_outlet_id: originOutletId || undefined,
        origin_outlet_name: origin?.name || "Gudang Utama",
        destination_outlet_id: destinationOutletId || undefined,
        destination_outlet_name: dest?.name || "Outlet Cabang",
        status: "requested",
        notes: transferNotes,
        items: itemsPayload,
      });

      toast.success("Permintaan transfer stok berhasil diajukan!");
      setCreateModalOpen(false);
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("inventory:updated"));
      }
    } catch (err: any) {
      toast.error("Gagal membuat transfer", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    transfer: StockTransferRecord,
    nextStatus: "approved" | "sent" | "received" | "cancelled",
  ) {
    if (updatingTransferId) return;
    setUpdatingTransferId(transfer.id);
    try {
      await updateStockTransferStatus(transfer.id, nextStatus);
      if (nextStatus === "sent") {
        toast.success(`Barang ${transfer.transfer_number} sedang dalam perjalanan kirim!`);
      } else if (nextStatus === "received") {
        toast.success(`Barang ${transfer.transfer_number} berhasil diterima oleh outlet tujuan!`);
      } else if (nextStatus === "approved") {
        toast.success(`Transfer ${transfer.transfer_number} disetujui!`);
      } else {
        toast.success(`Status transfer berhasil diubah menjadi ${nextStatus}`);
      }
      await loadData();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("inventory:updated"));
      }
    } catch (err: any) {
      toast.error("Gagal mengubah status transfer", { description: err.message });
    } finally {
      setUpdatingTransferId(null);
    }
  }

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const matchSearch =
        t.transfer_number.toLowerCase().includes(search.toLowerCase()) ||
        (t.origin_outlet_name &&
          t.origin_outlet_name.toLowerCase().includes(search.toLowerCase())) ||
        (t.destination_outlet_name &&
          t.destination_outlet_name.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [transfers, search, statusFilter]);

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <ArrowLeftRight className="size-4" />
            <span>Distribusi Antar Cabang</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Transfer Stok Antar Outlet
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kirim bahan baku dari gudang pusat ke cabang atau antar cabang outlet secara terpusat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-2xl gap-2 font-semibold"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={handleOpenCreateModal}
            className="rounded-2xl gap-2 font-bold shadow-brand"
          >
            <Plus className="size-4" />
            <span>Buat Transfer Stok</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Dokumen Transfer</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowLeftRight className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{transfers.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Seluruh pergerakan transfer</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Dalam Pengiriman</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/75">
              <Truck className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-foreground/75">
            {transfers.filter((t) => t.status === "sent").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Barang sedang dalam perjalanan</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Selesai Diterima</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {transfers.filter((t) => t.status === "received").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Berhasil sampai di cabang tujuan</p>
        </div>
      </div>

      {/* 3. Controls & Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari No. Transfer, Outlet asal / tujuan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-2xl h-11"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "Semua" },
              { key: "requested", label: "Diajukan" },
              { key: "approved", label: "Disetujui" },
              { key: "sent", label: "Dikirim" },
              { key: "received", label: "Diterima" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === tab.key
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs sm:text-sm">
              <thead className="bg-muted border-b border-border text-muted-foreground uppercase text-xs sm:text-xs tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 font-bold">No. Transfer</th>
                  <th className="py-2.5 px-3 font-bold">Outlet Asal</th>
                  <th className="py-2.5 px-3 font-bold text-center">Arah</th>
                  <th className="py-2.5 px-3 font-bold">Outlet Tujuan</th>
                  <th className="py-2.5 px-3 font-bold text-center">Jumlah Item</th>
                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  <th className="sticky right-0 z-20 bg-muted border-l border-border shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] py-2.5 px-3 font-bold text-right whitespace-nowrap">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                      <span>Memuat riwayat transfer...</span>
                    </td>
                  </tr>
                ) : filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <ArrowLeftRight className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                      <p className="font-bold">Tidak ada catatan transfer stok</p>
                      <p className="text-xs mt-1">
                        Buat transfer stok baru untuk mendistribusikan bahan.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">{t.transfer_number}</td>
                      <td className="py-2.5 px-3 font-medium">
                        {t.origin_outlet_name || (outlets.find((o) => o.id === t.origin_outlet_id)?.name) || "Gudang Utama"}
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground">
                        <ArrowRight className="inline-block size-3.5 text-primary" />
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {t.destination_outlet_name || (outlets.find((o) => o.id === t.destination_outlet_id)?.name) || "Outlet Cabang"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {t.items && t.items.length > 0 ? (
                          <div>
                            <span className="font-black text-foreground">{t.items.length} item</span>
                            <span className="block text-xs text-muted-foreground font-normal max-w-[150px] truncate mx-auto">
                              {t.items.map((it) => `${it.quantity} ${it.unit || ""} ${it.item_name}`).join(", ")}
                            </span>
                          </div>
                        ) : (
                          "0 item"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {t.status === "received" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Diterima
                          </span>
                        ) : t.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-foreground/75">
                            <Truck className="size-3" />
                            Dalam Pengiriman
                          </span>
                        ) : t.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                            Diajukan
                          </span>
                        )}
                      </td>
                      <td className="sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)] border-l border-border z-10 py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === "requested" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingTransferId === t.id}
                                onClick={() => handleStatusChange(t, "approved")}
                                className="h-8 px-2.5 text-xs font-bold rounded-xl text-primary border-primary/30"
                              >
                                <span>Setujui</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="hero"
                                disabled={updatingTransferId === t.id}
                                onClick={() => handleStatusChange(t, "received")}
                                className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 shadow-brand"
                              >
                                <PackageCheck className="size-3.5" />
                                <span>Setujui & Terima</span>
                              </Button>
                            </>
                          )}

                          {t.status === "approved" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingTransferId === t.id}
                                onClick={() => handleStatusChange(t, "sent")}
                                className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 text-foreground/75 border-border"
                              >
                                <Truck className="size-3" />
                                <span>Kirim</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="hero"
                                disabled={updatingTransferId === t.id}
                                onClick={() => handleStatusChange(t, "received")}
                                className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 shadow-brand"
                              >
                                <PackageCheck className="size-3.5" />
                                <span>Konfirmasi Terima</span>
                              </Button>
                            </>
                          )}

                          {t.status === "sent" && (
                            <Button
                              size="sm"
                              variant="hero"
                              disabled={updatingTransferId === t.id}
                              onClick={() => handleStatusChange(t, "received")}
                              className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 shadow-brand"
                            >
                              <PackageCheck className="size-3.5" />
                              <span>Konfirmasi Terima</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTransfer(t);
                              setDetailModalOpen(true);
                            }}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: Buat Transfer Baru */}
      {createModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="relative z-[9999] flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[2rem] border border-border bg-white dark:bg-slate-900 opacity-100 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border p-5 bg-muted shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ArrowLeftRight className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Formulir Transfer Stok</h3>
                  <p className="text-xs text-muted-foreground">
                    Distribusi bahan baku antar outlet / gudang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="flex-1 flex flex-col overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 border-b border-border bg-card">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Outlet Asal *</label>
                  <select
                    value={originOutletId}
                    onChange={(e) => handleOriginOutletChange(e.target.value)}
                    aria-label="Outlet asal transfer stok"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">Outlet Tujuan *</label>
                  <select
                    value={destinationOutletId}
                    onChange={(e) => setDestinationOutletId(e.target.value)}
                    aria-label="Outlet tujuan transfer stok"
                    required
                    disabled={destinationOutlets.length === 0}
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                  >
                    {destinationOutlets.length === 0 ? (
                      <option value="">
                        -- Belum ada cabang tujuan lain (Minimal 2 cabang aktif) --
                      </option>
                    ) : (
                      destinationOutlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Item Bahan Baku yang Dikirim
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLineItem}
                    className="rounded-xl h-8 px-3 text-xs font-bold gap-1 text-primary border-primary/30"
                  >
                    <Plus className="size-3.5" />
                    <span>Tambah Baris</span>
                  </Button>
                </div>

                <div className="rounded-2xl border border-border overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="bg-muted border-b border-border text-muted-foreground font-bold uppercase text-xs">
                      <tr>
                        <th className="py-2.5 px-3">Bahan Baku</th>
                        <th className="py-2.5 px-3 w-32 text-right">Kuantitas</th>
                        <th className="py-2.5 px-3 w-24">Satuan</th>
                        <th className="sticky right-0 z-20 bg-muted border-l border-border shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] py-2.5 px-3 w-12 text-center">
                          Hapus
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transferItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="py-2 px-3">
                            <select
                              value={item.inventory_item_id}
                              onChange={(e) =>
                                handleItemChange(idx, "inventory_item_id", e.target.value)
                              }
                              aria-label={`Bahan baku transfer baris ${idx + 1}`}
                              className="w-full rounded-xl border border-input bg-background p-2 text-xs font-medium focus-visible:outline-none"
                            >
                              {originOutletItems.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} (Tersedia: {inv.stock} {inv.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity > 0 ? stripLeadingZeros(item.quantity) : ""}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "quantity",
                                  sanitizeQuantityInput(e.target.value),
                                )
                              }
                              placeholder="1"
                              className="h-8 text-right rounded-xl font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-muted-foreground">
                            {item.unit}
                          </td>
                          <td className="sticky right-0 bg-card shadow-[-4px_0_8px_rgba(0,0,0,0.04)] py-2 px-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={transferItems.length <= 1}
                              onClick={() => handleRemoveLineItem(idx)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 rounded-lg"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Catatan / Surat Jalan
                  </label>
                  <Input
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Keterangan kurir, plat nomor kendaraan, atau instruksi handling..."
                    className="mt-1 rounded-2xl"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 bg-muted/20 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand gap-2"
                >
                  <Send className="size-4" />
                  <span>Ajukan Transfer Stok</span>
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: Detail Transfer */}
      {detailModalOpen &&
        selectedTransfer &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="relative z-[9999] flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[2rem] border border-border bg-white dark:bg-slate-900 opacity-100 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black">{selectedTransfer.transfer_number}</h3>
                <p className="text-xs text-muted-foreground">
                  Dari: {selectedTransfer.origin_outlet_name || "Pusat"} &rarr; Ke:{" "}
                  {selectedTransfer.destination_outlet_name || "Cabang"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase text-xs">
                  <tr>
                    <th className="py-2 px-3">Bahan Baku</th>
                    <th className="py-2 px-3 text-right">Kuantitas</th>
                    <th className="py-2 px-3">Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedTransfer.items?.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-semibold">{item.item_name}</td>
                      <td className="py-2.5 px-3 text-right font-black">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedTransfer.notes && (
                <div className="rounded-xl border border-border p-3 text-xs">
                  <span className="font-bold text-muted-foreground">Catatan:</span>
                  <p className="mt-0.5">{selectedTransfer.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDetailModalOpen(false)}
                className="rounded-2xl"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
