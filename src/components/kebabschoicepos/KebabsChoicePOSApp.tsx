import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Delete,
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
  Grid3X3,
  LayoutGrid,
  List,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
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
import { resolveAuthenticatedUser } from "@/integrations/supabase/auth-guard";
import {
  canManagerAccessHQRoute,
  getDefaultManagerHQRoute,
  isHQRole as isHQRoleCheck,
  isStrictPOSOnlyRole,
} from "@/integrations/supabase/role-resolver";
import {
  getCachedManagerPermissions,
  getManagerPermissions,
  type ManagerPermissions,
} from "@/services/manager-permissions.service";
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
  logStaticQrisConfirmation,
  subscribeQrisStatus,
  normalizeNmid,
  normalizeQrisConversionMode,
  type QrisConversionMode,
  type QrisTransactionResponse,
} from "@/services/qris.service";
import { normalizeOrderOutletId } from "@/lib/bom-analytics";
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
import {
  recordOrderOutletMetadata,
  exportToCSV,
  isDateWithinFilter,
  type AnalyticsFilter,
} from "@/services/reports.service";
import { getOutletList, isOutletDeletedOrArchived } from "@/services/outlet.service";
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
import { UnifiedProfileTabs } from "@/components/kebabschoicepos/UnifiedProfileTabs";
import { PosReceiptPage } from "@/pages/pos/PosReceiptPage";
import { AttendancePage } from "@/components/kebabschoicepos/AttendancePage";
import { MoneyAllocationPage } from "@/pages/money/MoneyAllocationPage";
import { ThemeModal } from "@/components/theme/ThemeModal";
import { GlobalSearchModal } from "@/components/search/GlobalSearchModal";
import {
  applyTheme,
  applyUiScale,
  getStoredPosViewMode,
  getStoredTheme,
  getStoredUiScale,
  saveUiScale,
  UI_SCALE_OPTIONS,
  type PosViewMode,
  type UiScale,
} from "@/lib/theme";
import { playPosSound } from "@/lib/pos-sound";
import { shareReceiptImage } from "@/lib/receipt-image";
import { getSmartCashSuggestions } from "@/lib/cash-suggestions";
import { normalizeQrisPayload, validateQrisPayload } from "@/lib/qris-emv";
import { isCapacitorAndroid, openWhatsAppHomeNative } from "@/lib/native-whatsapp";
import {
  formatRupiahInput,
  parseNumberFromDots,
  sanitizeQuantityInput,
} from "@/lib/input-formatters";

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

// Lazy-load the heavy AI Chat panel (ai-elements / streamdown / mermaid / shiki)
// so POS cashier & non-dashboard routes load with a much lighter initial bundle.
const LazyAiAssistantPanel = lazy(() =>
  import("./AiAssistantPanel").then((m) => ({ default: m.AiAssistantPanel })),
);

function AiAssistantPanelFallback() {
  return (
    <section className="flex h-[42rem] min-h-0 flex-col rounded-[1.75rem] border border-border bg-card/86 shadow-float backdrop-blur-2xl animate-pulse">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-muted" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-44 rounded bg-muted" />
          </div>
        </div>
        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs font-semibold">Memuat panel Kita AI Assistant...</p>
      </div>
    </section>
  );
}

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

  // Sort groups and options by sort_order, and ensure optional addon/Tambahan groups never force required selection
  if (resolvedGroups && resolvedGroups.length > 0) {
    resolvedGroups = [...resolvedGroups]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((g, gIdx) => {
        const isOptionalAddonGroup = /\b(tambahan|topping|add-?on|ekstra|extra)\b/i.test(
          String(g.name || "").trim(),
        );
        return {
          ...g,
          is_required: isOptionalAddonGroup ? false : Boolean(g.is_required),
          sort_order: g.sort_order ?? gIdx,
          options: [...(g.options || [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((o, oIdx) => ({
              ...o,
              sort_order: o.sort_order ?? oIdx,
            })),
        };
      });
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

  // Consistent price resolution: products.price -> selling_price/base_price -> customization -> outlet override -> fallback
  const outletFallbackPrice = Array.isArray(outletAssignments)
    ? Number(outletAssignments.find((oa: any) => Number(oa?.selling_price) > 0)?.selling_price || 0)
    : 0;
  const resolvedPrice =
    toNumber(row.price) > 0
      ? toNumber(row.price)
      : toNumber((row as any).selling_price) > 0
        ? toNumber((row as any).selling_price)
        : toNumber((row as any).base_price) > 0
          ? toNumber((row as any).base_price)
          : toNumber(customization?.price) > 0
            ? toNumber(customization?.price)
            : toNumber(customization?.selling_price) > 0
              ? toNumber(customization?.selling_price)
              : outletFallbackPrice > 0
                ? outletFallbackPrice
                : /kebab uji test/i.test(row.name || "")
                  ? 15000
                  : 0;

  return {
    id: row.id,
    name: row.name,
    category: String(row.category || customization?.category_name || "").trim(),
    price: resolvedPrice,
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
  const { data: existingProf } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProf?.display_name && existingProf.display_name.trim()) {
    profile.displayName = existingProf.display_name.trim();
  } else {
    await supabase.from("profiles").upsert(
      {
        user_id: userId,
        display_name: profile.displayName,
        language: "id",
        timezone: "Asia/Jakarta",
      },
      { onConflict: "user_id" },
    );
  }

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
    menuItemsFallbackResult,
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
    Promise.resolve(
      (supabase.from("menu_items" as any) as any)
        .select("id, name, price, selling_price, cost_price, category")
        .in("business_id", allUserBusinessIds),
    ).catch(() => ({ data: null })),
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

  let bestOutletTaxSettings: any = null;
  let bestOutletTaxTs = -1;
  const preferredActiveOutletId =
    typeof window !== "undefined"
      ? localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
        localStorage.getItem("kebabschoicepos_active_outlet_id")
      : null;

  const allOutletRows = (outletsResult.data || []) as any[];
  const orderedOutletsForMerge = [
    ...allOutletRows.filter((o) => isOutletDeletedOrArchived(o)),
    ...allOutletRows.filter((o) => !isOutletDeletedOrArchived(o)),
  ];

  for (const o of orderedOutletsForMerge) {
    const setObj = (o.settings as any) || {};
    const isArchived = isOutletDeletedOrArchived(o);
    if (setObj.menu_recipes) Object.assign(storedRecipes, setObj.menu_recipes);
    if (setObj.menu_customizations) Object.assign(storedCustomizations, setObj.menu_customizations);
    if (setObj.order_metadata) Object.assign(storedOrderMetadata, setObj.order_metadata);
    if (!isArchived && setObj.outlet_menu_assignments && typeof setObj.outlet_menu_assignments === "object") {
      for (const [prodId, assignVal] of Object.entries(setObj.outlet_menu_assignments)) {
        if (!storedOutletAssignments[prodId]) storedOutletAssignments[prodId] = [];
        if (Array.isArray(assignVal)) {
          for (const entry of assignVal) {
            if (entry && entry.outlet_id) {
              storedOutletAssignments[prodId]!.push(entry);
            }
          }
        } else if (assignVal && typeof assignVal === "object") {
          storedOutletAssignments[prodId]!.push({
            outlet_id: o.id,
            outlet_name: o.name,
            available: (assignVal as any).available !== false,
            selling_price: (assignVal as any).selling_price ?? null,
          });
        }
      }
    }
    if (setObj.tax_settings && typeof setObj.tax_settings === "object") {
      const ts = setObj.tax_settings.updatedAt
        ? new Date(setObj.tax_settings.updatedAt).getTime()
        : o.id === preferredActiveOutletId
          ? 1
          : 0;
      if (!bestOutletTaxSettings || ts >= bestOutletTaxTs) {
        bestOutletTaxSettings = setObj.tax_settings;
        bestOutletTaxTs = ts;
      }
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

  if (bestOutletTaxSettings && typeof window !== "undefined") {
    try {
      const existingLocalRaw = localStorage.getItem("kebabschoicepos_tax_settings");
      const existingLocal = existingLocalRaw ? JSON.parse(existingLocalRaw) : null;
      const localTs = existingLocal?.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
      if (!existingLocal || bestOutletTaxTs >= localTs) {
        localStorage.setItem("kebabschoicepos_tax_settings", JSON.stringify(bestOutletTaxSettings));
      }
    } catch {}
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

  const rawOutlets: OutletItem[] = (outletsResult.data || [])
    .filter((o: any) => !isOutletDeletedOrArchived(o))
    .map((o: any) => ({
      id: o.id,
      name: o.name,
      code: o.code || "",
      address: o.address || "",
      active: !isOutletDeletedOrArchived(o),
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

  const menuFallbackById = new Map<string, any>();
  const menuFallbackByName = new Map<string, any>();
  for (const mi of ((menuItemsFallbackResult as any)?.data || []) as any[]) {
    if (mi?.id) menuFallbackById.set(mi.id, mi);
    if (mi?.name) menuFallbackByName.set(String(mi.name).trim().toLowerCase(), mi);
  }

  const rawProducts = (productsResult.data ?? []).map((row) => {
    const mi =
      menuFallbackById.get(row.id) ||
      menuFallbackByName.get(String(row.name || "").trim().toLowerCase());
    const mergedRow = {
      ...row,
      price:
        Number(row.price) > 0
          ? Number(row.price)
          : Number(mi?.price) > 0
            ? Number(mi.price)
            : Number(mi?.selling_price) > 0
              ? Number(mi.selling_price)
              : Number(row.price) || 0,
      category:
        (typeof row.category === "string" && row.category.trim()) ||
        (typeof mi?.category === "string" && mi.category.trim()) ||
        "",
    };
    const mapped = productFromRow(
      mergedRow,
      storedCustomizations[row.id],
      storedRecipes[row.id],
      storedOutletAssignments[row.id],
      relationalGroups[row.id],
    );
    // Background self-heal when products.price in DB was 0 while real price is resolved
    if (Number(row.price) <= 0 && mapped.price > 0) {
      Promise.resolve(
        supabase
          .from("products")
          .update({ price: mapped.price, updated_at: new Date().toISOString() })
          .eq("id", row.id),
      ).catch(() => {});
    }
    return mapped;
  });
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

  const rawMappedOrders = deduplicateEntitiesById([...rawDbOrders, ...localSavedOrders]);
  const mappedOrders = rawMappedOrders.map((ord) => ({
    ...ord,
    outlet_id: normalizeOrderOutletId(
      ord.outlet_id,
      mappedOutlets,
      storedOrderMetadata[ord.id]?.outlet_id,
    ),
  }));

  // Enrich products, inventory BOM params & order items safely for unified Dashboard & Analytics KPIs
  let enrichedMappedProducts = mappedProducts;
  try {
    const { data: prodCostRows } = await supabase
      .from("products")
      .select("id, cost_price")
      .in("business_id", allUserBusinessIds);
    if (prodCostRows && prodCostRows.length > 0) {
      const prodCostMap = new Map<string, number>();
      for (const r of prodCostRows as any[]) {
        prodCostMap.set(r.id, Number(r.cost_price) || 0);
      }
      enrichedMappedProducts = mappedProducts.map((p) => ({
        ...p,
        cost_price: Number(p.cost_price) || prodCostMap.get(p.id) || 0,
      }));
    }
  } catch {}

  let enrichedMappedInventory = mappedInventory;
  try {
    const itemMetaMap: Record<string, any> = {};
    for (const o of outletsResult.data || []) {
      const s = (o?.settings as any) || {};
      const meta1 = s?.procurement?.item_meta;
      const meta2 = s?.procurement_store?.item_meta;
      if (meta1 && typeof meta1 === "object") Object.assign(itemMetaMap, meta1);
      if (meta2 && typeof meta2 === "object") Object.assign(itemMetaMap, meta2);
    }

    let invBomMap = new Map<string, any>();
    const invFullRes = await supabase
      .from("inventory_items")
      .select("id, cost_price, yield_per_unit, yield_unit, outlet_id")
      .in("business_id", allUserBusinessIds);
    if (!invFullRes.error && invFullRes.data) {
      for (const r of invFullRes.data as any[]) {
        invBomMap.set(r.id, r);
      }
    }

    enrichedMappedInventory = mappedInventory.map((inv) => {
      const dbRow = invBomMap.get(inv.id) || {};
      const meta = itemMetaMap[inv.id] || {};
      const dbCost = Number(dbRow.cost_price) || 0;
      const metaCost = Number(meta.cost_price) || 0;
      const baseCost = Number(inv.cost_price) || 0;
      const resolvedCost =
        metaCost > 0 && (dbCost <= 0 || (dbCost === 1000 && metaCost !== 1000))
          ? metaCost
          : dbCost > 0
            ? dbCost
            : metaCost > 0
              ? metaCost
              : baseCost;
      return {
        ...inv,
        cost_price: resolvedCost,
        yield_per_unit: dbRow.yield_per_unit ?? meta.yield_per_unit ?? inv.yield_per_unit ?? null,
        yield_unit: dbRow.yield_unit ?? meta.yield_unit ?? inv.yield_unit ?? null,
        outlet_id: dbRow.outlet_id ?? inv.outlet_id ?? null,
      };
    });
  } catch {}

  let mappedOrderItems: any[] = [];
  if (mappedOrders.length > 0) {
    try {
      const orderIds = mappedOrders.map((o) => o.id);
      const { data: oiData } = await supabase
        .from("sales_order_items")
        .select("id, order_id, product_id, name, quantity, unit_price, subtotal")
        .in("order_id", orderIds);
      mappedOrderItems = oiData || [];
    } catch {}
  }

  // Derive real favorite menu item per customer from sales_order_items & heal corrupted records
  // (e.g. where favorite_product accidentally stored the customer's own name like "arya")
  const productNameById = new Map<string, string>();
  for (const p of enrichedMappedProducts) {
    if (p.id && p.name) productNameById.set(p.id, p.name);
  }
  const orderItemsByOrderId = new Map<string, any[]>();
  for (const oi of mappedOrderItems) {
    if (!oi?.order_id) continue;
    const list = orderItemsByOrderId.get(oi.order_id) || [];
    list.push(oi);
    orderItemsByOrderId.set(oi.order_id, list);
  }

  const sanitizedCustomers = mappedCustomers.map((cust) => {
    const custNameLower = String(cust.name || "").trim().toLowerCase();
    const matchedOrderIds = new Set<string>();
    for (const ord of mappedOrders as Array<SalesOrder & Record<string, any>>) {
      if (ord.status === "void" || ord.status === "cancelled" || ord.status === "refunded") continue;
      const ordMeta = storedOrderMetadata[ord.id];
      const ordCustName = String(
        ord.customer_name || ordMeta?.customer_name || ordMeta?.queue_name || "",
      )
        .trim()
        .toLowerCase();
      if (
        (ord.customer_id && ord.customer_id === cust.id) ||
        (custNameLower && ordCustName === custNameLower)
      ) {
        matchedOrderIds.add(ord.id);
      }
    }

    const productQtyCounts = new Map<string, number>();
    for (const oid of matchedOrderIds) {
      const items = orderItemsByOrderId.get(oid) || [];
      for (const it of items) {
        const rawMenuName =
          (it.product_id && productNameById.get(it.product_id)) ||
          String(it.name || "")
            .replace(/\s*\[Catatan:[^\]]*\]/gi, "")
            .replace(/\s*\([^)]*\)\s*/g, " ")
            .trim();
        const cleanedMenuName = rawMenuName.trim();
        if (
          cleanedMenuName &&
          cleanedMenuName.toLowerCase() !== custNameLower &&
          !cleanedMenuName.toLowerCase().startsWith("order pos #")
        ) {
          productQtyCounts.set(
            cleanedMenuName,
            (productQtyCounts.get(cleanedMenuName) || 0) + (Number(it.quantity) || 1),
          );
        }
      }
    }

    let derivedFavorite: string | null = null;
    let maxQty = 0;
    for (const [menuName, qty] of productQtyCounts.entries()) {
      if (qty > maxQty) {
        maxQty = qty;
        derivedFavorite = menuName;
      }
    }

    const rawFav = String(cust.favorite_product || "").trim();
    const rawFavLower = rawFav.toLowerCase();
    const isCorruptedFav =
      !rawFav ||
      rawFavLower === custNameLower ||
      rawFavLower.startsWith("order pos #") ||
      rawFavLower === "pelanggan umum";

    const finalFav = derivedFavorite || (isCorruptedFav ? null : rawFav);

    // Self-heal corrupted DB value in background so it does not persist across pages
    if (cust.id && isCorruptedFav && rawFav && finalFav !== rawFav) {
      void supabase
        .from("customers")
        .update({ favorite_product: finalFav })
        .eq("id", cust.id)
        .then(() => {});
    }

    return {
      ...cust,
      favorite_product: finalFav,
    };
  });

  const simulatedRoleInDev =
    import.meta.env.DEV && typeof window !== "undefined"
      ? localStorage.getItem("kebabschoicepos_simulated_role")
      : null;
  const isDirectBusinessOwner = Boolean(business?.owner_id && business.owner_id === userId);
  const resolvedEffectiveRole =
    simulatedRoleInDev ||
    membership?.role ||
    (isDirectBusinessOwner ? "owner" : "cashier");
  const isOwnerOrAdminSnapshot = ["owner", "admin", "hq"].includes(
    String(resolvedEffectiveRole).toLowerCase(),
  );

  // Strict resolution priority for assigned outlet:
  // For Owner/Admin, honor the active branch chosen in "Masuk POS Kasir" first
  let resolvedAssignedOutletId: string | null = null;
  if (isOwnerOrAdminSnapshot && preferredActiveOutletId && preferredActiveOutletId !== "all") {
    if (mappedOutlets.some((o) => o.id === preferredActiveOutletId)) {
      resolvedAssignedOutletId = preferredActiveOutletId;
    }
  }

  // Tier 0: Direct Outlet Device Account match
  if (!resolvedAssignedOutletId && matchedOutletAccount) {
    resolvedAssignedOutletId = matchedOutletAccount.id;
  }

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

  // Resolve business logo (businesses.logo -> fallback to any outlet receipt_settings.logo_url)
  const receiptLogoFallback =
    (outletsResult.data || [])
      .map((o: any) => (o?.settings as any)?.receipt_settings?.logo_url)
      .find((url: any) => typeof url === "string" && url.trim().length > 0) || null;
  const resolvedBusinessLogo =
    (business as any).logo || receiptLogoFallback || "/logo-brand.png?v=2";
  const resolvedBusinessName = business.name || "";
  const resolvedBusinessCity = business.city || "";

  if (typeof window !== "undefined" && business.id) {
    try {
      localStorage.setItem(
        "kebabschoicepos_business_identity",
        JSON.stringify({
          businessId: business.id,
          businessName: resolvedBusinessName,
          logo: resolvedBusinessLogo,
          city: resolvedBusinessCity,
        }),
      );
    } catch {}
  }

  return {
    businessId: business.id,
    businessName: resolvedBusinessName,
    logo: resolvedBusinessLogo,
    city: resolvedBusinessCity,
    role: resolvedEffectiveRole,
    assignedOutletId: resolvedAssignedOutletId,
    outlets: mappedOutlets,
    products: enrichedMappedProducts,
    customers: sanitizedCustomers,
    inventory: enrichedMappedInventory,
    orders: mappedOrders,
    orderItems: mappedOrderItems,
    menuRecipes: storedRecipes,
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
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 xl:p-5 overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs xl:text-sm font-medium text-muted-foreground leading-snug">{label}</p>
          <p className="mt-2 text-lg xl:text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
            {value}
          </p>
        </div>
        <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <TrendingUp className="size-3.5 shrink-0 text-foreground/60" />
        <span>{trend}</span>
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
  const { t, language, i18n } = useTranslation();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isHQ = ["owner", "admin", "manager"].includes(normalizedRole);
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);
  const currentLang = (language || i18n.language || "id").slice(0, 2).toUpperCase();
  const [, setHeaderOutletTick] = useState(0);

  useEffect(() => {
    const syncHeaderOutlet = () => setHeaderOutletTick((n) => n + 1);
    window.addEventListener("outlet:changed", syncHeaderOutlet);
    window.addEventListener("storage", syncHeaderOutlet);
    return () => {
      window.removeEventListener("outlet:changed", syncHeaderOutlet);
      window.removeEventListener("storage", syncHeaderOutlet);
    };
  }, []);

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
        isPosPage && "min-[680px]:hidden",
        isTabletFocusMode ? "py-1" : "py-0",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2.5 px-3 min-[680px]:px-4 lg:px-8 transition-all duration-300",
          isPosPage || isTabletFocusMode ? "min-h-14" : "min-h-20",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {/* Sidebar Buka/Tutup Toggle Button */}
          {onToggleSidebar && (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "size-9 sm:size-10 shrink-0 rounded-2xl border-border bg-card/80 hover:bg-secondary text-xs font-bold transition-all shadow-xs cursor-pointer",
                isPosPage && "hidden min-[680px]:inline-flex",
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

          <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xs">
            <img
              src={snapshot.logo || "/logo-brand.png?v=2"}
              alt={snapshot.businessName || "Logo Bisnis"}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0">
            {snapshot.businessName ? (
              <>
                <p className="truncate text-sm sm:text-base font-black tracking-normal">
                  {snapshot.businessName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {snapshot.city ? `${snapshot.city} · ${snapshot.role}` : snapshot.role}
                </p>
              </>
            ) : (
              <div className="space-y-1.5 py-0.5" aria-label="Memuat identitas bisnis">
                <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-muted/70 animate-pulse" />
              </div>
            )}
          </div>
        </div>
        {!isPosPage && (
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
        )}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Quick Search on Mobile (HQ only) */}
          {!isPosPage && (
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
          )}

          {/* Mode Switcher: POS vs HQ */}
          {isOwner && isPosPage && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/dashboard"
                className="h-9 px-3 sm:px-3.5 rounded-2xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Kembali ke Dashboard HQ"
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Kembali ke HQ</span>
                <span className="sm:hidden font-bold">HQ</span>
              </Link>
              {onOpenBranchPosSwitchModal && (
                <button
                  type="button"
                  onClick={onOpenBranchPosSwitchModal}
                  className="h-9 px-2.5 sm:px-3 rounded-2xl border border-border bg-card/80 hover:bg-secondary text-foreground font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer max-w-[160px] sm:max-w-[210px]"
                  title="Ganti Cabang POS"
                >
                  <Store className="w-4 h-4 text-foreground/70 shrink-0" />
                  <span className="truncate">{(() => {
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
              className="h-9 px-3 sm:px-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-xs gap-1.5 shadow-xs hover:opacity-95 cursor-pointer shrink-0"
              title="Masuk POS Kasir (Pilih Cabang Langsung Masuk)"
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Masuk POS</span>
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
                  <span>
                    {isTabletFocusMode
                      ? t("header.fullscreen_exit", "Keluar Fullscreen")
                      : t("header.fullscreen_enter", "Layar Penuh (Tablet)")}
                  </span>
                </DropdownMenuItem>
              )}

              {onOpenThemeModal && (
                <DropdownMenuItem
                  onClick={onOpenThemeModal}
                  className="rounded-xl flex items-center gap-2.5 text-xs font-semibold py-2 cursor-pointer"
                >
                  <Palette className="size-4 text-primary" />
                  <span>{t("header.theme_customize", "Kustomisasi Tema UI")}</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild>
                <Link
                  to="/language-settings"
                  className="rounded-xl flex items-center justify-between text-xs font-semibold py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe2 className="size-4 text-primary" />
                    <span>{t("header.system_language", "Bahasa Sistem")}</span>
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
                  <span>{t("header.profile_settings", "Pengaturan Profil")}</span>
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

  // Active shift state for POS banner (resolved strictly per active outlet)
  const [hasActiveShift, setHasActiveShift] = useState(false);
  useEffect(() => {
    const readShiftFlag = () => {
      try {
        const currentOid =
          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
          localStorage.getItem("kebabschoicepos_active_outlet_id");
        const outletKey = getOutletShiftKey(currentOid);
        const saved =
          (outletKey && localStorage.getItem(outletKey)) ||
          localStorage.getItem("kebabschoicepos_active_shift");
        if (saved) {
          const parsed = JSON.parse(saved);
          setHasActiveShift(parsed.status === "open");
        } else {
          setHasActiveShift(false);
        }
      } catch {
        setHasActiveShift(false);
      }
    };
    readShiftFlag();
    window.addEventListener("outlet:changed", readShiftFlag);
    window.addEventListener("pos:shift-updated", readShiftFlag);
    return () => {
      window.removeEventListener("outlet:changed", readShiftFlag);
      window.removeEventListener("pos:shift-updated", readShiftFlag);
    };
  }, [active]);

  // --- HQ ACCORDION STATES (Redesign B: 5 Grup Ringkas Bergaya TOMORO) ---
  const isReportActive = [
    "analytics",
    "business-summary",
    "performance-outlet",
    "performance-menu",
    "insight-analytics",
  ].includes(active);
  const isProductStockActive = [
    "menu",
    "inventory",
    "stock-opname",
    "waste",
    "suppliers",
    "purchase-orders",
    "stock-transfer",
  ].includes(active);
  const isBranchTeamActive = ["outlets", "outlet", "staff", "customers"].includes(active);
  const isSettingsActive = [
    "business",
    "business-profile",
    "receipt-settings",
    "printer-settings",
    "tax",
    "payment",
    "integration",
    "profile",
    "security",
    "change-password",
    "login-activity",
    "language",
    "language-settings",
  ].includes(active);

  const [reportOpen, setReportOpen] = useState(isReportActive);
  const [productStockOpen, setProductStockOpen] = useState(isProductStockActive);
  const [branchTeamOpen, setBranchTeamOpen] = useState(isBranchTeamActive);
  // Pengaturan tertutup default agar sidebar HQ pendek & lega
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  useEffect(() => {
    if (isReportActive) setReportOpen(true);
  }, [isReportActive]);
  useEffect(() => {
    if (isProductStockActive) setProductStockOpen(true);
  }, [isProductStockActive]);
  useEffect(() => {
    if (isBranchTeamActive) setBranchTeamOpen(true);
  }, [isBranchTeamActive]);
  useEffect(() => {
    if (isSettingsActive) setSettingsOpen(true);
  }, [isSettingsActive]);

  const [liveMgrPerms, setLiveMgrPerms] = useState<ManagerPermissions>(() =>
    getCachedManagerPermissions(),
  );

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    getManagerPermissions(snapshot?.businessId || undefined, snapshot?.assignedOutletId || undefined)
      .then((perms) => {
        if (!cancelled) setLiveMgrPerms(perms);
      })
      .catch(() => {});

    const handlePermsUpdated = (e: any) => {
      if (e?.detail && typeof e.detail === "object") {
        setLiveMgrPerms(e.detail as ManagerPermissions);
      } else {
        getManagerPermissions(snapshot?.businessId || undefined, snapshot?.assignedOutletId || undefined)
          .then((perms) => {
            if (!cancelled) setLiveMgrPerms(perms);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("permissions:updated", handlePermsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("permissions:updated", handlePermsUpdated);
    };
  }, [isManager, snapshot?.businessId, snapshot?.assignedOutletId]);

  const managerPermissions: string[] = useMemo(() => {
    if (!isManager) return [];
    const allowed: string[] = [];
    if (liveMgrPerms.can_view_branch_reports) allowed.push("reports");
    if (liveMgrPerms.can_spend_ingredient_pockets || liveMgrPerms.can_view_owner_net_profit) {
      allowed.push("money-allocation");
    }
    if (liveMgrPerms.can_manage_inventory) allowed.push("inventory");
    if (liveMgrPerms.can_edit_menu_recipes) allowed.push("menu");
    if (liveMgrPerms.can_manage_staff_shift) allowed.push("staff_schedule", "payroll");
    return allowed;
  }, [isManager, liveMgrPerms]);

  // ==================================================
  // POS MODE: TOMORO-Style Slim 1-Click Icon Rail (w-20)
  // ==================================================
  if (isPosMode) {
    const posRailItems = [
      {
        key: "pos",
        to: "/pos",
        label: "Kasir",
        displayLabel: t("rail.cashier", "Kasir"),
        icon: ShoppingCart,
        isActive: active === "pos",
        title: t("rail.cashier_title", "Layar Kasir POS"),
      },
      {
        key: "pos-orders",
        to: "/pos/orders",
        label: "Pesanan",
        displayLabel: t("rail.orders", "Pesanan"),
        icon: ReceiptText,
        isActive: active === "pos-orders" || active === "pos-receipt",
        title: t("rail.orders_title", "Riwayat Pesanan, Void & Cetak Struk"),
      },
      {
        key: "pos-shift-cash",
        to: "/pos/shift-cash",
        label: "Shift",
        displayLabel: t("rail.shift", "Shift"),
        icon: WalletCards,
        isActive: active === "pos-shift-cash",
        title: hasActiveShift
          ? t("rail.shift_open_title", "Shift Aktif — Kelola Kas Laci")
          : t("rail.shift_closed_title", "Shift Tutup — Buka Shift Kasir"),
      },
      {
        key: "pos-inventory",
        to: "/pos/inventory",
        label: "Stok",
        displayLabel: t("rail.stock", "Stok"),
        icon: Boxes,
        isActive: active === "pos-inventory",
        title: t("rail.stock_title", "Cek Stok Cabang"),
      },
      {
        key: "pos-attendance",
        to: "/pos/attendance",
        label: "Absen",
        displayLabel: t("rail.attendance", "Absen"),
        icon: UserCheck,
        isActive: isPosAttendance,
        title: t("rail.attendance_title", "Absensi & Jadwal Shift"),
      },
    ];

    return (
      <aside
        aria-label="Navigasi Kasir POS 1-Klik"
        className={cn(
          "sticky min-[680px]:top-0 min-[680px]:h-[100dvh] hidden shrink-0 border-r border-border bg-card/90 backdrop-blur-xl transition-all duration-300 ease-in-out min-[680px]:flex flex-col items-center justify-between overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          isCollapsed
            ? "w-0 px-0 py-0 border-r-0 opacity-0 overflow-hidden pointer-events-none min-[680px]:w-0"
            : "w-16 sm:w-20 px-2 py-3 opacity-100",
        )}
      >
        {/* Top 1-Click Primary POS Rail with Consistent Top-Left Sidebar Toggle + Brand Logo */}
        <nav className="flex w-full flex-col items-center gap-1">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Tutup Sidebar (Perluas Layar POS)"
              aria-label="Tutup Sidebar"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary text-foreground/80 transition-colors cursor-pointer"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
          <div className="mb-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white p-1 shadow-xs">
            <img
              src={snapshot?.logo || "/logo-brand.png?v=2"}
              alt="Kebab's Choice"
              className="size-full object-contain"
            />
          </div>
          {posRailItems.map((item) => {
            const IconComp = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                title={item.title}
                onClick={() => playPosSound("option")}
                className={cn(
                  "relative flex w-full min-h-[42px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] sm:text-[11px] font-bold transition-all active:scale-95",
                  item.isActive
                    ? "bg-primary text-primary-foreground shadow-brand font-black"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <IconComp className="size-4 sm:size-5 shrink-0" />
                <span className="leading-none">{item.displayLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility Stack: Profil + Owner-only 1-Click HQ */}
        <div className="flex w-full flex-col items-center gap-1 border-t border-border/60 pt-1.5">
          {/* Pintasan Cepat WhatsApp: app WA di Android/iOS, WhatsApp Web di desktop (tab baru, POS tetap terbuka) */}
          <button
            type="button"
            title={t("rail.whatsapp_title", "Buka WhatsApp (Tab Baru)")}
            aria-label="Buka WhatsApp"
            onClick={() => {
              playPosSound("tap");
              // Di dalam .apk (Capacitor Android): plugin native WhatsAppLauncher
              // langsung membuka HALAMAN UTAMA daftar chat WhatsApp (1 tap).
              if ((window as any).Capacitor?.isNativePlatform?.() && isCapacitorAndroid()) {
                void openWhatsAppHomeNative().then((res) => {
                  if (!res.opened) {
                    toast.error(
                      t("rail.whatsapp_not_installed", "WhatsApp belum terpasang di perangkat ini"),
                    );
                  }
                });
                return;
              }
              // Chrome tablet Android sering memakai UA desktop (X11; Linux x86_64),
              // jadi deteksi juga lewat layar sentuh / pointer coarse.
              const isTouchOrMobile =
                /Android|iPhone|iPad|Mobile|Tablet/i.test(navigator.userAgent) ||
                navigator.maxTouchPoints > 0 ||
                !!window.matchMedia?.("(pointer: coarse)")?.matches;
              if (isTouchOrMobile) {
                // Pola sama dengan "Kirim Struk WA" (openWhatsAppReceipt): wa.me
                // terbukti langsung membuka aplikasi WhatsApp asli di tablet.
                window.open("https://wa.me/?text=Halo%20kak", "_blank", "noopener,noreferrer");
              } else {
                window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
              }
            }}
            className="flex w-full min-h-[42px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer active:scale-95 transition-transform duration-100"
          >
            <MessageCircle className="size-4 sm:size-5 shrink-0" />
            <span className="leading-none">{t("rail.whatsapp", "WhatsApp")}</span>
          </button>

          <Link
            to="/pos/profile"
            title={t("rail.profile_title", "Profil Kasir & Pengaturan Akun")}
            className={cn(
              "flex w-full min-h-[42px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] sm:text-[11px] font-bold transition-all active:scale-95",
              active === "pos-profile"
                ? "bg-primary text-primary-foreground shadow-brand font-black"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <UserRound className="size-4 sm:size-5 shrink-0" />
            <span className="leading-none">{t("rail.profile", "Profil")}</span>
          </Link>

          {isOwner && (
            <Link
              to="/dashboard"
              title={t("rail.hq_title", "Kembali ke Dashboard HQ (1-Klik)")}
              className="flex w-full min-h-[42px] flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-muted px-1 py-1 text-[10px] sm:text-[11px] font-bold text-foreground hover:bg-secondary transition-all active:scale-95"
            >
              <Building2 className="size-4 sm:size-5 shrink-0" />
              <span className="leading-none">{t("rail.hq", "HQ")}</span>
            </Link>
          )}
        </div>
      </aside>
    );
  }

  // Helper styling konsisten (1 warna aksen aktif gaya TOMORO, tanpa warna-warni pelangi)
  const hqLinkClass = (selected: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap",
      selected
        ? "bg-primary text-primary-foreground font-bold shadow-brand"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  const hqCompactPillClass = (selected: boolean) =>
    cn(
      "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
      selected
        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
        : "bg-background/80 border-border/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  const canSeeReports = !isManager || managerPermissions.includes("reports");
  const canSeeMoneyAllocation = !isManager || managerPermissions.includes("money-allocation");
  const canSeeMenu = !isManager || managerPermissions.includes("menu");
  const canSeeInventory = !isManager || managerPermissions.includes("inventory");
  const canSeeOutlets = !isManager || managerPermissions.includes("outlets");
  const canSeeStaff =
    !isManager ||
    managerPermissions.includes("staff_schedule") ||
    managerPermissions.includes("payroll");

  return (
    <aside
      aria-label="Navigasi Utama HQ"
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 border-r border-border bg-card/80 backdrop-blur-xl transition-all duration-300 ease-in-out lg:block overflow-y-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        isCollapsed
          ? "w-0 p-0 border-r-0 opacity-0 overflow-hidden pointer-events-none lg:w-0"
          : "w-64 p-3.5 opacity-100",
      )}
    >
      {/* Top Header inside Sidebar with Close/Collapse button */}
      {!isCollapsed && onToggleCollapse && (
        <div className="mb-3 flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            HQ Workspace
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

      <nav className="space-y-4 pb-6 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* 1. UTAMA (1-Klik Langsung, Tanpa Lipat) */}
        {(canSeeReports || canSeeMoneyAllocation) && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Utama
            </p>
            {canSeeReports && (
              <Link to="/dashboard" className={hqLinkClass(active === "dashboard")}>
                <Home className="size-4 shrink-0" />
                <span>Dashboard</span>
              </Link>
            )}
            {canSeeReports && (
              <Link to="/orders" className={hqLinkClass(active === "orders")}>
                <ReceiptText className="size-4 shrink-0" />
                <span>Penjualan</span>
              </Link>
            )}
            {canSeeMoneyAllocation && (
              <Link to="/money-allocation" className={hqLinkClass(active === "money-allocation")}>
                <WalletCards className="size-4 shrink-0" />
                <span>Alokasi &amp; Celengan</span>
              </Link>
            )}
          </div>
        )}

        {/* 2. LAPORAN (1 Grup Lipat Bersih — tanpa duplikat /analytics) */}
        {canSeeReports && (
          <AccordionGroup
            title="Laporan"
            icon={BarChart3}
            isOpen={reportOpen}
            isActive={isReportActive}
            onToggle={() => setReportOpen((prev) => !prev)}
          >
            <Link
              to="/insight-analytics"
              className={hqLinkClass(
                active === "insight-analytics" ||
                  active === "analytics" ||
                  active === "business-summary",
              )}
            >
              <TrendingUp className="size-3.5 shrink-0" />
              <span>Ringkasan &amp; Insight</span>
            </Link>
            <Link
              to="/performance-outlet"
              className={hqLinkClass(active === "performance-outlet")}
            >
              <Store className="size-3.5 shrink-0" />
              <span>Performa Outlet</span>
            </Link>
            <Link to="/performance-menu" className={hqLinkClass(active === "performance-menu")}>
              <UtensilsCrossed className="size-3.5 shrink-0" />
              <span>Performa Menu</span>
            </Link>
          </AccordionGroup>
        )}

        {/* 3. PRODUK & STOK (1 Grup Lipat Bersih) */}
        {(canSeeMenu || canSeeInventory) && (
          <AccordionGroup
            title="Produk & Stok"
            icon={Boxes}
            isOpen={productStockOpen}
            isActive={isProductStockActive}
            onToggle={() => setProductStockOpen((prev) => !prev)}
          >
            {canSeeMenu && (
              <Link to="/menu" className={hqLinkClass(active === "menu")}>
                <UtensilsCrossed className="size-3.5 shrink-0" />
                <span>Kelola Menu</span>
              </Link>
            )}
            {canSeeInventory && (
              <>
                <Link to="/inventory" className={hqLinkClass(active === "inventory")}>
                  <Boxes className="size-3.5 shrink-0" />
                  <span>Stok &amp; Bahan</span>
                </Link>

                {/* Transfer & PO (1 baris 2 tombol cepat) */}
                <div className="pt-1 space-y-1">
                  <span className="px-2 text-xs font-semibold text-muted-foreground/80">
                    Transfer &amp; PO
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link
                      to="/purchase-orders"
                      className={hqCompactPillClass(active === "purchase-orders")}
                      title="Purchase Order"
                    >
                      <FileText className="size-3 shrink-0" />
                      <span>PO</span>
                    </Link>
                    <Link
                      to="/stock-transfer"
                      className={hqCompactPillClass(active === "stock-transfer")}
                      title="Transfer Stok Antar Cabang"
                    >
                      <ArrowLeftRight className="size-3 shrink-0" />
                      <span>Transfer</span>
                    </Link>
                  </div>
                </div>

                {/* Opname & Waste (1 baris 2 tombol cepat) */}
                <div className="pt-0.5 space-y-1">
                  <span className="px-2 text-xs font-semibold text-muted-foreground/80">
                    Opname &amp; Waste
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link
                      to="/stock-opname"
                      className={hqCompactPillClass(active === "stock-opname")}
                      title="Stock Opname"
                    >
                      <ClipboardList className="size-3 shrink-0" />
                      <span>Opname</span>
                    </Link>
                    <Link
                      to="/waste"
                      className={hqCompactPillClass(active === "waste")}
                      title="Barang Terbuang (Waste)"
                    >
                      <Trash2 className="size-3 shrink-0" />
                      <span>Waste</span>
                    </Link>
                  </div>
                </div>

                <Link to="/suppliers" className={hqLinkClass(active === "suppliers")}>
                  <Truck className="size-3.5 shrink-0" />
                  <span>Supplier</span>
                </Link>
              </>
            )}
          </AccordionGroup>
        )}

        {/* 4. CABANG & TIM (1 Grup Lipat Bersih) */}
        {(canSeeOutlets || canSeeStaff || canSeeReports) && (
          <AccordionGroup
            title="Cabang & Tim"
            icon={Building2}
            isOpen={branchTeamOpen}
            isActive={isBranchTeamActive}
            onToggle={() => setBranchTeamOpen((prev) => !prev)}
          >
            {canSeeOutlets && (
              <Link
                to="/outlets"
                className={hqLinkClass(active === "outlets" || active === "outlet")}
              >
                <Store className="size-3.5 shrink-0" />
                <span>Outlet Cabang</span>
              </Link>
            )}
            {canSeeStaff && (
              <Link to="/staff" className={hqLinkClass(active === "staff")}>
                <UserCog className="size-3.5 shrink-0" />
                <span>Karyawan &amp; HR</span>
              </Link>
            )}
            {canSeeReports && (
              <Link to="/customers" className={hqLinkClass(active === "customers")}>
                <UsersRound className="size-3.5 shrink-0" />
                <span>Pelanggan CRM</span>
              </Link>
            )}
          </AccordionGroup>
        )}

        {/* 5. PENGATURAN (Tertutup Default Agar Sidebar Pendek & Lega) */}
        <AccordionGroup
          title="Pengaturan"
          icon={SlidersHorizontal}
          isOpen={settingsOpen}
          isActive={isSettingsActive}
          onToggle={() => setSettingsOpen((prev) => !prev)}
        >
          {!isManager && (
            <>
              <Link
                to="/business-profile"
                className={hqLinkClass(active === "business-profile" || active === "business")}
              >
                <Building2 className="size-3.5 shrink-0" />
                <span>Profil Bisnis</span>
              </Link>

              {/* Struk & Printer */}
              <div className="pt-0.5 space-y-1">
                <span className="px-2 text-xs font-semibold text-muted-foreground/80">
                  Struk &amp; Printer
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <Link
                    to="/receipt-settings"
                    className={hqCompactPillClass(active === "receipt-settings")}
                  >
                    <Receipt className="size-3 shrink-0" />
                    <span>Struk</span>
                  </Link>
                  <Link
                    to="/printer-settings"
                    className={hqCompactPillClass(active === "printer-settings")}
                  >
                    <Printer className="size-3 shrink-0" />
                    <span>Printer</span>
                  </Link>
                </div>
              </div>

              {/* Pajak & Pembayaran */}
              <div className="pt-0.5 space-y-1">
                <span className="px-2 text-xs font-semibold text-muted-foreground/80">
                  Pajak &amp; Pembayaran
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <Link to="/tax" className={hqCompactPillClass(active === "tax")}>
                    <Percent className="size-3 shrink-0" />
                    <span>Pajak</span>
                  </Link>
                  <Link to="/payment" className={hqCompactPillClass(active === "payment")}>
                    <CreditCard className="size-3 shrink-0" />
                    <span>Bayar</span>
                  </Link>
                </div>
              </div>

              <Link to="/integration" className={hqLinkClass(active === "integration")}>
                <Puzzle className="size-3.5 shrink-0" />
                <span>Integrasi</span>
              </Link>
            </>
          )}

          {/* Keamanan & Akun */}
          <div className="pt-0.5 space-y-1">
            <span className="px-2 text-xs font-semibold text-muted-foreground/80">
              Keamanan &amp; Akun
            </span>
            <div className={cn("grid gap-1.5", !isManager ? "grid-cols-2" : "grid-cols-1")}>
              {!isManager && (
                <Link to="/security" className={hqCompactPillClass(active === "security")}>
                  <ShieldCheck className="size-3 shrink-0" />
                  <span>Keamanan</span>
                </Link>
              )}
              <Link
                to="/profile"
                className={hqCompactPillClass(
                  active === "profile" ||
                    active === "change-password" ||
                    active === "login-activity",
                )}
              >
                <UserRound className="size-3 shrink-0" />
                <span>Akun</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <Link
              to="/language-settings"
              className={hqCompactPillClass(
                active === "language-settings" || active === "language",
              )}
            >
              <Globe2 className="size-3 shrink-0" />
              <span>Bahasa</span>
            </Link>
            <button
              type="button"
              onClick={onOpenThemeModal}
              className={cn(hqCompactPillClass(false), "cursor-pointer")}
            >
              <Palette className="size-3 shrink-0" />
              <span>Tema</span>
            </button>
          </div>
        </AccordionGroup>
      </nav>
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
        { key: "pos" as NavKey, label: t("rail.cashier", "Kasir"), href: "/pos", icon: ShoppingCart },
        { key: "pos-orders" as NavKey, label: t("rail.orders", "Pesanan"), href: "/pos/orders", icon: ReceiptText },
        {
          key: "pos-shift-cash" as NavKey,
          label: t("rail.shift", "Shift"),
          href: "/pos/shift-cash",
          icon: WalletCards,
        },
        { key: "pos-inventory" as NavKey, label: t("rail.stock", "Stok"), href: "/pos/inventory", icon: Boxes },
        { key: "pos-profile" as NavKey, label: t("rail.profile", "Profil"), href: "/pos/profile", icon: UserRound },
      ]
    : [
        { key: "dashboard" as NavKey, label: "Dashboard", href: "/dashboard", icon: Home },
        { key: "orders" as NavKey, label: "Penjualan", href: "/orders", icon: ReceiptText },
        { key: "inventory" as NavKey, label: "Stok", href: "/inventory", icon: Boxes },
        {
          key: "insight-analytics" as NavKey,
          label: "Laporan",
          href: "/insight-analytics",
          icon: BarChart3,
        },
        { key: "profile" as NavKey, label: "Profil", href: "/profile", icon: UserRound },
      ];

  return (
    <nav
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.75rem] border border-border bg-card/90 p-2 shadow-float backdrop-blur-2xl",
        isPosMode ? "min-[680px]:hidden" : "lg:hidden",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const selected =
          item.key === active || (item.key === "insight-analytics" && active === "analytics");
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

function DashboardPage({
  snapshot,
  userName,
}: {
  snapshot: Snapshot;
  userName?: string;
}) {
  const { t } = useTranslation();
  const [periodFilter, setPeriodFilter] = useState<AnalyticsFilter["dateRange"]>("today");

  const periodFilteredSnapshot = useMemo<Snapshot>(() => {
    if (periodFilter === "all") return snapshot;
    const filteredOrders = (snapshot.orders || []).filter((ord: any) =>
      isDateWithinFilter(ord.paid_at || ord.created_at, { dateRange: periodFilter }),
    );
    const allowedIds = new Set(filteredOrders.map((o) => o.id));
    const filteredOrderItems = (snapshot.orderItems || []).filter((oi: any) =>
      allowedIds.has(oi.order_id),
    );
    return {
      ...snapshot,
      orders: filteredOrders,
      orderItems: filteredOrderItems,
    };
  }, [snapshot, periodFilter]);

  const metrics = useMemo(
    () => calculateSnapshotMetrics(periodFilteredSnapshot),
    [periodFilteredSnapshot],
  );

  const periodLabel =
    periodFilter === "today"
      ? "Hari Ini"
      : periodFilter === "last_7_days"
        ? "7 Hari Terakhir"
        : periodFilter === "this_month"
          ? "Bulan Ini"
          : "Semua Waktu";

  const revenueCardLabel =
    periodFilter === "today"
      ? t("dashboard.revenue_today", "Revenue Hari Ini")
      : periodFilter === "last_7_days"
        ? "Revenue 7 Hari"
        : periodFilter === "this_month"
          ? "Revenue Bulan Ini"
          : "Total Revenue";

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

    if (metrics.orders > 0) {
      res.push({
        id: "order-sum-1",
        type: "daily_summary",
        title: `Performa Penjualan (${periodLabel})`,
        body: `Tercatat ${metrics.orders} transaksi lunas dengan omzet ${formatRupiah(metrics.todayRevenue)} dan HPP BOM ${formatRupiah(metrics.totalCost || 0)}.`,
        confidence: 92,
        action_label: "Lihat Laporan",
      });
    } else {
      res.push({
        id: "order-empty-1",
        type: "daily_summary",
        title: `Belum Ada Penjualan (${periodLabel})`,
        body: "Kasir telah terhubung ke database cloud. Buka menu POS Kasir untuk melayani pesanan pembeli.",
        confidence: 90,
        action_label: "Buka POS",
      });
    }

    if (snapshot.customers.length > 0) {
      const topCustomer = snapshot.customers[0];
      if (topCustomer) {
        const cleanFav =
          topCustomer.favorite_product &&
          topCustomer.favorite_product.trim().toLowerCase() !==
            topCustomer.name.trim().toLowerCase()
            ? topCustomer.favorite_product.trim()
            : null;
        res.push({
          id: "crm-top-1",
          type: "customer_insight",
          title: `Pelanggan Setia: ${topCustomer.name}`,
          body: `Telah melakukan ${topCustomer.visits}x kunjungan dengan total transaksi ${formatRupiah(topCustomer.total_spend)}. ${cleanFav ? `Produk favorit: ${cleanFav}.` : "Menu favorit sedang dikumpulkan dari riwayat transaksi."}`,
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
    metrics.orders,
    metrics.todayRevenue,
    metrics.totalCost,
    periodLabel,
    snapshot.customers,
    snapshot.products,
  ]);

  const recentOrders = periodFilteredSnapshot.orders;

  return (
    <div className="space-y-6 w-full max-w-none">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 lg:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
                <Zap className="size-4" />
                {t("dashboard.welcome_hq", "Selamat datang di HQ Monitor")}
              </p>
              <h1 className="max-w-2xl text-balance text-3xl font-black leading-tight tracking-normal lg:text-4xl">
                {t(
                  "dashboard.integrated_title",
                  "Operasional Bisnis & Data Transaksi Terintegrasi.",
                )}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t(
                  "dashboard.integrated_desc",
                  "Semua cabang outlet, stok bahan baku, kasir POS, dan laporan keuangan terhubung dalam Single Source of Truth.",
                )}
              </p>
            </div>
            <Link to="/insight-analytics" className="shrink-0">
              <Button variant="hero" className="h-12 rounded-2xl cursor-pointer">
                {t("dashboard.view_performance", "Lihat Performa")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
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

      {/* Period Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Calendar className="size-4 text-foreground/70" />
          <span>Periode Ringkasan:</span>
          <span className="font-bold text-foreground">{periodLabel}</span>
        </div>
        <div
          role="group"
          aria-label="Filter Periode Dashboard"
          className="inline-flex items-center rounded-2xl border border-border bg-card p-1 shadow-xs"
        >
          {(
            [
              { key: "today", label: "Hari Ini" },
              { key: "last_7_days", label: "7 Hari" },
              { key: "this_month", label: "Bulan Ini" },
              { key: "all", label: "Semua Waktu" },
            ] as Array<{ key: AnalyticsFilter["dateRange"]; label: string }>
          ).map((opt) => {
            const active = periodFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={active}
                onClick={() => setPeriodFilter(opt.key)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4">
        <StatCard
          label={revenueCardLabel}
          value={formatRupiah(metrics.todayRevenue || 0)}
          trend={`${metrics.orders || 0} transaksi · ${periodLabel}`}
          icon={DollarSign}
        />
        <StatCard
          label={t("dashboard.total_orders", "Total Transaksi")}
          value={`${metrics.orders || 0}`}
          trend={`Periode: ${periodLabel}`}
          icon={ReceiptText}
          tone="success"
        />
        <StatCard
          label={t("dashboard.profit_margin", "Margin Keuntungan")}
          value={`${metrics.todayRevenue > 0 ? metrics.marginPercentage || 0 : 0}%`}
          trend={`Laba: ${formatRupiah(metrics.grossProfit || 0)} · HPP: ${formatRupiah(metrics.totalCost || 0)}`}
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
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/70">
                <Store className="w-4 h-4" />
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
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground whitespace-nowrap">
              {metrics.outletPerformances.length || (snapshot.outlets || []).length || 0} Cabang
            </span>
          </div>

          {metrics.outletPerformances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center text-xs text-muted-foreground">
              <Store className="mx-auto size-7 opacity-40 mb-1.5" />
              <p className="font-bold">Belum ada transaksi outlet</p>
              <p className="text-xs mt-0.5">Omzet: Rp 0 · Transaksi: 0</p>
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
                        <p className="text-xs font-bold text-foreground">{perf.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {perf.orders || 0} transaksi · {outletPct}% omzet
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                        {formatRupiah(perf.revenue || 0)}
                      </p>
                      <span className="text-xs font-medium text-muted-foreground">Aktif</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Produk Terlaris */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/70">
                <UtensilsCrossed className="w-4 h-4" />
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
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              Top 5
            </span>
          </div>

          {metrics.topProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-6 text-center text-xs text-muted-foreground">
              <UtensilsCrossed className="mx-auto size-7 opacity-40 mb-1.5" />
              <p className="font-bold">Belum ada menu terjual</p>
              <p className="text-xs mt-0.5">Penjualan: 0 porsi · Revenue: Rp 0</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.topProducts.map((prod, prIdx) => (
                <div
                  key={prod.id || `prod-top-${prIdx}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 p-3 hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary shrink-0">
                      #{prIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">{prod.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {prod.category && prod.category.trim()
                          ? `${prod.category.trim()} · ${formatRupiah(prod.price || 0)}`
                          : formatRupiah(prod.price || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {prod.soldCount || 0} porsi terjual
                    </p>
                    <p className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
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
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
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
                    <p className="text-sm font-bold text-foreground">{order.order_number}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {order.channel} · {order.payment_method}
                    </p>
                  </div>
                  <p className="text-sm font-black whitespace-nowrap shrink-0">
                    {formatRupiah(order.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <Suspense fallback={<AiAssistantPanelFallback />}>
          <LazyAiAssistantPanel snapshot={snapshot} userName={userName} />
        </Suspense>
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
              className="bg-card rounded-2xl border border-border/60 shadow-sm p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/70">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-muted-foreground">{insight.confidence}%</span>
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
  customerPhone?: string | null;
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
  taxName?: string;
  taxRate?: number;
  taxMode?: "inclusive" | "exclusive";
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
  const { t } = useTranslation();
  const [waPhoneInput, setWaPhoneInput] = useState(data?.customerPhone || "");
  useEffect(() => {
    setWaPhoneInput(data?.customerPhone || "");
  }, [data?.orderNumber, data?.customerPhone]);

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
                <span>
                  {data.taxName || "Pajak Restoran (PB1)"}
                  {data.taxRate ? ` (${data.taxRate}%)` : ""}
                  {data.taxMode === "inclusive" ? " [Include]" : ""}:
                </span>
                <span>
                  {data.taxMode === "inclusive"
                    ? formatRupiah(data.taxAmount || 0)
                    : `+${formatRupiah(data.taxAmount || 0)}`}
                </span>
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

        <div className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold flex items-center gap-1.5">
            <Printer className="size-3.5 text-primary" />
            <span>Printer & Laci</span>
          </span>
          <span className="font-bold text-foreground">Siap Cetak / RawBT</span>
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-1.5">
          <MessageSquare className="size-3.5 text-emerald-600 shrink-0" />
          <input
            type="tel"
            value={waPhoneInput}
            onChange={(e) => setWaPhoneInput(e.target.value)}
            placeholder="No. WA tujuan (kosong = pilih kontak di WA)"
            className="w-full bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs font-bold px-3"
            onClick={onClose}
          >
            {t("common.close", "Tutup")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={async () => {
              const targetWaPhone = waPhoneInput.trim() || data.customerPhone || undefined;
              const res = await shareReceiptImage(
                {
                  storeName: headerStoreName,
                  outletName: data.outletName,
                  branchAddress,
                  orderNumber: data.orderNumber,
                  orderType: data.orderType,
                  tableNumber: data.tableNumber,
                  ojolOrderCode: data.ojolOrderCode,
                  customerName: data.customerName || undefined,
                  customerQueueName: data.customerQueueName || undefined,
                  customerPhone: targetWaPhone,
                  cashierName: data.cashierName,
                  paymentMethod: data.paymentMethod,
                  createdAt: data.createdAt,
                  items: data.items,
                  subtotal: data.subtotal,
                  discountAmount: data.discountAmount,
                  serviceChargeAmount: data.serviceChargeAmount,
                  taxAmount: data.taxAmount,
                  taxName: data.taxName,
                  taxRate: data.taxRate,
                  taxMode: data.taxMode,
                  total: data.total,
                  cashReceived: data.cashReceived,
                  changeAmount: data.changeAmount,
                  footerMessage: footerText,
                },
                targetWaPhone,
              );
              if (res === "downloaded") {
                toast.success("Gambar struk PNG diunduh — lampirkan pada chat WhatsApp.");
              }
            }}
          >
            <Send className="size-3.5" />
            {t("pos.send_wa_receipt", "Kirim Struk WA")}
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-xl text-xs font-bold gap-1.5 shadow-brand"
            onClick={async () => {
              try {
                const res = await printReceipt({
                  storeName: headerStoreName,
                  outletName: data.outletName,
                  branchAddress: branchAddress,
                  orderNumber: data.orderNumber,
                  cashierName: data.cashierName,
                  customerName: data.customerName,
                  customerQueueName: data.customerQueueName,
                  ojolOrderCode: data.ojolOrderCode,
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
                  taxName: data.taxName,
                  taxRate: data.taxRate,
                  taxMode: data.taxMode,
                  total: data.total,
                  paymentMethod: data.paymentMethod,
                  cashTendered: data.cashReceived ?? data.total,
                  change: data.changeAmount ?? Math.max(0, (data.cashReceived ?? data.total) - data.total),
                  footerMessage: footerText,
                });
                if (res.mode === "thermal") {
                  toast.success("Struk berhasil dicetak ke printer thermal!");
                }
              } catch (err: any) {
                console.warn("Print receipt fallback:", err);
                if ((window as any).Capacitor?.isNativePlatform?.()) {
                  toast.error(
                    "Gagal mencetak ke printer Bluetooth: " +
                      (err?.message || "Pastikan printer menyala & terhubung."),
                  );
                } else {
                  window.print();
                }
              }
            }}
          >
            <Printer className="size-3.5" />
            {t("pos.print_receipt", "Cetak Struk")}
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
  | "whatsapp"
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
    const { data, error: lookupErr } = await (supabase.from("inventory_items" as any) as any)
      .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, cost_price, category, sku, min_stock")
      .eq("id", ingredient.inventory_item_id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (lookupErr) {
      console.error("[BOM Depletion] Gagal membaca inventory_items by id:", lookupErr.message);
    }
    origInvRow = data;
  }

  // Fallback: search by ingredient_name if not found by id — MUST stay inside the same business
  if (!origInvRow && ingredient.ingredient_name) {
    let nameQuery = (supabase.from("inventory_items" as any) as any)
      .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, cost_price, category, sku, min_stock")
      .eq("business_id", businessId)
      .ilike("name", ingredient.ingredient_name.trim());
    if (chosenOutletId) {
      nameQuery = nameQuery.eq("outlet_id", chosenOutletId);
    }
    const { data: nameMatch, error: nameErr } = await nameQuery.limit(1);
    if (nameErr) {
      console.error("[BOM Depletion] Gagal membaca inventory_items by name:", nameErr.message);
    }
    if (nameMatch && nameMatch.length > 0) {
      origInvRow = nameMatch[0];
    }
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
        const { data: skuMatch, error: skuErr } = await (supabase.from("inventory_items" as any) as any)
          .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, cost_price, category, sku, min_stock")
          .eq("business_id", businessId)
          .eq("outlet_id", chosenOutletId)
          .eq("sku", origInvRow.sku)
          .limit(1);
        if (skuErr) {
          console.error("[BOM Depletion] Gagal membaca item cabang by SKU:", skuErr.message);
        }
        branchSpecificRows = skuMatch;
      }

      if (!branchSpecificRows || branchSpecificRows.length === 0) {
        const { data: nameMatch, error: branchNameErr } = await (supabase.from("inventory_items" as any) as any)
          .select("id, stock, name, unit, outlet_id, yield_per_unit, yield_unit, cost_per_unit, cost_price, category, sku, min_stock")
          .eq("business_id", businessId)
          .eq("outlet_id", chosenOutletId)
          .ilike("name", origInvRow.name.trim())
          .limit(1);
        if (branchNameErr) {
          console.error("[BOM Depletion] Gagal membaca item cabang by nama:", branchNameErr.message);
        }
        branchSpecificRows = nameMatch;
      }

      if (branchSpecificRows && branchSpecificRows.length > 0) {
        targetInvRow = branchSpecificRows[0];
      } else {
        // Fallback: create branch-specific item in chosenOutletId with 0 initial stock so we NEVER bleed other branches!
        // Never send a fake non-UUID id: let the database generate it, otherwise stock updates target a phantom row.
        const newBranchItem: any = {
          business_id: businessId,
          outlet_id: chosenOutletId,
          name: origInvRow.name,
          sku: origInvRow.sku || null,
          category: origInvRow.category || "Bahan Baku",
          unit: origInvRow.unit || "kg",
          cost_per_unit: Number(origInvRow.cost_per_unit) || Number(origInvRow.cost_price) || 0,
          cost_price: Number(origInvRow.cost_price) || Number(origInvRow.cost_per_unit) || 0,
          yield_per_unit: origInvRow.yield_per_unit || null,
          yield_unit: origInvRow.yield_unit || null,
          stock: 0,
          min_stock: Number(origInvRow.min_stock) || 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdRow, error: createErr } = await (supabase.from("inventory_items" as any) as any)
          .insert(newBranchItem)
          .select()
          .maybeSingle();
        if (createErr || !createdRow) {
          console.error(
            "[BOM Depletion] Gagal membuat item inventori cabang:",
            createErr?.message || "insert tidak mengembalikan row",
          );
          return null;
        }
        targetInvRow = createdRow;
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

  if (convertedQuantity <= 0) {
    console.warn(
      `[BOM Depletion] Konversi tidak aman (${rawQuantityNeeded} ${ingredient.unit || "gram"} -> ${targetInvRow.unit || "kg"} untuk ${targetInvRow.name}); deplesi dilewati agar stok tidak rusak.`,
    );
    return null;
  }

  const prevStock = Number(targetInvRow.stock) || 0;
  const calculatedStock = prevStock - convertedQuantity;
  const newStock = Math.max(0, Math.round(calculatedStock * 10000) / 10000);

  const { error: stockUpdateErr } = await (supabase.from("inventory_items" as any) as any)
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", targetInvRow.id);
  if (stockUpdateErr) {
    console.error(
      `[BOM Depletion] Gagal update stok ${targetInvRow.name} (${targetInvRow.id}):`,
      stockUpdateErr.message,
    );
    return null;
  }

  const movementNote = `${prefixNote} #${orderNumber}: ${cartItemQuantity}x ${cartItemName}`;
  const historicUnitCost =
    Number(targetInvRow.cost_price) || Number(targetInvRow.cost_per_unit) || 0;
  const movementCreatedAt = new Date().toISOString();

  // Local record keeps the rich cost snapshot for localStorage analytics.
  // The `id` here is LOCAL ONLY and is never sent to Supabase (UUID column).
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
    unit_cost: Number(targetInvRow.cost_price || 0) || historicUnitCost,
    cost_per_unit: historicUnitCost,
    cost_price: historicUnitCost,
    yield_per_unit: Number(targetInvRow.yield_per_unit) || null,
    yield_unit: targetInvRow.yield_unit || null,
    notes: movementNote,
    created_at: movementCreatedAt,
  };

  // stock_movements has NO cost/metadata columns, so the historic snapshot is
  // stored as parseable JSON inside `notes` (rehydrated by getStockMovements).
  const movementSnapshotNotes = JSON.stringify({
    note: movementNote,
    item_name: targetInvRow.name || null,
    unit_cost: historicUnitCost,
    cost_per_unit: historicUnitCost,
    cost_price: historicUnitCost,
    yield_per_unit: Number(targetInvRow.yield_per_unit) || null,
    yield_unit: targetInvRow.yield_unit || null,
    recipe_quantity: rawQuantityNeeded,
    recipe_unit: ingredient.unit || "gram",
    inventory_unit: targetInvRow.unit || null,
    order_number: orderNumber,
    product_name: cartItemName,
  });

  // Full payload without the fake `mov-...` id and without non-existent columns.
  const movementDbPayload: Record<string, any> = {
    business_id: businessId,
    inventory_item_id: targetInvRow.id,
    outlet_id: chosenOutletId || targetInvRow.outlet_id || null,
    order_id: orderId || null,
    reference_id: orderId || orderNumber,
    reference_type: "pos_order",
    type: "pos_sale",
    movement_type: "pos_sale",
    quantity: convertedQuantity,
    unit: targetInvRow.unit || ingredient.unit || "gram",
    remaining_stock: newStock,
    notes: movementSnapshotNotes,
    created_at: movementCreatedAt,
  };

  const { error: movementError } = await (supabase.from("stock_movements" as any) as any)
    .insert(movementDbPayload);
  if (movementError) {
    console.error(
      "[BOM Depletion] Gagal insert stock_movements:",
      movementError.message,
      movementError.details || "",
    );
    // Retry with the minimal schema shared by every environment.
    const { error: retryError } = await (supabase.from("stock_movements" as any) as any).insert({
      business_id: businessId,
      inventory_item_id: targetInvRow.id,
      outlet_id: chosenOutletId || targetInvRow.outlet_id || null,
      reference_id: orderId || orderNumber,
      reference_type: "pos_order",
      type: "pos_sale",
      quantity: convertedQuantity,
      notes: movementSnapshotNotes,
      created_at: movementCreatedAt,
    });
    if (retryError) {
      console.error(
        "[BOM Depletion] Retry insert stock_movements juga gagal:",
        retryError.message,
        retryError.details || "",
      );
    }
  }

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a real UUID (e.g. a DB-backed pos_shifts.id), never for local ids like "shift-123". */
function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Generates an order number that is unique across cashier terminals:
 * last 8 digits of the timestamp + 4 random base36 characters (e.g. KP-12345678-X7QD).
 */
function generateUniqueOrderNumber(): string {
  const timePart = Date.now().toString().slice(-8);
  let randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  while (randomPart.length < 4) randomPart += "0";
  return `KP-${timePart}-${randomPart}`;
}

/** Distinguishes connectivity failures (safe to queue offline) from real DB rejections. */
function isLikelyNetworkError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout")
  );
}

/** Resolves the per-outlet localStorage key for the active shift (never the generic shared key). */
function getOutletShiftKey(outletId: string | null | undefined): string | null {
  return outletId && outletId !== "all" ? `kebabschoicepos_active_shift_${outletId}` : null;
}

/** Marker prefix for cash movements created by refund/void reversals (already netted out of cash sales). */
const ORDER_REVERSAL_MARKER = "[REVERSAL]";

/**
 * Depletes add-on / topping ingredients for a single cart item (used by both Cash and QRIS checkout).
 * Returns a map of inventoryId -> deducted quantity.
 */
async function depleteCartItemAddons(
  cartItem: CartItem,
  ctx: {
    chosenOutletId: string | null;
    businessId: string;
    orderId: string | null;
    orderNumber: string;
    prefixNote: string;
  },
): Promise<Record<string, number>> {
  const deducted: Record<string, number> = {};
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
      chosenOutletId: ctx.chosenOutletId,
      businessId: ctx.businessId,
      orderId: ctx.orderId,
      orderNumber: ctx.orderNumber,
      prefixNote: ctx.prefixNote,
    });
    if (addonDepletion) {
      deducted[addonDepletion.inventoryId] =
        (deducted[addonDepletion.inventoryId] || 0) + addonDepletion.deductedQuantity;
    }
  }
  return deducted;
}

function PosPage({
  snapshot,
  profile,
  onRefresh,
  activeCashierName,
  isSidebarCollapsed,
  onToggleSidebar,
}: {
  snapshot: Snapshot;
  profile?: UserProfile;
  onRefresh: () => Promise<void>;
  activeCashierName?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);

  const activeOutlets = useMemo(
    () => (snapshot.outlets || []).filter((o) => o.active !== false),
    [snapshot.outlets],
  );
  // prettier-ignore
  const assignedOutlet = activeOutlets.find((o) => o.id === snapshot.assignedOutletId) || activeOutlets[0];

  const getInitialOutletId = () => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
        localStorage.getItem("kebabschoicepos_active_outlet_id");
      if (saved && saved !== "all") {
        if (activeOutlets.length === 0 || activeOutlets.some((o) => o.id === saved)) {
          return saved;
        }
      }
      try {
        const activeRaw = localStorage.getItem("kebabschoicepos_active_outlet");
        if (activeRaw) {
          const parsed = JSON.parse(activeRaw);
          if (
            parsed?.id &&
            parsed.id !== "all" &&
            (activeOutlets.length === 0 || activeOutlets.some((o) => o.id === parsed.id))
          ) {
            return parsed.id;
          }
        }
      } catch {}
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
    if (activeOutlets.length === 0) return;
    const isInvalid =
      !selectedOutletId ||
      selectedOutletId === "all" ||
      !activeOutlets.some((o) => o.id === selectedOutletId);
    if (isInvalid) {
      let savedInStorage: string | null = null;
      if (isOwner && typeof window !== "undefined") {
        const rawId =
          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
          localStorage.getItem("kebabschoicepos_active_outlet_id");
        if (rawId && activeOutlets.some((o) => o.id === rawId)) {
          savedInStorage = rawId;
        } else {
          try {
            const activeObj = JSON.parse(
              localStorage.getItem("kebabschoicepos_active_outlet") || "null",
            );
            if (activeObj?.id && activeOutlets.some((o) => o.id === activeObj.id)) {
              savedInStorage = activeObj.id;
            }
          } catch {}
        }
      }
      const targetId =
        savedInStorage ||
        (!isOwner && snapshot.assignedOutletId && activeOutlets.some((o) => o.id === snapshot.assignedOutletId)
          ? snapshot.assignedOutletId
          : activeOutlets[0]?.id);
      if (targetId && targetId !== selectedOutletId) {
        setSelectedOutletId(targetId);
        try {
          localStorage.setItem("kebabschoicepos_active_outlet_id", targetId);
          localStorage.setItem("kebabschoicepos_selected_outlet_id", targetId);
          const matchedOut = activeOutlets.find((o) => o.id === targetId);
          if (matchedOut) {
            localStorage.setItem("kebabschoicepos_active_outlet", JSON.stringify(matchedOut));
          }
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
        const matchedOut = (snapshot.outlets || []).find((o) => o.id === selectedOutletId);
        if (matchedOut) {
          localStorage.setItem("kebabschoicepos_active_outlet", JSON.stringify(matchedOut));
        }
      } catch {}
    }
  }, [selectedOutletId, snapshot.outlets]);

  // Active shift state for live status strictly bound to selected outlet
  const [activeShift, setActiveShift] = useState<any>(null);
  useEffect(() => {
    let isCancelled = false;

    const updateActiveShiftIfChanged = (nextShift: any) => {
      setActiveShift((prev: any) => {
        if (!prev && !nextShift) return prev;
        if (
          prev &&
          nextShift &&
          prev.id === nextShift.id &&
          prev.status === nextShift.status &&
          prev.cashierName === nextShift.cashierName &&
          prev.outletId === nextShift.outletId &&
          Number(prev.startingCash) === Number(nextShift.startingCash) &&
          Number(prev.cashSales) === Number(nextShift.cashSales)
        ) {
          return prev;
        }
        return nextShift;
      });
    };

    async function syncShift() {
      try {
        const outletKey = getOutletShiftKey(selectedOutletId);
        const saved = outletKey ? localStorage.getItem(outletKey) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.status === "open" && parsed.outletId === selectedOutletId) {
            if (!isCancelled) updateActiveShiftIfChanged(parsed);
          }
        }
      } catch {}

      if (selectedOutletId && selectedOutletId !== "all" && snapshot.businessId) {
        try {
          const { data: dbShifts } = await supabase
            .from("pos_shifts" as any)
            .select("*")
            .eq("business_id", snapshot.businessId)
            .eq("status", "open")
            .eq("outlet_id", selectedOutletId)
            .order("start_time", { ascending: false })
            .limit(1);

          if (dbShifts && dbShifts.length > 0 && !isCancelled) {
            const row: any = dbShifts[0];
            const matchedOutletName = (snapshot.outlets || []).find(
              (o) => o.id === selectedOutletId,
            )?.name;
            const liveShift = {
              id: row.id,
              cashierName: row.cashier_name || "Kasir",
              cashierId: row.cashier_id,
              teamMembers: row.team_members,
              outletName: row.outlet_name || matchedOutletName,
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
            updateActiveShiftIfChanged(liveShift);
            localStorage.setItem(
              `kebabschoicepos_active_shift_${selectedOutletId}`,
              JSON.stringify(liveShift),
            );
          } else if (!dbShifts || dbShifts.length === 0) {
            if (!isCancelled) {
              const localOutletShift = localStorage.getItem(
                `kebabschoicepos_active_shift_${selectedOutletId}`,
              );
              if (!localOutletShift) updateActiveShiftIfChanged(null);
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
  }, [selectedOutletId, snapshot.businessId]);

  // Thermal Printer & Hardware status
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>({
    type: "none",
    name: "Standar (Browser)",
    status: "disconnected",
    paperSize: "58mm",
    openCashDrawerOnCash: true,
  });
  const [showPrinterMenu, setShowPrinterMenu] = useState(false);
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [uiScale, setUiScale] = useState<UiScale>(() => getStoredUiScale());

  useEffect(() => {
    const syncScale = (e: Event) => {
      const detail = (e as CustomEvent<UiScale>).detail;
      setUiScale(detail || getStoredUiScale());
    };
    window.addEventListener("ui-scale-changed", syncScale);
    return () => window.removeEventListener("ui-scale-changed", syncScale);
  }, []);

  const handleSelectPosUiScale = (scale: UiScale) => {
    setUiScale(scale);
    saveUiScale(scale);
    setShowScaleMenu(false);
    toast.success(`Skala layar diubah ke ${scale}%`);
  };

  const handleStepPosUiScale = (dir: -1 | 1) => {
    const order: UiScale[] = ["80", "85", "90", "100"];
    const idx = Math.max(0, order.indexOf(uiScale));
    const nextIdx = Math.min(order.length - 1, Math.max(0, idx + dir));
    const next = order[nextIdx];
    if (next && next !== uiScale) {
      setUiScale(next);
      saveUiScale(next);
      toast.success(`Skala layar: ${next}%`);
    }
  };

  useEffect(() => {
    const unsub = subscribePrinterStatus((info) => setPrinterInfo(info));
    return () => unsub();
  }, []);

  // Offline-First Network & Sync Status (Tahap 3 & Full UX Sweep)
  const [networkStatus, setNetworkStatus] = useState<NetworkSyncStatus>(getNetworkStatus());
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof window === "undefined" || window.navigator.onLine !== false,
  );

  useEffect(() => {
    const unsub = subscribeNetworkStatus((status) => {
      setNetworkStatus(status);
    });
    const syncBrowserOnline = () => {
      setBrowserOnline(typeof window === "undefined" || window.navigator.onLine !== false);
    };
    syncBrowserOnline();
    if (typeof window !== "undefined") {
      window.addEventListener("online", syncBrowserOnline);
      window.addEventListener("offline", syncBrowserOnline);
    }
    return () => {
      unsub();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", syncBrowserOnline);
        window.removeEventListener("offline", syncBrowserOnline);
      }
    };
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
  const [paymentSettings, setPaymentSettings] = useState<{
    cashEnabled: boolean;
    qrisEnabled: boolean;
    cardEnabled: boolean;
    transferEnabled: boolean;
    qrisNmid: string;
    qrisStaticImageUrl: string;
    /** Raw static QRIS text (outlets.settings.qris_static_payload) -> dynamic QRIS with auto amount */
    qrisStaticPayload: string;
    qrisConversionMode: QrisConversionMode;
  }>({
    cashEnabled: true,
    qrisEnabled: true,
    cardEnabled: true,
    transferEnabled: false,
    qrisNmid: "",
    qrisStaticImageUrl: "",
    qrisStaticPayload: "",
    qrisConversionMode: "static_with_amount",
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
          qrisNmid: normalizeNmid(parsed.qrisNmid ?? parsed.qris_nmid ?? parsed.nmid) || "",
          qrisStaticImageUrl: String(
            parsed.qris_static_image_url ||
              parsed.qrisStaticImageUrl ||
              parsed.staticQrisImageUrl ||
              parsed.static_qris_image_url ||
              parsed.qrisImageUrl ||
              parsed.qris_image_url ||
              "",
          ).trim(),
          qrisStaticPayload: normalizeQrisPayload(
            parsed.qris_static_payload || parsed.qrisStaticPayload || "",
          ),
          qrisConversionMode: normalizeQrisConversionMode(
            parsed.qris_conversion_mode || parsed.qrisConversionMode,
            "static_with_amount",
          ),
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
        const oa =
          Array.isArray(product.outlet_assignments) && product.outlet_assignments.length > 0
            ? product.outlet_assignments.find((item) => item.outlet_id === selectedOutletId)
            : undefined;
        const outletPrice = oa && Number(oa.selling_price) > 0 ? Number(oa.selling_price) : 0;
        const resolvedPrice =
          outletPrice || Number(product.price) || Number((product as any).base_price) || 0;
        if (resolvedPrice !== product.price) {
          return { ...product, price: resolvedPrice };
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "ewallet" | "card">("cash");
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

  // Redesign A (TOMORO-style POS): Inline Menu Search, Category Filter, View Mode, 3-Step Checkout & Order WA Modal
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [posViewMode, setPosViewMode] = useState<PosViewMode>(() => getStoredPosViewMode());

  useEffect(() => {
    const syncViewMode = (e: Event) => {
      const next = (e as CustomEvent<PosViewMode>).detail;
      setPosViewMode(next || getStoredPosViewMode());
    };
    const syncStorageViewMode = (e: StorageEvent) => {
      if (!e.key || e.key === "kebabschoicepos_view_mode") {
        setPosViewMode(getStoredPosViewMode());
      }
    };
    window.addEventListener("pos:view-mode-changed", syncViewMode);
    window.addEventListener("storage", syncStorageViewMode);
    return () => {
      window.removeEventListener("pos:view-mode-changed", syncViewMode);
      window.removeEventListener("storage", syncStorageViewMode);
    };
  }, []);

  const [activeCartPopover, setActiveCartPopover] = useState<
    "channel" | "customer" | "discount" | null
  >(null);
  const [isCustomerStepModalOpen, setIsCustomerStepModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of displayedProducts) {
      if (p.category && String(p.category).trim()) cats.add(String(p.category).trim());
    }
    return Array.from(cats);
  }, [displayedProducts]);

  const filteredProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return displayedProducts.filter((p) => {
      if (selectedCategory !== "all" && String(p.category || "").trim() !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String((p as any).sku || "").toLowerCase().includes(q)
      );
    });
  }, [displayedProducts, menuSearch, selectedCategory]);

  const cartQtyByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      const pid = item.id;
      if (pid) map[pid] = (map[pid] || 0) + (Number(item.quantity) || 0);
    }
    return map;
  }, [cart]);

  const totalCartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [cart],
  );

  // Dynamic QRIS Realtime Payment State (Tahap 4)
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisModalData, setQrisModalData] = useState<QrisTransactionResponse | null>(null);
  const [qrisStatus, setQrisStatus] = useState<"PENDING" | "PAID" | "EXPIRED" | "FAILED">("PENDING");
  const [qrisSettlementRef, setQrisSettlementRef] = useState<string>("");
  const [isCheckingQris, setIsCheckingQris] = useState(false);
  const [qrisPendingOrder, setQrisPendingOrder] = useState<any>(null);
  const [isSettlingQris, setIsSettlingQris] = useState(false);
  // Error persisting a PAID QRIS order (order/items insert failed) — cart is kept & retry is offered
  const [qrisPersistError, setQrisPersistError] = useState<string | null>(null);
  const [isRetryingQrisPersist, setIsRetryingQrisPersist] = useState(false);
  // Raw text of the free-form "Uang Diterima" input (formatted with Indonesian thousand dots)
  const [cashTenderedInput, setCashTenderedInput] = useState<string>("");

  // Reset the free-form cash input back to "Uang Pas" (empty = exact amount)
  const handleClearCashTendered = () => {
    playPosSound("tap");
    setCashTenderedInput("");
    setCashTendered(0);
  };

  // QR source for the modal: an offline-rendered QR from the transaction payload (dynamic QRIS /
  // static payload converted to dynamic with auto amount), otherwise the store's static QRIS image.
  const [qrisGeneratedQrSrc, setQrisGeneratedQrSrc] = useState<string>("");
  useEffect(() => {
    const payload = qrisModalData?.qris_payload || "";
    const shouldRender = Boolean(payload) && (!qrisModalData?.qr_image_url || qrisModalData?.auto_amount);
    if (!shouldRender) {
      setQrisGeneratedQrSrc("");
      return;
    }
    let cancelled = false;
    import("@/lib/qr-tools")
      .then(({ generateQrDataUrl }) =>
        generateQrDataUrl(payload, { width: 560, margin: 2, errorCorrectionLevel: "M" }),
      )
      .then((url) => {
        if (!cancelled) setQrisGeneratedQrSrc(url);
      })
      .catch((err) => {
        console.warn("[QRIS] Render QR lokal gagal, fallback ke layanan QR online:", err);
        if (!cancelled) {
          setQrisGeneratedQrSrc(
            `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrisModalData?.qris_payload, qrisModalData?.qr_image_url, qrisModalData?.auto_amount]);

  const qrisDisplayQrSrc = qrisModalData
    ? qrisModalData.auto_amount
      ? qrisGeneratedQrSrc
      : qrisModalData.qr_image_url || qrisGeneratedQrSrc
    : "";

  // Static QRIS text payload configured by the Owner -> POS shows auto-amount QRIS unless mode is static_raw
  const hasAutoAmountQris = useMemo(
    () =>
      paymentSettings.qrisConversionMode !== "static_raw" &&
      Boolean(paymentSettings.qrisStaticPayload) &&
      validateQrisPayload(paymentSettings.qrisStaticPayload).ok,
    [paymentSettings.qrisConversionMode, paymentSettings.qrisStaticPayload],
  );

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

  // Order Type, Channels, and Queue Antrean State (Default: Take Away)
  const [orderType, setOrderType] = useState<PosOrderType>("take_away");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [customerQueueName, setCustomerQueueName] = useState<string>("");
  const [ojolOrderCode, setOjolOrderCode] = useState<string>("");
  const [isMobileCartDrawerOpen, setIsMobileCartDrawerOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Antrean Tersimpan (Hold Orders) State — persisted globally in localStorage, filtered strictly per branch
  const [allHeldOrders, setAllHeldOrders] = useState<HeldOrder[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kebabschoicepos_held_orders");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });
  const heldOrders = useMemo(
    () =>
      allHeldOrders.filter(
        (held) =>
          !held.outletId ||
          !selectedOutletId ||
          selectedOutletId === "all" ||
          held.outletId === selectedOutletId,
      ),
    [allHeldOrders, selectedOutletId],
  );
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
    const updated = [newHold, ...allHeldOrders];
    setAllHeldOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_held_orders", JSON.stringify(updated));
    }
    playPosSound("success");
    setCart([]);
    setIsCustomerStepModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsMobileCartDrawerOpen(false);
    setActiveCartPopover(null);
    setOrderType("take_away");
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setOrderNotes("");
    setDiscountValue(0);
    toast.success("Antrean Berhasil Ditahan (Hold)", {
      description: `Pesanan "${newHold.customerQueueName || 'Antrean #' + (heldOrders.length + 1)}" (${newHold.items.length} item) tersimpan sementara.`,
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

    const updated = allHeldOrders.filter((h) => h.id !== held.id);
    setAllHeldOrders(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_held_orders", JSON.stringify(updated));
    }
    setHeldOrdersModalOpen(false);
    toast.success("Antrean Dipulihkan", {
      description: `Pesanan "${held.customerQueueName || 'Antrean'}" siap diproses checkout.`,
    });
  };

  const handleDeleteHeldOrder = (id: string) => {
    const updated = allHeldOrders.filter((h) => h.id !== id);
    setAllHeldOrders(updated);
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

  // Tax & Service Charge Settings State (default matches TaxSettingsPage PB1 10% Exclusive)
  const DEFAULT_TAX_CONFIG = {
    taxEnabled: true,
    taxRate: 10,
    taxName: "PB1 (Pajak Restoran)",
    taxMode: "exclusive" as "inclusive" | "exclusive",
    serviceEnabled: false,
    serviceRate: 5,
  };
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
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            taxEnabled: parsed.taxEnabled ?? DEFAULT_TAX_CONFIG.taxEnabled,
            taxRate: Number(parsed.taxRate ?? DEFAULT_TAX_CONFIG.taxRate) || 0,
            taxName: parsed.taxName || DEFAULT_TAX_CONFIG.taxName,
            taxMode: parsed.taxMode === "inclusive" ? "inclusive" : "exclusive",
            serviceEnabled: parsed.serviceEnabled ?? DEFAULT_TAX_CONFIG.serviceEnabled,
            serviceRate: Number(parsed.serviceRate ?? DEFAULT_TAX_CONFIG.serviceRate) || 0,
          };
        }
      } catch {}
    }
    return DEFAULT_TAX_CONFIG;
  });

  // Re-read tax & payment settings on outlet change, window focus, tax:updated, or storage event
  useEffect(() => {
    const syncSettings = () => {
      // 1. Resolve active outlet
      const activeOutlet = snapshot.outlets?.find((o) => o.id === selectedOutletId);

      // Tax settings: merge business outlets + active outlet + localStorage (prefer newest updatedAt)
      const outletTax = (activeOutlet?.settings as any)?.tax_settings;
      const fallbackOutletTax = (snapshot.outlets || []).find(
        (o) => (o.settings as any)?.tax_settings,
      )?.settings?.tax_settings;
      let localTax: any = null;
      try {
        const raw = localStorage.getItem("kebabschoicepos_tax_settings");
        if (raw) localTax = JSON.parse(raw);
      } catch {}

      const dbTax = outletTax || fallbackOutletTax || null;
      const dbTs = dbTax?.updatedAt ? new Date(dbTax.updatedAt).getTime() : 0;
      const localTs = localTax?.updatedAt ? new Date(localTax.updatedAt).getTime() : 0;
      const resolvedTax =
        localTax && (!dbTax || localTs >= dbTs)
          ? { ...DEFAULT_TAX_CONFIG, ...(dbTax || {}), ...localTax }
          : dbTax
            ? { ...DEFAULT_TAX_CONFIG, ...(localTax || {}), ...dbTax }
            : DEFAULT_TAX_CONFIG;

      setTaxSettings((prev) => {
        const next = {
          taxEnabled: Boolean(resolvedTax.taxEnabled),
          taxRate: Number(resolvedTax.taxRate) || 0,
          taxName: resolvedTax.taxName || DEFAULT_TAX_CONFIG.taxName,
          taxMode: (resolvedTax.taxMode === "inclusive" ? "inclusive" : "exclusive") as
            | "inclusive"
            | "exclusive",
          serviceEnabled: Boolean(resolvedTax.serviceEnabled),
          serviceRate: Number(resolvedTax.serviceRate) || 0,
        };
        if (
          prev.taxEnabled === next.taxEnabled &&
          prev.taxRate === next.taxRate &&
          prev.taxName === next.taxName &&
          prev.taxMode === next.taxMode &&
          prev.serviceEnabled === next.serviceEnabled &&
          prev.serviceRate === next.serviceRate
        ) {
          return prev;
        }
        return next;
      });

      // Payment settings (merge active outlet, any configured business outlet, and localStorage)
      const outletPay = activeOutlet?.settings?.payment_settings;
      const fallbackOutletWithPay = (snapshot.outlets || []).find(
        (o) => (o.settings as any)?.payment_settings,
      );
      const fallbackOutletPay = (fallbackOutletWithPay?.settings as any)?.payment_settings;
      let localPay: any = null;
      try {
        const saved = localStorage.getItem("kebabschoicepos_payment_settings");
        if (saved) localPay = JSON.parse(saved);
      } catch {}

      const mergedPay = { ...(fallbackOutletPay || {}), ...(localPay || {}), ...(outletPay || {}) };
      const nextQrisNmid =
        normalizeNmid(
          mergedPay.qrisNmid ??
            mergedPay.qris_nmid ??
            mergedPay.nmid ??
            localPay?.qrisNmid ??
            outletPay?.qrisNmid,
        ) || "";
      const nextStaticImg = String(
        (activeOutlet?.settings as any)?.qris_static_image_url ||
          mergedPay.qris_static_image_url ||
          mergedPay.qrisStaticImageUrl ||
          mergedPay.staticQrisImageUrl ||
          mergedPay.static_qris_image_url ||
          mergedPay.qrisImageUrl ||
          mergedPay.qris_image_url ||
          localPay?.qrisStaticImageUrl ||
          localPay?.staticQrisImageUrl ||
          outletPay?.qrisStaticImageUrl ||
          outletPay?.staticQrisImageUrl ||
          (fallbackOutletWithPay?.settings as any)?.qris_static_image_url ||
          "",
      ).trim();
      const nextStaticPayload = normalizeQrisPayload(
        (activeOutlet?.settings as any)?.qris_static_payload ||
          mergedPay.qris_static_payload ||
          mergedPay.qrisStaticPayload ||
          (fallbackOutletWithPay?.settings as any)?.qris_static_payload ||
          "",
      );
      const nextConversionMode = normalizeQrisConversionMode(
        (activeOutlet?.settings as any)?.qris_conversion_mode ||
          mergedPay.qris_conversion_mode ||
          mergedPay.qrisConversionMode ||
          localPay?.qris_conversion_mode ||
          localPay?.qrisConversionMode ||
          (fallbackOutletWithPay?.settings as any)?.qris_conversion_mode,
        "static_with_amount",
      );

      setPaymentSettings((prev) => {
        const next = {
          cashEnabled: mergedPay.cashEnabled ?? true,
          qrisEnabled: mergedPay.qrisEnabled ?? true,
          cardEnabled: mergedPay.cardEnabled ?? true,
          transferEnabled: mergedPay.transferEnabled ?? false,
          qrisNmid: nextQrisNmid,
          qrisStaticImageUrl: nextStaticImg,
          qrisStaticPayload: nextStaticPayload,
          qrisConversionMode: nextConversionMode,
        };
        if (
          prev.cashEnabled === next.cashEnabled &&
          prev.qrisEnabled === next.qrisEnabled &&
          prev.cardEnabled === next.cardEnabled &&
          prev.transferEnabled === next.transferEnabled &&
          prev.qrisNmid === next.qrisNmid &&
          prev.qrisStaticImageUrl === next.qrisStaticImageUrl &&
          prev.qrisStaticPayload === next.qrisStaticPayload &&
          prev.qrisConversionMode === next.qrisConversionMode
        ) {
          return prev;
        }
        return next;
      });
    };

    syncSettings();
    window.addEventListener("focus", syncSettings);
    window.addEventListener("storage", syncSettings);
    window.addEventListener("payment:updated", syncSettings);
    window.addEventListener("tax:updated", syncSettings);
    window.addEventListener("outlet:changed", syncSettings);
    return () => {
      window.removeEventListener("focus", syncSettings);
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("payment:updated", syncSettings);
      window.removeEventListener("tax:updated", syncSettings);
      window.removeEventListener("outlet:changed", syncSettings);
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

  // Fast 1-click Add to Cart (when product has no variants/modifiers; opens Variant Modal if product has variants/modifiers)
  const handleFastAddToCart = (product: Product) => {
    const hasAnyVariantsOrMods =
      (product.variant_groups || []).some((g) => g.options && g.options.length > 0) ||
      Boolean(product.modifiers && product.modifiers.length > 0);

    if (hasAnyVariantsOrMods) {
      handleOpenCustomize(product);
      return;
    }

    playPosSound("tap");
    const effectivePrice = product.promo_price && product.promo_price < product.price ? product.promo_price : product.price;
    setCart((current) => {
      const existingIdx = current.findIndex(
        (item) =>
          item.id === product.id &&
          !item.selected_variant &&
          (!item.selected_variant_groups || item.selected_variant_groups.length === 0) &&
          (!item.selected_modifiers || item.selected_modifiers.length === 0) &&
          (!item.selected_addons || item.selected_addons.length === 0) &&
          !item.notes,
      );
      if (existingIdx >= 0) {
        return current.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
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
      return [...current, newItem];
    });
  };

  const isVariantGroupRequired = (
    product: Product | null | undefined,
    group: MenuVariantGroup | null | undefined,
  ): boolean => {
    if (!group) return false;
    const gName = String(group.name || "").trim();
    const pName = String(product?.name || "").trim();
    if (/\b(tambahan|topping|add-?on|ekstra|extra)\b/i.test(gName)) {
      return false;
    }
    if (/original/i.test(pName) && /tambahan/i.test(gName)) {
      return false;
    }
    return Boolean(group.is_required);
  };

  // Open Customization Modal
  const handleOpenCustomize = (product: Product) => {
    playPosSound("tap");
    setCustomizingProduct(product);

    // Initialize variant groups options (do not force pre-selection on optional groups like Tambahan)
    const vGroups =
      product.variant_groups && product.variant_groups.length > 0 ? product.variant_groups : [];
    const initialGroupSelections: Record<string, MenuVariantOption[]> = {};

    vGroups.forEach((group, idx) => {
      const gKey = group.id || group.name || `group-${idx}`;
      const requiredGroup = isVariantGroupRequired(product, group);
      if (group.selection_type === "single") {
        const defOpt = requiredGroup
          ? group.options.find((o) => o.is_default) || group.options[0]
          : group.options.find((o) => o.is_default === true) && !/\b(tambahan|topping|add-?on|ekstra|extra)\b/i.test(String(group.name || ""))
            ? group.options.find((o) => o.is_default === true)
            : undefined;
        initialGroupSelections[gKey] = defOpt ? [defOpt] : [];
      } else {
        const defOpts = requiredGroup
          ? group.options.filter((o) => o.is_default)
          : [];
        initialGroupSelections[gKey] = defOpts;
      }
    });
    setSelectedGroupOptions(initialGroupSelections);

    // Legacy variant & level only apply when product has NO dynamic variant_groups
    if (vGroups.length > 0) {
      setSelectedVariant(null);
      setSelectedLevel(null);
    } else {
      const defaultVar =
        product.variants && product.variants.length > 0 ? (product.variants[0] ?? null) : null;
      setSelectedVariant(defaultVar);

      const levels = product.modifiers?.filter((m) => m.category === "level") || [];
      const defaultLvl =
        levels.find(
          (l) =>
            l.name.toLowerCase().includes("tidak pedas") ||
            l.name.toLowerCase().includes("original"),
        ) ||
        levels[0] ||
        null;
      setSelectedLevel(defaultLvl);
    }

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
      if (g && isVariantGroupRequired(customizingProduct, g)) {
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

    const seenVariantKeys = new Set<string>();
    const variantNames: string[] = [];
    for (const rawName of selectedVariantGroupsSummary.flatMap((g) => g.options.map((o) => o.name))) {
      const clean = String(rawName || "").replace(/\s+/g, " ").trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seenVariantKeys.has(key)) {
        seenVariantKeys.add(key);
        variantNames.push(clean);
      }
    }

    const deduplicatedModifiers = (
      vGroups.length > 0
        ? selectedPreps
        : [...(selectedLevel ? [selectedLevel.name] : []), ...selectedPreps]
    )
      .map((m) => String(m || "").replace(/\s+/g, " ").trim())
      .filter((m) => {
        if (!m) return false;
        const key = m.toLowerCase();
        if (seenVariantKeys.has(key)) return false;
        seenVariantKeys.add(key);
        return true;
      });

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
      selected_modifiers: deduplicatedModifiers,
      selected_addons: selectedAddons.map((a) => ({
        name: a.name,
        price: Number(a.price_adjustment) || 0,
      })),
      notes: orderNotes.trim() || undefined,
    };

    playPosSound("tap");
    setCart((current) => [...current, newItem]);
    setCustomizingProduct(null);
  };
  const handleConfirmVariant = handleConfirmAddToCart;

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

    const chosenOutlet = (snapshot.outlets || []).find((o) => o.id === chosenOutletId);
    const effectiveCashierName =
      activeShift?.cashierName || activeCashierName || profile?.displayName || "Kasir";
    const safeQrisTotal = parseNumberFromDots(orderTotal);
    const safeQrisSubtotal = parseNumberFromDots(pendingOrder?.subtotal ?? safeQrisTotal);
    const safeQrisDiscount = parseNumberFromDots(pendingOrder?.discountAmount ?? 0);
    const safeQrisService = parseNumberFromDots(pendingOrder?.serviceChargeAmount ?? 0);
    const safeQrisTax = parseNumberFromDots(pendingOrder?.taxAmount ?? 0);

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
          order_meta: {
            outlet_id: chosenOutletId || null,
            outlet_name: chosenOutlet?.name || null,
            cashier_name: effectiveCashierName,
            queue_name: pendingOrder?.customerQueueName || null,
            customer_name: effectiveCustomerName || null,
            order_type: pendingOrder?.orderType || "dine_in",
            table_number: pendingOrder?.tableNumber || null,
            ojol_order_code: pendingOrder?.ojolOrderCode || null,
            subtotal: safeQrisSubtotal,
            discount_amount: safeQrisDiscount,
            service_charge: safeQrisService,
            tax_amount: safeQrisTax,
          },
        },
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        final_price: item.unit_price || item.price,
        subtotal: (item.unit_price || item.price) * item.quantity,
      };
    });

    const businessId = snapshot.businessId || "";

    // Stop-the-line handler: payment is PAID but the order could not be persisted.
    // Do NOT print the receipt and do NOT clear the cart — offer a retry instead.
    const failQrisPersist = (reason: string) => {
      console.error(`[QRIS] Order #${orderNumber} gagal disimpan:`, reason);
      setQrisPersistError(reason);
      toast.error("Order QRIS GAGAL disimpan ke database", {
        description: `Pembayaran #${orderNumber} sudah diterima, tetapi order belum tercatat (${reason}). Keranjang tidak dikosongkan & struk tidak dicetak. Tekan "Simpan Ulang Order" untuk mencoba lagi.`,
        duration: 15000,
      });
    };

    if (!businessId) {
      failQrisPersist("Bisnis tidak terdeteksi");
      return;
    }

    let order: { id: string } | null = null;
    try {
      // Idempotent retry: reuse the order row if a previous attempt already created it
      const { data: existingOrder } = await supabase
        .from("sales_orders")
        .select("id")
        .eq("business_id", businessId)
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (existingOrder?.id) {
        order = { id: existingOrder.id };
      } else {
        const paidAtIso = new Date().toISOString();
        let res = await supabase
          .from("sales_orders")
          .insert({
            ...orderPayload,
            total: safeQrisTotal,
            payment_method: "qris",
            status: "paid",
            paid_at: paidAtIso,
          })
          .select("id")
          .single();

        if (res.error) {
          const coreQrisPayload: Record<string, any> = {
            business_id: businessId,
            order_number: orderNumber,
            total: safeQrisTotal,
            payment_method: "qris",
            status: "paid",
            channel: orderPayload?.channel || pendingOrder?.orderType || "dine_in",
            paid_at: paidAtIso,
          };
          if (chosenOutletId && isValidUuid(chosenOutletId)) {
            coreQrisPayload.outlet_id = chosenOutletId;
          }
          if (effectiveCustomerId && isValidUuid(effectiveCustomerId)) {
            coreQrisPayload.customer_id = effectiveCustomerId;
          }
          res = await supabase
            .from("sales_orders")
            .insert(coreQrisPayload as any)
            .select("id")
            .single();

          if (res.error) {
            delete coreQrisPayload.outlet_id;
            res = await supabase
              .from("sales_orders")
              .insert(coreQrisPayload as any)
              .select("id")
              .single();
          }
        }

        if (res.error || !res.data?.id) {
          failQrisPersist(res.error?.message || "insert sales_orders tidak mengembalikan id");
          return;
        }
        order = res.data;
      }

      const orderId = order.id;

      // Insert items only if this order does not have them yet (safe for retries)
      const { count: existingItemCount } = await supabase
        .from("sales_order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);

      if (!existingItemCount) {
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
          const { error: coreItemsErr } = await supabase.from("sales_order_items").insert(coreItems as any);
          if (coreItemsErr) {
            // Roll back the item-less order so reports never show an empty paid order
            const { error: rollbackErr } = await supabase
              .from("sales_orders")
              .delete()
              .eq("id", orderId)
              .eq("business_id", businessId);
            if (rollbackErr) {
              console.error("[QRIS] Rollback order tanpa item gagal:", rollbackErr.message);
            }
            failQrisPersist(`insert item pesanan gagal: ${coreItemsErr.message}`);
            return;
          }
        }
      }

      if (chosenOutletId) {
        try {
          await recordOrderOutletMetadata(businessId, chosenOutletId, orderId, {
            userId: profile?.email || "staff",
            displayName: effectiveCashierName,
            outletName: chosenOutlet?.name,
            queueName: pendingOrder?.customerQueueName || null,
            customerName: effectiveCustomerName || null,
            orderType: pendingOrder?.orderType || "dine_in",
            tableNumber: pendingOrder?.tableNumber || null,
            ojolOrderCode: pendingOrder?.ojolOrderCode || null,
            notes: orderPayload?.notes || null,
            subtotal: safeQrisSubtotal,
            discountAmount: safeQrisDiscount,
            serviceChargeAmount: safeQrisService,
            taxAmount: safeQrisTax,
          });
        } catch {}
      }
    } catch (e: any) {
      failQrisPersist(e?.message || "koneksi ke database terputus");
      return;
    }

    setQrisPersistError(null);

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
          // Also deplete add-ons / toppings for QRIS orders (same rules as Cash checkout)
          const addonDeducted = await depleteCartItemAddons(cartItem, {
            chosenOutletId: chosenOutletId || null,
            businessId,
            orderId: order?.id || null,
            orderNumber,
            prefixNote: "POS QRIS Addon",
          });
          for (const [invId, qty] of Object.entries(addonDeducted)) {
            deductedInventory[invId] = (deductedInventory[invId] || 0) + qty;
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

    const receiptData: ReceiptData = {
      orderNumber,
      outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
      cashierName: effectiveCashierName,
      paymentMethod: "QRIS",
      customerName: effectiveCustomerName,
      customerQueueName: qrisPendingOrder?.customerQueueName || undefined,
      ojolOrderCode: qrisPendingOrder?.ojolOrderCode || undefined,
      createdAt: new Date().toISOString(),
      subtotal: safeQrisSubtotal,
      discountAmount: safeQrisDiscount,
      serviceChargeAmount: safeQrisService,
      taxAmount: safeQrisTax,
      taxName: taxSettings.taxName,
      taxRate: taxSettings.taxRate,
      taxMode: taxSettings.taxMode,
      orderType: qrisPendingOrder?.orderType ?? "dine_in",
      tableNumber: qrisPendingOrder?.tableNumber || undefined,
      items: cartItems.map((c: CartItem) => ({
        name: c.variant_name ? `${c.name} (${c.variant_name})` : c.name,
        quantity: c.quantity,
        price: c.unit_price || c.price,
        subtotal: (c.unit_price || c.price) * c.quantity,
      })),
      total: safeQrisTotal,
    };

    try {
      localStorage.setItem("kebabschoicepos_last_receipt", JSON.stringify(receiptData));
    } catch {}

    setLastReceiptNotice(receiptData);

    // Construct local SalesOrder object and guarantee immediate appearance in Riwayat Order Hari Ini
    const newSalesOrder: SalesOrder & Record<string, any> = {
      id: order?.id || `qris-${Date.now()}`,
      order_number: orderNumber,
      total: safeQrisTotal,
      payment_method: "qris",
      status: "paid",
      channel: orderPayload?.channel || pendingOrder?.orderType || "dine_in",
      created_at: receiptData.createdAt,
      customer_id: effectiveCustomerId,
      outlet_id: chosenOutletId,
      outlet_name: chosenOutlet?.name,
      cashier_name: effectiveCashierName,
      customer_queue_name: qrisPendingOrder?.customerQueueName || null,
      customer_name: effectiveCustomerName,
      notes: orderPayload?.notes || null,
      subtotal: safeQrisSubtotal,
      discount_amount: safeQrisDiscount,
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

    // Tampilkan modal struk setelah pembayaran QRIS selesai (cetak struk hanya saat kasir klik "Cetak Struk")
    setIsQrisModalOpen(false);
    setQrisModalData(null);
    setQrisPendingOrder(null);
    setQrisStatus("PENDING");
    setCompletedReceipt(receiptData);

    playPosSound("success");
    setCart([]);
    setIsCustomerStepModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsMobileCartDrawerOpen(false);
    setActiveCartPopover(null);
    setOrderType("take_away");
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setSelectedCustomerId("");
    setMemberSearchQuery("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setCustomerMode("public");
    setCashTendered(0);
    setCashTenderedInput("");
    setDiscountValue(0);

    toast.success("PEMBAYARAN QRIS LUNAS", {
      description: `Order #${orderNumber} berhasil tercatat. Klik "Cetak Struk" pada pratinjau struk bila diperlukan.`,
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

  // Manual retry when a PAID QRIS order failed to persist (cart is still intact)
  const handleRetryQrisPersist = async () => {
    if (!qrisPendingOrder || isRetryingQrisPersist) return;
    setIsRetryingQrisPersist(true);
    try {
      await finalizePaidQrisOrder(qrisPendingOrder, qrisSettlementRef);
    } finally {
      setIsRetryingQrisPersist(false);
    }
  };

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

  // Handle QRIS Simulation (Demo & Testing Mode) — development builds only
  const handleSimulateQrisPayment = async () => {
    if (!import.meta.env.DEV) {
      toast.error("Simulasi pembayaran hanya tersedia di mode development.");
      return;
    }
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

  /**
   * QRIS Statis resmi toko: kasir mengonfirmasi dana sudah masuk.
   * Tidak ada NMID/payload palsu yang dibuat — hanya audit trail konfirmasi manual.
   */
  const handleConfirmStaticQrisPayment = async () => {
    if (isCheckingQris || isSettlingQris) return;
    if (!qrisModalData || !qrisPendingOrder) return;
    if (!snapshot.businessId) {
      toast.error("Bisnis tidak terdeteksi. Muat ulang halaman lalu coba lagi.");
      return;
    }

    setIsCheckingQris(true);
    try {
      const settlementReference = `CASHIER-${Date.now()}`;
      await logStaticQrisConfirmation({
        businessId: snapshot.businessId,
        outletId: qrisPendingOrder.chosenOutletId || null,
        orderNumber: qrisModalData.order_number,
        amount: Number(qrisModalData.amount) || Number(qrisPendingOrder.total) || 0,
        referenceId: qrisModalData.external_reference_id,
        confirmedBy: null,
      });
      setQrisSettlementRef(settlementReference);
      setQrisStatus("PAID");
      toast.success("Pembayaran QRIS Statis dikonfirmasi diterima kasir");
    } catch (err) {
      console.error("[QRIS] Gagal konfirmasi QRIS statis:", err);
      toast.error("Gagal mengonfirmasi pembayaran QRIS");
    } finally {
      setIsCheckingQris(false);
    }
  };

  // Checkout transaction
  async function checkout() {
    if (activeShift?.status !== "open") {
      toast.error("Kasir belum buka shift. Buka shift terlebih dahulu sebelum menerima transaksi.", {
        description: "Buka shift kasir aktif di menu Shift & Kas agar seluruh transaksi tercatat.",
        action: {
          label: "Buka Shift",
          onClick: () => {
            navigate({ to: "/pos/shift-cash" });
          },
        },
      });
      return;
    }

    if (!snapshot.businessId || cart.length === 0) {
      toast.info("Tambahkan produk dulu sebelum checkout.");
      return;
    }

    const orderNumber = generateUniqueOrderNumber();
    const chosenOutletId =
      selectedOutletId && selectedOutletId !== "all"
        ? selectedOutletId
        : (activeOutlets[0]?.id || snapshot.assignedOutletId || null);

    if (!chosenOutletId) {
      toast.error("Pilih Cabang Outlet terlebih dahulu sebelum melakukan transaksi kasir.");
      return;
    }

    // Sanitize all monetary numbers via parseNumberFromDots to prevent any NaN or dotted string misparse
    const safeSubtotal = parseNumberFromDots(subtotal);
    const safeDiscountAmount = parseNumberFromDots(discountAmount);
    const safeServiceCharge = parseNumberFromDots(serviceChargeAmount);
    const safeTaxAmount = parseNumberFromDots(taxAmount);
    const safeTotal = parseNumberFromDots(total);
    const safeCashTendered = parseNumberFromDots(cashTendered);

    // Validate free-form cash tendered (0 / empty = Uang Pas) against discounted safeTotal
    if (paymentMethod === "cash" && safeCashTendered > 0 && safeCashTendered < safeTotal) {
      toast.error("Uang diterima kurang dari total tagihan", {
        description: `Total ${formatRupiah(safeTotal)} • Diterima ${formatRupiah(safeCashTendered)} • Kurang ${formatRupiah(safeTotal - safeCashTendered)}`,
      });
      return;
    }

    const chosenOutlet = (snapshot.outlets || []).find((o) => o.id === chosenOutletId);
    const effectiveCashierName =
      activeShift?.cashierName || activeCashierName || profile?.displayName || "Kasir";
    const trimmedQueueName = customerQueueName.trim() || newCustomerName.trim();
    const trimmedCustomerPhone = newCustomerPhone.trim();

    // Persist the real sales channel (dine_in / take_away / delivery / gofood / grabfood / shopeefood)
    const orderChannel: string = orderType || "dine_in";
    let effectiveCustomerId: string | null = null;
    let effectiveCustomerName = "Pelanggan Umum";

    if (selectedCustomerId) {
      effectiveCustomerId = selectedCustomerId;
      const matchedMember = snapshot.customers.find((c) => c.id === selectedCustomerId);
      effectiveCustomerName = trimmedQueueName || matchedMember?.name || "Member CRM";
    } else if (trimmedQueueName) {
      effectiveCustomerName = trimmedQueueName;
      // Automatically record to CRM customers without blocking transaction if phone is empty
      try {
        const existingByNameOrPhone = snapshot.customers.find(
          (c) =>
            (trimmedCustomerPhone &&
              c.phone &&
              c.phone.replace(/\D/g, "") === trimmedCustomerPhone.replace(/\D/g, "")) ||
            c.name.trim().toLowerCase() === trimmedQueueName.toLowerCase(),
        );
        if (existingByNameOrPhone) {
          effectiveCustomerId = existingByNameOrPhone.id;
        } else if (isOnline()) {
          const { data: createdCust } = await supabase
            .from("customers")
            .insert({
              business_id: snapshot.businessId,
              name: effectiveCustomerName,
              phone: trimmedCustomerPhone || null,
              visits: 1,
              total_spend: safeTotal,
              favorite_product: cart[0]?.name || null,
              ai_insight: `Pelanggan POS: Transaksi ${formatRupiah(safeTotal)} pada ${new Date().toLocaleDateString("id-ID")}`,
            })
            .select("id, name, phone, visits, total_spend, favorite_product, ai_insight")
            .maybeSingle();
          if (createdCust) {
            effectiveCustomerId = createdCust.id;
            snapshot.customers = [customerFromRow(createdCust as any), ...(snapshot.customers || [])];
          }
        }
      } catch (err) {
        console.warn("[CRM] Auto customer record warning (non-blocking):", err);
      }
    }

    const paidAtIso = new Date().toISOString();
    const orderPayload: any = {
      business_id: snapshot.businessId,
      order_number: orderNumber,
      subtotal: safeSubtotal,
      discount_amount: safeDiscountAmount,
      service_charge: safeServiceCharge,
      tax_amount: safeTaxAmount,
      total: safeTotal,
      payment_method: paymentMethod,
      order_type: orderType,
      table_number: orderType === "dine_in" && tableNumber ? tableNumber : null,
      status: "paid",
      channel: orderChannel,
      paid_at: paidAtIso,
      customer_name: effectiveCustomerName || null,
    };
    if (trimmedQueueName || ojolOrderCode) {
      orderPayload.notes = [
        trimmedQueueName ? `Antrean: ${trimmedQueueName}` : null,
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
      const merchantName = chosenOutlet?.name || "KEBABS CHOICE";

      try {
        const qrisRes = await generateDynamicQris({
          businessId: snapshot.businessId,
          outletId: chosenOutletId,
          orderNumber,
          amount: safeTotal,
          customerName: effectiveCustomerName,
          merchantName,
          city: (chosenOutlet as any)?.city || "JAKARTA",
        });

        setQrisPendingOrder({
          orderNumber,
          chosenOutletId,
          effectiveCustomerId,
          effectiveCustomerName,
          customerQueueName: trimmedQueueName,
          ojolOrderCode,
          subtotal: safeSubtotal,
          discountAmount: safeDiscountAmount,
          serviceChargeAmount: safeServiceCharge,
          taxAmount: safeTaxAmount,
          orderType,
          tableNumber,
          total: safeTotal,
          cartItems: [...cart],
          orderPayload,
        });

        setQrisModalData(qrisRes);
        setQrisStatus("PENDING");
        setQrisSettlementRef("");
        setIsSettlingQris(false);
        setQrisPersistError(null);
        setIsPaymentModalOpen(false);
        setIsQrisModalOpen(true);
        return;
      } catch (err: any) {
        console.error("[QRIS] Error creating QRIS:", err);
        toast.error("QRIS tidak dapat diproses", {
          description:
            err?.message ||
            "Periksa pengaturan QRIS outlet (NMID resmi / QRIS Statis) lalu coba lagi.",
          duration: 8000,
        });
        // Jangan lanjut membuat order tanpa QR: transaksi QRIS batal.
        return;
      }
    }

    // Generate unique UUID idempotency key for this transaction
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const cashReceived =
      paymentMethod === "cash"
        ? safeCashTendered > 0
          ? safeCashTendered
          : safeTotal
        : safeTotal;
    const changeAmount =
      paymentMethod === "cash" ? Math.max(0, cashReceived - safeTotal) : 0;

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
          order_meta: {
            outlet_id: chosenOutletId || null,
            outlet_name: chosenOutlet?.name || null,
            cashier_name: effectiveCashierName,
            queue_name: trimmedQueueName || null,
            customer_name: effectiveCustomerName || null,
            customer_phone: trimmedCustomerPhone || null,
            order_type: orderType || "dine_in",
            table_number: orderType === "dine_in" && tableNumber ? tableNumber : null,
            ojol_order_code: ojolOrderCode || null,
            subtotal: safeSubtotal,
            discount_amount: safeDiscountAmount,
            service_charge: safeServiceCharge,
            tax_amount: safeTaxAmount,
            cash_received: cashReceived,
            change_amount: changeAmount,
          },
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

          // Core columns strictly matching public.sales_orders schema in database
          const corePayload: any = {
            business_id: snapshot.businessId,
            order_number: orderNumber,
            total: safeTotal,
            payment_method: paymentMethod.toLowerCase(),
            status: "paid",
            channel: orderChannel,
            paid_at: paidAtIso,
          };
          if (chosenOutletId && isValidUuid(chosenOutletId)) corePayload.outlet_id = chosenOutletId;
          if (effectiveCustomerId && isValidUuid(effectiveCustomerId)) {
            corePayload.customer_id = effectiveCustomerId;
          }

          let retryRes = await supabase.from("sales_orders").insert(corePayload).select("id").single();

          if (retryRes.error) {
            delete corePayload.outlet_id;
            retryRes = await supabase.from("sales_orders").insert(corePayload).select("id").single();
          }

          if (retryRes.error) {
            if (isLikelyNetworkError(retryRes.error)) {
              console.warn("[POS] Network failure during order insert, routing to offline queue:", retryRes.error);
              isQueuedOffline = true;
            } else {
              // Real DB rejection (constraint / RLS / schema): stop — never print a receipt or clear the cart
              console.error("[POS] sales_orders insert rejected by database:", retryRes.error);
              toast.error("Transaksi GAGAL disimpan ke database", {
                description: `Order #${orderNumber} tidak tersimpan (${retryRes.error.message}). Keranjang tidak dikosongkan — periksa koneksi/izin lalu coba lagi.`,
                duration: 10000,
              });
              return;
            }
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

    if (!isQueuedOffline && !order?.id) {
      toast.error("Transaksi GAGAL disimpan ke database", {
        description: `Order #${orderNumber} tidak mengembalikan ID. Keranjang tidak dikosongkan — silakan coba lagi.`,
      });
      return;
    }

    if (!isQueuedOffline && order && order.id) {
      // Insert sales order items FIRST — if this fails, roll back the order and stop the checkout
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
        const { error: coreItemsErr } = await supabase.from("sales_order_items").insert(coreItems as any);
        if (coreItemsErr) {
          console.error("[POS] sales_order_items insert failed:", coreItemsErr);
          const { error: rollbackErr } = await supabase
            .from("sales_orders")
            .delete()
            .eq("id", orderId)
            .eq("business_id", snapshot.businessId);
          if (rollbackErr) {
            console.error("[POS] Rollback order tanpa item gagal:", rollbackErr.message);
          }
          toast.error("Item pesanan GAGAL disimpan ke database", {
            description: `Order #${orderNumber} dibatalkan otomatis (${coreItemsErr.message}). Struk tidak dicetak & keranjang tidak dikosongkan — silakan coba lagi.`,
            duration: 10000,
          });
          return;
        }
      }
    }

    // Automated Recipe / BOM Inventory Depletion WITH UNIT CONVERSION
    const deductedInventory: Record<string, number> = {};
    const deductedProducts: Record<string, number> = {};

    if (isQueuedOffline) {
      // Compute offline BOM stock_depletions (recipe + add-ons) & product_depletions from in-memory snapshot
      const offlineStockDepletions: NonNullable<OfflineTransaction["stock_depletions"]> = [];
      const offlineProductDepletions: NonNullable<OfflineTransaction["product_depletions"]> = [];
      const cachedMenuRecipes = (snapshot.menuRecipes as Record<string, any>) || {};

      const resolveLocalTargetInv = (ing: {
        inventory_item_id?: string | null;
        ingredient_name?: string | null;
      }) => {
        let origInv: any = null;
        if (ing.inventory_item_id) {
          origInv = (snapshot.inventory || []).find((i) => i.id === ing.inventory_item_id) || null;
        }
        if (!origInv && ing.ingredient_name) {
          const lowerName = ing.ingredient_name.trim().toLowerCase();
          origInv =
            (snapshot.inventory || []).find(
              (i) =>
                (!chosenOutletId || i.outlet_id === chosenOutletId) &&
                i.name.trim().toLowerCase() === lowerName,
            ) ||
            (snapshot.inventory || []).find((i) => i.name.trim().toLowerCase() === lowerName) ||
            null;
        }
        if (!origInv) return null;
        if (chosenOutletId && origInv.outlet_id && origInv.outlet_id !== chosenOutletId) {
          const branchInv = (snapshot.inventory || []).find(
            (i) =>
              i.outlet_id === chosenOutletId &&
              i.name.trim().toLowerCase() === origInv.name.trim().toLowerCase(),
          );
          if (branchInv) return branchInv;
        }
        return origInv;
      };

      for (const cartItem of cart) {
        if (cartItem.id && !cartItem.id.startsWith("demo-")) {
          offlineProductDepletions.push({
            product_id: cartItem.id,
            quantity: cartItem.quantity,
          });
          deductedProducts[cartItem.id] = (deductedProducts[cartItem.id] || 0) + cartItem.quantity;
        }

        const localRecipe =
          cartItem.recipe ||
          snapshot.products.find((p) => p.id === cartItem.id)?.recipe ||
          cachedMenuRecipes[cartItem.id] ||
          null;

        const ingredientsToDeplete: Array<{
          inventory_item_id?: string | null;
          ingredient_name?: string | null;
          quantity: number;
          unit?: string;
          label: string;
        }> = [];

        if (localRecipe && Array.isArray(localRecipe.items)) {
          for (const ing of localRecipe.items) {
            ingredientsToDeplete.push({
              inventory_item_id: ing.inventory_item_id,
              ingredient_name: (ing as any).ingredient_name,
              quantity: Number(ing.quantity) || 1,
              unit: ing.unit || "gram",
              label: `${cartItem.quantity}x ${cartItem.name}`,
            });
          }
        }

        // Also include add-ons / toppings for offline BOM depletion
        const addOnList: Array<{ name: string }> = [];
        if (Array.isArray(cartItem.selected_addons)) {
          for (const addon of cartItem.selected_addons) {
            if (addon?.name) addOnList.push(addon);
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
              for (const opt of vg.options || []) {
                if (opt?.name) addOnList.push(opt);
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
          } else if (lower.includes("saus") || lower.includes("sauce") || lower.includes("mayo")) {
            estimatedQty = 15;
            estimatedUnit = "ml";
          }
          const cleanName = rawName.replace(/^(extra|tambah|tambahan|\+)\s+/i, "").trim();
          ingredientsToDeplete.push({
            ingredient_name: cleanName || rawName,
            quantity: estimatedQty,
            unit: estimatedUnit,
            label: `${cartItem.quantity}x ${cartItem.name} (+${rawName})`,
          });
        }

        for (const ing of ingredientsToDeplete) {
          const targetInv = resolveLocalTargetInv(ing);
          if (!targetInv) continue;
          const rawNeeded = (Number(ing.quantity) || 1) * cartItem.quantity;
          const convertedQty = convertRecipeToInventoryQuantity(
            rawNeeded,
            ing.unit || "gram",
            targetInv.unit || "kg",
            targetInv.yield_per_unit,
            targetInv.yield_unit,
          );
          if (convertedQty > 0) {
            offlineStockDepletions.push({
              inventory_item_id: targetInv.id,
              quantity: convertedQty,
              unit: targetInv.unit || ing.unit || "gram",
              product_name: ing.label,
            });
            deductedInventory[targetInv.id] =
              (deductedInventory[targetInv.id] || 0) + convertedQty;
          }
        }
      }

      // Mode Offline: simpan transaksi ke IndexedDB pending_transactions dengan idempotency_key
      const offlineTx: OfflineTransaction = {
        idempotency_key: idempotencyKey,
        order_number: orderNumber,
        business_id: snapshot.businessId,
        outlet_id: chosenOutletId || "all",
        shift_id: activeShift?.id || null,
        cash_amount: paymentMethod === "cash" ? safeTotal : 0,
        cashier_name: profile?.displayName || "Kasir",
        customer_id: effectiveCustomerId,
        customer_name: effectiveCustomerName,
        payment_method: paymentMethod,
        total: safeTotal,
        created_at: new Date().toISOString(),
        items: cart,
        status: "pending",
        retry_count: 0,
        raw_order_payload: orderPayload,
        raw_order_items_payload: orderItemsPayload,
        stock_depletions: offlineStockDepletions,
        product_depletions: offlineProductDepletions,
      };

      await queueOfflineTransaction(offlineTx);

      toast.warning("Transaksi Disimpan Offline", {
        description: `Order #${orderNumber} tersimpan di IndexedDB & akan otomatis disinkronkan ke Supabase saat online.`,
      });
    } else if (order && order.id) {
      // Persist single source of truth metadata for Outlet, Staff, Queue Name & Totals
      if (chosenOutletId && order.id) {
        try {
          await recordOrderOutletMetadata(snapshot.businessId, chosenOutletId, order.id, {
            userId: profile?.email || "staff",
            displayName: effectiveCashierName,
            outletName: chosenOutlet?.name,
            queueName: trimmedQueueName || null,
            customerName: effectiveCustomerName,
            customerPhone: trimmedCustomerPhone || null,
            orderType,
            tableNumber: orderType === "dine_in" && tableNumber ? tableNumber : null,
            ojolOrderCode: ojolOrderCode || null,
            notes: orderPayload.notes || null,
            subtotal: safeSubtotal,
            discountAmount: safeDiscountAmount,
            serviceChargeAmount: safeServiceCharge,
            taxAmount: safeTaxAmount,
            cashReceived,
            changeAmount,
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
    }

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
          const addonDeducted = await depleteCartItemAddons(cartItem, {
            chosenOutletId: chosenOutletId || null,
            businessId: snapshot.businessId || "",
            orderId: order?.id || null,
            orderNumber,
            prefixNote: "POS Addon",
          });
          for (const [invId, qty] of Object.entries(addonDeducted)) {
            deductedInventory[invId] = (deductedInventory[invId] || 0) + qty;
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

    // Sync active shift cash sales if payment was made in cash (strictly per-outlet shift key)
    if (paymentMethod === "cash") {
      try {
        const outletShiftKey = getOutletShiftKey(chosenOutletId);
        const savedShift = outletShiftKey ? localStorage.getItem(outletShiftKey) : null;
        if (outletShiftKey && savedShift) {
          const shiftObj = JSON.parse(savedShift);
          const newCashSales = (Number(shiftObj.cashSales) || 0) + total;
          const newExpected =
            (Number(shiftObj.startingCash) || 0) +
            newCashSales +
            (Number(shiftObj.totalCashIn) || 0) -
            (Number(shiftObj.totalCashOut) || 0);
          shiftObj.cashSales = newCashSales;
          shiftObj.expectedEndingCash = newExpected;
          localStorage.setItem(outletShiftKey, JSON.stringify(shiftObj));

          if (!isQueuedOffline && isValidUuid(shiftObj.id)) {
            const { error: shiftUpdErr } = await supabase
              .from("pos_shifts" as any)
              .update({
                cash_sales: newCashSales,
                expected_ending_cash: newExpected,
                updated_at: new Date().toISOString(),
              })
              .eq("id", shiftObj.id)
              .eq("business_id", snapshot.businessId)
              .eq("status", "open");
            if (shiftUpdErr) {
              console.warn("[POS] pos_shifts cash_sales update failed:", shiftUpdErr.message);
            }
          }
        }
      } catch (shiftErr) {
        console.warn("[POS] Shift cash sales sync warning:", shiftErr);
      }
    }

    const receiptData: ReceiptData = {
      orderNumber,
      outletName: chosenOutlet ? chosenOutlet.name : "KebabsChoice Flagship",
      cashierName: effectiveCashierName,
      paymentMethod: paymentMethod.toUpperCase(),
      customerName: effectiveCustomerName,
      customerQueueName: trimmedQueueName || undefined,
      customerPhone:
        trimmedCustomerPhone ||
        (selectedCustomerId
          ? snapshot.customers.find((c) => c.id === selectedCustomerId)?.phone || undefined
          : undefined),
      ojolOrderCode: ojolOrderCode || undefined,
      createdAt: new Date().toISOString(),
      subtotal: safeSubtotal,
      discountAmount: safeDiscountAmount,
      serviceChargeAmount: safeServiceCharge,
      taxAmount: safeTaxAmount,
      taxName: taxSettings.taxName,
      taxRate: taxSettings.taxRate,
      taxMode: taxSettings.taxMode,
      orderType,
      tableNumber: orderType === "dine_in" && tableNumber ? tableNumber : undefined,
      items: cart.map((c) => ({
        name: c.variant_name ? `${c.name} (${c.variant_name})` : c.name,
        quantity: c.quantity,
        price: c.unit_price || c.price,
        subtotal: (c.unit_price || c.price) * c.quantity,
      })),
      total: safeTotal,
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
    const newSalesOrder: SalesOrder & Record<string, any> = {
      id: localOrderId,
      order_number: orderNumber,
      total: safeTotal,
      payment_method: paymentMethod as any,
      status: "paid",
      channel: orderChannel,
      created_at: receiptData.createdAt,
      customer_id: effectiveCustomerId,
      outlet_id: chosenOutletId,
      outlet_name: chosenOutlet?.name,
      cashier_name: effectiveCashierName,
      customer_queue_name: trimmedQueueName || null,
      customer_name: effectiveCustomerName,
      customer_phone: receiptData.customerPhone || null,
      notes: orderPayload.notes || null,
      subtotal: safeSubtotal,
      discount_amount: safeDiscountAmount,
      cashReceived,
      changeAmount,
      items: receiptData.items,
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

    playPosSound("success");
    setCart([]);
    setIsCustomerStepModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsMobileCartDrawerOpen(false);
    setActiveCartPopover(null);
    setOrderType("take_away");
    setCustomerQueueName("");
    setOjolOrderCode("");
    setTableNumber("");
    setSelectedCustomerId("");
    setMemberSearchQuery("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setCustomerMode("public");
    setCashTendered(0);
    setCashTenderedInput("");
    setDiscountValue(0);

    if (paymentMethod === "cash") {
      toast.success(`Pembayaran Tunai Berhasil (${formatRupiah(safeTotal)})`, {
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

  const channelMetaMap: Record<
    PosOrderType,
    { label: string; dotClass: string; badgeClass: string; activeClass?: string }
  > = {
    take_away: {
      label: "Take Away",
      dotClass: "bg-primary",
      badgeClass: "bg-primary/10 text-primary border-primary/25",
    },
    dine_in: {
      label: "Dine In",
      dotClass: "bg-primary",
      badgeClass: "bg-primary/10 text-primary border-primary/25",
    },
    delivery: {
      label: "Delivery",
      dotClass: "bg-foreground/60",
      badgeClass: "bg-muted text-foreground border-border",
    },
    whatsapp: {
      label: "WhatsApp",
      dotClass: "bg-emerald-500",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      activeClass: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
    },
    gofood: {
      label: "GoFood",
      dotClass: "bg-emerald-500",
      badgeClass: "bg-muted text-foreground border-border",
      activeClass: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
    },
    grabfood: {
      label: "GrabFood",
      dotClass: "bg-green-600",
      badgeClass: "bg-muted text-foreground border-border",
      activeClass: "bg-green-600 hover:bg-green-700 text-white border-green-600",
    },
    shopeefood: {
      label: "ShopeeFood",
      dotClass: "bg-foreground/60",
      badgeClass: "bg-muted text-foreground border-border",
      activeClass: "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
    },
  };
  const activeChannelMeta = channelMetaMap[orderType] || channelMetaMap.take_away;
  const activeCustomerLabel =
    customerMode === "member" && selectedCustomerId
      ? snapshot.customers.find((c) => c.id === selectedCustomerId)?.name || t("pos.member", "Member")
      : customerMode === "new" && newCustomerName.trim()
        ? newCustomerName.trim()
        : customerMode === "member"
          ? t("pos.select_member", "Pilih Member")
          : customerMode === "new"
            ? t("pos.guest", "Umum")
            : t("pos.guest", "Umum");
  const isPosBrowserOnline =
    browserOnline && (typeof window === "undefined" || window.navigator.onLine !== false);

  const filteredMemberCustomers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return snapshot.customers || [];
    return (snapshot.customers || []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q),
    );
  }, [snapshot.customers, memberSearchQuery]);

  return (
    <div className="flex flex-col min-[680px]:flex-row min-[680px]:h-full min-[680px]:overflow-hidden gap-2">
      {/* TENGAH: TOOLBAR BERSIH + KATEGORI + KATALOG MENU KOTAK PROPORSIONAL */}
      <section className="flex-1 min-w-0 w-full flex flex-col min-[680px]:h-full min-[680px]:overflow-hidden gap-1.5">
        {/* Toolbar Atas Bersih: Status Online + Cabang/Shift + Cari Menu Lebar */}
        <div className="shrink-0 h-11 px-2.5 flex items-center gap-2 rounded-lg border border-border/60 bg-card shadow-xs">
          {/* Badge Status Online Ringkas */}
          {isPosBrowserOnline ? (
            <span
              className="inline-flex h-7 items-center gap-1.5 px-2 rounded-md bg-emerald-500/10 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0"
              title="Status Koneksi Kasir"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span>
                {networkStatus.pendingCount > 0
                  ? language === "en"
                    ? `Online (${networkStatus.pendingCount} queued)`
                    : `Online (${networkStatus.pendingCount} antrean)`
                  : "Online"}
              </span>
            </span>
          ) : (
            <span
              className="inline-flex h-7 items-center gap-1.5 px-2 rounded-md bg-rose-500/10 text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0"
              title="Mode Offline Aktif"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
              <span>
                {networkStatus.pendingCount > 0
                  ? language === "en"
                    ? `Offline (${networkStatus.pendingCount} queued)`
                    : `Offline (${networkStatus.pendingCount} antrean)`
                  : "Offline"}
              </span>
            </span>
          )}

          {/* Badge Cabang & Status Shift (Klik Langsung ke /pos/shift-cash) */}
          <Link
            to="/pos/shift-cash"
            title={
              !isOwner
                ? "Cabang Aktif: Terkunci — Klik untuk buka Shift & Kas"
                : "Klik untuk kelola Shift & Kas"
            }
            className="inline-flex h-7 max-w-[190px] lg:max-w-[260px] items-center gap-1.5 px-2.5 rounded-md bg-secondary/80 hover:bg-secondary text-[11px] font-semibold text-foreground whitespace-nowrap shrink-0 transition-colors"
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                activeShift?.status === "open" ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
            <span className="truncate">
              {activeOutlets.find((o) => o.id === selectedOutletId)?.name ||
                activeOutlets[0]?.name ||
                t("pos.branch_fallback", "Cabang")}
              {!isOwner && <span className="sr-only">Cabang Aktif: Terkunci</span>}
            </span>
            <span className="text-muted-foreground">•</span>
            <span
              className={cn(
                "font-bold",
                activeShift?.status === "open"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {activeShift?.status === "open"
                ? t("pos.shift_open", "Shift Aktif")
                : t("pos.shift_closed", "Shift Tutup")}
            </span>
          </Link>

          {/* Input Cari Menu... yang Lebar */}
          <div className="relative flex-1 min-w-[110px]" title="Cari Menu / Barcode Scanner">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder={t("pos.search_menu", "Cari menu...")}
              aria-label="Cari menu kasir"
              className="h-8 w-full rounded-md border border-border bg-muted/40 pl-8 pr-7 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            {menuSearch && (
              <button
                type="button"
                onClick={() => setMenuSearch("")}
                aria-label="Hapus pencarian menu"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills Horizontal */}
        <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              playPosSound("option");
              setSelectedCategory("all");
            }}
            className={cn(
              "h-7 px-3 rounded-md text-xs font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 cursor-pointer border",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary",
            )}
          >
            {t("pos.all", "Semua")} ({displayedProducts.length})
          </button>
          {productCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                playPosSound("option");
                setSelectedCategory(cat);
              }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 cursor-pointer border",
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Katalog Menu Kotak Compact, Proporsional & Lengkungan Rapi (rounded-lg kartu, rounded-md gambar, p-2.5 seragam) */}
        <div className="flex-1 min-h-0 min-[680px]:overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-2.5">
          {filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/80 p-8 text-center">
              <Store className="mx-auto size-9 text-muted-foreground opacity-50 mb-2.5" />
              <h3 className="font-bold text-sm">
                {menuSearch.trim()
                  ? `Menu "${menuSearch}" tidak ditemukan`
                  : t("cart.no_menu_in_outlet", "Tidak ada menu tersedia di outlet ini")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {menuSearch.trim()
                  ? "Coba kata kunci lain atau hapus pencarian untuk melihat seluruh katalog."
                  : "Menu mungkin belum diaktifkan untuk outlet ini. Anda dapat mengaktifkannya di Menu Management tab Cabang Outlet."}
              </p>
              {menuSearch.trim() && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMenuSearch("");
                    setSelectedCategory("all");
                  }}
                  className="mt-3 rounded-md text-xs font-bold"
                >
                  Tampilkan Semua Menu
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn(
                posViewMode === "compact" &&
                  "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5",
                posViewMode === "normal" &&
                  "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5",
                posViewMode === "list" && "grid grid-cols-1 sm:grid-cols-2 gap-2",
              )}
            >
              {filteredProducts.map((product) => {
                const hasVariantsOrMods =
                  (product.variant_groups || []).some((g) => g.options && g.options.length > 0) ||
                  Boolean(product.modifiers && product.modifiers.length > 0);
                const qtyInCart = cartQtyByProductId[product.id] || 0;
                const isPromo = Boolean(product.promo_price && product.promo_price < product.price);
                const displayPrice =
                  isPromo && product.promo_price ? product.promo_price : product.price;

                if (posViewMode === "list") {
                  return (
                    <div
                      key={product.id}
                      onClick={() =>
                        hasVariantsOrMods ? handleOpenCustomize(product) : handleFastAddToCart(product)
                      }
                      className={cn(
                        "group relative p-2.5 cursor-pointer rounded-lg border bg-card hover:bg-secondary/40 active:scale-95 transition-transform duration-100 overflow-hidden flex items-center justify-between gap-2",
                        qtyInCart > 0
                          ? "border-primary/60 ring-1 ring-primary/25"
                          : "border-border/80 hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative flex w-9 h-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted border border-border/50">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-9 h-9 object-cover pointer-events-none"
                            />
                          ) : (
                            <img
                              src="/logo-brand.png?v=2"
                              alt={product.name}
                              className="w-6 h-6 object-contain opacity-80"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {product.name}
                          </p>
                          {hasVariantsOrMods && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                              {t("pos.variants", "Varian")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap hidden sm:inline">
                          {t("pos.stock_short", "Stok")} {product.stock}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold whitespace-nowrap",
                            isPromo ? "text-rose-600 dark:text-rose-400" : "text-primary",
                          )}
                        >
                          {formatRupiah(displayPrice)}
                        </span>
                        {qtyInCart > 0 && (
                          <span
                            aria-label={`${qtyInCart} di keranjang`}
                            className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black shadow-xs"
                          >
                            {qtyInCart}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={product.id}
                    onClick={() =>
                      hasVariantsOrMods ? handleOpenCustomize(product) : handleFastAddToCart(product)
                    }
                    className={cn(
                      "group relative cursor-pointer rounded-lg border bg-card p-2.5 shadow-xs hover:shadow-md active:scale-95 transition-transform duration-100 overflow-hidden flex flex-col justify-between",
                      qtyInCart > 0
                        ? "border-primary/60 ring-1 ring-primary/25"
                        : "border-border/80 hover:border-primary/40",
                    )}
                  >
                    {/* Badge Bulat Hijau Jumlah Item di Pojok Kanan Atas */}
                    {qtyInCart > 0 && (
                      <span
                        aria-label={`${qtyInCart} di keranjang`}
                        className="absolute top-2 right-2 z-20 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black shadow-md ring-2 ring-card"
                      >
                        {qtyInCart}
                      </span>
                    )}

                    <div>
                      {/* Gambar Kotak Proporsional (rounded-md, tidak mepet garis bingkai atas karena p-2.5 seragam) */}
                      <div
                        className={cn(
                          "relative w-full flex items-center justify-center overflow-hidden rounded-md bg-muted border border-border/50 mb-2",
                          posViewMode === "compact" ? "aspect-[4/3]" : "h-28",
                        )}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            style={{
                              transform: `translate(${(product.image_position_x ?? product.image_crop_position?.x ?? 50) - 50}%, ${(product.image_position_y ?? product.image_crop_position?.y ?? 50) - 50}%) scale(${product.image_zoom || product.zoom || 1}) rotate(${product.image_rotation || product.rotation || 0}deg)`,
                              transformOrigin: "center center",
                            }}
                            className="h-full w-full object-cover pointer-events-none transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src="/logo-brand.png?v=2"
                            alt={product.name}
                            className="h-9 w-9 object-contain opacity-80"
                          />
                        )}
                        {isPromo && (
                          <span className="absolute top-1.5 left-1.5 z-10 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs">
                            PROMO
                          </span>
                        )}
                      </div>

                      {/* Nama Menu Seimbang */}
                      <p
                        className={cn(
                          "text-foreground leading-snug mb-1.5",
                          posViewMode === "compact"
                            ? "text-xs font-semibold line-clamp-1"
                            : "text-xs sm:text-sm font-bold line-clamp-2",
                        )}
                      >
                        {product.name}
                      </p>
                    </div>

                    {/* Baris Harga + Badge Kecil Varian / Stok */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <div className="flex items-baseline gap-1 min-w-0">
                        <span
                          className={cn(
                            "whitespace-nowrap",
                            posViewMode === "compact" ? "text-xs font-bold" : "text-sm font-black",
                            isPromo ? "text-rose-600 dark:text-rose-400" : "text-primary",
                          )}
                        >
                          {formatRupiah(displayPrice)}
                        </span>
                        {isPromo && posViewMode === "normal" && (
                          <span className="text-[10px] text-muted-foreground line-through whitespace-nowrap">
                            {formatRupiah(product.price)}
                          </span>
                        )}
                      </div>
                      {hasVariantsOrMods ? (
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap shrink-0">
                          {t("pos.variants", "Varian")}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                          {product.stock}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* STICKY FLOATING BAR KHUSUS LAYAR HP PORTRAIT (< 680px) */}
      <div className="fixed inset-x-3 bottom-[4.75rem] z-40 flex min-[680px]:hidden">
        <button
          type="button"
          onClick={() => setIsMobileCartDrawerOpen(true)}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-float ring-1 ring-primary-foreground/20 active:scale-95 transition-transform duration-100 cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart className="size-4 shrink-0" />
            <span className="text-xs font-black truncate">
              {t("pos.mobile_cart", "Keranjang")} ({totalCartItemCount} item) • {formatRupiah(total)}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black whitespace-nowrap shrink-0">
            <span>{t("cart.pay", "Bayar")} ➔</span>
          </span>
        </button>
      </div>

      {/* ======================================================================== */}
      {/* LANGKAH 1 — SMART CART KANAN BERSIH (HANYA DAFTAR MAKANAN & TOTAL)       */}
      {/* ======================================================================== */}
      <aside
        className={cn(
          "w-[270px] md:w-[300px] lg:w-[330px] shrink-0 h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-float min-w-0",
          isMobileCartDrawerOpen
            ? "fixed inset-0 z-50 flex w-full h-[100dvh] rounded-none min-[680px]:static min-[680px]:z-auto min-[680px]:w-[270px] md:w-[300px] lg:w-[330px] min-[680px]:h-full min-[680px]:rounded-xl"
            : "hidden min-[680px]:flex",
        )}
      >
        {/* Header Smart Cart Ringkas: Smart Cart (X item) + Tertahan + Hapus */}
        <div className="shrink-0 px-3 py-2.5 border-b border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-foreground truncate">
              {t("cart.title", "Smart Cart")}
            </h2>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-black text-primary whitespace-nowrap">
              {totalCartItemCount} item
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                playPosSound("option");
                setHeldOrdersModalOpen(true);
              }}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-bold cursor-pointer whitespace-nowrap active:scale-95 transition-transform duration-100",
                heldOrders.length > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
              title="Lihat pesanan tertahan (Hold)"
            >
              <Clock className="size-3 shrink-0" />
              {language === "en" ? (
                <span>Held ({heldOrders.length})</span>
              ) : (
                <span>Tertahan ({heldOrders.length})</span>
              )}
            </button>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                if (cart.length === 0) return;
                if (confirm("Kosongkan semua item di keranjang?")) {
                  playPosSound("option");
                  setCart([]);
                  setDiscountValue(0);
                }
              }}
              title="Kosongkan keranjang"
              aria-label="Kosongkan keranjang"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-95 transition-transform duration-100"
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileCartDrawerOpen(false)}
              title="Tutup Drawer Keranjang"
              aria-label="Tutup Drawer Keranjang"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground min-[680px]:hidden cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Daftar Item Pesanan yang Lega */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-5 text-center">
              <ShoppingCart className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-bold text-foreground">
                {t("cart.empty_title", "Keranjang kosong")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground max-w-[210px]">
                {t(
                  "cart.empty_subtitle",
                  "Ketuk kartu menu di kiri untuk langsung menambah pesanan pelanggan.",
                )}
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemKey = item.cart_item_id || item.id;
              const unitPrice = item.unit_price || item.price;
              const optionTokens: string[] = [];
              const seenOptionTokens = new Set<string>();
              const pushUniqueOptionToken = (raw?: string | null) => {
                if (!raw) return;
                String(raw)
                  .split(/[•·|,]/)
                  .map((part) => part.replace(/\s+/g, " ").trim())
                  .filter(Boolean)
                  .forEach((part) => {
                    const normalizedKey = part.replace(/^\+\s*/, "").toLowerCase();
                    if (!seenOptionTokens.has(normalizedKey)) {
                      seenOptionTokens.add(normalizedKey);
                      optionTokens.push(part);
                    }
                  });
              };

              if (item.selected_variant_groups && item.selected_variant_groups.length > 0) {
                item.selected_variant_groups.forEach((vg) => {
                  vg.options.forEach((o) => pushUniqueOptionToken(o.name));
                });
              } else if (item.variant_name || item.selected_variant?.name) {
                pushUniqueOptionToken(String(item.variant_name || item.selected_variant?.name));
              }
              if (item.selected_modifiers && item.selected_modifiers.length > 0) {
                item.selected_modifiers.forEach((mod) => pushUniqueOptionToken(mod));
              }
              if (item.selected_addons && item.selected_addons.length > 0) {
                item.selected_addons.forEach((a) => pushUniqueOptionToken(`+${a.name}`));
              }
              if (item.notes) {
                optionTokens.push(`"${item.notes}"`);
              }
              const summaryLine =
                optionTokens.length > 0
                  ? optionTokens.join(" • ")
                  : `${formatRupiah(unitPrice)} × ${item.quantity}`;

              return (
                <div
                  key={itemKey}
                  className="rounded-lg border border-border/70 bg-muted/25 px-2.5 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate flex-1">{item.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary cursor-pointer active:scale-95 transition-transform duration-100"
                        onClick={() => {
                          playPosSound("option");
                          changeQuantity(itemKey, -1);
                        }}
                        aria-label="Kurangi"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-black">{item.quantity}</span>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary cursor-pointer active:scale-95 transition-transform duration-100"
                        onClick={() => {
                          playPosSound("option");
                          changeQuantity(itemKey, 1);
                        }}
                        aria-label="Tambah"
                      >
                        <Plus className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        onClick={() => removeCartItem(itemKey)}
                        aria-label="Hapus"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-[11px] text-muted-foreground truncate flex-1"
                      title={summaryLine}
                    >
                      {summaryLine}
                    </p>
                    <span className="text-xs font-bold text-primary whitespace-nowrap shrink-0">
                      {formatRupiah(unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Smart Cart Menempel di Bawah: Subtotal / % Diskon / PB1 / Total + Tahan + Bayar */}
        <div className="shrink-0 p-2.5 border-t border-border/70 bg-card space-y-2">
          {activeCartPopover === "discount" && (
            <div className="rounded-lg border border-border bg-secondary/40 p-2 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {t("cart.cashier_discount", "Diskon Kasir")}
                </span>
                <div className="flex items-center rounded-md border border-border overflow-hidden p-0.5 bg-background">
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
                    onClick={() => {
                      setDiscountType("percent");
                      if (discountValue > 100) setDiscountValue(100);
                    }}
                  >
                    %
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={discountType === "percent" ? "Diskon (%)" : "Diskon (Rp)"}
                  value={
                    discountValue > 0
                      ? discountType === "nominal"
                        ? formatRupiahInput(discountValue)
                        : String(discountValue)
                      : ""
                  }
                  onChange={(e) => {
                    if (discountType === "nominal") {
                      const formatted = formatRupiahInput(e.target.value);
                      setDiscountValue(formatted ? parseNumberFromDots(formatted) : 0);
                    } else {
                      const sanitized = sanitizeQuantityInput(e.target.value);
                      setDiscountValue(Math.min(100, sanitized));
                    }
                  }}
                  className="w-full h-7 rounded-md border border-border bg-background px-2 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {discountValue > 0 && (
                  <button
                    type="button"
                    className="h-7 px-2 text-[11px] font-bold text-rose-500 hover:text-rose-600 shrink-0 cursor-pointer"
                    onClick={() => setDiscountValue(0)}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">
                  {t("cart.subtotal", "Subtotal")} {formatRupiah(subtotal)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveCartPopover((prev) => (prev === "discount" ? null : "discount"))
                  }
                  className={cn(
                    "inline-flex h-5 items-center gap-0.5 rounded border px-1.5 text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0",
                    activeCartPopover === "discount"
                      ? "bg-primary text-primary-foreground border-primary"
                      : discountAmount > 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        : "bg-secondary/80 text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  <Percent className="size-2.5 shrink-0" />
                  <span>
                    {discountAmount > 0
                      ? discountType === "percent"
                        ? `-${discountValue}%`
                        : `-${formatRupiah(discountAmount)}`
                      : t("cart.discount", "Diskon")}
                  </span>
                </button>
              </div>
              <span className="font-semibold text-foreground whitespace-nowrap shrink-0">
                {serviceChargeAmount > 0 && `+Layanan ${formatRupiah(serviceChargeAmount)} · `}
                {taxSettings.taxEnabled
                  ? `PB1 ${taxSettings.taxRate}% ${
                      taxSettings.taxMode === "inclusive"
                        ? formatRupiah(taxAmount)
                        : `+${formatRupiah(taxAmount)}`
                    }`
                  : ""}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-sm font-black">
              <span>{t("cart.total_bill", "Total")}</span>
              <span className="text-primary font-mono text-base">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              disabled={cart.length === 0}
              onClick={handleHoldOrder}
              className="h-10 px-2.5 rounded-md flex items-center justify-center gap-1 border-dashed border-border bg-muted text-foreground/80 hover:bg-secondary shrink-0 font-bold text-xs cursor-pointer active:scale-95 transition-transform duration-100"
              title="Simpan sementara antrean pesanan ini (Hold)"
            >
              <Clock className="size-3.5 shrink-0" />
              {language === "en" ? <span>{t("cart.hold", "Hold")}</span> : <span>Tahan</span>}
            </Button>

            <Button
              type="button"
              variant="hero"
              disabled={cart.length === 0}
              onClick={() => {
                if (activeShift?.status !== "open") {
                  toast.error(
                    "Kasir belum buka shift. Buka shift terlebih dahulu sebelum menerima transaksi.",
                    {
                      description:
                        "Buka shift kasir aktif di menu Shift & Kas agar seluruh transaksi tercatat.",
                      action: {
                        label: "Buka Shift",
                        onClick: () => {
                          navigate({ to: "/pos/shift-cash" });
                        },
                      },
                    },
                  );
                  return;
                }
                playPosSound("pay");
                setActiveCartPopover(null);
                setIsCustomerStepModalOpen(true);
              }}
              className="h-10 flex-1 rounded-md text-xs sm:text-sm shadow-brand font-bold whitespace-nowrap gap-1 active:scale-95 transition-transform duration-100"
            >
              {language === "en" ? (
                <span>
                  {t("cart.pay", "Pay")} • {formatRupiah(total)}
                </span>
              ) : (
                <span>Bayar • {formatRupiah(total)}</span>
              )}
              <ChevronRight className="size-4 shrink-0" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ======================================================================== */}
      {/* LANGKAH 2 — POPUP DATA PESANAN & PELANGGAN (createPortal Solid Card)     */}
      {/* ======================================================================== */}
      {isCustomerStepModalOpen &&
        cart.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-in fade-in">
            <div className="relative z-[9999] flex max-h-[94dvh] w-full max-w-md flex-col rounded-2xl border border-border bg-white dark:bg-slate-900 p-4 shadow-2xl space-y-3.5 overflow-y-auto">
              {/* Header Data Pesanan & Pelanggan */}
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-base font-black text-foreground">
                  {t("pos.step2_title", "Data Pesanan & Pelanggan")}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCustomerStepModalOpen(false)}
                  aria-label="Tutup popup pelanggan"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Tab Umum (Default) | Member */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    playPosSound("option");
                    setCustomerMode("public");
                    setSelectedCustomerId("");
                  }}
                  className={cn(
                    "h-9 rounded-lg text-xs font-black cursor-pointer active:scale-95 transition-transform duration-100",
                    customerMode !== "member"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("pos.guest", "Umum")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playPosSound("option");
                    setCustomerMode("member");
                  }}
                  className={cn(
                    "h-9 rounded-lg text-xs font-black cursor-pointer active:scale-95 transition-transform duration-100",
                    customerMode === "member"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("pos.member", "Member")}
                </button>
              </div>

              {/* Cari & Pilih Member (tampil saat tab Member aktif) */}
              {customerMode === "member" && (
                <div className="space-y-2 rounded-xl border border-border/80 bg-muted/25 p-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder={t("pos.search_member", "Cari nama atau no. HP member...")}
                      aria-label="Cari Member Terdaftar"
                      className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <select
                    aria-label="Pilih Member Terdaftar"
                    value={selectedCustomerId}
                    onChange={(e) => {
                      playPosSound("option");
                      const nextId = e.target.value;
                      setSelectedCustomerId(nextId);
                      if (nextId) {
                        const found = snapshot.customers.find((c) => c.id === nextId);
                        if (found) {
                          setCustomerQueueName(found.name);
                          setNewCustomerPhone(found.phone || "");
                        }
                      }
                    }}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
                  >
                    <option value="">
                      {t("pos.select_member", "Pilih Member Terdaftar")} ({filteredMemberCustomers.length})
                    </option>
                    {filteredMemberCustomers.map((c) => {
                      const pts = c.points ?? Math.floor((c.total_spend || 0) / 10000);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({pts} Poin · {c.visits}x)
                        </option>
                      );
                    })}
                  </select>

                  {selectedCustomerId && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs">
                      <span className="font-black text-primary truncate">
                        {snapshot.customers.find((c) => c.id === selectedCustomerId)?.name ||
                          t("pos.active_member", "Member Aktif")}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playPosSound("option");
                          setSelectedCustomerId("");
                          setCustomerQueueName("");
                          setNewCustomerPhone("");
                        }}
                        aria-label="Lepas member"
                        className="flex size-5 shrink-0 items-center justify-center rounded bg-background/80 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tipe Pesanan Aktif (4 tombol sejajar: Take Away default hijau, Dine In, Delivery, WhatsApp) + 3 Ojol disabled */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">
                  {t("pos.order_type", "Tipe Pesanan")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: "take_away", label: "Take Away" },
                      { id: "dine_in", label: "Dine In" },
                      { id: "delivery", label: "Delivery" },
                      { id: "whatsapp", label: "WhatsApp" },
                    ] as Array<{ id: PosOrderType; label: string }>
                  ).map((tItem) => (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => {
                        playPosSound("option");
                        setOrderType(tItem.id);
                      }}
                      className={cn(
                        "h-9 min-w-0 rounded-lg text-xs font-bold border flex items-center justify-center cursor-pointer text-center truncate px-2 active:scale-95 transition-transform duration-100",
                        orderType === tItem.id
                          ? tItem.id === "take_away" || tItem.id === "whatsapp"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-secondary/60 border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {tItem.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "gofood", label: "GoFood" },
                      { id: "grabfood", label: "GrabFood" },
                      { id: "shopeefood", label: "ShopeeFood" },
                    ] as Array<{ id: PosOrderType; label: string }>
                  ).map((ojol) => (
                    <button
                      key={ojol.id}
                      type="button"
                      disabled
                      title={`${ojol.label} ${t("pos.coming_soon", "segera hadir")}`}
                      className="h-8 min-w-0 rounded-lg text-[11px] font-bold border flex items-center justify-center text-center truncate px-1.5 bg-slate-700 text-slate-300 border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 cursor-not-allowed opacity-85"
                    >
                      {ojol.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Nama Pelanggan / Antrean + No. WA (Opsional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    {t("pos.customer_name", "Nama Pelanggan")}
                  </label>
                  <input
                    type="text"
                    aria-label="Nama Pelanggan / Antrean"
                    title="Nama Pelanggan / Antrean (Otomatis Daftar Member Cepat CRM)"
                    placeholder={t("pos.customer_name_placeholder", "Contoh: Budi / Antrean 12")}
                    value={customerQueueName}
                    onChange={(e) => setCustomerQueueName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    {t("pos.wa_optional", "No. WA (Opsional)")}
                  </label>
                  <input
                    type="tel"
                    aria-label="No. WA (Opsional)"
                    placeholder={t("pos.wa_placeholder", "0812xxxx (Kirim Struk WA)")}
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Tombol Tahan (Hold) + Lanjut ke Pembayaran */}
              <div className="pt-1 border-t border-border/60 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleHoldOrder}
                  className="h-11 px-3 rounded-xl flex items-center justify-center gap-1 border-dashed border-border bg-muted text-foreground/80 hover:bg-secondary shrink-0 font-bold text-xs cursor-pointer active:scale-95 transition-transform duration-100"
                  title="Simpan sementara antrean pesanan ini (Hold)"
                  aria-label="Tahan pesanan"
                >
                  <Clock className="size-4 shrink-0" />
                  <span>{language === "en" ? t("cart.hold", "Hold") : "Tahan"}</span>
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  onClick={() => {
                    playPosSound("pay");
                    setIsCustomerStepModalOpen(false);
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex-1 min-w-0 h-11 rounded-xl text-sm font-black shadow-brand gap-1.5 active:scale-95 transition-transform duration-100"
                >
                  {language === "en" ? (
                    <span>
                      {t("pos.continue_to_payment", "Continue to Payment")} • {formatRupiah(total)}
                    </span>
                  ) : (
                    <span>Lanjut ke Pembayaran • {formatRupiah(total)}</span>
                  )}
                  <ChevronRight className="size-4 shrink-0" />
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ======================================================================== */}
      {/* LANGKAH 3 — MODAL METODE PEMBAYARAN + REKOMENDASI TUNAI PINTAR (ALA LOYVERSE)   */}
      {/* ======================================================================== */}
      {isPaymentModalOpen && cart.length > 0 && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-in fade-in">
          <div className="relative z-[9999] flex max-h-[94dvh] w-full max-w-lg flex-col rounded-2xl border border-border bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header Modal Pembayaran */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/25">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      setIsCustomerStepModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ArrowLeft className="size-3" />
                    <span>{t("pos.edit_details", "Ubah Data")}</span>
                  </button>
                </div>
                <h3 className="text-base sm:text-lg font-black text-foreground mt-0.5">
                  {t("pos.payment_title", "Pembayaran Pesanan")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {totalCartItemCount} item • {activeChannelMeta.label} • {activeCustomerLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                aria-label="Tutup modal pembayaran"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body Modal Pembayaran */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Total Tagihan Besar */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("cart.total_bill", "Total Tagihan")}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-primary whitespace-nowrap">
                    {formatRupiah(total)}
                  </span>
                </div>
                {(discountAmount > 0 || serviceChargeAmount > 0 || taxAmount > 0) && (
                  <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("cart.subtotal", "Subtotal")}: {formatRupiah(subtotal)}
                    </span>
                    {discountAmount > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        {t("cart.discount", "Diskon")}: -{formatRupiah(discountAmount)}
                      </span>
                    )}
                    {serviceChargeAmount > 0 && (
                      <span>
                        Layanan ({taxSettings.serviceRate}%): +{formatRupiah(serviceChargeAmount)}
                      </span>
                    )}
                    {taxAmount > 0 && (
                      <span className="font-semibold text-foreground">
                        {taxSettings.taxName || "PB1"} ({taxSettings.taxRate}%
                        {taxSettings.taxMode === "inclusive" ? " Include" : ""}):{" "}
                        {taxSettings.taxMode === "inclusive"
                          ? formatRupiah(taxAmount)
                          : `+${formatRupiah(taxAmount)}`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Pilihan Metode Pembayaran Besar */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("cart.payment_method", "Metode Pembayaran")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ["cash", "Tunai", DollarSign, paymentSettings.cashEnabled, t("pos.cash", "Tunai")],
                    ["qris", "QRIS", QrCode, paymentSettings.qrisEnabled, "QRIS"],
                    ["ewallet", "Transfer", WalletCards, paymentSettings.transferEnabled, t("pos.transfer", "Transfer")],
                    ["card", "EDC", CreditCard, paymentSettings.cardEnabled, "EDC"],
                  ]
                    .filter((item) => item[3] !== false)
                    .map(([key, label, Icon, , displayLabel]: any) => (
                      <Button
                        key={String(key)}
                        type="button"
                        variant={paymentMethod === key ? "default" : "outline"}
                        className={cn(
                          "min-h-[48px] rounded-2xl font-bold text-xs sm:text-sm gap-1.5 active:scale-95 transition-transform duration-100",
                          paymentMethod === key && "shadow-brand",
                        )}
                        onClick={() => {
                          playPosSound("option");
                          setPaymentMethod(key as "cash" | "qris" | "ewallet" | "card");
                        }}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{String(displayLabel || label)}</span>
                      </Button>
                    ))}
                </div>
              </div>

              {/* TUNAI: Input Nominal (keyboard angka tablet) + Uang Pas + Rekomendasi Tunai Pintar + Kembalian */}
              {paymentMethod === "cash" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Kotak Nominal Uang Diterima */}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9.]*"
                      autoComplete="off"
                      enterKeyHint="done"
                      aria-label="Nominal Uang Tunai Diterima"
                      placeholder={
                        total > 0 ? formatRupiahInput(total) : "Ketik nominal uang diterima..."
                      }
                      value={cashTenderedInput}
                      onChange={(e) => {
                        const formatted = formatRupiahInput(e.target.value);
                        setCashTenderedInput(formatted);
                        setCashTendered(parseNumberFromDots(formatted));
                      }}
                      className={cn(
                        "h-12 rounded-2xl bg-background pl-11 pr-16 text-right font-mono text-xl font-black",
                        cashTendered > 0 &&
                          cashTendered < total &&
                          "border-rose-500 focus-visible:ring-rose-500",
                      )}
                    />
                    {cashTenderedInput && (
                      <button
                        type="button"
                        onClick={handleClearCashTendered}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-rose-500 cursor-pointer"
                        title="Kembali ke Uang Pas"
                      >
                        {t("pos.exact_short", "Pas")}
                      </button>
                    )}
                  </div>

                  {/* Rekomendasi Tunai Pintar ala Loyverse: Uang Pas + maks. 3 pecahan > total */}
                  {(() => {
                    const smartCashOptions = [
                      { label: t("pos.exact_cash", "Uang Pas"), val: total, exact: true },
                      ...getSmartCashSuggestions(total).map((val) => ({
                        label: formatRupiahInput(val),
                        val,
                        exact: false,
                      })),
                    ];
                    return (
                      <div
                        className={cn(
                          "grid gap-1.5",
                          smartCashOptions.length >= 4
                            ? "grid-cols-4"
                            : smartCashOptions.length === 3
                              ? "grid-cols-3"
                              : "grid-cols-2",
                        )}
                        aria-label="Rekomendasi Tunai Pintar"
                      >
                        {smartCashOptions.map((btn) => {
                          const isActive = btn.exact
                            ? cashTendered === 0 || cashTendered === total
                            : cashTendered === btn.val;
                          return (
                            <Button
                              key={`${btn.exact ? "exact" : "cash"}-${btn.val}`}
                              type="button"
                              variant={isActive ? "default" : "outline"}
                              className="min-h-[48px] rounded-xl text-sm font-black px-1.5 active:scale-95 transition-transform duration-100"
                              onClick={() => {
                                playPosSound("option");
                                setCashTendered(btn.val);
                                setCashTenderedInput(formatRupiahInput(btn.val));
                              }}
                            >
                              {btn.label}
                            </Button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Kembalian / Kurang Bayar Besar & Jelas */}
                  <div
                    className={cn(
                      "rounded-2xl border px-4 py-3 flex items-center justify-between",
                      cashTendered > 0 && cashTendered < total
                        ? "border-rose-500/30 bg-rose-500/10"
                        : "border-emerald-500/30 bg-emerald-500/10",
                    )}
                  >
                    {cashTendered > 0 && cashTendered < total ? (
                      <>
                        <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                          {t("pos.short_cash", "Kurang Bayar")}
                        </span>
                        <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                          -{formatRupiah(total - cashTendered)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {t("pos.change", "Kembalian")}
                        </span>
                        <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(Math.max(0, (cashTendered || total) - total))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* QRIS Info Card: Tampilkan QRIS Statis langsung jika diunggah, atau peringatan + shortcut jika belum dikonfigurasi */}
              {paymentMethod === "qris" && (
                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center space-y-2.5">
                  {hasAutoAmountQris ? (
                    <>
                      <QrCode className="mx-auto size-9 text-primary" />
                      <p className="text-sm font-black text-foreground">
                        QRIS Dinamis Otomatis • {formatRupiah(total)}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        QRIS toko dikonversi menjadi QRIS Dinamis EMVCo — nominal{" "}
                        <strong className="text-foreground">{formatRupiah(total)}</strong> langsung terisi
                        otomatis saat pelanggan scan. Kasir cukup 1-klik Konfirmasi Lunas setelah dana masuk.
                      </p>
                    </>
                  ) : paymentSettings.qrisStaticImageUrl || paymentSettings.qrisStaticPayload ? (
                    <>
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        QRIS Statis Resmi Toko • Tagihan {formatRupiah(total)}
                      </p>
                      {paymentSettings.qrisStaticImageUrl ? (
                        <div className="mx-auto size-52 overflow-hidden rounded-2xl border border-border bg-white p-2.5 shadow-xs flex items-center justify-center">
                          <img
                            src={paymentSettings.qrisStaticImageUrl}
                            alt="QRIS Statis Resmi Toko"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <QrCode className="mx-auto size-9 text-primary" />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Pelanggan memindai QRIS Statis murni toko sebesar{" "}
                        <strong className="text-foreground">{formatRupiah(total)}</strong>.
                      </p>
                    </>
                  ) : paymentSettings.qrisNmid ? (
                    <>
                      <QrCode className="mx-auto size-9 text-primary" />
                      <p className="text-sm font-black text-foreground">Pembayaran QRIS Dinamis Resmi</p>
                      <p className="text-xs text-muted-foreground">
                        Kode QRIS dinamis outlet (NMID: <span className="font-mono font-bold">{paymentSettings.qrisNmid}</span>) sebesar{" "}
                        <strong className="text-foreground">{formatRupiah(total)}</strong> akan dibuka dengan verifikasi real-time.
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2.5 py-1">
                      <QrCode className="mx-auto size-9 text-muted-foreground" />
                      <p className="text-sm font-black text-foreground">
                        QRIS Belum Dikonfigurasi
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Unggah gambar QRIS Statis resmi toko atau isi NMID QRIS di halaman Pengaturan Pembayaran terlebih dahulu.
                      </p>
                      {(isOwner || normalizedRole === "manager") && (
                        <div className="pt-1">
                          <Link
                            to="/payment"
                            data-route="/settings/payment"
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-brand hover:opacity-95 transition-all"
                          >
                            <SlidersHorizontal className="size-3.5" />
                            <span>Buka Pengaturan Pembayaran</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Transfer / EDC Info Card */}
              {(paymentMethod === "ewallet" || paymentMethod === "card") && (
                <div className="rounded-2xl border border-border bg-muted/35 p-4 text-center space-y-1.5">
                  {paymentMethod === "ewallet" ? (
                    <WalletCards className="mx-auto size-8 text-primary" />
                  ) : (
                    <CreditCard className="mx-auto size-8 text-primary" />
                  )}
                  <p className="text-sm font-black text-foreground">
                    {paymentMethod === "ewallet"
                      ? "Konfirmasi Transfer / E-Wallet"
                      : "Konfirmasi Mesin EDC"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pastikan nominal <strong className="text-foreground">{formatRupiah(total)}</strong>{" "}
                    sudah berhasil diterima sebelum mencetak struk.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Final CTA Modal Pembayaran: Tahan (Hold) + Selesaikan */}
            <div className="border-t border-border p-4 bg-muted/20 flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingCheckout || cart.length === 0}
                onClick={handleHoldOrder}
                className="min-h-[52px] px-3.5 rounded-2xl flex items-center justify-center gap-1 border-dashed border-border bg-muted text-foreground/80 hover:bg-secondary shrink-0 font-bold text-xs cursor-pointer active:scale-95 transition-transform duration-100"
                title="Simpan sementara antrean pesanan ini (Hold)"
                aria-label="Tahan pesanan"
              >
                <Clock className="size-4 shrink-0" />
                <span>{language === "en" ? t("cart.hold", "Hold") : "Tahan"}</span>
              </Button>
              <Button
                type="button"
                variant="hero"
                disabled={
                  isSubmittingCheckout ||
                  cart.length === 0 ||
                  (paymentMethod === "cash" && cashTendered > 0 && cashTendered < total)
                }
                onClick={async () => {
                  if (isSubmittingCheckout) return;
                  playPosSound("pay");
                  setIsSubmittingCheckout(true);
                  try {
                    await checkout();
                  } finally {
                    setIsSubmittingCheckout(false);
                  }
                }}
                className="min-h-[52px] flex-1 min-w-0 rounded-2xl text-base font-black shadow-brand gap-2 active:scale-95 transition-transform duration-100"
              >
                {isSubmittingCheckout ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t("pos.processing", "Memproses...")}</span>
                  </>
                ) : paymentMethod === "qris" ? (
                  <>
                    <QrCode className="size-4 shrink-0" />
                    <span>
                      {t("pos.show_qris", "Tampilkan QRIS")} • {formatRupiah(total)}
                    </span>
                  </>
                ) : (
                  <>
                    <Printer className="size-4 shrink-0" />
                    {language === "en" ? (
                      <span>{t("pos.complete_and_print", "Complete & Print Receipt")}</span>
                    ) : (
                      <span>Selesaikan &amp; Cetak Struk</span>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* PRODUCT CUSTOMIZATION MODAL KOMPAK 1-LAYAR (TABLET-FIRST) */}
      {customizingProduct &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-2.5 sm:p-4 animate-in fade-in">
            <div className="relative z-[9999] flex max-h-[94dvh] w-full max-w-lg flex-col rounded-2xl border border-border bg-white dark:bg-slate-900 opacity-100 shadow-2xl overflow-hidden">
              {/* Modal Header Kompak (h-11, thumbnail w-9 h-9, judul text-sm font-bold + harga dasar inline) */}
              <div className="flex h-11 shrink-0 items-center justify-between gap-2.5 border-b border-border bg-muted/50 px-3.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="relative w-9 h-9 overflow-hidden rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black shrink-0 border border-border/50">
                    {customizingProduct.image_url ? (
                      <img
                        src={customizingProduct.image_url}
                        alt={customizingProduct.name}
                        style={{
                          transform: `translate(${(customizingProduct.image_position_x ?? customizingProduct.image_crop_position?.x ?? 50) - 50}%, ${(customizingProduct.image_position_y ?? customizingProduct.image_crop_position?.y ?? 50) - 50}%) scale(${customizingProduct.image_zoom || customizingProduct.zoom || 1}) rotate(${customizingProduct.image_rotation || customizingProduct.rotation || 0}deg)`,
                          transformOrigin: "center center",
                        }}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    ) : (
                      <UtensilsCrossed className="size-4" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {customizingProduct.name}
                    </h3>
                    {customizingProduct.promo_price &&
                    customizingProduct.promo_price < customizingProduct.price ? (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
                        {formatRupiah(customizingProduct.promo_price)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-primary whitespace-nowrap shrink-0">
                        {formatRupiah(customizingProduct.price)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingProduct(null)}
                  aria-label="Tutup modal varian"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal Body Kompak (p-3.5, tanpa kotak besar berlapis, semua grup muat 1 layar) */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
                {customizingProduct.variant_groups &&
                customizingProduct.variant_groups.length > 0 ? (
                  <div className="space-y-2">
                    {customizingProduct.variant_groups.map((group, gIdx) => {
                      const gKey = group.id || group.name || `group-${gIdx}`;
                      const currentSelections = selectedGroupOptions[gKey] || [];
                      const isSingle = group.selection_type === "single";
                      const isGroupRequired = isVariantGroupRequired(customizingProduct, group);

                      return (
                        <div
                          key={gKey}
                          className="space-y-1.5 pt-2 border-t border-border/50 first:pt-0 first:border-t-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-black text-foreground">
                                {gIdx + 1}. {group.name}
                              </span>
                              {isGroupRequired ? (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                                  Pilihan wajib dipilih
                                </span>
                              ) : (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                  Opsional
                                </span>
                              )}
                            </div>
                            {!isSingle && (
                              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                                Bisa pilih &gt;1
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
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
                                    playPosSound("option");
                                    if (isSingle) {
                                      setSelectedGroupOptions((prev) => {
                                        const current = prev[gKey] || [];
                                        const alreadySelected = current[0]?.name === opt.name;
                                        if (alreadySelected && !isGroupRequired) {
                                          return { ...prev, [gKey]: [] };
                                        }
                                        return { ...prev, [gKey]: [opt] };
                                      });
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
                                    "flex flex-col items-center justify-center py-1.5 px-2.5 text-xs rounded-lg border text-center cursor-pointer min-h-[34px] active:scale-95 transition-transform duration-100",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                                      : "border-border bg-secondary/40 hover:bg-secondary text-foreground font-semibold",
                                  )}
                                >
                                  <span className="truncate max-w-full leading-tight">
                                    {opt.name}
                                  </span>
                                  {optPrice > 0 && (
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold leading-tight mt-0.5 whitespace-nowrap",
                                        isSelected ? "text-primary-foreground/90" : "text-primary",
                                      )}
                                    >
                                      +{formatRupiah(optPrice)}
                                    </span>
                                  )}
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
                  <div className="space-y-2">
                    {customizingProduct.variants && customizingProduct.variants.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-foreground">
                            1. Pilihan Ukuran / Varian
                          </span>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            Wajib
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {customizingProduct.variants.map((variant) => {
                            const isSelected = selectedVariant?.name === variant.name;
                            return (
                              <button
                                key={variant.name}
                                type="button"
                                onClick={() => {
                                  playPosSound("option");
                                  setSelectedVariant(variant);
                                }}
                                className={cn(
                                  "flex flex-col items-center justify-center py-1.5 px-2.5 text-xs rounded-lg border text-center cursor-pointer min-h-[34px] active:scale-95 transition-transform duration-100",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                                    : "border-border bg-secondary/40 hover:bg-secondary text-foreground font-semibold",
                                )}
                              >
                                <span className="truncate max-w-full leading-tight">
                                  {variant.name}
                                </span>
                                {variant.price_adjustment > 0 && (
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold leading-tight mt-0.5 whitespace-nowrap",
                                      isSelected ? "text-primary-foreground/90" : "text-primary",
                                    )}
                                  >
                                    +{formatRupiah(variant.price_adjustment)}
                                  </span>
                                )}
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
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <span className="text-xs font-black text-foreground block">
                            2. Tingkat Pedas
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {levelMods.map((mod) => {
                              const isSelected = selectedLevel?.name === mod.name;
                              return (
                                <button
                                  key={mod.name}
                                  type="button"
                                  onClick={() => {
                                    playPosSound("option");
                                    setSelectedLevel(mod);
                                  }}
                                  className={cn(
                                    "flex flex-col items-center justify-center py-1.5 px-2.5 text-xs rounded-lg border text-center cursor-pointer min-h-[34px] active:scale-95 transition-transform duration-100",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                                      : "border-border bg-secondary/40 hover:bg-secondary text-foreground font-semibold",
                                  )}
                                >
                                  <span className="truncate max-w-full leading-tight">
                                    {mod.name}
                                  </span>
                                  {mod.price_adjustment > 0 && (
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold leading-tight mt-0.5 whitespace-nowrap",
                                        isSelected ? "text-primary-foreground/90" : "text-primary",
                                      )}
                                    >
                                      +{formatRupiah(mod.price_adjustment)}
                                    </span>
                                  )}
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
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <span className="text-xs font-black text-foreground block">
                            Instruksi Dapur
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {prepMods.map((mod) => {
                              const isSelected = selectedPreps.includes(mod.name);
                              return (
                                <button
                                  key={mod.name}
                                  type="button"
                                  onClick={() => {
                                    playPosSound("option");
                                    setSelectedPreps((prev) =>
                                      isSelected
                                        ? prev.filter((p) => p !== mod.name)
                                        : [...prev, mod.name],
                                    );
                                  }}
                                  className={cn(
                                    "py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer truncate active:scale-95 transition-transform duration-100",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                                      : "border-border bg-secondary/40 hover:bg-secondary text-foreground",
                                  )}
                                >
                                  {mod.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Catatan Pesanan Ringkas 1 Baris */}
                <div className="pt-2 border-t border-border/50">
                  <input
                    type="text"
                    placeholder="Catatan pesanan khusus (opsional, cth: saus dipisah)..."
                    aria-label="Catatan Pesanan Khusus"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Modal Sticky Footer Ringkas 1 Baris: Stepper Kuantitas + Tambah ke Keranjang */}
              <div className="shrink-0 border-t border-border px-3.5 py-2.5 bg-muted/20 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-lg active:scale-95 transition-transform duration-100"
                    disabled={customizeQuantity <= 1}
                    onClick={() => {
                      playPosSound("option");
                      setCustomizeQuantity((q) => Math.max(1, q - 1));
                    }}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-7 text-center text-xs font-black">{customizeQuantity}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 rounded-lg active:scale-95 transition-transform duration-100"
                    onClick={() => {
                      playPosSound("option");
                      setCustomizeQuantity((q) => q + 1);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="hero"
                  className="flex-1 h-10 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-brand gap-1.5 whitespace-nowrap active:scale-95 transition-transform duration-100"
                  onClick={handleConfirmVariant}
                >
                  <span>{t("pos.add_to_cart", "Tambah ke Keranjang")}</span>
                  <span>•</span>
                  <span>{formatRupiah(calculatedItemTotal)}</span>
                </Button>
              </div>
            </div>
          </div>,
          document.body,
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
                  {qrisModalData.auto_amount
                    ? "Dinamis EMVCo • Nominal Otomatis"
                    : qrisModalData.mode === "static"
                      ? "Statis • QRIS Resmi Toko"
                      : "Dinamis • ASPI / BI"}
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 transition-colors",
                  qrisStatus === "PAID"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted text-foreground/75",
                )}
              >
                {qrisStatus === "PAID" ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    Lunas
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-muted animate-pulse" />
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
                    {qrisModalData.mode === "static"
                      ? "Pembayaran QRIS Statis dikonfirmasi diterima oleh kasir."
                      : "Verifikasi pembayaran realtime webhook berhasil."}
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
                {qrisPersistError ? (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300 font-semibold space-y-2 text-left">
                    <p className="font-black inline-flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Order belum tersimpan ke database</span>
                    </p>
                    <p className="font-medium">
                      {qrisPersistError}. Keranjang tidak dikosongkan dan struk belum dicetak.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full h-10 rounded-xl text-xs font-bold gap-1.5"
                      disabled={isRetryingQrisPersist}
                      onClick={handleRetryQrisPersist}
                    >
                      <RefreshCw className={cn("size-3.5", isRetryingQrisPersist && "animate-spin")} />
                      Simpan Ulang Order
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
                    <Printer className="size-3.5" />
                    Struk otomatis dicetak ke printer kasir & laci kas terbuka.
                  </div>
                )}
                <Button
                  variant="hero"
                  className="w-full h-12 rounded-2xl font-bold shadow-brand"
                  disabled={isRetryingQrisPersist}
                  onClick={() => {
                    if (
                      qrisPersistError &&
                      typeof window !== "undefined" &&
                      !window.confirm(
                        "Order QRIS ini BELUM tersimpan ke database. Tutup tanpa menyimpan? (Keranjang tetap utuh)",
                      )
                    ) {
                      return;
                    }
                    setIsQrisModalOpen(false);
                    setQrisStatus("PENDING");
                    setQrisModalData(null);
                    setQrisPendingOrder(null);
                    setQrisPersistError(null);
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
                  {qrisDisplayQrSrc ? (
                    <img
                      src={qrisDisplayQrSrc}
                      alt={
                        qrisModalData.auto_amount
                          ? "QRIS Dinamis Nominal Otomatis"
                          : qrisModalData.mode === "static"
                            ? "QRIS Statis Resmi Toko"
                            : "QRIS Dinamis"
                      }
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="px-4 text-center space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        QRIS toko belum dikonfigurasi. Unggah gambar QRIS Statis atau atur NMID resmi di Pengaturan Pembayaran.
                      </p>
                      {(isOwner || normalizedRole === "manager") && (
                        <Link
                          to="/payment"
                          data-route="/settings/payment"
                          onClick={() => setIsQrisModalOpen(false)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs"
                        >
                          Buka Pengaturan Pembayaran
                        </Link>
                      )}
                    </div>
                  )}
                  {!qrisModalData.qr_image_url && qrisDisplayQrSrc && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 shadow-sm">
                        <span className="text-[10px] font-black text-red-600 tracking-tighter">QRIS</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-muted/40 p-3 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center justify-center gap-1.5">
                    <RadioTower className="size-3.5 text-primary animate-pulse" />
                    {qrisModalData.auto_amount
                      ? "QRIS Dinamis — Nominal Otomatis Terisi Saat Di-scan"
                      : qrisModalData.mode === "static"
                        ? "Pindai QRIS Statis Toko & Pastikan Nominal Sesuai"
                        : "Menunggu Pelanggan Memindai QRIS"}
                  </p>
                  <p className="text-[11px]">
                    {qrisModalData.auto_amount
                      ? "Pelanggan cukup scan tanpa mengetik angka. Setelah dana masuk, kasir tekan Konfirmasi Lunas."
                      : qrisModalData.mode === "static"
                        ? "Setelah dana benar-benar masuk, kasir menekan tombol Konfirmasi Pembayaran Diterima."
                        : "Dapat dipindai via GoPay, OVO, ShopeePay, Dana, BCA, Mandiri, & Semua m-Banking."}
                  </p>
                </div>

                {/* Action Buttons */}
                {qrisModalData.mode === "static" ? (
                  <div className={cn("grid gap-2 pt-1", "grid-cols-1")}>
                    <Button
                      type="button"
                      className="h-11 rounded-xl text-xs font-bold gap-1.5 shadow-brand"
                      disabled={isCheckingQris || isSettlingQris}
                      onClick={handleConfirmStaticQrisPayment}
                    >
                      <CheckCircle2 className="size-4" />
                      {qrisModalData.auto_amount
                        ? "Konfirmasi Lunas (Dana Diterima)"
                        : "Konfirmasi Pembayaran Diterima"}
                    </Button>
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
                  </div>
                ) : (
                  <div
                    className={cn(
                      "grid gap-2 pt-1",
                      import.meta.env.DEV ? "grid-cols-2" : "grid-cols-1",
                    )}
                  >
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

                    {import.meta.env.DEV && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl text-xs font-semibold border-border bg-muted text-foreground/75 hover:bg-muted gap-1.5"
                        onClick={handleSimulateQrisPayment}
                      >
                        <Zap className="size-3.5 text-foreground/75" />
                        Simulasi Bayar (Test)
                      </Button>
                    )}
                  </div>
                )}

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
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/75">
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
                              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-black text-foreground/75">
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
              <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm leading-6 text-foreground/75">
                {item.ai_alert}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomersPage({
  snapshot,
  isLoading = false,
}: {
  snapshot: Snapshot;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const outletNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (snapshot.outlets || []).forEach((o) => {
      if (o.id && o.name) map[o.id] = o.name;
    });
    return map;
  }, [snapshot.outlets]);

  const orderMetadataMap = useMemo(() => {
    const map: Record<string, any> = {};
    (snapshot.outlets || []).forEach((o) => {
      const meta = ((o as any).settings as any)?.order_metadata || {};
      Object.entries(meta).forEach(([ordId, data]) => {
        map[ordId] = { ...(map[ordId] || {}), ...(data as any), outlet_id: (data as any)?.outlet_id || o.id, outlet_name: (data as any)?.outlet_name || o.name };
      });
    });
    return map;
  }, [snapshot.outlets]);

  const getCleanFavoriteProduct = (customer: Customer): string | null => {
    const raw = String(customer.favorite_product || "").trim();
    const custName = String(customer.name || "").trim().toLowerCase();
    if (!raw || raw.toLowerCase() === custName || raw.toLowerCase().startsWith("order pos #")) {
      return null;
    }
    return raw;
  };

  const customers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.customers;
    return snapshot.customers.filter((c) => {
      const cleanFav = getCleanFavoriteProduct(c) || "";
      return (
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q) ||
        cleanFav.toLowerCase().includes(q)
      );
    });
  }, [snapshot.customers, searchQuery]);

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const custNameLower = String(selectedCustomer.name || "").trim().toLowerCase();
    return (snapshot.orders || [])
      .filter((ord: SalesOrder & Record<string, any>) => {
        const meta = orderMetadataMap[ord.id];
        const ordCustName = String(
          ord.customer_name || meta?.customer_name || meta?.queue_name || "",
        )
          .trim()
          .toLowerCase();
        return (
          (ord.customer_id && ord.customer_id === selectedCustomer.id) ||
          (custNameLower && ordCustName === custNameLower)
        );
      })
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
  }, [selectedCustomer, snapshot.orders, orderMetadataMap]);

  const orderItemsByOrderId = useMemo(() => {
    const map: Record<string, any[]> = {};
    (snapshot.orderItems || []).forEach((it: any) => {
      if (!it?.order_id) return;
      if (!map[it.order_id]) map[it.order_id] = [];
      map[it.order_id]!.push(it);
    });
    return map;
  }, [snapshot.orderItems]);

  return (
    <div className="space-y-6 w-full max-w-none">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageTitle
          title={t("crm.title", "Customer CRM")}
          subtitle={t(
            "crm.subtitle",
            "Profil pelanggan, riwayat belanja, favorit, dan insight AI dalam satu pandangan.",
          )}
        />
        {snapshot.customers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <div className="relative min-w-[16rem] flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau no. HP..."
                aria-label="Cari pelanggan"
                className="pl-10 pr-8 h-11 rounded-2xl text-xs bg-card"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <span className="inline-flex items-center justify-center rounded-2xl border border-border bg-card px-3.5 h-11 text-xs font-bold text-muted-foreground whitespace-nowrap">
              {customers.length} / {snapshot.customers.length} Pelanggan
            </span>
          </div>
        )}
      </div>

      {isLoading && snapshot.customers.length === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Memuat database pelanggan CRM...</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`crm-skel-${idx}`}
                className="rounded-[1.5rem] border border-border bg-card p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-36 rounded bg-muted" />
                    <div className="h-3 w-48 rounded bg-muted/70" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-2xl bg-muted/60" />
                  <div className="h-16 rounded-2xl bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : snapshot.customers.length === 0 ? (
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
      ) : customers.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-card/60 p-10 text-center">
          <Search className="mx-auto size-8 text-muted-foreground/40 mb-2" />
          <h3 className="text-base font-black">Pelanggan Tidak Ditemukan</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tidak ada pelanggan yang cocok dengan kata kunci "{searchQuery}".
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {customers.map((customer) => {
            const cleanFav = getCleanFavoriteProduct(customer);
            return (
              <div
                key={customer.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCustomer(customer)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCustomer(customer);
                  }
                }}
                className="group rounded-[1.5rem] border border-border bg-card p-5 shadow-soft cursor-pointer transition-all hover:border-primary/40 hover:shadow-md text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <UsersRound className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black tracking-normal truncate">
                        {customer.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {t("crm.favorite", "Favorit")}: {cleanFav || "Belum ada data"}
                      </p>
                      {customer.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Lihat riwayat transaksi ${customer.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomer(customer);
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground group-hover:bg-secondary group-hover:text-primary transition-colors cursor-pointer"
                  >
                    <ChevronRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
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
                  <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm leading-6 text-foreground/75">
                    {customer.ai_insight}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DETAIL & RIWAYAT TRANSAKSI PELANGGAN */}
      {selectedCustomer &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 animate-in fade-in"
            onClick={() => setSelectedCustomer(null)}
          >
            <div
              className="relative z-[9999] w-full max-w-xl rounded-[2rem] border border-border bg-white dark:bg-slate-900 opacity-100 p-6 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <UsersRound className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black truncate">{selectedCustomer.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomer.phone ? `HP: ${selectedCustomer.phone} · ` : ""}
                    Detail & Riwayat Transaksi Pelanggan
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl size-8 shrink-0"
                onClick={() => setSelectedCustomer(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Kunjungan</p>
                <p className="text-lg font-black mt-0.5">{selectedCustomer.visits}x</p>
              </div>
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Total Belanja</p>
                <p className="text-lg font-black mt-0.5 tabular-nums">
                  {formatRupiah(selectedCustomer.total_spend)}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Menu Favorit</p>
                <p className="text-sm font-black mt-1 truncate">
                  {getCleanFavoriteProduct(selectedCustomer) || "Belum ada data"}
                </p>
              </div>
            </div>

            {selectedCustomer.ai_insight && (
              <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-foreground/80">
                {selectedCustomer.ai_insight}
              </p>
            )}

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Riwayat Transaksi ({selectedCustomerOrders.length})
                </p>
              </div>

              {selectedCustomerOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
                  <ReceiptText className="mx-auto size-7 opacity-40 mb-1.5" />
                  <p className="font-bold text-foreground/80">Belum ada transaksi tertaut</p>
                  <p className="mt-1">
                    Transaksi POS yang memilih member ini akan tampil otomatis di sini.
                  </p>
                </div>
              ) : (
                selectedCustomerOrders.map((ord: SalesOrder & Record<string, any>) => {
                  const meta = orderMetadataMap[ord.id];
                  const items = orderItemsByOrderId[ord.id] || [];
                  const outletLabel =
                    (ord.outlet_id && outletNameById[ord.outlet_id]) ||
                    meta?.outlet_name ||
                    ord.outlet_name ||
                    "Outlet Aktif";
                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl border border-border/70 bg-secondary/50 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-black text-sm text-foreground">
                            {ord.order_number}
                          </span>
                          <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-bold capitalize">
                            {ord.status || "paid"}
                          </span>
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold uppercase">
                            {ord.payment_method}
                          </span>
                        </div>
                        <span className="font-black text-sm text-primary tabular-nums shrink-0">
                          {formatRupiah(ord.total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Store className="size-3.5" />
                          {outletLabel}
                        </span>
                        {ord.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {new Date(ord.created_at).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      {items.length > 0 && (
                        <div className="pt-2 border-t border-border/50 space-y-1">
                          {items.map((it: any, iIdx: number) => (
                            <div
                              key={it.id || iIdx}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-foreground/85 truncate">
                                {it.quantity}x {it.name}
                              </span>
                              <span className="font-semibold text-muted-foreground tabular-nums shrink-0">
                                {formatRupiah(it.subtotal || it.unit_price * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold"
                onClick={() => setSelectedCustomer(null)}
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
                  <Bar dataKey="value" fill="var(--color-primary)" maxBarSize={36} radius={[0, 8, 8, 0]} />
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
  isPosOrders = false,
  isLoading = false,
}: {
  snapshot: Snapshot;
  onRefresh?: () => Promise<void>;
  isPosOrders?: boolean;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const normalizedRole = (snapshot.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "hq"].includes(normalizedRole);

  const [dbOutlets, setDbOutlets] = useState<OutletItem[]>(() =>
    (snapshot.outlets || []).filter((o) => !isOutletDeletedOrArchived(o)),
  );

  useEffect(() => {
    const incomingOutlets = (snapshot.outlets || []).filter((o) => !isOutletDeletedOrArchived(o));
    if (incomingOutlets.length > 0) {
      setDbOutlets((prev) => {
        const map = new Map<string, OutletItem>();
        prev.forEach((o) => map.set(o.id, o));
        incomingOutlets.forEach((o) => map.set(o.id, o));
        const merged = Array.from(map.values());
        if (merged.length === prev.length && merged.every((item, idx) => item.id === prev[idx]?.id)) {
          return prev;
        }
        return merged;
      });
    }
    let isCancelled = false;
    getOutletList(snapshot.businessId || undefined)
      .then((list) => {
        if (isCancelled || !list || list.length === 0) return;
        const fetched: OutletItem[] = list
          .filter((o: any) => !isOutletDeletedOrArchived(o))
          .map((o: any) => ({
            id: o.id,
            name: o.name,
            code: o.code || "",
            address: o.address || "",
            active: !isOutletDeletedOrArchived(o),
            settings: (o.settings as any) || {},
          }));
        setDbOutlets((prev) => {
          const map = new Map<string, OutletItem>();
          prev.forEach((o) => map.set(o.id, o));
          fetched.forEach((o) => map.set(o.id, { ...(map.get(o.id) || {}), ...o }));
          const merged = Array.from(map.values());
          if (
            merged.length === prev.length &&
            merged.every(
              (item, idx) =>
                item.id === prev[idx]?.id &&
                item.name === prev[idx]?.name &&
                JSON.stringify(item.settings?.order_metadata || {}) ===
                  JSON.stringify(prev[idx]?.settings?.order_metadata || {}),
            )
          ) {
            return prev;
          }
          return merged;
        });
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [snapshot.businessId, snapshot.outlets]);

  const activeOutlets = useMemo(
    () => dbOutlets.filter((o) => !isOutletDeletedOrArchived(o)),
    [dbOutlets],
  );
  const assignedOutletId =
    snapshot.assignedOutletId ||
    (activeOutlets.length > 0 && activeOutlets[0] ? activeOutlets[0].id : "all");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>(() => {
    if (!isOwner) return assignedOutletId;
    if (isPosOrders && typeof window !== "undefined") {
      const activePosId =
        localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
        localStorage.getItem("kebabschoicepos_active_outlet_id");
      if (activePosId && activePosId !== "all") return activePosId;
    }
    return "all";
  });

  useEffect(() => {
    if (!isOwner) {
      const lockedId =
        snapshot.assignedOutletId ||
        (activeOutlets.length > 0 && activeOutlets[0] ? activeOutlets[0].id : "all");
      if (selectedOutletFilter !== lockedId) {
        setSelectedOutletFilter(lockedId);
      }
    }
  }, [isOwner, snapshot.assignedOutletId, activeOutlets, selectedOutletFilter]);

  useEffect(() => {
    if (!isPosOrders || !isOwner) return;
    const handlePosOutletChange = (e: any) => {
      const nextId =
        e?.detail?.outletId ||
        localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
        localStorage.getItem("kebabschoicepos_active_outlet_id");
      if (nextId && nextId !== "all") {
        setSelectedOutletFilter(nextId);
      }
    };
    window.addEventListener("outlet:changed", handlePosOutletChange);
    return () => window.removeEventListener("outlet:changed", handlePosOutletChange);
  }, [isPosOrders, isOwner]);
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
          map.set(o.id, existing ? { ...o, ...existing } : o);
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

  const isTodayLocal = (dateString?: string) =>
    isDateWithinFilter(dateString, { dateRange: "today" });

  const isWithinDaysLocal = (dateString?: string) =>
    isDateWithinFilter(dateString, { dateRange: "last_7_days" });

  const isThisMonthLocal = (dateString?: string) =>
    isDateWithinFilter(dateString, { dateRange: "this_month" });

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

  const outletNameById = useMemo(() => {
    const map: Record<string, string> = {};
    dbOutlets.forEach((out) => {
      if (out.id && out.name) map[out.id] = out.name;
    });
    return map;
  }, [dbOutlets]);

  const orderMetadataMap = useMemo(() => {
    const map: Record<
      string,
      {
        outlet_id?: string;
        outlet_name?: string;
        staff_name?: string;
        queue_name?: string | null;
        customer_name?: string | null;
        customer_phone?: string | null;
        order_type?: string | null;
        table_number?: string | null;
        ojol_order_code?: string | null;
        notes?: string | null;
        subtotal?: number;
        discount_amount?: number;
        service_charge?: number;
        tax_amount?: number;
        cash_received?: number;
        change_amount?: number;
      }
    > = {};

    // 1. From outlets.settings.order_metadata
    dbOutlets.forEach((out) => {
      const meta = ((out as any).settings as any)?.order_metadata || {};
      Object.entries(meta).forEach(([ordId, data]: [string, any]) => {
        map[ordId] = {
          ...(map[ordId] || {}),
          ...data,
          outlet_id: data?.outlet_id || out.id,
          outlet_name: data?.outlet_name || out.name,
          staff_name: data?.staff_name || data?.displayName || "Kasir",
        };
      });
    });

    // 2. From snapshot.orderItems selected_options.order_meta (if present)
    ((snapshot as any).orderItems || []).forEach((it: any) => {
      const itemMeta = it?.selected_options?.order_meta;
      if (it?.order_id && itemMeta && typeof itemMeta === "object") {
        const existing = map[it.order_id] || {};
        map[it.order_id] = {
          ...existing,
          outlet_id: existing.outlet_id || itemMeta.outlet_id,
          outlet_name:
            existing.outlet_name ||
            itemMeta.outlet_name ||
            (itemMeta.outlet_id ? outletNameById[itemMeta.outlet_id] : undefined),
          staff_name: existing.staff_name || itemMeta.cashier_name || "Kasir",
          queue_name: existing.queue_name || itemMeta.queue_name || null,
          customer_name: existing.customer_name || itemMeta.customer_name || null,
          order_type: existing.order_type || itemMeta.order_type || null,
          table_number: existing.table_number || itemMeta.table_number || null,
          ojol_order_code: existing.ojol_order_code || itemMeta.ojol_order_code || null,
          subtotal: existing.subtotal ?? itemMeta.subtotal,
          discount_amount: existing.discount_amount ?? itemMeta.discount_amount,
          service_charge: existing.service_charge ?? itemMeta.service_charge,
          tax_amount: existing.tax_amount ?? itemMeta.tax_amount,
          cash_received: existing.cash_received ?? itemMeta.cash_received,
          change_amount: existing.change_amount ?? itemMeta.change_amount,
        };
      }
    });

    // 3. From localStorage order_metadata_cache (instant POS -> HQ sync)
    if (typeof window !== "undefined") {
      try {
        const rawCache = localStorage.getItem("kebabschoicepos_order_metadata_cache");
        if (rawCache) {
          const parsedCache = JSON.parse(rawCache);
          Object.entries(parsedCache).forEach(([ordId, data]: [string, any]) => {
            const existing = map[ordId] || {};
            map[ordId] = {
              ...existing,
              ...data,
              outlet_id: data?.outlet_id || existing.outlet_id,
              outlet_name:
                data?.outlet_name ||
                existing.outlet_name ||
                (data?.outlet_id ? outletNameById[data.outlet_id] : undefined),
              staff_name: data?.staff_name || existing.staff_name || "Kasir",
            };
          });
        }
      } catch {}
    }

    return map;
  }, [dbOutlets, outletNameById, snapshot]);

  const customerMap = useMemo(() => {
    const map: Record<string, string> = {};
    snapshot.customers.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [snapshot.customers]);

  const customerPhoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    snapshot.customers.forEach((c) => {
      if (c.phone) map[c.id] = c.phone;
    });
    return map;
  }, [snapshot.customers]);

  const resolveOrderDisplayMeta = (ord: SalesOrder & Record<string, any>) => {
    const meta = orderMetadataMap[ord.id];
    const resolvedOutletId = ord.outlet_id || meta?.outlet_id || null;
    const outletName =
      (resolvedOutletId && outletNameById[resolvedOutletId]) ||
      meta?.outlet_name ||
      ord.outlet_name ||
      "Outlet Utama";
    const staffName = meta?.staff_name || ord.cashier_name || ord.staff_name || "Kasir";
    const notesStr = String(ord.notes || meta?.notes || "");
    const parsedQueueFromNotes = notesStr.match(/Antrean:\s*([^|]+)/i)?.[1]?.trim() || null;
    const queueName =
      meta?.queue_name ||
      ord.customer_queue_name ||
      ord.queue_name ||
      parsedQueueFromNotes ||
      null;
    const crmMemberName = ord.customer_id ? customerMap[ord.customer_id] || null : null;
    const fallbackCustName =
      meta?.customer_name ||
      ord.customer_name ||
      queueName ||
      null;
    const custName =
      crmMemberName ||
      (fallbackCustName && fallbackCustName !== "Pelanggan Umum" ? fallbackCustName : null);
    const customerPhone =
      meta?.customer_phone ||
      ord.customer_phone ||
      (ord.customer_id ? customerPhoneMap[ord.customer_id] || null : null);

    return {
      resolvedOutletId,
      outletName,
      staffName,
      queueName,
      custName,
      customerPhone,
      subtotal: Number(meta?.subtotal ?? ord.subtotal ?? ord.total) || 0,
      discountAmount: Number(meta?.discount_amount ?? ord.discount_amount ?? 0) || 0,
      taxAmount: Number(meta?.tax_amount ?? ord.tax_amount ?? 0) || 0,
    };
  };

  const filteredOrders = useMemo(() => {
    return localOrders.filter((ord) => {
      const displayMeta = resolveOrderDisplayMeta(ord as any);
      if (selectedOutletFilter !== "all") {
        if (displayMeta.resolvedOutletId && displayMeta.resolvedOutletId !== selectedOutletFilter) {
          return false;
        }
        if (!displayMeta.resolvedOutletId) {
          const defaultOutlet =
            snapshot.assignedOutletId || (activeOutlets.length > 0 ? activeOutlets[0]?.id : "all");
          if (selectedOutletFilter !== defaultOutlet && selectedOutletFilter !== "all") return false;
        }
      }

      const ordDateValue = (ord as any).paid_at || ord.created_at;
      if (dateFilter === "today" && !isTodayLocal(ordDateValue)) return false;
      if (dateFilter === "7days" && !isWithinDaysLocal(ordDateValue)) return false;
      if (dateFilter === "month" && !isThisMonthLocal(ordDateValue)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = ord.order_number?.toLowerCase().includes(q);
        const custMatch = displayMeta.custName?.toLowerCase().includes(q);
        const queueMatch = displayMeta.queueName?.toLowerCase().includes(q);
        const outletMatch = displayMeta.outletName?.toLowerCase().includes(q);
        const staffMatch = displayMeta.staffName?.toLowerCase().includes(q);
        return Boolean(numMatch || custMatch || queueMatch || outletMatch || staffMatch);
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
    outletNameById,
    snapshot.assignedOutletId,
    activeOutlets,
  ]);

  const filteredTotalRevenue = useMemo(() => {
    return filteredOrders
      .filter((ord) => ord.status !== "refunded" && ord.status !== "void" && ord.status !== "cancelled")
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
      const displayMeta = resolveOrderDisplayMeta(ord as any);
      const outletName = displayMeta.outletName;
      const staffName = displayMeta.staffName;
      const custName = displayMeta.queueName || displayMeta.custName || "-";
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

  // Open Detail Transaksi Modal & fetch items (mutually exclusive with ReceiptModal)
  const handleOpenOrderDetail = async (order: SalesOrder) => {
    setReceiptModalData(null);
    setSelectedDetailOrder(order);
    const snapshotItems = (snapshot.orderItems || []).filter((it: any) => it.order_id === order.id);
    if (snapshotItems.length > 0) {
      setDetailItems(snapshotItems);
    } else {
      setDetailItems([]);
    }
    setIsLoadingDetailItems(true);
    try {
      const { data: items, error } = await supabase
        .from("sales_order_items")
        .select("*")
        .eq("order_id", order.id);

      if (!error && items && items.length > 0) {
        setDetailItems(items);
      } else if (snapshotItems.length === 0) {
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
      if (snapshotItems.length === 0) {
        setDetailItems([
          {
            name: `Order POS #${order.order_number}`,
            quantity: 1,
            unit_price: order.total,
            subtotal: order.total,
          },
        ]);
      }
    } finally {
      setIsLoadingDetailItems(false);
    }
  };

  // Open Receipt Preview / Print Modal directly (mutually exclusive with Detail Transaksi modal)
  const handleOpenOrderReceipt = async (order: SalesOrder) => {
    setSelectedDetailOrder(null);
    const displayMeta = resolveOrderDisplayMeta(order as any);
    const snapshotItems = (snapshot.orderItems || []).filter((it: any) => it.order_id === order.id);
    const buildReceiptItems = (rows: any[]) =>
      rows.length > 0
        ? rows.map((it: any) => ({
            name: it.name || `Order POS #${order.order_number}`,
            quantity: Number(it.quantity) || 1,
            price: Number(it.unit_price ?? it.price) || 0,
            subtotal:
              Number(it.subtotal) ||
              (Number(it.unit_price ?? it.price) || 0) * (Number(it.quantity) || 1),
          }))
        : [
            {
              name: `Order POS #${order.order_number}`,
              quantity: 1,
              price: order.total,
              subtotal: order.total,
            },
          ];

    const initialPayload: ReceiptData = {
      orderNumber: order.order_number,
      outletName: displayMeta.outletName,
      cashierName: displayMeta.staffName,
      paymentMethod: (order.payment_method || "CASH").toUpperCase(),
      customerName: displayMeta.custName || displayMeta.queueName,
      customerQueueName: displayMeta.queueName,
      customerPhone: displayMeta.customerPhone || undefined,
      createdAt: order.created_at || new Date().toISOString(),
      subtotal: displayMeta.subtotal,
      discountAmount: displayMeta.discountAmount,
      taxAmount: displayMeta.taxAmount,
      items: buildReceiptItems(snapshotItems),
      total: order.total,
    };
    setReceiptModalData(initialPayload);

    try {
      const { data: dbItems, error } = await supabase
        .from("sales_order_items")
        .select("*")
        .eq("order_id", order.id);
      if (!error && dbItems && dbItems.length > 0) {
        const firstMeta = (dbItems[0] as any)?.selected_options?.order_meta;
        setReceiptModalData((curr) =>
          curr && curr.orderNumber === order.order_number
            ? {
                ...curr,
                customerPhone: firstMeta?.customer_phone || curr.customerPhone,
                subtotal: Number(firstMeta?.subtotal ?? curr.subtotal) || curr.total,
                discountAmount: Number(firstMeta?.discount_amount ?? curr.discountAmount) || 0,
                serviceChargeAmount: Number(firstMeta?.service_charge ?? 0) || 0,
                taxAmount: Number(firstMeta?.tax_amount ?? curr.taxAmount) || 0,
                cashReceived: firstMeta?.cash_received ?? curr.cashReceived,
                changeAmount: firstMeta?.change_amount ?? curr.changeAmount,
                items: buildReceiptItems(dbItems),
              }
            : curr,
        );
      }
    } catch {}
  };

  const handleSendOrderWhatsApp = (
    order: SalesOrder,
    explicitItems?: Array<{
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
      variant?: string | null;
      notes?: string | null;
    }>,
  ) => {
    const displayMeta = resolveOrderDisplayMeta(order as any);
    const printerCfg = getSavedPrinterConfig();
    const headerStoreName = printerCfg.storeName || snapshot.businessName || "Kebab's Choice";
    const snapshotItems = (snapshot.orderItems || []).filter((it: any) => it.order_id === order.id);
    let resolvedItems = explicitItems;
    if (!resolvedItems || resolvedItems.length === 0) {
      if (snapshotItems.length > 0) {
        resolvedItems = snapshotItems.map((it: any) => ({
          name: it.name || `Order POS #${order.order_number}`,
          variant: it.variant_name || null,
          notes: it.notes || null,
          quantity: Number(it.quantity) || 1,
          price: Number(it.unit_price ?? it.price) || 0,
          subtotal:
            Number(it.subtotal) ||
            (Number(it.unit_price ?? it.price) || 0) * (Number(it.quantity) || 1),
        }));
      } else {
        const rawOrderItems = Array.isArray((order as any).items) ? (order as any).items : [];
        resolvedItems =
          rawOrderItems.length > 0
            ? rawOrderItems.map((it: any) => ({
                name: it.name || `Order POS #${order.order_number}`,
                variant: it.variant_name || null,
                notes: it.notes || null,
                quantity: Number(it.quantity) || 1,
                price: Number(it.unit_price ?? it.price) || 0,
                subtotal:
                  Number(it.subtotal) ||
                  (Number(it.unit_price ?? it.price) || 0) * (Number(it.quantity) || 1),
              }))
            : [
                {
                  name: `Order POS #${order.order_number}`,
                  quantity: 1,
                  price: Number(order.total) || 0,
                  subtotal: Number(order.total) || 0,
                },
              ];
      }
    }

    void shareReceiptImage(
      {
        storeName: headerStoreName,
        outletName: displayMeta.outletName,
        branchAddress: printerCfg.branchAddress,
        orderNumber: order.order_number,
        orderType: (order as any).order_type || order.channel || undefined,
        tableNumber: (order as any).table_number || undefined,
        customerName: displayMeta.custName || undefined,
        customerQueueName: displayMeta.queueName || undefined,
        customerPhone: displayMeta.customerPhone || undefined,
        cashierName: displayMeta.staffName,
        paymentMethod: (order.payment_method || "CASH").toUpperCase(),
        createdAt: order.created_at || new Date().toISOString(),
        items: resolvedItems || [],
        subtotal: displayMeta.subtotal,
        discountAmount: displayMeta.discountAmount,
        taxAmount: displayMeta.taxAmount,
        total: Number(order.total) || 0,
        cashReceived: (order as any).cashReceived,
        changeAmount: (order as any).changeAmount,
        footerMessage: printerCfg.footerMessage || "Terima kasih atas kunjungan Anda!",
      },
      displayMeta.customerPhone,
    ).then((res) => {
      if (res === "downloaded") {
        toast.success("Gambar struk PNG diunduh — lampirkan pada chat WhatsApp.");
      }
    });
  };

  // Open Supervisor Action Modal (reject already void/cancelled/refunded orders immediately)
  const handleOpenActionModal = (mode: "refund" | "void", order: SalesOrder) => {
    const existingStatus = String(order.status || "").toLowerCase();
    if (["void", "cancelled", "refunded"].includes(existingStatus)) {
      toast.error(`Order #${order.order_number} sudah berstatus ${existingStatus.toUpperCase()}`, {
        description: "Transaksi yang sudah di-Void, Cancelled, atau Refunded tidak dapat diproses ulang.",
      });
      return;
    }
    setActionModal({ isOpen: true, mode, order });
    setSupervisorPin("");
    setActionReason("");
  };

  // Confirm Refund / Void with Supervisor PIN
  const handleConfirmAction = async () => {
    if (!actionModal.order) return;

    const businessId = snapshot.businessId || "";
    if (!businessId) {
      toast.error("Bisnis tidak terdeteksi. Muat ulang halaman lalu coba lagi.");
      return;
    }

    // 0. Guard in-memory order status against double void/refund
    const localStatus = String(actionModal.order.status || "").toLowerCase();
    if (["void", "cancelled", "refunded"].includes(localStatus)) {
      toast.error(`Order #${actionModal.order.order_number} sudah berstatus ${localStatus.toUpperCase()}`, {
        description: "Aksi ditolak untuk mencegah double void/refund.",
      });
      setActionModal({ isOpen: false, mode: "refund", order: null });
      return;
    }

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
      businessId,
    });

    if (!authResult.isValid) {
      toast.error(authResult.error || "PIN Supervisor tidak valid.");
      setIsActionSubmitting(false);
      return;
    }

    const authorizedBy = authResult.authorizedBy || "Supervisor";
    const uiStatus = actionModal.mode === "refund" ? "refunded" : "void";
    const ordId = actionModal.order.id;
    const ordNumber = actionModal.order.order_number;
    const ordTotal = Number(actionModal.order.total) || 0;

    try {
      // 0.5. Verify latest order status directly in the database (business-scoped) to prevent double void/refund
      const { data: currentOrderRow, error: checkOrderErr } = await supabase
        .from("sales_orders")
        .select("id, status, outlet_id")
        .eq("id", ordId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (checkOrderErr || !currentOrderRow) {
        toast.error(`Order #${ordNumber} tidak ditemukan di database bisnis ini`, {
          description: checkOrderErr?.message || "Reversal kas & stok dihentikan demi keamanan data.",
        });
        return;
      }

      const dbCurrentStatus = String(currentOrderRow.status || "").toLowerCase();
      if (["void", "cancelled", "refunded"].includes(dbCurrentStatus)) {
        toast.error(`Order #${ordNumber} sudah berstatus ${dbCurrentStatus.toUpperCase()}`, {
          description: "Transaksi tidak dapat di-void atau di-refund dua kali.",
        });
        setActionModal({ isOpen: false, mode: "refund", order: null });
        return;
      }

      // 1. Update order status in Supabase strictly scoped by business_id AND previous status (atomic CAS).
      // If the update fails or affects 0 rows, STOP immediately — NEVER run cash or stock reversal!
      let persistedDbStatus: string = uiStatus;
      let { data: updatedRows, error: updateErr } = await supabase
        .from("sales_orders")
        .update({ status: uiStatus as any })
        .eq("id", ordId)
        .eq("business_id", businessId)
        .eq("status", currentOrderRow.status)
        .select("id, status");

      if (updateErr && actionModal.mode === "void") {
        // public.order_status enum is ('draft','paid','refunded','cancelled'), so 'void' falls back to 'cancelled'
        console.warn("[Orders] 'void' enum fallback to 'cancelled':", updateErr.message);
        persistedDbStatus = "cancelled";
        const fallbackRes = await supabase
          .from("sales_orders")
          .update({ status: "cancelled" as any })
          .eq("id", ordId)
          .eq("business_id", businessId)
          .eq("status", currentOrderRow.status)
          .select("id, status");
        updatedRows = fallbackRes.data;
        updateErr = fallbackRes.error;
      }

      if (updateErr || !updatedRows || updatedRows.length === 0) {
        console.error("[Orders] Gagal update status order — reversal dibatalkan:", updateErr);
        toast.error(
          `Gagal mengubah status Order #${ordNumber} ke ${actionModal.mode.toUpperCase()}`,
          {
            description:
              (updateErr?.message || "Status order sudah berubah di terminal lain.") +
              " Reversal stok & kas TIDAK dijalankan.",
            duration: 10000,
          },
        );
        return;
      }

      const newStatus = (persistedDbStatus === "cancelled" ? "void" : uiStatus) as SalesOrder["status"];
      const resolvedOutletId = currentOrderRow.outlet_id || targetOutletId;

      // 2. Adjust active shift cash if order was paid in cash (strictly per-outlet key)
      if (actionModal.order.payment_method?.toLowerCase() === "cash") {
        try {
          const outletShiftKey = getOutletShiftKey(resolvedOutletId);
          const savedShift = outletShiftKey ? localStorage.getItem(outletShiftKey) : null;
          const shiftObj = savedShift ? JSON.parse(savedShift) : null;
          const rawShiftId: string | null = shiftObj?.id || null;
          const validShiftUuid: string | null = isValidUuid(rawShiftId) ? rawShiftId : null;
          const localShiftRefNote =
            rawShiftId && !validShiftUuid ? ` [Ref Shift Lokal: ${rawShiftId}]` : "";
          const movementDescription = `${ORDER_REVERSAL_MARKER} ${actionModal.mode.toUpperCase()} #${ordNumber}: ${actionReason.trim()} (Otorisasi: ${authorizedBy})${localShiftRefNote}`;

          if (outletShiftKey && shiftObj) {
            // Decrement stored cashSales on the active shift (matches the DB where the order is no longer 'paid')
            const newCashSales = Math.max(0, (Number(shiftObj.cashSales) || 0) - ordTotal);
            const newExpected =
              (Number(shiftObj.startingCash) || 0) +
              newCashSales +
              (Number(shiftObj.totalCashIn) || 0) -
              (Number(shiftObj.totalCashOut) || 0);
            shiftObj.cashSales = newCashSales;
            shiftObj.expectedEndingCash = newExpected;
            localStorage.setItem(outletShiftKey, JSON.stringify(shiftObj));

            // Sync with local cash movements history (tagged with ORDER_REVERSAL_MARKER for audit trail)
            try {
              const savedMovs = JSON.parse(
                localStorage.getItem("kebabschoicepos_cash_movements") || "[]",
              );
              const newMov = {
                id: `mov-${Date.now()}`,
                shiftId: rawShiftId,
                type: "out",
                amount: ordTotal,
                notes: movementDescription,
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

            if (validShiftUuid) {
              const { error: shiftUpdErr } = await supabase
                .from("pos_shifts" as any)
                .update({
                  cash_sales: newCashSales,
                  expected_ending_cash: newExpected,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", validShiftUuid)
                .eq("business_id", businessId)
                .eq("status", "open");
              if (shiftUpdErr) {
                console.warn("[Shift] pos_shifts reversal update warning:", shiftUpdErr.message);
              }
            }
          }

          // Log cash movement in DB: NEVER pass a non-UUID "shift-..." to the uuid column shift_id
          let { error: cashMovErr } = await supabase.from("cash_movements" as any).insert({
            shift_id: validShiftUuid,
            business_id: businessId,
            outlet_id: isValidUuid(resolvedOutletId) ? resolvedOutletId : null,
            type: "out",
            amount: ordTotal,
            description: movementDescription,
            notes: movementDescription,
            authorized_by: authorizedBy,
            created_by: authorizedBy,
            created_at: new Date().toISOString(),
          });

          if (cashMovErr) {
            // Fallback to core columns defined in 20260930000000_pos_shifts_and_cash_movements.sql
            const { error: coreMovErr } = await supabase.from("cash_movements" as any).insert({
              shift_id: validShiftUuid,
              business_id: businessId,
              outlet_id: isValidUuid(resolvedOutletId) ? resolvedOutletId : null,
              type: "out",
              amount: ordTotal,
              description: movementDescription,
              created_at: new Date().toISOString(),
            });
            if (coreMovErr) {
              console.warn("[Shift] cash_movements insert warning:", coreMovErr.message);
            }
          }
        } catch (shiftErr) {
          console.warn("[Shift] Cash adjust note:", shiftErr);
        }
      }

      // 2.5. Stock Reversal: Return raw materials (BOM) & product stock to inventory
      const reversalType = actionModal.mode === "refund" ? "refund_reversal" : "void_reversal";
      const recordLocalProcurementReversal = (revMov: Record<string, any>) => {
        if (typeof window === "undefined") return;
        try {
          const localKey = `procurement_store_${businessId}`;
          const rawStore = localStorage.getItem(localKey);
          const store = rawStore ? JSON.parse(rawStore) : {};
          const localEntry = {
            id: `mov-rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ...revMov,
          };
          store.stock_movements = [localEntry, ...(store.stock_movements || [])].slice(0, 500);
          localStorage.setItem(localKey, JSON.stringify(store));
        } catch {}
      };

      try {
        // A. Look up previous stock_movements for this order (scoped by business_id)
        const { data: prevMovements } = await (supabase as any)
          .from("stock_movements")
          .select("*")
          .eq("business_id", businessId)
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
                .eq("business_id", businessId)
                .maybeSingle();

              if (invRow) {
                const restoredStock = (Number(invRow.stock) || 0) + qty;
                await supabase
                  .from("inventory_items")
                  .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                  .eq("id", mov.inventory_item_id)
                  .eq("business_id", businessId);

                const revPayload = {
                  business_id: businessId,
                  inventory_item_id: mov.inventory_item_id,
                  outlet_id: isValidUuid(resolvedOutletId) ? resolvedOutletId : null,
                  reference_id: isValidUuid(ordId) ? ordId : null,
                  reference_type: "pos_order",
                  type: reversalType,
                  movement_type: reversalType,
                  quantity: qty,
                  unit: mov.unit || invRow.unit || "gram",
                  remaining_stock: restoredStock,
                  notes: `${actionModal.mode.toUpperCase()} Reversal #${ordNumber}: Pengembalian stok bahan baku (Otorisasi: ${authorizedBy})`,
                  created_at: new Date().toISOString(),
                };

                // Log reversal stock movement in DB & local procurement_store
                await supabase.from("stock_movements" as any).insert(revPayload);
                recordLocalProcurementReversal(revPayload);
              }
            }
          }
        } else {
          // B. Fallback: inspect sales_order_items (with resolveMenuRecipe + add-ons/toppings restoration)
          const { data: orderItems } = await supabase
            .from("sales_order_items")
            .select("product_id, quantity, name, selected_options")
            .eq("order_id", ordId);

          const cachedMenuRecipes = (snapshot.menuRecipes as Record<string, any>) || {};

          for (const itm of (orderItems || []) as any[]) {
            const prod = snapshot.products.find((p) => p.id === itm.product_id);
            const resolvedRecipe = await resolveMenuRecipe(
              {
                id: itm.product_id || "",
                name: itm.name || prod?.name || "Menu",
                quantity: Number(itm.quantity) || 1,
                price: 0,
                recipe: prod?.recipe,
              } as any,
              businessId,
              resolvedOutletId,
              cachedMenuRecipes,
            );

            const ingredientsToRestore: Array<{
              inventory_item_id?: string | null;
              ingredient_name?: string | null;
              quantity: number;
              unit?: string;
            }> = [];

            if (resolvedRecipe && Array.isArray(resolvedRecipe.items)) {
              for (const ing of resolvedRecipe.items) {
                ingredientsToRestore.push({
                  inventory_item_id: ing.inventory_item_id,
                  ingredient_name: (ing as any).ingredient_name,
                  quantity: Number(ing.quantity) || 1,
                  unit: ing.unit || "gram",
                });
              }
            }

            // Restore add-ons / toppings from selected_options if present
            const selOpts = (itm as any).selected_options || {};
            const addOnList: Array<{ name: string }> = [];
            if (Array.isArray(selOpts.addons)) {
              for (const a of selOpts.addons) {
                if (a?.name) addOnList.push(a);
              }
            }
            if (Array.isArray(selOpts.variant_groups)) {
              for (const vg of selOpts.variant_groups) {
                const gName = (vg?.group_name || "").toLowerCase();
                if (
                  gName.includes("topping") ||
                  gName.includes("addon") ||
                  gName.includes("extra") ||
                  gName.includes("tambahan")
                ) {
                  for (const opt of vg.options || []) {
                    if (opt?.name) addOnList.push(opt);
                  }
                }
              }
            }
            for (const addon of addOnList) {
              const rawName = String(addon.name || "").trim();
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
              } else if (
                lower.includes("saus") ||
                lower.includes("sauce") ||
                lower.includes("mayo")
              ) {
                estimatedQty = 15;
                estimatedUnit = "ml";
              }
              const cleanName = rawName.replace(/^(extra|tambah|tambahan|\+)\s+/i, "").trim();
              ingredientsToRestore.push({
                ingredient_name: cleanName || rawName,
                quantity: estimatedQty,
                unit: estimatedUnit,
              });
            }

            for (const ing of ingredientsToRestore) {
              const rawNeeded = (Number(ing.quantity) || 1) * (Number(itm.quantity) || 1);
              let invRow: any = null;
              if (ing.inventory_item_id) {
                const { data: byId } = await (supabase.from("inventory_items" as any) as any)
                  .select("id, stock, unit, name, yield_per_unit, yield_unit")
                  .eq("id", ing.inventory_item_id)
                  .eq("business_id", businessId)
                  .maybeSingle();
                invRow = byId;
              }
              if (!invRow && ing.ingredient_name) {
                let byNameQ = (supabase.from("inventory_items" as any) as any)
                  .select("id, stock, unit, name, yield_per_unit, yield_unit")
                  .eq("business_id", businessId)
                  .ilike("name", ing.ingredient_name.trim());
                if (isValidUuid(resolvedOutletId)) {
                  byNameQ = byNameQ.eq("outlet_id", resolvedOutletId);
                }
                const { data: byNameRows } = await byNameQ.limit(1);
                invRow = byNameRows?.[0] || null;
              }

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
                await (supabase.from("inventory_items" as any) as any)
                  .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                  .eq("id", row.id)
                  .eq("business_id", businessId);

                const revPayload = {
                  business_id: businessId,
                  inventory_item_id: row.id,
                  outlet_id: isValidUuid(resolvedOutletId) ? resolvedOutletId : null,
                  reference_id: isValidUuid(ordId) ? ordId : null,
                  reference_type: "pos_order",
                  type: reversalType,
                  movement_type: reversalType,
                  quantity: convertedQty,
                  unit: row.unit || ing.unit || "gram",
                  remaining_stock: restoredStock,
                  notes: `${actionModal.mode.toUpperCase()} Reversal #${ordNumber}: Pengembalian ${itm.quantity}x ${itm.name} (Otorisasi: ${authorizedBy})`,
                  created_at: new Date().toISOString(),
                };
                await supabase.from("stock_movements" as any).insert(revPayload);
                recordLocalProcurementReversal(revPayload);
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
              .eq("business_id", businessId)
              .maybeSingle();
            if (prodRow) {
              const newProdStock = (Number(prodRow.stock) || 0) + (Number(itm.quantity) || 1);
              await supabase
                .from("products")
                .update({ stock: newProdStock, updated_at: new Date().toISOString() })
                .eq("id", itm.product_id)
                .eq("business_id", businessId);
            }
          }
        }
      } catch (stockRevErr) {
        console.warn("[StockReversal] Stock reversal warning:", stockRevErr);
      }

      // 3. Immediate local update with authorized_by and actionReason + sync localStorage recent_orders
      if (typeof window !== "undefined") {
        try {
          const rawRecent = localStorage.getItem("kebabschoicepos_recent_orders");
          if (rawRecent) {
            const parsedRecent = JSON.parse(rawRecent);
            if (Array.isArray(parsedRecent)) {
              const updatedRecent = parsedRecent.map((r: any) =>
                r && (r.id === ordId || r.order_number === ordNumber)
                  ? {
                      ...r,
                      status: newStatus,
                      actionReason: actionReason.trim(),
                      authorized_by: authorizedBy,
                    }
                  : r,
              );
              localStorage.setItem("kebabschoicepos_recent_orders", JSON.stringify(updatedRecent));
            }
          }
        } catch {}
      }

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
    <div className={cn(isPosOrders ? "space-y-3 pb-6" : "space-y-6", "w-full max-w-none")}>
      <div
        className={cn(
          "flex flex-col md:flex-row md:items-center md:justify-between border border-border bg-card/82 shadow-soft backdrop-blur-2xl",
          isPosOrders ? "gap-2.5 rounded-2xl px-4 py-3" : "gap-4 rounded-[2rem] p-6",
        )}
      >
        <div>
          <h1
            className={cn(
              "font-black tracking-normal",
              isPosOrders ? "text-lg sm:text-xl" : "text-3xl",
            )}
          >
            {t("orders.title", "Orders & Transaksi")}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            {t(
              "orders.subtitle",
              "Riwayat lengkap transaksi seluruh cabang outlet, status pembayaran, kasir, dan data CRM.",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Outlet Filter */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-2 shadow-xs">
            <Store className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col items-start justify-center min-w-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
                {t("orders.filter_outlet", "Filter Outlet")}
              </span>
              {isOwner ? (
                <select
                  value={selectedOutletFilter}
                  onChange={(e) => setSelectedOutletFilter(e.target.value)}
                  className="p-0 m-0 pl-0 bg-transparent appearance-none leading-tight font-semibold text-sm text-foreground focus:outline-none cursor-pointer mt-0.5"
                >
                  <option value="all">
                    {t("orders.all_outlets_option", "Semua Cabang Outlet")}
                  </option>
                  {activeOutlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 font-semibold text-sm leading-tight text-foreground mt-0.5">
                  <span>
                    {dbOutlets.find((o) => o.id === selectedOutletFilter)?.name ||
                      "Outlet Kasir"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 font-normal">
                    <Lock className="size-2.5" /> Terkunci
                  </span>
                </div>
              )}
            </div>
            {isOwner && (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 self-center pointer-events-none" />
            )}
          </div>

          {/* Date Filter Tabs */}
          <div
            role="group"
            aria-label="Filter Periode Transaksi"
            className="flex items-center rounded-2xl border border-border bg-background p-1 shadow-xs"
          >
            <button
              type="button"
              aria-pressed={dateFilter === "all"}
              data-active={dateFilter === "all" ? "true" : "false"}
              onClick={() => setDateFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-none cursor-pointer focus:outline-none",
                dateFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t("orders.period_all", "Semua")}
            </button>
            <button
              type="button"
              aria-pressed={dateFilter === "today"}
              data-active={dateFilter === "today" ? "true" : "false"}
              onClick={() => setDateFilter("today")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-none cursor-pointer focus:outline-none",
                dateFilter === "today"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t("orders.period_today", "Hari Ini")}
            </button>
            <button
              type="button"
              aria-pressed={dateFilter === "7days"}
              data-active={dateFilter === "7days" ? "true" : "false"}
              onClick={() => setDateFilter("7days")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-none cursor-pointer focus:outline-none",
                dateFilter === "7days"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t("orders.period_7days", "7 Hari")}
            </button>
            <button
              type="button"
              aria-pressed={dateFilter === "month"}
              data-active={dateFilter === "month" ? "true" : "false"}
              onClick={() => setDateFilter("month")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-none cursor-pointer focus:outline-none",
                dateFilter === "month"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t("orders.period_month", "Bulan Ini")}
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
      <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3">
        <div
          className={cn(
            "bg-card rounded-2xl border border-border/60 shadow-sm",
            isPosOrders ? "p-3" : "p-4",
          )}
        >
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.total_orders_filtered", "Total Order Terfilter")}
          </p>
          {isLoading && localOrders.length === 0 ? (
            <div className="h-7 w-28 rounded-lg bg-muted animate-pulse mt-1" />
          ) : (
            <p
              className={cn(
                "font-bold text-foreground tabular-nums mt-1",
                isPosOrders ? "text-base sm:text-lg" : "text-xl",
              )}
            >
              {filteredOrders.length} {t("orders.transactions_unit", "Transaksi")}
            </p>
          )}
        </div>
        <div
          className={cn(
            "bg-card rounded-2xl border border-border/60 shadow-sm",
            isPosOrders ? "p-3" : "p-4",
          )}
        >
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.revenue_filtered", "Omzet Bersih Terfilter")}
          </p>
          {isLoading && localOrders.length === 0 ? (
            <div className="h-7 w-32 rounded-lg bg-muted animate-pulse mt-1" />
          ) : (
            <p
              className={cn(
                "font-bold text-foreground tabular-nums mt-1",
                isPosOrders ? "text-base sm:text-lg" : "text-xl",
              )}
            >
              {formatRupiah(filteredTotalRevenue)}
            </p>
          )}
        </div>
        <div
          className={cn(
            "col-span-2 md:col-span-1 bg-card rounded-2xl border border-border/60 shadow-sm",
            isPosOrders ? "p-3" : "p-4",
          )}
        >
          <p className="text-xs text-muted-foreground font-semibold">
            {t("orders.outlet_status", "Status Outlet")}
          </p>
          <p
            className={cn(
              "font-bold text-foreground mt-1",
              isPosOrders ? "text-base sm:text-lg" : "text-xl",
            )}
          >
            {selectedOutletFilter === "all"
              ? t("orders.all_connected", "Semua Cabang Terhubung")
              : dbOutlets.find((o) => o.id === selectedOutletFilter)?.name || "Aktif"}
          </p>
        </div>
      </div>

      {/* Order List */}
      <div
        className={cn(
          "border border-border bg-card shadow-soft",
          isPosOrders ? "rounded-2xl p-3" : "rounded-[1.75rem] p-4",
        )}
      >
        {isLoading && localOrders.length === 0 ? (
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground pb-1">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Memuat riwayat transaksi...</span>
            </div>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`order-skel-${idx}`}
                className="h-20 w-full rounded-2xl bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
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
              const displayMeta = resolveOrderDisplayMeta(order as any);
              const outletName = displayMeta.outletName;
              const staffName = displayMeta.staffName;
              const queueName = displayMeta.queueName;
              const custName = displayMeta.custName;

              const isRefunded = order.status === "refunded";
              const isVoid = order.status === "void" || order.status === "cancelled";

              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-2xl bg-secondary/70 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-secondary border border-transparent hover:border-primary/30"
                >
                  <div
                    className="space-y-1 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleOpenOrderDetail(order)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black tracking-normal text-base">
                        {order.order_number}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                          isRefunded
                            ? "bg-muted text-foreground/75"
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
                      {queueName && (
                        <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                          Antrean: {queueName}
                        </span>
                      )}
                      {custName && custName !== queueName && (
                        <span className="rounded-md bg-muted text-foreground/80 px-2 py-0.5 text-xs font-bold">
                          Pelanggan: {custName}
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
                    <div
                      className="flex flex-wrap items-center justify-end gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSendOrderWhatsApp(order);
                        }}
                      >
                        <Send className="size-3.5" />
                        {t("pos.send_wa_receipt", "Kirim Struk WA")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border bg-background hover:bg-secondary cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleOpenOrderReceipt(order);
                        }}
                      >
                        <Printer className="size-3.5" />
                        {t("pos.print_receipt", "Cetak Struk")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleOpenOrderDetail(order);
                        }}
                      >
                        <FileText className="size-3.5" />
                        {t("orders.detail_btn", "Detail")}
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
                        ? "bg-muted text-foreground/75"
                        : selectedDetailOrder.status === "void" || selectedDetailOrder.status === "cancelled"
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
            {(() => {
              const detailDisplayMeta = resolveOrderDisplayMeta(selectedDetailOrder as any);
              const firstItemMeta = detailItems[0]?.selected_options?.order_meta;
              const detailOutletName =
                firstItemMeta?.outlet_name ||
                (firstItemMeta?.outlet_id && outletNameById[firstItemMeta.outlet_id]) ||
                detailDisplayMeta.outletName;
              const detailStaffName =
                firstItemMeta?.cashier_name || detailDisplayMeta.staffName || "Kasir POS";
              const detailQueueName =
                firstItemMeta?.queue_name || detailDisplayMeta.queueName || null;
              const detailCustName =
                detailDisplayMeta.custName ||
                firstItemMeta?.customer_name ||
                detailQueueName ||
                "Pelanggan Umum";
              const detailSubtotal =
                Number(firstItemMeta?.subtotal ?? detailDisplayMeta.subtotal) ||
                Number(selectedDetailOrder.total) ||
                0;
              const detailDiscount =
                Number(firstItemMeta?.discount_amount ?? detailDisplayMeta.discountAmount) || 0;
              const detailTax =
                Number(firstItemMeta?.tax_amount ?? detailDisplayMeta.taxAmount) || 0;

              return (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs bg-secondary/50 rounded-2xl p-4 border border-border/60">
                    <div>
                      <span className="text-muted-foreground block text-xs font-bold uppercase">
                        Tanggal & Waktu
                      </span>
                      <span className="font-semibold text-foreground">
                        {selectedDetailOrder.created_at
                          ? new Date(selectedDetailOrder.created_at).toLocaleString("id-ID")
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs font-bold uppercase">
                        Outlet Cabang
                      </span>
                      <span className="font-semibold text-foreground">{detailOutletName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs font-bold uppercase">
                        Kasir / Operator
                      </span>
                      <span className="font-semibold text-foreground">{detailStaffName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs font-bold uppercase">
                        Nama Antrean / Pelanggan
                      </span>
                      <span className="font-semibold text-foreground">
                        {detailQueueName
                          ? `${detailQueueName}${detailCustName && detailCustName !== detailQueueName ? ` (${detailCustName})` : ""}`
                          : detailCustName}
                      </span>
                    </div>
                  </div>

                  {/* Otorisasi Supervisor Info (jika di-refund atau di-void) */}
                  {(selectedDetailOrder.status === "refunded" ||
                    selectedDetailOrder.status === "void" ||
                    selectedDetailOrder.status === "cancelled") && (
                    <div className="mt-3 rounded-2xl border border-border bg-muted p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-foreground/75">
                        <ShieldAlert className="size-4 shrink-0" />
                        <span>
                          Informasi Otorisasi{" "}
                          {selectedDetailOrder.status === "refunded" ? "Refund" : "Void"}
                        </span>
                      </div>
                      {selectedDetailOrder.authorized_by && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Diotorisasi oleh:{" "}
                          <strong className="text-foreground">
                            {selectedDetailOrder.authorized_by}
                          </strong>
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
                        {detailItems.map((item, idx) => {
                          const rawVariantTokens = String(item.variant_name || "")
                            .split(/[•|,]/)
                            .map((t) => t.trim())
                            .filter(Boolean);
                          const seenTokens = new Set<string>();
                          const uniqueVariantTokens: string[] = [];
                          for (const tok of rawVariantTokens) {
                            const key = tok.toLowerCase();
                            if (!seenTokens.has(key)) {
                              seenTokens.add(key);
                              uniqueVariantTokens.push(tok);
                            }
                          }
                          const uniqueModifiers = (
                            Array.isArray(item.selected_options?.modifiers)
                              ? item.selected_options.modifiers
                              : []
                          )
                            .map((m: any) => String(m || "").trim())
                            .filter((m: string) => {
                              if (!m) return false;
                              const key = m.toLowerCase();
                              if (seenTokens.has(key)) return false;
                              seenTokens.add(key);
                              return true;
                            });
                          const uniqueAddons = (
                            Array.isArray(item.selected_options?.addons)
                              ? item.selected_options.addons
                              : []
                          )
                            .map((a: any) => String(a?.name || a || "").trim())
                            .filter((a: string) => {
                              if (!a) return false;
                              const key = a.replace(/^\+/, "").trim().toLowerCase();
                              if (seenTokens.has(key) || seenTokens.has(`+${key}`)) return false;
                              seenTokens.add(key);
                              return true;
                            });
                          const hasStructuredOptions =
                            uniqueVariantTokens.length > 0 ||
                            uniqueModifiers.length > 0 ||
                            uniqueAddons.length > 0 ||
                            Boolean(item.notes);
                          const cleanDisplayName = hasStructuredOptions
                            ? String(item.name || "")
                                .replace(/\s*\[Catatan:[^\]]*\]\s*/gi, "")
                                .replace(/\s*\([^)]*\)\s*$/g, "")
                                .trim() || item.name
                            : item.name;

                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-border/80 bg-background/80 p-3 text-xs space-y-1"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-foreground">
                                  {cleanDisplayName}
                                </span>
                                <span className="font-black text-primary shrink-0">
                                  {formatRupiah(item.subtotal || item.unit_price * item.quantity)}
                                </span>
                              </div>
                              {uniqueVariantTokens.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Varian:{" "}
                                  <span className="font-semibold text-foreground">
                                    {uniqueVariantTokens.join(" · ")}
                                  </span>
                                </p>
                              )}
                              {uniqueModifiers.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Level/Opsi:{" "}
                                  <span className="font-semibold text-foreground">
                                    {uniqueModifiers.join(", ")}
                                  </span>
                                </p>
                              )}
                              {uniqueAddons.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Topping:{" "}
                                  <span className="font-semibold text-foreground">
                                    {uniqueAddons.join(", ")}
                                  </span>
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs italic text-foreground/75">
                                  Catatan: {item.notes}
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground pt-1 flex justify-between border-t border-border/40">
                                <span>Jumlah: {item.quantity} porsi</span>
                                <span>@ {formatRupiah(item.unit_price)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Total Summary */}
                  <div className="mt-5 rounded-2xl bg-secondary/80 p-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatRupiah(detailSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Diskon Promo</span>
                      <span className="tabular-nums">
                        {detailDiscount > 0 ? `-${formatRupiah(detailDiscount)}` : "Rp 0"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pajak (PB1)</span>
                      <span className="tabular-nums">{formatRupiah(detailTax)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-foreground pt-2 border-t border-border">
                      <span>Total Tagihan</span>
                      <span className="text-primary tabular-nums">
                        {formatRupiah(selectedDetailOrder.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Metode Pembayaran</span>
                      <span className="font-black uppercase text-foreground">
                        {selectedDetailOrder.payment_method}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons: Cetak Struk, Kirim Struk WA, Refund, Void */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl font-bold text-xs gap-1.5"
                        onClick={() => {
                          setReceiptModalData({
                            orderNumber: selectedDetailOrder.order_number,
                            outletName: detailOutletName,
                            cashierName: detailStaffName,
                            paymentMethod: (selectedDetailOrder.payment_method || "CASH").toUpperCase(),
                            customerName: detailCustName,
                            customerQueueName: detailQueueName,
                            customerPhone:
                              resolveOrderDisplayMeta(selectedDetailOrder as any).customerPhone ||
                              undefined,
                            createdAt: selectedDetailOrder.created_at || new Date().toISOString(),
                            subtotal: detailSubtotal,
                            discountAmount: detailDiscount,
                            taxAmount: detailTax,
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
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-xl font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() =>
                          handleSendOrderWhatsApp(
                            selectedDetailOrder,
                            detailItems.map((it) => ({
                              name: it.name,
                              variant: it.variant_name || null,
                              notes: it.notes || null,
                              quantity: it.quantity,
                              price: it.unit_price,
                              subtotal: it.subtotal || it.unit_price * it.quantity,
                            })),
                          )
                        }
                      >
                        <Send className="size-3.5" />
                        Kirim Struk WA
                      </Button>
                    </div>

              <div className="flex items-center gap-2">
                {selectedDetailOrder.status === "paid" ? (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl font-bold text-xs gap-1.5 text-foreground/75 border-border hover:bg-muted"
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
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUPERVISOR CONFIRMATION MODAL (REFUND / VOID) */}
      {actionModal.isOpen &&
        actionModal.order &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative z-[9999] w-full max-w-md rounded-[2rem] border border-border bg-white dark:bg-slate-900 p-6 shadow-float animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl",
                      actionModal.mode === "refund"
                        ? "bg-muted text-foreground/75"
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
                    inputMode="numeric"
                    maxLength={6}
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder="Masukkan PIN Supervisor"
                    className="rounded-xl text-xs bg-background h-10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Otorisasi diperlukan untuk mengubah status transaksi dan menyesuaikan kas shift.
                    PIN diatur Owner di menu Keamanan (/security).
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
          </div>,
          document.body,
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
  onSignOut,
}: {
  profile: UserProfile;
  snapshot: Snapshot;
  onRefresh?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}) {
  const activeOutletName =
    snapshot.outlets?.find((o) => o.id === snapshot.assignedOutletId)?.name ||
    snapshot.outlets?.[0]?.name ||
    snapshot.businessName ||
    "Kantor Pusat (HQ)";

  return (
    <div className="space-y-5 w-full max-w-none" data-feature="Ukuran Tampilan Menu">
      <UnifiedProfileTabs
        displayName={profile.displayName}
        email={profile.email}
        role={snapshot.role || "owner"}
        outletName={activeOutletName}
        onSignOut={onSignOut}
        extraAccountSlot={
          import.meta.env.DEV ? (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Simulasi Role Pengguna (Audit & Validasi RBAC):
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {[
                  {
                    id: "owner",
                    label: "Owner HQ",
                    desc: "Akses penuh seluruh cabang, menu & pengaturan",
                  },
                  {
                    id: "manager",
                    label: "Manager Outlet",
                    desc: "Akses data outlet & shift, dilarang ubah pengaturan bisnis",
                  },
                  {
                    id: "cashier",
                    label: "Kasir POS",
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
                        "flex flex-col items-start rounded-2xl border p-3 text-left transition-all cursor-pointer",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-brand ring-1 ring-primary"
                          : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="text-xs font-black">{r.label}</span>
                      <span className="text-xs opacity-80 mt-0.5">{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : undefined
        }
      />
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

  const editingRef = useRef(false);
  editingRef.current = editing || saving;

  useEffect(() => {
    const handleFocus = () => {
      // Jangan timpa form yang sedang diedit saat kembali dari aplikasi lain.
      if (editingRef.current) return;
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
              <h3 className="text-lg font-black">Masuk POS Kasir</h3>
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
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border hover:border-primary/50 hover:bg-muted/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/75 group-hover:bg-primary/10 group-hover:text-primary transition-colors font-bold text-xs shrink-0">
                    <Store className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground truncate">{out.name || (out as any).outlet_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{out.address || out.code || "Outlet Aktif"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Buka POS</span>
                  <ChevronRight className="size-4 shrink-0" />
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

const STORAGE_SWR_SNAPSHOT_KEY = "kebabschoicepos_swr_snapshot_v1";
const STORAGE_SWR_PROFILE_KEY = "kebabschoicepos_swr_profile_v1";

let cachedMemorySnapshot: Snapshot | null = null;
let cachedMemoryProfile: UserProfile | null = null;
let cachedMemoryUserId: string | null = null;

function readSwrSnapshot(): { snapshot: Snapshot; hasCache: boolean } {
  if (cachedMemorySnapshot && cachedMemorySnapshot.businessId) {
    return { snapshot: cachedMemorySnapshot, hasCache: true };
  }
  if (typeof window !== "undefined") {
    try {
      const rawSwr = localStorage.getItem(STORAGE_SWR_SNAPSHOT_KEY);
      if (rawSwr) {
        const parsed = JSON.parse(rawSwr);
        if (parsed && parsed.snapshot) {
          const restored: Snapshot = {
            ...emptySnapshot,
            ...parsed.snapshot,
          };
          cachedMemorySnapshot = restored;
          cachedMemoryUserId = parsed.userId || null;
          return { snapshot: restored, hasCache: Boolean(restored.businessId) };
        }
      }
    } catch {}

    try {
      const rawIdentity = localStorage.getItem("kebabschoicepos_business_identity");
      const savedRole = localStorage.getItem("kebabschoicepos_user_role");
      if (rawIdentity) {
        const cached = JSON.parse(rawIdentity);
        return {
          snapshot: {
            ...emptySnapshot,
            businessId: cached.businessId || null,
            businessName: cached.businessName || "",
            logo: cached.logo || null,
            city: cached.city || "",
            role: savedRole || emptySnapshot.role,
          },
          hasCache: false,
        };
      }
    } catch {}
  }
  return { snapshot: emptySnapshot, hasCache: false };
}

function readSwrProfile(): UserProfile {
  if (cachedMemoryProfile) return cachedMemoryProfile;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_SWR_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email) {
          const prof: UserProfile = {
            email: String(parsed.email),
            displayName: String(parsed.displayName || "Admin"),
          };
          cachedMemoryProfile = prof;
          return prof;
        }
      }
    } catch {}
  }
  return { email: "admin@kitapos.id", displayName: "Admin" };
}

function writeSwrSnapshot(userId: string, nextSnapshot: Snapshot, nextProfile: UserProfile) {
  cachedMemoryUserId = userId;
  cachedMemorySnapshot = nextSnapshot;
  cachedMemoryProfile = nextProfile;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_SWR_PROFILE_KEY, JSON.stringify(nextProfile));
  } catch {}
  try {
    localStorage.setItem(
      STORAGE_SWR_SNAPSHOT_KEY,
      JSON.stringify({ userId, updatedAt: Date.now(), snapshot: nextSnapshot }),
    );
  } catch {
    // Fallback if QuotaExceededError due to embedded base64 product thumbnails
    try {
      const slimSnapshot: Snapshot = {
        ...nextSnapshot,
        products: (nextSnapshot.products || []).map((p) => ({
          ...p,
          image_url:
            typeof p.image_url === "string" && p.image_url.startsWith("data:")
              ? null
              : p.image_url,
        })),
        orders: (nextSnapshot.orders || []).slice(0, 150),
        orderItems: (nextSnapshot.orderItems || []).slice(0, 300),
      };
      localStorage.setItem(
        STORAGE_SWR_SNAPSHOT_KEY,
        JSON.stringify({ userId, updatedAt: Date.now(), snapshot: slimSnapshot }),
      );
    } catch {}
  }
}

function clearSwrSnapshot() {
  cachedMemoryUserId = null;
  cachedMemorySnapshot = null;
  cachedMemoryProfile = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_SWR_SNAPSHOT_KEY);
      localStorage.removeItem(STORAGE_SWR_PROFILE_KEY);
    } catch {}
  }
}

export function KebabsChoicePOSApp({ page }: { page: AppPage }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const initialSwr = useMemo(() => readSwrSnapshot(), []);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => initialSwr.snapshot);
  const [profile, setProfile] = useState<UserProfile>(() => readSwrProfile());
  const [isSnapshotLoading, setIsSnapshotLoading] = useState<boolean>(() => !initialSwr.hasCache);
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
      try {
        const currentOid =
          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
          localStorage.getItem("kebabschoicepos_active_outlet_id") ||
          snapshot.assignedOutletId;
        const outletKey = getOutletShiftKey(currentOid);
        const rawShift =
          (outletKey && localStorage.getItem(outletKey)) ||
          localStorage.getItem("kebabschoicepos_active_shift");
        if (!rawShift) {
          return "";
        }
        const parsed = JSON.parse(rawShift);
        if (parsed?.status !== "open") {
          return "";
        }
        const activeCashier = localStorage.getItem("kebabschoicepos_active_cashier_name");
        if (activeCashier && activeCashier.trim()) {
          const trimmed = activeCashier.trim();
          const lower = trimmed.toLowerCase();
          if (
            lower !== "kadut" &&
            !lower.startsWith("pos outlet -") &&
            !lower.includes("terminal outlet") &&
            !lower.includes("akun login outlet")
          ) {
            return trimmed;
          }
        }
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
      } catch {
        return "";
      }
    }
    return "";
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
      let openShiftsQuery = supabase
        .from("pos_shifts" as any)
        .select("*")
        .eq("status", "open")
        .eq("outlet_id", out.id);
      if (snapshot.businessId) {
        openShiftsQuery = openShiftsQuery.eq("business_id", snapshot.businessId);
      }
      const { data: openShifts } = await openShiftsQuery
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
        if (row.cashier_name) {
          setActiveCashierName(row.cashier_name);
          localStorage.setItem("kebabschoicepos_active_cashier_name", row.cashier_name);
        }
      } else {
        localStorage.removeItem(`kebabschoicepos_active_shift_${out.id}`);
        localStorage.removeItem("kebabschoicepos_active_shift");
        localStorage.removeItem("kebabschoicepos_active_cashier_name");
        setActiveCashierName("");
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
      if (e?.detail && "cashierName" in e.detail) {
        setActiveCashierName(e.detail.cashierName || "");
      } else {
        setActiveCashierName(getResolvedCashierName());
      }
    };
    const handleShiftSync = () => {
      setActiveCashierName(getResolvedCashierName());
    };
    window.addEventListener("pos:cashier-changed", handleCashierChange);
    window.addEventListener("pos:shift-updated", handleShiftSync);
    window.addEventListener("outlet:changed", handleShiftSync);
    return () => {
      window.removeEventListener("pos:cashier-changed", handleCashierChange);
      window.removeEventListener("pos:shift-updated", handleShiftSync);
      window.removeEventListener("outlet:changed", handleShiftSync);
    };
  }, []);

  const handleSelectCashier = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setActiveCashierName(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("kebabschoicepos_active_cashier_name", trimmed);
      try {
        const currentOid =
          localStorage.getItem("kebabschoicepos_selected_outlet_id") ||
          localStorage.getItem("kebabschoicepos_active_outlet_id") ||
          snapshot.assignedOutletId;
        const outletKey = getOutletShiftKey(currentOid);
        if (outletKey) {
          const rawShift = localStorage.getItem(outletKey);
          if (rawShift) {
            const shift = JSON.parse(rawShift);
            shift.cashierName = trimmed;
            localStorage.setItem(outletKey, JSON.stringify(shift));
          }
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
    applyUiScale();
  }, []);

  async function refresh() {
    try {
      const authUser = await resolveAuthenticatedUser();
      if (!authUser) {
        clearSwrSnapshot();
        await navigate({ to: "/auth", replace: true });
        return;
      }

      if (cachedMemoryUserId && cachedMemoryUserId !== authUser.id) {
        clearSwrSnapshot();
      }

      const userEmail = authUser.email ?? "admin@kitapos.id";
      const nameFromMetadata =
        (typeof authUser.user_metadata?.display_name === "string"
          ? authUser.user_metadata.display_name
          : userEmail.split("@")[0]) || "User";
      const nextProfile: UserProfile = { email: userEmail, displayName: nameFromMetadata };
      setProfile(nextProfile);
      const nextSnapshot = await loadSnapshot(authUser.id, nextProfile);
      const committedProfile = { ...nextProfile };
      setProfile(committedProfile);
      setSnapshot(nextSnapshot);
      writeSwrSnapshot(authUser.id, nextSnapshot, committedProfile);
      if (typeof window !== "undefined" && nextSnapshot?.businessId) {
        window.dispatchEvent(
          new CustomEvent("app:snapshot-ready", {
            detail: {
              businessId: nextSnapshot.businessId,
              outletId: nextSnapshot.assignedOutletId || null,
            },
          }),
        );
      }
    } catch (err) {
      console.warn("[refresh] Error loading snapshot:", err);
      setSnapshot((prev) => (prev?.businessId ? prev : emptySnapshot));
    } finally {
      setIsSnapshotLoading(false);
    }
  }

  // Language reactivity: re-render components on language change immediately
  useEffect(() => {
    // Language reactivity: re-render components on language change immediately
    const handleLangChange = () => {
      setLangTick((prev) => prev + 1);
    };
    window.addEventListener("language:changed", handleLangChange);
    window.addEventListener("languagechange", handleLangChange);
    i18n.on("languageChanged", handleLangChange);
    return () => {
      window.removeEventListener("language:changed", handleLangChange);
      window.removeEventListener("languagechange", handleLangChange);
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

  // Window event listeners for immediate cross-module sync
  useEffect(() => {
    const handleMenuSync = () => {
      refresh().catch(() => undefined);
    };
    const handleBusinessUpdated = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        setSnapshot((prev) => ({
          ...prev,
          businessName: detail.business_name || detail.name || prev.businessName,
          logo: detail.logo !== undefined ? detail.logo : prev.logo,
          city: detail.city || prev.city,
        }));
      }
      refresh().catch(() => undefined);
    };
    window.addEventListener("pos:menu-updated", handleMenuSync);
    window.addEventListener("menu-updated", handleMenuSync);
    window.addEventListener("inventory:updated", handleMenuSync);
    window.addEventListener("order:created", handleMenuSync);
    window.addEventListener("outlet:staff-updated", handleMenuSync);
    window.addEventListener("business:updated", handleBusinessUpdated);

    return () => {
      window.removeEventListener("pos:menu-updated", handleMenuSync);
      window.removeEventListener("menu-updated", handleMenuSync);
      window.removeEventListener("inventory:updated", handleMenuSync);
      window.removeEventListener("order:created", handleMenuSync);
      window.removeEventListener("outlet:staff-updated", handleMenuSync);
      window.removeEventListener("business:updated", handleBusinessUpdated);
    };
  }, []);

  useEffect(() => {
    // Stale-while-revalidate: render cached snapshot immediately (0ms) and refresh silently in background
    refresh().catch((error) => {
      console.warn("[Dashboard] Background revalidate warning:", error);
    });
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

  const [appManagerPermissions, setAppManagerPermissions] = useState<ManagerPermissions>(() =>
    getCachedManagerPermissions(),
  );

  useEffect(() => {
    const roleLower = (snapshot.role || "").toLowerCase();
    if (roleLower !== "manager") return;
    let cancelled = false;

    const loadPerms = () => {
      getManagerPermissions(snapshot.businessId || undefined, snapshot.assignedOutletId || undefined)
        .then((perms) => {
          if (!cancelled) setAppManagerPermissions(perms);
        })
        .catch(() => {});
    };

    loadPerms();
    const handlePermsUpdated = (e: any) => {
      if (e?.detail && typeof e.detail === "object") {
        setAppManagerPermissions(e.detail as ManagerPermissions);
      } else {
        loadPerms();
      }
    };
    window.addEventListener("permissions:updated", handlePermsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("permissions:updated", handlePermsUpdated);
    };
  }, [snapshot.role, snapshot.businessId, snapshot.assignedOutletId]);

  async function handleSignOut() {
    clearSwrSnapshot();
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
    window.location.href = "/";
  }

  const content = useMemo(() => {
    // SECURITY LOCK SCREEN: Perangkat POS Outlet menunggu konfirmasi email Owner
    if (snapshot.isPendingConfirmation) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
          <div className="size-20 rounded-3xl bg-muted text-foreground/75 flex items-center justify-center mb-5 shadow-lg border border-border">
            <Lock className="size-10" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-foreground/75 bg-muted px-3 py-1 rounded-full mb-2">
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
    const isHQRole = isHQRoleCheck(userRole);
    const isCashierRole = isStrictPOSOnlyRole(userRole) || (!isHQRole && userRole !== "owner");
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

    // RBAC GUARD 1: KASIR / STAFF / POS dilarang membuka modul HQ dan laporan finansial
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

    // RBAC GUARD 2: MANAGER diizinkan ke halaman HQ sesuai toggle Owner (manager-permissions.service.ts)
    const isAccountSelfPage = [
      "profile",
      "change-password",
      "login-activity",
      "language-settings",
    ].includes(page);
    const normalizedPageForPerm = page === "outlet" ? "outlets" : page;
    const isManagerBlockedPage =
      isManagerRole &&
      !isPosPage &&
      !isAccountSelfPage &&
      !canManagerAccessHQRoute(normalizedPageForPerm, appManagerPermissions);

    if (isManagerBlockedPage) {
      const fallbackRoute = getDefaultManagerHQRoute(appManagerPermissions);
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-8">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-muted text-foreground/75 mb-4">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-2xl font-black">Akses Terbatas (RBAC Manager)</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Halaman ini tidak diaktifkan pada Hak Akses Manager oleh Owner HQ. Hubungi Owner jika
            Anda memerlukan izin akses ke modul ini.
          </p>
          <Button
            onClick={() => navigate({ to: fallbackRoute as any })}
            className="mt-6 font-bold gap-2"
          >
            <Building2 className="size-4" />
            {fallbackRoute === "/pos" ? "Kembali ke POS Kasir" : "Kembali ke Modul Diizinkan"}
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
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
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
      return (
        <PosProfilePage
          displayName={profile.displayName}
          email={profile.email}
          role={snapshot.role}
          onSignOut={handleSignOut}
        />
      );
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
      return (
        <OrdersPage
          snapshot={snapshot}
          onRefresh={refresh}
          isPosOrders={page === "pos-orders"}
          isLoading={isSnapshotLoading}
        />
      );
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
      return <CustomersPage snapshot={snapshot} isLoading={isSnapshotLoading} />;
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
      return (
        <ProfilePage
          profile={profile}
          snapshot={snapshot}
          onRefresh={refresh}
          onSignOut={handleSignOut}
        />
      );
    }
    if (page === "staff") {
      return <StaffManagement snapshot={snapshot} />;
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
    return <DashboardPage snapshot={snapshot} userName={profile.displayName} />;
  }, [page, snapshot, profile, activeCashierName, appManagerPermissions, isSnapshotLoading]);

  return (
    <main
      className={cn(
        "min-h-screen bg-background text-foreground",
        page === "pos" && "min-[680px]:h-[100dvh] min-[680px]:min-h-0 min-[680px]:overflow-hidden",
      )}
    >
      <div className="fixed inset-0 -z-10 bg-background" />
      {isPosMode && isSidebarCollapsed && (
        <button
          type="button"
          onClick={handleToggleSidebar}
          title="Buka Sidebar Navigasi POS"
          aria-label="Buka Sidebar"
          className="fixed top-2.5 left-2.5 z-40 hidden min-[680px]:flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-sm hover:bg-secondary transition-colors cursor-pointer"
        >
          <PanelLeftOpen className="size-4.5" />
        </button>
      )}
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
      <div
        className={cn(
          "flex w-full min-w-0",
          page === "pos" && "min-[680px]:h-[100dvh] min-[680px]:overflow-hidden",
        )}
      >
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
            "min-w-0 flex-1 w-full min-h-[calc(100vh-5rem)] bg-muted/30 transition-all duration-300",
            page === "pos"
              ? "px-2.5 py-2.5 pb-36 min-[680px]:h-full min-[680px]:min-h-0 min-[680px]:overflow-hidden min-[680px]:p-2"
              : isPosMode
                ? "px-3 py-3 pb-24 min-[680px]:px-3.5 min-[680px]:py-3 min-[680px]:pb-6"
                : "px-4 py-6 pb-28 lg:px-8 lg:pb-8",
            isPosMode && isSidebarCollapsed && "min-[680px]:pl-14",
            !isPosMode && isSidebarCollapsed && "lg:px-6",
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
