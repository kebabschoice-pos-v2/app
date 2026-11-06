import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Check,
  PackageCheck,
  XCircle,
  Truck,
  RefreshCw,
  Eye,
  Trash2,
  Store,
  DollarSign,
  X,
  Send,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePOStatus,
  getSuppliers,
  getInventoryItems,
  type PurchaseOrderRecord,
  type PurchaseOrderItem,
  type SupplierItem,
  type InventoryItemDetail,
} from "@/services/inventory.service";
import { getBusinessOutlets, type MenuOutletInfo } from "@/services/menu.service";

export function PurchaseOrderPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemDetail[]>([]);
  const [outlets, setOutlets] = useState<MenuOutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Status Filter & Search
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "pending" | "approved" | "received" | "cancelled"
  >("all");
  const [search, setSearch] = useState("");

  // Create PO Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");

  // Dynamic PO Items
  const [poItems, setPoItems] = useState<
    {
      inventory_item_id: string;
      item_name: string;
      unit: string;
      quantity: number;
      unit_cost: number;
    }[]
  >([]);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRecord | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [pos, supps, itms, outls] = await Promise.all([
        getPurchaseOrders(),
        getSuppliers(),
        getInventoryItems(),
        getBusinessOutlets(),
      ]);
      setPurchaseOrders(pos);
      setSuppliers(supps);
      setInventoryItems(itms);
      setOutlets(outls);
      if (outls.length > 0 && !selectedOutletId && outls[0]) {
        setSelectedOutletId(outls[0].id);
      }
    } catch (err: any) {
      toast.error("Gagal memuat Purchase Orders", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreateModal() {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    setPoNumber(`PO-${dateCode}-${randomSuffix}`);
    setSelectedSupplierId(suppliers[0]?.id || "");
    setSelectedOutletId(outlets[0]?.id || "");
    setOrderDate(new Date().toISOString().split("T")[0] ?? "");
    setExpectedDate("");
    setPoNotes("");

    // Initialize with 1 item row if available
    const firstItem = inventoryItems[0];
    if (firstItem) {
      setPoItems([
        {
          inventory_item_id: firstItem.id,
          item_name: firstItem.name,
          unit: firstItem.unit,
          quantity: 10,
          unit_cost: firstItem.cost_price || 0,
        },
      ]);
    } else {
      setPoItems([]);
    }

    setCreateModalOpen(true);
  }

  function handleAddLineItem() {
    const defaultItem = inventoryItems[0];
    if (!defaultItem) return;
    setPoItems((prev) => [
      ...prev,
      {
        inventory_item_id: defaultItem.id,
        item_name: defaultItem.name,
        unit: defaultItem.unit,
        quantity: 5,
        unit_cost: defaultItem.cost_price || 0,
      },
    ]);
  }

  function handleRemoveLineItem(index: number) {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleLineItemChange(index: number, field: string, value: any) {
    setPoItems((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      if (field === "inventory_item_id") {
        const found = inventoryItems.find((i) => i.id === value);
        if (found) {
          copy[index] = {
            ...cur,
            inventory_item_id: found.id,
            item_name: found.name,
            unit: found.unit,
            unit_cost: found.cost_price || 0,
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

  const calculatedTotalAmount = useMemo(() => {
    return poItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0),
      0,
    );
  }, [poItems]);

  async function handleSavePO(initialStatus: "draft" | "pending") {
    if (poItems.length === 0) {
      toast.error("Tambahkan minimal 1 item pembelian");
      return;
    }

    setSubmitting(true);
    try {
      const supp = suppliers.find((s) => s.id === selectedSupplierId);
      const outl = outlets.find((o) => o.id === selectedOutletId);

      const itemsPayload: PurchaseOrderItem[] = poItems.map((p) => ({
        inventory_item_id: p.inventory_item_id,
        item_name: p.item_name,
        quantity: Number(p.quantity) || 0,
        unit: p.unit,
        unit_cost: Number(p.unit_cost) || 0,
        subtotal: (Number(p.quantity) || 0) * (Number(p.unit_cost) || 0),
      }));

      await createPurchaseOrder({
        supplier_id: selectedSupplierId || undefined,
        supplier_name: supp?.name,
        outlet_id: selectedOutletId || undefined,
        outlet_name: outl?.name,
        order_date: orderDate,
        expected_delivery_date: expectedDate || undefined,
        status: initialStatus,
        notes: poNotes,
        items: itemsPayload,
      });

      toast.success(
        initialStatus === "pending"
          ? "Purchase Order berhasil diajukan untuk approval!"
          : "Draft Purchase Order berhasil disimpan!",
      );

      setCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal membuat PO", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    po: PurchaseOrderRecord,
    nextStatus: "pending" | "approved" | "received" | "cancelled",
  ) {
    if (nextStatus === "received") {
      if (
        !confirm(
          `Terima barang untuk ${po.po_number}? Seluruh item dalam PO ini akan otomatis ditambahkan ke stok inventori.`,
        )
      ) {
        return;
      }
    }

    try {
      await updatePOStatus(po.id, nextStatus);
      if (nextStatus === "received") {
        toast.success(`Barang PO ${po.po_number} berhasil diterima & stok inventori bertambah!`);
      } else if (nextStatus === "approved") {
        toast.success(`PO ${po.po_number} berhasil disetujui!`);
      } else if (nextStatus === "cancelled") {
        toast.success(`PO ${po.po_number} telah dibatalkan.`);
      } else {
        toast.success(`Status PO diperbarui menjadi ${nextStatus}`);
      }
      await loadData();
    } catch (err: any) {
      toast.error("Gagal mengubah status PO", { description: err.message });
    }
  }

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchSearch =
        po.po_number.toLowerCase().includes(search.toLowerCase()) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(search.toLowerCase())) ||
        (po.outlet_name && po.outlet_name.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || po.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [purchaseOrders, search, statusFilter]);

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <FileText className="size-4" />
            <span>Pengadaan & Pembelian Bahan Baku</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Purchase Order (PO)</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Alur pengadaan bahan: Pembuatan draft, persetujuan supervisor, hingga penerimaan ke
            stok.
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
            <span>Buat PO Baru</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <p className="text-xs font-semibold text-muted-foreground">Total PO Diterbitkan</p>
          <p className="mt-3 text-2xl font-black">{purchaseOrders.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Seluruh status PO</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <p className="text-xs font-semibold text-muted-foreground">Menunggu Persetujuan</p>
          <p className="mt-3 text-2xl font-black text-amber-600">
            {purchaseOrders.filter((p) => p.status === "pending").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Status Pending</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <p className="text-xs font-semibold text-muted-foreground">
            Disetujui (Menunggu Kiriman)
          </p>
          <p className="mt-3 text-2xl font-black text-primary">
            {purchaseOrders.filter((p) => p.status === "approved").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Siap diterima ke stok</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <p className="text-xs font-semibold text-muted-foreground">Selesai Diterima</p>
          <p className="mt-3 text-2xl font-black text-emerald-600">
            {purchaseOrders.filter((p) => p.status === "received").length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Stok otomatis masuk</p>
        </div>
      </div>

      {/* 3. Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "Semua PO" },
          { key: "draft", label: "Draft" },
          { key: "pending", label: "Pending Approval" },
          { key: "approved", label: "Approved" },
          { key: "received", label: "Diterima (Received)" },
          { key: "cancelled", label: "Dibatalkan" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key as any)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground shadow-brand"
                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Controls & Table */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari No. PO, Supplier, Outlet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-2xl h-11"
          />
        </div>

        <div className="rounded-[1.75rem] border border-border bg-card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] sm:text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">No. PO</th>
                  <th className="py-3.5 px-4 font-bold">Supplier</th>
                  <th className="py-3.5 px-4 font-bold">Outlet Tujuan</th>
                  <th className="py-3.5 px-4 font-bold">Tanggal Order</th>
                  <th className="py-3.5 px-4 font-bold text-center">Item</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Nilai</th>
                  <th className="py-3.5 px-4 font-bold text-center">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                      <span>Memuat data Purchase Orders...</span>
                    </td>
                  </tr>
                ) : filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <FileText className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                      <p className="font-bold">Tidak ada Purchase Order</p>
                      <p className="text-xs mt-1">Buat PO baru untuk memulai alur pengadaan.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 font-bold text-foreground">{po.po_number}</td>
                      <td className="py-3.5 px-4 font-medium">{po.supplier_name || "-"}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {po.outlet_name || "Pusat"}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">{po.order_date}</td>
                      <td className="py-3.5 px-4 text-center font-bold">{po.items?.length || 0}</td>
                      <td className="py-3.5 px-4 text-right font-black">
                        {formatRupiah(po.total_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {po.status === "received" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Diterima
                          </span>
                        ) : po.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                            <Check className="size-3" />
                            Disetujui
                          </span>
                        ) : po.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600">
                            <Clock className="size-3" />
                            Pending
                          </span>
                        ) : po.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600">
                            <XCircle className="size-3" />
                            Batal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Contextual Action Buttons */}
                          {po.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(po, "pending")}
                              className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 text-primary border-primary/30"
                            >
                              <Send className="size-3" />
                              <span>Ajukan</span>
                            </Button>
                          )}

                          {po.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(po, "approved")}
                              className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 text-emerald-600 border-emerald-500/30"
                            >
                              <Check className="size-3" />
                              <span>Setujui</span>
                            </Button>
                          )}

                          {po.status === "approved" && (
                            <Button
                              size="sm"
                              variant="hero"
                              onClick={() => handleStatusChange(po, "received")}
                              className="h-8 px-2.5 text-xs font-bold rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 shadow-brand"
                            >
                              <PackageCheck className="size-3.5" />
                              <span>Terima Barang</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPO(po);
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

      {/* MODAL: Buat PO Baru (Dynamic Line Items) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-[2rem] border border-border bg-card shadow-float overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Buat Purchase Order Baru</h3>
                  <p className="text-xs text-muted-foreground">
                    No. Ref: {poNumber} • Formulir Pengadaan Bahan Baku
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

            {/* PO Top Details */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-5 border-b border-border bg-card">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  aria-label="Pilih supplier PO"
                  className="mt-1 w-full rounded-2xl border border-input bg-background p-2.5 text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Outlet Tujuan *</label>
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  aria-label="Pilih outlet tujuan PO"
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
                <label className="text-xs font-bold text-muted-foreground">Tanggal Order *</label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Estimasi Kedatangan
                </label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>
            </div>

            {/* Line items dynamic list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Daftar Bahan Baku Pesanan
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

              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Bahan Baku</th>
                      <th className="py-2.5 px-3 w-28 text-right">Kuantitas</th>
                      <th className="py-2.5 px-3 w-20">Satuan</th>
                      <th className="py-2.5 px-3 w-36 text-right">Harga Satuan (Rp)</th>
                      <th className="py-2.5 px-3 w-36 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 w-12 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {poItems.map((item, idx) => {
                      const lineSubtotal =
                        (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
                      return (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="py-2 px-3">
                            <select
                              value={item.inventory_item_id}
                              onChange={(e) =>
                                handleLineItemChange(idx, "inventory_item_id", e.target.value)
                              }
                              aria-label={`Bahan baku baris ${idx + 1}`}
                              className="w-full rounded-xl border border-input bg-background p-2 text-xs font-medium focus-visible:outline-none"
                            >
                              {inventoryItems.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} (Stok: {inv.stock} {inv.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleLineItemChange(idx, "quantity", Number(e.target.value))
                              }
                              className="h-8 text-right rounded-xl font-bold text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-muted-foreground">
                            {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={item.unit_cost}
                              onChange={(e) =>
                                handleLineItemChange(idx, "unit_cost", Number(e.target.value))
                              }
                              className="h-8 text-right rounded-xl text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-black">
                            {formatRupiah(lineSubtotal)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={poItems.length <= 1}
                              onClick={() => handleRemoveLineItem(idx)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 rounded-lg"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Catatan Tambahan PO
                </label>
                <Input
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Keterangan pengiriman, syarat pembayaran tempo, dsb."
                  className="mt-1 rounded-2xl"
                />
              </div>
            </div>

            {/* Footer with Subtotal & Actions */}
            <div className="border-t border-border p-4 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Total Nilai Pesanan:</span>
                <span className="text-xl font-black text-primary">
                  {formatRupiah(calculatedTotalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleSavePO("draft")}
                  className="rounded-2xl"
                >
                  Simpan Draft
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  disabled={submitting}
                  onClick={() => handleSavePO("pending")}
                  className="rounded-2xl font-bold shadow-brand gap-2"
                >
                  <Send className="size-4" />
                  <span>Ajukan PO Sekarang</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail Purchase Order */}
      {detailModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-border bg-card p-6 shadow-float overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black">{selectedPO.po_number}</h3>
                <p className="text-xs text-muted-foreground">
                  Supplier: {selectedPO.supplier_name || "-"} • Outlet:{" "}
                  {selectedPO.outlet_name || "Pusat"} • Tgl: {selectedPO.order_date}
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

            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary/40 p-3 text-xs text-center">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-bold text-sm uppercase text-foreground mt-0.5">
                    {selectedPO.status}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Nilai</span>
                  <p className="font-black text-sm text-primary mt-0.5">
                    {formatRupiah(selectedPO.total_amount)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimasi Tiba</span>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {selectedPO.expected_delivery_date || "-"}
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Item Pesanan</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Harga Beli</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedPO.items?.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-semibold">{item.item_name}</td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatRupiah(item.unit_cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        {formatRupiah(item.subtotal || item.quantity * item.unit_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedPO.notes && (
                <div className="rounded-xl border border-border p-3 text-xs">
                  <span className="font-bold text-muted-foreground">Catatan:</span>
                  <p className="mt-0.5">{selectedPO.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mt-4 flex items-center justify-between">
              {selectedPO.status === "approved" && (
                <Button
                  size="sm"
                  variant="hero"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleStatusChange(selectedPO, "received");
                  }}
                  className="rounded-2xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-brand"
                >
                  <PackageCheck className="size-4" />
                  <span>Terima Barang Sekarang</span>
                </Button>
              )}
              <div className="ml-auto">
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
        </div>
      )}
    </div>
  );
}
