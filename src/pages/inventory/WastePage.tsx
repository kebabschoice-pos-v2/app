import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Search,
  Filter,
  AlertOctagon,
  RefreshCw,
  TrendingDown,
  DollarSign,
  Calendar,
  Layers,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getWasteRecords,
  recordWaste,
  getInventoryItems,
  type WasteRecordDetail,
  type InventoryItemDetail,
} from "@/services/inventory.service";

const WASTE_REASONS = ["Expired", "Rusak", "Salah produksi", "Tumpah", "Lainnya"];

export function WastePage() {
  const [wasteList, setWasteList] = useState<WasteRecordDetail[]>([]);
  const [items, setItems] = useState<InventoryItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [selectedReason, setSelectedReason] = useState("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteUnitMode, setWasteUnitMode] = useState<"primary" | "recipe">("primary");
  const [wasteReason, setWasteReason] = useState<string>("Expired");
  const [wasteNotes, setWasteNotes] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [wastes, itms] = await Promise.all([getWasteRecords(), getInventoryItems()]);
      setWasteList(wastes);
      setItems(itms);
    } catch (err: any) {
      toast.error("Gagal memuat data waste", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedItemDetail = useMemo(() => {
    return items.find((i) => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const effectivePrimaryQty = useMemo(() => {
    const raw = Number(wasteQty) || 0;
    if (wasteUnitMode === "recipe" && selectedItemDetail?.yield_per_unit && selectedItemDetail.yield_per_unit > 0) {
      return raw / selectedItemDetail.yield_per_unit;
    }
    return raw;
  }, [wasteQty, wasteUnitMode, selectedItemDetail]);

  const estimatedLoss = useMemo(() => {
    if (!selectedItemDetail) return 0;
    return Math.round(effectivePrimaryQty * (selectedItemDetail.cost_price || 0));
  }, [selectedItemDetail, effectivePrimaryQty]);

  // Metrics
  const totalLoss = useMemo(() => {
    return wasteList.reduce((sum, w) => sum + (w.cost_loss || 0), 0);
  }, [wasteList]);

  const topReason = useMemo(() => {
    if (wasteList.length === 0) return "-";
    const counts: Record<string, number> = {};
    wasteList.forEach((w) => {
      counts[w.reason] = (counts[w.reason] || 0) + 1;
    });
    let maxReason = "";
    let maxCount = 0;
    Object.entries(counts).forEach(([r, c]) => {
      if (c > maxCount) {
        maxCount = c;
        maxReason = r;
      }
    });
    return maxReason || "-";
  }, [wasteList]);

  // Filtered List
  const filteredWaste = useMemo(() => {
    return wasteList.filter((w) => {
      const matchSearch =
        w.item_name.toLowerCase().includes(search.toLowerCase()) ||
        (w.notes && w.notes.toLowerCase().includes(search.toLowerCase()));
      const matchReason = selectedReason === "all" || w.reason === selectedReason;
      return matchSearch && matchReason;
    });
  }, [wasteList, search, selectedReason]);

  function handleOpenModal() {
    setSelectedItemId(items[0]?.id || "");
    setWasteQty(1);
    setWasteReason("Expired");
    setWasteNotes("");
    setModalOpen(true);
  }

  async function handleRecordWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }
    if (wasteQty <= 0) {
      toast.error("Kuantitas harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const detailedNote =
        wasteUnitMode === "recipe" && selectedItemDetail?.yield_unit
          ? `${wasteQty} ${selectedItemDetail.yield_unit} (${effectivePrimaryQty.toFixed(4)} ${selectedItemDetail.unit})${wasteNotes ? ` • ${wasteNotes}` : ""}`
          : wasteNotes;

      await recordWaste({
        inventory_item_id: selectedItemId,
        quantity: Number(effectivePrimaryQty),
        reason: wasteReason as any,
        cost_loss: estimatedLoss,
        notes: detailedNote,
      });

      toast.success("Barang terbuang berhasil dicatat & stok dikurangi");
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal mencatat waste", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm mb-1">
            <Trash2 className="size-4" />
            <span>Manajemen Pemborosan & Kerugian Stok</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Barang Terbuang (Waste)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pencatatan bahan kedaluwarsa, rusak, salah produksi, atau tumpah untuk memantau
            kerugian.
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
            onClick={handleOpenModal}
            className="rounded-2xl gap-2 font-bold shadow-brand bg-rose-600 hover:bg-rose-700"
          >
            <Plus className="size-4" />
            <span>Catat Barang Terbuang</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Kerugian</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-600">{formatRupiah(totalLoss)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Akumulasi estimasi cost loss</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Kejadian Waste</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <AlertOctagon className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{wasteList.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Pencatatan barang terbuang</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Penyebab Terbanyak</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingDown className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-foreground">{topReason}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Kategori insiden dominan</p>
        </div>
      </div>

      {/* 3. Controls & Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari bahan atau catatan waste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-2xl h-11"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              aria-label="Filter kategori alasan waste"
              className="h-11 rounded-2xl border border-input bg-background px-3 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Semua Alasan</option>
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Waktu</th>
                  <th className="py-3.5 px-4 font-bold">Nama Bahan</th>
                  <th className="py-3.5 px-4 font-bold">Alasan</th>
                  <th className="py-3.5 px-4 font-bold text-right">Jumlah Terbuang</th>
                  <th className="py-3.5 px-4 font-bold text-right">Estimasi Kerugian</th>
                  <th className="py-3.5 px-4 font-bold">Dicatat Oleh</th>
                  <th className="py-3.5 px-4 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                      <span>Memuat catatan waste...</span>
                    </td>
                  </tr>
                ) : filteredWaste.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Trash2 className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                      <p className="font-bold">Tidak ada catatan barang terbuang</p>
                      <p className="text-xs mt-1">Belum ada laporan kerugian bahan baku.</p>
                    </td>
                  </tr>
                ) : (
                  filteredWaste.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(w.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-foreground">{w.item_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600">
                          {w.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-rose-600">
                        -{w.quantity} {w.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black">
                        {formatRupiah(w.cost_loss)}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {w.created_by || "Staff"}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        {w.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: Catat Barang Terbuang */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <Trash2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Catat Barang Terbuang</h3>
                  <p className="text-xs text-muted-foreground">
                    Dokumentasikan kerugian dan kurangi stok otomatis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Bahan Baku *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                  aria-label="Pilih bahan baku waste"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Pilih bahan baku...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stok: {i.stock} {i.unit} • Modal: {formatRupiah(i.cost_price)}/
                      {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Satuan Terbuang Mode Toggle (Satuan Utama vs Satuan Eceran Resep) */}
              {selectedItemDetail?.yield_per_unit && selectedItemDetail.yield_per_unit > 1 && (
                <div className="rounded-2xl border border-border/80 bg-muted/30 p-2.5 space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Pilihan Satuan Barang Rusak/Waste:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWasteUnitMode("primary")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                        wasteUnitMode === "primary"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      Satuan Utama ({selectedItemDetail.unit})
                    </button>
                    <button
                      type="button"
                      onClick={() => setWasteUnitMode("recipe")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                        wasteUnitMode === "recipe"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      Eceran Resep ({selectedItemDetail.yield_unit || "unit"})
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    💡 1 {selectedItemDetail.unit} = {selectedItemDetail.yield_per_unit} {selectedItemDetail.yield_unit || "unit"}.
                    {wasteUnitMode === "recipe" && ` (${wasteQty} ${selectedItemDetail.yield_unit || "unit"} = -${effectivePrimaryQty.toFixed(4)} ${selectedItemDetail.unit} stok utama)`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Jumlah Terbuang ({wasteUnitMode === "recipe" && selectedItemDetail?.yield_unit ? selectedItemDetail.yield_unit : (selectedItemDetail?.unit || "Unit")}) *
                  </label>
                  <Input
                    type="number"
                    step={wasteUnitMode === "recipe" ? "1" : "0.01"}
                    min="0.001"
                    required
                    value={wasteQty}
                    onChange={(e) => setWasteQty(Number(e.target.value))}
                    className="mt-1 rounded-2xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Alasan Kerugian</label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    aria-label="Alasan kerugian waste"
                    className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {WASTE_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedItemDetail && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs flex items-center justify-between">
                  <span className="text-rose-700 dark:text-rose-300 font-semibold">
                    Estimasi Kerugian Keuangan:
                  </span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400">
                    {formatRupiah(estimatedLoss)}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Keterangan / Catatan Insiden
                </label>
                <Input
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="Contoh: Kemasan sobek saat unboxing, susu basi karena mati lampu..."
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand bg-rose-600 hover:bg-rose-700"
                >
                  {submitting ? "Menyimpan..." : "Catat & Kurangi Stok"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
