import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Printer,
  Search,
  Receipt,
  Store,
  UserRound,
  Clock,
  Share2,
  Download,
  CheckCircle2,
  Calendar,
  CreditCard,
  QrCode,
  DollarSign,
  WalletCards,
  ArrowLeft,
  Bluetooth,
  Usb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { resolveActiveStaffOutlet } from "@/services/outlet.service";
import { getUserRole } from "@/integrations/supabase/role-resolver";
import {
  printReceipt,
  kickCashDrawer,
  subscribePrinterStatus,
  connectBluetoothPrinter,
  connectUsbPrinter,
  disconnectPrinter,
  type ConnectedPrinterInfo,
} from "@/services/thermal-printer.service";

interface ReceiptOrder {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  payment_method: string;
  status: string;
  channel?: string | null;
  customer_id?: string | null;
  outlet_id?: string | null;
  outlet_name?: string;
  cashier_name?: string;
  customer_name?: string;
  cashReceived?: number;
  changeAmount?: number;
  items?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    variant_name?: string | null;
    notes?: string | null;
  }>;
}

export function PosReceiptPage({ snapshot }: { snapshot?: any }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<ReceiptOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Standar (Browser)",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });

  useEffect(() => {
    const unsub = subscribePrinterStatus((info) => setPrinterInfo(info));
    return () => unsub();
  }, []);

  // Load orders and business profile from Supabase & Snapshot
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Fetch business details
        const { data: bus } = await supabase
          .from("businesses")
          .select("id, name, logo, address, phone, city")
          .limit(1)
          .maybeSingle();
        if (bus) setBusinessProfile(bus);

        // 2. Resolve active outlet for staff & filter sales orders
        const { data: authData } = await supabase.auth.getUser();
        const userRole = authData?.user ? await getUserRole(authData.user.id) : null;
        const staffOutlet = await resolveActiveStaffOutlet(authData?.user?.id);

        let orderQuery = supabase
          .from("sales_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        const isOwner = userRole === "owner" || userRole === "admin";
        const storedActiveOutlet = typeof window !== "undefined" ? localStorage.getItem("kebabschoicepos_active_outlet_id") : null;
        if ((!isOwner || (storedActiveOutlet && storedActiveOutlet !== "all")) && staffOutlet?.outletId && staffOutlet.outletId !== "default" && staffOutlet.outletId !== "all") {
          orderQuery = orderQuery.eq("outlet_id", staffOutlet.outletId);
        }

        const { data: orderRows } = await orderQuery;

        let mapped: ReceiptOrder[] = [];

        if (orderRows && orderRows.length > 0) {
          // Fetch order items for these orders
          const orderIds = orderRows.map((o) => o.id);
          const { data: itemRows } = await supabase
            .from("sales_order_items")
            .select("*")
            .in("order_id", orderIds);

          // Customer mapping
          const { data: customerRows } = await supabase.from("customers").select("id, name");
          const custMap: Record<string, string> = {};
          (customerRows || []).forEach((c) => {
            custMap[c.id] = c.name;
          });

          // Outlet mapping
          const { data: outletRows } = await supabase.from("outlets").select("id, name, address");
          const outletMap: Record<string, string> = {};
          (outletRows || []).forEach((o) => {
            outletMap[o.id] = o.name;
          });

          mapped = orderRows.map((ord) => {
            const relatedItems = (itemRows || [])
              .filter((it) => it.order_id === ord.id)
              .map((it) => ({
                name: it.name || "Item Menu",
                quantity: it.quantity || 1,
                unit_price: Number(it.unit_price) || 0,
                subtotal: Number(it.subtotal) || Number(it.unit_price) || 0,
                variant_name: it.variant_name,
                notes: it.notes,
              }));

            return {
              id: ord.id,
              order_number: ord.order_number,
              created_at: ord.created_at,
              total: Number(ord.total) || 0,
              payment_method: ord.payment_method || "CASH",
              status: ord.status || "paid",
              channel: ord.channel,
              customer_id: ord.customer_id,
              outlet_id: ord.outlet_id,
              outlet_name: ord.outlet_id
                ? outletMap[ord.outlet_id] || "Outlet Utama"
                : "Outlet Utama",
              cashier_name: "Kasir POS",
              customer_name: ord.customer_id ? custMap[ord.customer_id] : "Pelanggan Umum",
              items:
                relatedItems.length > 0
                  ? relatedItems
                  : [
                      {
                        name: `Order POS #${ord.order_number}`,
                        quantity: 1,
                        unit_price: Number(ord.total) || 0,
                        subtotal: Number(ord.total) || 0,
                      },
                    ],
            };
          });
        }

        // Merge snapshot orders if available
        if (snapshot?.orders && Array.isArray(snapshot.orders)) {
          const existingIds = new Set(mapped.map((m) => m.id));
          snapshot.orders.forEach((so: any) => {
            if (so && so.id && !existingIds.has(so.id)) {
              mapped.push({
                id: so.id,
                order_number: so.order_number || so.id,
                created_at: so.created_at || new Date().toISOString(),
                total: Number(so.total) || 0,
                payment_method: (so.payment_method || "CASH").toUpperCase(),
                status: so.status || "paid",
                channel: so.channel,
                customer_id: so.customer_id,
                outlet_id: so.outlet_id,
                outlet_name: "Outlet Utama",
                cashier_name: "Kasir POS",
                customer_name: "Pelanggan Umum",
                cashReceived: so.cashReceived,
                changeAmount: so.changeAmount,
                items: [
                  {
                    name: `Order POS #${so.order_number || so.id}`,
                    quantity: 1,
                    unit_price: Number(so.total) || 0,
                    subtotal: Number(so.total) || 0,
                  },
                ],
              });
              existingIds.add(so.id);
            }
          });
        }

        // Merge recent orders and last receipt from localStorage
        try {
          const rawRecent = localStorage.getItem("kebabschoicepos_recent_orders");
          const recentOrders = rawRecent ? JSON.parse(rawRecent) : [];
          const existingIds = new Set(mapped.map((m) => m.id));

          if (Array.isArray(recentOrders)) {
            recentOrders.forEach((ro: any) => {
              if (ro && ro.id && !existingIds.has(ro.id)) {
                mapped.unshift({
                  id: ro.id,
                  order_number: ro.order_number || ro.id,
                  created_at: ro.created_at || new Date().toISOString(),
                  total: Number(ro.total) || 0,
                  payment_method: (ro.payment_method || "CASH").toUpperCase(),
                  status: ro.status || "paid",
                  channel: ro.channel,
                  customer_id: ro.customer_id,
                  outlet_id: ro.outlet_id,
                  outlet_name: ro.outlet_name || "Outlet Utama",
                  cashier_name: ro.cashier_name || "Kasir POS",
                  customer_name: ro.customer_name || "Pelanggan Umum",
                  cashReceived: ro.cashReceived,
                  changeAmount: ro.changeAmount,
                  items: ro.items || [
                    {
                      name: `Order POS #${ro.order_number || ro.id}`,
                      quantity: 1,
                      unit_price: Number(ro.total) || 0,
                      subtotal: Number(ro.total) || 0,
                    },
                  ],
                });
                existingIds.add(ro.id);
              } else if (ro && ro.id && existingIds.has(ro.id)) {
                const target = mapped.find((m) => m.id === ro.id);
                if (target) {
                  if (ro.cashReceived !== undefined) target.cashReceived = ro.cashReceived;
                  if (ro.changeAmount !== undefined) target.changeAmount = ro.changeAmount;
                }
              }
            });
          }

          // Check last receipt
          const rawLast = localStorage.getItem("kebabschoicepos_last_receipt");
          if (rawLast) {
            const lastRec = JSON.parse(rawLast);
            if (lastRec && lastRec.orderNumber) {
              const matched = mapped.find(
                (m) => m.order_number === lastRec.orderNumber || m.id === lastRec.orderNumber,
              );
              if (matched) {
                if (lastRec.cashReceived !== undefined) matched.cashReceived = lastRec.cashReceived;
                if (lastRec.changeAmount !== undefined) matched.changeAmount = lastRec.changeAmount;
              }
            }
          }
        } catch {
          // ignore localStorage parsing errors
        }

        // Sort descending by created_at
        mapped.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });

        setOrders(mapped);
        if (mapped.length > 0 && mapped[0]) {
          setSelectedOrder(mapped[0]);
        }
      } catch (err) {
        console.error("Failed to load receipt orders:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [snapshot]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ord.order_number.toLowerCase().includes(q) ||
        (ord.customer_name && ord.customer_name.toLowerCase().includes(q)) ||
        (ord.outlet_name && ord.outlet_name.toLowerCase().includes(q))
      );
    });
  }, [orders, searchQuery]);

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);

  const handlePrint = async () => {
    if (!selectedOrder) return;
    toast.info("Mengirim data ke printer struk thermal...");
    try {
      await printReceipt({
        storeName: businessProfile?.name || "KebabsChoice POS",
        outletName: selectedOrder.outlet_name || "Outlet Utama",
        address: businessProfile?.address,
        phone: businessProfile?.phone,
        orderNumber: selectedOrder.order_number,
        cashierName: selectedOrder.cashier_name || "Kasir POS",
        customerName: selectedOrder.customer_name,
        createdAt: selectedOrder.created_at,
        date: new Date(selectedOrder.created_at).toLocaleString("id-ID"),
        items: (selectedOrder.items || []).map((it) => ({
          name: it.variant_name ? `${it.name} (${it.variant_name})` : it.name,
          quantity: it.quantity,
          qty: it.quantity,
          price: it.unit_price,
          subtotal: it.subtotal,
        })),
        total: selectedOrder.total,
        paymentMethod: selectedOrder.payment_method || "CASH",
        cashTendered: selectedOrder.cashReceived,
        change: selectedOrder.changeAmount,
        footerMessage: "Terima kasih atas kunjungan Anda!",
      });
    } catch (err: any) {
      console.warn("Thermal print fallback to browser:", err);
      window.print();
    }
  };

  const handleKickDrawer = async () => {
    const success = await kickCashDrawer();
    if (success) {
      toast.success("Perintah pulsa laci kas (ESC p 0) terkirim!");
    } else {
      toast.info("Perintah laci kas dikirim (Pastikan printer thermal terhubung).");
    }
  };

  const handleShare = () => {
    if (!selectedOrder) return;
    const text = `*STRUK PEMBELIAN - ${businessProfile?.name || "KebabsChoicePOS"}*\nNo: ${selectedOrder.order_number}\nOutlet: ${selectedOrder.outlet_name}\nTanggal: ${new Date(selectedOrder.created_at).toLocaleString("id-ID")}\nTotal: ${formatRupiah(selectedOrder.total)}\nStatus: LUNAS (${selectedOrder.payment_method.toUpperCase()})\nTerima Kasih!`;
    if (navigator.share) {
      navigator.share({ title: "Struk POS", text }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Teks struk berhasil disalin ke clipboard!");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/pos"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground mr-2"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke POS
            </Link>
            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
              POS Struk Center
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-normal mt-1">Cetak Struk Transaksi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cetak ulang struk kasir thermal 58mm/80mm, unduh bukti pembayaran digital, dan kirim via
            WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold">
            {printerInfo.status === "connected" ? (
              <>
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-foreground font-bold">
                  {printerInfo.type === "bluetooth" ? "BT: " : "USB: "}
                  {printerInfo.name}
                </span>
                <button
                  onClick={() => disconnectPrinter()}
                  className="ml-1 text-[11px] text-muted-foreground hover:text-destructive underline"
                >
                  Putus
                </button>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                <span className="text-muted-foreground">Printer: Standar (Browser)</span>
                <button
                  onClick={() => connectBluetoothPrinter().catch(() => {})}
                  className="ml-1 text-[11px] text-primary hover:underline font-bold"
                >
                  +BT
                </button>
                <button
                  onClick={() => connectUsbPrinter().catch(() => {})}
                  className="ml-0.5 text-[11px] text-primary hover:underline font-bold"
                >
                  +USB
                </button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            onClick={handleKickDrawer}
            title="Kirim sinyal pulsa buka laci kas (ESC p 0)"
            className="rounded-2xl gap-2 font-bold h-11 px-3 text-xs"
          >
            <WalletCards className="size-4" />
            Buka Laci
          </Button>

          <Button
            onClick={handlePrint}
            disabled={!selectedOrder}
            className="rounded-2xl gap-2 font-bold shadow-brand h-11 px-5"
          >
            <Printer className="size-4" />
            Cetak Struk Ini
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            disabled={!selectedOrder}
            className="rounded-2xl gap-2 font-bold h-11 px-4"
          >
            <Share2 className="size-4" />
            Bagikan
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Orders List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. Order / Pelanggan..."
                className="pl-9 h-10 rounded-xl text-xs bg-background"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
              <span>{filteredOrders.length} Transaksi Terpilih</span>
              <span>Terbaru</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                Memuat daftar transaksi...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-xs">
                Tidak ada transaksi yang cocok.
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setSelectedOrder(ord)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                        : "border-border bg-card/60 hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-foreground">{ord.order_number}</span>
                      <span className="font-extrabold text-sm text-primary">
                        {formatRupiah(ord.total)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-semibold">
                        <Store className="size-3 text-primary" />
                        {ord.outlet_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(ord.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/50 text-[10px]">
                      <span className="font-bold text-muted-foreground">{ord.customer_name}</span>
                      <Badge
                        variant="secondary"
                        className="uppercase font-bold text-[9px] px-1.5 py-0"
                      >
                        {ord.payment_method}
                      </Badge>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Thermal Receipt Preview */}
        <div className="lg:col-span-7">
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-soft flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-border">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pratinjau Struk Thermal (58mm/80mm)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-bold gap-1"
                  onClick={handlePrint}
                >
                  <Printer className="size-3" />
                  Print
                </Button>
              </div>
            </div>

            {selectedOrder ? (
              /* Receipt Container styled as thermal paper */
              <div
                ref={receiptPrintRef}
                className="w-full max-w-sm rounded-2xl bg-white text-zinc-900 p-6 shadow-md border border-zinc-200 font-mono text-xs leading-relaxed transition-all"
                style={{ fontFamily: "'Courier New', Courier, monospace" }}
              >
                {/* Header Struk */}
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-400">
                  <h3 className="font-black text-base uppercase tracking-wider">
                    {businessProfile?.name || snapshot?.businessName || "KEBABS CHOICE POS"}
                  </h3>
                  <p className="text-[11px] text-zinc-600 font-bold">{selectedOrder.outlet_name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {businessProfile?.address || businessProfile?.city || "Jakarta, Indonesia"} ·
                    Telp: {businessProfile?.phone || "0812-3456-7890"}
                  </p>
                </div>

                {/* Metadata */}
                <div className="py-2.5 space-y-0.5 border-b border-dashed border-zinc-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>No. Order:</span>
                    <span className="font-bold">{selectedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal:</span>
                    <span>
                      {new Date(selectedOrder.created_at).toLocaleDateString("id-ID")}{" "}
                      {new Date(selectedOrder.created_at).toLocaleTimeString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{selectedOrder.cashier_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold">{selectedOrder.customer_name}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-3 border-b border-dashed border-zinc-400 space-y-2 text-[11px]">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-bold text-zinc-900">{item.name}</div>
                      {item.variant_name && (
                        <div className="text-[10px] text-zinc-500 pl-2">
                          Varian: {item.variant_name}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[10px] text-zinc-500 pl-2 italic">
                          Note: {item.notes}
                        </div>
                      )}
                      <div className="flex justify-between text-zinc-600 text-[10px]">
                        <span>
                          {item.quantity} x {formatRupiah(item.unit_price)}
                        </span>
                        <span className="font-bold text-zinc-900">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-3 space-y-1 border-b border-dashed border-zinc-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatRupiah(selectedOrder.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Diskon:</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pajak:</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-300">
                    <span>TOTAL:</span>
                    <span>{formatRupiah(selectedOrder.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span>Metode:</span>
                    <span className="font-bold uppercase">{selectedOrder.payment_method}</span>
                  </div>
                  {selectedOrder.payment_method?.toUpperCase() === "CASH" && (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span>Tunai Diterima:</span>
                        <span className="font-bold">
                          {formatRupiah(
                            selectedOrder.cashReceived ??
                              (selectedOrder.total ? selectedOrder.total : 0),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Kembalian:</span>
                        <span className="font-bold text-emerald-700">
                          {formatRupiah(selectedOrder.changeAmount ?? 0)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-[11px]">
                    <span>Status:</span>
                    <span className="font-bold text-emerald-700 uppercase">
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-4 space-y-1 text-[10px] text-zinc-500">
                  <p className="font-bold text-zinc-800">*** TERIMA KASIH ***</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar</p>
                  <p className="text-[9px] pt-1">Powered by KebabsChoicePOS Enterprise V2.0</p>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground text-sm">
                Pilih transaksi dari daftar di sebelah kiri untuk melihat struk.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
