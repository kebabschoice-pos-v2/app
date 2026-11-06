import { execSync } from "node:child_process";

process.env.NITRO_PRESET = "vercel";

try {
  execSync("npx vite build", {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(error.status || 1);
}
