import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CONFIG_FILE = path.join(PROJECT_ROOT, "cloudflared.config.yml");
const LOCAL_EXE = path.join(PROJECT_ROOT, "cloudflared.exe");

async function main() {
  // 1. Ensure config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("❌ Error: cloudflared.config.yml not found!");
    console.error("Please copy cloudflared.config.yml.template to cloudflared.config.yml and configure it.");
    console.error("Refer to INFRASTRUCTURE.md for instructions.");
    process.exit(1);
  }

  // 2. Select appropriate cloudflared executable
  let bin = "cloudflared";
  if (process.platform === "win32" && fs.existsSync(LOCAL_EXE)) {
    bin = LOCAL_EXE;
    console.log(`[Tunnel] Using local binary: ${bin}`);
  } else {
    console.log(`[Tunnel] Using global binary: ${bin}`);
  }

  // 3. Spawn Cloudflare Named Tunnel
  console.log("[Tunnel] Starting Cloudflare Named Tunnel...");
  const args = ["tunnel", "--config", CONFIG_FILE, "run"];
  
  const child = spawn(bin, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  child.on("close", (code) => {
    console.log(`[Tunnel] Process exited with code ${code}`);
  });

  // Handle termination gracefully
  process.on("SIGINT", () => {
    child.kill("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
    process.exit(0);
  });
}

main().catch(console.error);
