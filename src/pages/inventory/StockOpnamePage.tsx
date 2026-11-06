import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  Eye,
  Store,
  Calendar,
  User,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getInventoryItems,
  getStockOpnames,
  createStockOpname,
  type InventoryItemDetail,
  type StockOpnameRecord,
  type StockOpnameItemDetail,
} from "@/services/inventory.service";
import { getBusinessOutlets, type MenuOutletInfo } from "@/services/menu.service";

export function StockOpnamePage() {
  const [opnames, setOpnames] = useState<StockOpnameRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDetail[]>([]);
  const [outlets, setOutlets] = useState<MenuOutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New Opname Modal
  const [newOpnameModal, setNewOpnameModal] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [opnameDate, setOpnameDate] = useState("");
  const [opnameNotes, setOpnameNotes] = useState("");
  const [conductorName, setConductorName] = useState("");
  const [auditItems, setAuditItems] = useState<
    {
      item_id: string;
      item_name: string;
      unit: string;
      system_stock: number;
      physical_stock: number;
      notes: string;
    }[]
  >([]);

  // View Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<StockOpnameRecord | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [opn, itm, outl] = await Promise.all([
        getStockOpnames(),
        getInventoryItems(),
        getBusinessOutlets(),
      ]);
      setOpnames(opn);
      setInventoryItems(itm);
      setOutlets(outl);
      if (outl.length > 0 && !selectedOutletId && outl[0]) {
        setSelectedOutletId(outl[0].id);
      }
    } catch (err: any) {
      toast.error("Gagal memuat data stock opname", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleStartNewOpname() {
    if (inventoryItems.length === 0) {
      toast.error("Belum ada bahan baku di inventori untuk di-opname.");
      return;
    }

    setAuditItems(
      inventoryItems.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        system_stock: item.stock,
        physical_stock: item.stock, // Default to system stock
        notes: "",
      })),
    );
    setOpnameDate(new Date().toISOString().split("T")[0] ?? "");
    setOpnameNotes("");
    setConductorName("Staff Audit");
    setNewOpnameModal(true);
  }

  function handleUpdateAuditPhysical(index: number, val: number) {
    setAuditItems((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      copy[index] = { ...cur, physical_stock: val };
      return copy;
    });
  }

  function handleUpdateAuditNotes(index: number, val: string) {
    setAuditItems((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      copy[index] = { ...cur, notes: val };
      return copy;
    });
  }

  // Summary of differences in new opname
  const totalAuditItems = auditItems.length;
  const itemsWithDifference = useMemo(() => {
    return auditItems.filter((i) => i.physical_stock !== i.system_stock).length;
  }, [auditItems]);

  async function handleSaveOpname(status: "draft" | "approved") {
    setSubmitting(true);
    try {
      const targetOutlet = outlets.find((o) => o.id === selectedOutletId);
      const itemsPayload: StockOpnameItemDetail[] = auditItems.map((ai) => ({
        inventory_item_id: ai.item_id,
        item_name: ai.item_name,
        system_stock: ai.system_stock,
        physical_stock: Number(ai.physical_stock) || 0,
        difference: (Number(ai.physical_stock) || 0) - ai.system_stock,
        unit: ai.unit,
        notes: ai.notes || undefined,
      }));

      await createStockOpname({
        outlet_id: selectedOutletId || undefined,
        outlet_name: targetOutlet?.name,
        date: opnameDate,
        status,
        notes: opnameNotes,
        conducted_by: conductorName,
        items: itemsPayload,
      });

      if (status === "approved") {
        toast.success("Stock Opname berhasil disetujui & stok fisik telah disinkronkan!");
      } else {
        toast.success("Draft Stock Opname berhasil disimpan!");
      }

      setNewOpnameModal(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menyimpan stock opname", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <ClipboardList className="size-4" />
            <span>Audit & Rekonsiliasi Inventori</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Stock Opname</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Lakukan audit fisik periodik, hitung selisih stok, dan sesuaikan ke sistem.
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
            onClick={handleStartNewOpname}
            className="rounded-2xl gap-2 font-bold shadow-brand"
          >
            <Plus className="size-4" />
            <span>Mulai Stock Opname</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Sesi Opname</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{opnames.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Riwayat opname tercatat</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Selesai & Disetujui</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {opnames.filter((o) => o.status === "approved").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Stok sistem tersinkronisasi</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Draft Menunggu Approval</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600">
            {opnames.filter((o) => o.status === "draft").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Perlu review supervisor</p>
        </div>
      </div>

      {/* 3. Table of Opname Sessions */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Daftar Sesi Stock Opname</h2>
        <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">No. Opname</th>
                  <th className="py-3.5 px-4 font-bold">Tanggal</th>
                  <th className="py-3.5 px-4 font-bold">Outlet</th>
                  <th className="py-3.5 px-4 font-bold text-center">Jumlah Item</th>
                  <th className="py-3.5 px-4 font-bold">Auditor</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                      <span>Memuat riwayat stock opname...</span>
                    </td>
                  </tr>
                ) : opnames.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <ClipboardList className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                      <p className="font-bold">Belum ada sesi Stock Opname</p>
                      <p className="text-xs mt-1">
                        Klik tombol "Mulai Stock Opname" di atas untuk audit fisik perdana.
                      </p>
                    </td>
                  </tr>
                ) : (
                  opnames.map((op) => (
                    <tr key={op.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 font-bold text-foreground">{op.opname_number}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(op.date).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {op.outlet_name || "Semua Outlet"}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        {op.items?.length || 0} bahan
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {op.conducted_by || "Admin"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {op.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600">
                            <Clock className="size-3" />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOpname(op);
                            setDetailModalOpen(true);
                          }}
                          className="rounded-xl h-8 px-2.5 gap-1.5 text-xs text-primary hover:bg-primary/10"
                        >
                          <Eye className="size-3.5" />
                          <span>Detail</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: Sesi Stock Opname Baru (Full Checklist) */}
      {newOpnameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-[2rem] border border-border bg-card shadow-float overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Audit Stock Opname Baru</h3>
                  <p className="text-xs text-muted-foreground">
                    Hitung fisik seluruh bahan baku di outlet dan masukkan jumlah riil.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewOpnameModal(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Config bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 border-b border-border bg-card">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Outlet Target *</label>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  aria-label="Pilih outlet target opname"
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
                <label className="text-xs font-bold text-muted-foreground">Tanggal Audit *</label>
                <Input
                  type="date"
                  value={opnameDate}
                  onChange={(e) => setOpnameDate(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Auditor / Petugas</label>
                <Input
                  value={conductorName}
                  onChange={(e) => setConductorName(e.target.value)}
                  placeholder="Nama staf pemeriksa"
                  className="mt-1 rounded-2xl"
                />
              </div>
            </div>

            {/* Table of items to count */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Daftar {totalAuditItems} bahan baku aktif</span>
                <span className="font-bold text-amber-600">
                  {itemsWithDifference} bahan terdeteksi selisih
                </span>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Nama Bahan</th>
                      <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                      <th className="py-2.5 px-3 text-right w-36">Stok Fisik Aktual</th>
                      <th className="py-2.5 px-3 text-right">Selisih</th>
                      <th className="py-2.5 px-3 w-48">Catatan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditItems.map((item, idx) => {
                      const diff = (Number(item.physical_stock) || 0) - item.system_stock;
                      return (
                        <tr key={item.item_id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-semibold text-foreground">
                            {item.item_name}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground font-medium">
                            {item.system_stock} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                value={item.physical_stock}
                                onChange={(e) =>
                                  handleUpdateAuditPhysical(idx, Number(e.target.value))
                                }
                                className="h-8 w-24 text-right rounded-xl font-black text-xs"
                              />
                              <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black">
                            <span
                              className={
                                diff === 0
                                  ? "text-muted-foreground"
                                  : diff > 0
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Input
                              value={item.notes}
                              onChange={(e) => handleUpdateAuditNotes(idx, e.target.value)}
                              placeholder="Keterangan..."
                              className="h-8 text-xs rounded-xl"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Catatan:</span> Tombol "Selesaikan &
                Sinkronkan" akan langsung meng-update stok database ke angka fisik.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleSaveOpname("draft")}
                  className="rounded-2xl"
                >
                  Simpan Draft
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  disabled={submitting}
                  onClick={() => handleSaveOpname("approved")}
                  className="rounded-2xl font-bold shadow-brand gap-2"
                >
                  <Check className="size-4" />
                  <span>Selesaikan & Sinkronkan</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail Opname Record */}
      {detailModalOpen && selectedOpname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-border bg-card p-6 shadow-float overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black">Detail Stock Opname</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedOpname.opname_number} • {selectedOpname.outlet_name || "Outlet"} •{" "}
                  {selectedOpname.date}
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
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Bahan Baku</th>
                    <th className="py-2 px-3 text-right">Stok Sistem</th>
                    <th className="py-2 px-3 text-right">Stok Fisik</th>
                    <th className="py-2 px-3 text-right">Selisih</th>
                    <th className="py-2 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedOpname.items?.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-semibold">{item.item_name}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {item.system_stock} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        {item.physical_stock} {item.unit}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-black ${
                          item.difference === 0
                            ? "text-muted-foreground"
                            : item.difference > 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                        }`}
                      >
                        {item.difference > 0 ? `+${item.difference}` : item.difference} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {item.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        </div>
      )}
    </div>
  );
}
