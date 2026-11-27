import fs from "node:fs";
import path from "node:path";

const now = new Date();
const payload = {
  buildId: String(now.getTime()),
  builtAt: now.toISOString(),
};

const outputPath = path.resolve(process.cwd(), "public", "web-version.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[web-version] Wrote public/web-version.json (buildId=${payload.buildId})`);
