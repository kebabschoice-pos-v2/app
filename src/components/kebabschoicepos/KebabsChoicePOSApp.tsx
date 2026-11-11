import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BellRing,
  Bot,
  Building2,
  Check,
  ChevronRight,
  ChevronDown,
  Boxes,
  CreditCard,
  DollarSign,
  Download,
  ImageIcon,
  Loader2,
  LogOut,
  Minus,
  PackageCheck,
  PackageSearch,
  Plus,
  QrCode,
  RadioTower,
  ReceiptText,
  Search,
  Send,
  Smartphone,
  TrendingUp,
  UploadCloud,
  UsersRound,
  WalletCards,
  Zap,
  X,
  Trash2,
  Flame,
  SlidersHorizontal,
  Store,
  UtensilsCrossed,
  UserRound,
  Home,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  Truck,
  FileText,
  ArrowLeftRight,
  UserCog,
  Receipt,
  Printer,
  Percent,
  Puzzle,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  History,
  Calendar,
  RotateCcw,
  XCircle,
  Clock,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  ShoppingCart,
  Globe2,
  Palette,
  Lock,
  Camera,
  UserCheck,
  Bluetooth,
  Usb,
  ScanBarcode,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Monitor,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
} from "@/services/business.service";
import { StaffManagement } from "@/components/kebabschoicepos/StaffManagement";
import { BusinessProfilePage } from "@/components/kebabschoicepos/BusinessProfilePage";
import { getStaffList, type StaffItem } from "@/services/staff.service";
import {
  printReceipt,
  kickCashDrawer,
  getSavedPrinterConfig,
  subscribePrinterStatus,
  connectBluetoothPrinter,
  connectUsbPrinter,
  disconnectPrinter,
  testThermalPrint,
  type ConnectedPrinterInfo,
} from "@/services/thermal-printer.service";
import { cn } from "@/lib/utils";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import {
  isOnline,
  getNetworkStatus,
  subscribeNetworkStatus,
  queueOfflineTransaction,
  syncPendingTransactions,
  cacheOutletCatalog,
  type NetworkSyncStatus,
  type OfflineTransaction,
} from "@/services/offline-sync.service";
import {
  generateDynamicQris,
  checkQrisPaymentStatus,
  simulateQrisPayment,
  subscribeQrisStatus,
  type QrisTransactionResponse,
} from "@/services/qris.service";
import {
  calculateSnapshotMetrics,
  demoCustomers,
  demoInsights,
  demoInventory,
  demoOrders,
  demoProducts,
  emptySnapshot,
  formatRupiah,
  mobileNavItems,
  navItems,
  productPerformance,
  revenueTrend,
  sectionIcons,
  type AiInsight,
  type CartItem,
  type Customer,
  type InventoryItem,
  type NavKey,
  type Product,
  type ProductVariant,
  type ProductModifier,
  type MenuVariantGroup,
  type MenuVariantOption,
  type OutletItem,
  type SalesOrder,
  type Snapshot,
} from "./data";

import { OutletManagement } from "@/pages/OutletManagement";
import { MenuManagement } from "@/pages/MenuManagement";
import { ReceiptSettingsPage } from "@/components/kebabschoicepos/ReceiptSettingsPage";
import { convertRecipeToInventoryQuantity } from "@/services/menu.service";
import { recordOrderOutletMetadata, exportToCSV } from "@/services/reports.service";
import { verifySupervisorPin } from "@/services/supervisor.service";
import { InventoryManagement } from "@/pages/inventory/InventoryManagement";
import { StockOpnamePage } from "@/pages/inventory/StockOpnamePage";
import { WastePage } from "@/pages/inventory/WastePage";
import { SupplierManagementPage } from "@/pages/inventory/SupplierManagementPage";
import { PurchaseOrderPage } from "@/pages/inventory/PurchaseOrderPage";
import { StockTransferPage } from "@/pages/inventory/StockTransferPage";
import { PrinterSettingsPage } from "@/pages/settings/PrinterSettingsPage";
import { TaxSettingsPage } from "@/pages/settings/TaxSettingsPage";
import { PaymentSettingsPage } from "@/pages/settings/PaymentSettingsPage";
import { IntegrationSettingsPage } from "@/pages/settings/IntegrationSettingsPage";
import { SecuritySettingsPage } from "@/pages/account/SecuritySettingsPage";
import { ChangePasswordPage } from "@/pages/account/ChangePasswordPage";
import { LoginActivityPage } from "@/pages/account/LoginActivityPage";
import { PerformanceMenuPage } from "@/pages/reports/PerformanceMenuPage";
import { InsightAnalyticsPage } from "@/pages/reports/InsightAnalyticsPage";
import { PerformanceOutletPage } from "@/pages/reports/PerformanceOutletPage";
import { LanguageSettingsPage } from "@/pages/account/LanguageSettingsPage";
import { PosShiftCashPage } from "@/pages/pos/PosShiftCashPage";
import { PosInventoryPage } from "@/pages/pos/PosInventoryPage";
import { PosProfilePage } from "@/pages/pos/PosProfilePage";
import { PosReceiptPage } from "@/pages/pos/PosReceiptPage";
import { AttendancePage } from "@/components/kebabschoicepos/AttendancePage";
import { MoneyAllocationPage } from "@/pages/money/MoneyAllocationPage";
import { ThemeModal } from "@/components/theme/ThemeModal";
import { GlobalSearchModal } from "@/components/search/GlobalSearchModal";
import { applyTheme, getStoredTheme } from "@/lib/theme";

type AppPage =
  | "dashboard"
  | "pos"
  | "pos-orders"
  | "pos-receipt"
  | "pos-shift-cash"
  | "pos-inventory"
  | "pos-profile"
  | "pos-attendance-in"
  | "pos-attendance-out"
  | "pos-attendance-history"
  | "pos-attendance-shifts"
  | "orders"
  | "inventory"
  | "stock-opname"
  | "waste"
  | "suppliers"
  | "purchase-orders"
  | "stock-transfer"
  | "customers"
  | "analytics"
  | "performance-menu"
  | "insight-analytics"
  | "performance-outlet"
  | "money-allocation"
  | "profile"
  | "staff"
  | "outlets"
  | "outlet"
  | "business-profile"
  | "receipt-settings"
  | "menu"
  | "printer-settings"
  | "tax"
  | "payment"
  | "integration"
  | "security"
  | "change-password"
  | "login-activity"
  | "language-settings";
type UserProfile = { email: string; displayName: string };

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const initialChatMessages: ChatMessageItem[] = [
  {
    id: "kitapos-ai-welcome",
    role: "assistant",
    text: "Selamat pagi, Admin. Saya sudah memantau revenue, stok, dan pola pelanggan hari ini. Tanyakan apa yang perlu diprioritaskan.",
  },
];

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value) || 0;
  }
  return 0;
}

function productFromRow(
  row: {
    id: string;
    name: string;
    category?: string | null;
    price: number;
    stock: number;
    ai_badge: string | null;
    image_url?: string | null;
    active?: boolean;
    deleted_at?: string | null;
  },
  customization?: any,
  recipe?: any,
  outletAssignments?: any[],
  relationalGroups?: MenuVariantGroup[],
): Product {
  const defaultVariants: ProductVariant[] = [];
  const defaultModifiers: ProductModifier[] = [];
  const defaultAddons: ProductVariant[] = [];

  // Resolve Variant Groups
  let resolvedGroups: MenuVariantGroup[] | undefined = undefined;
  if (Array.isArray(customization?.variant_groups) && customization.variant_groups.length > 0) {
    resolvedGroups = customization.variant_groups;
  } else if (Array.isArray(relationalGroups) && relationalGroups.length > 0) {
    resolvedGroups = relationalGroups;
  } else {
    resolvedGroups = [];
  }

  // Sort groups and options by sort_order
  if (resolvedGroups && resolvedGroups.length > 0) {
    resolvedGroups = [...resolvedGroups]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((g, gIdx) => ({
        ...g,
        sort_order: g.sort_order ?? gIdx,
        options: [...(g.options || [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((o, oIdx) => ({
            ...o,
            sort_order: o.sort_order ?? oIdx,
          })),
      }));
  }

  const promoPrice = (row as any).promo_price ?? customization?.promo_price ?? null;
  const taxRate = (row as any).tax_rate ?? customization?.tax_rate ?? 0;
  const imageCrop = (row as any).image_crop_position ?? customization?.image_crop_position ?? null;
  const cropX = Number((row as any).image_position_x ?? (row as any).crop_x ?? imageCrop?.x ?? 50);
  const cropY = Number((row as any).image_position_y ?? (row as any).crop_y ?? imageCrop?.y ?? 50);
  const resolvedCrop = imageCrop
    ? { ...imageCrop, x: cropX, y: cropY, image_position_x: cropX, image_position_y: cropY }
    : { x: cropX, y: cropY, image_position_x: cropX, image_position_y: cropY };
  const imageZoom =
    Number(
      (row as any).image_zoom ??
        (row as any).zoom ??
        customization?.image_zoom ??
        customization?.zoom,
    ) || 1.0;
  const imageRotation =
    Number(
      (row as any).image_rotation ??
        (row as any).rotation ??
        customization?.image_rotation ??
        customization?.rotation,
    ) || 0;
  const imageAspectRatio = "1:1";

  // Safe HPP / Cost Price calculation: Product row -> customization -> Recipe BOM items -> 0
  let calculatedCostPrice = Number(
    (row as any).cost_price ?? customization?.cost_price ?? (row as any).hpp ?? 0,
  );
  if (!calculatedCostPrice && recipe && Array.isArray(recipe.items)) {
    calculatedCostPrice = recipe.items.reduce((sum: number, it: any) => {
      const subtotal =
        Number(it.subtotal_cost) || Number(it.quantity || 0) * Number(it.unit_cost || 0);
      return sum + (Number(subtotal) || 0);
    }, 0);
  }
  const costPrice = Number(calculatedCostPrice) || 0;

  return {
    id: row.id,
    name: row.name,
    category: row.category || "",
    price: toNumber(row.price),
    cost_price: costPrice,
    promo_price: promoPrice ? Number(promoPrice) : null,
    tax_rate: Number(taxRate) || 0,
    stock: Number(row.stock),
    ai_badge: row.ai_badge,
    image_url: row.image_url ?? null,
    image_crop_position: resolvedCrop,
    crop_x: cropX,
    crop_y: cropY,
    image_position_x: cropX,
    image_position_y: cropY,
    image_zoom: imageZoom,
    zoom: imageZoom,
    image_rotation: imageRotation,
    rotation: imageRotation,
    image_aspect_ratio: imageAspectRatio,
    aspect_ratio: imageAspectRatio,
    variant_groups: resolvedGroups,
    variants:
      Array.isArray(customization?.variants) && customization.variants.length > 0
        ? customization.variants
        : defaultVariants,
    modifiers:
      Array.isArray(customization?.modifiers) && customization.modifiers.length > 0
        ? customization.modifiers
        : defaultModifiers,
    addons:
      Array.isArray(customization?.addons) && customization.addons.length > 0
        ? customization.addons
        : defaultAddons,
    recipe: recipe ?? null,
    outlet_assignments: Array.isArray(outletAssignments) ? outletAssignments : undefined,
    active: row.active !== false,
    deleted_at: row.deleted_at ?? null,
  };
}

function customerFromRow(row: {
  id: string;
  name: string;
  phone?: string | null;
  visits: number;
  total_spend: number;
  points?: number;
  favorite_product: string | null;
  ai_insight: string | null;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || null,
    visits: Number(row.visits),
    total_spend: toNumber(row.total_spend),
    points: Number(row.points) || Math.floor(toNumber(row.total_spend) / 10000),
    favorite_product: row.favorite_product,
    ai_insight: row.ai_insight,
  };
}

function inventoryFromRow(row: {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum_stock: number;
  health_score: number;
  ai_alert: string | null;
}): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    stock: toNumber(row.stock),
    minimum_stock: toNumber(row.minimum_stock),
    health_score: Number(row.health_score),
    ai_alert: row.ai_alert,
  };
}

function orderFromRow(row: {
  id: string;
  order_number: string;
  total: number;
  payment_method: "cash" | "qris" | "ewallet" | "card";
  status: "draft" | "paid" | "refunded" | "cancelled";
  channel: string;
  created_at: string;
  customer_id?: string | null;
  outlet_id?: string | null;
}): SalesOrder {
  return {
    id: row.id,
    order_number: row.order_number,
    total: toNumber(row.total),
    payment_method: row.payment_method,
    status: row.status,
    channel: row.channel,
    created_at: row.created_at,
    customer_id: row.customer_id,
    outlet_id: row.outlet_id,
  };
}

function insightFromRow(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: number;
  action_label: string | null;
}): AiInsight {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    confidence: Number(row.confidence),
    action_label: row.action_label,
  };
}

async function seedWorkspace(businessId: string) {
  // Auto-seeding of dummy data removed for production readiness.
  // Ensure default primary outlet exists if none created yet
  const { data: existingOutlets } = await supabase
    .from("outlets")
    .select("id")
    .eq("business_id", businessId)
    .limit(1);

  if (!existingOutlets || existingOutlets.length === 0) {
    await supabase.from("outlets").insert({
      business_id: businessId,
      name: "Outlet Utama",
      code: "OUT-01",
      address: "Jakarta Pusat",
      active: true,
    });
  }
}

async function loadSnapshot(userId: string, profile: UserProfile): Promise<Snapshot> {
  await supabase.from("profiles").upsert(
    {
      user_id: userId,
      display_name: profile.displayName,
      language: "id",
      timezone: "Asia/Jakarta",
    },
    { onConflict: "user_id" },
  );

  // 1. Fetch businesses owned by this user
  const { data: ownedBusinesses, error: ownedError } = await supabase
    .from("businesses")
    .select("id, name, category, city, owner_id, logo, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (ownedError) throw ownedError;

  // 2. Fetch businesses where user is an active member
  const { data: memberRecords } = await (supabase
    .from("business_members" as any)
    .select("business_id, role, outlet_id, businesses(*)")
    .eq("user_id", userId) as any);

  let userBusinesses = [...(ownedBusinesses || [])];
  for (const m of memberRecords || []) {
    let b = (m as any).businesses;
    if (!b && m.business_id) {
      // If RLS blocked nested businesses(*), try querying directly by id
      const { data: bz } = await supabase
        .from("businesses")
        .select("id, name, category, city, owner_id, logo, created_at")
        .eq("id", m.business_id)
        .maybeSingle();
      b = bz || {
        id: m.business_id,
        name: "KebabsChoicePOS",
        category: "restaurant",
        city: "Jakarta",
        owner_id: "",
        logo: null,
        created_at: new Date().toISOString(),
      };
    }
    if (b && !userBusinesses.some((existing) => existing.id === b.id)) {
      userBusinesses.push(b);
    }
  }

  // 2b. Check if user is an outlet device account
  let matchedOutletAccount: any = null;
  const userEmailLower = profile.email?.toLowerCase();
  try {
    const { data: allOutlets } = await supabase
      .from("outlets")
      .select("id, name, business_id, settings")
      .order("created_at", { ascending: true });

    if (allOutlets && allOutlets.length > 0) {
      matchedOutletAccount = allOutlets.find((o: any) => {
        const s = o.settings;
        if (!s || typeof s !== "object") return false;
        if (userEmailLower && s.outlet_login_email && s.outlet_login_email.toLowerCase() === userEmailLower) return true;
        if (userEmailLower && s.outlet_login_account?.email && s.outlet_login_account.email.toLowerCase() === userEmailLower) return true;
        if (s.outlet_login_account?.user_id === userId) return true;
        return false;
      });

      if (matchedOutletAccount && matchedOutletAccount.business_id) {
        if (!userBusinesses.some((existing) => existing.id === matchedOutletAccount.business_id)) {
          const { data: bz } = await supabase
            .from("businesses")
            .select("id, name, category, city, owner_id, logo, created_at")
            .eq("id", matchedOutletAccount.business_id)
            .maybeSingle();
          userBusinesses.push(
            bz || {
              id: matchedOutletAccount.business_id,
              name: "KebabsChoicePOS",
              category: "restaurant",
              city: "Jakarta",
              owner_id: "",
              logo: null,
              created_at: new Date().toISOString(),
            },
          );
        }
      }
    }
  } catch {}

  // 3. Fallback: ONLY if user is genuinely a new owner with zero businesses, zero memberships, and not an outlet account
  const isOutletRole = (profile as any).role === "cashier" || String(profile.displayName || "").toLowerCase().startsWith("pos outlet");
  if (userBusinesses.length === 0 && (!memberRecords || memberRecords.length === 0) && !matchedOutletAccount && !isOutletRole) {
    const { data: allBiz } = await supabase
      .from("businesses")
      .select("id, name, category, city, owner_id, logo, created_at")
      .order("created_at", { ascending: true })
      .limit(1);

    if (allBiz && allBiz.length > 0) {
      userBusinesses = allBiz;
    } else {
      const { data: business, error } = await supabase
        .from("businesses")
        .insert({
          owner_id: userId,
          name: "KebabsChoicePOS Flagship Cafe",
          category: "restaurant",
          city: "Jakarta",
        })
        .select("id, name, category, city, owner_id, logo, created_at")
        .single();
      if (error) {
        throw error;
      }

      await supabase
        .from("business_members")
        .upsert({ business_id: business.id, user_id: userId, role: "owner" });
      await supabase.from("user_roles").upsert({ user_id: userId, role: "owner" });
      await seedWorkspace(business.id);
      userBusinesses = [business];
    }
  }

  const allUserBusinessIds = Array.from(new Set(userBusinesses.map((b) => b.id)));
  const savedBizId =
    typeof window !== "undefined"
      ? localStorage.getItem("kebabschoicepos_active_business_id")
      : null;
  const business = userBusinesses.find((b) => b.id === savedBizId) || userBusinesses[0];

  if (!business) {
    return emptySnapshot;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("kebabschoicepos_active_business_id", business.id);
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: staffProfile } = await supabase
    .from("staff_profiles" as any)
    .select("outlet_id")
    .eq("business_id", business.id)
    .eq("user_id", userId)
    .maybeSingle();

  const [
    productsResult,
    customersResult,
    inventoryResult,
    ordersResult,
    insightsResult,
    outletsResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, business_id, name, category, price, stock, ai_badge, image_url, active")
      .in("business_id", allUserBusinessIds)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("customers")
      .select("id, name, phone, visits, total_spend, favorite_product, ai_insight")
      .in("business_id", allUserBusinessIds)
      .order("total_spend", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, category, unit, stock, minimum_stock, health_score, ai_alert")
      .in("business_id", allUserBusinessIds)
      .order("health_score", { ascending: true }),
    supabase
      .from("sales_orders")
      .select("*")
      .in("business_id", allUserBusinessIds)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("ai_insights")
      .select("id, type, title, body, confidence, action_label")
      .in("business_id", allUserBusinessIds)
      .order("created_at", { ascending: false })
      .limit(8),
    (supabase
      .from("outlets" as any) as any)
      .select("*")
      .in("business_id", allUserBusinessIds)
      .order("created_at", { ascending: true }),
  ]);

  if (productsResult.error)
    console.warn("[loadSnapshot] products query warning:", productsResult.error);
  if (customersResult.error)
    console.warn("[loadSnapshot] customers query warning:", customersResult.error);
  if (inventoryResult.error)
    console.warn("[loadSnapshot] inventory query warning:", inventoryResult.error);
  if (ordersResult.error) console.warn("[loadSnapshot] orders query warning:", ordersResult.error);
  if (insightsResult.error)
    console.warn("[loadSnapshot] insights query warning:", insightsResult.error);
  if (outletsResult.error)
    console.warn("[loadSnapshot] outlets query warning:", outletsResult.error);

  const storedRecipes: Record<string, any> = {};
  const storedCustomizations: Record<string, any> = {};
  const storedOutletAssignments: Record<string, any[]> = {};
  const storedOrderMetadata: Record<string, any> = {};

  for (const o of outletsResult.data || []) {
    const setObj = (o.settings as any) || {};
    if (setObj.menu_recipes) Object.assign(storedRecipes, setObj.menu_recipes);
    if (setObj.menu_customizations) Object.assign(storedCustomizations, setObj.menu_customizations);
    if (setObj.order_metadata) Object.assign(storedOrderMetadata, setObj.order_metadata);
    if (setObj.outlet_menu_assignments) {
      for (const [prodId, assignList] of Object.entries(setObj.outlet_menu_assignments)) {
        storedOutletAssignments[prodId] = assignList as any[];
      }
    }
    if (setObj.tax_settings) {
      try {
        localStorage.setItem("kebabschoicepos_tax_settings", JSON.stringify(setObj.tax_settings));
      } catch {}
    }
    if (setObj.payment_settings) {
      try {
        localStorage.setItem("kebabschoicepos_payment_settings", JSON.stringify(setObj.payment_settings));
      } catch {}
    }
    if (setObj.printer_settings) {
      try {
        localStorage.setItem("kebabschoicepos_printer_settings", JSON.stringify(setObj.printer_settings));
      } catch {}
    }
  }

  function deduplicateEntitiesById<T extends { id?: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const res: T[] = [];
    for (const item of items) {
      if (item && item.id) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          res.push(item);
        }
      } else if (item) {
        res.push(item);
      }
    }
    return res;
  }

  const rawOutlets: OutletItem[] = (outletsResult.data || []).map((o: any) => ({
    id: o.id,
    name: o.name,
    code: o.code || "",
    address: o.address || "",
    active: o.active !== false && o.is_active !== false,
    settings: (o.settings as any) || {},
  }));
  const mappedOutlets: OutletItem[] = deduplicateEntitiesById(rawOutlets);

  const relationalGroups: Record<string, MenuVariantGroup[]> = {};
  try {
    const { data: vGroups } = await supabase
      .from("menu_variant_groups" as any)
      .select("id, menu_item_id, name, selection_type, is_required, sort_order")
      .order("sort_order", { ascending: true });

    if (vGroups && vGroups.length > 0) {
      const gIds = (vGroups as any[]).map((g) => g.id);
      const { data: vOpts } = await supabase
        .from("menu_variant_options" as any)
        .select("id, group_id, name, additional_price, is_default, sort_order")
        .in("group_id", gIds)
        .order("sort_order", { ascending: true });

      const optionsByGroup: Record<string, MenuVariantOption[]> = {};
      for (const opt of (vOpts as any[]) || []) {
        if (!optionsByGroup[opt.group_id]) optionsByGroup[opt.group_id] = [];
        optionsByGroup[opt.group_id]!.push({
          id: opt.id,
          name: opt.name,
          additional_price: Number(opt.additional_price) || 0,
          price_adjustment: Number(opt.additional_price) || 0,
          is_default: opt.is_default || false,
        });
      }

      for (const g of vGroups as any[]) {
        if (!relationalGroups[g.menu_item_id]) relationalGroups[g.menu_item_id] = [];
        relationalGroups[g.menu_item_id]!.push({
          id: g.id,
          menu_item_id: g.menu_item_id,
          name: g.name,
          selection_type: g.selection_type || "single",
          is_required: g.is_required || false,
          sort_order: g.sort_order || 0,
          options: optionsByGroup[g.id] || [],
        });
      }
    }
  } catch (err) {
    console.warn("[POS] Could not query menu_variant_groups table:", err);
  }

  const rawProducts = (productsResult.data ?? []).map((row) =>
    productFromRow(
      row,
      storedCustomizations[row.id],
      storedRecipes[row.id],
      storedOutletAssignments[row.id],
      relationalGroups[row.id],
    ),
  );
  const mappedProducts = deduplicateEntitiesById(rawProducts);
  const mappedCustomers = deduplicateEntitiesById(
    (customersResult.data ?? []).map(customerFromRow),
  );
  const mappedInventory = deduplicateEntitiesById(
    (inventoryResult.data ?? []).map(inventoryFromRow),
  );
  let localSavedOrders: SalesOrder[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_recent_orders");
      if (raw) localSavedOrders = JSON.parse(raw);
    } catch {}
  }

  const rawDbOrders = (ordersResult.data ?? []).map((row: any) => {
    const ord = orderFromRow(row);
    if (!ord.outlet_id && storedOrderMetadata[row.id]?.outlet_id) {
      ord.outlet_id = storedOrderMetadata[row.id].outlet_id;
    }
    return ord;
  });

  const mappedOrders = deduplicateEntitiesById([...localSavedOrders, ...rawDbOrders]);

  // Strict resolution priority for assigned outlet:
  // Tier 0: Direct Outlet Device Account match
  let resolvedAssignedOutletId: string | null = matchedOutletAccount ? matchedOutletAccount.id : null;

  // Tier 1: staff_profiles outlet_id
  if (!resolvedAssignedOutletId && (staffProfile as any)?.outlet_id) {
    resolvedAssignedOutletId = (staffProfile as any).outlet_id;
  }

  // Tier 2: business_members outlet_id
  if (!resolvedAssignedOutletId && memberRecords && memberRecords.length > 0) {
    for (const m of memberRecords) {
      if ((m as any).outlet_id) {
        resolvedAssignedOutletId = (m as any).outlet_id;
        break;
      }
    }
  }

  // Tier 3: assigned_staff_ids or manager_user_id in outlets
  if (!resolvedAssignedOutletId && outletsResult.data) {
    for (const o of outletsResult.data) {
      const setObj = (o.settings as any) || {};
      const staffList = Array.isArray(setObj.assigned_staff_ids) ? setObj.assigned_staff_ids : [];
      if (staffList.includes(userId) || setObj.manager_user_id === userId) {
        resolvedAssignedOutletId = o.id;
        break;
      }
    }
  }

  // Tier 4: Also check localStorage fallback
  if (!resolvedAssignedOutletId && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kebabschoicepos_staff_outlet_assignments");
      if (raw) {
        const map = JSON.parse(raw);
        if (map[userId]) {
          resolvedAssignedOutletId = map[userId];
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const isPendingConfirmation =
    matchedOutletAccount?.settings?.outlet_login_account?.status === "pending_confirmation";
  const pendingConfirmationOutletName = matchedOutletAccount?.name;

  return {
    businessId: business.id,
    businessName: business.name,
    logo: (business as any).logo ?? null,
    city: business.city ?? "Jakarta",
    role:
      (typeof window !== "undefined" && localStorage.getItem("kebabschoicepos_simulated_role")) ||
      membership?.role ||
      "owner",
    assignedOutletId: resolvedAssignedOutletId,
    outlets: mappedOutlets,
    products: mappedProducts,
    customers: mappedCustomers,
    inventory: mappedInventory,
    orders: mappedOrders,
    insights: (insightsResult.data ?? []).map(insightFromRow),
    isPendingConfirmation,
    pendingConfirmationOutletName,
  };
}

type UIMessage = {
  parts: Array<any>;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("");
}

function getReasoningText(message: UIMessage) {
  return message.parts
    .filter((part: any) => part.type === "reasoning")
    .map((part: any) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("");
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  trend: string;
  icon: typeof TrendingUp;
  tone?: "primary" | "success" | "ai";
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-normal">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl",
            tone === "success"
              ? "bg-success-soft text-success-foreground"
              : tone === "ai"
                ? "bg-ai-soft text-ai"
                : "bg-primary-soft text-primary",
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-success-foreground">
        <TrendingUp className="size-4" />
        {trend}
      </div>
    </motion.div>
  );
}

function Header({
  snapshot,
  profile,
  active,
  onSignOut,
  onOpenThemeModal,
  onOpenSearchModal,
  isSidebarCollapsed,
  onToggleSidebar,
  isTabletFocusMode,
  onToggleTabletFocusMode,
  activeCashierName,
  onOpenCashierSwitchModal,
  onOpenBranchPosSwitchModal,
}: {
  snapshot: Snapshot;
  profile: UserProfile;
  active: NavKey;
  onSignOut: () => Promise<void>;
  onOpenThemeModal?: () => void;
  onOpenSearchModal?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isTabletFocusMode?: boolean;
  onToggleTabletFocusMode?: () => void;
  activeCashierName?: string;
  onOpenCashierSwitchModal?: () => void;
  onOpenBranchPosSwitchModal?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isHQ = ["owner", "admin", "manager"].includes(normalizedRole);
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);
  const currentLang = (i18n.language || "id").slice(0, 2).toUpperCase();

  const isPosPage = [
    "pos",
    "pos-orders",
    "pos-receipt",
    "pos-shift-cash",
    "pos-inventory",
    "pos-profile",
    "pos-attendance-in",
    "pos-attendance-out",
    "pos-attendance-history",
    "pos-attendance-shifts",
  ].includes(active);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border bg-background/86 backdrop-blur-2xl transition-all duration-300",
        isTabletFocusMode ? "py-1" : "py-0",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 lg:px-8 transition-all duration-300",
          isTabletFocusMode ? "min-h-14" : "min-h-20",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {/* Sidebar Buka/Tutup Toggle Button */}
          {onToggleSidebar && (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "size-10 shrink-0 rounded-2xl border-border bg-card/80 hover:bg-secondary text-xs font-bold transition-all shadow-xs cursor-pointer",
                isSidebarCollapsed && "border-primary/50 text-primary bg-primary/10 shadow-sm",
              )}
              onClick={onToggleSidebar}
              title={
                isSidebarCollapsed
                  ? "Buka Sidebar (Menu Navigasi)"
                  : "Tutup Sidebar (Perluas Area Layar POS)"
              }
              aria-label={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="size-4.5 text-primary" />
              ) : (
                <PanelLeftClose className="size-4.5 text-foreground" />
              )}
            </Button>
          )}

          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-brand">
            {snapshot.logo ? (
              <img
                src={snapshot.logo}
                alt={snapshot.businessName}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-lg font-black">
                {snapshot.businessName ? snapshot.businessName.charAt(0).toUpperCase() : "K"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-normal">{snapshot.businessName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {snapshot.city} · {snapshot.role}
            </p>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-center px-8 md:flex">
          <button
            type="button"
            onClick={onOpenSearchModal}
            className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 px-4 py-2 shadow-soft hover:bg-secondary/70 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <Search className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <span className="truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t("common.search", "Cari transaksi, menu, pelanggan, atau outlet...")}
              </span>
            </div>
            <kbd className="hidden sm:inline-flex items-center rounded-lg border border-border bg-secondary/80 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Search on Mobile */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl border-border bg-card/70 hover:bg-secondary text-xs font-bold transition-all shadow-xs md:hidden"
            onClick={onOpenSearchModal}
            title="Cari"
            aria-label="Cari"
          >
            <Search className="size-3.5 text-primary" />
          </Button>

          {/* Mode Switcher: POS vs HQ */}
          {isOwner && isPosPage && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/dashboard"
                className="h-9 px-3 sm:px-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-brand transition-all cursor-pointer"
                title="Kembali ke Dashboard HQ"
              >
                <Building2 className="size-4 shrink-0" />
                <span className="hidden sm:inline">🏢 Kembali ke HQ</span>
                <span className="sm:hidden font-bold">🏢 HQ</span>
              </Link>
              {onOpenBranchPosSwitchModal && (
                <button
                  type="button"
                  onClick={onOpenBranchPosSwitchModal}
                  className="h-9 px-2.5 sm:px-3 rounded-2xl border border-border bg-card/80 hover:bg-secondary text-foreground font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer max-w-[160px] sm:max-w-[210px]"
                  title="Ganti Cabang POS"
                >
                  <Store className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">📍 {(() => {
                    if (typeof window !== "undefined") {
                      try {
                        const activeRaw = localStorage.getItem("kebabschoicepos_active_outlet");
                        if (activeRaw) {
                          const parsed = JSON.parse(activeRaw);
                          if (parsed?.name) return parsed.name;
                        }
                        const selId =
                          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
                          localStorage.getItem("kebabschoicepos_active_outlet_id");
                        if (selId && selId !== "all") {
                          const found = snapshot.outlets?.find((o) => o.id === selId);
                          if (found) return found.name;
                        }
                      } catch {}
                    }
                    const assigned = snapshot.outlets?.find((o) => o.id === snapshot.assignedOutletId);
                    return assigned?.name || snapshot.outlets?.[0]?.name || "Cabang";
                  })()}</span>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                </button>
              )}
            </div>
          )}

          {isOwner && !isPosPage && onOpenBranchPosSwitchModal && (
            <Button
              variant="hero"
              size="sm"
              onClick={onOpenBranchPosSwitchModal}
              className="h-9 px-3 sm:px-3.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs gap-1.5 shadow-brand hover:opacity-95 cursor-pointer shrink-0"
              title="Masuk POS Kasir (Pilih Cabang Langsung Masuk)"
            >
              <Monitor className="size-4" />
              <span className="hidden sm:inline">🖥️ Masuk POS</span>
            </Button>
          )}

          {/* Notifikasi Bell */}
          <Button variant="outline" size="icon" className="rounded-2xl" aria-label="Notifikasi">
            <BellRing className="size-4" />
          </Button>

          {/* Active Cashier Badge with Fast Switch (Only in POS) */}
          {(isPosPage || !isHQ) && activeCashierName && (
            <button
              type="button"
              onClick={onOpenCashierSwitchModal}
              title="Ganti Kasir Bertugas"
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-foreground transition-all cursor-pointer shadow-xs text-left"
            >
              <div className="size-6 sm:size-7 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                <UserCheck className="size-3.5" />
              </div>
              <div className="hidden md:block min-w-0 max-w-[100px]">
                <p className="text-[9px] font-black uppercase text-primary tracking-wider leading-none">
                  Kasir
                </p>
                <p className="text-xs font-black truncate text-foreground leading-tight">
                  {activeCashierName}
                </p>
              </div>
            </button>
          )}

          {/* Dropdown Menu Profil Ramping (Tema, Bahasa, Fullscreen, Profil, Logout) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-2xl border border-border bg-card/80 hover:bg-secondary transition-all cursor-pointer shadow-xs text-left group"
              >
                <div className="size-7 sm:size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <UserRound className="size-3.5 sm:size-4" />
                </div>
                <div className="hidden sm:block min-w-0 max-w-[110px]">
                  <p className="text-xs font-black truncate text-foreground leading-tight">
                    {profile.displayName || "Pengguna"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate uppercase font-semibold">
                    {snapshot.role}
                  </p>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-float border-border bg-popover z-50">
              <div className="px-2 py-1.5 border-b border-border mb-1">
                <p className="text-xs font-black text-foreground truncate">{profile.displayName || "Pengguna"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{profile.email}</p>
                <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase">
                  {snapshot.role}
                </span>
              </div>

              {onToggleTabletFocusMode && (
                <DropdownMenuItem
                  onClick={onToggleTabletFocusMode}
                  className="rounded-xl flex items-center gap-2.5 text-xs font-semibold py-2 cursor-pointer"
                >
                  {isTabletFocusMode ? <Minimize2 className="size-4 text-primary" /> : <Maximize2 className="size-4 text-primary" />}
                  <span>{isTabletFocusMode ? "Keluar Fullscreen" : "Layar Penuh (Tablet)"}</span>
                </DropdownMenuItem>
              )}

              {onOpenThemeModal && (
                <DropdownMenuItem
                  onClick={onOpenThemeModal}
                  className="rounded-xl flex items-center gap-2.5 text-xs font-semibold py-2 cursor-pointer"
                >
                  <Palette className="size-4 text-primary" />
                  <span>Kustomisasi Tema UI</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild>
                <Link
                  to="/language-settings"
                  className="rounded-xl flex items-center justify-between text-xs font-semibold py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe2 className="size-4 text-primary" />
                    <span>Bahasa Sistem</span>
                  </div>
                  <span className="font-extrabold text-[10px] bg-secondary px-1.5 py-0.5 rounded">{currentLang}</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  to="/profile"
                  className="rounded-xl flex items-center gap-2.5 text-xs font-semibold py-2 cursor-pointer"
                >
                  <UserRound className="size-4 text-primary" />
                  <span>Pengaturan Profil</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-border" />

              <DropdownMenuItem
                onClick={onSignOut}
                className="rounded-xl flex items-center gap-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive py-2 cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>{t("nav.logout", "Keluar / Logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function AccordionGroup({
  title,
  icon: Icon,
  isOpen,
  isActive,
  onToggle,
  children,
}: {
  title: string;
  icon: any;
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex flex-row w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-all select-none whitespace-nowrap overflow-hidden",
          isActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <div className="flex flex-row items-center gap-2.5 min-w-0 flex-1 whitespace-nowrap overflow-hidden">
          <Icon className="size-4 shrink-0 text-primary" />
          <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap inline-block">
            {title}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ml-auto",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {isOpen && (
        <div className="ml-3 pl-3 border-l-2 border-primary/20 space-y-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function getNavLabel(key: NavKey, defaultLabel: string, t: any): string {
  const map: Record<string, string> = {
    dashboard: "nav.dashboard_hq",
    "business-summary": "nav.business_summary",
    orders: "nav.sales",
    "performance-outlet": "nav.performance_outlet",
    "performance-menu": "nav.performance_menu",
    "insight-analytics": "nav.insight_analytics",
    inventory: "nav.inventory",
    "stock-opname": "nav.stock_opname",
    waste: "nav.waste",
    suppliers: "nav.suppliers",
    "purchase-orders": "nav.purchase_orders",
    "stock-transfer": "nav.stock_transfer",
    menu: "nav.menu_management",
    outlets: "nav.outlet_management",
    outlet: "nav.outlet_management",
    staff: "nav.staff_management",
    "business-profile": "nav.business_profile",
    business: "nav.business_profile",
    "receipt-settings": "nav.receipt_settings",
    "printer-settings": "nav.printer_settings",
    tax: "nav.tax_settings",
    payment: "nav.payment_settings",
    integration: "nav.integration_settings",
    profile: "nav.profile",
    language: "nav.language",
    "language-settings": "nav.language",
    security: "nav.security",
    "change-password": "nav.change_password",
    "login-activity": "nav.login_activity",
    pos: "common.pos",
    "pos-attendance-in": "pos.attendance_in",
    "pos-attendance-out": "pos.attendance_out",
    "pos-attendance-history": "pos.attendance_history",
    "pos-attendance-shifts": "pos.attendance_shifts",
    analytics: "common.analytics",
  };
  const translationKey = map[key];
  if (translationKey) {
    const val = t(translationKey);
    if (val && val !== translationKey) return val;
  }
  return defaultLabel;
}

function Sidebar({
  active,
  role,
  snapshot,
  profile,
  onSignOut,
  onOpenThemeModal,
  isCollapsed,
  onToggleCollapse,
  activeCashierName,
  onOpenCashierSwitchModal,
  onOpenBranchPosSwitchModal,
}: {
  active: NavKey;
  role: string;
  snapshot?: Snapshot;
  profile?: UserProfile;
  onSignOut: () => Promise<void>;
  onOpenThemeModal?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeCashierName?: string;
  onOpenCashierSwitchModal?: () => void;
  onOpenBranchPosSwitchModal?: () => void;
}) {
  const { t } = useTranslation();
  const normalizedRole = (role || "").toLowerCase();
  const isHQ = ["owner", "admin", "manager"].includes(normalizedRole);
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);
  const isCashier = normalizedRole === "cashier" || (!isHQ && normalizedRole === "staff");
  const isManager = normalizedRole === "manager";

  const isPosAttendance = [
    "pos-attendance-in",
    "pos-attendance-out",
    "pos-attendance-history",
    "pos-attendance-shifts",
  ].includes(active);

  // Show POS OUTLET SYSTEM if cashier, or if an user is on any POS page
  const isPosPage = [
    "pos",
    "pos-orders",
    "pos-receipt",
    "pos-shift-cash",
    "pos-inventory",
    "pos-profile",
    "pos-attendance-in",
    "pos-attendance-out",
    "pos-attendance-history",
    "pos-attendance-shifts",
  ].includes(active);
  const isPosMode = isCashier || isPosPage;

  // Active shift state for POS banner
  const [hasActiveShift, setHasActiveShift] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kebabschoicepos_active_shift");
      if (saved) {
        const parsed = JSON.parse(saved);
        setHasActiveShift(parsed.status === "open");
      } else {
        setHasActiveShift(false);
      }
    } catch {
      setHasActiveShift(false);
    }
  }, [active]);

  // --- HQ ACCORDION STATES ---
  const isReportActive = [
    "dashboard",
    "analytics",
    "business-summary",
    "orders",
    "performance-outlet",
    "performance-menu",
    "insight-analytics",
    "money-allocation",
  ].includes(active);
  const isStockActive = [
    "inventory",
    "stock-opname",
    "waste",
    "suppliers",
    "purchase-orders",
    "stock-transfer",
  ].includes(active);
  const isBusinessActive = [
    "menu",
    "outlets",
    "outlet",
    "staff",
    "business",
    "business-profile",
  ].includes(active);
  const isSettingsActive = [
    "receipt-settings",
    "printer-settings",
    "tax",
    "payment",
    "integration",
  ].includes(active);
  const isAccountActive = [
    "profile",
    "security",
    "change-password",
    "login-activity",
    "language",
    "language-settings",
  ].includes(active);

  const [reportOpen, setReportOpen] = useState(isReportActive || active === "dashboard");
  const [stockOpen, setStockOpen] = useState(isStockActive);
  const [businessOpen, setBusinessOpen] = useState(isBusinessActive);
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);
  const [accountOpen, setAccountOpen] = useState(isAccountActive);

  // Auto-expand triggers for HQ
  useEffect(() => {
    if (isReportActive) setReportOpen(true);
  }, [isReportActive]);
  useEffect(() => {
    if (isStockActive) setStockOpen(true);
  }, [isStockActive]);
  useEffect(() => {
    if (isBusinessActive) setBusinessOpen(true);
  }, [isBusinessActive]);
  useEffect(() => {
    if (isSettingsActive) setSettingsOpen(true);
  }, [isSettingsActive]);
  useEffect(() => {
    if (isAccountActive) setAccountOpen(true);
  }, [isAccountActive]);

  // --- POS ACCORDION STATES ---
  const [posTransaksiOpen, setPosTransaksiOpen] = useState(true);
  const [posRiwayatOpen, setPosRiwayatOpen] = useState(
    active === "pos-orders" || active === "pos-receipt",
  );
  const [posShiftOpen, setPosShiftOpen] = useState(active === "pos-shift-cash");
  const [posInventoryOpen, setPosInventoryOpen] = useState(active === "pos-inventory");
  const [posAkunOpen, setPosAkunOpen] = useState(active === "pos-profile");
  const [posAbsensiOpen, setPosAbsensiOpen] = useState(isPosAttendance);

  useEffect(() => {
    if (active === "pos") setPosTransaksiOpen(true);
    if (active === "pos-orders" || active === "pos-receipt") setPosRiwayatOpen(true);
    if (active === "pos-shift-cash") setPosShiftOpen(true);
    if (active === "pos-inventory") setPosInventoryOpen(true);
    if (active === "pos-profile") setPosAkunOpen(true);
    if (isPosAttendance) setPosAbsensiOpen(true);
  }, [active, isPosAttendance]);

  const managerPermissions: string[] = useMemo(() => {
    if (!isManager) return [];
    try {
      const stored = localStorage.getItem("kebabschoicepos_manager_permissions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      if (snapshot?.outlets && Array.isArray(snapshot.outlets)) {
        for (const out of snapshot.outlets) {
          const outAny = out as any;
          const s =
            outAny.settings && typeof outAny.settings === "object" && !Array.isArray(outAny.settings)
              ? outAny.settings
              : null;
          if (s?.manager_permissions) {
            const vals = Object.values(s.manager_permissions);
            if (vals.length > 0 && Array.isArray(vals[0])) {
              return vals[0] as string[];
            }
          }
        }
      }
    } catch {}
    return ["reports", "inventory", "menu", "staff_schedule"];
  }, [isManager, snapshot]);

  const reportItems = navItems.filter((item) => item.group === "report");
  const stockItems = navItems.filter((item) => item.group === "stock");
  const businessItems = navItems.filter((item) => item.group === "business");
  const settingsItems = navItems.filter((item) => item.group === "settings");
  const accountItems = navItems.filter((item) => item.group === "account");

  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 border-r border-border bg-background/72 backdrop-blur-xl transition-all duration-300 ease-in-out lg:block overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        isCollapsed
          ? "w-0 p-0 border-r-0 opacity-0 overflow-hidden pointer-events-none lg:w-0"
          : "w-72 p-4 opacity-100",
      )}
    >
      {/* Top Header inside Sidebar with Close/Collapse button */}
      {!isCollapsed && onToggleCollapse && (
        <div className="mb-3 flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            {isPosMode ? "Navigasi POS Kasir" : "Menu Utama HQ"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={onToggleCollapse}
            title="Tutup Sidebar (Perluas Layar Tablet)"
            aria-label="Tutup Sidebar"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>
      )}
      <nav className="space-y-6 pb-6 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isPosMode ? (
          /* ==================================================
             POS OUTLET SYSTEM (Strict Cashier / POS View)
             ================================================== */
          <>
            {/* POS Outlet & Cashier Live Banner */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 mb-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-primary shrink-0" />
                <span className="text-xs font-black truncate text-foreground">
                  {snapshot?.outlets?.find((o) => o.id === snapshot?.assignedOutletId)?.name ||
                    snapshot?.outlets?.[0]?.name ||
                    "Outlet Utama"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
                <button
                  type="button"
                  onClick={onOpenCashierSwitchModal}
                  title="Ganti Kasir Bertugas"
                  className="flex items-center gap-1 font-semibold truncate hover:text-primary transition-colors cursor-pointer text-left min-w-0"
                >
                  <UserRound className="size-3 text-primary shrink-0" />
                  <span className="truncate">{activeCashierName || profile?.displayName || "Kasir POS"}</span>
                  <span className="text-[9px] px-1 rounded bg-primary/20 text-primary font-bold ml-1 shrink-0">
                    Ganti
                  </span>
                </button>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full font-bold text-[10px]",
                    hasActiveShift
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {hasActiveShift ? "🟢 Shift Buka" : "🔴 Shift Tutup"}
                </span>
              </div>
            </div>

            {/* POS Kasir */}
            <div className="space-y-1">
              <Link
                to="/pos"
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap",
                  active === "pos"
                    ? "bg-primary text-primary-foreground shadow-brand font-black"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <ShoppingCart className="size-4 shrink-0" />
                <span className="truncate uppercase tracking-wide">
                  {t("pos.dashboard_pos", "POS Kasir")}
                </span>
              </Link>
            </div>

            {/* TRANSAKSI */}
            <AccordionGroup
              title={t("pos.transactions", "Transaksi")}
              icon={CreditCard}
              isOpen={posTransaksiOpen}
              isActive={active === "pos"}
              onToggle={() => setPosTransaksiOpen((prev) => !prev)}
            >
              <Link
                to="/pos"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Plus className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.new_order", "Order Baru")}</span>
              </Link>
            </AccordionGroup>

            {/* RIWAYAT TRANSAKSI & CETAK STRUK */}
            <AccordionGroup
              title={t("pos.transaction_history", "Riwayat & Struk")}
              icon={ReceiptText}
              isOpen={posRiwayatOpen}
              isActive={active === "pos-orders" || active === "pos-receipt"}
              onToggle={() => setPosRiwayatOpen((prev) => !prev)}
            >
              <Link
                to="/pos/orders"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-orders"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Calendar className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.today_orders", "Order Hari Ini")}</span>
              </Link>
              <Link
                to="/pos/receipt"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-receipt"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Receipt className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.print_receipt", "Cetak Struk")}</span>
              </Link>
            </AccordionGroup>

            {/* ABSENSI KARYAWAN & FACE SCAN */}
            <AccordionGroup
              title={t("pos.attendance", "Absensi")}
              icon={UserCheck}
              isOpen={posAbsensiOpen}
              isActive={isPosAttendance}
              onToggle={() => setPosAbsensiOpen((prev) => !prev)}
            >
              <Link
                to="/pos/attendance-in"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-attendance-in"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Camera className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.attendance_in", "Absensi Masuk")}</span>
              </Link>
              <Link
                to="/pos/attendance-out"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-attendance-out"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <LogOut className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.attendance_out", "Absensi Keluar")}</span>
              </Link>
              <Link
                to="/pos/attendance-history"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-attendance-history"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <History className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.attendance_history", "Riwayat Absensi")}</span>
              </Link>
              <Link
                to="/pos/attendance-shifts"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-attendance-shifts"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Calendar className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.attendance_shifts", "Jadwal Shift")}</span>
              </Link>
            </AccordionGroup>

            {/* SHIFT & CASH */}
            <AccordionGroup
              title={t("pos.shift_cash", "Shift Cash")}
              icon={WalletCards}
              isOpen={posShiftOpen}
              isActive={active === "pos-shift-cash"}
              onToggle={() => setPosShiftOpen((prev) => !prev)}
            >
              <Link
                to="/pos/shift-cash"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-shift-cash"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Clock className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.shift_cash", "Shift Cash & Kas")}</span>
              </Link>
            </AccordionGroup>

            {/* INVENTORY OUTLET (View-only / Stok Outlet) */}
            <AccordionGroup
              title={t("pos.outlet_inventory", "Inventory Outlet")}
              icon={Boxes}
              isOpen={posInventoryOpen}
              isActive={active === "pos-inventory"}
              onToggle={() => setPosInventoryOpen((prev) => !prev)}
            >
              <Link
                to="/pos/inventory"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-inventory"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Boxes className="size-3.5 shrink-0" />
                <span className="truncate">{t("pos.outlet_stock", "Stok Outlet")}</span>
              </Link>
            </AccordionGroup>

            {/* PROFIL KASIR */}
            <AccordionGroup
              title={t("pos.cashier_account", "Akun Kasir")}
              icon={UserRound}
              isOpen={posAkunOpen}
              isActive={active === "pos-profile"}
              onToggle={() => setPosAkunOpen((prev) => !prev)}
            >
              <Link
                to="/pos/profile"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                  active === "pos-profile"
                    ? "bg-primary text-primary-foreground font-bold shadow-brand"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">{t("nav.profile", "Profil Kasir")}</span>
              </Link>
              <button
                type="button"
                onClick={onOpenThemeModal}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground whitespace-nowrap cursor-pointer text-left"
              >
                <Palette className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{t("nav.theme", "Tema / Custom Theme")}</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-all whitespace-nowrap text-left"
              >
                <LogOut className="size-3.5 shrink-0" />
                <span className="truncate">{t("nav.logout", "Logout")}</span>
              </button>
            </AccordionGroup>
          </>
        ) : (
          /* ==================================================
             HQ SYSTEM (Owner / Admin / Manager)
             ================================================== */
          <>
            {/* GROUP 1: RINGKASAN & LAPORAN */}
            {(!isManager || managerPermissions.includes("reports")) && (
              <AccordionGroup
                title={t("nav.reports", "Ringkasan & Laporan")}
                icon={BarChart3}
                isOpen={reportOpen}
                isActive={isReportActive}
                onToggle={() => setReportOpen((prev) => !prev)}
              >
                {reportItems.map((item) => {
                  const Icon = item.icon;
                  const selected =
                    item.key === active ||
                    (item.href === "/dashboard" && active === "dashboard") ||
                    (item.href === "/analytics" &&
                      (active === "analytics" || active === "business-summary")) ||
                    (item.href === "/orders" && active === "orders") ||
                    (item.href === "/performance-outlet" && active === "performance-outlet") ||
                    (item.href === "/performance-menu" && active === "performance-menu") ||
                    (item.href === "/insight-analytics" && active === "insight-analytics") ||
                    (item.href === "/money-allocation" && active === "money-allocation");

                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                        selected
                          ? "bg-primary text-primary-foreground font-bold shadow-brand"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{getNavLabel(item.key, item.label, t)}</span>
                    </Link>
                  );
                })}
              </AccordionGroup>
            )}

            {/* GROUP 2: STOK & PENGADAAN */}
            {(!isManager || managerPermissions.includes("inventory")) && (
              <AccordionGroup
                title={t("nav.stock_procurement", "Stok & Pengadaan")}
                icon={Boxes}
                isOpen={stockOpen}
                isActive={isStockActive}
                onToggle={() => setStockOpen((prev) => !prev)}
              >
                {stockItems.map((item) => {
                  const Icon = item.icon;
                  const selected = item.key === active;
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                        selected
                          ? "bg-primary text-primary-foreground font-bold shadow-brand"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{getNavLabel(item.key, item.label, t)}</span>
                    </Link>
                  );
                })}
              </AccordionGroup>
            )}

            {/* GROUP 3: MANAJEMEN BISNIS */}
            {(() => {
              const allowedBusinessItems = businessItems.filter((item) => {
                if (!isManager) return true;
                if (item.key === "business-profile" || item.key === "business") return false;
                if (item.key === "menu") return managerPermissions.includes("menu");
                if (item.key === "staff") {
                  return (
                    managerPermissions.includes("staff_schedule") ||
                    managerPermissions.includes("payroll")
                  );
                }
                if (item.key === "outlets" || item.key === "outlet") {
                  return managerPermissions.includes("outlets");
                }
                return true;
              });

              if (isManager && allowedBusinessItems.length === 0) return null;

              return (
                <AccordionGroup
                  title={t("nav.business_management", "Manajemen Bisnis")}
                  icon={Building2}
                  isOpen={businessOpen}
                  isActive={isBusinessActive}
                  onToggle={() => setBusinessOpen((prev) => !prev)}
                >
                  {allowedBusinessItems.map((item) => {
                    const Icon = item.icon;
                    const selected =
                      item.key === active ||
                      (item.key === "menu" && active === "menu") ||
                      (item.key === "outlets" && (active === "outlets" || active === "outlet")) ||
                      (item.key === "business-profile" &&
                        (active === "business-profile" || active === "business"));
                    return (
                      <Link
                        key={item.key}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                          selected
                            ? "bg-primary text-primary-foreground font-bold shadow-brand"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{getNavLabel(item.key, item.label, t)}</span>
                      </Link>
                    );
                  })}
                </AccordionGroup>
              );
            })()}

            {/* GROUP 4: PENGATURAN */}
            {(!isManager || managerPermissions.includes("settings")) && (
              <AccordionGroup
                title={t("nav.settings", "Pengaturan")}
                icon={SlidersHorizontal}
                isOpen={settingsOpen}
                isActive={isSettingsActive}
                onToggle={() => setSettingsOpen((prev) => !prev)}
              >
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  const selected = item.key === active;
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                        selected
                          ? "bg-primary text-primary-foreground font-bold shadow-brand"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{getNavLabel(item.key, item.label, t)}</span>
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={onOpenThemeModal}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground whitespace-nowrap cursor-pointer text-left"
                >
                  <Palette className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{t("nav.theme", "Tema / Custom Theme")}</span>
                </button>
              </AccordionGroup>
            )}

            {/* GROUP 5: AKUN */}
            <AccordionGroup
              title={t("nav.account", "Akun")}
              icon={UserRound}
              isOpen={accountOpen}
              isActive={isAccountActive}
              onToggle={() => setAccountOpen((prev) => !prev)}
            >
              {accountItems.map((item) => {
                const Icon = item.icon;
                const selected =
                  item.key === active ||
                  (item.key === "language" && active === "language-settings");
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
                      selected
                        ? "bg-primary text-primary-foreground font-bold shadow-brand"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{getNavLabel(item.key, item.label, t)}</span>
                  </Link>
                );
              })}
            </AccordionGroup>
          </>
        )}
      </nav>

      <div className="rounded-[1.5rem] border border-border bg-card/76 p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          <RadioTower className="size-4 text-primary" />
          {t("header.status_online", "Live Engine")}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t(
            "dashboard.integrated_desc",
            "Sinkronisasi transaksi, stok resep, dan pengadaan berjalan real-time.",
          )}
        </p>
      </div>
    </aside>
  );
}

function MobileNav({ active, role }: { active: NavKey; role?: string }) {
  const { t } = useTranslation();
  const normalizedRole = (role || "").toLowerCase();
  const isHQ = ["owner", "admin"].includes(normalizedRole);
  const isCashier = normalizedRole === "cashier" || (!isHQ && normalizedRole === "staff");
  const isPosPage = [
    "pos",
    "pos-orders",
    "pos-receipt",
    "pos-shift-cash",
    "pos-inventory",
    "pos-profile",
    "pos-attendance-in",
    "pos-attendance-out",
    "pos-attendance-history",
    "pos-attendance-shifts",
  ].includes(active);
  const isPosMode = isCashier || isPosPage;

  const items = isPosMode
    ? [
        { key: "pos" as NavKey, label: "POS Kasir", href: "/pos", icon: ShoppingCart },
        { key: "pos-orders" as NavKey, label: "Order", href: "/pos/orders", icon: ReceiptText },
        {
          key: "pos-shift-cash" as NavKey,
          label: "Shift",
          href: "/pos/shift-cash",
          icon: WalletCards,
        },
        { key: "pos-inventory" as NavKey, label: "Stok", href: "/pos/inventory", icon: Boxes },
        { key: "pos-profile" as NavKey, label: "Profil", href: "/pos/profile", icon: UserRound },
      ]
    : [
        { key: "dashboard" as NavKey, label: "Dashboard", href: "/dashboard", icon: Home },
        { key: "orders" as NavKey, label: "Order", href: "/orders", icon: ReceiptText },
        { key: "inventory" as NavKey, label: "Stok", href: "/inventory", icon: Boxes },
        { key: "analytics" as NavKey, label: "Analitik", href: "/analytics", icon: BarChart3 },
        { key: "profile" as NavKey, label: "Profil", href: "/profile", icon: UserRound },
      ];

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.75rem] border border-border bg-card/90 p-2 shadow-float backdrop-blur-2xl lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = item.key === active;
        return (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-bold transition-colors",
              selected ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {getNavLabel(item.key, item.label, t)}
          </Link>
        );
      })}
    </nav>
  );
}

function AiAssistantPanel({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useTranslation();
  const metrics = calculateSnapshotMetrics(snapshot);
  const [messages, setMessages] = useState<ChatMessageItem[]>(initialChatMessages);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/kitapos-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: trimmed,
          businessName: snapshot.businessName,
          metrics,
          products: snapshot.products.slice(0, 15),
          inventory: snapshot.inventory.slice(0, 15),
          customers: snapshot.customers.slice(0, 10),
          orders: snapshot.orders.slice(0, 25),
          outlets: snapshot.outlets || [],
        }),
      });

      const json = await res.json().catch(() => null);

      if (json && typeof json.message === "string" && json.message.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: json.message,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: "AI sedang tidak tersedia, menggunakan analisis internal.",
          },
        ]);
      }
    } catch (err) {
      console.error("[AiAssistantPanel] fetch error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: "AI sedang tidak tersedia, menggunakan analisis internal.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex h-[42rem] min-h-0 flex-col rounded-[1.75rem] border border-border bg-card/86 shadow-float backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-ai-soft text-ai">
            <Bot className="size-5" />
          </div>
          <div>
            <h2 className="font-black tracking-normal">
              {t("dashboard.ai_assistant_title", "Kita AI Assistant")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.ai_assistant_desc", "Sales prediction · stok · pelanggan")}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-foreground">
          Online
        </span>
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 p-5">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Bot className="size-7" />}
              title="Tanya Kita AI"
              description="Minta rekomendasi stok, promo, atau ringkasan penjualan."
            />
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={cn(message.role === "user" && "bg-primary text-primary-foreground")}
              >
                <MessageResponse>{message.text}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {isLoading && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {t("dashboard.ai_reading_pattern", "Kita AI sedang membaca pola bisnis...")}
                </div>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollACLEButton />
      </Conversation>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            "Produk paling laku hari ini?",
            "Outlet dengan omzet tertinggi?",
            "Stok apa yang perlu dibeli?",
          ].map((prompt) => (
            <Button
              key={prompt}
              variant="secondary"
              size="sm"
              className="rounded-full text-xs font-semibold"
              onClick={() => handleSendPrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <PromptInput
          onSubmit={({ text }) => {
            handleSendPrompt(text);
          }}
        >
          <PromptInputTextarea
            placeholder={t("dashboard.ask_ai_placeholder", "Tanya: apa prioritas bisnis hari ini?")}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={isLoading ? "submitted" : "ready"} className="rounded-xl" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}

function ConversationScrollACLEButton() {
  return <ConversationScrollButton className="bottom-5" />;
}

function DashboardPage({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useTranslation();
  const metrics = calculateSnapshotMetrics(snapshot);

  const lowStockItems = useMemo(() => {
    return snapshot.inventory.filter(
      (i) =>
        (Number(i.stock) || 0) <= (Number(i.minimum_stock) || 0) || (i.health_score ?? 100) < 55,
    );
  }, [snapshot.inventory]);

  const stockHealthMessage = useMemo(() => {
    if (lowStockItems.length > 0) {
      return `${lowStockItems
        .slice(0, 2)
        .map((i) => i.name)
        .join(" & ")} butuh restock segera sebelum jam sibuk.`;
    }
    if (snapshot.inventory.length > 0) {
      return "Semua stok bahan baku aman dan siap mendukung operasional harian.";
    }
    return "Belum ada data inventaris bahan baku tercatat.";
  }, [lowStockItems, snapshot.inventory]);

  const dynamicInsights: AiInsight[] = useMemo(() => {
    if (snapshot.insights.length > 0) return snapshot.insights;
    const res: AiInsight[] = [];
    if (lowStockItems.length > 0) {
      const firstLow = lowStockItems[0];
      if (firstLow) {
        res.push({
          id: "stock-alert-1",
          type: "stock_recommendation",
          title: `Restock Prioritas: ${firstLow.name}`,
          body: `Sisa stok ${firstLow.stock} ${firstLow.unit} di bawah batas aman ${firstLow.minimum_stock} ${firstLow.unit}. Segera buat Purchase Order.`,
          confidence: 96,
          action_label: "Buat PO",
        });
      }
    } else {
      res.push({
        id: "stock-good-1",
        type: "stock_recommendation",
        title: "Ketersediaan Stok Terjaga",
        body: "Seluruh bahan baku berada di atas batas minimum. Operasional dapur berjalan lancar.",
        confidence: 94,
        action_label: null,
      });
    }

    if (snapshot.orders.length > 0) {
      res.push({
        id: "order-sum-1",
        type: "daily_summary",
        title: "Performa Penjualan Aktif",
        body: `Tercatat ${snapshot.orders.length} transaksi dengan omzet ${formatRupiah(metrics.todayRevenue)}. Channel kasir toko mendominasi transaksi.`,
        confidence: 92,
        action_label: "Lihat Laporan",
      });
    } else {
      res.push({
        id: "order-empty-1",
        type: "daily_summary",
        title: "Pencatatan POS Siap",
        body: "Kasir telah terhubung ke database cloud. Buka menu POS Kasir untuk melayani pesanan pembeli.",
        confidence: 90,
        action_label: "Buka POS",
      });
    }

    if (snapshot.customers.length > 0) {
      const topCustomer = snapshot.customers[0];
      if (topCustomer) {
        res.push({
          id: "crm-top-1",
          type: "customer_insight",
          title: `Pelanggan Setia: ${topCustomer.name}`,
          body: `Telah melakukan ${topCustomer.visits}x kunjungan dengan total transaksi ${formatRupiah(topCustomer.total_spend)}. Produk favorit: ${topCustomer.favorite_product || "Kebab"}.`,
          confidence: 95,
          action_label: "CRM",
        });
      }
    } else {
      res.push({
        id: "crm-init-1",
        type: "customer_insight",
        title: "Program Loyalitas CRM",
        body: "Daftarkan pelanggan di POS saat transaksi untuk mengumpulkan data kunjungan & retensi otomatis.",
        confidence: 88,
        action_label: null,
      });
    }

    if (snapshot.products.length > 0) {
      res.push({
        id: "menu-opt-1",
        type: "ai",
        title: "Optimasi Menu Unggulan",
        body: `Katalog aktif memiliki ${snapshot.products.length} menu dengan varian & Recipe BOM terkonfigurasi.`,
        confidence: 91,
        action_label: "Menu",
      });
    }

    return res;
  }, [
    snapshot.insights,
    lowStockItems,
    snapshot.inventory,
    snapshot.orders,
    metrics.todayRevenue,
    snapshot.customers,
    snapshot.products,
  ]);

  const recentOrders = snapshot.orders;

  return (
    <div className="space-y-6 w-full max-w-none">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-border bg-card p-6 shadow-float lg:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-card/72 px-4 py-2 text-sm font-bold text-primary shadow-soft">
                <Zap className="size-4" />
                {t("dashboard.welcome_hq", "Selamat datang di HQ Monitor")}
              </p>
              <h1 className="max-w-2xl text-balance text-4xl font-black leading-tight tracking-normal lg:text-5xl">
                {t(
                  "dashboard.integrated_title",
                  "Operasional Bisnis & Data Transaksi Terintegrasi.",
                )}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {t(
                  "dashboard.integrated_desc",
                  "Semua cabang outlet, stok bahan baku, kasir POS, dan laporan keuangan terhubung dalam Single Source of Truth.",
                )}
              </p>
            </div>
            <Button variant="hero" className="h-12 rounded-2xl">
              {t("dashboard.view_performance", "Lihat Performa")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </motion.div>
        <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
          <p className="text-sm font-bold text-muted-foreground">
            {t("dashboard.stock_health_score", "Stock Health Score")}
          </p>
          <p className="mt-3 text-3xl sm:text-5xl font-black tracking-normal">
            {snapshot.inventory.length === 0 ? "0% (Belum Ada Bahan)" : `${metrics.avgHealth}%`}
          </p>
          <Progress className="mt-5 h-3" value={snapshot.inventory.length === 0 ? 0 : metrics.avgHealth} />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {snapshot.inventory.length === 0
              ? "Belum ada bahan baku tercatat di Inventory HQ."
              : stockHealthMessage}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t("dashboard.revenue_today", "Revenue Hari Ini")}
          value={formatRupiah(metrics.todayRevenue || 0)}
          trend={`${metrics.orders || 0} transaksi hari ini`}
          icon={DollarSign}
        />
        <StatCard
          label={t("dashboard.total_orders", "Total Transaksi")}
          value={`${metrics.orders || 0}`}
          trend="Real-time POS"
          icon={ReceiptText}
          tone="success"
        />
        <StatCard
          label={t("dashboard.profit_margin", "Margin Keuntungan")}
          value={`${metrics.marginPercentage || 0}%`}
          trend={`Profit: ${formatRupiah(metrics.grossProfit || 0)}`}
          icon={TrendingUp}
          tone="primary"
        />
        <StatCard
          label={t("dashboard.registered_customers", "Jumlah Pelanggan")}
          value={`${snapshot.customers?.length || 0}`}
          trend="Database CRM"
          icon={UsersRound}
        />
        <StatCard
          label={t("dashboard.stock_alert", "Peringatan Stok")}
          value={`${metrics.lowStock || 0}`}
          trend={metrics.lowStock > 0 ? "Perlu restock" : "Stok aman"}
          icon={PackageCheck}
          tone={metrics.lowStock > 0 ? "ai" : "success"}
        />
      </section>

      {/* Performa Outlet & Produk Terlaris Grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* 1. Performa Outlet */}
        <div className="rounded-[1.75rem] border border-border bg-card/82 p-5 shadow-soft backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-normal">
                  {t("dashboard.outlet_performance", "Performa Cabang Outlet")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "dashboard.outlet_performance_desc",
                    "Kontribusi omzet & transaksi per cabang",
                  )}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              {metrics.outletPerformances.length || (snapshot.outlets || []).length || 0} Cabang
            </span>
          </div>

          {metrics.outletPerformances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center text-xs text-muted-foreground">
              <Store className="mx-auto size-7 opacity-40 mb-1.5" />
              <p className="font-bold">Belum ada transaksi outlet</p>
              <p className="text-[11px] mt-0.5">Omzet: Rp 0 · Transaksi: 0</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.outletPerformances.map((perf, pIdx) => {
                const outletPct =
                  metrics.todayRevenue > 0
                    ? Math.round((perf.revenue / metrics.todayRevenue) * 100)
                    : 0;
                return (
                  <div
                    key={perf.id || `outlet-perf-${pIdx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-3 hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary shrink-0">
                        {pIdx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{perf.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {perf.orders || 0} transaksi · {outletPct}% omzet
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-primary">
                        {formatRupiah(perf.revenue || 0)}
                      </p>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Aktif
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Produk Terlaris */}
        <div className="rounded-[1.75rem] border border-border bg-card/82 p-5 shadow-soft backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <UtensilsCrossed className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-normal">
                  {t("dashboard.top_products", "Produk Terlaris")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.top_products_desc", "Menu hidangan paling diminati pelanggan")}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
              Top 5
            </span>
          </div>

          {metrics.topProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center text-xs text-muted-foreground">
              <UtensilsCrossed className="mx-auto size-7 opacity-40 mb-1.5" />
              <p className="font-bold">Belum ada menu terjual</p>
              <p className="text-[11px] mt-0.5">Penjualan: 0 porsi · Revenue: Rp 0</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.topProducts.map((prod, prIdx) => (
                <div
                  key={prod.id || `prod-top-${prIdx}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-3 hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500/10 text-xs font-black text-orange-600 dark:text-orange-400 shrink-0">
                      #{prIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{prod.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {prod.category} · {formatRupiah(prod.price || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-foreground">
                      {prod.soldCount || 0} porsi terjual
                    </p>
                    <p className="text-[11px] font-semibold text-primary">
                      {formatRupiah(prod.revenue || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.75rem] border border-border bg-card/82 p-5 shadow-soft backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-normal">
                {t("dashboard.realtime_sales_monitor", "Realtime Sales Monitor")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("dashboard.realtime_sales_desc", "Transaksi masuk dari POS Kasir semua cabang")}
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-foreground">
              <span className="size-2 rounded-full bg-success" />
              {t("dashboard.live", "Live")}
            </span>
          </div>
          {recentOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center">
              <ReceiptText className="mx-auto size-8 text-muted-foreground/40 mb-2" />
              <p className="font-bold text-sm">
                {t("dashboard.no_orders_today", "Belum Ada Transaksi Hari Ini")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "dashboard.no_orders_desc",
                  "Setiap transaksi dari POS Kasir akan langsung tercatat secara real-time di monitor ini.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{order.order_number}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {order.channel} · {order.payment_method}
                    </p>
                  </div>
                  <p className="text-sm font-black">{formatRupiah(order.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <AiAssistantPanel snapshot={snapshot} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dynamicInsights.slice(0, 4).map((insight) => {
          const Icon =
            insight.type === "stock_recommendation"
              ? sectionIcons.inventory
              : insight.type === "daily_summary"
                ? sectionIcons.order
                : sectionIcons.ai;
          return (
            <div
              key={insight.id}
              className="rounded-[1.5rem] border border-border bg-card/82 p-5 shadow-soft backdrop-blur-2xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-ai-soft text-ai">
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-black text-primary">{insight.confidence}%</span>
              </div>
              <h3 className="font-black tracking-normal">{insight.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.body}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}

interface ReceiptData {
  orderNumber: string;
  outletName: string;
  cashierName: string;
  paymentMethod: string;
  customerName?: string | null;
  customerQueueName?: string | null;
  ojolOrderCode?: string | null;
  createdAt: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  subtotal?: number;
  discountAmount?: number;
  serviceChargeAmount?: number;
  taxAmount?: number;
  orderType?: string;
  tableNumber?: string;
  total: number;
  cashReceived?: number;
  changeAmount?: number;
}

function ReceiptModal({
  data,
  businessName,
  onClose,
}: {
  data: ReceiptData | null;
  businessName?: string;
  onClose: () => void;
}) {
  if (!data) return null;
  const printerCfg = getSavedPrinterConfig();
  const headerStoreName = printerCfg.storeName || businessName || "KEBABSCHOICE POS";
  const branchAddress = printerCfg.branchAddress;
  const footerText = printerCfg.footerMessage || "Terima kasih atas kunjungan Anda!";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-sm flex-col rounded-[2rem] border border-border bg-card p-6 shadow-float overflow-hidden">
        {/* Printable Struk Area */}
        <div id="pos-printable-receipt" className="overflow-y-auto pr-1 text-center font-mono">
          <div className="flex justify-center mb-2 text-primary">
            <Receipt className="size-8" />
          </div>
          <h2 className="text-base font-black tracking-wider uppercase text-foreground">
            {headerStoreName}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Cabang: {data.outletName}</p>
          {branchAddress && (
            <p className="text-[10px] text-muted-foreground">{branchAddress}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {new Date(data.createdAt).toLocaleString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Prominent Queue Name / Order Code Banner for Kitchen & Grill Crew */}
          {(data.customerQueueName || data.ojolOrderCode) && (
            <div className="my-2 p-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-center">
              {data.customerQueueName && (
                <div className="text-xs font-black text-foreground uppercase tracking-wide">
                  ANTREAN: <span className="text-base font-extrabold text-primary">{data.customerQueueName}</span>
                </div>
              )}
              {data.ojolOrderCode && (
                <div className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">
                  KODE ORDER: <span className="text-foreground font-black">{data.ojolOrderCode}</span>
                </div>
              )}
            </div>
          )}

          <div className="my-3 border-t border-dashed border-border/80" />

          <div className="space-y-1 text-xs text-left">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order #:</span>
              <span className="font-bold text-foreground">{data.orderNumber}</span>
            </div>
            {data.orderType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipe Pesanan:</span>
                <span className="font-bold text-foreground uppercase">
                  {data.orderType.replace("_", " ")}
                  {data.tableNumber ? ` (Meja ${data.tableNumber})` : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kasir:</span>
              <span className="text-foreground">{data.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pembayaran:</span>
              <span className="font-bold uppercase text-foreground">{data.paymentMethod}</span>
            </div>
            {data.customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pelanggan:</span>
                <span className="font-semibold text-foreground">{data.customerName}</span>
              </div>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-border/80" />

          <div className="space-y-2 text-xs text-left">
            {data.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <div className="min-w-0 pr-2">
                  <span className="font-medium text-foreground block truncate">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.quantity} x {formatRupiah(item.price)}
                  </span>
                </div>
                <span className="font-bold text-foreground shrink-0">
                  {formatRupiah(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-dashed border-border/80" />

          <div className="space-y-1.5 pt-1 text-xs">
            {data.subtotal !== undefined && (
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>{formatRupiah(data.subtotal)}</span>
              </div>
            )}
            {Boolean(data.discountAmount) && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
                <span>Diskon:</span>
                <span>-{formatRupiah(data.discountAmount || 0)}</span>
              </div>
            )}
            {Boolean(data.serviceChargeAmount) && (
              <div className="flex justify-between text-muted-foreground">
                <span>Biaya Layanan:</span>
                <span>+{formatRupiah(data.serviceChargeAmount || 0)}</span>
              </div>
            )}
            {Boolean(data.taxAmount) && (
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak Restoran (PB1):</span>
                <span>+{formatRupiah(data.taxAmount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black pt-1 border-t border-dashed border-border/80">
              <span>TOTAL TAGIHAN</span>
              <span className="text-primary">{formatRupiah(data.total)}</span>
            </div>
            {data.paymentMethod.toUpperCase() === "CASH" && (
              <div className="pt-2 mt-2 border-t border-dashed border-border/80 space-y-1 text-xs text-left font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tunai Diterima:</span>
                  <span className="font-bold text-foreground">
                    {formatRupiah(data.cashReceived ?? data.total)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Kembalian:</span>
                  <span className="font-black text-sm">
                    {formatRupiah(data.changeAmount ?? Math.max(0, (data.cashReceived ?? data.total) - data.total))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] text-muted-foreground whitespace-pre-line">
            *** {footerText} ***
          </p>
        </div>

        <div className="mt-5 flex gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            className="flex-1 rounded-xl text-xs font-bold"
            onClick={onClose}
          >
            Tutup
          </Button>
          <Button
            className="flex-1 rounded-xl text-xs font-bold gap-1.5 shadow-brand"
            onClick={async () => {
              try {
                await printReceipt({
                  storeName: headerStoreName,
                  outletName: data.outletName,
                  branchAddress: branchAddress,
                  orderNumber: data.orderNumber,
                  cashierName: data.cashierName,
                  customerName: data.customerName,
                  orderType: data.orderType,
                  tableNumber: data.tableNumber,
                  createdAt: data.createdAt,
                  date: new Date(data.createdAt).toLocaleString("id-ID"),
                  items: data.items.map((it) => ({
                    name: it.name,
                    quantity: it.quantity,
                    qty: it.quantity,
                    price: it.price,
                    subtotal: it.subtotal,
                  })),
                  subtotal: data.subtotal,
                  discount: data.discountAmount,
                  serviceCharge: data.serviceChargeAmount,
                  tax: data.taxAmount,
                  total: data.total,
                  paymentMethod: data.paymentMethod,
                  cashTendered: data.cashReceived ?? data.total,
                  change: data.changeAmount ?? Math.max(0, (data.cashReceived ?? data.total) - data.total),
                  footerMessage: footerText,
                });
              } catch (err) {
                console.warn("Print receipt fallback:", err);
                window.print();
              }
            }}
          >
            <Printer className="size-3.5" />
            Cetak Struk
          </Button>
        </div>
      </div>
    </div>
  );
}

function SwitchCashierModal({
  isOpen,
  onClose,
  outletId,
  currentCashierName,
  onSelectCashier,
}: {
  isOpen: boolean;
  onClose: () => void;
  outletId?: string;
  currentCashierName: string;
  onSelectCashier: (name: string) => void;
}) {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getStaffList()
        .then((list) => {
          const filtered = list.filter(
            (s) => !s.outlet_id || s.outlet_id === outletId || s.outlet_id === "all",
          );
          setStaffList(filtered.length > 0 ? filtered : list);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, outletId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Ganti Kasir Bertugas</h3>
              <p className="text-xs text-muted-foreground">Tukar kru kasir aktif tanpa logout perangkat</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Pilih Kru Cabang
          </p>
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Memuat daftar kru...</div>
          ) : staffList.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
              Belum ada kru terdaftar di cabang ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {staffList.map((st) => {
                const isCurrent =
                  currentCashierName.trim().toLowerCase() === st.name.trim().toLowerCase();
                return (
                  <button
                    key={st.user_id || st.id}
                    type="button"
                    onClick={() => {
                      onSelectCashier(st.name);
                      onClose();
                    }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer text-left",
                      isCurrent
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border bg-muted/20 hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {st.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{st.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {st.role.toUpperCase()} {st.outlet_name ? `· ${st.outlet_name}` : ""}
                        </p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                        Aktif Sekarang
                      </Badge>
                    ) : (
                      <span className="text-xs font-semibold text-primary">Pilih</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input Manual Kru Pengganti */}
          <div className="pt-2 border-t border-border space-y-2">
            <label className="text-xs font-bold text-foreground block">
              Atau Masukkan Nama Kru Pengganti:
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Nama kasir pengganti..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="rounded-xl text-xs"
              />
              <Button
                type="button"
                disabled={!customName.trim()}
                onClick={() => {
                  if (customName.trim()) {
                    onSelectCashier(customName.trim());
                    onClose();
                  }
                }}
                className="rounded-xl font-bold text-xs shrink-0 shadow-brand"
              >
                Ganti
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type PosOrderType =
  | "dine_in"
  | "take_away"
  | "delivery"
  | "gofood"
  | "grabfood"
  | "shopeefood";

export interface HeldOrder {
  id: string;
  createdAt: string;
  outletId?: string;
  orderType: PosOrderType;
  tableNumber?: string;
  customerQueueName?: string;
  ojolOrderCode?: string;
  orderNotes?: string;
  items: CartItem[];
  discountType: "nominal" | "percent";
  discountValue: number;
}

async function resolveMenuRecipe(
  cartItem: CartItem,
  businessId?: string | null,
  chosenOutletId?: string | null,
  cachedOutletSettingsRecipes?: Record<string, any>,
): Promise<{ items: Array<{ inventory_item_id: string; quantity: number; unit?: string }> } | null> {
  // Tier 1: Cart item direct recipe
  if (cartItem.recipe && Array.isArray(cartItem.recipe.items) && cartItem.recipe.items.length > 0) {
    return cartItem.recipe;
  }

  // Tier 2: Check menu_recipes table with recipe_items
  if (cartItem.id && !cartItem.id.startsWith("demo-")) {
    try {
      const { data: dbRec } = await supabase
        .from("menu_recipes" as any)
        .select("id, recipe_items(inventory_item_id, quantity, unit)")
        .eq("menu_item_id", cartItem.id)
        .maybeSingle();

      if (
        dbRec &&
        (dbRec as any).recipe_items &&
        Array.isArray((dbRec as any).recipe_items) &&
        (dbRec as any).recipe_items.length > 0
      ) {
        return {
          items: (dbRec as any).recipe_items.map((ri: any) => ({
            inventory_item_id: ri.inventory_item_id,
            quantity: Number(ri.quantity) || 1,
            unit: ri.unit || "gram",
          })),
        };
      }
    } catch {}
  }

  // Tier 3: Cached or fetched settings.menu_recipes from outlets
  if (cachedOutletSettingsRecipes && cachedOutletSettingsRecipes[cartItem.id]) {
    return cachedOutletSettingsRecipes[cartItem.id];
  }

  if (businessId) {
    try {
      let outletRecsQuery = supabase.from("outlets").select("settings");
      if (chosenOutletId) {
        outletRecsQuery = outletRecsQuery.eq("id", chosenOutletId);
      } else {
        outletRecsQuery = outletRecsQuery.eq("business_id", businessId);
      }
      const { data: outletRecs } = await outletRecsQuery.limit(5);
      if (outletRecs) {
        for (const oRec of outletRecs) {
          const mRecs = (oRec.settings as any)?.menu_recipes;
          if (mRecs && mRecs[cartItem.id] && Array.isArray(mRecs[cartItem.id].items)) {
            return mRecs[cartItem.id];
          }
        }
      }
    } catch {}
  }

  return null;
}

async function depleteIngredientStock({
  ingredient,
  cartItemQuantity,
  cartItemName,
  chosenOutletId,
  businessId,
  orderId,
  orderNumber,
  prefixNote = "POS",
}: {
  ingredient: { inventory_item_id?: string | null; ingredient_name?: string | null; quantity: number; unit?: string };
  cartItemQuantity: number;
  cartItemName: string;
  chosenOutletId?: string | null;
  businessId: string;
  orderId?: string | null;
  orderNumber: string;
  prefixNote?: string;
}): Promise<{ inventoryId: string; deductedQuantity: number } | null> {
  let origInvRow: any = null;
  if (ingredient.inventory_item_id) {
    const { data } = await (supabase.from("inventory_items" as any) as any)
      .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, category, sku, min_stock")
      .eq("id", ingredient.inventory_item_id)
      .maybeSingle();
    origInvRow = data;
  }

  // Fallback: search by ingredient_name if not found by id
  if (!origInvRow && ingredient.ingredient_name) {
    try {
      const { data: nameMatch } = await (supabase.from("inventory_items" as any) as any)
        .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, category, sku, min_stock")
        .ilike("name", ingredient.ingredient_name.trim())
        .limit(1);
      if (nameMatch && nameMatch.length > 0) {
        origInvRow = nameMatch[0];
      }
    } catch {}
  }

  if (!origInvRow) return null;

  // Enrich with item_meta from localStorage if yield_per_unit not in DB columns yet
  if (typeof window !== "undefined") {
    try {
      const localStoreKey = `procurement_store_${businessId}`;
      const rawStore = localStorage.getItem(localStoreKey);
      if (rawStore) {
        const store = JSON.parse(rawStore);
        const meta = store.item_meta?.[origInvRow.id];
        if (meta) {
          if (!origInvRow.yield_per_unit && meta.yield_per_unit) origInvRow.yield_per_unit = meta.yield_per_unit;
          if (!origInvRow.yield_unit && meta.yield_unit) origInvRow.yield_unit = meta.yield_unit;
        }
      }
    } catch {}
  }

  let targetInvRow: any = origInvRow;

  // STRICT MULTI-BRANCH ISOLATION:
  // If chosenOutletId is specified, ensure we deplete ONLY the inventory item of chosenOutletId!
  if (chosenOutletId && origInvRow.outlet_id !== chosenOutletId) {
    try {
      let branchSpecificRows: any[] | null = null;
      if (origInvRow.sku) {
        const { data: skuMatch } = await (supabase.from("inventory_items" as any) as any)
          .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, category, sku, min_stock")
          .eq("outlet_id", chosenOutletId)
          .eq("sku", origInvRow.sku)
          .limit(1);
        branchSpecificRows = skuMatch;
      }

      if (!branchSpecificRows || branchSpecificRows.length === 0) {
        const { data: nameMatch } = await (supabase.from("inventory_items" as any) as any)
          .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, category, sku, min_stock")
          .eq("outlet_id", chosenOutletId)
          .ilike("name", origInvRow.name.trim())
          .limit(1);
        branchSpecificRows = nameMatch;
      }

      if (branchSpecificRows && branchSpecificRows.length > 0) {
        targetInvRow = branchSpecificRows[0];
      } else {
        // Fallback: create branch-specific item in chosenOutletId with 0 initial stock so we NEVER bleed other branches!
        const newBranchItem: any = {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          business_id: businessId,
          outlet_id: chosenOutletId,
          name: origInvRow.name,
          sku: origInvRow.sku || null,
          category: origInvRow.category || "Bahan Baku",
          unit: origInvRow.unit || "kg",
          cost_per_unit: Number(origInvRow.cost_per_unit) || 0,
          yield_per_unit: origInvRow.yield_per_unit || null,
          yield_unit: origInvRow.yield_unit || null,
          stock: 0,
          min_stock: Number(origInvRow.min_stock) || 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const { data: createdRow } = await (supabase.from("inventory_items" as any) as any)
            .insert(newBranchItem)
            .select()
            .maybeSingle();
          targetInvRow = createdRow || newBranchItem;
        } catch {
          targetInvRow = newBranchItem;
        }
      }
    } catch {
      // Safe fallback - avoid depleting other branch
    }
  }

  const rawQuantityNeeded = (Number(ingredient.quantity) || 1) * cartItemQuantity;
  const convertedQuantity = convertRecipeToInventoryQuantity(
    rawQuantityNeeded,
    ingredient.unit || "gram",
    targetInvRow.unit || "kg",
    targetInvRow.yield_per_unit,
    targetInvRow.yield_unit,
  );

  const prevStock = Number(targetInvRow.stock) || 0;
  const calculatedStock = prevStock - convertedQuantity;
  const newStock = Math.max(0, Math.round(calculatedStock * 10000) / 10000);

  await (supabase.from("inventory_items" as any) as any)
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", targetInvRow.id);

  const movementRecord: any = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    business_id: businessId,
    inventory_item_id: targetInvRow.id,
    item_name: targetInvRow.name,
    outlet_id: chosenOutletId || targetInvRow.outlet_id || null,
    order_id: orderId || null,
    reference_id: orderId || orderNumber,
    reference_type: "pos_order",
    type: "pos_sale",
    movement_type: "pos_sale",
    quantity: convertedQuantity,
    unit: targetInvRow.unit || ingredient.unit || "gram",
    remaining_stock: newStock,
    unit_cost: Number(targetInvRow.cost_price || 0),
    cost_per_unit: Number(targetInvRow.cost_price || 0),
    cost_price: Number(targetInvRow.cost_price || 0),
    yield_per_unit: Number(targetInvRow.yield_per_unit) || null,
    yield_unit: targetInvRow.yield_unit || null,
    notes: `${prefixNote} #${orderNumber}: ${cartItemQuantity}x ${cartItemName}`,
    created_at: new Date().toISOString(),
  };

  try {
    await supabase.from("stock_movements" as any).insert(movementRecord);
  } catch {}

  // Also persist to procurement_store in localStorage & outlets.settings
  if (typeof window !== "undefined") {
    try {
      const localKey = `procurement_store_${businessId}`;
      const rawStore = localStorage.getItem(localKey);
      const store = rawStore ? JSON.parse(rawStore) : {};
      store.stock_movements = [movementRecord, ...(store.stock_movements || [])].slice(0, 500);
      if (Array.isArray(store.items)) {
        const itemIdx = store.items.findIndex((it: any) => it.id === targetInvRow.id);
        if (itemIdx >= 0) {
          store.items[itemIdx].stock = newStock;
        }
      }
      localStorage.setItem(localKey, JSON.stringify(store));
    } catch {}

    window.dispatchEvent(new CustomEvent("inventory:updated"));
    window.dispatchEvent(new CustomEvent("pos:menu-updated"));
  }

  console.log(
    `[BOM Depletion ${chosenOutletId ? 'Branch ' + chosenOutletId : 'Central'}] Converted ${rawQuantityNeeded} ${ingredient.unit} ➔ ${convertedQuantity} ${targetInvRow.unit}. Reduced ${targetInvRow.name}, remaining: ${newStock} ${targetInvRow.unit}`,
  );

  return {
    inventoryId: targetInvRow.id,
    deductedQuantity: convertedQuantity,
  };
}


function PosPage({
  snapshot,
  profile,
  onRefresh,
  activeCashierName,
}: {
  snapshot: Snapshot;
  profile?: UserProfile;
  onRefresh: () => Promise<void>;
  activeCashierName?: string;
}) {
  const { t } = useTranslation();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);

  const activeOutlets = snapshot.outlets?.filter((o) => o.active !== false) || [];
  // prettier-ignore
  const assignedOutlet = activeOutlets.find((o) => o.id === snapshot.assignedOutletId) || activeOutlets[0];

  const getInitialOutletId = () => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
        localStorage.getItem("kebabschoicepos_active_outlet_id");
      if (saved && (saved === "all" || activeOutlets.some((o) => o.id === saved))) {
        return saved;
      }
    }
    return !isOwner ? assignedOutlet?.id || "all" : activeOutlets[0]?.id || "all";
  };
  const [selectedOutletId, setSelectedOutletId] = useState<string>(getInitialOutletId);

  // Listen to outlet:changed event
  useEffect(() => {
    const handleOutletChange = (e: any) => {
      if (e.detail?.outletId && e.detail.outletId !== selectedOutletId) {
        setSelectedOutletId(e.detail.outletId);
      }
    };
    window.addEventListener("outlet:changed", handleOutletChange);
    return () => window.removeEventListener("outlet:changed", handleOutletChange);
  }, [selectedOutletId]);

  // If cashier or staff, strictly lock to their assigned outlet (business_members.outlet_id)
  useEffect(() => {
    if (!isOwner) {
      const lockedId = snapshot.assignedOutletId || activeOutlets[0]?.id || "all";
      if (selectedOutletId !== lockedId) {
        setSelectedOutletId(lockedId);
      }
    }
  }, [isOwner, snapshot.assignedOutletId, activeOutlets, selectedOutletId]);

  // Strictly enforce a real outlet (never "all") whenever in POS mode
  useEffect(() => {
    const isInvalid =
      !selectedOutletId ||
      selectedOutletId === "all" ||
      !activeOutlets.some((o) => o.id === selectedOutletId);
    if (isInvalid && activeOutlets.length > 0) {
      const targetId = (!isOwner && snapshot.assignedOutletId) || activeOutlets[0]?.id;
      if (targetId && targetId !== selectedOutletId) {
        setSelectedOutletId(targetId);
        try {
          localStorage.setItem("kebabschoicepos_active_outlet_id", targetId);
          localStorage.setItem("kebabschoicepos_selected_outlet_id", targetId);
        } catch {}
      }
    }
  }, [isOwner, selectedOutletId, activeOutlets, snapshot.assignedOutletId]);

  // Sync selected outlet to localStorage when changed
  useEffect(() => {
    if (selectedOutletId && selectedOutletId !== "all") {
      try {
        localStorage.setItem("kebabschoicepos_active_outlet_id", selectedOutletId);
        localStorage.setItem("kebabschoicepos_selected_outlet_id", selectedOutletId);
      } catch {}
    }
  }, [selectedOutletId]);

  // Active shift state for live status strictly bound to selected outlet
  const [activeShift, setActiveShift] = useState<any>(null);
  useEffect(() => {
    let isCancelled = false;

    async function syncShift() {
      try {
        const outletShift =
          selectedOutletId && selectedOutletId !== "all"
            ? localStorage.getItem(`kebabschoicepos_active_shift_${selectedOutletId}`)
            : null;
        const saved = outletShift || localStorage.getItem("kebabschoicepos_active_shift");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed?.status === "open" &&
            (!selectedOutletId || selectedOutletId === "all" || parsed.outletId === selectedOutletId)
          ) {
            if (!isCancelled) setActiveShift(parsed);
          }
        }
      } catch {}

      if (selectedOutletId && selectedOutletId !== "all") {
        try {
          const { data: dbShifts } = await supabase
            .from("pos_shifts" as any)
            .select("*")
            .eq("status", "open")
            .eq("outlet_id", selectedOutletId)
            .order("start_time", { ascending: false })
            .limit(1);

          if (dbShifts && dbShifts.length > 0 && !isCancelled) {
            const row: any = dbShifts[0];
            const liveShift = {
              id: row.id,
              cashierName: row.cashier_name || "Kasir",
              cashierId: row.cashier_id,
              teamMembers: row.team_members,
              outletName:
                row.outlet_name || activeOutlets.find((o) => o.id === selectedOutletId)?.name,
              outletId: row.outlet_id || selectedOutletId,
              startingCash: Number(row.opening_cash ?? row.starting_cash) || 0,
              startTime: row.start_time || row.opened_at,
              status: "open",
              cashSales: Number(row.cash_sales) || 0,
              totalCashIn: Number(row.total_cash_in) || 0,
              totalCashOut: Number(row.total_cash_out) || 0,
              expectedEndingCash:
                Number(row.expected_ending_cash) || Number(row.opening_cash ?? row.starting_cash) || 0,
              notes: row.notes,
            };
            setActiveShift(liveShift);
            localStorage.setItem(
              `kebabschoicepos_active_shift_${selectedOutletId}`,
              JSON.stringify(liveShift),
            );
          } else if (!dbShifts || dbShifts.length === 0) {
            if (!isCancelled) {
              const localOutletShift = localStorage.getItem(
                `kebabschoicepos_active_shift_${selectedOutletId}`,
              );
              if (!localOutletShift) setActiveShift(null);
            }
          }
        } catch {}
      }
    }

    syncShift();

    const handleShiftUpdated = () => syncShift();
    window.addEventListener("pos:shift-updated", handleShiftUpdated);
    window.addEventListener("outlet:changed", handleShiftUpdated);
    return () => {
      isCancelled = true;
      window.removeEventListener("pos:shift-updated", handleShiftUpdated);
      window.removeEventListener("outlet:changed", handleShiftUpdated);
    };
  }, [selectedOutletId, activeOutlets]);

  // Thermal Printer & Hardware status
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Standar (Browser)",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });
  const [showPrinterMenu, setShowPrinterMenu] = useState(false);

  useEffect(() => {
    const unsub = subscribePrinterStatus((info) => setPrinterInfo(info));
    return () => unsub();
  }, []);

  // Offline-First Network & Sync Status (Tahap 3)
  const [networkStatus, setNetworkStatus] = useState<NetworkSyncStatus>(getNetworkStatus());

  useEffect(() => {
    const unsub = subscribeNetworkStatus((status) => {
      setNetworkStatus(status);
    });
    return () => unsub();
  }, []);

  // Collapsible POS Header Bar (Tablet Space Optimization)
  const [isPosHeaderCollapsed, setIsPosHeaderCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kebabschoicepos_pos_header_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleHeaderCollapseEvent = (e: any) => {
      if (typeof e.detail === "boolean") {
        setIsPosHeaderCollapsed(e.detail);
      }
    };
    window.addEventListener("pos:collapse-header", handleHeaderCollapseEvent);
    return () => window.removeEventListener("pos:collapse-header", handleHeaderCollapseEvent);
  }, []);

  const handleTogglePosHeader = (collapsed: boolean) => {
    setIsPosHeaderCollapsed(collapsed);
    try {
      localStorage.setItem("kebabschoicepos_pos_header_collapsed", String(collapsed));
    } catch {}
  };

  // Customer state: Public, Member CRM, or New Customer
  const [customerMode, setCustomerMode] = useState<"public" | "member" | "new">("public");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Payment settings & cash tender
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [paymentSettings, setPaymentSettings] = useState({
    cashEnabled: true,
    qrisEnabled: true,
    cardEnabled: true,
    transferEnabled: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kebabschoicepos_payment_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setPaymentSettings({
          cashEnabled: parsed.cashEnabled ?? true,
          qrisEnabled: parsed.qrisEnabled ?? true,
          cardEnabled: parsed.cardEnabled ?? true,
          transferEnabled: parsed.transferEnabled ?? false,
        });
      }
    } catch {}
  }, []);

  const displayedProducts = useMemo(() => {
    // Strictly filter active products only. Deleted, inactive, or stock <= 0 must NOT appear
    const rawList = (snapshot.products || []).filter((product) => {
      const isProductActive = product.active !== false && (product as any).status !== "inactive";
      const isNotDeleted = !product.deleted_at && !(product as any).deletedAt;
      const hasStock = Number(product.stock) > 0;
      return isProductActive && isNotDeleted && hasStock;
    });

    if (selectedOutletId === "all") return rawList;

    return rawList
      .filter((product) => {
        if (Array.isArray(product.outlet_assignments) && product.outlet_assignments.length > 0) {
          const oa = product.outlet_assignments.find((item) => item.outlet_id === selectedOutletId);
          if (oa) {
            if (oa.available === false) return false;
            if (typeof oa.stock === "number" && oa.stock <= 0) return false;
            return true;
          }
        }
        return true;
      })
      .map((product) => {
        if (Array.isArray(product.outlet_assignments) && product.outlet_assignments.length > 0) {
          const oa = product.outlet_assignments.find((item) => item.outlet_id === selectedOutletId);
          if (oa && typeof oa.selling_price === "number" && oa.selling_price > 0) {
            return { ...product, price: oa.selling_price };
          }
        }
        return product;
      });
  }, [snapshot.products, selectedOutletId]);

  // Cache catalog menu & varian ke IndexedDB secara otomatis
  useEffect(() => {
    if (displayedProducts.length > 0) {
      cacheOutletCatalog(selectedOutletId, {
        businessId: snapshot.businessId || undefined,
        products: displayedProducts,
        categories: (snapshot as any).categories || [],
      }).catch(() => {});
    }
  }, [displayedProducts, selectedOutletId, snapshot.businessId]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "ewallet" | "card">("qris");
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [lastReceiptNotice, setLastReceiptNotice] = useState<ReceiptData | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_last_receipt");
        return raw ? JSON.parse(raw) : null;
      } catch {}
    }
    return null;
  });

  // Dynamic QRIS Realtime Payment State (Tahap 4)
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisModalData, setQrisModalData] = useState<QrisTransactionResponse | null>(null);
  const [qrisStatus, setQrisStatus] = useState<"PENDING" | "PAID" | "EXPIRED" | "FAILED">("PENDING");
  const [qrisSettlementRef, setQrisSettlementRef] = useState<string>("");
  const [isCheckingQris, setIsCheckingQris] = useState(false);
  const [qrisPendingOrder, setQrisPendingOrder] = useState<any>(null);
  const [isSettlingQris, setIsSettlingQris] = useState(false);

  // Customization Modal State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedGroupOptions, setSelectedGroupOptions] = useState<
    Record<string, MenuVariantOption[]>
  >({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<ProductModifier | null>(null);
  const [selectedPreps, setSelectedPreps] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<ProductVariant[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [customizeQuantity, setCustomizeQuantity] = useState(1);

  // Order Type, Channels, and Queue Antrean State
  const [orderType, setOrderType] = useState<PosOrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [customerQueueName, setCustomerQueueName] = useState<string>("");
  const [ojolOrderCode, setOjolOrderCode] = useState<string>("");
  const [showExtraDetails, setShowExtraDetails] = useState<boolean>(false);

  // Antrean Tersimpan (Hold Orders) State
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_held_orders");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });
  const [heldOrdersModalOpen, setHeldOrdersModalOpen] = useState(false);

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      toast.info("Keranjang masih kosong, tidak ada pesanan untuk ditahan.");
      return;
    }
    const chosenOutletId =
      selectedOutletId !== "all" ? selectedOutletId : activeOutlets[0]?.id || undefined;
    const newHold: HeldOrder = {
      id: `hold_${Date.now()}`,
      createdAt: new Date().toISOString(),
      outletId: chosenOutletId,
      orderType,
      tableNumber: tableNumber || undefined,
      customerQueueName: customerQueueName || undefined,
      ojolOrderCode: ojolOrderCode || undefined,
      orderNotes: orderNotes || undefined,
      items: [...cart],
      discountType,
      discountValue,
    };
    const updated = [newHold, ...heldOrders];
    setHeldOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_held_orders", JSON.stringify(updated));
    }
    setCart([]);
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setOrderNotes("");
    setDiscountValue(0);
    toast.success("Antrean Berhasil Ditahan (Hold)", {
      description: `Pesanan "${newHold.customerQueueName || 'Antrean #' + updated.length}" (${newHold.items.length} item) tersimpan sementara.`,
    });
  };

  const handleRestoreHeldOrder = (held: HeldOrder) => {
    if (cart.length > 0) {
      if (!confirm("Keranjang saat ini berisi pesanan aktif. Timpa dengan antrean tersimpan ini?")) {
        return;
      }
    }
    setCart(held.items);
    setOrderType(held.orderType);
    setTableNumber(held.tableNumber || "");
    setCustomerQueueName(held.customerQueueName || "");
    setOjolOrderCode(held.ojolOrderCode || "");
    setOrderNotes(held.orderNotes || "");
    setDiscountType(held.discountType || "nominal");
    setDiscountValue(held.discountValue || 0);

    const updated = heldOrders.filter((h) => h.id !== held.id);
    setHeldOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_held_orders", JSON.stringify(updated));
    }
    setHeldOrdersModalOpen(false);
    toast.success("Antrean Dipulihkan", {
      description: `Pesanan "${held.customerQueueName || 'Antrean'}" siap diproses checkout.`,
    });
  };

  const handleDeleteHeldOrder = (id: string) => {
    const updated = heldOrders.filter((h) => h.id !== id);
    setHeldOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_held_orders", JSON.stringify(updated));
    }
    toast.info("Antrean Dihapus", {
      description: "Pesanan ditahan telah dibatalkan.",
    });
  };

  // Cashier Discount State
  const [discountType, setDiscountType] = useState<"nominal" | "percent">("nominal");
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Tax & Service Charge Settings State
  const [taxSettings, setTaxSettings] = useState<{
    taxEnabled: boolean;
    taxRate: number;
    taxName: string;
    taxMode: "inclusive" | "exclusive";
    serviceEnabled: boolean;
    serviceRate: number;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_tax_settings");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return {
      taxEnabled: false,
      taxRate: 10,
      taxName: "PB1 (Pajak Restoran)",
      taxMode: "exclusive",
      serviceEnabled: false,
      serviceRate: 5,
    };
  });

  // Re-read tax & payment settings on outlet change, window focus, or storage event
  useEffect(() => {
    const syncSettings = () => {
      // 1. Resolve active outlet
      const activeOutlet = snapshot.outlets?.find((o) => o.id === selectedOutletId);

      // Tax settings
      const outletTax = activeOutlet?.settings?.tax_settings;
      if (outletTax) {
        setTaxSettings((prev) => ({
          ...prev,
          taxEnabled: outletTax.taxEnabled ?? prev.taxEnabled,
          taxRate: outletTax.taxRate ?? prev.taxRate,
          taxName: outletTax.taxName || prev.taxName,
          taxMode: outletTax.taxMode || prev.taxMode,
          serviceEnabled: outletTax.serviceEnabled ?? prev.serviceEnabled,
          serviceRate: outletTax.serviceRate ?? prev.serviceRate,
        }));
      } else {
        try {
          const raw = localStorage.getItem("kebabschoicepos_tax_settings");
          if (raw) setTaxSettings(JSON.parse(raw));
        } catch {}
      }

      // Payment settings
      const outletPay = activeOutlet?.settings?.payment_settings;
      if (outletPay) {
        setPaymentSettings({
          cashEnabled: outletPay.cashEnabled ?? true,
          qrisEnabled: outletPay.qrisEnabled ?? true,
          cardEnabled: outletPay.cardEnabled ?? true,
          transferEnabled: outletPay.transferEnabled ?? false,
        });
      } else {
        try {
          const saved = localStorage.getItem("kebabschoicepos_payment_settings");
          if (saved) {
            const parsed = JSON.parse(saved);
            setPaymentSettings({
              cashEnabled: parsed.cashEnabled ?? true,
              qrisEnabled: parsed.qrisEnabled ?? true,
              cardEnabled: parsed.cardEnabled ?? true,
              transferEnabled: parsed.transferEnabled ?? false,
            });
          }
        } catch {}
      }
    };

    syncSettings();
    window.addEventListener("focus", syncSettings);
    window.addEventListener("storage", syncSettings);
    return () => {
      window.removeEventListener("focus", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, [selectedOutletId, snapshot.outlets]);

  // Auto switch paymentMethod to first enabled option if current selection is disabled
  useEffect(() => {
    const isCurrentEnabled =
      (paymentMethod === "cash" && paymentSettings.cashEnabled) ||
      (paymentMethod === "qris" && paymentSettings.qrisEnabled) ||
      (paymentMethod === "card" && paymentSettings.cardEnabled) ||
      (paymentMethod === "ewallet" && paymentSettings.transferEnabled);

    if (!isCurrentEnabled) {
      if (paymentSettings.cashEnabled) setPaymentMethod("cash");
      else if (paymentSettings.qrisEnabled) setPaymentMethod("qris");
      else if (paymentSettings.cardEnabled) setPaymentMethod("card");
      else if (paymentSettings.transferEnabled) setPaymentMethod("ewallet");
    }
  }, [paymentMethod, paymentSettings]);

  // Cart total computation with Discount, Service Charge, and Tax
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.unit_price || item.price) * item.quantity,
    0,
  );

  const discountAmount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountType === "percent") {
      const pct = Math.min(100, Math.max(0, discountValue));
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const serviceChargeAmount = useMemo(() => {
    if (!taxSettings.serviceEnabled || !taxSettings.serviceRate || taxSettings.serviceRate <= 0) return 0;
    return Math.round((afterDiscount * taxSettings.serviceRate) / 100);
  }, [afterDiscount, taxSettings.serviceEnabled, taxSettings.serviceRate]);

  const taxAmount = useMemo(() => {
    if (!taxSettings.taxEnabled || !taxSettings.taxRate || taxSettings.taxRate <= 0) return 0;
    const taxableBase = afterDiscount + serviceChargeAmount;
    if (taxSettings.taxMode === "inclusive") {
      return Math.round(taxableBase * (taxSettings.taxRate / (100 + taxSettings.taxRate)));
    }
    return Math.round((taxableBase * taxSettings.taxRate) / 100);
  }, [afterDiscount, serviceChargeAmount, taxSettings.taxEnabled, taxSettings.taxRate, taxSettings.taxMode]);

  const total = useMemo(() => {
    if (taxSettings.taxMode === "inclusive") {
      return afterDiscount + serviceChargeAmount;
    }
    return afterDiscount + serviceChargeAmount + taxAmount;
  }, [afterDiscount, serviceChargeAmount, taxAmount, taxSettings.taxMode]);

  // Fast 1-click Add to Cart (when product has no required variants)
  const handleFastAddToCart = (product: Product) => {
    const hasRequiredVariants = (product.variant_groups || []).some(
      (g) => g.is_required !== false && g.options && g.options.length > 0,
    );

    if (hasRequiredVariants) {
      handleOpenCustomize(product);
      return;
    }

    const effectivePrice = product.promo_price && product.promo_price < product.price ? product.promo_price : product.price;
    const cartItemId = `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: CartItem = {
      ...product,
      cart_item_id: cartItemId,
      quantity: 1,
      base_price: product.price,
      unit_price: effectivePrice,
      price: effectivePrice,
      selected_variant: null,
      selected_variant_groups: [],
      selected_modifiers: [],
      selected_addons: [],
    };

    setCart((current) => [...current, newItem]);
    toast.success(`${product.name} (+1) ditambahkan ke keranjang`, {
      description: formatRupiah(effectivePrice),
    });
  };

  // Open Customization Modal
  const handleOpenCustomize = (product: Product) => {
    setCustomizingProduct(product);

    // Initialize variant groups options
    const vGroups =
      product.variant_groups && product.variant_groups.length > 0 ? product.variant_groups : [];
    const initialGroupSelections: Record<string, MenuVariantOption[]> = {};

    vGroups.forEach((group, idx) => {
      const gKey = group.id || group.name || `group-${idx}`;
      if (group.selection_type === "single") {
        const defOpt = group.options.find((o) => o.is_default) || group.options[0];
        initialGroupSelections[gKey] = defOpt ? [defOpt] : [];
      } else {
        const defOpts = group.options.filter((o) => o.is_default);
        initialGroupSelections[gKey] = defOpts;
      }
    });
    setSelectedGroupOptions(initialGroupSelections);

    // Default legacy variant
    const defaultVar =
      product.variants && product.variants.length > 0 ? (product.variants[0] ?? null) : null;
    setSelectedVariant(defaultVar);

    // Default level
    const levels = product.modifiers?.filter((m) => m.category === "level") || [];
    const defaultLvl =
      levels.find(
        (l) =>
          l.name.toLowerCase().includes("tidak pedas") || l.name.toLowerCase().includes("original"),
      ) ||
      levels[0] ||
      null;
    setSelectedLevel(defaultLvl);

    setSelectedPreps([]);
    setSelectedAddons([]);
    setOrderNotes("");
    setCustomizeQuantity(1);
  };

  // Real-time Dynamic Price calculation inside modal (Base + sum of chosen Variant Groups + sum of chosen Add-ons)
  const calculatedUnitPrice = useMemo(() => {
    if (!customizingProduct) return 0;
    let price =
      customizingProduct.promo_price && customizingProduct.promo_price < customizingProduct.price
        ? customizingProduct.promo_price
        : customizingProduct.price;

    const vGroups =
      customizingProduct.variant_groups && customizingProduct.variant_groups.length > 0
        ? customizingProduct.variant_groups
        : [];

    if (vGroups.length > 0) {
      Object.values(selectedGroupOptions).forEach((opts) => {
        (opts || []).forEach((opt) => {
          price += Number(opt.additional_price ?? opt.price_adjustment) || 0;
        });
      });
    } else {
      if (selectedVariant) {
        price += Number(selectedVariant.price_adjustment) || 0;
      }
      if (selectedLevel) {
        price += Number(selectedLevel.price_adjustment) || 0;
      }
    }

    for (const addon of selectedAddons) {
      price += Number(addon.price_adjustment) || 0;
    }
    return price;
  }, [customizingProduct, selectedGroupOptions, selectedVariant, selectedLevel, selectedAddons]);

  const calculatedItemTotal = calculatedUnitPrice * customizeQuantity;

  // Add customized item into Cart
  const handleConfirmAddToCart = () => {
    if (!customizingProduct) return;

    const vGroups =
      customizingProduct.variant_groups && customizingProduct.variant_groups.length > 0
        ? customizingProduct.variant_groups
        : [];

    // Validasi: Kelompok varian bertanda "Pilihan wajib dipilih" harus diisi
    for (let idx = 0; idx < vGroups.length; idx++) {
      const g = vGroups[idx];
      if (g && g.is_required !== false) {
        const gKey = g.id || g.name || `group-${idx}`;
        const chosen = selectedGroupOptions[gKey] || [];
        if (chosen.length === 0) {
          toast.error(`Pilihan wajib dipilih: ${g.name}`);
          return;
        }
      }
    }

    const selectedVariantGroupsSummary = vGroups
      .map((g, idx) => {
        const gKey = g.id || g.name || `group-${idx}`;
        const chosen = selectedGroupOptions[gKey] || [];
        return {
          group_id: g.id,
          group_name: g.name,
          selection_type: g.selection_type || "single",
          options: chosen.map((o) => ({
            id: o.id,
            name: o.name,
            price: Number(o.additional_price ?? o.price_adjustment) || 0,
          })),
        };
      })
      .filter((g) => g.options.length > 0);

    const variantNames = selectedVariantGroupsSummary
      .flatMap((g) => g.options.map((o) => o.name))
      .filter(Boolean);

    const firstOpt = selectedVariantGroupsSummary[0]?.options[0];
    const legacyVariant = firstOpt
      ? { name: firstOpt.name, price: firstOpt.price }
      : selectedVariant
        ? { name: selectedVariant.name, price: Number(selectedVariant.price_adjustment) || 0 }
        : null;

    const cartItemId = `${customizingProduct.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: CartItem = {
      ...customizingProduct,
      cart_item_id: cartItemId,
      quantity: customizeQuantity,
      base_price: customizingProduct.price,
      unit_price: calculatedUnitPrice,
      price: calculatedUnitPrice,
      selected_variant: legacyVariant,
      variant_name: variantNames.length > 0 ? variantNames.join(" • ") : undefined,
      selected_variant_groups: selectedVariantGroupsSummary,
      selected_modifiers: [...(selectedLevel ? [selectedLevel.name] : []), ...selectedPreps],
      selected_addons: selectedAddons.map((a) => ({
        name: a.name,
        price: Number(a.price_adjustment) || 0,
      })),
      notes: orderNotes.trim() || undefined,
    };

    setCart((current) => [...current, newItem]);
    setCustomizingProduct(null);
    toast.success(`${customizingProduct.name} ditambahkan ke keranjang`, {
      description: `${newItem.variant_name ? newItem.variant_name + " • " : ""}${formatRupiah(calculatedItemTotal)}`,
    });
  };

  // Barcode Scanner Handler (Tahap 2B - Keyboard Wedge Mode)
  const handleBarcodeScan = (barcode: string) => {
    const searchCode = barcode.trim().toLowerCase();
    if (!searchCode) return;

    // 1. Cari menu aktif di outlet tersebut yang memiliki SKU atau barcode yang cocok
    let matchedProduct = displayedProducts.find((p) => {
      const pSku = (p.sku || "").trim().toLowerCase();
      const pBarcode = (p.barcode || "").trim().toLowerCase();
      const pId = (p.id || "").trim().toLowerCase();
      return (
        (pSku && pSku === searchCode) ||
        (pBarcode && pBarcode === searchCode) ||
        (pId && pId === searchCode)
      );
    });

    // Cari juga di dalam opsi varian jika SKU terdaftar di varian
    if (!matchedProduct) {
      for (const prod of displayedProducts) {
        if (prod.variant_groups) {
          for (const group of prod.variant_groups) {
            const hasMatch = group.options?.some(
              (o: any) => (o.sku || "").trim().toLowerCase() === searchCode,
            );
            if (hasMatch) {
              matchedProduct = prod;
              break;
            }
          }
        }
        if (matchedProduct) break;
      }
    }

    // 2. Jika SKU tidak ditemukan, tampilkan peringatan toast
    if (!matchedProduct) {
      toast.error("SKU tidak ditemukan", {
        description: `Barcode / SKU "${barcode}" tidak terdaftar pada outlet ini.`,
      });
      return;
    }

    // 3. Evaluasi apakah menu memiliki varian wajib
    const vGroups = matchedProduct.variant_groups || [];
    const hasRequiredVariant = vGroups.some(
      (g) => g.is_required !== false && g.options && g.options.length > 0,
    );
    const hasLegacyVariants =
      Array.isArray(matchedProduct.variants) && matchedProduct.variants.length > 1;

    if (hasRequiredVariant || hasLegacyVariants) {
      // Menu memiliki varian wajib -> otomatis buka modal kustomisasi
      handleOpenCustomize(matchedProduct);
      toast.info(`Pilih varian untuk ${matchedProduct.name}`, {
        description: "Menu memiliki pilihan wajib yang harus ditentukan.",
      });
    } else {
      // Menu tidak memiliki varian wajib -> langsung tambahkan ke keranjang (+1 qty)
      const price =
        matchedProduct.promo_price && matchedProduct.promo_price < matchedProduct.price
          ? matchedProduct.promo_price
          : matchedProduct.price;

      setCart((current) => {
        const existingIdx = current.findIndex(
          (it) =>
            it.id === matchedProduct.id &&
            !it.variant_name &&
            (!it.selected_addons || it.selected_addons.length === 0) &&
            (!it.selected_modifiers || it.selected_modifiers.length === 0),
        );

        if (existingIdx >= 0) {
          const updated = [...current];
          const existingItem = updated[existingIdx];
          if (existingItem) {
            updated[existingIdx] = {
              ...existingItem,
              quantity: existingItem.quantity + 1,
            };
          }
          return updated;
        }

        const cartItemId = `${matchedProduct.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newItem: CartItem = {
          ...matchedProduct,
          cart_item_id: cartItemId,
          quantity: 1,
          base_price: matchedProduct.price,
          unit_price: price,
          price,
          selected_variant: null,
          selected_variant_groups: [],
          selected_modifiers: [],
          selected_addons: [],
        };
        return [...current, newItem];
      });

      toast.success(`${matchedProduct.name} (+1)`, {
        description: `SKU: ${matchedProduct.sku || barcode} • ${formatRupiah(price)}`,
      });
    }
  };

  // Daftarkan listener barcode scanner (keystrokes cepat < 40ms diakhiri Enter)
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    maxIntervalMs: 40,
    minBarcodeLength: 3,
    enabled: !completedReceipt && !customizingProduct,
  });

  // Cart quantity adjustment
  const changeQuantity = (cartItemId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          (item.cart_item_id || item.id) === cartItemId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  // Remove specific cart item instance
  const removeCartItem = (cartItemId: string) => {
    setCart((current) => current.filter((item) => (item.cart_item_id || item.id) !== cartItemId));
  };

  // Realtime QRIS status listener (Tahap 4)
  useEffect(() => {
    if (!isQrisModalOpen || !qrisModalData?.external_reference_id) return;

    const unsub = subscribeQrisStatus(
      qrisModalData.external_reference_id,
      (status, details) => {
        if (status === "PAID") {
          setQrisStatus("PAID");
          if (details?.settlement_reference) {
            setQrisSettlementRef(details.settlement_reference);
          }
        } else if (status === "EXPIRED" || status === "FAILED") {
          setQrisStatus(status);
        }
      },
    );

    return () => unsub();
  }, [isQrisModalOpen, qrisModalData?.external_reference_id]);

  // Finalize order after QRIS payment is confirmed PAID
  async function finalizePaidQrisOrder(pendingOrder: any, settlementRef: string) {
    if (!pendingOrder) return;
    const {
      orderNumber,
      chosenOutletId,
      effectiveCustomerId,
      effectiveCustomerName,
      total: orderTotal,
      cartItems,
      orderPayload,
    } = pendingOrder;

    const orderItemsPayload = cartItems.map((item: CartItem) => {
      const optionsSummary = [
        item.variant_name || (item.selected_variant ? item.selected_variant.name : null),
        item.selected_modifiers?.length ? item.selected_modifiers.join(", ") : null,
        item.selected_addons?.length
          ? item.selected_addons.map((a) => `+${a.name}`).join(", ")
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const fullDisplayName = optionsSummary
        ? `${item.name} (${optionsSummary})${item.notes ? ` [Catatan: ${item.notes}]` : ""}`
        : item.name;

      return {
        product_id: item.id.startsWith("demo-") ? null : item.id,
        name: fullDisplayName,
        variant_name: item.variant_name || item.selected_variant?.name || null,
        notes: item.notes || null,
        selected_options: {
          variant: item.selected_variant || null,
          variant_groups: item.selected_variant_groups || [],
          modifiers: item.selected_modifiers || [],
          addons: item.selected_addons || [],
          notes: item.notes || "",
        },
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        final_price: item.unit_price || item.price,
        subtotal: (item.unit_price || item.price) * item.quantity,
      };
    });

    let order: { id: string } | null = null;
    try {
      let res = await supabase
        .from("sales_orders")
        .insert({
          ...orderPayload,
          payment_method: "qris",
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (res.error && (res.error.message?.includes("outlet_id") || res.error.code === "PGRST204")) {
        const fallbackPayload = { ...orderPayload };
        delete fallbackPayload.outlet_id;
        res = await supabase
          .from("sales_orders")
          .insert({
            ...fallbackPayload,
            payment_method: "qris",
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .select("id")
          .single();
      }

      if (!res.error && res.data) {
        order = res.data;
        const orderId = order.id;
        const itemsToInsert = orderItemsPayload.map((it: any) => ({
          ...it,
          order_id: orderId,
        }));
        const { error: itemsErr } = await supabase.from("sales_order_items").insert(itemsToInsert as any);
        if (itemsErr) {
          console.warn("[QRIS] sales_order_items insert warning, retrying with core fields:", itemsErr.message);
          const coreItems = itemsToInsert.map((it: any) => ({
            order_id: it.order_id,
            product_id: it.product_id,
            name: it.name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: it.subtotal,
          }));
          await supabase.from("sales_order_items").insert(coreItems as any);
        }

        if (chosenOutletId) {
          try {
            await recordOrderOutletMetadata(snapshot.businessId || "", chosenOutletId, orderId, {
              userId: profile?.email || "staff",
              displayName: profile?.displayName || "Kasir",
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[QRIS] Error persisting paid sales_order:", e);
    }

    // Automated Recipe / BOM Inventory Depletion
    const deductedInventory: Record<string, number> = {};
    const deductedProducts: Record<string, number> = {};

    if (order && order.id) {
      try {
        let outletRecsQuery = supabase.from("outlets").select("settings");
        if (chosenOutletId) {
          outletRecsQuery = outletRecsQuery.eq("id", chosenOutletId);
        } else {
          outletRecsQuery = outletRecsQuery.eq("business_id", snapshot.businessId || "");
        }

        const { data: outletRecs } = await outletRecsQuery.limit(1);
        const cachedRecipes = (outletRecs?.[0]?.settings as any)?.menu_recipes || {};

        for (const cartItem of cartItems) {
          const recipe = await resolveMenuRecipe(
            cartItem,
            snapshot.businessId,
            chosenOutletId,
            cachedRecipes,
          );
          if (recipe && Array.isArray(recipe.items)) {
            for (const ing of recipe.items) {
              if (ing.inventory_item_id || (ing as any).ingredient_name) {
                const depletion = await depleteIngredientStock({
                  ingredient: ing,
                  cartItemQuantity: cartItem.quantity,
                  cartItemName: cartItem.name,
                  chosenOutletId,
                  businessId: snapshot.businessId || "",
                  orderId: order?.id || null,
                  orderNumber,
                  prefixNote: "POS QRIS",
                });
                if (depletion) {
                  deductedInventory[depletion.inventoryId] =
                    (deductedInventory[depletion.inventoryId] || 0) + depletion.deductedQuantity;
                }
              }
            }
          }
        }
      } catch (bomErr) {
        console.warn("[BOM] QRIS Depletion warning:", bomErr);
      }

      // Deduct stock from products
      try {
        for (const cartItem of cartItems) {
          if (cartItem.id && !cartItem.id.startsWith("demo-")) {
            const currentProd = snapshot.products.find((p) => p.id === cartItem.id);
            if (currentProd) {
              const newProdStock = Math.max(0, (Number(currentProd.stock) || 0) - cartItem.quantity);
              await supabase
                .from("products")
                .update({ stock: newProdStock, updated_at: new Date().toISOString() })
                .eq("id", cartItem.id);

              deductedProducts[cartItem.id] =
                (deductedProducts[cartItem.id] || 0) + cartItem.quantity;
            }
          }
        }
      } catch (prodErr) {
        console.warn("[POS] Product stock reduction warning:", prodErr);
      }
    }

    // Update local snapshot
    if (Object.keys(deductedInventory).length > 0) {
      for (const inv of snapshot.inventory) {
        const dec = deductedInventory[inv.id];
        if (dec) inv.stock = Math.max(0, (Number(inv.stock) || 0) - dec);
      }
    }
    if (Object.keys(deductedProducts).length > 0) {
      for (const prod of snapshot.products) {
        const decProd = deductedProducts[prod.id];
        if (decProd) prod.stock = Math.max(0, (Number(prod.stock) || 0) - decProd);
      }
    }

    const chosenOutlet = (snapshot.outlets || []).find((o) => o.id === chosenOutletId);
    const receiptData: ReceiptData = {
      orderNumber,
      outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
      cashierName: activeCashierName || profile?.displayName || "Kasir",
      paymentMethod: "QRIS",
      customerName: effectiveCustomerName,
      customerQueueName: qrisPendingOrder?.customerQueueName || undefined,
      ojolOrderCode: qrisPendingOrder?.ojolOrderCode || undefined,
      createdAt: new Date().toISOString(),
      subtotal: qrisPendingOrder?.subtotal ?? orderTotal,
      discountAmount: qrisPendingOrder?.discountAmount ?? 0,
      serviceChargeAmount: qrisPendingOrder?.serviceChargeAmount ?? 0,
      taxAmount: qrisPendingOrder?.taxAmount ?? 0,
      orderType: qrisPendingOrder?.orderType ?? "dine_in",
      tableNumber: qrisPendingOrder?.tableNumber || undefined,
      items: cartItems.map((c: CartItem) => ({
        name: c.variant_name ? `${c.name} (${c.variant_name})` : c.name,
        quantity: c.quantity,
        price: c.unit_price || c.price,
        subtotal: (c.unit_price || c.price) * c.quantity,
      })),
      total: orderTotal,
    };

    try {
      localStorage.setItem("kebabschoicepos_last_receipt", JSON.stringify(receiptData));
    } catch {}

    setLastReceiptNotice(receiptData);

    // Construct local SalesOrder object and guarantee immediate appearance in Riwayat Order Hari Ini
    const newSalesOrder: SalesOrder = {
      id: order?.id || `qris-${Date.now()}`,
      order_number: orderNumber,
      total: orderTotal,
      payment_method: "qris",
      status: "paid",
      channel: "store",
      created_at: receiptData.createdAt,
      customer_id: effectiveCustomerId,
      outlet_id: chosenOutletId,
    };

    if (snapshot.orders) {
      snapshot.orders = [
        newSalesOrder,
        ...snapshot.orders.filter((o) => o.order_number !== orderNumber),
      ];
    }

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_recent_orders");
        const existing: SalesOrder[] = raw ? JSON.parse(raw) : [];
        const updated = [newSalesOrder, ...existing.filter((o) => o.order_number !== orderNumber)].slice(0, 100);
        localStorage.setItem("kebabschoicepos_recent_orders", JSON.stringify(updated));
      } catch (e) {
        console.warn("[QRIS] LocalStorage recent_orders warning:", e);
      }
      window.dispatchEvent(new CustomEvent("order:created", { detail: newSalesOrder }));
    }

    // Print receipt automatically if configured
    const savedPrinter = getSavedPrinterConfig();
    if (savedPrinter.autoPrint !== false) {
      printReceipt({
        storeName: savedPrinter.storeName || snapshot.businessName || "KEBAB'S CHOICE",
        outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
        branchAddress: savedPrinter.branchAddress,
        orderNumber,
        cashierName: activeCashierName || profile?.displayName || "Kasir",
        paymentMethod: "QRIS",
        customerName: effectiveCustomerName,
        orderType: qrisPendingOrder?.orderType ?? "dine_in",
        tableNumber: qrisPendingOrder?.tableNumber || undefined,
        createdAt: receiptData.createdAt,
        date: new Date(receiptData.createdAt).toLocaleString("id-ID"),
        items: receiptData.items.map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          qty: it.quantity,
          price: it.price,
          subtotal: it.subtotal,
        })),
        subtotal: qrisPendingOrder?.subtotal ?? orderTotal,
        discount: qrisPendingOrder?.discountAmount ?? 0,
        serviceCharge: qrisPendingOrder?.serviceChargeAmount ?? 0,
        tax: qrisPendingOrder?.taxAmount ?? 0,
        total: orderTotal,
        footerMessage: savedPrinter.footerMessage || "Terima kasih atas kunjungan Anda!",
      }).catch(() => {});
    }

    setCart([]);
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setSelectedCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setCustomerMode("public");

    toast.success("PEMBAYARAN QRIS LUNAS", {
      description: `Order #${orderNumber} terverifikasi otomatis via Realtime Webhook & struk dicetak.`,
    });

    if (isOnline()) {
      onRefresh().catch(() => {});
    }
  }

  // Trigger auto-settlement completion when QRIS status changes to PAID
  useEffect(() => {
    if (qrisStatus === "PAID" && isQrisModalOpen && !isSettlingQris && qrisPendingOrder) {
      setIsSettlingQris(true);
      finalizePaidQrisOrder(qrisPendingOrder, qrisSettlementRef);
    }
  }, [qrisStatus, isQrisModalOpen, isSettlingQris, qrisPendingOrder, qrisSettlementRef]);

  // Handle Manual Status Verification
  const handleCheckQrisStatus = async () => {
    if (!qrisModalData?.external_reference_id) return;
    setIsCheckingQris(true);
    try {
      const res = await checkQrisPaymentStatus(qrisModalData.external_reference_id);
      if (res.status === "PAID") {
        setQrisStatus("PAID");
        if (res.settlement_reference) {
          setQrisSettlementRef(res.settlement_reference);
        }
        toast.success("Pembayaran QRIS Dikonfirmasi Lunas!");
      } else {
        toast.info("Status QRIS: Menunggu Pembayaran", {
          description: "Pelanggan belum menyelesaikan pembayaran di aplikasi e-wallet / mobile banking.",
        });
      }
    } catch {
      toast.error("Gagal memeriksa status pembayaran");
    } finally {
      setIsCheckingQris(false);
    }
  };

  // Handle QRIS Simulation (Demo & Testing Mode)
  const handleSimulateQrisPayment = async () => {
    if (!qrisModalData?.external_reference_id) return;
    try {
      const sim = await simulateQrisPayment(qrisModalData.external_reference_id);
      if (sim.success) {
        setQrisStatus("PAID");
        setQrisSettlementRef(sim.settlement_reference);
        toast.success("Simulasi Pembayaran QRIS Berhasil!");
      }
    } catch {
      toast.error("Gagal menjalankan simulasi QRIS");
    }
  };

  // Checkout transaction
  async function checkout() {
    if (!snapshot.businessId || cart.length === 0) {
      toast.info("Tambahkan produk dulu sebelum checkout.");
      return;
    }

    const orderNumber = `KP-${Date.now().toString().slice(-8)}`;
    const chosenOutletId =
      selectedOutletId && selectedOutletId !== "all"
        ? selectedOutletId
        : (activeOutlets[0]?.id || snapshot.assignedOutletId || null);

    if (!chosenOutletId) {
      toast.error("Pilih Cabang Outlet terlebih dahulu sebelum melakukan transaksi kasir.");
      return;
    }
    const isOjolChannel = ["gofood", "grabfood", "shopeefood"].includes(orderType);
    let effectiveCustomerId: string | null = null;
    let effectiveCustomerName = "Pelanggan Umum";

    if (customerMode === "member" && selectedCustomerId) {
      effectiveCustomerId = selectedCustomerId;
      effectiveCustomerName =
        snapshot.customers.find((c) => c.id === selectedCustomerId)?.name || "Member CRM";
    } else if (customerMode === "new" && newCustomerName.trim()) {
      effectiveCustomerName = newCustomerName.trim();
      try {
        const { data: createdCust } = await supabase
          .from("customers")
          .insert({
            business_id: snapshot.businessId,
            name: effectiveCustomerName,
            phone: newCustomerPhone.trim() || null,
            visits: 1,
            total_spend: total,
            favorite_product: cart[0]?.name || null,
            ai_insight: `Pelanggan baru POS: Transaksi ${formatRupiah(total)} pada ${new Date().toLocaleDateString("id-ID")}`,
          })
          .select("id, name")
          .single();
        if (createdCust) {
          effectiveCustomerId = createdCust.id;
        }
      } catch (err) {
        console.warn("[CRM] New customer insertion warning:", err);
      }
    }

    const orderPayload: any = {
      business_id: snapshot.businessId,
      order_number: orderNumber,
      subtotal,
      discount_amount: discountAmount,
      service_charge: serviceChargeAmount,
      tax_amount: taxAmount,
      total,
      payment_method: paymentMethod,
      order_type: orderType,
      table_number: orderType === "dine_in" && tableNumber ? tableNumber : null,
      status: "paid",
      channel: isOjolChannel ? orderType : "store",
      paid_at: new Date().toISOString(),
      customer_name: effectiveCustomerName || null,
    };
    if (customerQueueName || ojolOrderCode) {
      orderPayload.notes = [
        customerQueueName ? `Antrean: ${customerQueueName}` : null,
        ojolOrderCode ? `Kode Ojol: ${ojolOrderCode}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
    }

    if (chosenOutletId) {
      orderPayload.outlet_id = chosenOutletId;
    }
    if (effectiveCustomerId) {
      orderPayload.customer_id = effectiveCustomerId;
    }

    // Dynamic QRIS Interception (Tahap 4)
    if (paymentMethod === "qris") {
      const chosenOutlet = (snapshot.outlets || []).find((o) => o.id === chosenOutletId);
      const merchantName = chosenOutlet?.name || "KEBABS CHOICE";

      try {
        const qrisRes = await generateDynamicQris({
          businessId: snapshot.businessId,
          outletId: chosenOutletId,
          orderNumber,
          amount: total,
          customerName: effectiveCustomerName,
          merchantName,
          city: (chosenOutlet as any)?.city || "JAKARTA",
        });

        setQrisPendingOrder({
          orderNumber,
          chosenOutletId,
          effectiveCustomerId,
          effectiveCustomerName,
          customerQueueName,
          ojolOrderCode,
          subtotal,
          discountAmount,
          serviceChargeAmount,
          taxAmount,
          orderType,
          tableNumber,
          total,
          cartItems: [...cart],
          orderPayload,
        });

        setQrisModalData(qrisRes);
        setQrisStatus("PENDING");
        setQrisSettlementRef("");
        setIsSettlingQris(false);
        setIsQrisModalOpen(true);
        return;
      } catch (err: any) {
        console.error("[QRIS] Error creating QRIS:", err);
        toast.error("Gagal membuat pembayaran QRIS Dinamis");
      }
    }

    // Generate unique UUID idempotency key for this transaction
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Build comprehensive order item payload
    const orderItemsPayload = cart.map((item) => {
      const optionsSummary = [
        item.variant_name || (item.selected_variant ? item.selected_variant.name : null),
        item.selected_modifiers?.length ? item.selected_modifiers.join(", ") : null,
        item.selected_addons?.length
          ? item.selected_addons.map((a) => `+${a.name}`).join(", ")
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const fullDisplayName = optionsSummary
        ? `${item.name} (${optionsSummary})${item.notes ? ` [Catatan: ${item.notes}]` : ""}`
        : item.name;

      return {
        product_id: item.id.startsWith("demo-") ? null : item.id,
        name: fullDisplayName,
        variant_name: item.variant_name || item.selected_variant?.name || null,
        notes: item.notes || null,
        selected_options: {
          variant: item.selected_variant || null,
          variant_groups: item.selected_variant_groups || [],
          modifiers: item.selected_modifiers || [],
          addons: item.selected_addons || [],
          notes: item.notes || "",
        },
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        final_price: item.unit_price || item.price,
        subtotal: (item.unit_price || item.price) * item.quantity,
      };
    });

    let order: { id: string } | null = null;
    let isQueuedOffline = !isOnline();

    if (!isQueuedOffline) {
      try {
        let res = await supabase.from("sales_orders").insert(orderPayload).select("id").single();

        if (res.error) {
          console.warn("[POS] Initial sales_orders insert failed (possible 400 Bad Request), retrying with core columns:", res.error);

          const corePayload: any = {
            business_id: snapshot.businessId,
            order_number: orderNumber,
            total,
            subtotal,
            discount_amount: discountAmount,
            service_charge: serviceChargeAmount,
            tax_amount: taxAmount,
            payment_method: paymentMethod.toLowerCase(),
            order_type: orderType,
            table_number: orderType === "dine_in" && tableNumber ? tableNumber : null,
            status: "paid",
            customer_name: effectiveCustomerName || null,
            channel: isOjolChannel ? orderType : "store",
          };
          if (chosenOutletId) corePayload.outlet_id = chosenOutletId;
          if (effectiveCustomerId) corePayload.customer_id = effectiveCustomerId;

          let retryRes = await supabase.from("sales_orders").insert(corePayload).select("id").single();

          if (retryRes.error) {
            delete corePayload.outlet_id;
            retryRes = await supabase.from("sales_orders").insert(corePayload).select("id").single();
          }

          if (retryRes.error) {
            console.warn("[POS] Core retry insert also failed, routing to offline queue:", retryRes.error);
            isQueuedOffline = true;
          } else {
            order = retryRes.data;
          }
        } else {
          order = res.data;
        }
      } catch (networkErr) {
        console.warn("[POS] Network exception during checkout, routing to offline queue:", networkErr);
        isQueuedOffline = true;
      }
    }

    if (isQueuedOffline) {
      // Mode Offline: simpan transaksi ke IndexedDB pending_transactions dengan idempotency_key
      const offlineTx: OfflineTransaction = {
        idempotency_key: idempotencyKey,
        order_number: orderNumber,
        business_id: snapshot.businessId,
        outlet_id: chosenOutletId || "all",
        cashier_name: profile?.displayName || "Kasir",
        customer_id: effectiveCustomerId,
        customer_name: effectiveCustomerName,
        payment_method: paymentMethod,
        total,
        created_at: new Date().toISOString(),
        items: cart,
        status: "pending",
        retry_count: 0,
        raw_order_payload: orderPayload,
        raw_order_items_payload: orderItemsPayload,
      };

      await queueOfflineTransaction(offlineTx);

      toast.warning("Transaksi Disimpan Offline", {
        description: `Order #${orderNumber} tersimpan di IndexedDB & akan otomatis disinkronkan ke Supabase saat online.`,
      });
    } else if (order && order.id) {
      // Persist single source of truth metadata for Outlet & Staff
      if (chosenOutletId && order.id) {
        try {
          await recordOrderOutletMetadata(snapshot.businessId, chosenOutletId, order.id, {
            userId: profile?.email || "staff",
            displayName: profile?.displayName || "Kasir",
          });
        } catch (metaErr) {
          console.warn("[POS] Warning recording outlet metadata:", metaErr);
        }
      }

      // Customer CRM Update: visits, total spend, points, and favorite product
      if (selectedCustomerId) {
        try {
          const currentCust = snapshot.customers.find((c) => c.id === selectedCustomerId);
          const topItemName = cart[0]?.name || null;
          const pointsEarned = Math.max(1, Math.floor(total / 10000));
          const newPoints = (currentCust?.points || 0) + pointsEarned;
          const newSpend = (currentCust?.total_spend || 0) + total;
          const newVisits = (currentCust?.visits || 0) + 1;

          if (currentCust) {
            currentCust.visits = newVisits;
            currentCust.total_spend = newSpend;
            currentCust.points = newPoints;
            currentCust.favorite_product = topItemName || currentCust.favorite_product;
          }

          await supabase
            .from("customers")
            .update({
              visits: newVisits,
              total_spend: newSpend,
              favorite_product: topItemName || currentCust?.favorite_product,
              ai_insight: `Loyalty Member: +${pointsEarned} Poin (Total: ${newPoints} Poin). Transaksi ${formatRupiah(total)} pada ${new Date().toLocaleDateString("id-ID")}`,
            })
            .eq("id", selectedCustomerId);
        } catch (custErr) {
          console.warn("[CRM] Customer update warning:", custErr);
        }
      }

      // Insert sales order items online
      const orderId = order.id;
      const itemsToInsert = orderItemsPayload.map((it) => ({
        ...it,
        order_id: orderId,
      }));
      const { error: itemsErr } = await supabase.from("sales_order_items").insert(itemsToInsert as any);
      if (itemsErr) {
        console.warn("[POS] sales_order_items insert warning, retrying with core fields:", itemsErr.message);
        const coreItems = itemsToInsert.map((it: any) => ({
          order_id: it.order_id,
          product_id: it.product_id,
          name: it.name,
          variant_name: it.variant_name || null,
          notes: it.notes || null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        }));
        await supabase.from("sales_order_items").insert(coreItems as any);
      }
    }

    // Automated Recipe / BOM Inventory Depletion WITH UNIT CONVERSION
    const deductedInventory: Record<string, number> = {};
    const deductedProducts: Record<string, number> = {};

    if (!isQueuedOffline && order && order.id) {
      try {
        let outletRecsQuery = supabase.from("outlets").select("settings");

        if (chosenOutletId) {
          outletRecsQuery = outletRecsQuery.eq("id", chosenOutletId);
        } else {
          outletRecsQuery = outletRecsQuery.eq("business_id", snapshot.businessId);
        }

        const { data: outletRecs } = await outletRecsQuery.limit(1);
        const cachedRecipes = (outletRecs?.[0]?.settings as any)?.menu_recipes || {};

        for (const cartItem of cart) {
          const recipe = await resolveMenuRecipe(
            cartItem,
            snapshot.businessId,
            chosenOutletId,
            cachedRecipes,
          );
          if (recipe && Array.isArray(recipe.items)) {
            for (const ing of recipe.items) {
              if (ing.inventory_item_id || (ing as any).ingredient_name) {
                const depletion = await depleteIngredientStock({
                  ingredient: ing,
                  cartItemQuantity: cartItem.quantity,
                  cartItemName: cartItem.name,
                  chosenOutletId,
                  businessId: snapshot.businessId || "",
                  orderId: order?.id || null,
                  orderNumber,
                  prefixNote: "POS",
                });
                if (depletion) {
                  deductedInventory[depletion.inventoryId] =
                    (deductedInventory[depletion.inventoryId] || 0) + depletion.deductedQuantity;
                }
              }
            }
          }
          // Also deplete add-ons / toppings (toppings, additional meat/cheese, etc.)
          const addOnList: Array<{ name: string; price?: number }> = [];
          if (Array.isArray(cartItem.selected_addons) && cartItem.selected_addons.length > 0) {
            for (const addon of cartItem.selected_addons) {
              if (addon && addon.name) addOnList.push(addon);
            }
          }
          if (Array.isArray(cartItem.selected_variant_groups)) {
            for (const vg of cartItem.selected_variant_groups) {
              const gName = (vg.group_name || "").toLowerCase();
              if (
                gName.includes("topping") ||
                gName.includes("addon") ||
                gName.includes("extra") ||
                gName.includes("tambahan")
              ) {
                if (Array.isArray(vg.options)) {
                  for (const opt of vg.options) {
                    if (opt && opt.name) addOnList.push(opt);
                  }
                }
              }
            }
          }

          for (const addon of addOnList) {
            const rawName = addon.name.trim();
            const lower = rawName.toLowerCase();
            let estimatedQty = 1;
            let estimatedUnit = "pcs";
            if (
              lower.includes("daging") ||
              lower.includes("beef") ||
              lower.includes("ayam") ||
              lower.includes("chicken")
            ) {
              estimatedQty = 20;
              estimatedUnit = "gram";
            } else if (lower.includes("keju") || lower.includes("cheese")) {
              estimatedQty = 15;
              estimatedUnit = "gram";
            } else if (lower.includes("telur") || lower.includes("egg")) {
              estimatedQty = 1;
              estimatedUnit = "pcs";
            } else if (lower.includes("tortilla") || lower.includes("kulit")) {
              estimatedQty = 1;
              estimatedUnit = "pcs";
            } else if (lower.includes("saus") || lower.includes("sauce") || lower.includes("mayo")) {
              estimatedQty = 15;
              estimatedUnit = "ml";
            }

            const cleanName = rawName.replace(/^(extra|tambah|tambahan|\+)\s+/i, "").trim();

            const addonDepletion = await depleteIngredientStock({
              ingredient: {
                ingredient_name: cleanName || rawName,
                quantity: estimatedQty,
                unit: estimatedUnit,
              },
              cartItemQuantity: cartItem.quantity,
              cartItemName: `${cartItem.name} (+${rawName})`,
              chosenOutletId,
              businessId: snapshot.businessId || "",
              orderId: order?.id || null,
              orderNumber,
              prefixNote: "POS Addon",
            });
            if (addonDepletion) {
              deductedInventory[addonDepletion.inventoryId] =
                (deductedInventory[addonDepletion.inventoryId] || 0) + addonDepletion.deductedQuantity;
            }
          }
        }
      } catch (bomErr) {
        console.warn("[BOM] Depletion warning:", bomErr);
      }

      // Deduct stock directly from products table so depleted items immediately disappear or show stock 0
      try {
        for (const cartItem of cart) {
          if (cartItem.id && !cartItem.id.startsWith("demo-")) {
            const currentProd = snapshot.products.find((p) => p.id === cartItem.id);
            if (currentProd) {
              const newProdStock = Math.max(0, (Number(currentProd.stock) || 0) - cartItem.quantity);
              await supabase
                .from("products")
                .update({ stock: newProdStock, updated_at: new Date().toISOString() })
                .eq("id", cartItem.id);

              deductedProducts[cartItem.id] =
                (deductedProducts[cartItem.id] || 0) + cartItem.quantity;
            }
          }
        }
      } catch (prodStockErr) {
        console.warn("[POS] Product stock reduction warning:", prodStockErr);
      }
    }

    // Immediately update local snapshot inventory & products in place
    if (Object.keys(deductedInventory).length > 0) {
      for (const inv of snapshot.inventory) {
        const dec = deductedInventory[inv.id];
        if (dec) {
          inv.stock = Math.max(0, (Number(inv.stock) || 0) - dec);
        }
      }
    }
    if (Object.keys(deductedProducts).length > 0) {
      for (const prod of snapshot.products) {
        const decProd = deductedProducts[prod.id];
        if (decProd) {
          prod.stock = Math.max(0, (Number(prod.stock) || 0) - decProd);
        }
      }
    }

    // Sync active shift cash sales if payment was made in cash
    if (paymentMethod === "cash") {
      try {
        const outletShiftKey = chosenOutletId ? `kebabschoicepos_active_shift_${chosenOutletId}` : null;
        const savedShift = (outletShiftKey && localStorage.getItem(outletShiftKey)) || localStorage.getItem("kebabschoicepos_active_shift");
        if (savedShift) {
          const shiftObj = JSON.parse(savedShift);
          const newCashSales = (Number(shiftObj.cashSales) || 0) + total;
          const newExpected =
            (Number(shiftObj.startingCash) || 0) +
            newCashSales +
            (Number(shiftObj.totalCashIn) || 0) -
            (Number(shiftObj.totalCashOut) || 0);
          shiftObj.cashSales = newCashSales;
          shiftObj.expectedEndingCash = newExpected;
          localStorage.setItem("kebabschoicepos_active_shift", JSON.stringify(shiftObj));
          if (chosenOutletId) {
            localStorage.setItem(`kebabschoicepos_active_shift_${chosenOutletId}`, JSON.stringify(shiftObj));
          }

          if (!isQueuedOffline && shiftObj.id && !shiftObj.id.startsWith("shift-")) {
            await supabase
              .from("pos_shifts" as any)
              .update({
                cash_sales: newCashSales,
                expected_ending_cash: newExpected,
                updated_at: new Date().toISOString(),
              })
              .eq("id", shiftObj.id);
          }
        }
      } catch (shiftErr) {
        console.warn("[POS] Shift cash sales sync warning:", shiftErr);
      }
    }

    const chosenOutlet = (snapshot.outlets || []).find((o) => o.id === chosenOutletId);
    const cashReceived = paymentMethod === "cash" ? (cashTendered && cashTendered > 0 ? cashTendered : total) : total;
    const changeAmount = paymentMethod === "cash" ? Math.max(0, cashReceived - total) : 0;

    const receiptData: ReceiptData = {
      orderNumber,
      outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
      cashierName: activeCashierName || profile?.displayName || "Kasir",
      paymentMethod: paymentMethod.toUpperCase(),
      customerName: effectiveCustomerName,
      customerQueueName: customerQueueName || undefined,
      ojolOrderCode: ojolOrderCode || undefined,
      createdAt: new Date().toISOString(),
      subtotal,
      discountAmount,
      serviceChargeAmount,
      taxAmount,
      orderType,
      tableNumber: orderType === "dine_in" && tableNumber ? tableNumber : undefined,
      items: cart.map((c) => ({
        name: c.variant_name ? `${c.name} (${c.variant_name})` : c.name,
        quantity: c.quantity,
        price: c.unit_price || c.price,
        subtotal: (c.unit_price || c.price) * c.quantity,
      })),
      total,
      cashReceived,
      changeAmount,
    };
    try {
      localStorage.setItem("kebabschoicepos_last_receipt", JSON.stringify(receiptData));
    } catch {}
    setCompletedReceipt(receiptData);
    setLastReceiptNotice(receiptData);

    // Construct local SalesOrder object and guarantee immediate appearance in Riwayat Order Hari Ini
    const localOrderId = order?.id || idempotencyKey || `ord-${Date.now()}`;
    const newSalesOrder: SalesOrder = {
      id: localOrderId,
      order_number: orderNumber,
      total,
      payment_method: paymentMethod as any,
      status: "paid",
      channel: isOjolChannel ? orderType : "store",
      created_at: receiptData.createdAt,
      customer_id: effectiveCustomerId,
      outlet_id: chosenOutletId,
      cashReceived,
      changeAmount,
    };

    if (snapshot.orders) {
      snapshot.orders = [
        newSalesOrder,
        ...snapshot.orders.filter((o) => o.order_number !== orderNumber),
      ];
    }

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_recent_orders");
        const existing: SalesOrder[] = raw ? JSON.parse(raw) : [];
        const updated = [newSalesOrder, ...existing.filter((o) => o.order_number !== orderNumber)].slice(0, 100);
        localStorage.setItem("kebabschoicepos_recent_orders", JSON.stringify(updated));
      } catch (e) {
        console.warn("[POS] LocalStorage recent_orders warning:", e);
      }
      window.dispatchEvent(new CustomEvent("order:created", { detail: newSalesOrder }));
    }

    // Otomatis kick cash drawer jika pembayaran tunai (ESC p 0)
    if (paymentMethod.toLowerCase() === "cash") {
      kickCashDrawer().catch(() => {});
    }

    // Auto print receipt if configured
    const savedPrinter = getSavedPrinterConfig();
    if (savedPrinter.autoPrint !== false) {
      printReceipt({
        storeName: savedPrinter.storeName || snapshot.businessName || "KEBAB'S CHOICE",
        outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
        branchAddress: savedPrinter.branchAddress,
        orderNumber,
        orderType,
        tableNumber: orderType === "dine_in" && tableNumber ? tableNumber : undefined,
        cashierName: activeCashierName || profile?.displayName || "Kasir",
        paymentMethod: paymentMethod.toUpperCase(),
        customerName: effectiveCustomerName,
        createdAt: receiptData.createdAt,
        date: new Date(receiptData.createdAt).toLocaleString("id-ID"),
        items: receiptData.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          qty: it.quantity,
          price: it.price,
          subtotal: it.subtotal,
        })),
        subtotal,
        discount: discountAmount,
        serviceCharge: serviceChargeAmount,
        tax: taxAmount,
        total,
        cashTendered: cashReceived,
        change: changeAmount,
        footerMessage: savedPrinter.footerMessage || "Terima kasih atas kunjungan Anda!",
      }).catch(() => {});
    }

    setCart([]);
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setSelectedCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setCustomerMode("public");
    setCashTendered(0);
    setDiscountValue(0);

    if (paymentMethod === "cash") {
      toast.success(`Pembayaran Tunai Berhasil (${formatRupiah(total)})`, {
        description: `Diterima: ${formatRupiah(cashReceived)} • Kembalian: ${formatRupiah(changeAmount)}`,
      });
    } else {
      toast.success("Pembayaran berhasil", {
        description:
          "Receipt digital siap dicetak & stok bahan otomatis terpotong dengan konversi satuan presisi.",
      });
    }

    if (!isQueuedOffline && isOnline()) {
      await onRefresh();
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-6 xl:grid-cols-[1fr_25rem]">
      <section className="space-y-5">
        {/* 1 Bar Status Tipis (1 Baris Kompak) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border bg-card/85 px-4 py-2.5 shadow-xs backdrop-blur-xl">
          {/* Status Kiri: Online, Cabang, Kasir & Shift */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Status Online/Offline */}
            {networkStatus.isSyncing ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                <RefreshCw className="size-3 animate-spin" />
                Menyinkronkan...
              </span>
            ) : networkStatus.pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <WifiOff className="size-3" />
                Mode Offline — {networkStatus.pendingCount} Transaksi
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await syncPendingTransactions();
                    } catch {}
                  }}
                  className="ml-1 underline text-[10px] hover:text-amber-700 cursor-pointer"
                >
                  Sinkronkan Sekarang
                </button>
              </span>
            ) : (typeof navigator !== "undefined" && navigator.onLine === false) ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <WifiOff className="size-3" />
                Mode Offline (Tidak Ada Internet)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                🟢 Online & Sinkron
              </span>
            )}

            <span className="text-muted-foreground/30">•</span>

            {/* Cabang Aktif */}
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Store className="size-3.5 text-primary shrink-0" />
              {isOwner ? (
                <span className="font-black text-xs text-foreground">
                  📍 {activeOutlets.find((o) => o.id === selectedOutletId)?.name || activeOutlets[0]?.name || "Cabang Utama"}
                </span>
              ) : (
                <span className="truncate max-w-[220px] font-black flex items-center gap-1" title="Cabang terkunci sesuai akun terminal kasir">
                  📍 Cabang Aktif: {activeOutlets.find((o) => o.id === selectedOutletId)?.name ||
                    activeOutlets[0]?.name ||
                    "Cabang Utama"}
                  <span className="text-[10px] text-muted-foreground font-normal">(Terkunci)</span>
                </span>
              )}
            </div>

            <span className="text-muted-foreground/30">•</span>

            {/* Kasir & Shift Aktif */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground truncate max-w-[130px]">
                👤 {activeShift?.cashierName || activeCashierName || profile?.displayName || "Kasir"}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  activeShift?.status === "open"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                )}
              >
                {activeShift?.status === "open" ? "🟢 Shift Buka" : "🔴 Shift Tutup"}
              </span>
            </div>
          </div>

          {/* Status Kanan: Printer Status (Ikon Kompak) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPrinterMenu(!showPrinterMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border border-border bg-background/80 hover:bg-secondary transition-colors cursor-pointer"
              title="Status Printer Thermal & Laci Kas"
            >
              <Printer
                className={cn(
                  "size-3.5",
                  printerInfo.status === "connected" ? "text-emerald-500" : "text-primary",
                )}
              />
              <span className="hidden sm:inline text-[11px] font-bold">
                {printerInfo.status === "connected" ? "Printer & Laci Siap" : "Printer & Laci"}
              </span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            {showPrinterMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-float z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-border/60 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <Printer className="size-3.5 text-primary" />
                    Status Hardware POS
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPrinterMenu(false)}
                    className="text-muted-foreground hover:text-foreground text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thermal Printer</span>
                    <span className={cn("font-bold", printerInfo.status === "connected" ? "text-emerald-600" : "text-amber-600")}>
                      {printerInfo.status === "connected" ? `${printerInfo.paperSize} Siap` : "Dialog Browser"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Laci Kas RJ11</span>
                    <span className="font-bold text-emerald-600">Siap</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await testThermalPrint();
                    }}
                    className="h-7 text-xs rounded-xl"
                  >
                    Tes Print
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await kickCashDrawer();
                      toast.success("Sinyal pulsa laci kas terkirim!");
                    }}
                    className="h-7 text-xs rounded-xl"
                  >
                    Buka Laci
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Grid */}
        {displayedProducts.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border bg-card/50 p-10 text-center">
            <Store className="mx-auto size-10 text-muted-foreground opacity-50 mb-3" />
            <h3 className="font-bold text-base">
              {t("cart.no_menu_in_outlet", "Tidak ada menu tersedia di outlet ini")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Menu mungkin belum diaktifkan untuk outlet ini. Anda dapat mengaktifkannya di Menu
              Management tab Cabang Outlet, atau ganti pilihan cabang di tombol cabang atas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayedProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleFastAddToCart(product)}
                className="group cursor-pointer rounded-[1.5rem] border border-border bg-card/82 p-4 shadow-soft backdrop-blur-2xl hover:border-primary/50 transition-all"
              >
                <div className="relative mb-4 flex aspect-[4/3] items-end overflow-hidden rounded-[1.25rem] bg-primary p-4 text-primary-foreground">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        transform: `translate(${(product.image_position_x ?? product.image_crop_position?.x ?? 50) - 50}%, ${(product.image_position_y ?? product.image_crop_position?.y ?? 50) - 50}%) scale(${product.image_zoom || product.zoom || 1}) rotate(${product.image_rotation || product.rotation || 0}deg)`,
                        transformOrigin: "center center",
                      }}
                      className="absolute inset-0 h-full w-full object-contain pointer-events-none transition-transform"
                    />
                  ) : null}
                  {product.promo_price && product.promo_price < product.price && (
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                        PROMO
                      </span>
                    </div>
                  )}
                  <div className="relative z-10 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md">
                    <p className="text-[10px] font-bold opacity-90 text-white/80">
                      {product.category}
                    </p>
                    <p className="text-base font-black tracking-normal leading-tight text-white">
                      {product.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {product.promo_price && product.promo_price < product.price ? (
                      <div className="flex items-baseline gap-1.5">
                        <p className="font-black text-rose-600 dark:text-rose-400">
                          {formatRupiah(product.promo_price)}
                        </p>
                        <p className="text-xs text-muted-foreground line-through">
                          {formatRupiah(product.price)}
                        </p>
                      </div>
                    ) : (
                      <p className="font-black text-primary">{formatRupiah(product.price)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Stok {product.stock}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {((product.variant_groups && product.variant_groups.length > 0) ||
                      (product.modifiers && product.modifiers.length > 0)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl px-2 h-8 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustomize(product);
                        }}
                        title="Atur Varian, Level Pedas, dan Topping"
                      >
                        Varian
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="rounded-xl gap-1 font-bold text-xs shadow-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFastAddToCart(product);
                      }}
                      aria-label={`Tambah ${product.name}`}
                    >
                      <Plus className="size-3.5" />
                      +1
                    </Button>
                  </div>
                </div>
                {product.ai_badge && (
                  <p className="mt-3 rounded-full bg-ai-soft px-3 py-1 text-xs font-bold text-ai">
                    AI: {product.ai_badge}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Smart Cart Aside */}
      <aside className="sticky top-24 h-fit rounded-[2rem] border border-border bg-card/90 p-5 shadow-float backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-normal">{t("cart.title", "Smart Cart")}</h2>
            <p className="text-sm text-muted-foreground">
              {cart.length} {t("cart.items_customized", "item dikustomisasi")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {heldOrders.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setHeldOrdersModalOpen(true)}
                className="h-8 rounded-xl px-2.5 text-xs font-black gap-1.5 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 shadow-xs animate-pulse cursor-pointer"
                title="Lihat antrean tersimpan"
              >
                <Clock className="size-3.5" />
                Antrean ({heldOrders.length})
              </Button>
            )}
            <ReceiptText className="size-5 text-primary" />
          </div>
        </div>

        {/* Pemberitahuan Struk Terakhir Banner */}
        {lastReceiptNotice && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs animate-in slide-in-from-top-2 duration-300 shadow-sm">
            <div className="flex items-center justify-between font-black text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Receipt className="size-4" />
                Struk Terakhir #{lastReceiptNotice.orderNumber}
              </span>
              <button
                type="button"
                onClick={() => setLastReceiptNotice(null)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded-lg cursor-pointer"
                title="Tutup pemberitahuan"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-2 space-y-1 font-mono text-[11px] border-t border-emerald-500/20 pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tagihan:</span>
                <span className="font-bold text-foreground">{formatRupiah(lastReceiptNotice.total)}</span>
              </div>
              {lastReceiptNotice.paymentMethod.toUpperCase() === "CASH" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tunai Diterima:</span>
                    <span className="font-bold text-foreground">
                      {formatRupiah(lastReceiptNotice.cashReceived ?? lastReceiptNotice.total)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Kembalian:</span>
                    <span className="font-black text-xs">
                      {formatRupiah(lastReceiptNotice.changeAmount ?? Math.max(0, (lastReceiptNotice.cashReceived ?? lastReceiptNotice.total) - lastReceiptNotice.total))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-[10px] font-bold rounded-xl gap-1 border-emerald-500/30 bg-background/80 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                onClick={() => setCompletedReceipt(lastReceiptNotice)}
              >
                <Printer className="size-3" />
                Cetak / Buka Struk
              </Button>
            </div>
          </div>
        )}

        {/* Customer / CRM Member Selector (Umum / Member CRM / Pelanggan Baru) */}
        <div className="mb-4 rounded-2xl border border-border bg-background/80 p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserRound className="size-3.5 text-primary" />
              {t("cart.crm_member", "Data Pelanggan")}
            </span>
            {(selectedCustomerId || newCustomerName) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId("");
                  setNewCustomerName("");
                  setNewCustomerPhone("");
                  setCustomerMode("public");
                }}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                {t("cart.reset", "Reset")}
              </button>
            )}
          </div>

          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/70 p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setCustomerMode("public")}
              className={cn(
                "rounded-lg py-1.5 transition-all text-center",
                customerMode === "public"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              👤 Umum
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode("member")}
              className={cn(
                "rounded-lg py-1.5 transition-all text-center",
                customerMode === "member"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ⭐ Member
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode("new")}
              className={cn(
                "rounded-lg py-1.5 transition-all text-center",
                customerMode === "new"
                  ? "bg-background text-foreground shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ➕ Baru
            </button>
          </div>

          {/* Member CRM Dropdown with Points Display */}
          {customerMode === "member" && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">-- Pilih Pelanggan CRM Terdaftar --</option>
                {snapshot.customers.map((c) => {
                  const pts = c.points ?? Math.floor((c.total_spend || 0) / 10000);
                  return (
                    <option key={c.id} value={c.id}>
                      ⭐ {c.name} ({pts} Poin · {c.visits}x · {formatRupiah(c.total_spend)})
                    </option>
                  );
                })}
              </select>

              {selectedCustomerId &&
                (() => {
                  const cust = snapshot.customers.find((c) => c.id === selectedCustomerId);
                  if (!cust) return null;
                  const pts = cust.points ?? Math.floor((cust.total_spend || 0) / 10000);
                  return (
                    <div className="text-[11px] text-muted-foreground bg-primary/5 rounded-xl p-2.5 border border-primary/15 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">{cust.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                            ⭐ {pts} Poin
                          </span>
                          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-black">
                            {cust.visits} Order
                          </span>
                        </div>
                      </div>
                      {cust.phone && (
                        <p className="text-[10px] text-muted-foreground">
                          WA/HP: <span className="font-mono text-foreground">{cust.phone}</span>
                        </p>
                      )}
                      {cust.favorite_product && (
                        <p className="text-[10px] text-muted-foreground">
                          Favorit:{" "}
                          <span className="font-semibold text-foreground">
                            {cust.favorite_product}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })()}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomerMode("new")}
                className="w-full h-7 rounded-xl text-[10px] font-bold border-dashed border-primary/40 text-primary hover:bg-primary/10 gap-1"
              >
                <UserRound className="size-3" />
                + Daftar Member Cepat (10 Detik)
              </Button>
            </div>
          )}

          {/* New Customer Input */}
          {customerMode === "new" && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nama Lengkap Pelanggan Baru *"
                className="h-9 rounded-xl text-xs bg-card"
              />
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="No. WhatsApp / HP (Opsional)"
                className="h-9 rounded-xl text-xs bg-card"
              />
              <p className="text-[10px] text-muted-foreground">
                Pelanggan baru otomatis tersimpan ke CRM & database transaksi.
              </p>
            </div>
          )}
        </div>

        {/* Cart Item List */}
        <div className="max-h-80 space-y-3 overflow-auto pr-1">
          {cart.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-5 text-sm leading-6 text-muted-foreground text-center">
              {t(
                "cart.empty_cart",
                "Pilih produk di sebelah kiri untuk membuka opsi kustomisasi & memasukkan ke keranjang.",
              )}
            </div>
          ) : (
            cart.map((item) => {
              const itemKey = item.cart_item_id || item.id;
              return (
                <div
                  key={itemKey}
                  className="rounded-2xl border border-border/70 bg-secondary/60 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold truncate">{item.name}</p>
                        {(item.variant_name || item.selected_variant?.name) && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                            {item.variant_name || item.selected_variant?.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-primary mt-0.5">
                        {formatRupiah(item.unit_price || item.price)}
                        <span className="text-[11px] font-normal text-muted-foreground ml-1">
                          x {item.quantity}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => changeQuantity(itemKey, -1)}
                        aria-label="Kurangi"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-5 text-center text-xs font-black">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => changeQuantity(itemKey, 1)}
                        aria-label="Tambah"
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive p-0 ml-1"
                        onClick={() => removeCartItem(itemKey)}
                        aria-label="Hapus"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Options breakdown */}
                  {((item.selected_variant_groups && item.selected_variant_groups.length > 0) ||
                    (item.selected_modifiers && item.selected_modifiers.length > 0) ||
                    (item.selected_addons && item.selected_addons.length > 0) ||
                    item.notes) && (
                    <div className="rounded-xl bg-background/80 p-2 text-[11px] space-y-1 border border-border/40">
                      {item.selected_variant_groups && item.selected_variant_groups.length > 0 ? (
                        <div className="space-y-0.5">
                          {item.selected_variant_groups.map((vg, vgi) => (
                            <p key={vgi} className="text-muted-foreground flex items-center gap-1">
                              <span className="font-semibold text-foreground">
                                {vg.group_name}:
                              </span>{" "}
                              {vg.options
                                .map(
                                  (o) =>
                                    `${o.name}${o.price > 0 ? ` (+${formatRupiah(o.price)})` : ""}`,
                                )
                                .join(", ")}
                            </p>
                          ))}
                        </div>
                      ) : (
                        item.selected_modifiers &&
                        item.selected_modifiers.length > 0 && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Flame className="size-3 text-amber-500 shrink-0" />
                            <span className="font-semibold text-foreground">Opsi:</span>{" "}
                            {item.selected_modifiers.join(", ")}
                          </p>
                        )
                      )}
                      {item.selected_addons && item.selected_addons.length > 0 && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Plus className="size-3 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-foreground">Topping:</span>{" "}
                          {item.selected_addons
                            .map((a) => `${a.name} (+${formatRupiah(a.price)})`)
                            .join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-amber-600 dark:text-amber-400 font-medium italic">
                          📝 "{item.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border/40">
                    <span className="text-muted-foreground text-[10px]">
                      {t("cart.subtotal", "Subtotal")}:
                    </span>
                    <span className="font-black text-foreground">
                      {formatRupiah((item.unit_price || item.price) * item.quantity)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="my-5 h-px bg-border" />

        {/* Order Channels (1 Baris Kompak) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Channel Pesanan
            </p>
            {/* Toggle link kecil + Tambah Diskon / No. Meja */}
            <button
              type="button"
              onClick={() => setShowExtraDetails(!showExtraDetails)}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showExtraDetails || discountValue > 0 || Boolean(tableNumber) ? (
                <span>Tutup Opsi Meja/Diskon ▲</span>
              ) : (
                <>
                  <Plus className="size-3" />
                  <span>Diskon / No. Meja</span>
                </>
              )}
            </button>
          </div>

          {/* 6 Channel Pesanan dalam 1 Baris Horizontal Kompak */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "dine_in", label: "Dine In" },
              { id: "take_away", label: "Take Away" },
              { id: "delivery", label: "Delivery" },
              { id: "gofood", label: "GoFood", activeClass: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" },
              { id: "grabfood", label: "GrabFood", activeClass: "bg-green-600 hover:bg-green-700 text-white border-green-600" },
              { id: "shopeefood", label: "ShopeeFood", activeClass: "bg-orange-600 hover:bg-orange-700 text-white border-orange-600" },
            ].map((tItem) => (
              <button
                key={tItem.id}
                type="button"
                onClick={() => {
                  const newType = tItem.id as PosOrderType;
                  setOrderType(newType);
                  if (["gofood", "grabfood", "shopeefood"].includes(newType)) {
                    if (paymentMethod === "cash") setPaymentMethod("ewallet");
                  }
                }}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                  orderType === tItem.id
                    ? (tItem.activeClass || "bg-primary text-primary-foreground border-primary shadow-xs")
                    : "bg-background border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {tItem.label}
              </button>
            ))}
          </div>

          {/* Kolom Tersembunyi: Diskon, No. Meja, Kode Ojol (Hanya tampil jika diklik / aktif) */}
          {(showExtraDetails || discountValue > 0 || Boolean(tableNumber) || ["gofood", "grabfood", "shopeefood"].includes(orderType)) && (
            <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/30 p-2.5 animate-in fade-in">
              {/* Ojol Order Code Input */}
              {["gofood", "grabfood", "shopeefood"].includes(orderType) && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                  <span className="text-[10px] font-black uppercase text-primary shrink-0">
                    Kode Ojol:
                  </span>
                  <input
                    type="text"
                    placeholder={
                      orderType === "gofood"
                        ? "Cth: GF-412"
                        : orderType === "grabfood"
                          ? "Cth: GR-882"
                          : "Cth: SF-109"
                    }
                    value={ojolOrderCode}
                    onChange={(e) => setOjolOrderCode(e.target.value)}
                    className="flex-1 h-6 rounded-lg bg-transparent px-1 text-xs font-black uppercase focus:outline-none placeholder:normal-case placeholder:font-normal"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* No. Meja jika Dine In */}
                {orderType === "dine_in" && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                      No. Meja
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 04"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full h-7 rounded-lg border border-border bg-background px-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Nama Pemesan / Antrean */}
                <div className={orderType === "dine_in" ? "" : "col-span-2"}>
                  <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                    Nama / No. Antrean
                  </label>
                  <input
                    type="text"
                    placeholder="Nama / Antrean (opsional)"
                    value={customerQueueName}
                    onChange={(e) => setCustomerQueueName(e.target.value)}
                    className="w-full h-7 rounded-lg border border-border bg-background px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Diskon Kasir */}
              <div className="pt-1 border-t border-border/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Diskon Kasir</span>
                  <div className="flex items-center rounded-lg border border-border overflow-hidden p-0.5 bg-background">
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${discountType === "nominal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => setDiscountType("nominal")}
                    >
                      Rp
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${discountType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      onClick={() => setDiscountType("percent")}
                    >
                      %
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === "percent" ? "Diskon (%)" : "Diskon (Rp)"}
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    className="w-full h-7 rounded-lg border border-border bg-background px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {discountValue > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600"
                      onClick={() => setDiscountValue(0)}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="my-2 h-px bg-border/60" />

        {/* Payment Methods */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-muted-foreground">
            {t("cart.payment_method", "Metode Pembayaran")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["cash", "Cash", DollarSign, paymentSettings.cashEnabled],
              ["qris", "QRIS", QrCode, paymentSettings.qrisEnabled],
              ["ewallet", "E-wallet / Transfer", WalletCards, paymentSettings.transferEnabled],
              ["card", "Card / EDC", CreditCard, paymentSettings.cardEnabled],
            ]
              .filter((item) => item[3] !== false)
              .map(([key, label, Icon]: any) => (
                <Button
                  key={String(key)}
                  variant={paymentMethod === key ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setPaymentMethod(key as "cash" | "qris" | "ewallet" | "card")}
                >
                  <Icon className="size-4" />
                  {String(label)}
                </Button>
              ))}
          </div>

          {/* Quick Tender & Kembalian for Cash */}
          {paymentMethod === "cash" && (
            <div className="rounded-2xl bg-primary/5 border border-primary/15 p-3 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground">Uang Diterima:</span>
                <span className="text-primary font-black">
                  {formatRupiah(cashTendered || total)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Uang Pas", val: total },
                  { label: "20.000", val: 20000 },
                  { label: "50.000", val: 50000 },
                  { label: "100.000", val: 100000 },
                ].map((btn, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={cashTendered === btn.val ? "default" : "outline"}
                    className="h-8 rounded-xl text-[10px] font-bold p-1"
                    onClick={() => setCashTendered(btn.val)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {[
                  { label: "+10rb", add: 10000 },
                  { label: "+20rb", add: 20000 },
                  { label: "+50rb", add: 50000 },
                  { label: "+100rb", add: 100000 },
                ].map((inc, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-[9px] font-bold p-0.5 bg-background/50 hover:bg-primary/10 border-primary/20"
                    onClick={() => setCashTendered((prev) => Math.max(total, (prev || total) + inc.add))}
                  >
                    {inc.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg text-[9px] font-bold p-0.5 text-muted-foreground hover:text-rose-500"
                  onClick={() => setCashTendered(total)}
                >
                  Reset
                </Button>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-primary/10 text-xs">
                <span className="font-semibold text-muted-foreground">Kembalian:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatRupiah(Math.max(0, (cashTendered || total) - total))}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-secondary p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("cart.subtotal", "Subtotal")}</span>
            <span className="font-semibold text-foreground">{formatRupiah(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold">
              <span>Diskon {discountType === "percent" ? `(${discountValue}%)` : ""}:</span>
              <span>-{formatRupiah(discountAmount)}</span>
            </div>
          )}
          {serviceChargeAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Biaya Layanan ({taxSettings.serviceRate}%):</span>
              <span className="font-semibold text-foreground">+{formatRupiah(serviceChargeAmount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{taxSettings.taxName || "Pajak Restoran (PB1)"} ({taxSettings.taxRate}%):</span>
              <span className="font-semibold text-foreground">+{formatRupiah(taxAmount)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-border flex items-center justify-between text-lg font-black">
            <span>{t("cart.total_bill", "Total Tagihan")}</span>
            <span className="text-primary">{formatRupiah(total)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={cart.length === 0}
            onClick={handleHoldOrder}
            className="h-14 px-3.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-dashed border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 shrink-0 font-bold text-xs cursor-pointer shadow-xs"
            title="Simpan sementara antrean pesanan ini (Hold)"
          >
            <Clock className="size-4" />
            <span>Hold</span>
          </Button>

          <Button
            variant="hero"
            className="h-14 flex-1 rounded-2xl text-base shadow-brand"
            disabled={cart.length === 0}
            onClick={checkout}
          >
            {t("cart.checkout_pay", "Checkout & Bayar")} ({formatRupiah(total)})
            <Send className="size-4" />
          </Button>
        </div>
      </aside>

      {/* PRODUCT CUSTOMIZATION MODAL (STANDAR F&B POS) */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-[2rem] border border-border bg-card shadow-float overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="relative size-12 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">
                  {customizingProduct.image_url ? (
                    <img
                      src={customizingProduct.image_url}
                      alt={customizingProduct.name}
                      style={{
                        transform: `translate(${(customizingProduct.image_position_x ?? customizingProduct.image_crop_position?.x ?? 50) - 50}%, ${(customizingProduct.image_position_y ?? customizingProduct.image_crop_position?.y ?? 50) - 50}%) scale(${customizingProduct.image_zoom || customizingProduct.zoom || 1}) rotate(${customizingProduct.image_rotation || customizingProduct.rotation || 0}deg)`,
                        transformOrigin: "center center",
                      }}
                      className="h-full w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <UtensilsCrossed className="size-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {customizingProduct.category}
                    </span>
                    {customizingProduct.promo_price &&
                    customizingProduct.promo_price < customizingProduct.price ? (
                      <div className="flex items-baseline gap-1 text-xs font-bold">
                        <span className="text-rose-600 dark:text-rose-400">
                          Promo: {formatRupiah(customizingProduct.promo_price)}
                        </span>
                        <span className="text-muted-foreground line-through text-[10px]">
                          {formatRupiah(customizingProduct.price)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        Harga Dasar: {formatRupiah(customizingProduct.price)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black">{customizingProduct.name}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="rounded-full bg-secondary p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* 1. DYNAMIC VARIANT GROUPS */}
              {customizingProduct.variant_groups && customizingProduct.variant_groups.length > 0 ? (
                <div className="space-y-4">
                  {customizingProduct.variant_groups.map((group, gIdx) => {
                    const gKey = group.id || group.name || `group-${gIdx}`;
                    const currentSelections = selectedGroupOptions[gKey] || [];
                    const isSingle = group.selection_type === "single";

                    return (
                      <div
                        key={gKey}
                        className="space-y-2.5 rounded-2xl border border-border/70 bg-secondary/30 p-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                              {gIdx + 1}
                            </span>
                            <span className="text-xs font-black text-foreground">{group.name}</span>
                            {group.is_required !== false ? (
                              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                Pilihan wajib dipilih
                              </span>
                            ) : (
                              <span className="rounded-full bg-muted border border-border/40 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                                Opsional
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Cara Pilih: {isSingle ? "Pilih satu" : "Bisa pilih lebih dari satu"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {group.options.map((opt, oIdx) => {
                            const optPrice =
                              Number(opt.additional_price ?? opt.price_adjustment) || 0;
                            const isSelected = isSingle
                              ? currentSelections[0]?.name === opt.name
                              : currentSelections.some((s) => s.name === opt.name);

                            return (
                              <button
                                key={opt.id || `${gKey}-${oIdx}`}
                                type="button"
                                onClick={() => {
                                  if (isSingle) {
                                    setSelectedGroupOptions((prev) => ({
                                      ...prev,
                                      [gKey]: [opt],
                                    }));
                                  } else {
                                    setSelectedGroupOptions((prev) => {
                                      const current = prev[gKey] || [];
                                      const exists = current.some((s) => s.name === opt.name);
                                      return {
                                        ...prev,
                                        [gKey]: exists
                                          ? current.filter((s) => s.name !== opt.name)
                                          : [...current, opt],
                                      };
                                    });
                                  }
                                }}
                                className={cn(
                                  "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary text-primary font-bold"
                                    : "border-border bg-card hover:bg-secondary/60 text-foreground",
                                )}
                              >
                                <div className="min-w-0 flex-1 pr-1.5">
                                  <p className="text-xs font-bold truncate leading-tight">
                                    {opt.name}
                                  </p>
                                  <p className="text-[10px] opacity-80 mt-0.5 font-medium">
                                    {optPrice > 0 ? `+${formatRupiah(optPrice)}` : "+Rp 0"}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "flex size-4.5 shrink-0 items-center justify-center border transition-colors",
                                    isSingle ? "rounded-full" : "rounded-md",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/40 bg-background",
                                  )}
                                >
                                  {isSelected &&
                                    (isSingle ? (
                                      <span className="size-1.5 rounded-full bg-white" />
                                    ) : (
                                      <Check className="size-3 stroke-[3]" />
                                    ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Legacy fallback for items without variant_groups */
                <>
                  {customizingProduct.variants && customizingProduct.variants.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                          <SlidersHorizontal className="size-4" />
                          <span>1. Pilihan Ukuran / Varian</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Wajib pilih 1</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {customizingProduct.variants.map((variant) => {
                          const isSelected = selectedVariant?.name === variant.name;
                          return (
                            <button
                              key={variant.name}
                              type="button"
                              onClick={() => setSelectedVariant(variant)}
                              className={cn(
                                "flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary text-primary"
                                  : "border-border bg-background hover:bg-secondary/50 text-foreground",
                              )}
                            >
                              <span className="text-xs font-black">{variant.name}</span>
                              <span className="text-[10px] font-semibold opacity-80 mt-0.5">
                                {variant.price_adjustment > 0
                                  ? `+${formatRupiah(variant.price_adjustment)}`
                                  : "+Rp 0"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const levelMods = (customizingProduct.modifiers || []).filter(
                      (m) =>
                        m.category === "level" ||
                        (!m.category && m.name.toLowerCase().includes("pedas")),
                    );
                    if (levelMods.length === 0) return null;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                            <Flame className="size-4" />
                            <span>2. Level Pedas</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">Pilih 1 level</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {levelMods.map((mod) => {
                            const isSelected = selectedLevel?.name === mod.name;
                            return (
                              <button
                                key={mod.name}
                                type="button"
                                onClick={() => setSelectedLevel(mod)}
                                className={cn(
                                  "flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all",
                                  isSelected
                                    ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500 text-amber-600 dark:text-amber-400 font-black"
                                    : "border-border bg-background hover:bg-secondary/50 text-foreground",
                                )}
                              >
                                <span className="text-xs">{mod.name}</span>
                                <span className="text-[10px] font-medium opacity-80 mt-0.5">
                                  {mod.price_adjustment > 0
                                    ? `+${formatRupiah(mod.price_adjustment)}`
                                    : "+Rp 0"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const prepMods = (customizingProduct.modifiers || []).filter(
                      (m) =>
                        m.category === "prep" ||
                        (!m.category && !m.name.toLowerCase().includes("pedas")),
                    );
                    if (prepMods.length === 0) return null;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-muted-foreground">
                            Instruksi Dapur (Bisa pilih lebih dari satu)
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {prepMods.map((mod) => {
                            const isSelected = selectedPreps.includes(mod.name);
                            return (
                              <button
                                key={mod.name}
                                type="button"
                                onClick={() => {
                                  setSelectedPreps((prev) =>
                                    isSelected
                                      ? prev.filter((p) => p !== mod.name)
                                      : [...prev, mod.name],
                                  );
                                }}
                                className={cn(
                                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-background hover:bg-secondary/50 text-foreground",
                                )}
                              >
                                {isSelected && <Check className="inline-block size-3 mr-1" />}
                                {mod.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ORDER NOTES (Free Text) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">
                  Catatan Pesanan Khusus
                </label>
                <textarea
                  rows={2}
                  placeholder="cth: Bungkus dipisah, sambal jangan terlalu berminyak, dsb."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background p-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="border-t border-border p-4 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Quantity Stepper */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">Kuantitas:</span>
                <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-xl"
                    disabled={customizeQuantity <= 1}
                    onClick={() => setCustomizeQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-black">{customizeQuantity}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-xl"
                    onClick={() => setCustomizeQuantity((q) => q + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Confirm Button with Dynamic Real-Time Price */}
              <Button
                type="button"
                variant="hero"
                className="w-full sm:w-auto h-12 px-6 rounded-2xl font-bold shadow-brand gap-2"
                onClick={handleConfirmAddToCart}
              >
                <span>Tambah ke Keranjang</span>
                <span>•</span>
                <span>{formatRupiah(calculatedItemTotal)}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC QRIS REALTIME PAYMENT MODAL (TAHAP 4) */}
      {isQrisModalOpen && qrisModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="relative flex max-h-[95vh] w-full max-w-md flex-col rounded-[2.5rem] border border-border bg-card shadow-float overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-red-600 px-2 py-0.5 text-white font-black text-xs tracking-wider">
                  QRIS
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Dinamis • ASPI / BI
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 transition-colors",
                  qrisStatus === "PAID"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                )}
              >
                {qrisStatus === "PAID" ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Menunggu Pembayaran
                  </span>
                )}
              </Badge>
            </div>

            {qrisStatus === "PAID" ? (
              /* Success / LUNAS State */
              <div className="p-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-500/15 border-2 border-emerald-500 text-emerald-500 shadow-xl shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="size-12" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    PEMBAYARAN QRIS LUNAS
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verifikasi pembayaran realtime webhook berhasil.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs space-y-2 text-left font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tagihan:</span>
                    <span className="font-bold text-foreground">
                      {formatRupiah(qrisPendingOrder?.total || total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. Order:</span>
                    <span className="font-bold text-foreground">#{qrisModalData.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ref Settlement:</span>
                    <span className="font-bold text-emerald-600 truncate max-w-[170px]">
                      {qrisSettlementRef || qrisModalData.external_reference_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Lunas:</span>
                    <span className="font-bold text-foreground">{new Date().toLocaleTimeString("id-ID")}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
                  <Printer className="size-3.5" />
                  Struk otomatis dicetak ke printer kasir & laci kas terbuka.
                </div>
                <Button
                  variant="hero"
                  className="w-full h-12 rounded-2xl font-bold shadow-brand"
                  onClick={() => {
                    setIsQrisModalOpen(false);
                    setQrisStatus("PENDING");
                    setQrisModalData(null);
                    setQrisPendingOrder(null);
                  }}
                >
                  Selesai / Transaksi Baru
                </Button>
              </div>
            ) : (
              /* PENDING / Scanning State */
              <div className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Total Pembayaran
                  </p>
                  <p className="text-3xl font-black text-primary">
                    {formatRupiah(qrisPendingOrder?.total || total)}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Order #{qrisModalData.order_number} • Ref: {qrisModalData.external_reference_id}
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="relative mx-auto size-60 overflow-hidden rounded-2xl border-2 border-primary/20 bg-white p-3 shadow-inner flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      qrisModalData.qris_payload,
                    )}`}
                    alt="QRIS Dinamis"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 shadow-sm">
                      <span className="text-[10px] font-black text-red-600 tracking-tighter">QRIS</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/40 p-3 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center justify-center gap-1.5">
                    <RadioTower className="size-3.5 text-primary animate-pulse" />
                    Menunggu Pelanggan Memindai QRIS
                  </p>
                  <p className="text-[11px]">
                    Dapat dipindai via GoPay, OVO, ShopeePay, Dana, BCA, Mandiri, & Semua m-Banking.
                  </p>
                </div>

                {/* Fallback & Simulation Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl text-xs font-semibold gap-1.5"
                    disabled={isCheckingQris}
                    onClick={handleCheckQrisStatus}
                  >
                    <RefreshCw className={cn("size-3.5", isCheckingQris && "animate-spin")} />
                    Cek Status Pembayaran
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl text-xs font-semibold border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 gap-1.5"
                    onClick={handleSimulateQrisPayment}
                  >
                    <Zap className="size-3.5 text-amber-500" />
                    Simulasi Bayar (Test)
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setIsQrisModalOpen(false);
                    setQrisModalData(null);
                    setQrisPendingOrder(null);
                  }}
                >
                  Batal / Ganti Metode Pembayaran
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HELD ORDERS (ANTREAN TERSIMPAN) MODAL */}
      {heldOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-[2rem] border border-border bg-card p-6 shadow-float overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Antrean Pesanan Ditahan</h3>
                  <p className="text-xs text-muted-foreground">
                    {heldOrders.length} antrean tersimpan di memori kasir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHeldOrdersModalOpen(false)}
                className="rounded-full bg-secondary p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="my-3 flex-1 overflow-y-auto space-y-3 pr-1">
              {heldOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  Tidak ada antrean pesanan yang sedang ditahan.
                </div>
              ) : (
                heldOrders.map((held, idx) => {
                  const heldTotal = held.items.reduce(
                    (s, it) => s + (it.unit_price || it.price) * it.quantity,
                    0,
                  );
                  return (
                    <div
                      key={held.id}
                      className="rounded-2xl border border-border/80 bg-background/80 p-3.5 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-foreground">
                              {held.customerQueueName || `Antrean #${idx + 1}`}
                            </span>
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                              {held.orderType.replace("_", " ")}
                            </span>
                            {held.ojolOrderCode && (
                              <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-black text-orange-600">
                                {held.ojolOrderCode}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(held.createdAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} • {held.items.length} item ({formatRupiah(heldTotal)})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHeldOrder(held.id)}
                          className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
                          title="Hapus antrean"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-xl">
                        {held.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        className="w-full h-8 rounded-xl text-xs font-bold gap-1 shadow-xs cursor-pointer"
                        onClick={() => handleRestoreHeldOrder(held)}
                      >
                        <ArrowUpRight className="size-3.5" />
                        Pulihkan ke Keranjang Aktif
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl text-xs cursor-pointer"
              onClick={() => setHeldOrdersModalOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      )}

      {/* POS RECEIPT MODAL */}
      <ReceiptModal
        data={completedReceipt}
        businessName={snapshot.businessName}
        onClose={() => setCompletedReceipt(null)}
      />
    </div>
  );
}

function InventoryPage({ snapshot }: { snapshot: Snapshot }) {
  const items = snapshot.inventory;
  return (
    <div className="space-y-6 w-full max-w-none">
      <PageTitle
        title="Smart Inventory"
        subtitle="Prediksi stok, health score, dan alert otomatis untuk operasional harian."
      />
      {items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
          <PackageSearch className="size-12 mx-auto mb-3 opacity-30 text-primary" />
          <p className="font-bold text-base text-foreground">Belum Ada Data Inventori</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Semua bahan baku inventori kosong atau belum ditambahkan. Tambahkan master bahan baku baru melalui modul Inventory HQ.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[1.5rem] border border-border bg-card/84 p-5 shadow-soft backdrop-blur-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground">{item.category}</p>
                  <h3 className="mt-1 text-xl font-black tracking-normal">{item.name}</h3>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-black",
                    item.health_score < 55
                      ? "bg-warning-soft text-warning-foreground"
                      : "bg-success-soft text-success-foreground",
                  )}
                >
                  {item.health_score}%
                </span>
              </div>
              <Progress value={item.health_score} className="h-3" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-secondary p-3">
                  <p className="text-muted-foreground">Stok</p>
                  <p className="text-lg font-black">
                    {item.stock} {item.unit}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary p-3">
                  <p className="text-muted-foreground">Minimum</p>
                  <p className="text-lg font-black">
                    {item.minimum_stock} {item.unit}
                  </p>
                </div>
              </div>
              <p className="mt-4 rounded-2xl bg-ai-soft px-4 py-3 text-sm leading-6 text-ai">
                {item.ai_alert}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomersPage({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useTranslation();
  const customers = snapshot.customers;
  return (
    <div className="space-y-6 w-full max-w-none">
      <PageTitle
        title={t("crm.title", "Customer CRM")}
        subtitle={t(
          "crm.subtitle",
          "Profil pelanggan, riwayat belanja, favorit, dan insight AI dalam satu pandangan.",
        )}
      />
      {customers.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/60 p-12 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <UsersRound className="size-7" />
          </div>
          <h3 className="text-lg font-black tracking-normal">
            {t("crm.no_customers", "Belum Ada Pelanggan CRM Terdaftar")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "crm.no_customers_desc",
              "Pelanggan akan otomatis tercatat dan diperbarui (frekuensi kunjungan, akumulasi transaksi, dan menu favorit) saat kasir memilih member di POS.",
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="rounded-[1.5rem] border border-border bg-card/84 p-5 shadow-soft backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                    <UsersRound className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-normal">{customer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("crm.favorite", "Favorit")}:{" "}
                      {customer.favorite_product || "Belum ada data"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">{t("crm.visits", "Kunjungan")}</p>
                  <p className="text-xl font-black">{customer.visits}</p>
                </div>
                <div className="rounded-2xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("crm.total_spend", "Total belanja")}
                  </p>
                  <p className="text-xl font-black">{formatRupiah(customer.total_spend)}</p>
                </div>
              </div>
              {customer.ai_insight && (
                <p className="mt-4 rounded-2xl bg-ai-soft px-4 py-3 text-sm leading-6 text-ai">
                  {customer.ai_insight}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsPage({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useTranslation();
  const metrics = calculateSnapshotMetrics(snapshot);

  const dynamicRevenueTrend = useMemo(() => {
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const now = new Date();
    const trendSlots = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dayLabel = days[d.getDay()];
      const dateStr = d.toISOString().split("T")[0];
      return { day: dayLabel, dateStr, revenue: 0 };
    });

    snapshot.orders.forEach((ord) => {
      if (!ord.created_at) return;
      const dStr = ord.created_at.split("T")[0];
      const slot = trendSlots.find((s) => s.dateStr === dStr);
      if (slot) {
        slot.revenue += Number(ord.total) || 0;
      }
    });

    const totalTrendRev = trendSlots.reduce((s, t) => s + t.revenue, 0);
    if (totalTrendRev === 0 && metrics.todayRevenue > 0) {
      const lastSlot = trendSlots[trendSlots.length - 1];
      if (lastSlot) lastSlot.revenue = metrics.todayRevenue;
    }

    return trendSlots.map(({ day, revenue }) => ({ day, revenue }));
  }, [snapshot.orders, metrics.todayRevenue]);

  const dynamicProductPerformance = useMemo(() => {
    if (snapshot.products.length === 0) return [];
    return snapshot.products.slice(0, 6).map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name,
      value: p.stock > 0 ? p.stock : 10,
    }));
  }, [snapshot.products]);

  const handleExportAnalyticsCSV = () => {
    if (dynamicRevenueTrend.length === 0 && snapshot.products.length === 0) {
      toast.error("Tidak ada data analitik untuk diekspor");
      return;
    }
    const headers = ["Hari", "Omzet (Rp)"];
    const rows = dynamicRevenueTrend.map((t) => [t.day, formatRupiah(t.revenue)]);
    const success = exportToCSV(
      `Laporan_Analytics_Trend_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
    );
    if (success) {
      toast.success("Laporan analitik trend berhasil diekspor ke CSV!");
    } else {
      toast.error("Gagal mengekspor laporan CSV.");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div>
          <h1 className="text-3xl font-black tracking-normal">
            {t("analytics.title", "Advanced Analytics")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t(
              "analytics.subtitle",
              "Revenue trend, growth pelanggan, performa produk, dan report otomatis dari AI.",
            )}
          </p>
        </div>
        <Button
          variant="default"
          onClick={handleExportAnalyticsCSV}
          className="rounded-xl h-10 px-4 gap-2 font-bold cursor-pointer shrink-0"
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t("analytics.projected_revenue", "Proyeksi Revenue")}
          value={formatRupiah(metrics.todayRevenue * 1.07)}
          trend="Estimasi AI Real-time"
          icon={TrendingUp}
        />
        <StatCard
          label={t("analytics.crm_customers", "Pelanggan CRM")}
          value={`${snapshot.customers.length} Orang`}
          trend="Database Aktif"
          icon={UsersRound}
          tone="success"
        />
        <StatCard
          label={t("analytics.total_transactions", "Total Transaksi")}
          value={`${metrics.orders}`}
          trend="Pencatatan POS"
          icon={Bot}
          tone="ai"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-border bg-card/84 p-5 shadow-soft backdrop-blur-2xl">
          <h2 className="text-xl font-black tracking-normal">
            {t("analytics.revenue_trend_title", "Revenue Trend (7 Hari Terakhir)")}
          </h2>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicRevenueTrend}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  domain={[0, "auto"]}
                  tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString("id-ID")}k`}
                />
                <ChartTooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "18px",
                  }}
                />
                <Area
                  dataKey="revenue"
                  stroke="var(--color-primary)"
                  fill="url(#revenueFill)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-border bg-card/84 p-5 shadow-soft backdrop-blur-2xl">
          <h2 className="text-xl font-black tracking-normal">
            {t("analytics.product_perf_title", "Product Catalog Performance")}
          </h2>
          <div className="mt-5 h-80">
            {dynamicProductPerformance.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Belum ada produk aktif
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicProductPerformance} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    stroke="var(--color-muted-foreground)"
                    tickLine={false}
                    fontSize={11}
                  />
                  <ChartTooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "18px",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 12, 12, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-[1.75rem] border border-border bg-primary p-6 text-primary-foreground shadow-float">
        <h2 className="text-2xl font-black tracking-normal">
          {t("analytics.ai_report_title", "Automatic AI Business Report")}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 opacity-90">
          {metrics.orders > 0
            ? `Hari ini tercatat ${metrics.orders} transaksi dengan total omzet ${formatRupiah(metrics.todayRevenue)}. ${metrics.lowStock > 0 ? `Peringatan: Terdapat ${metrics.lowStock} item bahan baku di bawah batas aman minimum.` : "Seluruh inventaris bahan baku dalam kondisi optimal."} Database CRM mencatat ${snapshot.customers.length} pelanggan terhubung.`
            : "Sistem Single Source of Truth aktif. Belum ada transaksi masuk hari ini. Rekomendasi: Buka kasir POS untuk memulai penjualan dan mencatat stok secara otomatis."}
        </p>
      </div>
    </div>
  );
}

function OrdersPage({
  snapshot,
  onRefresh,
}: {
  snapshot: Snapshot;
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);

  const activeOutlets = snapshot.outlets?.filter((o) => o.active !== false) || [];
  const assignedOutletId =
    snapshot.assignedOutletId ||
    (activeOutlets.length > 0 && activeOutlets[0] ? activeOutlets[0].id : "all");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(
    !isOwner ? assignedOutletId : "all",
  );

  useEffect(() => {
    if (!isOwner) {
      const lockedId =
        snapshot.assignedOutletId ||
        (activeOutlets.length > 0 && activeOutlets[0] ? activeOutlets[0].id : "all");
      setSelectedOutletFilter(lockedId);
    }
  }, [isOwner, snapshot.assignedOutletId, activeOutlets]);
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);

  // Local state for immediate update on Refund/Void & new order creation
  const getMergedOrders = (baseOrders: SalesOrder[]) => {
    try {
      const raw = localStorage.getItem("kebabschoicepos_recent_orders");
      const cached: SalesOrder[] = raw ? JSON.parse(raw) : [];
      const map = new Map<string, SalesOrder>();
      baseOrders.forEach((o) => {
        if (o && o.id) map.set(o.id, o);
      });
      cached.forEach((o) => {
        if (o && o.id) {
          const existing = map.get(o.id);
          map.set(o.id, { ...existing, ...o });
        }
      });
      return Array.from(map.values()).sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
    } catch {
      return baseOrders;
    }
  };

  const [localOrders, setLocalOrders] = useState<SalesOrder[]>(() => getMergedOrders(snapshot.orders));
  useEffect(() => {
    setLocalOrders(getMergedOrders(snapshot.orders));
  }, [snapshot.orders]);

  // Real-time synchronization when a new order is paid in the POS session
  useEffect(() => {
    const handleOrderCreated = (e: any) => {
      const newOrder = e?.detail as SalesOrder;
      if (newOrder && newOrder.id) {
        setLocalOrders((prev) => {
          const filtered = prev.filter((o) => o.id !== newOrder.id);
          return [newOrder, ...filtered];
        });
      } else {
        setLocalOrders((prev) => getMergedOrders(prev));
      }
    };
    window.addEventListener("order:created", handleOrderCreated);
    window.addEventListener("storage", handleOrderCreated);
    return () => {
      window.removeEventListener("order:created", handleOrderCreated);
      window.removeEventListener("storage", handleOrderCreated);
    };
  }, []);

  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7days" | "month">("all");

  const isTodayLocal = (dateString?: string) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const isWithinDaysLocal = (dateString?: string, days: number = 7) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0);
    return d.getTime() >= start.getTime();
  };

  const isThisMonthLocal = (dateString?: string) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // Detail Transaksi Modal State
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<SalesOrder | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [isLoadingDetailItems, setIsLoadingDetailItems] = useState(false);

  // Supervisor Action Modal (Refund / Void) State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    mode: "refund" | "void";
    order: SalesOrder | null;
  }>({ isOpen: false, mode: "refund", order: null });
  const [supervisorPin, setSupervisorPin] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const orderMetadataMap = useMemo(() => {
    const map: Record<string, { outlet_id: string; outlet_name: string; staff_name?: string }> = {};
    (snapshot.outlets || []).forEach((out) => {
      const meta = ((out as any).settings as any)?.order_metadata || {};
      Object.entries(meta).forEach(([ordId, data]: [string, any]) => {
        map[ordId] = {
          outlet_id: out.id,
          outlet_name: out.name,
          staff_name: data?.staff_name || data?.displayName || "Kasir",
        };
      });
    });
    return map;
  }, [snapshot.outlets]);

  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    snapshot.customers.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [snapshot.customers]);

  const filteredOrders = useMemo(() => {
    return localOrders.filter((ord) => {
      if (selectedOutletFilter !== "all") {
        const meta = orderMetadataMap[ord.id];
        if (ord.outlet_id && ord.outlet_id !== selectedOutletFilter) return false;
        if (!ord.outlet_id && meta && meta.outlet_id !== selectedOutletFilter) return false;
        if (!ord.outlet_id && !meta) {
          const defaultOutlet =
            snapshot.assignedOutletId || (activeOutlets.length > 0 ? activeOutlets[0]?.id : "all");
          if (selectedOutletFilter !== defaultOutlet && selectedOutletFilter !== "all") return false;
        }
      }

      if (dateFilter === "today" && !isTodayLocal(ord.created_at)) return false;
      if (dateFilter === "7days" && !isWithinDaysLocal(ord.created_at, 7)) return false;
      if (dateFilter === "month" && !isThisMonthLocal(ord.created_at)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = ord.order_number?.toLowerCase().includes(q);
        const custName = ord.customer_id ? customerMap[ord.customer_id]?.toLowerCase() : "";
        return Boolean(numMatch || custName?.includes(q));
      }
      return true;
    });
  }, [
    localOrders,
    selectedOutletFilter,
    dateFilter,
    searchQuery,
    orderMetadataMap,
    customerMap,
    snapshot.assignedOutletId,
    activeOutlets,
  ]);

  const filteredTotalRevenue = useMemo(() => {
    return filteredOrders
      .filter((ord) => ord.status !== "refunded" && ord.status !== "void")
      .reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
  }, [filteredOrders]);

  const handleExportOrdersCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("Tidak ada data transaksi untuk diekspor");
      return;
    }
    const headers = [
      "No",
      "Nomor Order",
      "Tanggal & Waktu",
      "Cabang Outlet",
      "Kasir",
      "Pelanggan CRM",
      "Metode Pembayaran",
      "Status",
      "Total Omzet",
    ];

    const rows = filteredOrders.map((ord, idx) => {
      const meta = orderMetadataMap[ord.id];
      const outletName = meta?.outlet_name || "Outlet Utama";
      const staffName = meta?.staff_name || "Kasir";
      const custName = ord.customer_id ? customerMap[ord.customer_id] || "-" : "-";
      const orderDate = ord.created_at ? new Date(ord.created_at).toLocaleString("id-ID") : "-";

      return [
        idx + 1,
        ord.order_number || ord.id,
        orderDate,
        outletName,
        staffName,
        custName,
        (ord.payment_method || "cash").toUpperCase(),
        ord.status || "paid",
        formatRupiah(ord.total),
      ];
    });

    const filename = `Laporan_Transaksi_Orders_${selectedOutletFilter}_${new Date().toISOString().split("T")[0]}`;
    const success = exportToCSV(filename, headers, rows);
    if (success) {
      toast.success("Data transaksi berhasil diekspor ke CSV!");
    } else {
      toast.error("Gagal mengekspor data transaksi.");
    }
  };

  // Open Detail Transaksi Modal & fetch items
  const handleOpenOrderDetail = async (order: SalesOrder) => {
    setSelectedDetailOrder(order);
    setIsLoadingDetailItems(true);
    try {
      const { data: items, error } = await supabase
        .from("sales_order_items")
        .select("*")
        .eq("order_id", order.id);

      if (!error && items && items.length > 0) {
        setDetailItems(items);
      } else {
        // Fallback item
        setDetailItems([
          {
            name: `Order POS #${order.order_number}`,
            quantity: 1,
            unit_price: order.total,
            subtotal: order.total,
          },
        ]);
      }
    } catch {
      setDetailItems([
        {
          name: `Order POS #${order.order_number}`,
          quantity: 1,
          unit_price: order.total,
          subtotal: order.total,
        },
      ]);
    } finally {
      setIsLoadingDetailItems(false);
    }
  };

  // Open Supervisor Action Modal
  const handleOpenActionModal = (mode: "refund" | "void", order: SalesOrder) => {
    setActionModal({ isOpen: true, mode, order });
    setSupervisorPin("");
    setActionReason("");
  };

  // Confirm Refund / Void with Supervisor PIN
  const handleConfirmAction = async () => {
    if (!actionModal.order) return;

    if (!actionReason.trim()) {
      toast.error("Alasan wajib diisi!");
      return;
    }

    setIsActionSubmitting(true);
    const targetOutletId =
      actionModal.order.outlet_id ||
      (selectedOutletFilter !== "all" ? selectedOutletFilter : snapshot.assignedOutletId) ||
      null;

    const authResult = await verifySupervisorPin(supervisorPin, {
      outletId: targetOutletId,
      businessId: snapshot.businessId,
    });

    // Default supervisor PIN: 1234, 0000, or admin123
    const validPins = ["1234", "0000", "admin123"];
    if (!authResult.isValid && !validPins.includes(supervisorPin.trim())) {
      toast.error(authResult.error || "PIN Supervisor tidak valid! (Default PIN: 1234)");
      setIsActionSubmitting(false);
      return;
    }

    const authorizedBy = authResult.authorizedBy || "Supervisor";
    const newStatus = actionModal.mode === "refund" ? "refunded" : "void";
    const ordId = actionModal.order.id;
    const ordNumber = actionModal.order.order_number;
    const ordTotal = Number(actionModal.order.total) || 0;

    try {
      // 1. Update order status in Supabase
      const { error: updateErr } = await supabase
        .from("sales_orders")
        .update({ status: newStatus as any })
        .eq("id", ordId);

      if (updateErr) {
        console.warn("[Orders] DB status update note:", updateErr.message);
        if (actionModal.mode === "void") {
          await supabase
            .from("sales_orders")
            .update({ status: "cancelled" as any })
            .eq("id", ordId);
        }
      }

      // 2. Adjust active shift cash if order was paid in cash
      if (actionModal.order.payment_method?.toLowerCase() === "cash") {
        try {
          const outletShiftKey = targetOutletId ? `kebabschoicepos_active_shift_${targetOutletId}` : null;
          const savedShift = (outletShiftKey && localStorage.getItem(outletShiftKey)) || localStorage.getItem("kebabschoicepos_active_shift");
          if (savedShift) {
            const shiftObj = JSON.parse(savedShift);
            const newTotalOut = (Number(shiftObj.totalCashOut) || 0) + ordTotal;
            const newExpected = (Number(shiftObj.expectedEndingCash) || 0) - ordTotal;
            shiftObj.totalCashOut = newTotalOut;
            shiftObj.expectedEndingCash = newExpected;
            localStorage.setItem("kebabschoicepos_active_shift", JSON.stringify(shiftObj));
            if (targetOutletId) {
              localStorage.setItem(`kebabschoicepos_active_shift_${targetOutletId}`, JSON.stringify(shiftObj));
            }

            // Sync with local cash movements history
            try {
              const savedMovs = JSON.parse(
                localStorage.getItem("kebabschoicepos_cash_movements") || "[]",
              );
              const newMov = {
                id: `mov-${Date.now()}`,
                shiftId: shiftObj.id,
                type: "out",
                amount: ordTotal,
                notes: `${actionModal.mode.toUpperCase()} #${ordNumber}: ${actionReason.trim()}`,
                authorized_by: authorizedBy,
                timestamp: new Date().toISOString(),
              };
              localStorage.setItem(
                "kebabschoicepos_cash_movements",
                JSON.stringify([newMov, ...savedMovs]),
              );
            } catch {
              // ignore
            }

            // Log cash movement with authorized_by
            await supabase.from("cash_movements" as any).insert({
              shift_id: shiftObj.id,
              business_id: snapshot.businessId,
              outlet_id: targetOutletId,
              type: "out",
              amount: ordTotal,
              description: `${actionModal.mode.toUpperCase()} #${ordNumber}: ${actionReason.trim()} (Otorisasi: ${authorizedBy})`,
              notes: `${actionModal.mode.toUpperCase()} #${ordNumber}: ${actionReason.trim()}`,
              authorized_by: authorizedBy,
              created_by: authorizedBy,
              created_at: new Date().toISOString(),
            });

            if (shiftObj.id && !shiftObj.id.startsWith("shift-")) {
              await supabase
                .from("pos_shifts" as any)
                .update({
                  total_cash_out: newTotalOut,
                  expected_ending_cash: newExpected,
                })
                .eq("id", shiftObj.id);
            }
          }
        } catch (shiftErr) {
          console.warn("[Shift] Cash adjust note:", shiftErr);
        }
      }

      // 2.5. Stock Reversal: Return raw materials (BOM) & product stock to inventory
      const reversalType = actionModal.mode === "refund" ? "refund_reversal" : "void_reversal";
      try {
        // A. Look up previous stock_movements for this order
        const { data: prevMovements } = await (supabase as any)
          .from("stock_movements")
          .select("*")
          .or(`reference_id.eq.${ordId},notes.ilike.%${ordNumber}%`);

        const saleMovements: any[] = ((prevMovements as any[]) || []).filter(
          (m: any) => m.type === "pos_sale" || m.movement_type === "pos_sale" || m.type === "sale",
        );

        if (saleMovements.length > 0) {
          for (const mov of saleMovements) {
            const qty = Number(mov.quantity) || 0;
            if (qty > 0 && mov.inventory_item_id) {
              const { data: invRow } = await supabase
                .from("inventory_items")
                .select("id, stock, unit, name")
                .eq("id", mov.inventory_item_id)
                .maybeSingle();

              if (invRow) {
                const restoredStock = (Number(invRow.stock) || 0) + qty;
                await supabase
                  .from("inventory_items")
                  .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                  .eq("id", mov.inventory_item_id);

                // Log reversal stock movement
                await supabase.from("stock_movements" as any).insert({
                  business_id: snapshot.businessId,
                  inventory_item_id: mov.inventory_item_id,
                  outlet_id: targetOutletId,
                  reference_id: ordId,
                  reference_type: "pos_order",
                  type: reversalType,
                  movement_type: reversalType,
                  quantity: qty,
                  unit: mov.unit || invRow.unit || "gram",
                  remaining_stock: restoredStock,
                  notes: `${actionModal.mode.toUpperCase()} Reversal #${ordNumber}: Pengembalian stok bahan baku (Otorisasi: ${authorizedBy})`,
                  created_at: new Date().toISOString(),
                });
              }
            }
          }
        } else {
          // B. Fallback: inspect sales_order_items if no stock_movements were recorded
          const { data: orderItems } = await supabase
            .from("sales_order_items")
            .select("product_id, quantity, name")
            .eq("order_id", ordId);

          for (const itm of orderItems || []) {
            const prod = snapshot.products.find((p) => p.id === itm.product_id);
            if (prod?.recipe && Array.isArray(prod.recipe.items)) {
              for (const ing of prod.recipe.items) {
                if (ing.inventory_item_id) {
                  const rawNeeded = (Number(ing.quantity) || 1) * (Number(itm.quantity) || 1);
                  const { data: invRow } = await (supabase.from("inventory_items" as any))
                    .select("id, stock, unit, name, yield_per_unit, yield_unit")
                    .eq("id", ing.inventory_item_id)
                    .maybeSingle();

                  if (invRow) {
                    const row = invRow as any;
                    const convertedQty = convertRecipeToInventoryQuantity(
                      rawNeeded,
                      ing.unit || "gram",
                      row.unit || "kg",
                      row.yield_per_unit,
                      row.yield_unit,
                    );
                    const restoredStock = (Number(row.stock) || 0) + convertedQty;
                    await (supabase.from("inventory_items" as any))
                      .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                      .eq("id", ing.inventory_item_id);

                    await supabase.from("stock_movements" as any).insert({
                      business_id: snapshot.businessId,
                      inventory_item_id: ing.inventory_item_id,
                      outlet_id: targetOutletId,
                      reference_id: ordId,
                      reference_type: "pos_order",
                      type: reversalType,
                      movement_type: reversalType,
                      quantity: convertedQty,
                      unit: row.unit || ing.unit || "gram",
                      remaining_stock: restoredStock,
                      notes: `${actionModal.mode.toUpperCase()} Reversal #${ordNumber}: Pengembalian ${itm.quantity}x ${itm.name} (Otorisasi: ${authorizedBy})`,
                      created_at: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        }

        // C. Restore product catalog stock if tracked on products table
        const { data: orderItems } = await supabase
          .from("sales_order_items")
          .select("product_id, quantity")
          .eq("order_id", ordId);

        for (const itm of orderItems || []) {
          if (itm.product_id && !itm.product_id.startsWith("demo-")) {
            const { data: prodRow } = await supabase
              .from("products")
              .select("id, stock")
              .eq("id", itm.product_id)
              .maybeSingle();
            if (prodRow) {
              const newProdStock = (Number(prodRow.stock) || 0) + (Number(itm.quantity) || 1);
              await supabase
                .from("products")
                .update({ stock: newProdStock, updated_at: new Date().toISOString() })
                .eq("id", itm.product_id);
            }
          }
        }
      } catch (stockRevErr) {
        console.warn("[StockReversal] Stock reversal warning:", stockRevErr);
      }

      // 3. Immediate local update with authorized_by and actionReason
      setLocalOrders((prev) =>
        prev.map((o) =>
          o.id === ordId
            ? {
                ...o,
                status: newStatus,
                actionReason: actionReason.trim(),
                authorized_by: authorizedBy,
              }
            : o,
        ),
      );
      if (selectedDetailOrder && selectedDetailOrder.id === ordId) {
        setSelectedDetailOrder({
          ...selectedDetailOrder,
          status: newStatus,
          actionReason: actionReason.trim(),
          authorized_by: authorizedBy,
        });
      }

      toast.success(
        `Order #${ordNumber} berhasil di-${actionModal.mode === "refund" ? "Refund" : "Void"}!`,
        { description: `Otorisasi: ${authorizedBy} • Alasan: ${actionReason.trim()}` },
      );

      setActionModal({ isOpen: false, mode: "refund", order: null });
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      toast.error(`Gagal memproses ${actionModal.mode}: ` + err.message);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
        <div>
          <h1 className="text-3xl font-black tracking-normal">
            {t("orders.title", "Orders & Transaksi")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "orders.subtitle",
              "Riwayat lengkap transaksi seluruh cabang outlet, status pembayaran, kasir, dan data CRM.",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Outlet Filter */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2 shadow-xs">
            <Store className="size-4 text-primary shrink-0" />
            <div className="text-xs">
              <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                {t("orders.filter_outlet", "Filter Outlet")}
              </span>
              {isOwner ? (
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => setSelectedOutletFilter(e.target.value)}
                  className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="all">
                    {t("orders.all_outlets_option", "Semua Cabang Outlet")}
                  </option>
                  {(snapshot.outlets || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      📍 {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <span>
                    📍{" "}
                    {snapshot.outlets?.find((o) => o.id === selectedOutletFilter)?.name ||
                      "Outlet Kasir"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 font-normal">
                    <Lock className="size-2.5" /> Terkunci
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center rounded-2xl border border-border bg-background p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "today"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("7days")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "7days"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("month")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "month"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bulan Ini
            </button>
          </div>

          {/* Search */}
          <div className="relative min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("orders.search_placeholder", "Cari order # / member...")}
              className="pl-9 h-11 rounded-2xl text-xs bg-background"
            />
          </div>

          {/* Export CSV */}
          <Button
            variant="default"
            size="sm"
            onClick={handleExportOrdersCSV}
            disabled={filteredOrders.length === 0}
            className="rounded-2xl h-11 px-4 gap-2 font-bold cursor-pointer shrink-0"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.total_orders_filtered", "Total Order Terfilter")}
          </p>
          <p className="text-xl font-black mt-1">{filteredOrders.length} Transaksi</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.revenue_filtered", "Omzet Bersih Terfilter")}
          </p>
          <p className="text-xl font-black text-primary mt-1">
            {formatRupiah(filteredTotalRevenue)}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.outlet_status", "Status Outlet")}
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {selectedOutletFilter === "all"
              ? t("orders.all_connected", "Semua Cabang Terhubung")
              : snapshot.outlets?.find((o) => o.id === selectedOutletFilter)?.name || "Aktif"}
          </p>
        </div>
      </div>

      {/* Order List */}
      <div className="rounded-[1.75rem] border border-border bg-card/84 p-4 shadow-soft backdrop-blur-2xl">
        {filteredOrders.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ReceiptText className="mx-auto size-10 opacity-30 mb-2" />
            <p className="font-bold text-sm">
              {t("orders.no_orders_match", "Tidak Ada Transaksi yang Cocok")}
            </p>
            <p className="text-xs mt-1">
              {t(
                "orders.no_orders_match_desc",
                "Belum ada order untuk filter ini atau kata kunci pencarian Anda.",
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const meta = orderMetadataMap[order.id];
              const outletName = meta?.outlet_name || "Outlet Utama";
              const staffName = meta?.staff_name || "Kasir";
              const custName = order.customer_id ? customerMap[order.customer_id] : null;

              const isRefunded = order.status === "refunded";
              const isVoid = order.status === "void";

              return (
                <div
                  key={order.id}
                  onClick={() => handleOpenOrderDetail(order)}
                  className="flex flex-col gap-3 rounded-2xl bg-secondary/70 p-4 sm:flex-row sm:items-center sm:justify-between transition-all hover:bg-secondary cursor-pointer border border-transparent hover:border-primary/30"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black tracking-normal text-base">
                        {order.order_number}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                          isRefunded
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : isVoid
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {order.status}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary uppercase">
                        {order.payment_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-foreground/80">
                        <Store className="size-3.5 text-primary" />
                        {outletName}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserRound className="size-3.5 text-muted-foreground" />
                        {staffName}
                      </span>
                      {custName && (
                        <span className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[11px] font-bold">
                          ⭐ Member: {custName}
                        </span>
                      )}
                      {order.created_at && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="size-3" />
                          {new Date(order.created_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0 flex flex-col items-end gap-1.5">
                    <p
                      className={cn(
                        "text-lg font-black",
                        isRefunded || isVoid
                          ? "line-through text-muted-foreground"
                          : "text-primary",
                      )}
                    >
                      {formatRupiah(order.total)}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      Channel: {order.channel || "POS Kasir"}
                    </p>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border bg-background hover:bg-secondary"
                        onClick={() =>
                          setReceiptModalData({
                            orderNumber: order.order_number,
                            outletName,
                            cashierName: staffName,
                            paymentMethod: (order.payment_method || "CASH").toUpperCase(),
                            customerName: custName,
                            createdAt: order.created_at || new Date().toISOString(),
                            items: [
                              {
                                name: `Order POS #${order.order_number}`,
                                quantity: 1,
                                price: order.total,
                                subtotal: order.total,
                              },
                            ],
                            total: order.total,
                          })
                        }
                      >
                        <Printer className="size-3.5" />
                        {t("pos.print_receipt", "Cetak Struk")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1"
                        onClick={() => handleOpenOrderDetail(order)}
                      >
                        <FileText className="size-3.5" />
                        Detail
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL TRANSAKSI MODAL */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-[2rem] border border-border bg-card p-6 shadow-float animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-normal">Detail Transaksi</h2>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-bold capitalize",
                      selectedDetailOrder.status === "refunded"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : selectedDetailOrder.status === "void"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {selectedDetailOrder.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No. Order:{" "}
                  <strong className="text-foreground">{selectedDetailOrder.order_number}</strong>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl size-8"
                onClick={() => setSelectedDetailOrder(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Metadata Info Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs bg-secondary/50 rounded-2xl p-4 border border-border/60">
              <div>
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Tanggal & Waktu
                </span>
                <span className="font-semibold text-foreground">
                  {selectedDetailOrder.created_at
                    ? new Date(selectedDetailOrder.created_at).toLocaleString("id-ID")
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Outlet Cabang
                </span>
                <span className="font-semibold text-foreground">
                  {orderMetadataMap[selectedDetailOrder.id]?.outlet_name || "Outlet Utama"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Kasir / Operator
                </span>
                <span className="font-semibold text-foreground">
                  {orderMetadataMap[selectedDetailOrder.id]?.staff_name || "Kasir POS"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Pelanggan
                </span>
                <span className="font-semibold text-foreground">
                  {selectedDetailOrder.customer_id
                    ? customerMap[selectedDetailOrder.customer_id] || "Member CRM"
                    : "Pelanggan Umum"}
                </span>
              </div>
            </div>

            {/* Otorisasi Supervisor Info (jika di-refund atau di-void) */}
            {(selectedDetailOrder.status === "refunded" ||
              selectedDetailOrder.status === "void") && (
              <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>
                    Informasi Otorisasi{" "}
                    {selectedDetailOrder.status === "refunded" ? "Refund" : "Void"}
                  </span>
                </div>
                {selectedDetailOrder.authorized_by && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Diotorisasi oleh:{" "}
                    <strong className="text-foreground">{selectedDetailOrder.authorized_by}</strong>
                  </p>
                )}
                {selectedDetailOrder.actionReason && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Alasan:{" "}
                    <span className="italic text-foreground">
                      {selectedDetailOrder.actionReason}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Items List */}
            <div className="mt-5 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
                Daftar Menu & Kustomisasi:
              </span>
              {isLoadingDetailItems ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Memuat rincian pesanan...
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {detailItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/80 bg-background/80 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-foreground">{item.name}</span>
                        <span className="font-black text-primary shrink-0">
                          {formatRupiah(item.subtotal || item.unit_price * item.quantity)}
                        </span>
                      </div>
                      {item.variant_name && (
                        <p className="text-[11px] text-muted-foreground">
                          Varian:{" "}
                          <span className="font-semibold text-foreground">{item.variant_name}</span>
                        </p>
                      )}
                      {item.selected_options?.modifiers?.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Level/Opsi:{" "}
                          <span className="font-semibold text-foreground">
                            {item.selected_options.modifiers.join(", ")}
                          </span>
                        </p>
                      )}
                      {item.selected_options?.addons?.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Topping:{" "}
                          <span className="font-semibold text-foreground">
                            {item.selected_options.addons.map((a: any) => a.name).join(", ")}
                          </span>
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] italic text-amber-600 dark:text-amber-400">
                          Catatan: {item.notes}
                        </p>
                      )}
                      <div className="text-[11px] text-muted-foreground pt-1 flex justify-between border-t border-border/40">
                        <span>Jumlah: {item.quantity} porsi</span>
                        <span>@ {formatRupiah(item.unit_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Summary */}
            <div className="mt-5 rounded-2xl bg-secondary/80 p-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatRupiah(selectedDetailOrder.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Diskon Promo</span>
                <span>Rp 0</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pajak (PB1)</span>
                <span>Rp 0</span>
              </div>
              <div className="flex justify-between text-base font-black text-foreground pt-2 border-t border-border">
                <span>Total Tagihan</span>
                <span className="text-primary">{formatRupiah(selectedDetailOrder.total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                <span>Metode Pembayaran</span>
                <span className="font-black uppercase text-foreground">
                  {selectedDetailOrder.payment_method}
                </span>
              </div>
            </div>

            {/* Action Buttons: Cetak Struk, Refund, Void */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                className="rounded-xl font-bold text-xs gap-1.5"
                onClick={() => {
                  setReceiptModalData({
                    orderNumber: selectedDetailOrder.order_number,
                    outletName:
                      orderMetadataMap[selectedDetailOrder.id]?.outlet_name || "Outlet Utama",
                    cashierName:
                      orderMetadataMap[selectedDetailOrder.id]?.staff_name || "Kasir POS",
                    paymentMethod: (selectedDetailOrder.payment_method || "CASH").toUpperCase(),
                    customerName: selectedDetailOrder.customer_id
                      ? customerMap[selectedDetailOrder.customer_id]
                      : "Pelanggan Umum",
                    createdAt: selectedDetailOrder.created_at || new Date().toISOString(),
                    items: detailItems.map((it) => ({
                      name: it.name,
                      quantity: it.quantity,
                      price: it.unit_price,
                      subtotal: it.subtotal || it.unit_price * it.quantity,
                    })),
                    total: selectedDetailOrder.total,
                  });
                  setSelectedDetailOrder(null);
                }}
              >
                <Printer className="size-3.5" />
                Cetak Struk
              </Button>

              <div className="flex items-center gap-2">
                {selectedDetailOrder.status === "paid" ? (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl font-bold text-xs gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                      onClick={() => handleOpenActionModal("refund", selectedDetailOrder)}
                    >
                      <RotateCcw className="size-3.5" />
                      Refund Transaksi
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-xl font-bold text-xs gap-1.5"
                      onClick={() => handleOpenActionModal("void", selectedDetailOrder)}
                    >
                      <XCircle className="size-3.5" />
                      Void Order
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary" className="text-xs font-bold">
                    Order {selectedDetailOrder.status.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPERVISOR CONFIRMATION MODAL (REFUND / VOID) */}
      {actionModal.isOpen && actionModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-2xl",
                    actionModal.mode === "refund"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {actionModal.mode === "refund" ? (
                    <RotateCcw className="size-5" />
                  ) : (
                    <XCircle className="size-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-normal">
                    {actionModal.mode === "refund" ? "Otorisasi Refund" : "Otorisasi Void"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Order #{actionModal.order.order_number}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl size-8"
                onClick={() => setActionModal({ isOpen: false, mode: "refund", order: null })}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-secondary/50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nilai Transaksi:</span>
                  <span className="font-black text-foreground">
                    {formatRupiah(actionModal.order.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode Bayar:</span>
                  <span className="font-bold uppercase text-foreground">
                    {actionModal.order.payment_method}
                  </span>
                </div>
              </div>

              {/* Input Alasan */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-1">
                  Alasan {actionModal.mode === "refund" ? "Refund" : "Void"} (Wajib):
                </label>
                <Input
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Misal: Pelanggan salah pesan, Salah input kasir..."
                  className="rounded-xl text-xs bg-background h-10"
                />
              </div>

              {/* Input PIN Supervisor */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-1">
                  PIN Supervisor (Otorisasi):
                </label>
                <Input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  placeholder="Masukkan PIN Supervisor (Default: 1234)"
                  className="rounded-xl text-xs bg-background h-10"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Otorisasi diperlukan untuk mengubah status transaksi dan menyesuaikan kas shift.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                className="rounded-xl font-bold text-xs"
                onClick={() => setActionModal({ isOpen: false, mode: "refund", order: null })}
              >
                Batal
              </Button>
              <Button
                variant={actionModal.mode === "refund" ? "default" : "destructive"}
                className="rounded-xl font-bold text-xs gap-1.5"
                disabled={isActionSubmitting}
                onClick={handleConfirmAction}
              >
                {isActionSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : actionModal.mode === "refund" ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                Konfirmasi {actionModal.mode === "refund" ? "Refund" : "Void"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* POS RECEIPT MODAL FOR RE-PRINT */}
      <ReceiptModal
        data={receiptModalData}
        businessName={snapshot.businessName}
        onClose={() => setReceiptModalData(null)}
      />
    </div>
  );
}

function ProfilePage({
  profile,
  snapshot,
  onRefresh,
}: {
  profile: UserProfile;
  snapshot: Snapshot;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <div className="space-y-6 w-full max-w-none">
      <PageTitle
        title="Profil Akun"
        subtitle="Kelola informasi akun pengguna, simulasi role, dan identitas bisnis."
      />
      <section className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="text-xl font-black">Profil Pengguna</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-black text-primary">
            {profile.displayName ? profile.displayName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold">{profile.displayName}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Role Aktif: {snapshot.role || "Owner"}
            </p>
          </div>
        </div>

        {/* Simulasi Role untuk Pengujian RBAC */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Simulasi Role Pengguna (Audit & Validasi RBAC):
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {[
              {
                id: "owner",
                label: "👑 Owner HQ",
                desc: "Akses penuh seluruh cabang, menu & pengaturan",
              },
              {
                id: "manager",
                label: "🏢 Manager Outlet",
                desc: "Akses data outlet & shift, dilarang ubah pengaturan bisnis",
              },
              {
                id: "cashier",
                label: "🛒 Kasir POS",
                desc: "Hanya modul POS kasir, dilarang masuk menu HQ",
              },
            ].map((r) => {
              const isActive = (snapshot.role || "owner").toLowerCase() === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={async () => {
                    localStorage.setItem("kebabschoicepos_simulated_role", r.id);
                    toast.success(`Role diubah menjadi ${r.label}`);
                    if (onRefresh) await onRefresh();
                  }}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border p-3 text-left transition-all",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-brand ring-1 ring-primary"
                      : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                  )}
                >
                  <span className="text-xs font-black">{r.label}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <BusinessSettingsCard onRefresh={onRefresh} />
    </div>
  );
}

function BusinessSettingsCard({ onRefresh }: { onRefresh?: () => void | Promise<void> }) {
  const [business, setBusiness] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadBusinessSettings() {
    try {
      const data = await getBusinessProfile();
      setBusiness(data);
      setForm({ ...(data || {}) });
      console.log("BUSINESS SETTINGS FETCH:", data);
    } catch (err) {
      console.error("Gagal memuat business settings:", err);
    }
  }

  useEffect(() => {
    loadBusinessSettings();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadBusinessSettings();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, WEBP, SVG)");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Ukuran logo maksimal 5MB");
      return;
    }

    setLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    toast.info("Logo baru dipilih. Klik 'Save Changes' untuk menyimpan.");
  }

  function handleCancelEdit() {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setForm({ ...(business || {}) });
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      const businessId = business?.id;
      if (!businessId) {
        throw new Error("Business ID tidak ditemukan");
      }

      let logoUrl = form.logo;
      if (logoFile) {
        toast.info("Mengunggah logo ke Supabase Storage...");
        logoUrl = await uploadBusinessLogo(businessId, logoFile);
      }

      const updateData = {
        ...form,
        logo: logoUrl,
      };

      console.log("CALL UPDATE BUSINESS", updateData);
      await updateBusinessProfile(businessId, updateData);
      const refreshed = await getBusinessProfile(businessId);
      console.log("REFRESHED BUSINESS SETTINGS:", refreshed);

      setBusiness(refreshed);
      setForm({ ...refreshed });
      setLogoFile(null);
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
      setLogoPreview(null);
      setEditing(false);
      toast.success("Business Settings dan Logo berhasil disimpan");

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("BUSINESS SETTINGS SAVE ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan Business Settings");
    } finally {
      setSaving(false);
    }
  }

  const fields: [string, string][] = [
    ["business_name", "Nama Usaha / Brand"],
    ["legal_name", "Nama Legal Perusahaan"],
    ["business_category", "Kategori Usaha"],
    ["city", "Kota Operasional"],
    ["currency", "Mata Uang"],
    ["phone", "Nomor Telepon"],
    ["email", "Alamat Email"],
    ["website", "Website"],
    ["address", "Alamat Lengkap"],
  ];

  const currentLogo = logoPreview || business?.logo;

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">Pengaturan Bisnis</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Identitas bisnis, logo merek, dan kontak usaha.
          </p>
        </div>
        <Button onClick={() => (editing ? handleCancelEdit() : setEditing(true))}>
          {editing ? "Batal" : "Ubah Informasi Bisnis"}
        </Button>
      </div>

      {/* Logo display & upload section */}
      <div className="mt-5 flex flex-col items-center gap-5 rounded-xl border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-start">
        <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card shadow-soft">
          {currentLogo ? (
            <img src={currentLogo} alt="Logo Bisnis" className="size-full object-cover" />
          ) : (
            <div className="p-2 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-1 size-6 opacity-60" />
              <span className="text-[0.65rem]">Tanpa Logo</span>
            </div>
          )}
          {logoPreview && (
            <span className="absolute right-1 bottom-1 rounded bg-primary px-1 py-0.5 text-[0.6rem] font-bold text-primary-foreground">
              Baru
            </span>
          )}
        </div>

        <div className="flex-1 space-y-2 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-sm font-bold">Logo Usaha</h3>
            {business?.logo && !logoPreview && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-500">
                Tersimpan
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Logo usaha akan tampil di header, struk transaksi, dan identitas bisnis.
          </p>

          {editing && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="size-3.5" />
                {business?.logo ? "Ganti Logo" : "Upload Logo"}
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={() => {
                    if (logoPreview) URL.revokeObjectURL(logoPreview);
                    setLogoPreview(null);
                    setLogoFile(null);
                  }}
                >
                  Batal Ganti
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <div key={key} className={key === "address" ? "md:col-span-2" : ""}>
            <label className="text-xs font-bold text-foreground/80">{label}</label>
            {editing ? (
              <Input
                className="mt-1.5 rounded-xl"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ) : (
              <p className="mt-1.5 rounded-xl border border-border/40 bg-muted/30 p-2.5 text-sm font-medium text-foreground/90">
                {business?.[key] || (
                  <span className="italic text-muted-foreground">- Belum diisi -</span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving} className="font-bold">
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-[2rem] border border-border bg-card/82 p-6 shadow-soft backdrop-blur-2xl">
      <h1 className="text-3xl font-black tracking-normal">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  );
}


function BranchPosSwitchModal({
  isOpen,
  onClose,
  outlets,
  onSelectBranch,
}: {
  isOpen: boolean;
  onClose: () => void;
  outlets: OutletItem[];
  onSelectBranch: (outlet: OutletItem) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-float">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
              <Monitor className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">🖥️ Masuk POS Kasir</h3>
              <p className="text-xs text-muted-foreground">Pilih cabang untuk langsung membuka terminal POS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {outlets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
              Belum ada cabang outlet yang terdaftar.
            </div>
          ) : (
            outlets.map((out) => (
              <button
                key={out.id}
                type="button"
                onClick={() => onSelectBranch(out)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors font-bold text-xs shrink-0">
                    <Store className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-foreground truncate">{out.name || (out as any).outlet_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{out.address || out.code || "Outlet Aktif"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Buka POS</span>
                  <ChevronRight className="size-4" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-border flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KebabsChoicePOSApp({ page }: { page: AppPage }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [profile, setProfile] = useState<UserProfile>({
    email: "admin@kitapos.id",
    displayName: "Admin",
  });
  const [loading, setLoading] = useState(true);
  const [, setLangTick] = useState(0);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const openThemeModal = () => {
    setThemeModalOpen(true);
  };

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const openSearchModal = () => {
    setSearchModalOpen(true);
  };

  // Tablet View States: Collapsible Left Sidebar & Fullscreen Focus Mode
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kebabschoicepos_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const [isTabletFocusMode, setIsTabletFocusMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("kebabschoicepos_tablet_focus_mode") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kebabschoicepos_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleTabletFocusMode = () => {
    const next = !isTabletFocusMode;
    setIsTabletFocusMode(next);
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem("kebabschoicepos_tablet_focus_mode", String(next));
      localStorage.setItem("kebabschoicepos_sidebar_collapsed", String(next));
      localStorage.setItem("kebabschoicepos_pos_header_collapsed", String(next));
    } catch {}
    window.dispatchEvent(new CustomEvent("pos:collapse-header", { detail: next }));
    if (next) {
      toast.success("Mode Tablet Fokus Penuh Aktif", {
        description: "Sidebar dan Bar Info dilipat untuk memaksimalkan area menu & keranjang kasir.",
      });
    } else {
      toast.info("Mode Normal Kembali", {
        description: "Sidebar dan Bar Info ditampilkan seperti semula.",
      });
    }
  };

  useEffect(() => {
    const handleFocusToggleEvent = () => handleToggleTabletFocusMode();
    window.addEventListener("pos:toggle-tablet-focus", handleFocusToggleEvent);
    return () => window.removeEventListener("pos:toggle-tablet-focus", handleFocusToggleEvent);
  }, [isTabletFocusMode]);

  const isPosMode = [
    "pos",
    "pos-orders",
    "pos-receipt",
    "pos-shift-cash",
    "pos-inventory",
    "pos-profile",
    "pos-attendance-in",
    "pos-attendance-out",
    "pos-attendance-history",
    "pos-attendance-shifts",
  ].includes(page);

  const getResolvedCashierName = (): string => {
    if (typeof window !== "undefined") {
      const activeCashier = localStorage.getItem("kebabschoicepos_active_cashier_name");
      if (activeCashier && activeCashier.trim()) {
        const trimmed = activeCashier.trim();
        const lower = trimmed.toLowerCase();
        if (
          lower === "kadut" ||
          lower.startsWith("pos outlet -") ||
          lower.includes("terminal outlet") ||
          lower.includes("akun login outlet")
        ) {
          localStorage.removeItem("kebabschoicepos_active_cashier_name");
        } else {
          return trimmed;
        }
      }
      try {
        const rawShift = localStorage.getItem("kebabschoicepos_active_shift");
        if (rawShift) {
          const parsed = JSON.parse(rawShift);
          if (parsed.cashierName && parsed.cashierName.trim()) {
            const shiftName = parsed.cashierName.trim();
            const lowerShift = shiftName.toLowerCase();
            if (
              lowerShift !== "kadut" &&
              !lowerShift.startsWith("pos outlet -") &&
              !lowerShift.includes("terminal outlet") &&
              !lowerShift.includes("akun login outlet")
            ) {
              return shiftName;
            }
          }
        }
      } catch {}
    }
    const profName = profile?.displayName || "";
    const profLower = profName.toLowerCase();
    if (
      profName &&
      profLower !== "kadut" &&
      !profLower.startsWith("pos outlet -") &&
      !profLower.includes("terminal outlet") &&
      !profLower.includes("akun login outlet")
    ) {
      return profName;
    }
    return "Kasir";
  };

  const [activeCashierName, setActiveCashierName] = useState<string>(getResolvedCashierName);
  const [isCashierSwitchModalOpen, setIsCashierSwitchModalOpen] = useState(false);
  const [isBranchPosModalOpen, setIsBranchPosModalOpen] = useState(false);

  const handleSelectBranchForPos = async (out: OutletItem) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_selected_outlet_id", out.id);
      localStorage.setItem("kebabschoicepos_active_outlet_id", out.id);
      localStorage.setItem("kebabschoicepos_active_outlet", JSON.stringify(out));
      localStorage.setItem("kebabschoicepos_user_role", "owner");
    }

    try {
      const { data: openShifts } = await supabase
        .from("pos_shifts" as any)
        .select("*")
        .eq("status", "open")
        .eq("outlet_id", out.id)
        .order("start_time", { ascending: false })
        .limit(1);

      if (openShifts && openShifts.length > 0) {
        const row: any = openShifts[0];
        const liveShift = {
          id: row.id,
          cashierName: row.cashier_name || out.name,
          cashierId: row.cashier_id,
          teamMembers: row.team_members,
          outletName: out.name,
          outletId: out.id,
          startingCash: Number(row.opening_cash ?? row.starting_cash) || 0,
          startTime: row.start_time || row.opened_at,
          status: "open",
          cashSales: Number(row.cash_sales) || 0,
          totalCashIn: Number(row.total_cash_in) || 0,
          totalCashOut: Number(row.total_cash_out) || 0,
          expectedEndingCash:
            Number(row.expected_ending_cash) || Number(row.opening_cash ?? row.starting_cash) || 0,
          notes: row.notes,
        };
        localStorage.setItem(`kebabschoicepos_active_shift_${out.id}`, JSON.stringify(liveShift));
        localStorage.setItem("kebabschoicepos_active_shift", JSON.stringify(liveShift));
        if (row.cashier_name) {
          setActiveCashierName(row.cashier_name);
          localStorage.setItem("kebabschoicepos_active_cashier_name", row.cashier_name);
        }
      }
    } catch (err) {
      console.warn("[handleSelectBranchForPos] Failed to sync open shift:", err);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("outlet:changed", { detail: { outletId: out.id, outlet: out } }),
      );
      window.dispatchEvent(new CustomEvent("pos:shift-updated"));
    }
    setIsBranchPosModalOpen(false);
    navigate({ to: "/pos" });
  };

  useEffect(() => {
    const handleCashierChange = (e: any) => {
      if (e.detail?.cashierName) {
        setActiveCashierName(e.detail.cashierName);
      } else {
        setActiveCashierName(getResolvedCashierName());
      }
    };
    window.addEventListener("pos:cashier-changed", handleCashierChange);
    return () => window.removeEventListener("pos:cashier-changed", handleCashierChange);
  }, []);

  const handleSelectCashier = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setActiveCashierName(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_active_cashier_name", trimmed);
      try {
        const rawShift = localStorage.getItem("kebabschoicepos_active_shift");
        if (rawShift) {
          const shift = JSON.parse(rawShift);
          shift.cashierName = trimmed;
          localStorage.setItem("kebabschoicepos_active_shift", JSON.stringify(shift));
        }
      } catch {}
      window.dispatchEvent(
        new CustomEvent("pos:cashier-changed", { detail: { cashierName: trimmed } }),
      );
    }
    toast.success(`Kasir bertugas diganti menjadi "${trimmed}"`);
  };

  useEffect(() => {
    const handleOpenTheme = () => setThemeModalOpen(true);
    const handleOpenSearch = () => setSearchModalOpen(true);
    window.addEventListener("open-theme-modal", handleOpenTheme);
    window.addEventListener("open-global-search", handleOpenSearch);
    return () => {
      window.removeEventListener("open-theme-modal", handleOpenTheme);
      window.removeEventListener("open-global-search", handleOpenSearch);
    };
  }, []);

  useEffect(() => {
    const t = getStoredTheme();
    applyTheme(t.appearance, t.color);
  }, []);

  async function refresh() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        await navigate({ to: "/auth", replace: true });
        return;
      }

      const userEmail = data.user.email ?? "admin@kitapos.id";
      const nameFromMetadata =
        (typeof data.user.user_metadata?.display_name === "string"
          ? data.user.user_metadata.display_name
          : userEmail.split("@")[0]) || "User";
      const nextProfile: UserProfile = { email: userEmail, displayName: nameFromMetadata };
      setProfile(nextProfile);
      const nextSnapshot = await loadSnapshot(data.user.id, nextProfile);
      setSnapshot(nextSnapshot);
    } catch (err) {
      console.warn("[refresh] Error loading snapshot:", err);
      setSnapshot((prev) => (prev?.businessId ? prev : emptySnapshot));
    }
  }

  // Language reactivity: re-render components on language change immediately
  useEffect(() => {
    const handleLangChange = () => {
      setLangTick((prev) => prev + 1);
    };
    window.addEventListener("languagechange", handleLangChange);
    i18n.on("languageChanged", handleLangChange);
    return () => {
      window.removeEventListener("languagechange", handleLangChange);
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

  // Window event listeners for immediate cross-module sync
  useEffect(() => {
    const handleMenuSync = () => {
      refresh().catch(() => undefined);
    };
    window.addEventListener("pos:menu-updated", handleMenuSync);
    window.addEventListener("menu-updated", handleMenuSync);
    window.addEventListener("inventory:updated", handleMenuSync);
    window.addEventListener("order:created", handleMenuSync);
    window.addEventListener("outlet:staff-updated", handleMenuSync);

    return () => {
      window.removeEventListener("pos:menu-updated", handleMenuSync);
      window.removeEventListener("menu-updated", handleMenuSync);
      window.removeEventListener("inventory:updated", handleMenuSync);
      window.removeEventListener("order:created", handleMenuSync);
      window.removeEventListener("outlet:staff-updated", handleMenuSync);
    };
  }, []);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    refresh()
      .catch((error) => {
        console.warn("[Dashboard] Initial refresh warning:", error);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    return () => clearTimeout(safetyTimer);
  }, []);

  useEffect(() => {
    if (!snapshot.businessId) {
      return;
    }

    const channel = supabase
      .channel(`kitapos-live-${snapshot.businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_orders",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outlets",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_insights",
          filter: `business_id=eq.${snapshot.businessId}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [snapshot.businessId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
    window.location.href = "/";
  }

  const content = useMemo(() => {
    // SECURITY LOCK SCREEN: Perangkat POS Outlet menunggu konfirmasi email Owner
    if (snapshot.isPendingConfirmation) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
          <div className="size-20 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5 shadow-lg border border-amber-500/20">
            <Lock className="size-10" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full mb-2">
            Status: Menunggu Otorisasi Owner
          </span>
          <h2 className="text-2xl font-black text-foreground max-w-md">
            Akun Outlet Belum Diaktifkan
          </h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
            Perangkat POS cabang <strong>{snapshot.pendingConfirmationOutletName || "Outlet"}</strong> ini memerlukan konfirmasi persetujuan keamanan. Tautan aktivasi resmi telah dikirim ke <strong>Gmail Owner</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => refresh()}
              className="rounded-2xl font-bold gap-2 text-xs"
            >
              <RefreshCw className="size-3.5" />
              Cek Status Ulang
            </Button>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="rounded-2xl font-bold gap-2 text-xs"
            >
              <LogOut className="size-3.5" />
              Keluar Akun
            </Button>
          </div>
        </div>
      );
    }

    const userRole = (snapshot.role || "owner").toLowerCase();
    const isHQRole = ["owner", "admin", "manager"].includes(userRole);
    const isCashierRole = userRole === "cashier" || (!isHQRole && userRole === "staff");
    const isManagerRole = userRole === "manager";
    const isPosPage = [
      "pos",
      "pos-orders",
      "pos-receipt",
      "pos-shift-cash",
      "pos-inventory",
      "pos-profile",
      "pos-attendance-in",
      "pos-attendance-out",
      "pos-attendance-history",
      "pos-attendance-shifts",
    ].includes(page);

    // RBAC GUARD 1: KASIR dilarang membuka modul HQ dan laporan finansial
    if (isCashierRole && !isPosPage) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-2xl font-black">Akses Ditolak (RBAC Kasir)</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Role Kasir / Staff hanya diizinkan untuk mengakses modul POS Kasir. Anda tidak memiliki
            izin untuk membuka menu HQ atau melihat laporan finansial perusahaan.
          </p>
          <Button onClick={() => navigate({ to: "/pos" })} className="mt-6 font-bold gap-2">
            <ShoppingCart className="size-4" />
            Kembali ke POS Kasir
          </Button>
        </div>
      );
    }

    // RBAC GUARD 2: MANAGER dilarang mengubah setting bisnis dan profil bisnis
    const isRestrictedManagerPage = [
      "business-profile",
      "receipt-settings",
      "printer-settings",
      "tax",
      "payment",
      "integration",
    ].includes(page);

    if (isManagerRole && isRestrictedManagerPage) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-600 mb-4">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-2xl font-black">Akses Terbatas (RBAC Manager)</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Role Manager Outlet tidak memiliki izin untuk mengubah Profil Bisnis dan Pengaturan
            Sistem. Pengaturan ini hanya dapat dikonfigurasi oleh Owner HQ / Administrator.
          </p>
          <Button onClick={() => navigate({ to: "/dashboard" })} className="mt-6 font-bold gap-2">
            <Building2 className="size-4" />
            Kembali ke Dashboard HQ
          </Button>
        </div>
      );
    }

    if (page === "pos") {
      return (
        <PosPage
          snapshot={snapshot}
          profile={profile}
          onRefresh={refresh}
          activeCashierName={activeCashierName}
        />
      );
    }
    if (page === "pos-receipt") {
      return <PosReceiptPage snapshot={snapshot} />;
    }
    if (page === "pos-shift-cash") {
      return <PosShiftCashPage />;
    }
    if (page === "pos-inventory") {
      return <PosInventoryPage />;
    }
    if (page === "pos-profile") {
      return <PosProfilePage />;
    }
    if (page === "pos-attendance-in") {
      return (
        <AttendancePage initialTab="in" snapshot={snapshot} profile={profile} onRefresh={refresh} />
      );
    }
    if (page === "pos-attendance-out") {
      return (
        <AttendancePage
          initialTab="out"
          snapshot={snapshot}
          profile={profile}
          onRefresh={refresh}
        />
      );
    }
    if (page === "pos-attendance-history") {
      return (
        <AttendancePage
          initialTab="history"
          snapshot={snapshot}
          profile={profile}
          onRefresh={refresh}
        />
      );
    }
    if (page === "pos-attendance-shifts") {
      return (
        <AttendancePage
          initialTab="shifts"
          snapshot={snapshot}
          profile={profile}
          onRefresh={refresh}
        />
      );
    }
    if (page === "pos-orders" || page === "orders") {
      return <OrdersPage snapshot={snapshot} onRefresh={refresh} />;
    }
    if (page === "inventory") {
      return <InventoryManagement />;
    }
    if (page === "stock-opname") {
      return <StockOpnamePage />;
    }
    if (page === "waste") {
      return <WastePage />;
    }
    if (page === "suppliers") {
      return <SupplierManagementPage />;
    }
    if (page === "purchase-orders") {
      return <PurchaseOrderPage />;
    }
    if (page === "stock-transfer") {
      return <StockTransferPage />;
    }
    if (page === "customers") {
      return <CustomersPage snapshot={snapshot} />;
    }
    if (page === "analytics") {
      return <AnalyticsPage snapshot={snapshot} />;
    }
    if (page === "performance-menu") {
      return <PerformanceMenuPage />;
    }
    if (page === "insight-analytics") {
      return <InsightAnalyticsPage />;
    }
    if (page === "performance-outlet") {
      return <PerformanceOutletPage />;
    }
    if (page === "money-allocation") {
      return <MoneyAllocationPage snapshot={snapshot} onRefresh={refresh} />;
    }
    if (page === "language-settings") {
      return <LanguageSettingsPage />;
    }
    if (page === "profile") {
      return <ProfilePage profile={profile} snapshot={snapshot} onRefresh={refresh} />;
    }
    if (page === "staff") {
      return <StaffManagement />;
    }
    if (page === "outlets" || page === "outlet") {
      return <OutletManagement role={snapshot.role} snapshot={snapshot} onRefresh={refresh} />;
    }
    if (page === "business-profile") {
      return <BusinessProfilePage onRefresh={refresh} />;
    }
    if (page === "receipt-settings") {
      return <ReceiptSettingsPage />;
    }
    if (page === "menu") {
      return <MenuManagement />;
    }
    if (page === "printer-settings") {
      return <PrinterSettingsPage />;
    }
    if (page === "tax") {
      return <TaxSettingsPage />;
    }
    if (page === "payment") {
      return <PaymentSettingsPage />;
    }
    if (page === "integration") {
      return <IntegrationSettingsPage />;
    }
    if (page === "security") {
      return <SecuritySettingsPage />;
    }
    if (page === "change-password") {
      return <ChangePasswordPage />;
    }
    if (page === "login-activity") {
      return <LoginActivityPage />;
    }
    return <DashboardPage snapshot={snapshot} />;
  }, [page, snapshot, profile, activeCashierName]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="rounded-[2rem] border border-border bg-card/86 p-8 text-center shadow-float backdrop-blur-2xl">
          <Loader2 className="mx-auto size-7 animate-spin text-primary" />
          <p className="mt-4 font-bold">Menyiapkan command center KebabsChoicePOS...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-background" />
      <Header
        snapshot={snapshot}
        profile={profile}
        active={page}
        onSignOut={handleSignOut}
        onOpenThemeModal={openThemeModal}
        onOpenSearchModal={openSearchModal}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        isTabletFocusMode={isTabletFocusMode}
        onToggleTabletFocusMode={handleToggleTabletFocusMode}
        activeCashierName={activeCashierName}
        onOpenCashierSwitchModal={() => setIsCashierSwitchModalOpen(true)}
        onOpenBranchPosSwitchModal={() => setIsBranchPosModalOpen(true)}
      />
      <div className="flex w-full min-w-0">
        <Sidebar
          active={page}
          role={snapshot.role}
          snapshot={snapshot}
          profile={profile}
          onSignOut={handleSignOut}
          onOpenThemeModal={openThemeModal}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          activeCashierName={activeCashierName}
          onOpenCashierSwitchModal={() => setIsCashierSwitchModalOpen(true)}
          onOpenBranchPosSwitchModal={() => setIsBranchPosModalOpen(true)}
        />
        <section
          className={cn(
            "min-w-0 flex-1 w-full px-4 py-6 pb-28 lg:px-8 lg:pb-8 transition-all duration-300",
            isSidebarCollapsed && "lg:px-6",
          )}
        >
          {content}
        </section>
      </div>
      <MobileNav active={page} role={snapshot.role} />
      <ThemeModal isOpen={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        snapshot={snapshot}
        isPosMode={isPosMode}
      />
      <SwitchCashierModal
        isOpen={isCashierSwitchModalOpen}
        onClose={() => setIsCashierSwitchModalOpen(false)}
        outletId={snapshot.assignedOutletId || snapshot.outlets?.[0]?.id || undefined}
        currentCashierName={activeCashierName}
        onSelectCashier={handleSelectCashier}
      />
      <BranchPosSwitchModal
        isOpen={isBranchPosModalOpen}
        onClose={() => setIsBranchPosModalOpen(false)}
        outlets={snapshot.outlets || []}
        onSelectBranch={handleSelectBranchForPos}
      />
    </main>
  );
}
