import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { TenantOnboardingSchema } from "../lib/validations/onboarding";
import { TenantOnboardingService } from "../lib/services/TenantOnboardingService";
import { Logger } from "../lib/infrastructure/logging/Logger";

async function main() {
  const args = process.argv.slice(2);
  let isDryRun = false;
  let tenantDir = "";

  for (const arg of args) {
    if (arg === "--dry-run") {
      isDryRun = true;
    } else if (arg === "--apply") {
      isDryRun = false;
    } else if (!arg.startsWith("--")) {
      tenantDir = arg;
    }
  }

  if (!tenantDir) {
    console.error("Usage: npm run onboard -- [--dry-run | --apply] <path-to-tenant-dir>");
    process.exit(1);
  }

  Logger.info(`[CLI] Reading tenant package from ${tenantDir}`);
  let manifest;
  try {
    const manifestContent = await fs.readFile(path.join(process.cwd(), tenantDir, "manifest.json"), "utf-8");
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    Logger.error(`[CLI] Failed to read manifest.json: ${error}`);
    process.exit(1);
  }

  Logger.info(`[CLI] Assembling payload for ${manifest.tenantSlug}...`);
  
  const readJson = async (fileName: string) => {
    try {
      if (!fileName) return undefined;
      const content = await fs.readFile(path.join(process.cwd(), tenantDir, fileName), "utf-8");
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  };

  const clinicData = await readJson(manifest.files.clinic) || {};
  const branchesData = await readJson(manifest.files.branches) || [];
  const servicesData = await readJson(manifest.files.services) || [];
  const doctorsData = await readJson(manifest.files.doctors) || [];
  const aiSettingsData = await readJson(manifest.files.aiSettings) || {};

  const rawData = {
    ...clinicData,
    ...aiSettingsData,
    branches: branchesData,
    services: servicesData,
    doctors: doctorsData,
  };

  Logger.info("[CLI] Validating payload...");
  const parsed = TenantOnboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    Logger.error("[CLI] Validation Failed:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  if (isDryRun) {
    Logger.info("[CLI] DRY RUN: Validation successful. No changes made.");
    console.log(JSON.stringify(parsed.data, null, 2));
    process.exit(0);
  }

  try {
    Logger.info("[CLI] Executing onboarding transaction...");
    const clinic = await TenantOnboardingService.onboard(parsed.data);
    Logger.info(`[CLI] Successfully onboarded clinic: ${clinic.name} (${clinic.slug})`);
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$disconnect();

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
