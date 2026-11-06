import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  X,
  UtensilsCrossed,
  UsersRound,
  ReceiptText,
  Store,
  Boxes,
  ArrowRight,
  ShoppingCart,
  Tag,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { type Snapshot, type Product, formatRupiah } from "@/components/kebabschoicepos/data";
import { useTranslation } from "react-i18next";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: Snapshot;
  isPosMode: boolean;
  onSelectProduct?: (product: Product) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  snapshot,
  isPosMode,
  onSelectProduct,
}: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          window.dispatchEvent(new CustomEvent("open-global-search"));
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const cleanQuery = query.toLowerCase().trim();

  // Search Results computation
  const results = useMemo(() => {
    if (!cleanQuery) return null;

    if (isPosMode) {
      // POS SEARCH: Produk, Kategori, Customer
      const matchedProducts = snapshot.products.filter(
        (p) =>
          p.name.toLowerCase().includes(cleanQuery) ||
          p.category.toLowerCase().includes(cleanQuery),
      );

      const uniqueCategories = Array.from(new Set(snapshot.products.map((p) => p.category))).filter(
        (cat) => cat.toLowerCase().includes(cleanQuery),
      );

      const matchedCustomers = snapshot.customers.filter(
        (c) =>
          c.name.toLowerCase().includes(cleanQuery) ||
          (c.favorite_product && c.favorite_product.toLowerCase().includes(cleanQuery)),
      );

      return {
        products: matchedProducts,
        categories: uniqueCategories,
        customers: matchedCustomers,
        orders: [],
        outlets: [],
        inventory: [],
      };
    } else {
      // HQ SEARCH: Menu, Customer, Transaksi, Outlet, Inventory
      const matchedMenu = snapshot.products.filter(
        (p) =>
          p.name.toLowerCase().includes(cleanQuery) ||
          p.category.toLowerCase().includes(cleanQuery),
      );

      const matchedCustomers = snapshot.customers.filter(
        (c) =>
          c.name.toLowerCase().includes(cleanQuery) ||
          (c.favorite_product && c.favorite_product.toLowerCase().includes(cleanQuery)),
      );

      const matchedOrders = snapshot.orders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(cleanQuery) ||
          o.payment_method.toLowerCase().includes(cleanQuery) ||
          (o.status && o.status.toLowerCase().includes(cleanQuery)),
      );

      const matchedOutlets = (snapshot.outlets || []).filter(
        (o) =>
          o.name.toLowerCase().includes(cleanQuery) ||
          (o.address && o.address.toLowerCase().includes(cleanQuery)) ||
          (o.code && o.code.toLowerCase().includes(cleanQuery)),
      );

      const matchedInventory = snapshot.inventory.filter(
        (i) =>
          i.name.toLowerCase().includes(cleanQuery) ||
          i.category.toLowerCase().includes(cleanQuery) ||
          i.unit.toLowerCase().includes(cleanQuery),
      );

      return {
        products: matchedMenu,
        categories: [],
        customers: matchedCustomers,
        orders: matchedOrders,
        outlets: matchedOutlets,
        inventory: matchedInventory,
      };
    }
  }, [cleanQuery, isPosMode, snapshot]);

  const hasResults =
    results &&
    (results.products.length > 0 ||
      results.categories.length > 0 ||
      results.customers.length > 0 ||
      results.orders.length > 0 ||
      results.outlets.length > 0 ||
      results.inventory.length > 0);

  const handleNavigate = (path: string) => {
    onClose();
    navigate({ to: path as any });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-float animate-in zoom-in-95 max-h-[85vh] flex flex-col">
        {/* Search Input Box */}
        <div className="relative flex items-center border-b border-border pb-4">
          <Search className="absolute left-3.5 size-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isPosMode
                ? "Cari menu POS, kategori, atau pelanggan..."
                : "Cari menu, pelanggan, nomor transaksi, outlet, atau inventory..."
            }
            className="w-full rounded-2xl bg-secondary/60 py-3.5 pl-11 pr-12 text-sm font-semibold outline-hidden focus:ring-2 focus:ring-primary border border-border/80 transition-all text-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3.5 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="absolute right-3.5 rounded-lg border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              ESC
            </kbd>
          )}
        </div>

        {/* Content Area */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-5 pr-1 text-sm">
          {!cleanQuery && (
            <div className="space-y-4 py-2">
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Pintasan Navigasi Cepat
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Dashboard HQ", path: "/dashboard", icon: TrendingUp },
                  { label: "POS Kasir", path: "/pos", icon: ShoppingCart },
                  { label: "Menu Management", path: "/menu", icon: UtensilsCrossed },
                  { label: "Stok Inventory", path: "/inventory", icon: Boxes },
                  { label: "Outlet Cabang", path: "/outlets", icon: Store },
                  { label: "Pelanggan CRM", path: "/customers", icon: UsersRound },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-xs font-bold hover:bg-secondary transition-all text-left group cursor-pointer"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-3.5" />
                      </div>
                      <span className="truncate group-hover:text-primary">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {cleanQuery && !hasResults && (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="mx-auto size-10 opacity-30 mb-2" />
              <p className="font-bold text-base">Tidak ada hasil ditemukan</p>
              <p className="text-xs mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
            </div>
          )}

          {results && hasResults && (
            <div className="space-y-5">
              {/* 1. PRODUK / MENU */}
              {results.products.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <UtensilsCrossed className="size-3.5 text-primary" />
                      {isPosMode ? "Produk POS" : "Menu & Katalog"} ({results.products.length})
                    </span>
                    {!isPosMode && (
                      <button
                        type="button"
                        onClick={() => handleNavigate("/menu")}
                        className="text-primary hover:underline lowercase font-semibold"
                      >
                        lihat di menu
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {results.products.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isPosMode && onSelectProduct) {
                            onSelectProduct(p);
                            onClose();
                          } else {
                            handleNavigate("/menu");
                          }
                        }}
                        className="flex items-center justify-between rounded-xl border border-border/80 p-2.5 hover:bg-secondary transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.category} · Stok: {p.stock}
                          </p>
                        </div>
                        <span className="font-extrabold text-xs text-primary shrink-0">
                          {formatRupiah(p.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. KATEGORI (POS MODE) */}
              {results.categories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="size-3.5 text-primary" /> Kategori Menu (
                    {results.categories.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {results.categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleNavigate("/pos")}
                        className="rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. PELANGGAN CRM */}
              {results.customers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <UsersRound className="size-3.5 text-primary" />
                      Pelanggan CRM ({results.customers.length})
                    </span>
                    {!isPosMode && (
                      <button
                        type="button"
                        onClick={() => handleNavigate("/customers")}
                        className="text-primary hover:underline lowercase font-semibold"
                      >
                        lihat di crm
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {results.customers.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleNavigate(isPosMode ? "/pos" : "/customers")}
                        className="flex items-center justify-between rounded-xl border border-border/80 p-2.5 hover:bg-secondary transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                            {c.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.visits}x kunjungan{" "}
                            {c.favorite_product ? `· Favorit: ${c.favorite_product}` : ""}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground shrink-0">
                          {formatRupiah(c.total_spend)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. TRANSAKSI (HQ MODE) */}
              {!isPosMode && results.orders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ReceiptText className="size-3.5 text-primary" />
                      Riwayat Transaksi ({results.orders.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/orders")}
                      className="text-primary hover:underline lowercase font-semibold"
                    >
                      lihat semua penjualan
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {results.orders.slice(0, 3).map((o) => (
                      <div
                        key={o.id}
                        onClick={() => handleNavigate("/orders")}
                        className="flex items-center justify-between rounded-xl border border-border/80 p-2.5 hover:bg-secondary transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                            #{o.order_number}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {o.channel} · {o.payment_method} · {o.status}
                          </p>
                        </div>
                        <span className="font-extrabold text-xs text-primary shrink-0">
                          {formatRupiah(o.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. OUTLET CABANG (HQ MODE) */}
              {!isPosMode && results.outlets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Store className="size-3.5 text-primary" />
                      Outlet Cabang ({results.outlets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/outlets")}
                      className="text-primary hover:underline lowercase font-semibold"
                    >
                      lihat outlet
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {results.outlets.slice(0, 3).map((ot) => (
                      <div
                        key={ot.id}
                        onClick={() => handleNavigate("/outlets")}
                        className="flex items-center justify-between rounded-xl border border-border/80 p-2.5 hover:bg-secondary transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                            {ot.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {ot.address || "Belum ada alamat"} {ot.code ? `· [${ot.code}]` : ""}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. INVENTORY (HQ MODE) */}
              {!isPosMode && results.inventory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Boxes className="size-3.5 text-primary" />
                      Bahan Baku & Inventory ({results.inventory.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/inventory")}
                      className="text-primary hover:underline lowercase font-semibold"
                    >
                      lihat inventory
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {results.inventory.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => handleNavigate("/inventory")}
                        className="flex items-center justify-between rounded-xl border border-border/80 p-2.5 hover:bg-secondary transition-all cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                            {inv.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inv.category} · Batas Minimum: {inv.minimum_stock} {inv.unit}
                          </p>
                        </div>
                        <span
                          className={`font-black text-xs shrink-0 ${
                            inv.stock <= inv.minimum_stock ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {inv.stock} {inv.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>Pilih hasil untuk langsung membuka modul terkait</span>
          <kbd className="rounded-md border border-border bg-secondary/80 px-2 py-0.5 font-mono text-[10px]">
            Ctrl + K
          </kbd>
        </div>
      </div>
    </div>
  );
}
