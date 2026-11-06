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

async function run() {
  console.log("=== KEBABSCHOICEPOS SYSTEM STATE AUDIT ===");
  const tables = [
    "businesses",
    "business_members",
    "user_roles",
    "outlets",
    "products",
    "menu_categories",
    "menu_variant_groups",
    "menu_variant_options",
    "recipes",
    "recipe_items",
    "ingredients",
    "inventory_items",
    "customers",
    "sales_orders",
    "sales_order_items",
    "ai_insights",
  ];

  for (const table of tables) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`[TABLE] ${table.padEnd(22)}: ERROR (${error.message})`);
    } else {
      console.log(`[TABLE] ${table.padEnd(22)}: ${count} rows`);
    }
  }

  console.log("\n--- BUSINESS MEMBERS ---");
  const { data: members } = await client.from("business_members").select("id, business_id, user_id, role, outlet_id");
  console.log(members);

  console.log("\n--- PRODUCTS SAMPLE ---");
  const { data: prods } = await client.from("products").select("id, name, category, price, cost_price, business_id").limit(10);
  console.log(prods);

  console.log("\n--- ORDERS SAMPLE ---");
  const { data: ords } = await client.from("sales_orders").select("id, order_number, total, status, business_id, outlet_id").limit(5);
  console.log(ords);
}

run().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
