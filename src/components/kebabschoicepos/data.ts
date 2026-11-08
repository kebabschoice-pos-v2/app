import {
  BarChart3,
  Boxes,
  BrainCircuit,
  ClipboardList,
  Home,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  UserRound,
  UserCog,
  UsersRound,
  Building2,
  Store,
  Receipt,
  UtensilsCrossed,
  Trash2,
  Truck,
  FileText,
  ArrowLeftRight,
  Printer,
  Percent,
  CreditCard,
  Puzzle,
  ShieldCheck,
  KeyRound,
  History,
  TrendingUp,
  Globe2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard"
  | "pos"
  | "orders"
  | "inventory"
  | "stock-opname"
  | "waste"
  | "suppliers"
  | "purchase-orders"
  | "stock-transfer"
  | "customers"
  | "analytics"
  | "business-summary"
  | "performance-outlet"
  | "performance-menu"
  | "insight-analytics"
  | "money-allocation"
  | "profile"
  | "staff"
  | "business"
  | "business-profile"
  | "outlets"
  | "outlet"
  | "menu"
  | "receipt-settings"
  | "printer-settings"
  | "tax"
  | "payment"
  | "integration"
  | "security"
  | "change-password"
  | "login-activity"
  | "language"
  | "language-settings"
  | "pos-shift-cash"
  | "pos-inventory"
  | "pos-profile"
  | "pos-attendance-in"
  | "pos-attendance-out"
  | "pos-attendance-history"
  | "pos-attendance-shifts"
  | "pos-orders"
  | "pos-receipt";

export type MenuVariantOption = {
  id?: string;
  group_id?: string;
  name: string;
  price_adjustment: number;
  additional_price?: number;
  is_default?: boolean;
  sort_order?: number;
};

export type MenuVariantGroup = {
  id?: string;
  menu_item_id?: string;
  name: string;
  selection_type: "single" | "multiple";
  is_required?: boolean;
  sort_order?: number;
  options: MenuVariantOption[];
};

export type ProductVariant = {
  id?: string;
  name: string;
  price_adjustment: number;
};

export type ProductModifier = {
  id?: string;
  name: string;
  price_adjustment: number;
  category?: "level" | "prep" | "addon";
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  promo_price?: number | null;
  tax_rate?: number;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  ai_badge: string | null;
  image_url?: string | null;
  image_crop_position?: { x: number; y: number } | null;
  image_zoom?: number;
  image_rotation?: number;
  image_aspect_ratio?: "original" | "1:1" | "16:9" | "custom" | "full" | string;
  aspect_ratio?: "original" | "1:1" | "16:9" | "custom" | "full" | string;
  crop_x?: number;
  crop_y?: number;
  image_position_x?: number;
  image_position_y?: number;
  zoom?: number;
  rotation?: number;
  description?: string | null;
  variant_groups?: MenuVariantGroup[];
  variants?: ProductVariant[];
  modifiers?: ProductModifier[];
  addons?: ProductVariant[];
  recipe?: any;
  outlet_assignments?: {
    outlet_id: string;
    outlet_name?: string;
    available: boolean;
    selling_price: number | null;
    stock?: number;
  }[];
  active?: boolean;
  deleted_at?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  visits: number;
  total_spend: number;
  points?: number;
  favorite_product: string | null;
  ai_insight: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  health_score: number;
  ai_alert: string | null;
};

export type SalesOrder = {
  id: string;
  order_number: string;
  total: number;
  payment_method: "cash" | "qris" | "ewallet" | "card";
  status: "draft" | "paid" | "refunded" | "cancelled" | "void";
  channel: string;
  created_at: string;
  customer_id?: string | null;
  outlet_id?: string | null;
  actionReason?: string | null;
  authorized_by?: string | null;
  cashReceived?: number;
  changeAmount?: number;
};

export type AiInsight = {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: number;
  action_label: string | null;
};

export type OutletItem = {
  id: string;
  name: string;
  code?: string;
  address?: string;
  active: boolean;
  settings?: Record<string, any>;
};

export type Snapshot = {
  businessId: string | null;
  businessName: string;
  logo?: string | null;
  city: string;
  role: string;
  assignedOutletId?: string | null;
  outlets?: OutletItem[];
  products: Product[];
  customers: Customer[];
  inventory: InventoryItem[];
  orders: SalesOrder[];
  insights: AiInsight[];
  isPendingConfirmation?: boolean;
  pendingConfirmationOutletName?: string;
};

export type CartItem = Product & {
  cart_item_id: string;
  quantity: number;
  unit_price: number;
  base_price: number;
  variant_name?: string | null;
  selected_variant?: { name: string; price: number } | null;
  selected_modifiers?: string[];
  selected_addons?: { name: string; price: number }[];
  selected_variant_groups?: {
    group_id?: string;
    group_name: string;
    selection_type: "single" | "multiple";
    options: { id?: string; name: string; price: number }[];
  }[];
  notes?: string;
};

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  group: "report" | "stock" | "business" | "settings" | "account";
};

export const navItems: NavItem[] = [
  // 1. RINGKASAN & LAPORAN
  { key: "dashboard", label: "Dashboard HQ", href: "/dashboard", icon: Home, group: "report" },
  {
    key: "business-summary",
    label: "Ringkasan Bisnis",
    href: "/analytics",
    icon: TrendingUp,
    group: "report",
  },
  { key: "orders", label: "Penjualan", href: "/orders", icon: ReceiptText, group: "report" },
  {
    key: "performance-outlet",
    label: "Performa Outlet",
    href: "/performance-outlet",
    icon: Store,
    group: "report",
  },
  {
    key: "performance-menu",
    label: "Performa Menu",
    href: "/performance-menu",
    icon: UtensilsCrossed,
    group: "report",
  },
  {
    key: "insight-analytics",
    label: "Insight Analytics",
    href: "/insight-analytics",
    icon: BarChart3,
    group: "report",
  },
  {
    key: "money-allocation",
    label: "Alokasi & Celengan",
    href: "/money-allocation",
    icon: Wallet,
    group: "report",
  },

  // 2. STOK & PENGADAAN (Enterprise Stock & Procurement)
  { key: "inventory", label: "Inventory", href: "/inventory", icon: Boxes, group: "stock" },
  {
    key: "stock-opname",
    label: "Stock Opname",
    href: "/stock-opname",
    icon: ClipboardList,
    group: "stock",
  },
  { key: "waste", label: "Barang Terbuang", href: "/waste", icon: Trash2, group: "stock" },
  { key: "suppliers", label: "Supplier", href: "/suppliers", icon: Truck, group: "stock" },
  {
    key: "purchase-orders",
    label: "Purchase Order",
    href: "/purchase-orders",
    icon: FileText,
    group: "stock",
  },
  {
    key: "stock-transfer",
    label: "Transfer Stock",
    href: "/stock-transfer",
    icon: ArrowLeftRight,
    group: "stock",
  },

  // 3. MANAJEMEN BISNIS
  {
    key: "menu",
    label: "Menu Management",
    href: "/menu",
    icon: UtensilsCrossed,
    group: "business",
  },
  { key: "outlets", label: "Outlet Management", href: "/outlets", icon: Store, group: "business" },
  { key: "staff", label: "Staff Management", href: "/staff", icon: UserCog, group: "business" },
  {
    key: "business-profile",
    label: "Business Profile",
    href: "/business-profile",
    icon: Building2,
    group: "business",
  },

  // 4. PENGATURAN
  {
    key: "receipt-settings",
    label: "Invoice / Struk",
    href: "/receipt-settings",
    icon: Receipt,
    group: "settings",
  },
  {
    key: "printer-settings",
    label: "Printer Setting",
    href: "/printer-settings",
    icon: Printer,
    group: "settings",
  },
  { key: "tax", label: "Pajak", href: "/tax", icon: Percent, group: "settings" },
  { key: "payment", label: "Pembayaran", href: "/payment", icon: CreditCard, group: "settings" },
  { key: "integration", label: "Integrasi", href: "/integration", icon: Puzzle, group: "settings" },

  // 5. AKUN
  { key: "profile", label: "Profil Akun", href: "/profile", icon: UserRound, group: "account" },
  { key: "language", label: "Bahasa", href: "/language-settings", icon: Globe2, group: "account" },
  { key: "security", label: "Keamanan", href: "/security", icon: ShieldCheck, group: "account" },
  {
    key: "change-password",
    label: "Ganti Password",
    href: "/change-password",
    icon: KeyRound,
    group: "account",
  },
  {
    key: "login-activity",
    label: "Aktivitas Login",
    href: "/login-activity",
    icon: History,
    group: "account",
  },
];

export const mobileNavItems = [
  { key: "dashboard" as NavKey, label: "Dashboard", href: "/dashboard", icon: Home },
  { key: "pos" as NavKey, label: "POS Kasir", href: "/pos", icon: ShoppingCart },
  { key: "orders" as NavKey, label: "Order", href: "/orders", icon: ReceiptText },
  { key: "analytics" as NavKey, label: "Analitik", href: "/analytics", icon: BarChart3 },
  { key: "profile" as NavKey, label: "Profil", href: "/profile", icon: UserRound },
];

export const demoProducts = [
  {
    name: "Signature Kopi Aren",
    category: "Minuman",
    price: 28000,
    stock: 42,
    ai_badge: "Best margin",
  },
  { name: "Matcha Cloud", category: "Minuman", price: 34000, stock: 24, ai_badge: "Naik 18%" },
  { name: "Croissant Butter", category: "Pastry", price: 32000, stock: 18, ai_badge: "Bundling" },
  {
    name: "Nasi Ayam Sambal Matah",
    category: "Makanan",
    price: 48000,
    stock: 21,
    ai_badge: "Jam makan siang",
  },
  {
    name: "Retail Beans 250g",
    category: "Retail",
    price: 95000,
    stock: 12,
    ai_badge: "Repeat buyer",
  },
  {
    name: "Cold Brew Bottle",
    category: "Grab & Go",
    price: 39000,
    stock: 30,
    ai_badge: "Stok aman",
  },
];

export const demoCustomers = [
  {
    name: "Alya Pratama",
    visits: 24,
    total_spend: 1840000,
    favorite_product: "Signature Kopi Aren",
    ai_insight: "Cocok ditawarkan paket langganan pagi.",
  },
  {
    name: "Bima Studio",
    visits: 11,
    total_spend: 3275000,
    favorite_product: "Retail Beans 250g",
    ai_insight: "Pelanggan korporat dengan potensi repeat bulk order.",
  },
  {
    name: "Citra Mahesa",
    visits: 18,
    total_spend: 1260000,
    favorite_product: "Matcha Cloud",
    ai_insight: "Responsif terhadap promo e-wallet sore.",
  },
  {
    name: "Danu Wijaya",
    visits: 7,
    total_spend: 720000,
    favorite_product: "Croissant Butter",
    ai_insight: "Aktif pada akhir pekan, tawarkan bundle brunch.",
  },
];

export const demoInventory: InventoryItem[] = [];

export const demoInsights = [
  {
    type: "daily_summary",
    title: "Ringkasan harian",
    body: "Pendapatan bergerak 14% di atas Selasa lalu. Kontributor utama: Kopi Aren, Matcha Cloud, dan paket brunch.",
    confidence: 94,
    action_label: "Lihat laporan",
  },
  {
    type: "stock_recommendation",
    title: "Rekomendasi stok",
    body: "Tambah 12 liter susu oat dan 6 botol syrup aren sebelum jam 16.00 untuk menjaga service level malam.",
    confidence: 91,
    action_label: "Buat PO",
  },
  {
    type: "sales_prediction",
    title: "Prediksi penjualan",
    body: "Jika ritme transaksi bertahan, omzet hari ini diproyeksikan Rp 18,8 juta dengan 312 order.",
    confidence: 89,
    action_label: "Simulasi",
  },
  {
    type: "customer_insight",
    title: "Peluang CRM",
    body: "43 pelanggan belum kembali dalam 21 hari. Voucher personal bisa memulihkan sekitar Rp 3,4 juta revenue.",
    confidence: 87,
    action_label: "Kirim kampanye",
  },
];

export const demoOrders = [
  {
    order_number: "KP-2609-1088",
    total: 164000,
    payment_method: "qris" as const,
    status: "paid" as const,
    channel: "store",
  },
  {
    order_number: "KP-2609-1087",
    total: 98000,
    payment_method: "ewallet" as const,
    status: "paid" as const,
    channel: "takeaway",
  },
  {
    order_number: "KP-2609-1086",
    total: 276000,
    payment_method: "card" as const,
    status: "paid" as const,
    channel: "dine-in",
  },
  {
    order_number: "KP-2609-1085",
    total: 52000,
    payment_method: "cash" as const,
    status: "paid" as const,
    channel: "store",
  },
];

export const revenueTrend = [
  { day: "Sen", revenue: 12.4, orders: 188 },
  { day: "Sel", revenue: 14.1, orders: 205 },
  { day: "Rab", revenue: 13.7, orders: 197 },
  { day: "Kam", revenue: 16.2, orders: 229 },
  { day: "Jum", revenue: 18.8, orders: 312 },
  { day: "Sab", revenue: 21.5, orders: 346 },
  { day: "Min", revenue: 19.2, orders: 301 },
];

export const productPerformance = [
  { name: "Kopi Aren", value: 34 },
  { name: "Matcha", value: 24 },
  { name: "Croissant", value: 17 },
  { name: "Ayam Matah", value: 15 },
  { name: "Retail Beans", value: 10 },
];

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export const calculateSnapshotMetrics = (snapshot: Snapshot) => {
  const paidOrders = (snapshot.orders || []).filter(
    (order) => order.status === "paid" || !order.status,
  );
  const todayRevenue = paidOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const totalCustomers = (snapshot.customers || []).length;
  const lowStock = (snapshot.inventory || []).filter(
    (item) => (Number(item.stock) || 0) <= (Number(item.minimum_stock) || 0),
  ).length;
  const avgHealth =
    (snapshot.inventory || []).length > 0
      ? Math.round(
          (snapshot.inventory || []).reduce(
            (sum, item) => sum + (Number(item.health_score) || 75),
            0,
          ) / snapshot.inventory.length,
        )
      : 0;

  // Margin and Profit calculation with safe fallbacks (cost = 0 if unavailable)
  let totalProductCost = 0;
  let totalProductPrice = 0;
  for (const p of snapshot.products || []) {
    const cost = Number(p.cost_price) || 0;
    const price = Number(p.price) || 0;
    if (price > 0) {
      totalProductPrice += price;
      totalProductCost += cost;
    }
  }

  // Cost ratio (fallback to 40% if products don't have cost, or 0 if no products)
  const avgCostRatio = totalProductPrice > 0 ? totalProductCost / totalProductPrice : 0.4;
  const estimatedCost = Math.round(todayRevenue * avgCostRatio);
  const grossProfit = Math.max(0, todayRevenue - estimatedCost);
  const marginPercentage =
    todayRevenue > 0
      ? Math.round((grossProfit / todayRevenue) * 100)
      : totalProductPrice > 0
        ? Math.round(((totalProductPrice - totalProductCost) / totalProductPrice) * 100)
        : 0;

  // Outlet performance aggregation
  const outletMap: Record<string, { id: string; name: string; orders: number; revenue: number }> =
    {};
  for (const o of snapshot.outlets || []) {
    outletMap[o.id] = { id: o.id, name: o.name, orders: 0, revenue: 0 };
  }
  for (const ord of paidOrders) {
    if (ord.outlet_id) {
      const target = outletMap[ord.outlet_id];
      if (target) {
        target.orders += 1;
        target.revenue += Number(ord.total) || 0;
      }
    }
  }
  const outletPerformances = Object.values(outletMap).sort((a, b) => b.revenue - a.revenue);

  // Top products
  const topProducts = [...(snapshot.products || [])].slice(0, 5).map((p, idx) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    soldCount: paidOrders.length > 0 ? Math.max(1, Math.round(paidOrders.length / (idx + 1))) : 0,
    revenue:
      paidOrders.length > 0 ? Math.max(1, Math.round(paidOrders.length / (idx + 1))) * p.price : 0,
  }));

  return {
    todayRevenue,
    orders: paidOrders.length,
    totalCustomers,
    customerGrowth: totalCustomers > 0 ? totalCustomers * 12 : 0,
    lowStock,
    avgHealth,
    totalCost: estimatedCost,
    grossProfit,
    marginPercentage,
    outletPerformances,
    topProducts,
  };
};

export const emptySnapshot: Snapshot = {
  businessId: null,
  businessName: "KebabsChoicePOS Studio",
  logo: null,
  city: "Jakarta",
  role: "owner",
  assignedOutletId: null,
  products: [],
  customers: [],
  inventory: [],
  orders: [],
  insights: [],
};

export const sectionIcons = {
  ai: BrainCircuit,
  inventory: PackageSearch,
  order: ClipboardList,
};
