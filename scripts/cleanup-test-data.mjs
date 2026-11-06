import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const [k, ...v] = line.trim().split("=");
  if (k && v.length) env[k.trim()] = v.join("=").trim();
});

const client = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
  console.log("=== CLEANING UP DUMMY SEED AND TEST DATA ===");

  // 1. Delete order items for demo orders
  const { data: demoOrders } = await client
    .from("sales_orders")
    .select("id, order_number")
    .like("order_number", "KP-2609-%");

  if (demoOrders && demoOrders.length > 0) {
    const demoOrderIds = demoOrders.map((o) => o.id);
    console.log(`Found ${demoOrders.length} demo orders to purge:`, demoOrderIds);

    const { error: itemsErr } = await client
      .from("sales_order_items")
      .delete()
      .in("order_id", demoOrderIds);
    if (itemsErr) console.warn("sales_order_items cleanup note:", itemsErr.message);

    const { error: ordsErr } = await client
      .from("sales_orders")
      .delete()
      .in("id", demoOrderIds);
    if (ordsErr) console.warn("sales_orders cleanup note:", ordsErr.message);
  }

  // 2. Delete demo products
  const demoProductNames = [
    "Signature Kopi Aren",
    "Matcha Cloud",
    "Croissant Butter",
    "Nasi Ayam Sambal Matah",
    "Retail Beans 250g",
    "Cold Brew Bottle",
  ];
  const { data: prodsToDelete } = await client
    .from("products")
    .select("id, name")
    .in("name", demoProductNames);

  if (prodsToDelete && prodsToDelete.length > 0) {
    const prodIds = prodsToDelete.map((p) => p.id);
    console.log(`Purging ${prodsToDelete.length} demo products:`, prodsToDelete.map((p) => p.name));
    
    // Purge recipe items, recipes, variant groups/options linked to these products
    await client.from("recipe_items").delete().in("recipe_id", (
      await client.from("recipes").select("id").in("product_id", prodIds)
    ).data?.map((r) => r.id) || []);
    await client.from("recipes").delete().in("product_id", prodIds);

    const { data: groups } = await client.from("menu_variant_groups").select("id").in("menu_item_id", prodIds);
    if (groups && groups.length > 0) {
      await client.from("menu_variant_options").delete().in("group_id", groups.map((g) => g.id));
      await client.from("menu_variant_groups").delete().in("id", groups.map((g) => g.id));
    }

    await client.from("products").delete().in("id", prodIds);
  }

  // 3. Purge demo inventory items
  const demoInvNames = ["Biji Kopi House Blend", "Susu Oat", "Cup 12oz", "Syrup Aren"];
  const { data: invToDelete } = await client
    .from("inventory_items")
    .select("id, name")
    .in("name", demoInvNames);

  if (invToDelete && invToDelete.length > 0) {
    console.log(`Purging ${invToDelete.length} demo inventory items:`, invToDelete.map((i) => i.name));
    await client.from("inventory_items").delete().in("id", invToDelete.map((i) => i.id));
  }

  // 4. Purge demo customers
  const demoCustNames = ["Alya Pratama", "Bima Studio"];
  const { data: custsToDelete } = await client
    .from("customers")
    .select("id, name")
    .in("name", demoCustNames);

  if (custsToDelete && custsToDelete.length > 0) {
    console.log(`Purging ${custsToDelete.length} demo customers:`, custsToDelete.map((c) => c.name));
    await client.from("customers").delete().in("id", custsToDelete.map((c) => c.id));
  }

  // 5. Purge demo AI insights
  const { data: insightsToDelete } = await client
    .from("ai_insights")
    .select("id, title")
    .in("title", [
      "Margin Rendah di Menu Signature",
      "Restock Biji Kopi House Blend",
      "Lonjakan Penjualan Akhir Pekan",
      "Pelanggan VIP Baru Terdeteksi",
    ]);

  if (insightsToDelete && insightsToDelete.length > 0) {
    console.log(`Purging ${insightsToDelete.length} demo AI insights`);
    await client.from("ai_insights").delete().in("id", insightsToDelete.map((i) => i.id));
  }

  // 6. Purge dummy 6004 products and categories
  await client.from("products").delete().ilike("category", "%6004%");
  await client.from("menu_categories").delete().ilike("name", "%6004%");

  console.log("=== CLEANUP FINISHED SUCCESSFULLY ===");
}

cleanup().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
