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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYSTEM_UUIDS = {
  makanan: "00000000-0000-4000-8000-000000000001",
  minuman: "00000000-0000-4000-8000-000000000002",
  camilan: "00000000-0000-4000-8000-000000000003",
  "paket hemat": "00000000-0000-4000-8000-000000000004",
};

function getValidUuid(id, name) {
  if (id && UUID_REGEX.test(id)) return id;
  const key = (name || "").trim().toLowerCase();
  if (SYSTEM_UUIDS[key]) return SYSTEM_UUIDS[key];
  return crypto.randomUUID();
}

async function migrate() {
  console.log("--- Migrating categories in outlets.settings & DB ---");

  // 1. Purge dummy 6004
  await client.from("products").update({ category: null, category_id: null }).ilike("category", "%6004%");
  await client.from("menu_categories").delete().ilike("name", "%6004%");

  // 2. Fetch outlets
  const { data: outlets } = await client.from("outlets").select("id, business_id, settings");
  for (const o of outlets || []) {
    const cur = o.settings || {};
    let cats = cur.menu_categories || [];
    let changed = false;

    // Filter out 6004
    const beforeCount = cats.length;
    cats = cats.filter((c) => !c.name?.includes("6004"));
    if (cats.length !== beforeCount) changed = true;

    // Replace non-UUID ids
    cats = cats.map((c) => {
      const validId = getValidUuid(c.id, c.name);
      if (validId !== c.id) {
        console.log(`Outlet ${o.id} Migrating category id: "${c.id}" -> "${validId}" for "${c.name}"`);
        changed = true;
        return { ...c, id: validId };
      }
      return c;
    });

    if (changed) {
      await client
        .from("outlets")
        .update({
          settings: { ...cur, menu_categories: cats },
        })
        .eq("id", o.id);
      console.log(`Updated outlet ${o.id} settings.menu_categories`);
    }

    // Also ensure categories exist in menu_categories table with valid UUID
    for (const c of cats) {
      const { data: existing } = await client.from("menu_categories").select("id").eq("id", c.id).maybeSingle();
      if (!existing && o.business_id) {
        const { error: insErr } = await client.from("menu_categories").insert({
          id: c.id,
          business_id: o.business_id,
          name: c.name,
          description: c.description || null,
          active: c.active !== false,
        });
        if (insErr) console.warn("menu_categories insert notice:", insErr.message);
        else console.log(`Inserted into menu_categories table: "${c.name}" (${c.id})`);
      }
    }
  }

  console.log("--- Migration completed successfully ---");
}

migrate().catch(console.error);
