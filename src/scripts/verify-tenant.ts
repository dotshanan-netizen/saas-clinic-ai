import fs from "fs/promises";
import path from "path";

async function verify() {
  const args = process.argv.slice(2);
  const tenantDir = args[0];

  if (!tenantDir) {
    console.error("Usage: npm run tenant:verify <path-to-tenant-dir>");
    process.exit(1);
  }

  console.log(`\n🔍 Verifying Tenant Package: ${tenantDir}\n`);

  const exists = async (filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  };

  const readJson = async (fileName: string) => {
    try {
      if (!fileName) return null;
      const fullPath = path.join(process.cwd(), tenantDir, fileName);
      if (!(await exists(fullPath))) return null;
      const content = await fs.readFile(fullPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  // 1. Check manifest
  const manifestPath = path.join(process.cwd(), tenantDir, "manifest.json");
  if (!(await exists(manifestPath))) {
    console.error("❌ manifest.json (MISSING)");
    process.exit(1);
  }
  
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
  console.log("✓ manifest.json");

  // 2. Check files
  const files = manifest.files;
  const fileChecks = [
    { key: "clinic", name: files.clinic },
    { key: "branches", name: files.branches },
    { key: "services", name: files.services },
    { key: "doctors", name: files.doctors },
    { key: "aiSettings", name: files.aiSettings },
    { key: "validation", name: files.validation },
    { key: "featureFlags", name: files.featureFlags },
  ];

  let missingFiles = 0;
  for (const f of fileChecks) {
    if (f.name && await exists(path.join(process.cwd(), tenantDir, f.name))) {
      console.log(`✓ ${f.name}`);
    } else if (f.name) {
      console.log(`❌ ${f.name} (MISSING)`);
      missingFiles++;
    }
  }

  // BUSINESS_PROFILE.md check
  if (await exists(path.join(process.cwd(), tenantDir, "BUSINESS_PROFILE.md"))) {
    console.log("✓ BUSINESS_PROFILE.md");
  } else {
    console.log("⚠️ BUSINESS_PROFILE.md (RECOMMENDED BUT MISSING)");
  }

  if (missingFiles > 0) {
    console.log("\n❌ Package verification failed. Missing files.");
    process.exit(1);
  }

  // 3. Entity Counts and Relations
  const branches = (await readJson(files.branches)) || [];
  const services = (await readJson(files.services)) || [];
  const doctors = (await readJson(files.doctors)) || [];

  console.log("\n----------------------------------");
  console.log(`${branches.length} branches`);
  console.log(`${services.length} services`);
  console.log(`${doctors.length} doctors`);

  // Relation check
  let brokenRelations = 0;
  for (const doc of doctors) {
    for (const bIdx of doc.branchIndexes || []) {
      if (bIdx >= branches.length) {
        console.log(`❌ Broken relation: Doctor ${doc.name} references non-existent branch index ${bIdx}`);
        brokenRelations++;
      }
    }
    for (const sIdx of doc.serviceIndexes || []) {
      if (sIdx >= services.length) {
        console.log(`❌ Broken relation: Doctor ${doc.name} references non-existent service index ${sIdx}`);
        brokenRelations++;
      }
    }
  }

  if (brokenRelations > 0) {
    console.log(`\n❌ Found ${brokenRelations} broken relations.`);
    process.exit(1);
  }

  console.log("✓ No broken relations");
  console.log("\n✅ Ready for Apply");
}

verify().catch(console.error);
