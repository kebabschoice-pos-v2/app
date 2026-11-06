import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  FileText,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/components/kebabschoicepos/data";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  type SupplierItem,
  type PurchaseOrderRecord,
} from "@/services/inventory.service";

export function SupplierManagementPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [supps, pos] = await Promise.all([getSuppliers(), getPurchaseOrders()]);
      setSuppliers(supps);
      setPurchaseOrders(pos);
    } catch (err: any) {
      toast.error("Gagal memuat data supplier", { description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search)) ||
        (s.product_category && s.product_category.toLowerCase().includes(search.toLowerCase())) ||
        (s.address && s.address.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [suppliers, search]);

  function handleOpenAdd() {
    setEditingSupplier(null);
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setProductCategory("");
    setNotes("");
    setSupplierModalOpen(true);
  }

  function handleOpenEdit(supplier: SupplierItem) {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setPhone(supplier.phone || "");
    setEmail(supplier.email || "");
    setAddress(supplier.address || "");
    setProductCategory(supplier.product_category || "");
    setNotes(supplier.notes || "");
    setSupplierModalOpen(true);
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama vendor / supplier wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          product_category: productCategory.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Data supplier berhasil diperbarui");
      } else {
        await createSupplier({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          product_category: productCategory.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("Supplier baru berhasil ditambahkan");
      }
      setSupplierModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menyimpan supplier", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSupplier(supplier: SupplierItem) {
    if (!confirm(`Hapus supplier "${supplier.name}"?`)) {
      return;
    }
    try {
      await deleteSupplier(supplier.id);
      toast.success("Supplier berhasil dihapus");
      await loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus supplier", { description: err.message });
    }
  }

  // Associated POs for selected supplier
  const supplierPOs = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchaseOrders.filter((po) => po.supplier_id === selectedSupplier.id);
  }, [purchaseOrders, selectedSupplier]);

  const totalSupplierSpend = useMemo(() => {
    return supplierPOs
      .filter((po) => po.status === "received" || po.status === "approved")
      .reduce((sum, po) => sum + (po.total_amount || 0), 0);
  }, [supplierPOs]);

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
            <Truck className="size-4" />
            <span>Manajemen Vendor & Pengadaan</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Supplier Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola data vendor, kontak supplier, dan riwayat pesanan bahan baku.
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
            onClick={handleOpenAdd}
            className="rounded-2xl gap-2 font-bold shadow-brand"
          >
            <Plus className="size-4" />
            <span>Tambah Supplier</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Vendor Aktif</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">{suppliers.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Supplier terdaftar</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Purchase Orders</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileText className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600">{purchaseOrders.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">PO terbit ke seluruh supplier</p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Total Pembelian Pengadaan</p>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black">
            {formatRupiah(
              purchaseOrders
                .filter((p) => p.status === "received")
                .reduce((s, p) => s + (p.total_amount || 0), 0),
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Nilai barang telah diterima</p>
        </div>
      </div>

      {/* 3. Search & Table */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama supplier, telepon, kategori..."
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
                  <th className="py-3.5 px-4 font-bold">Nama Vendor</th>
                  <th className="py-3.5 px-4 font-bold">Kategori Pasokan</th>
                  <th className="py-3.5 px-4 font-bold">Kontak Telepon</th>
                  <th className="py-3.5 px-4 font-bold">Email</th>
                  <th className="py-3.5 px-4 font-bold">Alamat</th>
                  <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto size-6 animate-spin text-primary mb-2" />
                      <span>Memuat data supplier...</span>
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Truck className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                      <p className="font-bold">Belum ada data supplier</p>
                      <p className="text-xs mt-1">
                        Klik tombol "Tambah Supplier" di atas untuk mendaftarkan mitra vendor Anda.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        <div>
                          <span>{s.name}</span>
                          {s.notes && (
                            <p className="text-[10px] font-normal text-muted-foreground mt-0.5">
                              {s.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {s.product_category || "Umum"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {s.phone ? (
                          <a
                            href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline"
                          >
                            <Phone className="size-3" />
                            <span>{s.phone}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            className="inline-flex items-center gap-1.5 hover:underline"
                          >
                            <Mail className="size-3" />
                            <span>{s.email}</span>
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs max-w-xs truncate">
                        {s.address || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplier(s);
                              setDetailModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-xs text-primary hover:bg-primary/10 rounded-xl"
                          >
                            <span>Riwayat PO</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(s)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteSupplier(s)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                          >
                            <Trash2 className="size-3.5" />
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

      {/* MODAL: Tambah / Edit Supplier */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-float">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Truck className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black">
                    {editingSupplier ? "Edit Data Supplier" : "Tambah Supplier Baru"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Mitra penyedia bahan baku dan perlengkapan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Nama Supplier / Vendor *
                </label>
                <Input
                  required
                  placeholder="Contoh: PT Boga Sarana Mandiri, Toko Plastik Jaya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    No. Telepon / WhatsApp
                  </label>
                  <Input
                    placeholder="08123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 rounded-2xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Kategori Pasokan
                  </label>
                  <Input
                    placeholder="Daging, Saus, Packaging..."
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="mt-1 rounded-2xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Alamat Kantor / Gudang
                </label>
                <Input
                  placeholder="Jl. Raya Pasar No. 12, Jakarta"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Catatan / Rekening Vendor
                </label>
                <Input
                  placeholder="BCA 12345678 a/n PT Boga..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 rounded-2xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSupplierModalOpen(false)}
                  className="rounded-2xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={submitting}
                  className="rounded-2xl font-bold shadow-brand"
                >
                  {submitting ? "Menyimpan..." : "Simpan Supplier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detail Riwayat PO Supplier */}
      {detailModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[2rem] border border-border bg-card p-6 shadow-float overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black">{selectedSupplier.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Riwayat Purchase Order & Pengadaan • Total Transaksi:{" "}
                  {formatRupiah(totalSupplierSpend)}
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
              {supplierPOs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto size-8 text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-sm">Belum ada PO untuk supplier ini</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">No. PO</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Outlet</th>
                      <th className="py-2.5 px-3 text-right">Total Nilai</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {supplierPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 font-bold">{po.po_number}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{po.order_date}</td>
                        <td className="py-2.5 px-3">{po.outlet_name || "Outlet Pusat"}</td>
                        <td className="py-2.5 px-3 text-right font-black">
                          {formatRupiah(po.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
        </div>
      )}
    </div>
  );
}
