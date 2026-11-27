import { execSync } from "node:child_process";

process.env.NITRO_PRESET = "vercel";

try {
  execSync("node scripts/generate-web-version.mjs", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npx vite build", {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(error.status || 1);
}
