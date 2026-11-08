import { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Search,
  Plus,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Store,
  RefreshCw,
  Activity,
  ShoppingCart,
  Trash2,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";
import {
  getInventoryItems,
  getStockMovements,
  type StockMovementRecord,
} from "@/services/inventory.service";

interface OutletInventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  status: "aman" | "menipis" | "kritis";
  yield_per_unit?: number | null;
  yield_unit?: string | null;
}

interface StockRequest {
  id: string;
  itemName: string;
  qty: number;
  unit: string;
  notes: string;
  outletName: string;
  status: "pending" | "approved" | "completed";
  createdAt: string;
}

const STORAGE_STOCK_REQUESTS = "kebabschoicepos_outlet_stock_requests";

export function PosInventoryPage() {
  const [items, setItems] = useState<OutletInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [outletName, setOutletName] = useState("Kebab Pasar Jumat");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Stock Request Modal & State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [requestQty, setRequestQty] = useState("");
  const [requestNotes, setRequestNotes] = useState("");

  // Load from Supabase and local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STOCK_REQUESTS);
      if (saved) {
        setRequests(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error reading saved stock requests:", e);
    }

    loadInventory();

    const handleInvUpdate = () => {
      loadInventory();
    };
    window.addEventListener("inventory:updated", handleInvUpdate);
    return () => window.removeEventListener("inventory:updated", handleInvUpdate);
  }, []);

  async function loadInventory() {
    setLoading(true);
    try {
      // 1. Resolve authoritative staff outlet
      const staffOutlet = await resolveActiveStaffOutlet();
      if (staffOutlet?.outletName) {
        setOutletName(staffOutlet.outletName);
      }

      // 2. Fetch authoritative items using getInventoryItems() (serverless admin + multi-business fallback)
      const allItems = await getInventoryItems();
      const filtered = allItems.filter((item) => {
        if (!staffOutlet?.outletId || staffOutlet.outletId === "default" || staffOutlet.outletId === "all") {
          return true;
        }
        return !item.outlet_id || item.outlet_id === staffOutlet.outletId;
      });

      const mapped: OutletInventoryItem[] = filtered.map((row) => {
        const stock = Number(row.stock) || 0;
        const min = Number(row.minimum_stock) || 10;
        let status: "aman" | "menipis" | "kritis" = "aman";
        if (stock <= min / 2) status = "kritis";
        else if (stock <= min) status = "menipis";

        return {
          id: row.id,
          name: row.name,
          category: row.category || "Bahan Baku",
          unit: row.unit || "unit",
          stock,
          minimum_stock: min,
          status,
          yield_per_unit: (row as any).yield_per_unit,
          yield_unit: (row as any).yield_unit,
        };
      });
      setItems(mapped);

      // 3. Fetch movements for branch daily mutations summary
      const movs = await getStockMovements().catch(() => [] as StockMovementRecord[]);
      setMovements(movs);
    } catch (e) {
      console.error("Failed to load inventory:", e);
    } finally {
      setLoading(false);
    }
  }

  const [movements, setMovements] = useState<StockMovementRecord[]>([]);

  // Daily mutations summary for POS
  const todayMutations = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const todayMovs = movements.filter((m) => {
      const mDate = (m.created_at || "").slice(0, 10);
      return mDate === todayStr;
    });

    const map = new Map<string, {
      itemName: string;
      unit: string;
      yield_per_unit?: number | null;
      yield_unit?: string | null;
      posSale: number;
      waste: number;
      stockIn: number;
    }>();

    for (const m of todayMovs) {
      const itm = items.find((i) => i.id === m.inventory_item_id);
      const name = m.item_name || itm?.name || "Bahan Baku";
      const unit = itm?.unit || "unit";
      if (!map.has(name)) {
        map.set(name, {
          itemName: name,
          unit,
          yield_per_unit: itm?.yield_per_unit,
          yield_unit: itm?.yield_unit,
          posSale: 0,
          waste: 0,
          stockIn: 0,
        });
      }
      const entry = map.get(name)!;
      const mType = (m.movement_type as string) || (m as any).type || "";
      const qty = Math.abs(Number(m.quantity) || 0);
      if (mType === "pos_sale" || mType === "stock_out") entry.posSale += qty;
      else if (mType === "waste") entry.waste += qty;
      else if (mType === "stock_in") entry.stockIn += qty;
    }

    return Array.from(map.values()).filter((e) => e.posSale > 0 || e.waste > 0 || e.stockIn > 0);
  }, [movements, items]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => set.add(item.category));
    return ["all", ...Array.from(set)];
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Handle Submit Stock Request
  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) {
      toast.error("Pilih bahan yang ingin diminta");
      return;
    }

    const qty = Number(requestQty);
    if (!qty || qty <= 0) {
      toast.error("Jumlah permintaan harus lebih dari 0");
      return;
    }

    const newReq: StockRequest = {
      id: `req-${Date.now()}`,
      itemName: item.name,
      qty,
      unit: item.unit,
      notes: requestNotes.trim() || "Permintaan restock reguler kasir",
      outletName,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const updated = [newReq, ...requests];
    setRequests(updated);
    localStorage.setItem(STORAGE_STOCK_REQUESTS, JSON.stringify(updated));

    setIsRequestModalOpen(false);
    setSelectedItemId("");
    setRequestQty("");
    setRequestNotes("");

    toast.success("Permintaan stok berhasil dikirim ke HQ", {
      description: `${item.name} (${qty} ${item.unit})`,
    });
  };

  return (
    <div className="space-y-6 w-full max-w-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Boxes className="size-7 text-primary" />
            Inventory & Stok Outlet (POS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Store className="size-4 text-primary" />
            Cabang: <span className="font-bold text-foreground">{outletName}</span> · Monitoring
            sisa stok kasir real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadInventory}
            className="rounded-xl font-bold gap-2 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Stok
          </Button>

          <Button
            onClick={() => setIsRequestModalOpen(true)}
            size="sm"
            className="rounded-xl font-bold gap-2 text-xs shadow-brand"
          >
            <ArrowRightLeft className="size-3.5" />
            Minta Stok ke HQ
          </Button>
        </div>
      </div>

      {/* Ringkasan Mutasi Hari Ini di POS Cabang */}
      {todayMutations.length > 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card/85 p-4 shadow-soft space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>📊 Ringkasan Mutasi Bahan Hari Ini (Cabang {outletName})</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayMutations.map((m, idx) => {
              const hasYield = m.yield_per_unit && m.yield_per_unit > 0;
              return (
                <div key={idx} className="rounded-xl border border-border bg-background/80 p-2.5 text-xs space-y-1">
                  <p className="font-bold text-foreground truncate">{m.itemName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {m.posSale > 0 && (
                      <span className="text-primary font-bold">
                        Terjual: -{m.posSale.toFixed(2)} {m.unit}
                        {hasYield && ` (-${(m.posSale * m.yield_per_unit!).toLocaleString("id-ID")} ${m.yield_unit})`}
                      </span>
                    )}
                    {m.stockIn > 0 && (
                      <span className="text-emerald-600 font-bold">
                        +Restock: {m.stockIn.toFixed(2)} {m.unit}
                      </span>
                    )}
                    {m.waste > 0 && (
                      <span className="text-rose-600 font-bold">
                        Rusak: -{m.waste.toFixed(2)} {m.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari bahan / kemasan / saus..."
            className="pl-10 rounded-2xl"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-brand"
                  : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
              }`}
            >
              {cat === "all" ? "Semua Kategori" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base text-foreground flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Daftar Persediaan Bahan di Outlet
          </h2>
          <span className="text-xs text-muted-foreground font-semibold">
            {filteredItems.length} bahan terdata
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Boxes className="size-12 mx-auto mb-3 opacity-30 text-primary" />
            <p className="font-bold text-sm text-foreground">Tidak Ada Data Bahan Baku</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== "all"
                ? "Tidak ada bahan baku yang cocok dengan pencarian atau filter kategori."
                : "Belum ada bahan baku di inventaris outlet ini. Tambahkan bahan baku melalui modul Inventory HQ."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 font-bold">Nama Bahan / Item</th>
                  <th className="py-3 font-bold">Kategori</th>
                  <th className="py-3 font-bold text-right">Sisa Stok</th>
                  <th className="py-3 font-bold text-right">Batas Minimum</th>
                  <th className="py-3 font-bold text-center">Status</th>
                  <th className="py-3 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3.5 font-bold text-foreground">{item.name}</td>
                    <td className="py-3.5 text-muted-foreground">{item.category}</td>
                    <td className="py-3.5 text-right font-black text-sm text-foreground">
                      <div>
                        <span>
                          {Number(item.stock % 1 === 0 ? item.stock : item.stock.toFixed(2)).toLocaleString("id-ID")}{" "}
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {item.unit}
                          </span>
                        </span>
                        {Number(item.yield_per_unit) > 0 && item.stock > 0 && (
                          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                            Setara ±{" "}
                            <strong className="text-foreground">
                              {Math.round(item.stock * Number(item.yield_per_unit)).toLocaleString("id-ID")}{" "}
                              {item.yield_unit || "gram"}
                            </strong>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-right text-muted-foreground font-medium">
                      {item.minimum_stock.toLocaleString("id-ID")} {item.unit}
                    </td>
                    <td className="py-3.5 text-center">
                      {item.status === "aman" && (
                        <Badge
                          variant="outline"
                          className="bg-success-soft text-success border-success/30 font-bold text-[10px]"
                        >
                          ● Aman
                        </Badge>
                      )}
                      {item.status === "menipis" && (
                        <Badge
                          variant="outline"
                          className="bg-warning-soft text-warning border-warning/30 font-bold text-[10px]"
                        >
                          ▲ Menipis
                        </Badge>
                      )}
                      {item.status === "kritis" && (
                        <Badge
                          variant="outline"
                          className="bg-destructive/10 text-destructive border-destructive/30 font-bold text-[10px]"
                        >
                          ✕ Kritis
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setIsRequestModalOpen(true);
                        }}
                        className="rounded-lg text-primary hover:text-primary hover:bg-primary/10 text-xs font-bold h-8"
                      >
                        Minta Tambah
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Requests History */}
      {requests.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base text-foreground flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Riwayat Permintaan Stok ke HQ
            </h3>
            <span className="text-xs text-muted-foreground">{requests.length} permintaan</span>
          </div>

          <div className="divide-y divide-border">
            {requests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {req.itemName} ({req.qty} {req.unit})
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {req.notes} · {new Date(req.createdAt).toLocaleDateString("id-ID")}{" "}
                    {new Date(req.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    req.status === "approved"
                      ? "bg-success-soft text-success border-success/30"
                      : "bg-primary/10 text-primary border-primary/30"
                  }`}
                >
                  {req.status === "approved" ? "✓ Disetujui HQ" : "⏳ Menunggu Respon HQ"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STOCK REQUEST MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  Permintaan Stok ke Gudang Pusat
                </h3>
                <p className="text-xs text-muted-foreground">
                  Kirim permohonan pasokan bahan untuk outlet {outletName}.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full size-8 p-0"
                onClick={() => setIsRequestModalOpen(false)}
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-foreground">Pilih Bahan Baku</Label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">-- Pilih Bahan Baku --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Sisa: {i.stock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">
                  Jumlah Kuantitas Diminta
                </Label>
                <Input
                  type="number"
                  value={requestQty}
                  onChange={(e) => setRequestQty(e.target.value)}
                  placeholder="Contoh: 10"
                  className="mt-1 rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Alasan / Catatan Urgent</Label>
                <Input
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Contoh: Stok menipis menjelang shift malam"
                  className="mt-1 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() => setIsRequestModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" className="rounded-xl font-black shadow-brand">
                  Kirim Permintaan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
