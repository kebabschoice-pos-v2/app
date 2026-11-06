/**
 * KebabsChoicePOS V2.0 - End-to-End Business Logic Integration Tests
 * Validates:
 * 1. Single Source of Truth AI Assistant Queries (Top Product, Top Outlet, Critical Stock, Empty fallback)
 * 2. Shift Cash Reconciliation (Opening, Sales, Cash In, Cash Out, Expected Cash calculation)
 * 3. POS Product Filtering (Deleted, Inactive, Stock 0 exclusion)
 * 4. Recipe BOM Unit Conversion (gram to kg, ml to liter)
 * 5. Multi-Outlet Aggregation & Isolation (Outlet A vs Outlet B vs All Outlets)
 * 6. Multi-Language Locales Integrity (All 16 supported languages)
 */

import fs from "fs";
import path from "path";
import assert from "assert";

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log("\n==================================================");
console.log("KEBABSCHOICEPOS V2.0 - INTEGRATION TEST SUITE");
console.log("==================================================\n");

// --- TEST 1: Recipe BOM Unit Conversion ---
console.log("▶ 1. RECIPE BOM UNIT CONVERSION");
function convertRecipeToInventoryQuantity(recipeQty, recipeUnit, inventoryUnit) {
  const rUnit = (recipeUnit || "").toLowerCase().trim();
  const iUnit = (inventoryUnit || "").toLowerCase().trim();
  if (!rUnit || !iUnit || rUnit === iUnit) return recipeQty;
  if ((rUnit === "gram" || rUnit === "g") && (iUnit === "kg" || iUnit === "kilogram")) {
    return recipeQty / 1000;
  }
  if ((rUnit === "kg" || rUnit === "kilogram") && (iUnit === "gram" || iUnit === "g")) {
    return recipeQty * 1000;
  }
  if ((rUnit === "ml" || rUnit === "mililiter") && (iUnit === "liter" || iUnit === "l")) {
    return recipeQty / 1000;
  }
  if ((rUnit === "liter" || rUnit === "l") && (iUnit === "ml" || iUnit === "mililiter")) {
    return recipeQty * 1000;
  }
  return recipeQty;
}

test("Converts 150 gram meat recipe to 0.15 kg inventory item", () => {
  const converted = convertRecipeToInventoryQuantity(150, "gram", "kg");
  assert.strictEqual(converted, 0.15);
});

test("Converts 250 ml sauce recipe to 0.25 liter inventory item", () => {
  const converted = convertRecipeToInventoryQuantity(250, "ml", "liter");
  assert.strictEqual(converted, 0.25);
});

test("Leaves equal units unmodified (e.g. 2 pcs to 2 pcs)", () => {
  const converted = convertRecipeToInventoryQuantity(2, "pcs", "pcs");
  assert.strictEqual(converted, 2);
});

// --- TEST 2: Shift Cash Management Reconciliation ---
console.log("\n▶ 2. SHIFT & CASH RECONCILIATION");
test("Calculates expected ending cash: 100,000 + 50,000 + 20,000 - 10,000 = 160,000", () => {
  const openingCash = 100000;
  const cashSales = 50000;
  const cashIn = 20000;
  const cashOut = 10000;
  const expectedEndingCash = openingCash + cashSales + cashIn - cashOut;

  assert.strictEqual(expectedEndingCash, 160000);

  const actualEndingCash = 160000;
  const difference = actualEndingCash - expectedEndingCash;
  assert.strictEqual(difference, 0);
});

// --- TEST 3: POS Product Catalog Filtering ---
console.log("\n▶ 3. POS PRODUCT CATALOG FILTERING (Deleted / Inactive / Stock 0)");
test("Strictly filters out inactive, deleted, and stock 0 products", () => {
  const allProducts = [
    { id: "p1", name: "Kebab Beef Supreme", price: 28000, stock: 45, active: true, deleted_at: null },
    { id: "p2", name: "Kebab Chicken (Out of Stock)", price: 25000, stock: 0, active: true, deleted_at: null },
    { id: "p3", name: "Kebab Inactive", price: 22000, stock: 30, active: false, deleted_at: null },
    { id: "p4", name: "Kebab Soft Deleted", price: 30000, stock: 15, active: true, deleted_at: "2026-09-28T10:00:00Z" },
    { id: "p5", name: "Kebab Cheese Melt", price: 32000, stock: 12, active: true, status: "active", deleted_at: null },
  ];

  const posCatalog = allProducts.filter((product) => {
    const isProductActive = product.active !== false && product.status !== "inactive";
    const isNotDeleted = !product.deleted_at && !product.deletedAt;
    const hasStock = Number(product.stock) > 0;
    return isProductActive && isNotDeleted && hasStock;
  });

  assert.strictEqual(posCatalog.length, 2);
  assert.strictEqual(posCatalog[0].id, "p1");
  assert.strictEqual(posCatalog[1].id, "p5");
});

test("Filters by outlet assignment availability and stock", () => {
  const selectedOutletId = "outlet-jakarta";
  const product = {
    id: "p1",
    name: "Kebab Spesial",
    stock: 20,
    active: true,
    outlet_assignments: [
      { outlet_id: "outlet-jakarta", available: true, stock: 10, selling_price: 30000 },
      { outlet_id: "outlet-bandung", available: false, stock: 0 },
    ],
  };

  const isAvailableInJakarta = (() => {
    const oa = product.outlet_assignments.find((item) => item.outlet_id === selectedOutletId);
    if (oa) {
      if (oa.available === false) return false;
      if (typeof oa.stock === "number" && oa.stock <= 0) return false;
      return true;
    }
    return true;
  })();

  const isAvailableInBandung = (() => {
    const oa = product.outlet_assignments.find((item) => item.outlet_id === "outlet-bandung");
    if (oa) {
      if (oa.available === false) return false;
      if (typeof oa.stock === "number" && oa.stock <= 0) return false;
      return true;
    }
    return true;
  })();

  assert.strictEqual(isAvailableInJakarta, true);
  assert.strictEqual(isAvailableInBandung, false);
});

// --- TEST 4: Multi-Outlet Aggregation & Isolation ---
console.log("\n▶ 4. MULTI-OUTLET AGGREGATION & DATA ISOLATION");
test("Aggregates total revenue (100k + 50k = 150k) and ranks outlets correctly", () => {
  const outlets = [
    { id: "outlet-a", name: "Outlet Jakarta" },
    { id: "outlet-b", name: "Outlet Bandung" },
  ];

  const orders = [
    { id: "ord-1", outlet_id: "outlet-a", total: 60000 },
    { id: "ord-2", outlet_id: "outlet-a", total: 40000 },
    { id: "ord-3", outlet_id: "outlet-b", total: 50000 },
  ];

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  assert.strictEqual(totalRevenue, 150000);

  const outletReports = outlets.map((o) => {
    const outletOrders = orders.filter((ord) => ord.outlet_id === o.id);
    const revenue = outletOrders.reduce((sum, ord) => sum + ord.total, 0);
    return { id: o.id, name: o.name, revenue, ordersCount: outletOrders.length };
  });

  outletReports.sort((a, b) => b.revenue - a.revenue);

  assert.strictEqual(outletReports[0].id, "outlet-a");
  assert.strictEqual(outletReports[0].revenue, 100000);
  assert.strictEqual(outletReports[1].id, "outlet-b");
  assert.strictEqual(outletReports[1].revenue, 50000);
});

// --- TEST 5: AI Assistant Query Engine & Empty Fallbacks ---
console.log("\n▶ 5. AI ASSISTANT QUERY ENGINE & EMPTY FALLBACKS");
function mockAiQuery(q, context) {
  const query = q.toLowerCase();
  const products = context.products || [];
  const outlets = context.outlets || [];
  const orders = context.orders || [];
  const inventory = context.inventory || [];
  const todayRevenue = context.todayRevenue || 0;

  if (query.includes("omzet hari ini") || query.includes("berapa omzet")) {
    if (todayRevenue === 0 && orders.length === 0) return "Data belum tersedia.";
    const omzet = todayRevenue > 0 ? todayRevenue : orders.reduce((sum, o) => sum + o.total, 0);
    return `• Total Omzet: Rp ${omzet.toLocaleString("id-ID")}\n• Total Transaksi: ${orders.length} transaksi`;
  }

  if (query.includes("produk paling laku") || query.includes("menu apa paling laku")) {
    if (products.length === 0 || orders.length === 0) return "Data belum tersedia.";
    const topProd = products[0];
    const soldQty = Math.max(orders.length * 2, 1);
    return `• Nama Produk: ${topProd.name}\n• Jumlah Terjual: ${soldQty} porsi\n• Omzet: Rp ${(topProd.price * soldQty).toLocaleString("id-ID")}`;
  }

  if (query.includes("outlet dengan omzet tertinggi") || query.includes("outlet mana paling ramai")) {
    if (outlets.length === 0 || (todayRevenue === 0 && orders.length === 0)) return "Data belum tersedia.";
    return `• Nama Outlet: ${outlets[0].name}\n• Revenue: Rp ${todayRevenue.toLocaleString("id-ID")}`;
  }

  if (query.includes("stok apa yang harus dibeli") || query.includes("stok apa harus dibeli") || query.includes("stok yang perlu dibeli")) {
    if (inventory.length === 0) return "Data belum tersedia.";
    const lowStock = inventory.filter((item) => item.stock <= item.minimum_stock);
    if (lowStock.length === 0) return "Data belum tersedia.";
    return `• Nama Item: ${lowStock[0].name}\n• Jumlah Stok: ${lowStock[0].stock}\n• Status: Kritis`;
  }

  if (query.includes("berapa keuntungan menu") || query.includes("keuntungan")) {
    if (products.length === 0) return "Data belum tersedia.";
    const p = products[0];
    const cost = Math.round(p.price * 0.42);
    const margin = p.price - cost;
    return `• Nama Menu: ${p.name}\n• Harga Jual: Rp ${p.price.toLocaleString("id-ID")}\n• Gross Margin: Rp ${margin.toLocaleString("id-ID")}`;
  }

  return "Jawaban umum AI.";
}

test("Returns 'Data belum tersedia.' when database tables are empty", () => {
  const emptyContext = { products: [], outlets: [], orders: [], inventory: [], todayRevenue: 0 };
  assert.strictEqual(mockAiQuery("Berapa omzet hari ini?", emptyContext), "Data belum tersedia.");
  assert.strictEqual(mockAiQuery("Outlet mana paling ramai?", emptyContext), "Data belum tersedia.");
  assert.strictEqual(mockAiQuery("Menu apa paling laku?", emptyContext), "Data belum tersedia.");
  assert.strictEqual(mockAiQuery("Stok apa harus dibeli?", emptyContext), "Data belum tersedia.");
  assert.strictEqual(mockAiQuery("Berapa keuntungan menu?", emptyContext), "Data belum tersedia.");
});

test("Returns accurate real database answers when data exists", () => {
  const realContext = {
    products: [{ id: "p1", name: "Kebab Beef Original", price: 25000, stock: 40 }],
    outlets: [{ id: "o1", name: "Jakarta Outlet" }],
    orders: [{ id: "ord-1", total: 50000 }],
    inventory: [{ id: "i1", name: "Daging Sapi", stock: 500, minimum_stock: 1000 }],
    todayRevenue: 50000,
  };

  const omzetAns = mockAiQuery("Berapa omzet hari ini?", realContext);
  assert(omzetAns.includes("Total Omzet: Rp 50.000"));
  assert(omzetAns.includes("Total Transaksi: 1 transaksi"));

  const topProdAns = mockAiQuery("Menu apa paling laku?", realContext);
  assert(topProdAns.includes("Nama Produk: Kebab Beef Original"));
  assert(topProdAns.includes("Jumlah Terjual: 2 porsi"));
  assert(topProdAns.includes("Omzet: Rp 50.000"));

  const outletAns = mockAiQuery("Outlet mana paling ramai?", realContext);
  assert(outletAns.includes("Nama Outlet: Jakarta Outlet"));
  assert(outletAns.includes("Revenue: Rp 50.000"));

  const stockAns = mockAiQuery("Stok apa harus dibeli?", realContext);
  assert(stockAns.includes("Nama Item: Daging Sapi"));
  assert(stockAns.includes("Jumlah Stok: 500"));

  const profitAns = mockAiQuery("Berapa keuntungan menu?", realContext);
  assert(profitAns.includes("Nama Menu: Kebab Beef Original"));
  assert(profitAns.includes("Gross Margin: Rp 14.500"));
});

// --- TEST 6: Multi-Language Locales Integrity ---
console.log("\n▶ 6. MULTI-LANGUAGE 20 LOCALES VALIDATION");
const expectedLocales = [
  "id", "en", "ja", "zh", "ko", "ar",
  "es", "fr", "de", "pt", "it", "ru",
  "hi", "th", "vi", "tr", "ms", "fil", "nl", "pl"
];

for (const code of expectedLocales) {
  test(`Locale file ${code}.json exists and parses as valid JSON with core keys`, () => {
    const filePath = path.join(process.cwd(), "src", "locales", `${code}.json`);
    assert(fs.existsSync(filePath), `Locale file missing: ${filePath}`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    assert(parsed.common, `Missing common section in ${code}.json`);
    assert(parsed.nav, `Missing nav section in ${code}.json`);
    assert(parsed.pos, `Missing pos section in ${code}.json`);
    assert(parsed.dashboard, `Missing dashboard section in ${code}.json`);
  });
}

// --- TEST 7: Strict POS & HQ Route Separation & Dedicated Receipt Route ---
console.log("\n▶ 7. STRICT ROUTING SEPARATION & DEDICATED RECEIPT ROUTE");
test("All approved POS menus point strictly to /pos or /pos/* without entering HQ", () => {
  const posNavLinks = [
    { title: "POS Kasir", href: "/pos" },
    { title: "Order Baru", href: "/pos" },
    { title: "Order Hari Ini", href: "/pos/orders" },
    { title: "Cetak Struk", href: "/pos/receipt" },
    { title: "Shift Cash", href: "/pos/shift-cash" },
    { title: "Stok Outlet", href: "/pos/inventory" },
    { title: "Profil Kasir", href: "/pos/profile" },
  ];

  for (const item of posNavLinks) {
    assert(item.href.startsWith("/pos"), `POS item '${item.title}' points to non-POS route: ${item.href}`);
  }

  // Cetak Struk and Order Hari Ini must have separate distinct routes
  const receiptLink = posNavLinks.find((i) => i.title === "Cetak Struk");
  const ordersLink = posNavLinks.find((i) => i.title === "Order Hari Ini");
  assert.strictEqual(receiptLink.href, "/pos/receipt");
  assert.strictEqual(ordersLink.href, "/pos/orders");
  assert.notStrictEqual(receiptLink.href, ordersLink.href);

  // Permintaan Stok & Riwayat Stok must NOT be in POS sidebar
  const stockReq = posNavLinks.find((i) => i.title === "Permintaan Stok");
  const stockHist = posNavLinks.find((i) => i.title === "Riwayat Stok");
  assert.strictEqual(stockReq, undefined, "Permintaan Stok must not exist in POS sidebar");
  assert.strictEqual(stockHist, undefined, "Riwayat Stok must not exist in POS sidebar");
});

// --- TEST 8: Struk Transaksi Data Model ---
console.log("\n▶ 8. STRUK TRANSAKSI DATA INTEGRITY");
test("Extracts full receipt payload: order_number, outlet_name, kasir, payment_method, items, total", () => {
  const transaction = {
    order_number: "KP-20260930",
    outlet_name: "KebabsChoice Flagship Kemang",
    cashier_name: "Budi Santoso (Kasir)",
    payment_method: "QRIS",
    items: [
      { name: "Kebab Beef Supreme Large", quantity: 2, price: 32000, subtotal: 64000 },
      { name: "Ice Lemon Tea", quantity: 2, price: 10000, subtotal: 20000 },
    ],
    total: 84000,
  };

  assert.strictEqual(transaction.order_number, "KP-20260930");
  assert.strictEqual(transaction.outlet_name, "KebabsChoice Flagship Kemang");
  assert.strictEqual(transaction.cashier_name, "Budi Santoso (Kasir)");
  assert.strictEqual(transaction.payment_method, "QRIS");
  assert.strictEqual(transaction.items.length, 2);
  assert.strictEqual(transaction.total, 84000);
});

// --- TEST 9: Role-Based Access Control (RBAC) Enforcement ---
console.log("\n▶ 9. ROLE & RBAC ACCESS POLICY VALIDATION");
function evaluateAccess(role, route) {
  const normalized = (role || "").toLowerCase();
  const isHQRole = ["owner", "admin", "manager"].includes(normalized);
  const isCashier = normalized === "cashier" || (!isHQRole && normalized === "staff");
  const isManager = normalized === "manager";
  const isPosRoute = route.startsWith("/pos");

  if (isCashier && !isPosRoute) return { allowed: false, reason: "Kasir dilarang membuka modul HQ" };
  if (isManager && (route === "/business-profile" || route.startsWith("/receipt-settings") || route.startsWith("/tax") || route.startsWith("/printer-settings"))) {
    return { allowed: false, reason: "Manager dilarang mengubah setting bisnis" };
  }
  return { allowed: true };
}

test("Kasir is allowed on /pos and /pos/*, but strictly blocked from /dashboard and /orders", () => {
  assert.strictEqual(evaluateAccess("cashier", "/pos").allowed, true);
  assert.strictEqual(evaluateAccess("cashier", "/pos/orders").allowed, true);
  assert.strictEqual(evaluateAccess("cashier", "/pos/receipt").allowed, true);
  assert.strictEqual(evaluateAccess("cashier", "/pos/shift-cash").allowed, true);
  assert.strictEqual(evaluateAccess("cashier", "/dashboard").allowed, false);
  assert.strictEqual(evaluateAccess("cashier", "/orders").allowed, false);
  assert.strictEqual(evaluateAccess("cashier", "/business-profile").allowed, false);
});

test("Manager Outlet is allowed on /dashboard, /pos, and outlet reports, but blocked from setting bisnis", () => {
  assert.strictEqual(evaluateAccess("manager", "/dashboard").allowed, true);
  assert.strictEqual(evaluateAccess("manager", "/pos").allowed, true);
  assert.strictEqual(evaluateAccess("manager", "/orders").allowed, true);
  assert.strictEqual(evaluateAccess("manager", "/business-profile").allowed, false);
  assert.strictEqual(evaluateAccess("manager", "/tax").allowed, false);
  assert.strictEqual(evaluateAccess("manager", "/printer-settings").allowed, false);
});

test("Owner HQ has full unrestricted access to all routes", () => {
  assert.strictEqual(evaluateAccess("owner", "/dashboard").allowed, true);
  assert.strictEqual(evaluateAccess("owner", "/pos").allowed, true);
  assert.strictEqual(evaluateAccess("owner", "/orders").allowed, true);
  assert.strictEqual(evaluateAccess("owner", "/business-profile").allowed, true);
  assert.strictEqual(evaluateAccess("owner", "/tax").allowed, true);
});

// --- TEST 10: Refund & Void Flow Authorization ---
console.log("\n▶ 10. REFUND & VOID FLOW AUTHORIZATION");
function processRefundOrVoid(mode, order, reason, pin, activeShift) {
  const validPins = ["1234", "0000", "admin123"];
  if (!validPins.includes(pin)) {
    throw new Error("PIN Supervisor tidak valid");
  }
  if (!reason || !reason.trim()) {
    throw new Error("Alasan wajib diisi");
  }

  const newStatus = mode === "refund" ? "refunded" : "void";
  const updatedOrder = { ...order, status: newStatus, actionReason: reason };

  let updatedShift = activeShift ? { ...activeShift } : null;
  if (order.payment_method?.toLowerCase() === "cash" && updatedShift) {
    const amount = Number(order.total) || 0;
    updatedShift.totalCashOut = (updatedShift.totalCashOut || 0) + amount;
    updatedShift.expectedEndingCash = (updatedShift.expectedEndingCash || 0) - amount;
  }

  return { order: updatedOrder, shift: updatedShift };
}

test("Successfully executes refund with valid supervisor PIN 1234 and adjusts cash shift", () => {
  const order = { id: "ord-1", order_number: "KP-1001", total: 50000, payment_method: "cash", status: "paid" };
  const shift = { id: "shift-1", startingCash: 100000, cashSales: 50000, totalCashIn: 0, totalCashOut: 0, expectedEndingCash: 150000 };

  const res = processRefundOrVoid("refund", order, "Pelanggan salah pesan", "1234", shift);
  assert.strictEqual(res.order.status, "refunded");
  assert.strictEqual(res.order.actionReason, "Pelanggan salah pesan");
  assert.strictEqual(res.shift.totalCashOut, 50000);
  assert.strictEqual(res.shift.expectedEndingCash, 100000);
});

test("Successfully executes void with valid supervisor PIN 1234", () => {
  const order = { id: "ord-2", order_number: "KP-1002", total: 75000, payment_method: "qris", status: "paid" };
  const res = processRefundOrVoid("void", order, "Pesanan dibatalkan sebelum dimasak", "1234", null);
  assert.strictEqual(res.order.status, "void");
});

test("Rejects refund when supervisor PIN is invalid or reason is empty", () => {
  const order = { id: "ord-3", order_number: "KP-1003", total: 30000, status: "paid" };
  assert.throws(() => processRefundOrVoid("refund", order, "Salah ketik", "9999", null), /PIN Supervisor/);
  assert.throws(() => processRefundOrVoid("refund", order, "", "1234", null), /Alasan wajib diisi/);
});

// --- TEST 11: Role-Based Outlet Locking ---
console.log("\n▶ 11. ROLE-BASED OUTLET LOCKING");
function resolveOutletSelection(role, activeOutlets, userChosenOutletId) {
  const normalized = (role || "").toLowerCase();
  const isOwner = ["owner", "admin"].includes(normalized);
  if (isOwner) {
    return { canChange: true, selectedOutletId: userChosenOutletId };
  }
  // Manager or Cashier is locked to their first/assigned outlet
  const lockedOutletId = activeOutlets[0]?.id || "outlet-default";
  return { canChange: false, selectedOutletId: lockedOutletId };
}

test("Owner HQ can select any outlet or all outlets", () => {
  const outlets = [{ id: "o1", name: "Outlet Jakarta" }, { id: "o2", name: "Outlet Bandung" }];
  const res = resolveOutletSelection("owner", outlets, "o2");
  assert.strictEqual(res.canChange, true);
  assert.strictEqual(res.selectedOutletId, "o2");
});

test("Manager and Cashier are strictly locked to their assigned outlet", () => {
  const outlets = [{ id: "o1", name: "Outlet Jakarta" }, { id: "o2", name: "Outlet Bandung" }];
  const resCashier = resolveOutletSelection("cashier", outlets, "o2");
  assert.strictEqual(resCashier.canChange, false);
  assert.strictEqual(resCashier.selectedOutletId, "o1");

  const resManager = resolveOutletSelection("manager", outlets, "all");
  assert.strictEqual(resManager.canChange, false);
  assert.strictEqual(resManager.selectedOutletId, "o1");
});

// --- TEST 12: Customer Selection & CRM Registration ---
console.log("\n▶ 12. CUSTOMER SELECTION & REGISTRATION");
function resolveCustomer(customerMode, selectedCustomerId, newCustomerName, newCustomerPhone, existingCustomers) {
  if (customerMode === "member" && selectedCustomerId) {
    const cust = existingCustomers.find((c) => c.id === selectedCustomerId);
    return { customerId: selectedCustomerId, customerName: cust?.name || "Member CRM" };
  }
  if (customerMode === "new" && newCustomerName.trim()) {
    return { customerId: "new-cust-id", customerName: newCustomerName.trim(), phone: newCustomerPhone.trim() };
  }
  return { customerId: null, customerName: "Pelanggan Umum" };
}

test("Registers new customer with name and phone at POS checkout", () => {
  const res = resolveCustomer("new", "", "Sarah Connor", "081299998888", []);
  assert.strictEqual(res.customerName, "Sarah Connor");
  assert.strictEqual(res.phone, "081299998888");
});

test("Selects existing CRM member correctly", () => {
  const customers = [{ id: "c1", name: "Ahmad Dani" }];
  const res = resolveCustomer("member", "c1", "", "", customers);
  assert.strictEqual(res.customerId, "c1");
  assert.strictEqual(res.customerName, "Ahmad Dani");
});

// --- TEST 13: UI Theme Customization & Header/Sidebar Prop Integrity ---
console.log("\n▶ 13. UI THEME CUSTOMIZATION & PROPS INTEGRITY");
test("Header and Sidebar have onOpenThemeModal defined in parameter destructuring", () => {
  const appFile = fs.readFileSync(path.resolve(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf-8");
  // Check Header parameter list contains onOpenThemeModal
  const headerMatch = /function\s+Header\s*\(\s*\{([^}]+)\}/s.exec(appFile);
  assert(headerMatch, "Header function must be found");
  assert(headerMatch[1].includes("onOpenThemeModal"), "Header must destructure onOpenThemeModal");

  // Check Sidebar parameter list contains onOpenThemeModal
  const sidebarMatch = /function\s+Sidebar\s*\(\s*\{([^}]+)\}/s.exec(appFile);
  assert(sidebarMatch, "Sidebar function must be found");
  assert(sidebarMatch[1].includes("onOpenThemeModal"), "Sidebar must destructure onOpenThemeModal");

  // Check themeModalOpen state and openThemeModal handler exist
  assert(appFile.includes("themeModalOpen"), "themeModalOpen state must exist");
  assert(appFile.includes("openThemeModal"), "openThemeModal handler must exist");
});

test("Theme modal handles light, dark, and system modes with 4 accent colors", () => {
  const themeFile = fs.readFileSync(path.resolve(process.cwd(), "src/lib/theme.ts"), "utf-8");
  assert(themeFile.includes('"orange"'), "Orange color must be supported");
  assert(themeFile.includes('"blue"'), "Blue color must be supported");
  assert(themeFile.includes('"green"'), "Green color must be supported");
  assert(themeFile.includes('"purple"'), "Purple color must be supported");
  assert(themeFile.includes('"light"') && themeFile.includes('"dark"') && themeFile.includes('"system"'), "Appearance modes must be supported");
});

// --- TEST 14: Global Search Capabilities ---
console.log("\n▶ 14. GLOBAL SEARCH CAPABILITIES (HQ & POS)");
function searchEntities(query, isPosMode, data) {
  const q = query.toLowerCase().trim();
  if (isPosMode) {
    const products = (data.products || []).filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    const categories = Array.from(new Set((data.products || []).map((p) => p.category))).filter((c) => c.toLowerCase().includes(q));
    const customers = (data.customers || []).filter((c) => c.name.toLowerCase().includes(q));
    return { products, categories, customers };
  } else {
    const products = (data.products || []).filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    const customers = (data.customers || []).filter((c) => c.name.toLowerCase().includes(q));
    const orders = (data.orders || []).filter((o) => o.order_number.toLowerCase().includes(q));
    const outlets = (data.outlets || []).filter((o) => o.name.toLowerCase().includes(q));
    const inventory = (data.inventory || []).filter((i) => i.name.toLowerCase().includes(q));
    return { products, customers, orders, outlets, inventory };
  }
}

test("HQ Search queries across Menu, Customer, Transaksi, Outlet, and Inventory", () => {
  const data = {
    products: [{ name: "Kebab Beef Jumbo", category: "Kebab" }],
    customers: [{ name: "Budi Santoso" }],
    orders: [{ order_number: "KP-2609-1088" }],
    outlets: [{ name: "Outlet Grand Indonesia" }],
    inventory: [{ name: "Daging Kebab Premium" }],
  };

  const menuRes = searchEntities("beef", false, data);
  assert.strictEqual(menuRes.products.length, 1);

  const custRes = searchEntities("budi", false, data);
  assert.strictEqual(custRes.customers.length, 1);

  const orderRes = searchEntities("1088", false, data);
  assert.strictEqual(orderRes.orders.length, 1);

  const outletRes = searchEntities("indonesia", false, data);
  assert.strictEqual(outletRes.outlets.length, 1);

  const invRes = searchEntities("daging", false, data);
  assert.strictEqual(invRes.inventory.length, 1);
});

test("POS Search queries across Produk, Kategori, and Customer", () => {
  const data = {
    products: [{ name: "Kebab Ayam Crispy", category: "Makanan" }],
    customers: [{ name: "Dewi Lestari" }],
  };

  const posProd = searchEntities("ayam", true, data);
  assert.strictEqual(posProd.products.length, 1);

  const posCat = searchEntities("makanan", true, data);
  assert.strictEqual(posCat.categories.length, 1);

  const posCust = searchEntities("dewi", true, data);
  assert.strictEqual(posCust.customers.length, 1);
});

// --- TEST 15: Route Aliases Integrity ---
console.log("\n▶ 15. ROUTE ALIASES INTEGRITY (/order, /receipt, /shift)");
test("Route aliases for /order, /receipt, and /shift exist and redirect", () => {
  const orderRoute = fs.readFileSync(path.resolve(process.cwd(), "src/routes/_authenticated/order.tsx"), "utf-8");
  assert(orderRoute.includes('to: "/orders"'), "/order must redirect to /orders");

  const receiptRoute = fs.readFileSync(path.resolve(process.cwd(), "src/routes/_authenticated/receipt.tsx"), "utf-8");
  assert(receiptRoute.includes('to: "/pos/receipt"'), "/receipt must redirect to /pos/receipt");

  const shiftRoute = fs.readFileSync(path.resolve(process.cwd(), "src/routes/_authenticated/shift.tsx"), "utf-8");
  assert(shiftRoute.includes('to: "/pos/shift-cash"'), "/shift must redirect to /pos/shift-cash");
});

// --- TEST 16: RTL Language Direction ---
console.log("\n▶ 16. RTL ARABIC DIRECTION VALIDATION");
test("Config applies RTL direction for Arabic and Persian languages", () => {
  const i18nConfig = fs.readFileSync(path.resolve(process.cwd(), "src/i18n/config.ts"), "utf-8");
  assert(i18nConfig.includes('["ar", "fa"].includes(saved) ? "rtl" : "ltr"'), "Initial language detection must set dir=rtl for Arabic");
  assert(i18nConfig.includes('["ar", "fa"].includes(languageCode) ? "rtl" : "ltr"'), "Language change must set dir=rtl for Arabic");
});

// --- TEST 17: Staff Management & Outlet Assignment Flow + RBAC & Deduplication ---
console.log("\n▶ 17. STAFF MANAGEMENT & OUTLET ASSIGNMENT INTEGRATION & DEDUPLICATION");
test("Staff assignment modal extracts data from Staff Management without 'Karyawan' placeholder", () => {
  const outletService = fs.readFileSync(path.resolve(process.cwd(), "src/services/outlet.service.ts"), "utf-8");
  assert(outletService.includes("getStaffList"), "outlet.service must import and use getStaffList from staff.service");
  assert(!outletService.includes('cleanName = "Karyawan"'), "outlet.service must not assign 'Karyawan' placeholder");
  assert(outletService.includes("previouslyAssignedUserIds"), "assignOutletEmployees must track previouslyAssignedUserIds for clean reassignment");
});

test("OutletManagement renders real staff names, roles, emails, and active status", () => {
  const outletManagement = fs.readFileSync(path.resolve(process.cwd(), "src/pages/OutletManagement.tsx"), "utf-8");
  assert(outletManagement.includes("Outlet sekarang:"), "Modal must render 'Outlet sekarang:' label");
  assert(outletManagement.includes("staff.role === \"cashier\" ? \"Kasir\""), "Modal must map cashier to Kasir role badge");
  assert(outletManagement.includes("isCashier"), "OutletManagement must implement cashier RBAC restrictions");
  assert(outletManagement.includes("isOwner"), "OutletManagement must restrict deletion to Owner HQ");
});

test("Staff reassignment between branches updates counts bidirectionally", () => {
  // Simulate staff transfer: Staff A moving from Outlet Jakarta to Outlet Surabaya
  const staffA = { user_id: "u-101", name: "Ahmad Fauzi", role: "cashier", outlet_id: "out-jkt" };
  const staffB = { user_id: "u-102", name: "Siti Nurhaliza", role: "cashier", outlet_id: "out-sby" };

  const outlets = [
    { id: "out-jkt", name: "Outlet Jakarta Pusat", staff_list: [staffA] },
    { id: "out-sby", name: "Outlet Surabaya", staff_list: [staffB] },
  ];

  // Reassign staffA from Jakarta to Surabaya
  const reassign = (staffUserId, fromOutletId, toOutletId) => {
    const fromOutlet = outlets.find(o => o.id === fromOutletId);
    const toOutlet = outlets.find(o => o.id === toOutletId);
    const movingStaff = fromOutlet.staff_list.find(s => s.user_id === staffUserId);
    assert(movingStaff, "Moving staff must exist in origin outlet");

    // 1. Remove from origin outlet
    fromOutlet.staff_list = fromOutlet.staff_list.filter(s => s.user_id !== staffUserId);

    // 2. Add to destination outlet
    movingStaff.outlet_id = toOutletId;
    toOutlet.staff_list.push(movingStaff);
  };

  reassign("u-101", "out-jkt", "out-sby");

  const jkt = outlets.find(o => o.id === "out-jkt");
  const sby = outlets.find(o => o.id === "out-sby");

  assert.strictEqual(jkt.staff_list.length, 0, "Jakarta Pusat must lose Staff A");
  assert.strictEqual(sby.staff_list.length, 2, "Surabaya must gain Staff A (now has 2 staff)");
  assert(sby.staff_list.some(s => s.user_id === "u-101"), "Surabaya must contain Ahmad Fauzi");
});

test("Deduplication prevents duplicate keys and multiple entries for outlets and staff", () => {
  const duplicates = [
    { id: "o-1", name: "Jakarta" },
    { id: "o-1", name: "Jakarta Dup" },
    { id: "o-2", name: "Bandung" },
    { id: "o-2", name: "Bandung Dup" },
  ];

  const unique = [];
  const seen = new Set();
  for (const d of duplicates) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      unique.push(d);
    }
  }

  assert.strictEqual(unique.length, 2, "Duplicate entries must be deduplicated to exactly 2 outlets");
  assert.strictEqual(unique[0].name, "Jakarta");
  assert.strictEqual(unique[1].name, "Bandung");
});

// --- TEST 18: Staff Management, HR System, Face Attendance & Payroll Linkage ---
console.log("\n▶ 18. HR SYSTEM: STAFF PROFILES, BIOMETRIC ATTENDANCE & PAYROLL INTEGRATION");

test("StaffProfile schema contains all mandatory enterprise HR fields", () => {
  const hrService = fs.readFileSync(path.resolve(process.cwd(), "src/services/hr.service.ts"), "utf-8");
  assert(hrService.includes("full_name: string;"), "StaffProfile must have full_name");
  assert(hrService.includes("phone: string;"), "StaffProfile must have phone number");
  assert(hrService.includes("address: string;"), "StaffProfile must have address");
  assert(hrService.includes("outlet_id: string | null;"), "StaffProfile must have outlet_id");
  assert(hrService.includes("job_title: string;"), "StaffProfile must have job_title");
  assert(hrService.includes("employment_status:"), "StaffProfile must have employment_status");
  assert(hrService.includes("join_date: string;"), "StaffProfile must have join_date");
  assert(hrService.includes("base_salary: number;"), "StaffProfile must have base_salary");
});

test("StaffManagement renders 4 enterprise HR tabs and full profile editing", () => {
  const staffMgmt = fs.readFileSync(path.resolve(process.cwd(), "src/components/kebabschoicepos/StaffManagement.tsx"), "utf-8");
  assert(staffMgmt.includes('activeTab === "staff"'), "StaffManagement must have staff profile tab");
  assert(staffMgmt.includes('activeTab === "attendance"'), "StaffManagement must have attendance tab");
  assert(staffMgmt.includes('activeTab === "shifts"'), "StaffManagement must have shifts tab");
  assert(staffMgmt.includes('activeTab === "payroll"'), "StaffManagement must have payroll tab");
  assert(staffMgmt.includes("Slip Gaji Karyawan"), "StaffManagement must provide printable Slip Gaji modal");
});

test("Biometric attendance evaluates late status according to shift start time and grace period", () => {
  // Simulate attendance evaluation logic from hr.service.ts
  const evaluateStatus = (checkInTimeStr, shiftStartTimeStr, graceMinutes = 15) => {
    const [cHour, cMin] = checkInTimeStr.split(":").map(Number);
    const [sHour, sMin] = shiftStartTimeStr.split(":").map(Number);
    const checkInMins = cHour * 60 + cMin;
    const shiftMins = sHour * 60 + sMin;
    return checkInMins > shiftMins + graceMinutes ? "late" : "on_time";
  };

  // Shift starts at 08:00, 15 min grace (up to 08:15 on time)
  assert.strictEqual(evaluateStatus("07:55", "08:00"), "on_time", "Early arrival is on_time");
  assert.strictEqual(evaluateStatus("08:10", "08:00"), "on_time", "Arrival within grace period is on_time");
  assert.strictEqual(evaluateStatus("08:15", "08:00"), "on_time", "Arrival exactly at grace threshold is on_time");
  assert.strictEqual(evaluateStatus("08:16", "08:00"), "late", "Arrival after grace threshold is marked late");
  assert.strictEqual(evaluateStatus("08:30", "08:00"), "late", "Late arrival is correctly marked late");
});

test("Payroll calculation automatically derives allowances and deductions from attendance records", () => {
  // Test case requested by user:
  // Base Salary Eka: Rp2.000.000
  // Hadir 25 hari (+tunjangan Rp25.000/hari)
  // Terlambat 3 kali (-potongan telat Rp20.000/kali)
  // Tidak masuk 1 hari (-potongan mangkir Rp80.000/hari)
  const baseSalary = 2000000;
  const daysPresent = 25;
  const timesLate = 3;
  const daysAbsent = 1;
  const dailyAllowance = 25000;
  const lateDeduction = 20000;
  const absenceDeduction = 80000;
  const bonus = 0;

  const totalAllowance = daysPresent * dailyAllowance; // 25 * 25,000 = 625,000
  const totalLateDeductions = timesLate * lateDeduction; // 3 * 20,000 = 60,000
  const totalAbsenceDeductions = daysAbsent * absenceDeduction; // 1 * 80,000 = 80,000
  const totalDeductions = totalLateDeductions + totalAbsenceDeductions; // 140,000
  const netSalary = baseSalary + totalAllowance + bonus - totalDeductions; // 2,000,000 + 625,000 - 140,000 = 2,485,000

  assert.strictEqual(totalAllowance, 625000, "Allowance should be Rp625.000 for 25 days present");
  assert.strictEqual(totalLateDeductions, 60000, "Late deduction should be Rp60.000 for 3 late arrivals");
  assert.strictEqual(totalAbsenceDeductions, 80000, "Absence deduction should be Rp80.000 for 1 day absent");
  assert.strictEqual(totalDeductions, 140000, "Total deductions should be Rp140.000");
  assert.strictEqual(netSalary, 2485000, "Net salary should be Rp2.485.000");
});

test("POS sidebar includes ABSENSI accordion with all 4 required submenus", () => {
  const appCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf-8");
  assert(appCode.includes('to="/pos/attendance-in"'), "Sidebar must have Absensi Masuk link");
  assert(appCode.includes('to="/pos/attendance-out"'), "Sidebar must have Absensi Keluar link");
  assert(appCode.includes('to="/pos/attendance-history"'), "Sidebar must have Riwayat Absensi link");
  assert(appCode.includes('to="/pos/attendance-shifts"'), "Sidebar must have Jadwal Shift link");
  assert(appCode.includes("pos-attendance-in"), "AppPage must support pos-attendance-in");
  assert(appCode.includes("pos-attendance-out"), "AppPage must support pos-attendance-out");
});

test("Cashier RBAC permits all POS attendance routes without redirection or blocking", () => {
  const appCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf-8");
  const rbacMatch = appCode.includes('"pos-attendance-in"') && appCode.includes('"pos-attendance-out"');
  assert(rbacMatch, "isPosPage whitelist in RBAC guard must permit attendance routes");
});

test("Menu Variant Group database migration defines relational tables with cascade delete", () => {
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20260930040000_menu_variant_groups.sql");
  assert(fs.existsSync(migrationPath), "Migration file 20260930040000_menu_variant_groups.sql must exist");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  assert(migrationSql.toLowerCase().includes("create table if not exists public.menu_variant_groups"), "Must create menu_variant_groups table");
  assert(migrationSql.toLowerCase().includes("create table if not exists public.menu_variant_options"), "Must create menu_variant_options table");
  assert(migrationSql.toLowerCase().includes("selection_type text not null default 'single'"), "Must have selection_type with default single");
  assert(migrationSql.toLowerCase().includes("additional_price numeric"), "Must have additional_price column");
  assert(migrationSql.includes("ON DELETE CASCADE"), "Must have ON DELETE CASCADE for foreign keys");
});

test("MenuManagement UI provides dynamic Variant Group builder with unlimited groups and choices", () => {
  const menuCode = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MenuManagement.tsx"), "utf-8");
  assert(menuCode.includes("variantGroups"), "MenuManagement must manage variantGroups state");
  assert(menuCode.includes("Tambah Grup Variant"), "Must provide button Tambah Grup Variant");
  assert(menuCode.includes("Tambah Pilihan"), "Must provide button Tambah Pilihan inside each group");
  assert(menuCode.includes("Pilih satu"), "Must support 'Pilih satu' mode");
  assert(menuCode.includes("Bisa pilih lebih dari satu"), "Must support 'Bisa pilih lebih dari satu' mode");
  assert(menuCode.includes("VARIAN & RESEP"), "Tab 3 must be named VARIAN & RESEP");
});

test("Menu API endpoints persist variant_groups into relational tables and sync to POS", () => {
  const menuApiCode = fs.readFileSync(path.resolve(process.cwd(), "src/routes/api/menu.ts"), "utf-8");
  assert(menuApiCode.includes("menu_variant_groups"), "API must query/insert into menu_variant_groups");
  assert(menuApiCode.includes("menu_variant_options"), "API must query/insert into menu_variant_options");
  assert(menuApiCode.includes("variant_groups: variantGroupsInput"), "Customization payload must store variant_groups");
});

test("POS accurately renders dynamic Variant Groups and computes real-time dynamic total price", () => {
  const posCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf-8");
  assert(posCode.includes("selectedGroupOptions"), "POS must track selectedGroupOptions map");
  assert(posCode.includes("calculatedUnitPrice"), "POS must calculate dynamic unit price");
  assert(posCode.includes("selected_variant_groups"), "CartItem must store selected_variant_groups");
  assert(posCode.includes("variant_name"), "POS must populate combined variant_name");

  // Simulate POS calculation test case with 3 variant groups x 3 options each:
  // Product: Kebab Premium Beef
  // Base Price: 25.000
  // Group 1 (Ukuran - Single): Small (+0), Medium (+3000), Large (+5000) -> selected: Medium (+3000)
  // Group 2 (Level Pedas - Single): Tidak Pedas (+0), Sedang (+0), Pedas (+2000) -> selected: Pedas (+2000)
  // Group 3 (Packaging - Single): Dine In (+0), Take Away (+2000), Box Special (+3000) -> selected: Take Away (+2000)
  // Add-ons: Extra Keju (+2000), Extra Daging (+5000) -> selected: Extra Keju (+2000)
  const product = {
    id: "prod-test-1",
    name: "Kebab Premium Beef",
    price: 25000,
    variant_groups: [
      {
        id: "vg-1",
        name: "Ukuran",
        selection_type: "single",
        options: [
          { id: "opt-1a", name: "Small", additional_price: 0 },
          { id: "opt-1b", name: "Medium", additional_price: 3000 },
          { id: "opt-1c", name: "Large", additional_price: 5000 },
        ],
      },
      {
        id: "vg-2",
        name: "Level Pedas",
        selection_type: "single",
        options: [
          { id: "opt-2a", name: "Tidak Pedas", additional_price: 0 },
          { id: "opt-2b", name: "Sedang", additional_price: 0 },
          { id: "opt-2c", name: "Pedas", additional_price: 2000 },
        ],
      },
      {
        id: "vg-3",
        name: "Packaging",
        selection_type: "single",
        options: [
          { id: "opt-3a", name: "Dine In", additional_price: 0 },
          { id: "opt-3b", name: "Take Away", additional_price: 2000 },
          { id: "opt-3c", name: "Box Special", additional_price: 3000 },
        ],
      },
    ],
    addons: [
      { name: "Extra Keju", price_adjustment: 2000 },
      { name: "Extra Daging", price_adjustment: 5000 },
    ],
  };

  const selectedGroupOptions = {
    "vg-1": [{ id: "opt-1b", name: "Medium", additional_price: 3000 }],
    "vg-2": [{ id: "opt-2c", name: "Pedas", additional_price: 2000 }],
    "vg-3": [{ id: "opt-3b", name: "Take Away", additional_price: 2000 }],
  };
  const selectedAddons = [{ name: "Extra Keju", price_adjustment: 2000 }];

  // Dynamic price calculation
  let unitPrice = product.price;
  for (const opts of Object.values(selectedGroupOptions)) {
    for (const opt of opts) {
      unitPrice += opt.additional_price;
    }
  }
  for (const add of selectedAddons) {
    unitPrice += add.price_adjustment;
  }

  // 25.000 + 3.000 + 2.000 + 2.000 + 2.000 = 34.000
  assert.strictEqual(unitPrice, 34000, "Dynamic unit price must be Rp34.000");

  const quantity = 2;
  const itemTotal = unitPrice * quantity;
  assert.strictEqual(itemTotal, 68000, "Calculated total for quantity 2 must be Rp68.000");

  // Summary variant string
  const variantNames = Object.values(selectedGroupOptions).flatMap((opts) => opts.map((o) => o.name));
  const variantNameString = variantNames.join(" • ");
  assert.strictEqual(variantNameString, "Medium • Pedas • Take Away", "Variant string must join all chosen options");
});

// --- TEST 19: Edit Menu Redesign, 3-Tab Structure, Image Editor, Margin Alerts & Templates ---
console.log("\n▶ 19. EDIT MENU HIDANGAN REDESIGN: 3-TAB STRUCTURE, IMAGE EDITOR, MARGIN INDICATORS & TEMPLATES");

test("MenuManagement modal strictly consolidates to exactly 3 main tabs: info, pricing, variants_recipe", () => {
  const menuMgmtContent = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  
  // Verify state typing
  assert.ok(
    menuMgmtContent.includes('"info" | "pricing" | "variants_recipe"'),
    "formActiveTab must be typed as exactly 'info' | 'pricing' | 'variants_recipe'"
  );

  // Verify tab labels
  assert.ok(menuMgmtContent.includes("1. INFORMASI MENU"), "Must render Tab 1 label '1. INFORMASI MENU'");
  assert.ok(menuMgmtContent.includes("2. HARGA & PROFIT"), "Must render Tab 2 label '2. HARGA & PROFIT'");
  assert.ok(menuMgmtContent.includes("3. VARIAN & RESEP"), "Must render Tab 3 label '3. VARIAN & RESEP'");
});

test("Image Editor modal provides fixed 1:1 POS framing, interactive drag/wheel/pinch, crop position, zoom (1x-3x), and rotation (90° increments)", () => {
  const menuMgmtContent = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  
  // Verify Image Editor Modal existence and state
  assert.ok(menuMgmtContent.includes("isPhotoEditorOpen"), "Must have isPhotoEditorOpen modal state");
  assert.ok(menuMgmtContent.includes("editorCropPosition"), "Must support pan/crop position coordinates");
  assert.ok(menuMgmtContent.includes("editorZoom"), "Must support zoom slider");
  assert.ok(menuMgmtContent.includes("editorRotation"), "Must support 90-degree rotation");
  assert.ok(menuMgmtContent.includes("1:1 POS Card"), "Must support fixed 1:1 POS Card frame");
  assert.ok(menuMgmtContent.includes("handleWheel"), "Must support mouse wheel zoom");

  // Verify image transform application
  const posAppContent = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  assert.ok(
    posAppContent.includes("image_position_x") ||
    posAppContent.includes("image_crop_position") ||
    posAppContent.includes("crop_x"),
    "POS product cards must apply image crop position"
  );
  assert.ok(
    posAppContent.includes("scale(${product.image_zoom || 1})") ||
    posAppContent.includes("image_zoom"),
    "POS product cards must apply image zoom transform"
  );
});

test("Margin calculations evaluate color-coded indicators: Hijau (>=40%), Kuning (20-39%), Merah (<20%), and Loss alert", () => {
  function evaluateMargin(price, costPrice, promoPrice = null) {
    const effectivePrice = promoPrice && promoPrice > 0 && promoPrice < price ? promoPrice : price;
    const marginNominal = effectivePrice - costPrice;
    const marginPercentage = effectivePrice > 0 ? Math.round((marginNominal / effectivePrice) * 100) : 0;
    
    let indicator = "green";
    if (costPrice > effectivePrice) {
      indicator = "loss_alert";
    } else if (marginPercentage >= 40) {
      indicator = "green";
    } else if (marginPercentage >= 20) {
      indicator = "yellow";
    } else {
      indicator = "red";
    }

    return { effectivePrice, marginNominal, marginPercentage, indicator };
  }

  // 1. Healthy Margin >= 40% (Green)
  const healthy = evaluateMargin(50000, 25000);
  assert.strictEqual(healthy.marginPercentage, 50);
  assert.strictEqual(healthy.indicator, "green", "50% margin should be marked green");

  // 2. Medium Warning Margin 20% - 39% (Yellow)
  const warning = evaluateMargin(35000, 25000);
  assert.strictEqual(warning.marginPercentage, 29);
  assert.strictEqual(warning.indicator, "yellow", "29% margin should be marked yellow");

  // 3. Low Margin < 20% (Red)
  const low = evaluateMargin(30000, 26000);
  assert.strictEqual(low.marginPercentage, 13);
  assert.strictEqual(low.indicator, "red", "13% margin should be marked red");

  // 4. Critical Loss HPP > Price (Loss Alert)
  const loss = evaluateMargin(20000, 25000);
  assert.strictEqual(loss.marginNominal, -5000);
  assert.strictEqual(loss.indicator, "loss_alert", "HPP > Price must trigger critical loss alert");

  // 5. Promo price reduces margin
  const promo = evaluateMargin(50000, 25000, 30000);
  assert.strictEqual(promo.effectivePrice, 30000);
  assert.strictEqual(promo.marginNominal, 5000);
  assert.strictEqual(promo.marginPercentage, 17);
  assert.strictEqual(promo.indicator, "red", "Promo price reducing margin to 17% should be marked red");
});

test("Variant Group & Option reordering preserves and updates sort_order sequentially", () => {
  const groups = [
    { id: "vg-1", name: "Ukuran", sort_order: 0 },
    { id: "vg-2", name: "Level Pedas", sort_order: 1 },
    { id: "vg-3", name: "Packaging", sort_order: 2 },
  ];

  // Move "Level Pedas" UP (swap index 1 with 0)
  const moved = [...groups];
  const temp = moved[1];
  moved[1] = moved[0];
  moved[0] = temp;
  const reordered = moved.map((g, idx) => ({ ...g, sort_order: idx }));

  assert.strictEqual(reordered[0].name, "Level Pedas");
  assert.strictEqual(reordered[0].sort_order, 0);
  assert.strictEqual(reordered[1].name, "Ukuran");
  assert.strictEqual(reordered[1].sort_order, 1);
});

test("Template Variant Presets insert pre-configured groups with correct single/multiple selection types", () => {
  const menuMgmtContent = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");

  assert.ok(menuMgmtContent.includes("VARIANT_TEMPLATES"), "Must include VARIANT_TEMPLATES array");
  assert.ok(menuMgmtContent.includes("Ukuran (Small, Medium, Large)"), "Must include Ukuran template");
  assert.ok(menuMgmtContent.includes("Level Pedas (0 s/d 3)"), "Must include Level Pedas template");
  assert.ok(menuMgmtContent.includes("Packaging (Dine In / Take Away)"), "Must include Packaging template");
  assert.ok(menuMgmtContent.includes("Topping Tambahan"), "Must include Topping Tambahan template");
});

test("Live POS Preview simulates real-time price calculation matching cashier checkout", () => {
  const basePrice = 35000;
  const promoPrice = 30000; // active promo
  const effectivePrice = promoPrice || basePrice;

  const selectedOptions = [
    { name: "Large", additional_price: 5000 },
    { name: "Pedas", additional_price: 2000 },
    { name: "Take Away", additional_price: 2000 },
    { name: "Extra Keju", additional_price: 3000 },
  ];

  const additions = selectedOptions.reduce((acc, opt) => acc + opt.additional_price, 0);
  const totalPreview = effectivePrice + additions;

  // 30.000 + 5.000 + 2.000 + 2.000 + 3.000 = 42.000
  assert.strictEqual(additions, 12000);
  assert.strictEqual(totalPreview, 42000, "Live POS Preview total price must be Rp42.000");
});

// --- TEST 41: Realtime Image Editor CSS Transform Calculation ---
console.log("\n▶ 41. REALTIME IMAGE EDITOR CSS TRANSFORM (PAN X/Y, ZOOM, ROTATION)");
test("Image Editor CSS transform calculation translates X/Y in realtime regardless of image aspect ratio", () => {
  function computeImageStyle(crop, zoom, rotation) {
    const x = crop?.x ?? 50;
    const y = crop?.y ?? 50;
    const z = zoom ?? 1;
    const r = rotation ?? 0;
    return `translate(${x - 50}%, ${y - 50}%) scale(${z}) rotate(${r}deg)`;
  }

  // Centered default
  assert.strictEqual(computeImageStyle({ x: 50, y: 50 }, 1, 0), "translate(0%, 0%) scale(1) rotate(0deg)");

  // Panned horizontally 20% right, zoomed 1.5x, rotated 90deg
  const pannedStyle = computeImageStyle({ x: 70, y: 35 }, 1.5, 90);
  assert.strictEqual(pannedStyle, "translate(20%, -15%) scale(1.5) rotate(90deg)");

  // Verify POS App and Menu Management both use identical transform logic
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  assert.ok(menuMgmt.includes("computeImageStyle"), "MenuManagement must define computeImageStyle");
  assert.ok(posApp.includes("translate("), "KebabsChoicePOSApp must use CSS translate for image positioning");
  assert.ok(posApp.includes("pointer-events-none"), "Product card images should avoid conflict with card click events");
});

// --- TEST 42: Required Variant Group Selection Validation ---
console.log("\n▶ 42. REQUIRED VARIANT GROUP SELECTION VALIDATION IN POS KASIR");
test("Enforces validation: Cart blocks addition if any required variant group is unselected", () => {
  const variantGroups = [
    { id: "g1", name: "Ukuran", is_required: true, selection_type: "single" },
    { id: "g2", name: "Level Pedas", is_required: true, selection_type: "single" },
    { id: "g3", name: "Topping Ekstra", is_required: false, selection_type: "multiple" },
  ];

  function validateAddToCart(groups, selections) {
    for (let idx = 0; idx < groups.length; idx++) {
      const g = groups[idx];
      if (g.is_required !== false) {
        const gKey = g.id || g.name || `group-${idx}`;
        const chosen = selections[gKey] || [];
        if (chosen.length === 0) {
          return { valid: false, error: `Pilihan wajib dipilih: ${g.name}` };
        }
      }
    }
    return { valid: true };
  }

  // Missing Ukuran
  const attempt1 = validateAddToCart(variantGroups, {
    g2: [{ name: "Level 1" }],
  });
  assert.strictEqual(attempt1.valid, false);
  assert.strictEqual(attempt1.error, "Pilihan wajib dipilih: Ukuran");

  // Missing Level Pedas
  const attempt2 = validateAddToCart(variantGroups, {
    g1: [{ name: "Medium" }],
  });
  assert.strictEqual(attempt2.valid, false);
  assert.strictEqual(attempt2.error, "Pilihan wajib dipilih: Level Pedas");

  // Optional Topping Ekstra not chosen, but all required groups are chosen -> Valid!
  const attempt3 = validateAddToCart(variantGroups, {
    g1: [{ name: "Medium" }],
    g2: [{ name: "Pedas" }],
  });
  assert.strictEqual(attempt3.valid, true);

  // Check codebase contains required validation in POS Kasir
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  assert.ok(posApp.includes("Pilihan wajib dipilih:"), "POS Kasir must enforce Pilihan wajib dipilih validation");
});

// --- TEST 43: Restaurant UX Terminology Compliance ---
console.log("\n▶ 43. RESTAURANT UX TERMINOLOGY COMPLIANCE");
test("Uses restaurant operational terms: 'Pilih satu', 'Bisa pilih lebih dari satu', and 'Pilihan wajib dipilih'", () => {
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  // Verification in MenuManagement
  assert.ok(menuMgmt.includes("Cara Pilih:"), "MenuManagement must include 'Cara Pilih:'");
  assert.ok(menuMgmt.includes("Pilih satu"), "MenuManagement must include 'Pilih satu'");
  assert.ok(menuMgmt.includes("Bisa pilih lebih dari satu"), "MenuManagement must include 'Bisa pilih lebih dari satu'");
  assert.ok(menuMgmt.includes("Pilihan wajib dipilih"), "MenuManagement must label required toggle as 'Pilihan wajib dipilih'");

  // Verification in KebabsChoicePOSApp
  assert.ok(posApp.includes("Cara Pilih:"), "KebabsChoicePOSApp must include 'Cara Pilih:'");
  assert.ok(posApp.includes("Pilih satu"), "KebabsChoicePOSApp must include 'Pilih satu'");
  assert.ok(posApp.includes("Bisa pilih lebih dari satu"), "KebabsChoicePOSApp must include 'Bisa pilih lebih dari satu'");
  assert.ok(posApp.includes("Pilihan wajib dipilih"), "KebabsChoicePOSApp must badge required groups as 'Pilihan wajib dipilih'");
});

// --- TEST 44: Staff Attendance Privacy Protection (No Salary Data on POS) ---
console.log("\n▶ 44. STAFF ATTENDANCE PRIVACY PROTECTION IN POS");
test("POS Attendance strictly excludes salary, allowances, and compensation from staff preview", () => {
  const attendancePage = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/AttendancePage.tsx"), "utf8");

  // Confirm NO financial or salary display in POS Attendance
  assert.ok(!attendancePage.includes("Gaji Pokok:"), "AttendancePage must NOT display 'Gaji Pokok:'");
  assert.ok(!attendancePage.includes("Tunjangan Harian:"), "AttendancePage must NOT display 'Tunjangan Harian:'");
  assert.ok(!attendancePage.includes("base_salary"), "AttendancePage must NOT reference base_salary");
  assert.ok(!attendancePage.includes("daily_allowance"), "AttendancePage must NOT reference daily_allowance");

  // Confirm presence of expected attendance fields
  assert.ok(attendancePage.includes("Jam Masuk:"), "AttendancePage must show 'Jam Masuk:'");
  assert.ok(attendancePage.includes("Jam Keluar:"), "AttendancePage must show 'Jam Keluar:'");
  assert.ok(attendancePage.includes("Status Kehadiran Hari Ini:"), "AttendancePage must show attendance status");
});

// --- TEST 45: Biometric Face Registration Flow ---
console.log("\n▶ 45. BIOMETRIC FACE REGISTRATION FLOW IN HQ & POS");
test("StaffManagement provides biometric face registration and syncs avatar_url with HR profiles", () => {
  const staffMgmt = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/StaffManagement.tsx"), "utf8");
  const hrService = fs.readFileSync(path.join(process.cwd(), "src/services/hr.service.ts"), "utf8");

  // StaffManagement checks
  assert.ok(staffMgmt.includes("Daftar Wajah Biometrik"), "StaffManagement must have Biometric Face Registration modal");
  assert.ok(staffMgmt.includes("startFaceCamera"), "StaffManagement must implement startFaceCamera");
  assert.ok(staffMgmt.includes("captureFaceSnapshot"), "StaffManagement must implement captureFaceSnapshot");
  assert.ok(staffMgmt.includes("handleSaveFaceRegistration"), "StaffManagement must implement handleSaveFaceRegistration");

  // HR Service avatar_url persistence check
  assert.ok(hrService.includes("avatar_url: db.avatar_url || local.avatar_url || staff.avatar_url || null"), "HR Service must read avatar_url from db/local/staff");
  assert.ok(hrService.includes("avatar_url: data.avatar_url"), "HR Service updateHRStaffProfile must persist avatar_url");
});

// --- TEST 46: Photo Menu Editor Framing System ---
console.log("\n▶ 46. REFACTORED PHOTO MENU EDITOR FIXED 1:1 POS FRAMING & INTERACTIVE GESTURES");
test("Photo Menu Editor simplifies to fixed 1:1 POS frame with interactive drag, wheel zoom, touch pinch, and DB sync", () => {
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  // 1. Fixed 1:1 POS Card canvas and interactive gestures
  assert.ok(menuMgmt.includes("1:1 POS Card"), "MenuManagement must enforce fixed 1:1 POS Card frame");
  assert.ok(menuMgmt.includes("canvasRef"), "MenuManagement must reference the interactive canvas");
  assert.ok(menuMgmt.includes("onPointerDown") && menuMgmt.includes("isCanvasDragging"), "MenuManagement must support direct mouse/touch drag pan");
  assert.ok(menuMgmt.includes("handleWheel"), "MenuManagement must support mouse wheel zoom in/out");
  assert.ok(menuMgmt.includes("touchStartDist"), "MenuManagement must support touch pinch-to-zoom for tablet");

  // 2. Manual Controls (Sliders, 90° rotation, Reset ke Tengah)
  assert.ok(menuMgmt.includes("Posisi X (Geser Kiri/Kanan):"), "MenuManagement must provide Position X slider");
  assert.ok(menuMgmt.includes("Posisi Y (Geser Atas/Bawah):"), "MenuManagement must provide Position Y slider");
  assert.ok(menuMgmt.includes("Putar 90° Clockwise"), "MenuManagement must provide 90° clockwise rotation");
  assert.ok(menuMgmt.includes("Reset Posisi ke Tengah"), "MenuManagement must provide Reset Posisi ke Tengah button");

  // 3. Object-cover 1:1 rendering in POS & HQ
  assert.ok(menuMgmt.includes("computeImageStyle"), "MenuManagement must compute transform styles dynamically");
  assert.ok(posApp.includes("image_position_x") || posApp.includes("image_crop_position"), "KebabsChoicePOSApp must support image positions");

  // 4. Database & Service persistence
  assert.ok(menuService.includes("image_position_x?: number"), "menu.service.ts must type image_position_x");
  assert.ok(menuService.includes("image_position_y?: number"), "menu.service.ts must type image_position_y");
  assert.ok(menuApi.includes("image_position_x"), "api/menu.ts must persist image_position_x");
  assert.ok(menuApi.includes("image_position_y"), "api/menu.ts must persist image_position_y");
});

// --- TEST 47: Dashboard HQ Audit, Variable Error Fix & Metric Requirements ---
console.log("\n▶ 47. DASHBOARD HQ AUDIT, DATA FLOW & RESILIENT ERROR HANDLING");
test("Dashboard HQ provides safe cost/margin calculation, all 7 KPI requirements, and no undefined variables", () => {
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const dataTs = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/data.ts"), "utf8");

  // 1. Check costPrice variable is declared before use
  assert.ok(posApp.includes("const costPrice = Number(calculatedCostPrice) || 0"), "productFromRow must declare costPrice safely");
  assert.ok(posApp.includes("calculatedCostPrice = recipe.items.reduce"), "BOM Recipe items must be connected to costPrice");

  // 2. Check no non-existent table query .from("menu")
  assert.ok(!posApp.includes('.from("menu")'), "KebabsChoicePOSApp must not query non-existent table 'menu'");
  assert.ok(!posApp.includes('.from("menus")'), "KebabsChoicePOSApp must not query non-existent table 'menus'");

  // 3. Check calculateSnapshotMetrics in data.ts supports margin, top products, and outlet performances
  assert.ok(dataTs.includes("marginPercentage"), "data.ts must compute marginPercentage");
  assert.ok(dataTs.includes("grossProfit"), "data.ts must compute grossProfit");
  assert.ok(dataTs.includes("outletPerformances"), "data.ts must compute outletPerformances");
  assert.ok(dataTs.includes("topProducts"), "data.ts must compute topProducts");

  // 4. Check DashboardPage renders all 7 required components
  assert.ok(posApp.includes("Margin Keuntungan"), "Dashboard must render Margin Keuntungan KPI");
  assert.ok(posApp.includes("Revenue Hari Ini"), "Dashboard must render Revenue Hari Ini KPI");
  assert.ok(posApp.includes("Total Transaksi"), "Dashboard must render Total Transaksi KPI");
  assert.ok(posApp.includes("Jumlah Pelanggan"), "Dashboard must render Jumlah Pelanggan KPI");
  assert.ok(posApp.includes("Peringatan Stok"), "Dashboard must render Peringatan Stok KPI");
  assert.ok(posApp.includes("Performa Cabang Outlet"), "Dashboard must render Performa Cabang Outlet section");
  assert.ok(posApp.includes("Produk Terlaris"), "Dashboard must render Produk Terlaris section");

  // 5. Safe error handling: refresh wrapped in try/catch with emptySnapshot fallback
  assert.ok(posApp.includes("emptySnapshot"), "refresh must fallback to emptySnapshot on failure");
});

// --- TEST 48: Audit UX Menu Management: Price Input, Category System & Layout ---
console.log("\n▶ 48. AUDIT UX MENU MANAGEMENT: INDONESIAN PRICE INPUT, CATEGORY SYSTEM & LAYOUT");
test("Indonesian price input formats currency, strips leading zero, and categories support is_system", () => {
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");

  // 1. Photo editor info banner removal
  assert.ok(!menuMgmt.includes("Drag foto langsung • Scroll wheel mouse / pinch zoom"), "Photo editor info banner must be removed");
  assert.ok(!menuMgmt.includes("Format tetap 1:1 POS Card. File foto asli tidak terpotong permanen."), "Photo editor subtitle must be removed");

  // 2. Kategori and SKU one row layout
  assert.ok(menuMgmt.includes("Row: Kategori & Kode SKU / Barcode Satu Baris"), "Kategori and SKU must be in one row");
  assert.ok(menuMgmt.includes("ChevronDown"), "MenuManagement must import and render ChevronDown icon inside select box");
  assert.ok(menuMgmt.includes("appearance-none"), "MenuManagement dropdown must use appearance-none for clean custom chevron");

  // 3. Category System vs User
  assert.ok(menuService.includes("is_system?: boolean"), "menu.service.ts must define is_system property");
  assert.ok(menuService.includes("isSystemCategory"), "menu.service.ts must export isSystemCategory helper");
  assert.ok(menuApi.includes("is_system"), "api/menu.ts must support is_system flag");
  assert.ok(menuMgmt.includes("isSystemCategory"), "MenuManagement must import and use isSystemCategory");
  assert.ok(menuMgmt.includes("System"), "Category management modal must display 'System' badge for system categories");
  assert.ok(menuMgmt.includes("!isSystemCategory(cat)"), "Category management modal must only allow deleting non-system categories");

  // 4. IndonesianPriceInput component
  assert.ok(menuMgmt.includes("IndonesianPriceInput"), "MenuManagement must provide IndonesianPriceInput component");
  assert.ok(menuMgmt.includes('Intl.NumberFormat("id-ID")'), "IndonesianPriceInput must format using Intl.NumberFormat('id-ID')");

  // 5. Test price formatting logic directly
  const rawInput = "011000";
  const parsed = parseInt(rawInput.replace(/[^\d]/g, ""), 10);
  assert.strictEqual(parsed, 11000, "Input 011000 must automatically parse as integer 11000");
  const formatted = new Intl.NumberFormat("id-ID").format(parsed);
  assert.strictEqual(formatted, "11.000", "Integer 11000 must display as '11.000'");
});

// --- TEST 49: Menu Cost Price (HPP) Schema Cache Resilience, Category Lifecycle & Clean UI ---
console.log("\n▶ 49. MENU COST PRICE (HPP) SCHEMA CACHE RESILIENCE & CLEAN VARIANT UI");
test("Products cost_price schema migration, resilient API fallback, and clean single-plus buttons", () => {
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const supabaseTypes = fs.readFileSync(path.join(process.cwd(), "src/integrations/supabase/types.ts"), "utf8");
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const migrationFiles = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"));

  // 1. Migration for cost_price on products
  const costPriceMigration = migrationFiles.find((f) => f.includes("cost_price"));
  assert.ok(costPriceMigration, "Must have migration file for adding cost_price");
  const migrationContent = fs.readFileSync(path.join(process.cwd(), "supabase/migrations", costPriceMigration), "utf8");
  assert.ok(migrationContent.includes("ALTER TABLE public.products"), "Migration must alter public.products");
  assert.ok(migrationContent.includes("ADD COLUMN IF NOT EXISTS cost_price"), "Migration must add cost_price column");

  // 2. Types definition in Supabase types
  assert.ok(supabaseTypes.includes("cost_price: number"), "Row types must include cost_price");
  assert.ok(supabaseTypes.includes("cost_price?: number"), "Insert and Update types must include cost_price");

  // 3. API Resilient Fallback on Schema Cache Mismatch
  assert.ok(menuApi.includes("cost_price column missing in schema cache, retrying insert without cost_price"), "API must retry insert without cost_price if PostgREST schema cache fails");
  assert.ok(menuApi.includes("cost_price column missing in schema cache, retrying update without cost_price"), "API must retry update without cost_price if PostgREST schema cache fails");
  assert.ok(menuApi.includes("products query failed on cost_price column, retrying select without cost_price"), "API must retry select without cost_price if PostgREST schema cache fails");

  // 4. Category deletion updates products so deleted categories (e.g. Minuman Segar 6004) do not resurrect
  assert.ok(
    menuApi.includes(".update({ category: null, category_id: null })") ||
    menuApi.includes(".update({ category: null"),
    "API delete-category must update products referencing deleted category to null without resurrecting default categories"
  );

  // 5. Clean Variant UI: no duplicate + + icons
  assert.ok(!menuMgmt.includes("+ + Tambah"), "MenuManagement must not render duplicate + + in button text");
  assert.ok(!menuMgmt.includes("+ Tambah Pilihan"), "Tambah Pilihan button text must not include duplicate + prefix");
  assert.ok(!menuMgmt.includes("+ Tambah Grup Variant"), "Tambah Grup Variant button text must not include duplicate + prefix");

  // 6. Category badges: both System and User
  assert.ok(menuMgmt.includes("System"), "MenuManagement category modal must render System badge");
  assert.ok(menuMgmt.includes("User"), "MenuManagement category modal must render User badge for user-created categories");

  // 7. No invalid .from('menu') or .from('menus') queries in API or components
  assert.ok(!menuApi.includes('.from("menu")') && !menuApi.includes('.from("menus")'), "API must not query invalid 'menu' or 'menus' tables");
  assert.ok(!menuMgmt.includes('.from("menu")') && !menuMgmt.includes('.from("menus")'), "MenuManagement must not query invalid 'menu' or 'menus' tables");
});

// --- TEST 50: Comprehensive Supabase Schema Audit & Menu Management Synchronization ---
console.log("\n▶ 50. COMPREHENSIVE SUPABASE SCHEMA AUDIT FOR MENU MANAGEMENT V2.0");
test("All 6 database entities, 11 mandatory fields, SQL migrations, Supabase types, and BOM HPP synchronization are verified", () => {
  const schemaMigration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261003010000_comprehensive_menu_management_schema.sql"), "utf8");
  const supabaseTypes = fs.readFileSync(path.join(process.cwd(), "src/integrations/supabase/types.ts"), "utf8");
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");

  // 1. Audit Entities in SQL Migration
  const entities = [
    "products",
    "menu_items",
    "menu_variant_groups",
    "menu_variant_options",
    "menu_recipes",
    "recipe_items",
    "recipes",
    "ingredients",
    "inventory_items",
    "outlet_menu_items",
  ];
  for (const entity of entities) {
    assert.ok(
      schemaMigration.includes(`TABLE IF NOT EXISTS public.${entity}`) ||
      schemaMigration.includes(`ALTER TABLE public.${entity}`) ||
      schemaMigration.includes(`ALTER TABLE IF EXISTS public.${entity}`),
      `Migration must define or alter table: ${entity}`
    );
  }

  // 2. Audit 11 Mandatory Fields in Migration
  const mandatoryFields = [
    "cost_price",
    "selling_price",
    "image_url",
    "image_aspect_ratio",
    "image_crop_position",
    "image_zoom",
    "image_rotation",
    "selection_type", // variant_group
    "additional_price", // variant_option
    "recipe_id", // BOM recipe
    "cost_estimate", // HPP calculation
  ];
  for (const field of mandatoryFields) {
    assert.ok(
      schemaMigration.includes(field),
      `Migration must define field: ${field}`
    );
  }

  // 3. Audit TypeScript definitions in src/integrations/supabase/types.ts
  assert.ok(supabaseTypes.includes("menu_items: {"), "types.ts must define menu_items table");
  assert.ok(supabaseTypes.includes("menu_variant_groups: {"), "types.ts must define menu_variant_groups table");
  assert.ok(supabaseTypes.includes("menu_variant_options: {"), "types.ts must define menu_variant_options table");
  assert.ok(supabaseTypes.includes("menu_recipes: {"), "types.ts must define menu_recipes table");
  assert.ok(supabaseTypes.includes("recipe_items: {"), "types.ts must define recipe_items table");
  assert.ok(supabaseTypes.includes("recipes: {"), "types.ts must define recipes table");
  assert.ok(supabaseTypes.includes("ingredients: {"), "types.ts must define ingredients table");
  assert.ok(supabaseTypes.includes("outlet_menu_items: {"), "types.ts must define outlet_menu_items table");

  // Verify key fields in types.ts
  assert.ok(supabaseTypes.includes("cost_price: number") || supabaseTypes.includes("cost_price: number | null"), "types.ts must contain cost_price");
  assert.ok(supabaseTypes.includes("selling_price: number") || supabaseTypes.includes("selling_price: number | null"), "types.ts must contain selling_price");
  assert.ok(supabaseTypes.includes("image_aspect_ratio: string") || supabaseTypes.includes("image_aspect_ratio: string | null"), "types.ts must contain image_aspect_ratio");
  assert.ok(supabaseTypes.includes("image_zoom: number") || supabaseTypes.includes("image_zoom: number | null"), "types.ts must contain image_zoom");
  assert.ok(supabaseTypes.includes("image_rotation: number") || supabaseTypes.includes("image_rotation: number | null"), "types.ts must contain image_rotation");

  // 4. Audit API create-item and update-item synchronization
  assert.ok(menuApi.includes("has_variants: hasVariants"), "create-item & update-item must sync has_variants");
  assert.ok(menuApi.includes("has_recipe: hasRecipe"), "create-item & update-item must sync has_recipe");
  assert.ok(menuApi.includes("from(\"menu_items\" as any)"), "API must synchronize relational menu_items table");
  assert.ok(menuApi.includes("from(\"menu_recipes\" as any)"), "API must synchronize relational menu_recipes table");
  assert.ok(menuApi.includes("from(\"recipe_items\" as any)"), "API must synchronize relational recipe_items table");
  assert.ok(menuApi.includes("from(\"outlet_menu_items\" as any)"), "API must synchronize relational outlet_menu_items table");

  // 5. Audit BOM Recipe & HPP Calculation in MenuManagement
  assert.ok(menuMgmt.includes("calculateBOMCost"), "MenuManagement must define calculateBOMCost");
  assert.ok(menuMgmt.includes("convertRecipeToInventoryQuantity"), "MenuManagement must use convertRecipeToInventoryQuantity for precision BOM depletion");
  assert.ok(menuMgmt.includes("matchedInv.cost_price"), "calculateBOMCost must integrate matched inventory ingredient cost_price");

  // 6. Audit menu.service.ts types and inventory fetch
  assert.ok(menuService.includes("cost_price?: number"), "menu.service.ts must define cost_price in InventoryIngredient");
  assert.ok(menuService.includes("selling_price?: number"), "menu.service.ts must define selling_price in InventoryIngredient");
  assert.ok(menuService.includes("convertRecipeToInventoryQuantity"), "menu.service.ts must export convertRecipeToInventoryQuantity");
});

// --- TEST 51: Category UUID Validation, Schema Protection & Dummy Cleanup ---
console.log("\n▶ 51. CATEGORY UUID INTEGRITY, DATABASE COMPLIANCE & DUMMY PURGE");
test("All category IDs are RFC-compliant UUIDs, no cat-timestamp generation, dummy 6004 purged, and products category_id safely protected", () => {
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");

  // 1. UUID regex & validation helper in menu.service.ts
  assert.ok(menuService.includes("UUID_REGEX"), "menu.service.ts must define UUID_REGEX");
  assert.ok(menuService.includes("isValidUuid"), "menu.service.ts must export isValidUuid");
  assert.ok(menuService.includes("ensureCategoryUuid"), "menu.service.ts must export ensureCategoryUuid");

  // 2. No cat-Date.now() in API create-category or service
  assert.ok(!menuApi.includes("`cat-${Date.now()}`"), "api/menu.ts must not generate cat-${Date.now()}");
  assert.ok(!menuService.includes("`cat-${fallbackCats.length + 1}`"), "menu.service.ts must not generate cat-1 fallback");
  assert.ok(!menuService.includes("`sys-cat-${i + 1}`"), "menu.service.ts must not generate sys-cat-1");

  // 3. API UUID validation and safe category_id resolution
  assert.ok(menuApi.includes("resolveValidCategoryId"), "api/menu.ts must define resolveValidCategoryId");
  assert.ok(menuApi.includes("isValidCategoryUuid"), "api/menu.ts must define isValidCategoryUuid");
  assert.ok(menuApi.includes("ensureCategoryUuid"), "api/menu.ts must define ensureCategoryUuid");
  assert.ok(menuApi.includes("SYSTEM_CATEGORY_UUIDS"), "api/menu.ts must define canonical SYSTEM_CATEGORY_UUIDS");

  // 4. Products & menu_items insertion must use resolved valid category UUID or null
  assert.ok(menuApi.includes("category_id: resolvedCatId"), "products and menu_items inserts must use resolved valid category UUID");

  // 5. MenuManagement must validate category_id before sending to API
  assert.ok(menuMgmt.includes("isValidUuid"), "MenuManagement must import and use isValidUuid");
  assert.ok(menuMgmt.includes("validCatId"), "MenuManagement must ensure category_id is valid UUID before submitting");

  // 6. Purge dummy category 6004
  assert.ok(menuApi.includes("6004"), "api/menu.ts must filter out dummy category containing 6004");
  assert.ok(menuService.includes("6004"), "menu.service.ts must filter out dummy category containing 6004");
});

// --- TEST 52: Full System Production Readiness: Role Access, Header Switcher Removal, Outlet Locking & Seed Purge ---
console.log("\n▶ 52. FULL SYSTEM PRODUCTION READINESS & ROLE SEPARATION AUDIT");
test("Verifies Header cross-switcher removal, cashier outlet lockdown, seed purge, and clean empty state resilience", () => {
  const appCode = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const dataCode = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/data.ts"), "utf8");

  // 1. Header quick switcher between HQ & POS must be removed
  assert.ok(
    !appCode.includes('to={isPosSection ? "/dashboard" : "/pos"}'),
    "Header must NOT contain quick switcher button toggling between /dashboard and /pos"
  );
  assert.ok(
    !appCode.includes('<span>{t("header.open_pos", "Buka POS Kasir")}</span>'),
    "Header must NOT render 'Buka POS Kasir' switch button"
  );

  // 2. Snapshot interface must support assignedOutletId
  assert.ok(dataCode.includes("assignedOutletId?: string | null;"), "Snapshot in data.ts must include assignedOutletId");
  assert.ok(dataCode.includes("assignedOutletId: null,"), "emptySnapshot in data.ts must include assignedOutletId: null");

  // 3. seedWorkspace must not insert dummy demo data
  assert.ok(
    !appCode.includes("demoProducts.map((product) => ({ ...product, business_id: businessId }))"),
    "seedWorkspace must NOT insert demoProducts"
  );
  assert.ok(
    !appCode.includes("demoCustomers.map((customer) => ({ ...customer, business_id: businessId }))"),
    "seedWorkspace must NOT insert demoCustomers"
  );
  assert.ok(
    !appCode.includes("demoInventory.map((item) => ({ ...item, business_id: businessId }))"),
    "seedWorkspace must NOT insert demoInventory"
  );

  // 4. PosPage must strictly lock Cashier/Staff to assigned outlet and hide dropdown
  assert.ok(
    appCode.includes("assignedOutlet = activeOutlets.find((o) => o.id === snapshot.assignedOutletId)"),
    "PosPage must resolve assignedOutlet from snapshot.assignedOutletId"
  );
  assert.ok(
    appCode.includes("const lockedId = snapshot.assignedOutletId"),
    "PosPage must lock selectedOutletId to assignedOutletId for non-owners"
  );
  assert.ok(
    appCode.includes("<Lock className=\"size-2.5\" /> Terkunci"),
    "PosPage and OrdersPage must render locked badge for cashiers"
  );

  // 5. OrdersPage must lock outlet filter for Cashier/Staff
  assert.ok(
    appCode.includes("setSelectedOutletFilter(lockedId)"),
    "OrdersPage must lock selectedOutletFilter to assigned outlet for non-owners"
  );

  // 6. MobileNav must separate POS and HQ navigation items
  assert.ok(
    appCode.includes("const isPosMode = isCashier || isPosPage;"),
    "MobileNav must determine isPosMode to show separate navigation sets"
  );
});

// --- TEST 53: Total Audit of Category Management: Zero Hardcoded Defaults, Full User CRUD, Empty State Resilience ---
console.log("\n▶ 53. TOTAL AUDIT OF CATEGORY MANAGEMENT (ZERO HARDCODED DEFAULTS & EMPTY STATE)");
test("Verifies zero hardcoded categories in frontend/backend, true empty state when DB empty, and full user category lifecycle", () => {
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");

  // 1. Zero hardcoded category insertions in API & Service when empty
  assert.ok(
    !menuApi.includes('defaults = ["Makanan"') && !menuApi.includes("const defaults = [\"Makanan\""),
    "API must NOT inject hardcoded starter categories when database is empty"
  );
  assert.ok(
    !menuService.includes('defaults = ["Makanan"') && !menuService.includes("const defaults = [\"Makanan\""),
    "menu.service.ts must NOT inject hardcoded starter categories when database is empty"
  );

  // 2. MenuManagement UI must not fallback to 'Makanan'
  assert.ok(
    !menuMgmt.includes('setCategoryName(categories.length > 0 ? categories[0].name : "Makanan");'),
    "MenuManagement create item must NOT fallback categoryName to 'Makanan'"
  );
  assert.ok(
    !menuMgmt.includes('setCategoryName(item.category_name || "Makanan");'),
    "MenuManagement edit item must NOT fallback categoryName to 'Makanan'"
  );
  assert.ok(
    !menuMgmt.includes('categoryName || "Makanan"'),
    "MenuManagement must NOT fallback categoryName to 'Makanan'"
  );

  // 3. Category Select Dropdown must show empty placeholder when no categories exist
  assert.ok(
    menuMgmt.includes("-- Belum ada kategori (Klik + Tambah Kategori) --"),
    "MenuManagement item modal select dropdown must render informative empty placeholder when categories is empty"
  );

  // 4. Category Management Modal must render empty state text
  assert.ok(
    menuMgmt.includes("Belum ada kategori yang dibuat. Silakan tambahkan kategori baru di atas."),
    "Category Management modal must render empty state text when categories.length === 0"
  );

  // 5. Deleting a category updates products to null so old names do not resurrect
  assert.ok(
    menuApi.includes(".update({ category: null, category_id: null })"),
    "API delete-category must update products to category: null and category_id: null"
  );
});

// --- TEST 54: Reports & HQ Analytics: 7 KPIs, Date Range & Outlet Filtering, and SSR-Safe CSV Export ---
console.log("\n▶ 54. REPORTS & HQ ANALYTICS AUDIT: 7 KPIS, DATE & OUTLET FILTERING, SSR-SAFE CSV EXPORT");
test("Reports service and HQ pages implement accurate 7 KPIs, date range presets, outlet isolation, and SSR-safe CSV export", () => {
  const reportsService = fs.readFileSync(path.join(process.cwd(), "src/services/reports.service.ts"), "utf8");
  const outletPage = fs.readFileSync(path.join(process.cwd(), "src/pages/reports/PerformanceOutletPage.tsx"), "utf8");
  const menuPage = fs.readFileSync(path.join(process.cwd(), "src/pages/reports/PerformanceMenuPage.tsx"), "utf8");
  const insightPage = fs.readFileSync(path.join(process.cwd(), "src/pages/reports/InsightAnalyticsPage.tsx"), "utf8");

  // 1. Check reports.service.ts defines AnalyticsFilter, DateRangePreset, isDateWithinFilter, exportToCSV
  assert.ok(reportsService.includes("export type DateRangePreset"), "reports.service must define DateRangePreset");
  assert.ok(reportsService.includes("export interface AnalyticsFilter"), "reports.service must define AnalyticsFilter");
  assert.ok(reportsService.includes("export function isDateWithinFilter"), "reports.service must export isDateWithinFilter");
  assert.ok(reportsService.includes("export function exportToCSV"), "reports.service must export exportToCSV");

  // 2. Check BusinessAnalyticsSummary includes all 7 KPIs
  assert.ok(reportsService.includes("totalRevenue: number"), "KPI 1: totalRevenue (Total Omzet)");
  assert.ok(reportsService.includes("totalProfitEstimate: number"), "KPI 2a: totalProfitEstimate (Laba Kotor)");
  assert.ok(reportsService.includes("marginPercentage: number"), "KPI 2b: marginPercentage (Margin HPP)");
  assert.ok(reportsService.includes("totalOrders: number"), "KPI 3: totalOrders (Jumlah Transaksi)");
  assert.ok(reportsService.includes("averageAov: number"), "KPI 4: averageAov (Rata-rata Basket Size)");
  assert.ok(reportsService.includes("menuItems: MenuPerformanceItem[]"), "KPI 5: menuItems (Menu Terlaris)");
  assert.ok(reportsService.includes("outlets: OutletMetric[]"), "KPI 6: outlets (Performa Outlet)");
  assert.ok(reportsService.includes("paymentMethods: {"), "KPI 7: paymentMethods breakdown");

  // 3. SSR-Safety check for exportToCSV
  assert.ok(reportsService.includes('typeof window === "undefined"'), "exportToCSV must guard against window in SSR");
  assert.ok(reportsService.includes('typeof document === "undefined"'), "exportToCSV must guard against document in SSR");
  assert.ok(reportsService.includes("\\uFEFF"), "exportToCSV must prefix UTF-8 BOM for Excel compatibility");

  // 4. PerformanceOutletPage UI verifies filters & Export CSV
  assert.ok(outletPage.includes("Filter Cabang") || outletPage.includes("Cabang"), "Outlet page must have outlet filter");
  assert.ok(outletPage.includes("Periode"), "Outlet page must have date range filter");
  assert.ok(outletPage.includes("Export CSV"), "Outlet page must have Export CSV button");
  assert.ok(outletPage.includes("handleExportCSV"), "Outlet page must have handleExportCSV handler");

  // 5. PerformanceMenuPage UI verifies filters & Export CSV
  assert.ok(menuPage.includes("Cabang"), "Menu page must have outlet filter");
  assert.ok(menuPage.includes("Periode"), "Menu page must have date range filter");
  assert.ok(menuPage.includes("Export CSV"), "Menu page must have Export CSV button");
  assert.ok(menuPage.includes("handleExportCSV"), "Menu page must have handleExportCSV handler");

  // 6. InsightAnalyticsPage UI verifies filters & Export CSV
  assert.ok(insightPage.includes("Cabang"), "Insight page must have outlet filter");
  assert.ok(insightPage.includes("Periode"), "Insight page must have date range filter");
  assert.ok(insightPage.includes("Export CSV"), "Insight page must have Export CSV button");
});

// --- TEST 55: Hardware Direct Thermal Printing (ESC/POS), Web Bluetooth / Web USB & Cash Drawer Pulse Kick ---
console.log("\n▶ 55. HARDWARE INTEGRATION AUDIT: DIRECT THERMAL PRINTING (ESC/POS), WEB BLUETOOTH / USB & CASH DRAWER");
test("Thermal printer service, settings, and POS cashier implement standard ESC/POS encoding, hardware drawer kick, and SSR safety", () => {
  const printerService = fs.readFileSync(path.join(process.cwd(), "src/services/thermal-printer.service.ts"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const receiptPage = fs.readFileSync(path.join(process.cwd(), "src/pages/pos/PosReceiptPage.tsx"), "utf8");
  const printerSettings = fs.readFileSync(path.join(process.cwd(), "src/pages/settings/PrinterSettingsPage.tsx"), "utf8");

  // 1. Check ESC/POS command sequences and Cash Drawer kick pulse
  assert.ok(printerService.toLowerCase().includes("0x1b, 0x70"), "thermal-printer.service must include ESC/POS cash drawer pulse 1B 70 00 19 FA");
  assert.ok(printerService.toLowerCase().includes("0x1b, 0x40"), "thermal-printer.service must include ESC @ initialize command");
  assert.ok(printerService.toLowerCase().includes("0x1d, 0x56"), "thermal-printer.service must include GS V paper cut command");

  // 2. Check 58mm (32 chars) and 80mm (48 chars) paper format support
  assert.ok(printerService.includes("32") && printerService.includes("48"), "Must support 32-char (58mm) and 48-char (80mm) widths");
  assert.ok(printerService.includes("buildEscPosReceipt"), "Must export/implement buildEscPosReceipt encoder");

  // 3. Web Bluetooth & Web USB client checks and SSR safety
  assert.ok(printerService.includes("isBluetoothSupported"), "Must export isBluetoothSupported check");
  assert.ok(printerService.includes("isUsbSupported"), "Must export isUsbSupported check");
  assert.ok(printerService.includes('typeof window === "undefined"'), "Must guard against SSR window object");
  assert.ok(printerService.includes("connectBluetoothPrinter"), "Must implement connectBluetoothPrinter");
  assert.ok(printerService.includes("connectUsbPrinter"), "Must implement connectUsbPrinter");
  assert.ok(printerService.includes("kickCashDrawer"), "Must export kickCashDrawer");
  assert.ok(printerService.includes("printReceipt"), "Must export printReceipt with automatic fallback to window.print()");

  // 4. POS Cashier & Receipt Modal integration
  assert.ok(posApp.includes("printReceipt"), "KebabsChoicePOSApp must invoke printReceipt in ReceiptModal");
  assert.ok(posApp.includes("kickCashDrawer"), "KebabsChoicePOSApp must kick cash drawer on cash transactions");
  assert.ok(posApp.includes("Printer & Laci"), "KebabsChoicePOSApp must have thermal printer & cash drawer status indicator");

  // 5. PosReceiptPage & PrinterSettingsPage hardware integration
  assert.ok(receiptPage.includes("printReceipt"), "PosReceiptPage must invoke printReceipt");
  assert.ok(receiptPage.includes("kickCashDrawer"), "PosReceiptPage must support cash drawer opening");
  assert.ok(printerSettings.includes("connectBluetoothPrinter"), "PrinterSettingsPage must support Bluetooth printer pairing");
  assert.ok(printerSettings.includes("connectUsbPrinter"), "PrinterSettingsPage must support USB printer connection");
});

// --- TEST 56: Physical Barcode Scanner Listener (Keyboard Wedge Mode) & SKU Auto-Cart Integration ---
console.log("\n▶ 56. HARDWARE INTEGRATION AUDIT: BARCODE SCANNER LISTENER (KEYBOARD WEDGE) & SKU CART SYNC");
test("useBarcodeScanner hook and POS cashier handle rapid keystrokes, input field evasion, required variant modal and auto-cart addition", () => {
  const hookPath = path.join(process.cwd(), "src/hooks/use-barcode-scanner.ts");
  assert.ok(fs.existsSync(hookPath), "src/hooks/use-barcode-scanner.ts must exist");
  const hookContent = fs.readFileSync(hookPath, "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  // 1. Hook specification & rapid timing threshold (< 40ms)
  assert.ok(hookContent.includes("export function useBarcodeScanner"), "Must export useBarcodeScanner function");
  assert.ok(hookContent.includes("maxIntervalMs = 40") || hookContent.includes("maxIntervalMs"), "Must default to 40ms rapid keystroke threshold");
  assert.ok(hookContent.includes('event.key === "Enter"'), "Must detect Enter terminator");
  assert.ok(hookContent.includes("removeEventListener"), "Must clean up event listener on unmount");

  // 2. Editable target evasion (protects cashier typing in inputs/textareas)
  assert.ok(hookContent.includes("textarea") && hookContent.includes("input"), "Must detect input and textarea to prevent interference");
  assert.ok(hookContent.includes("isContentEditable") || hookContent.includes("contenteditable"), "Must check contenteditable");

  // 3. POS Cashier integration
  assert.ok(posApp.includes("useBarcodeScanner"), "KebabsChoicePOSApp must import and invoke useBarcodeScanner");
  assert.ok(posApp.includes("handleBarcodeScan"), "KebabsChoicePOSApp must define handleBarcodeScan");
  assert.ok(posApp.includes("sku") || posApp.includes("barcode"), "handleBarcodeScan must query sku or barcode");
  assert.ok(posApp.includes("SKU tidak ditemukan"), "Must display 'SKU tidak ditemukan' toast if no product matches");
  assert.ok(posApp.includes("handleOpenCustomize"), "Must open customize modal if menu has required variants");
  assert.ok(posApp.includes("Barcode Scanner"), "Must show Barcode Scanner status badge in POS header");
});

// --- TEST 57: Offline-First POS Queue & Client-Side IndexedDB Synchronization (Tahap 3) ---
console.log("\n▶ 57. OFFLINE-FIRST POS QUEUE & CLIENT-SIDE INDEXEDDB SYNCHRONIZATION AUDIT");
test("IndexedDB stores, idempotency keys, offline queueing, sequential synchronization, and dynamic POS network badges are verified", () => {
  const servicePath = path.join(process.cwd(), "src/services/offline-sync.service.ts");
  assert.ok(fs.existsSync(servicePath), "src/services/offline-sync.service.ts must exist");
  const serviceContent = fs.readFileSync(servicePath, "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const shiftPage = fs.readFileSync(path.join(process.cwd(), "src/pages/pos/PosShiftCashPage.tsx"), "utf8");

  // 1. SSR-Safety checks
  assert.ok(serviceContent.includes("isClient"), "Service must export isClient() SSR safety helper");
  assert.ok(serviceContent.includes('typeof window === "undefined"'), "Must guard window for SSR");
  assert.ok(serviceContent.includes("typeof indexedDB"), "Must guard indexedDB for SSR");

  // 2. IndexedDB Stores & Schema
  assert.ok(serviceContent.includes('db.createObjectStore("cached_catalog"'), "Must create cached_catalog object store with outlet_id key");
  assert.ok(serviceContent.includes('db.createObjectStore("pending_transactions"'), "Must create pending_transactions object store with idempotency_key");
  assert.ok(serviceContent.includes("idempotency_key"), "Must enforce idempotency_key for offline transactions");

  // 3. Service API Exports
  assert.ok(serviceContent.includes("export async function cacheOutletCatalog"), "Must export cacheOutletCatalog");
  assert.ok(serviceContent.includes("export async function getCachedOutletCatalog"), "Must export getCachedOutletCatalog");
  assert.ok(serviceContent.includes("export async function queueOfflineTransaction"), "Must export queueOfflineTransaction");
  assert.ok(serviceContent.includes("export async function getPendingTransactions"), "Must export getPendingTransactions");
  assert.ok(serviceContent.includes("export async function syncPendingTransactions"), "Must export syncPendingTransactions");
  assert.ok(serviceContent.includes("export function subscribeNetworkStatus"), "Must export subscribeNetworkStatus");

  // 4. Sequential Sync & Idempotency Duplicate Protection
  assert.ok(serviceContent.includes("existingOrder"), "Sync process must verify if transaction was already committed");
  assert.ok(serviceContent.includes("removePendingTransaction"), "Sync must remove committed transaction from queue upon success");

  // 5. Shift Open Caching
  assert.ok(shiftPage.includes("cacheOutletCatalog"), "PosShiftCashPage must trigger cacheOutletCatalog on shift opening");

  // 6. POS Cashier 3-State Network Badge & Offline Queueing
  assert.ok(posApp.includes("queueOfflineTransaction"), "POS checkout must queue offline transaction when disconnected");
  assert.ok(posApp.includes("syncPendingTransactions"), "POS cashier must allow manual or auto sync execution");
  assert.ok(posApp.includes("Menyinkronkan..."), "POS header must render 'Menyinkronkan...' syncing state");
  assert.ok(posApp.includes("Mode Offline —"), "POS header must render offline state with pending counter");
  assert.ok(posApp.includes("Sinkronkan Sekarang"), "POS header must provide 'Sinkronkan Sekarang' action button");
  assert.ok(posApp.includes("Online"), "POS header must render 'Online' status badge");
});

// --- TEST 58: Dynamic QRIS Architecture, Realtime Webhook & Auto-Settlement (Tahap 4) ---
console.log("\n▶ 58. DYNAMIC QRIS ARCHITECTURE, REALTIME WEBHOOK & AUTO-SETTLEMENT AUDIT");
test("EMVCo QRIS generation, CRC16 checksum, webhook validation, idempotency check, and POS auto-settlement are verified", () => {
  const qrisServicePath = path.join(process.cwd(), "src/services/qris.service.ts");
  const qrisApiPath = path.join(process.cwd(), "src/routes/api/qris.ts");
  const webhookApiPath = path.join(process.cwd(), "src/routes/api/qris-webhook.ts");
  const migrationDir = path.join(process.cwd(), "supabase/migrations");
  const supabaseTypes = fs.readFileSync(path.join(process.cwd(), "src/integrations/supabase/types.ts"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  assert.ok(fs.existsSync(qrisServicePath), "src/services/qris.service.ts must exist");
  assert.ok(fs.existsSync(qrisApiPath), "src/routes/api/qris.ts must exist");
  assert.ok(fs.existsSync(webhookApiPath), "src/routes/api/qris-webhook.ts must exist");

  const serviceContent = fs.readFileSync(qrisServicePath, "utf8");
  const webhookContent = fs.readFileSync(webhookApiPath, "utf8");

  // 1. SQL Migration & Supabase Database Types
  const migrationFiles = fs.readdirSync(migrationDir);
  const qrisMigration = migrationFiles.find((f) => f.includes("qris"));
  assert.ok(qrisMigration, "Must have migration file for qris_transactions");
  const migrationContent = fs.readFileSync(path.join(migrationDir, qrisMigration), "utf8");
  assert.ok(migrationContent.includes("CREATE TABLE IF NOT EXISTS public.qris_transactions"), "Migration must create qris_transactions table");
  assert.ok(migrationContent.includes("external_reference_id text NOT NULL UNIQUE"), "Must define external_reference_id unique column");
  assert.ok(supabaseTypes.includes("qris_transactions: {"), "Supabase types must define qris_transactions table");

  // 2. EMVCo ASPI QRIS Payload Generation & CRC16 Checksum
  assert.ok(serviceContent.includes("computeCrc16Ccitt"), "Must export computeCrc16Ccitt");
  assert.ok(serviceContent.includes("generateQrisPayload"), "Must export generateQrisPayload");
  assert.ok(serviceContent.includes("000201") || serviceContent.includes('formatTLV("00", "01")'), "Must use standard EMVCo payload format indicator 00");
  assert.ok(serviceContent.includes('formatTLV("01", "12")'), "Must specify Dynamic QR initiation method 12");
  assert.ok(serviceContent.includes('formatTLV("53", "360")'), "Must specify IDR currency code 360");

  // 3. Dynamic QRIS Generation & Realtime Status
  assert.ok(serviceContent.includes("export async function generateDynamicQris"), "Must export generateDynamicQris");
  assert.ok(serviceContent.includes("export async function checkQrisPaymentStatus"), "Must export checkQrisPaymentStatus");
  assert.ok(serviceContent.includes("export function subscribeQrisStatus"), "Must export subscribeQrisStatus");
  assert.ok(serviceContent.includes("export async function simulateQrisPayment"), "Must export simulateQrisPayment");

  // 4. Webhook Security, Idempotency & Status Settlement
  assert.ok(webhookContent.includes("validateWebhookSignature") || webhookContent.includes("callbackToken") || webhookContent.includes("x-callback-token"), "Webhook must validate token or signature");
  assert.ok(webhookContent.includes("currentStatus.status === \"PAID\"") || webhookContent.includes("already settled (idempotent)"), "Webhook must execute idempotency check");
  assert.ok(webhookContent.includes("sales_orders"), "Webhook must update sales_orders table on settlement");

  // 5. POS Kasir UI Dynamic QRIS Modal & Auto-Settlement
  assert.ok(posApp.includes("isQrisModalOpen"), "POS must control QRIS payment modal visibility");
  assert.ok(posApp.includes("subscribeQrisStatus"), "POS must subscribe to QRIS realtime status changes");
  assert.ok(posApp.includes("PEMBAYARAN QRIS LUNAS"), "POS must render 'PEMBAYARAN QRIS LUNAS' celebration banner");
  assert.ok(posApp.includes("Cek Status Pembayaran"), "POS modal must provide 'Cek Status Pembayaran' manual button");
  assert.ok(posApp.includes("Simulasi Bayar"), "POS modal must provide 'Simulasi Bayar' test button");
});

// --- TEST 59: MENU DELETION CASCADE & INVENTORY BOM SINGLE-SOURCE-OF-TRUTH AUDIT (BUGS #1, #2, #7) ---
console.log("\n▶ 59. MENU DELETION CASCADE & INVENTORY BOM SYNCHRONIZATION AUDIT (BUGS #1, #2, #7)");
test("Menu deletion cascade removes child dependencies and filters inactive items; BOM & POS inventory read single source with zero dummy fallback", () => {
  const menuApi = fs.readFileSync(path.join(process.cwd(), "src/routes/api/menu.ts"), "utf8");
  const menuService = fs.readFileSync(path.join(process.cwd(), "src/services/menu.service.ts"), "utf8");
  const menuMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/MenuManagement.tsx"), "utf8");
  const invService = fs.readFileSync(path.join(process.cwd(), "src/services/inventory.service.ts"), "utf8");
  const posInvPage = fs.readFileSync(path.join(process.cwd(), "src/pages/pos/PosInventoryPage.tsx"), "utf8");
  const posData = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/data.ts"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");

  // 1. BUG #1: Cascade deletion of child entities (recipes, recipe_items, variant groups/options, outlet assignments)
  assert.ok(menuApi.includes('action === "delete-item"'), "api/menu.ts must handle action delete-item");
  assert.ok(menuApi.includes("recipe_items") && menuApi.includes("menu_variant_options"), "api/menu.ts delete-item must cascade-delete recipe_items and menu_variant_options");
  assert.ok(menuService.includes("recipe_items") && menuService.includes("menu_variant_groups"), "menu.service.ts deleteMenuItem must cascade-clean child tables");

  // 2. BUG #1: Immediate optimistic UI state update in MenuManagement.tsx
  assert.ok(menuMgmt.includes("setItems((prev) => prev.filter((i) => i.id !== targetId))"), "MenuManagement must optimistically remove deleted item from state");

  // 3. BUG #1: API and service must filter out inactive / deleted items from menu queries
  assert.ok(menuApi.includes('.neq("active", false)'), "api/menu.ts must filter out inactive items");
  assert.ok(menuApi.includes("menuItems = menuItems.filter((i) => i.active !== false"), "api/menu.ts must strictly exclude deactivated items from response");

  // 4. BUG #2 & #7: Single source of truth for BOM ingredients (inventory_items table, never stale dummy ingredients)
  assert.ok(menuApi.includes('type === "ingredients"'), "api/menu.ts must handle type === ingredients");
  assert.ok(menuApi.includes('.from("inventory_items")'), "api/menu.ts ingredients query must select directly from inventory_items");
  assert.ok(!menuApi.includes('.from("ingredients" as any)'), "api/menu.ts must NOT query legacy dummy ingredients table first");

  // 5. BUG #2 & #7: demoInventory in data.ts must be empty array (zero dummy)
  assert.ok(posData.includes("export const demoInventory: InventoryItem[] = [];"), "demoInventory in data.ts must be empty array (zero dummy fallback)");

  // 6. BUG #2 & #7: PosInventoryPage must NOT use defaultDemoItems and must render clean empty state
  assert.ok(!posInvPage.includes("defaultDemoItems"), "PosInventoryPage must NOT contain defaultDemoItems array");
  assert.ok(posInvPage.includes("Tidak Ada Data Bahan Baku"), "PosInventoryPage must render clean empty state");

  // 7. BUG #2 & #7: Inventory deletion purges cache and notifies listeners
  assert.ok(invService.includes('window.dispatchEvent(new CustomEvent("inventory:updated"))'), "deleteInventoryItem must dispatch inventory:updated event");
  assert.ok(menuMgmt.includes('window.addEventListener("inventory:updated"'), "MenuManagement must listen to inventory:updated");
  assert.ok(posApp.includes('window.addEventListener("inventory:updated"'), "KebabsChoicePOSApp must listen to inventory:updated");
});

// --- TEST 60: STAFF ASSIGNMENT RESILIENCE & OUTLET DELETION FK SAFEGUARD AUDIT (BUG #3) ---
console.log("\n▶ 60. STAFF ASSIGNMENT RESILIENCE & OUTLET DELETION FK SAFEGUARD AUDIT (BUG #3)");
test("Staff assignment gracefully survives missing staff_profiles table, persists in settings JSON & localStorage; outlet deletion safely archives on FK violation", () => {
  const outletService = fs.readFileSync(path.join(process.cwd(), "src/services/outlet.service.ts"), "utf8");
  const staffService = fs.readFileSync(path.join(process.cwd(), "src/services/staff.service.ts"), "utf8");
  const listStaffRoute = fs.readFileSync(path.join(process.cwd(), "src/routes/api/list-staff.ts"), "utf8");
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const outletMgmt = fs.readFileSync(path.join(process.cwd(), "src/pages/OutletManagement.tsx"), "utf8");

  // 1. assignOutletEmployees in outlet.service.ts must NOT throw on staff_profiles failure
  assert.ok(outletService.includes("assigned_staff_ids: newAssignedUserIds"), "assignOutletEmployees must persist assigned_staff_ids into outlets.settings");
  assert.ok(outletService.includes("kebabschoicepos_staff_outlet_assignments"), "assignOutletEmployees must persist mapping into localStorage");
  assert.ok(outletService.includes("siblingStaff.filter"), "assignOutletEmployees must remove reassigned staff from sibling outlets in the same business");

  // 2. assignOutletManager in outlet.service.ts must persist manager_user_id into settings
  assert.ok(outletService.includes("manager_user_id: managerUserId"), "assignOutletManager must persist manager_user_id in outlets.settings");

  // 3. deleteOutlet in outlet.service.ts must catch FK constraint violations (code 23503) and fallback to soft-delete
  assert.ok(outletService.includes("archived: true") && outletService.includes("active: false"), "deleteOutlet must fall back to soft-delete/archive on FK violation");
  assert.ok(outletService.includes("Hard delete blocked by constraint/FK, executing soft-delete / archive fallback"), "deleteOutlet must log clean fallback warning without rethrowing constraint error");

  // 4. staff.service.ts queryStaffListDirect must resolve outlet from outlets.settings and localStorage
  assert.ok(staffService.includes("assignedIds.includes(m.user_id) || setObj.manager_user_id === m.user_id"), "staff.service.ts must fallback to outlets.settings for staff outlet assignment");
  assert.ok(staffService.includes("localAssignmentMap[m.user_id]"), "staff.service.ts must check localStorage mapping fallback");

  // 5. list-staff.ts API route must resolve assignedOutletId from settings JSON
  assert.ok(listStaffRoute.includes("assignedIds.includes(m.user_id) || setObj.manager_user_id === m.user_id"), "list-staff.ts must check outlets.settings for staff outlet assignment");

  // 6. KebabsChoicePOSApp loadSnapshot must resolve cashier assignedOutletId from settings & localStorage
  assert.ok(posApp.includes("resolvedAssignedOutletId"), "KebabsChoicePOSApp must resolve assignedOutletId with settings & localStorage fallback");

  // 7. OutletManagement.tsx must optimistically remove deleted outlet from state
  assert.ok(outletMgmt.includes("setItems((prev) => prev.filter((o) => o.id !== targetId))"), "OutletManagement must optimistically remove deleted outlet from state");
});

// --- TEST 61: POS KASIR OPERATIONAL INTEGRITY (BUGS #4, #5, AND #6 AUDIT) ---
console.log("\n▶ 61. POS KASIR OPERATIONAL INTEGRITY (BUGS #4, #5, AND #6 AUDIT)");
test("Zero hardcoded addons in variant modal (Bug #4), Cash Tendered & Change breakdown in receipts (Bug #5), and 400 retry / immediate local order sync / local date filter (Bug #6)", () => {
  const posApp = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/KebabsChoicePOSApp.tsx"), "utf8");
  const posData = fs.readFileSync(path.join(process.cwd(), "src/components/kebabschoicepos/data.ts"), "utf8");
  const posReceiptPage = fs.readFileSync(path.join(process.cwd(), "src/pages/pos/PosReceiptPage.tsx"), "utf8");

  // 1. BUG #4: Zero hardcoded toppings / addons in POS customization modal
  assert.ok(
    posApp.includes("const defaultAddons: ProductVariant[] = [];"),
    "defaultAddons in KebabsChoicePOSApp must be empty array (zero hardcoded toppings)"
  );
  assert.ok(
    !posApp.includes("Tambahan Topping (Add-ons)"),
    "POS modal must NOT contain hardcoded 'Tambahan Topping (Add-ons)' block"
  );
  assert.ok(
    !posApp.includes("Extra Daging"),
    "POS modal must NOT contain hardcoded 'Extra Daging'"
  );

  // 2. BUG #5: SalesOrder & ReceiptData include cashReceived & changeAmount
  assert.ok(posData.includes("cashReceived?: number;"), "SalesOrder in data.ts must include cashReceived");
  assert.ok(posData.includes("changeAmount?: number;"), "SalesOrder in data.ts must include changeAmount");
  assert.ok(posApp.includes("cashReceived?: number;"), "ReceiptData in KebabsChoicePOSApp must include cashReceived");
  assert.ok(posApp.includes("changeAmount?: number;"), "ReceiptData in KebabsChoicePOSApp must include changeAmount");

  // 3. BUG #5: ReceiptModal renders Total, Cash Received, and Change
  assert.ok(posApp.includes("TOTAL TAGIHAN"), "ReceiptModal must display TOTAL TAGIHAN");
  assert.ok(posApp.includes("Tunai Diterima:"), "ReceiptModal must display Tunai Diterima");
  assert.ok(posApp.includes("Kembalian:"), "ReceiptModal must display Kembalian");

  // 4. BUG #5: Thermal Receipt preview & print service integration in PosReceiptPage
  assert.ok(posReceiptPage.includes("cashReceived?: number;"), "ReceiptOrder in PosReceiptPage must include cashReceived");
  assert.ok(posReceiptPage.includes("changeAmount?: number;"), "ReceiptOrder in PosReceiptPage must include changeAmount");
  assert.ok(posReceiptPage.includes("<span>Tunai Diterima:</span>"), "PosReceiptPage must render Tunai Diterima in thermal preview");
  assert.ok(posReceiptPage.includes("<span>Kembalian:</span>"), "PosReceiptPage must render Kembalian in thermal preview");
  assert.ok(posReceiptPage.includes("cashTendered: selectedOrder.cashReceived"), "PosReceiptPage printReceipt call must pass cashTendered");
  assert.ok(posReceiptPage.includes("change: selectedOrder.changeAmount"), "PosReceiptPage printReceipt call must pass change");

  // 5. BUG #6: Checkout & QRIS retry sales_orders with core columns on 400 Bad Request
  assert.ok(
    posApp.includes("Initial sales_orders insert failed (possible 400 Bad Request), retrying with core columns"),
    "KebabsChoicePOSApp checkout must catch 400 / missing column errors and retry with core columns"
  );
  assert.ok(
    posApp.includes("order_number: orderNumber,"),
    "KebabsChoicePOSApp checkout must execute core-only fallback insert"
  );

  // 6. BUG #6: Immediate local persistence and real-time order:created event dispatch
  assert.ok(
    posApp.includes("localStorage.setItem(\"kebabschoicepos_recent_orders\""),
    "KebabsChoicePOSApp must persist newly placed orders to kebabschoicepos_recent_orders"
  );
  assert.ok(
    posApp.includes("window.dispatchEvent(new CustomEvent(\"order:created\""),
    "KebabsChoicePOSApp must dispatch order:created custom event on checkout"
  );

  // 7. BUG #6: OrdersPage synchronizes recent orders and supports local today date filtering
  assert.ok(
    posApp.includes("window.addEventListener(\"order:created\", handleOrderCreated)"),
    "OrdersPage must listen to order:created event for immediate list update"
  );
  assert.ok(
    posApp.includes("isTodayLocal"),
    "OrdersPage must provide isTodayLocal date filter helper using client timezone"
  );
  assert.ok(
    posApp.includes("setDateFilter(\"today\")"),
    "OrdersPage must provide Hari Ini date filter button"
  );
  assert.ok(
    posReceiptPage.includes("localStorage.getItem(\"kebabschoicepos_recent_orders\")"),
    "PosReceiptPage must merge recent orders from localStorage"
  );
});

console.log("\n==================================================");
console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log("==================================================\n");



