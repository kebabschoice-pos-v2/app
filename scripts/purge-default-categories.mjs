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

async function purge() {
  console.log("=== PURGING DUMMY/DEFAULT/SYSTEM CATEGORIES ===");

  const dummyNames = ["makanan", "minuman", "camilan", "paket hemat", "kebab special test"];
  const systemUuids = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000004",
  ];

  // 1. Delete from menu_categories
  const { data: dbCats } = await client.from("menu_categories").select("id, name, is_system");
  for (const c of dbCats || []) {
    const isDummy =
      systemUuids.includes(c.id) ||
      c.is_system === true ||
      dummyNames.includes((c.name || "").trim().toLowerCase()) ||
      c.name?.includes("6004");

    if (isDummy) {
      console.log(`Deleting category from menu_categories: "${c.name}" (${c.id})`);
      await client.from("menu_categories").delete().eq("id", c.id);
    }
  }

  // 2. Clean from outlets.settings.menu_categories
  const { data: outlets } = await client.from("outlets").select("id, name, settings");
  for (const o of outlets || []) {
    const settings = o.settings || {};
    const cats = settings.menu_categories;
    if (Array.isArray(cats)) {
      const filtered = cats.filter((c) => {
        const isDummy =
          systemUuids.includes(c.id) ||
          c.is_system === true ||
          dummyNames.includes((c.name || "").trim().toLowerCase()) ||
          c.name?.includes("6004");
        return !isDummy;
      });

      if (filtered.length !== cats.length) {
        console.log(`Updating outlet ${o.name} (${o.id}): removed ${cats.length - filtered.length} dummy categories`);
        await client
          .from("outlets")
          .update({
            settings: { ...settings, menu_categories: filtered },
            updated_at: new Date().toISOString(),
          })
          .eq("id", o.id);
      }
    }
  }

  // 3. Clean dummy categories from products table
  for (const name of dummyNames) {
    await client
      .from("products")
      .update({ category: null, category_id: null })
      .ilike("category", name);
  }
  await client
    .from("products")
    .update({ category: null, category_id: null })
    .ilike("category", "%6004%");

  console.log("\n=== REMAINING CATEGORIES IN DB ===");
  const { data: remaining } = await client.from("menu_categories").select("id, name, business_id, is_system");
  console.log("menu_categories:", remaining);

  const { data: remainingOutlets } = await client.from("outlets").select("id, name, settings");
  for (const o of remainingOutlets || []) {
    console.log(`Outlet ${o.name} settings.menu_categories:`, o.settings?.menu_categories);
  }

  console.log("=== PURGE COMPLETED ===");
}

purge().catch((err) => {
  console.error("Purge error:", err);
  process.exit(1);
});
