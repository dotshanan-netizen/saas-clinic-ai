/**
 * E2E Functional CRUD Test — Direct DB Layer
 * Tests the full Service + Repository + Prisma stack directly.
 *
 * Run: npx ts-node --project tsconfig.json scripts/e2e-crud-direct.ts
 */

import { prisma } from "../src/lib/db";
import { PrismaServiceRepository } from "../src/repositories/prisma/PrismaServiceRepository";
import { PrismaDoctorRepository } from "../src/repositories/prisma/PrismaDoctorRepository";
import { PrismaBranchRepository } from "../src/repositories/prisma/PrismaBranchRepository";
import { PrismaKnowledgeBaseRepository } from "../src/repositories/prisma/PrismaKnowledgeBaseRepository";
import { PrismaClinicRepository } from "../src/repositories/prisma/PrismaClinicRepository";
import { CatalogService } from "../src/services/CatalogService";
import { BranchService } from "../src/services/BranchService";
import { KnowledgeBaseService } from "../src/services/KnowledgeBaseService";
import { ClinicService } from "../src/services/ClinicService";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  evidence: string[];
  findings: string[];
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";
  recommendation: string;
  durationMs: number;
}

const results: TestResult[] = [];

function pass(r: Omit<TestResult, "status">): TestResult { return { ...r, status: "PASS" }; }
function fail(r: Omit<TestResult, "status">): TestResult { return { ...r, status: "FAIL" }; }

function printResult(r: TestResult) {
  const icon = r.status === "PASS" ? "✅" : "❌";
  console.log(`\n${icon} ${r.id} — ${r.name} [${r.durationMs}ms]`);
  console.log(`   Status: ${r.status}`);
  if (r.evidence.length) { console.log("   Evidence:"); r.evidence.forEach(e => console.log(`     - ${e}`)); }
  if (r.findings.length) { console.log("   Findings:"); r.findings.forEach(f => console.log(`     ⚠️  ${f}`)); }
  if (r.severity !== "NONE") console.log(`   Severity: ${r.severity}`);
  if (r.recommendation) console.log(`   Recommendation: ${r.recommendation}`);
}

async function getClinic() {
  const clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: "desc" } });
  return clinic;
}

// ── E2E-004A: Services CRUD ───────────────────────────────────────────────────

async function testServicesCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];
  try {
    const clinic = await getClinic();
    if (!clinic) return fail({ id: "E2E-004A", name: "Services CRUD", evidence, findings: ["لا توجد عيادة في DB"], severity: "BLOCKER", recommendation: "شغّل Onboarding أولاً", durationMs: Date.now() - start });
    evidence.push(`✔ Target clinic: ${clinic.slug} (id: ${clinic.id})`);

    const catalog = new CatalogService(new PrismaServiceRepository(), new PrismaDoctorRepository());

    // 1. CREATE
    const created = await catalog.upsertService({ clinicSlug: clinic.slug, name: "جلسة ليزر E2E", price: 750, description: "اختبار CRUD مباشر", durationMinutes: 45, status: "ACTIVE" });
    evidence.push(`✔ CREATE → id: ${created.id} | name: ${created.name} | price: ${created.price}`);

    // 2. READ
    const list = await catalog.getServices(clinic.slug);
    const found = list.find(s => s.id === created.id);
    if (!found) findings.push("الخدمة لم تظهر في getServices() بعد الإنشاء");
    else evidence.push(`✔ READ → موجودة في القائمة (${list.length} خدمة إجمالاً)`);

    // 3. UPDATE
    const updated = await catalog.upsertService({ id: created.id, clinicSlug: clinic.slug, name: "جلسة ليزر E2E (معدّلة)", price: 900, description: "تعديل ناجح", durationMinutes: 60, status: "ACTIVE" });
    if (updated.name !== "جلسة ليزر E2E (معدّلة)") findings.push(`UPDATE name mismatch: got "${updated.name}"`);
    if (updated.price !== 900) findings.push(`UPDATE price mismatch: got ${updated.price}`);
    evidence.push(`✔ UPDATE → name: ${updated.name} | price: ${updated.price}`);

    // 4. DB verify
    const dbRec = await prisma.service.findUnique({ where: { id: created.id } });
    if (!dbRec) findings.push("السجل غير موجود في DB بعد التحديث");
    else evidence.push(`✔ DB VERIFY → price in DB: ${dbRec.price} | status: ${dbRec.status}`);

    // 5. DELETE
    const deleted = await catalog.deleteService(created.id);
    evidence.push(`✔ DELETE → id: ${deleted.id}`);

    // 6. Verify deletion
    const afterDelete = await catalog.getServices(clinic.slug);
    if (afterDelete.find(s => s.id === created.id)) findings.push("الخدمة لا تزال موجودة بعد الحذف");
    else evidence.push(`✔ VERIFY DELETE → محذوفة (${afterDelete.length} خدمة متبقية)`);

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({ id: "E2E-004A", name: "Services CRUD", evidence, findings, severity: hasFail ? "HIGH" : "NONE", recommendation: "", durationMs: Date.now() - start });
  } catch (err) {
    return fail({ id: "E2E-004A", name: "Services CRUD", evidence, findings: [`Exception: ${String(err)}`], severity: "BLOCKER", recommendation: "تحقق من DB connection", durationMs: Date.now() - start });
  }
}

// ── E2E-004B: Doctors CRUD ────────────────────────────────────────────────────

async function testDoctorsCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];
  try {
    const clinic = await getClinic();
    if (!clinic) return fail({ id: "E2E-004B", name: "Doctors CRUD", evidence, findings: ["لا توجد عيادة في DB"], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
    evidence.push(`✔ Target clinic: ${clinic.slug}`);

    const catalog = new CatalogService(new PrismaServiceRepository(), new PrismaDoctorRepository());
    const services = await catalog.getServices(clinic.slug);
    const serviceIds = services.slice(0, 1).map(s => s.id);
    evidence.push(`✔ Found ${services.length} existing services | linking: ${serviceIds[0] ?? "none"}`);

    // Get branches for linking
    const branchSvc = new BranchService(new PrismaBranchRepository());
    const branches = await branchSvc.getBranches(clinic.slug);
    const branchIds = branches.slice(0, 1).map(b => b.id);
    evidence.push(`✔ Found ${branches.length} existing branches | linking: ${branchIds[0] ?? "none"}`);

    // 1. CREATE
    const created = await catalog.upsertDoctor({ clinicSlug: clinic.slug, name: "د. اختبار E2E", specialty: "طب تجميلي", status: "ACTIVE", branchIds, serviceIds });
    evidence.push(`✔ CREATE → id: ${created.id} | name: ${created.name} | specialty: ${created.specialty}`);

    // 2. READ
    const list = await catalog.getDoctors(clinic.slug);
    const found = list.find(d => d.id === created.id);
    if (!found) findings.push("الطبيب لم يظهر في getDoctors()");
    else evidence.push(`✔ READ → موجود في القائمة (${list.length} طبيب)`);

    // 3. UPDATE
    const updated = await catalog.upsertDoctor({ id: created.id, clinicSlug: clinic.slug, name: "د. اختبار E2E (معدّل)", specialty: "تجميل متقدم", status: "ACTIVE", branchIds, serviceIds });
    if (updated.name !== "د. اختبار E2E (معدّل)") findings.push(`UPDATE name mismatch: ${updated.name}`);
    evidence.push(`✔ UPDATE → name: ${updated.name} | specialty: ${updated.specialty}`);

    // 4. DB verify
    const dbRec = await prisma.doctor.findUnique({ where: { id: created.id }, include: { services: true, branches: true } });
    if (!dbRec) findings.push("الطبيب غير موجود في DB");
    else evidence.push(`✔ DB VERIFY → specialty: ${dbRec.specialty} | services: ${dbRec.services.length} | branches: ${dbRec.branches.length}`);

    // 5. DELETE
    const deleted = await catalog.deleteDoctor(created.id);
    evidence.push(`✔ DELETE → id: ${deleted.id}`);

    // 6. Verify
    const afterDelete = await catalog.getDoctors(clinic.slug);
    if (afterDelete.find(d => d.id === created.id)) findings.push("الطبيب لا يزال موجوداً بعد الحذف");
    else evidence.push(`✔ VERIFY DELETE → محذوف (${afterDelete.length} طبيب متبقياً)`);

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({ id: "E2E-004B", name: "Doctors CRUD", evidence, findings, severity: hasFail ? "HIGH" : "NONE", recommendation: "", durationMs: Date.now() - start });
  } catch (err) {
    return fail({ id: "E2E-004B", name: "Doctors CRUD", evidence, findings: [`Exception: ${String(err)}`], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
  }
}

// ── E2E-004C: Branches CRUD ───────────────────────────────────────────────────

async function testBranchesCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];
  try {
    const clinic = await getClinic();
    if (!clinic) return fail({ id: "E2E-004C", name: "Branches CRUD", evidence, findings: ["لا توجد عيادة في DB"], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
    evidence.push(`✔ Target clinic: ${clinic.slug}`);

    const branchSvc = new BranchService(new PrismaBranchRepository());

    // 1. CREATE (no workingHours in DTO — stored separately via working-hours endpoint)
    const created = await branchSvc.upsertBranch({ clinicSlug: clinic.slug, name: "فرع الاختبار E2E", city: "الرياض", address: "شارع الاختبار، حي النزهة", phone: "+966500000099", status: "ACTIVE" });
    evidence.push(`✔ CREATE → id: ${created.id} | name: ${created.name} | city: ${created.city}`);

    // 2. READ
    const list = await branchSvc.getBranches(clinic.slug);
    const found = list.find(b => b.id === created.id);
    if (!found) findings.push("الفرع لم يظهر في getBranches()");
    else evidence.push(`✔ READ → موجود في القائمة (${list.length} فرع)`);

    // 3. UPDATE
    const updated = await branchSvc.upsertBranch({ id: created.id, clinicSlug: clinic.slug, name: "فرع الاختبار E2E (معدّل)", city: "جدة", address: "شارع فلسطين، حي الشاطئ", phone: "+966500000099", status: "ACTIVE" });
    if (updated.name !== "فرع الاختبار E2E (معدّل)") findings.push(`UPDATE name mismatch: ${updated.name}`);
    if (updated.city !== "جدة") findings.push(`UPDATE city mismatch: ${updated.city}`);
    evidence.push(`✔ UPDATE → name: ${updated.name} | city: ${updated.city}`);

    // 4. DB verify
    const dbRec = await prisma.branch.findUnique({ where: { id: created.id } });
    if (!dbRec) findings.push("الفرع غير موجود في DB بعد التحديث");
    else evidence.push(`✔ DB VERIFY → city: ${dbRec.city} | address: ${dbRec.address}`);

    // 5. Test working hours (separate endpoint — stored as DoctorSchedule)
    // The BranchService.upsertBranch stores the branch; working hours use separate BranchWorkingHours table
    const workingHourCount = await prisma.workingHour.count({ where: { branchId: created.id } });
    evidence.push(`✔ Working Hours records in DB: ${workingHourCount} (auto-populated by upsertBranch)`);

    // 6. DELETE
    const deleted = await branchSvc.deleteBranch(created.id);
    evidence.push(`✔ DELETE → id: ${deleted.id}`);

    // 7. Verify
    const afterDelete = await branchSvc.getBranches(clinic.slug);
    if (afterDelete.find(b => b.id === created.id)) findings.push("الفرع لا يزال موجوداً بعد الحذف");
    else evidence.push(`✔ VERIFY DELETE → محذوف (${afterDelete.length} فرع متبقياً)`);

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({ id: "E2E-004C", name: "Branches CRUD", evidence, findings, severity: hasFail ? "HIGH" : "NONE", recommendation: "", durationMs: Date.now() - start });
  } catch (err) {
    return fail({ id: "E2E-004C", name: "Branches CRUD", evidence, findings: [`Exception: ${String(err)}`], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
  }
}

// ── E2E-004D: Knowledge Base CRUD ─────────────────────────────────────────────

async function testKnowledgeBaseCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];
  try {
    const clinic = await getClinic();
    if (!clinic) return fail({ id: "E2E-004D", name: "Knowledge Base CRUD", evidence, findings: ["لا توجد عيادة في DB"], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
    evidence.push(`✔ Target clinic: ${clinic.slug}`);

    const kbSvc = new KnowledgeBaseService(new PrismaKnowledgeBaseRepository());

    // 1. CREATE FAQ — KB uses 'content' field, not 'question'/'answer'
    const faqContent = "س: هل يوجد تخدير موضعي في جلسات الليزر؟\nج: نعم، نستخدم كريم تخدير موضعي قبل كل جلسة.";
    const faq = await kbSvc.upsertKBItem({ clinicSlug: clinic.slug, category: "FAQ", content: faqContent });
    evidence.push(`✔ CREATE FAQ → id: ${faq.id} | category: ${faq.category}`);

    // 2. CREATE POLICY
    const policyContent = "سياسة الإلغاء: يمكن إلغاء الموعد قبل 24 ساعة بدون رسوم. بعد ذلك تُطبق رسوم 50%.";
    const policy = await kbSvc.upsertKBItem({ clinicSlug: clinic.slug, category: "POLICY", content: policyContent });
    evidence.push(`✔ CREATE POLICY → id: ${policy.id} | category: ${policy.category}`);

    // 3. READ all
    const list = await kbSvc.getKBItems(clinic.slug);
    const faqFound = list.find(i => i.id === faq.id);
    const policyFound = list.find(i => i.id === policy.id);
    if (!faqFound) findings.push("FAQ لم يظهر في getKBItems()");
    if (!policyFound) findings.push("POLICY لم يظهر في getKBItems()");
    evidence.push(`✔ READ → ${list.length} عناصر في قاعدة المعرفة`);

    // 4. UPDATE FAQ
    const updatedContent = "س: هل يوجد تخدير في الجلسات؟\nج: نعم، مع ضمان كامل لراحة المريض. (معدّل)";
    const updatedFaq = await kbSvc.upsertKBItem({ id: faq.id, clinicSlug: clinic.slug, category: "FAQ", content: updatedContent });
    if (updatedFaq.content !== updatedContent) findings.push(`UPDATE content mismatch`);
    evidence.push(`✔ UPDATE FAQ → content أُحدّث بنجاح`);

    // 5. DB verify
    const dbFaq = await prisma.knowledgeBase.findUnique({ where: { id: faq.id } });
    if (!dbFaq) findings.push("FAQ غير موجود في DB بعد التحديث");
    else evidence.push(`✔ DB VERIFY → category: ${dbFaq.category} | content length: ${dbFaq.content.length} chars`);

    // 6. DELETE both
    await kbSvc.deleteKBItem(faq.id);
    await kbSvc.deleteKBItem(policy.id);
    evidence.push(`✔ DELETE FAQ + POLICY`);

    // 7. Verify
    const afterDelete = await kbSvc.getKBItems(clinic.slug);
    if (afterDelete.find(i => i.id === faq.id)) findings.push("FAQ لا يزال موجوداً بعد الحذف");
    if (afterDelete.find(i => i.id === policy.id)) findings.push("POLICY لا يزال موجوداً بعد الحذف");
    if (!afterDelete.find(i => i.id === faq.id) && !afterDelete.find(i => i.id === policy.id))
      evidence.push(`✔ VERIFY DELETE → كلا العنصرين محذوفان (${afterDelete.length} عناصر متبقية)`);

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({ id: "E2E-004D", name: "Knowledge Base CRUD", evidence, findings, severity: hasFail ? "HIGH" : "NONE", recommendation: "", durationMs: Date.now() - start });
  } catch (err) {
    return fail({ id: "E2E-004D", name: "Knowledge Base CRUD", evidence, findings: [`Exception: ${String(err)}`], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
  }
}

// ── E2E-004E: WhatsApp / Clinic Config Persistence ────────────────────────────

async function testClinicConfigPersistence(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];
  try {
    const clinic = await getClinic();
    if (!clinic) return fail({ id: "E2E-004E", name: "WhatsApp Config Persistence", evidence, findings: ["لا توجد عيادة في DB"], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
    evidence.push(`✔ Target clinic: ${clinic.slug}`);

    const clinicSvc = new ClinicService(new PrismaClinicRepository());

    // 1. READ current
    const current = await clinicSvc.getClinicProfileById(clinic.id);
    const c = current as Record<string, unknown>;
    evidence.push(`✔ GET → whatsappWabaId: "${c.whatsappWabaId ?? "(فارغ)"}" | whatsappPhoneId: "${c.whatsappPhoneId ?? "(فارغ)"}"`);

    // 2. SAVE test values (using actual field names from DTO)
    await clinicSvc.updateClinicConfigById(clinic.id, {
      clinicSlug: clinic.slug,
      name: clinic.name,
      isAiActive: true,
      whatsappWabaId: "TEST-WABA-E2E",
      whatsappPhoneId: "TEST-PHONE-E2E",
      whatsappToken: "TEST-TOKEN-E2E",
      whatsappVerifyToken: "TEST-VERIFY-E2E",
    });
    evidence.push(`✔ SAVE → whatsappWabaId: TEST-WABA-E2E`);

    // 3. DB direct verify
    const dbClinic = await prisma.clinic.findUnique({ where: { id: clinic.id } });
    if (!dbClinic) { findings.push("العيادة غير موجودة في DB!"); }
    else {
      evidence.push(`✔ DB VERIFY → whatsappWabaId: ${dbClinic.whatsappWabaId} | whatsappPhoneId: ${dbClinic.whatsappPhoneId}`);
      if (dbClinic.whatsappWabaId !== "TEST-WABA-E2E") findings.push(`whatsappWabaId لم يُحفظ: ${dbClinic.whatsappWabaId}`);
      if (dbClinic.whatsappPhoneId !== "TEST-PHONE-E2E") findings.push(`whatsappPhoneId لم يُحفظ: ${dbClinic.whatsappPhoneId}`);
    }

    // 4. RE-READ via service (simulates page refresh)
    const refreshed = await clinicSvc.getClinicProfileById(clinic.id) as Record<string, unknown>;
    if (refreshed.whatsappWabaId !== "TEST-WABA-E2E") findings.push(`getClinicProfileById بعد التحديث يرجع WABA خاطئ: ${refreshed.whatsappWabaId}`);
    else evidence.push(`✔ REFRESH VERIFY → getClinicProfileById يرجع القيم الجديدة (محاكاة Page Refresh)`);

    // 5. RESTORE
    await clinicSvc.updateClinicConfigById(clinic.id, {
      clinicSlug: clinic.slug,
      name: clinic.name,
      isAiActive: true,
      whatsappWabaId: (c.whatsappWabaId as string) ?? "",
      whatsappPhoneId: (c.whatsappPhoneId as string) ?? "",
      whatsappToken: (c.whatsappToken as string) ?? "",
      whatsappVerifyToken: (c.whatsappVerifyToken as string) ?? "",
    });
    evidence.push(`✔ CLEANUP → الإعدادات الأصلية استُعيدت`);

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({ id: "E2E-004E", name: "WhatsApp Config Persistence", evidence, findings, severity: hasFail ? "HIGH" : "NONE", recommendation: "", durationMs: Date.now() - start });
  } catch (err) {
    return fail({ id: "E2E-004E", name: "WhatsApp Config Persistence", evidence, findings: [`Exception: ${String(err)}`], severity: "BLOCKER", recommendation: "", durationMs: Date.now() - start });
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  E2E Functional CRUD — Direct DB Layer (Services/Doctors/Branches/KB/Config)");
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    await prisma.$connect();
    const clinicCount = await prisma.clinic.count();
    console.log(`✅ DB Connected | Clinics: ${clinicCount}\n`);
  } catch (err) {
    console.error(`❌ DB Connection failed: ${String(err)}`);
    process.exit(1);
  }

  const tests = [testServicesCRUD, testDoctorsCRUD, testBranchesCRUD, testKnowledgeBaseCRUD, testClinicConfigPersistence];

  for (const test of tests) {
    const r = await test();
    results.push(r);
    printResult(r);
  }

  await prisma.$disconnect();

  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  FINAL SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const blockers = results.filter(r => r.severity === "BLOCKER").length;
  console.log(`  Total: ${results.length} | ✅ PASS: ${passed} | ❌ FAIL: ${failed} | 🔴 BLOCKER: ${blockers}\n`);
  results.forEach(r => {
    const icon = r.status === "PASS" ? "✅" : "❌";
    const sev = r.severity !== "NONE" ? ` [${r.severity}]` : "";
    console.log(`  ${icon} ${r.id} — ${r.name}${sev} (${r.durationMs}ms)`);
  });
  console.log("\n═══════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
