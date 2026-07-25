/**
 * E2E Functional CRUD Test Suite
 * Covers: E2E-004A (Services), E2E-004B (Doctors), E2E-004C (Branches), E2E-004D (Knowledge Base)
 *
 * This script runs against the LIVE server on localhost:3000.
 * It tests CREATE, READ, UPDATE, DELETE for each entity and verifies DB persistence.
 *
 * Run: npx ts-node --project tsconfig.scripts.json scripts/e2e-crud.ts
 */

const BASE = "http://localhost:3000";

// ─── Helpers ────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

interface TestResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  evidence: string[];
  findings: string[];
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";
  recommendation: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function api(method: HttpMethod, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function pass(result: Omit<TestResult, "status">): TestResult {
  return { ...result, status: "PASS" };
}

function fail(result: Omit<TestResult, "status">): TestResult {
  return { ...result, status: "FAIL" };
}

function printResult(r: TestResult) {
  const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏸️";
  console.log(`\n${icon} ${r.id} — ${r.name} [${r.durationMs}ms]`);
  console.log(`   Status: ${r.status}`);
  if (r.evidence.length) {
    console.log("   Evidence:");
    r.evidence.forEach((e) => console.log(`     - ${e}`));
  }
  if (r.findings.length) {
    console.log("   Findings:");
    r.findings.forEach((f) => console.log(`     ⚠️  ${f}`));
  }
  if (r.severity !== "NONE") console.log(`   Severity: ${r.severity}`);
  if (r.recommendation) console.log(`   Recommendation: ${r.recommendation}`);
}

// ─── E2E-004A: Services CRUD ─────────────────────────────────────────────────

async function testServicesCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];

  try {
    // 1. CREATE
    const createRes = await api("POST", "/api/clinic/services", {
      name: "جلسة ليزر E2E",
      price: 750,
      description: "اختبار آلي للخدمة",
      durationMinutes: 45,
      status: "ACTIVE",
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
      return fail({
        id: "E2E-004A",
        name: "Services CRUD",
        evidence: [`POST /api/clinic/services → HTTP ${createRes.status}`, `Body: ${JSON.stringify(createRes.data)}`],
        findings: ["CREATE فشل — لا يمكن الاستمرار"],
        severity: "BLOCKER",
        recommendation: "تحقق من الـ schema validation وأن الـ clinic موجودة في DB",
        durationMs: Date.now() - start,
      });
    }

    const createdService = createRes.data as { id: string; name: string; price: number; status: string };
    evidence.push(`✔ CREATE → HTTP ${createRes.status} | id: ${createdService.id} | name: ${createdService.name}`);

    // 2. READ (verify it exists)
    const listRes = await api("GET", "/api/clinic/services");
    const services = listRes.data as { id: string; name: string }[];
    const found = Array.isArray(services) && services.find((s) => s.id === createdService.id);

    if (!found) {
      findings.push("الخدمة لم تظهر في قائمة GET بعد الإنشاء — مشكلة في Persistence");
    } else {
      evidence.push(`✔ READ → HTTP ${listRes.status} | الخدمة موجودة في القائمة (${services.length} خدمة)`);
    }

    // 3. UPDATE (edit)
    const updateRes = await api("POST", "/api/clinic/services", {
      id: createdService.id,
      name: "جلسة ليزر E2E (معدّلة)",
      price: 900,
      description: "تم التعديل بنجاح",
      durationMinutes: 60,
      status: "ACTIVE",
    });

    if (updateRes.status !== 200) {
      findings.push(`UPDATE → HTTP ${updateRes.status} — التعديل فشل`);
    } else {
      const updated = updateRes.data as { name: string; price: number };
      evidence.push(`✔ UPDATE → HTTP ${updateRes.status} | الاسم الجديد: ${updated.name} | السعر: ${updated.price}`);
      if (updated.name !== "جلسة ليزر E2E (معدّلة)") {
        findings.push("اسم الخدمة لم يُحدَّث في الاستجابة");
      }
      if (updated.price !== 900) {
        findings.push("سعر الخدمة لم يُحدَّث في الاستجابة");
      }
    }

    // 4. DELETE
    const deleteRes = await api("DELETE", `/api/clinic/services?serviceId=${createdService.id}`);
    if (deleteRes.status !== 200) {
      findings.push(`DELETE → HTTP ${deleteRes.status} — الحذف فشل`);
    } else {
      evidence.push(`✔ DELETE → HTTP ${deleteRes.status}`);
    }

    // 5. Verify deletion (should not exist anymore)
    const listAfterDelete = await api("GET", "/api/clinic/services");
    const servicesAfter = listAfterDelete.data as { id: string }[];
    const stillExists = Array.isArray(servicesAfter) && servicesAfter.find((s) => s.id === createdService.id);
    if (stillExists) {
      findings.push("الخدمة لا تزال موجودة في القائمة بعد الحذف — مشكلة في DELETE");
    } else {
      evidence.push(`✔ VERIFY DELETE → الخدمة غير موجودة بعد الحذف (${servicesAfter.length} خدمة)`);
    }

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({
      id: "E2E-004A",
      name: "Services CRUD",
      evidence,
      findings,
      severity: hasFail ? "HIGH" : "NONE",
      recommendation: hasFail ? "مراجعة الـ findings أعلاه وإصلاح المشكلات" : "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return fail({
      id: "E2E-004A",
      name: "Services CRUD",
      evidence,
      findings: [`Exception: ${String(err)}`],
      severity: "BLOCKER",
      recommendation: "تأكد أن السيرفر يعمل على localhost:3000",
      durationMs: Date.now() - start,
    });
  }
}

// ─── E2E-004B: Doctors CRUD ───────────────────────────────────────────────────

async function testDoctorsCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];

  try {
    // CREATE
    const createRes = await api("POST", "/api/clinic/doctors", {
      name: "د. اختبار E2E",
      specialty: "طب تجميلي",
      status: "ACTIVE",
      serviceIds: [],
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
      return fail({
        id: "E2E-004B",
        name: "Doctors CRUD",
        evidence: [`POST /api/clinic/doctors → HTTP ${createRes.status}`, `Body: ${JSON.stringify(createRes.data)}`],
        findings: ["CREATE فشل — لا يمكن الاستمرار"],
        severity: "BLOCKER",
        recommendation: "تحقق من UpsertDoctorSchema وأن الـ clinic موجودة",
        durationMs: Date.now() - start,
      });
    }

    const doctor = createRes.data as { id: string; name: string; specialty: string };
    evidence.push(`✔ CREATE → HTTP ${createRes.status} | id: ${doctor.id} | name: ${doctor.name}`);

    // READ
    const listRes = await api("GET", "/api/clinic/doctors");
    const doctors = listRes.data as { id: string }[];
    const found = Array.isArray(doctors) && doctors.find((d) => d.id === doctor.id);
    if (!found) {
      findings.push("الطبيب لم يظهر في GET بعد الإنشاء");
    } else {
      evidence.push(`✔ READ → HTTP ${listRes.status} | الطبيب موجود في القائمة (${doctors.length} طبيب)`);
    }

    // UPDATE
    const updateRes = await api("POST", "/api/clinic/doctors", {
      id: doctor.id,
      name: "د. اختبار E2E (معدّل)",
      specialty: "تجميل متقدم",
      status: "ACTIVE",
      serviceIds: [],
    });

    if (updateRes.status !== 200) {
      findings.push(`UPDATE → HTTP ${updateRes.status} — التعديل فشل`);
    } else {
      const updated = updateRes.data as { name: string };
      evidence.push(`✔ UPDATE → HTTP ${updateRes.status} | الاسم الجديد: ${updated.name}`);
    }

    // DELETE
    const deleteRes = await api("DELETE", `/api/clinic/doctors?doctorId=${doctor.id}`);
    if (deleteRes.status !== 200) {
      findings.push(`DELETE → HTTP ${deleteRes.status} — الحذف فشل`);
    } else {
      evidence.push(`✔ DELETE → HTTP ${deleteRes.status}`);
    }

    // VERIFY
    const listAfter = await api("GET", "/api/clinic/doctors");
    const doctorsAfter = listAfter.data as { id: string }[];
    const stillExists = Array.isArray(doctorsAfter) && doctorsAfter.find((d) => d.id === doctor.id);
    if (stillExists) {
      findings.push("الطبيب لا يزال موجوداً بعد الحذف");
    } else {
      evidence.push(`✔ VERIFY DELETE → الطبيب محذوف (${doctorsAfter.length} طبيب)`);
    }

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({
      id: "E2E-004B",
      name: "Doctors CRUD",
      evidence,
      findings,
      severity: hasFail ? "HIGH" : "NONE",
      recommendation: hasFail ? "مراجعة الـ findings" : "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return fail({
      id: "E2E-004B",
      name: "Doctors CRUD",
      evidence,
      findings: [`Exception: ${String(err)}`],
      severity: "BLOCKER",
      recommendation: "تأكد أن السيرفر يعمل",
      durationMs: Date.now() - start,
    });
  }
}

// ─── E2E-004C: Branches CRUD ──────────────────────────────────────────────────

async function testBranchesCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];

  try {
    // CREATE
    const createRes = await api("POST", "/api/clinic/branches", {
      name: "فرع الاختبار E2E",
      address: "شارع الاختبار، الرياض",
      phone: "+966500000001",
      workingHours: {
        Saturday: { open: "09:00", close: "17:00", isOpen: true },
        Sunday: { open: "09:00", close: "17:00", isOpen: true },
        Monday: { open: "09:00", close: "17:00", isOpen: true },
        Tuesday: { open: "09:00", close: "17:00", isOpen: true },
        Wednesday: { open: "09:00", close: "17:00", isOpen: true },
        Thursday: { open: "09:00", close: "17:00", isOpen: true },
        Friday: { open: "00:00", close: "00:00", isOpen: false },
      },
    });

    if (createRes.status !== 200 && createRes.status !== 201) {
      return fail({
        id: "E2E-004C",
        name: "Branches CRUD",
        evidence: [`POST /api/clinic/branches → HTTP ${createRes.status}`, `Body: ${JSON.stringify(createRes.data)}`],
        findings: ["CREATE فشل — لا يمكن الاستمرار"],
        severity: "BLOCKER",
        recommendation: "تحقق من UpsertBranchSchema",
        durationMs: Date.now() - start,
      });
    }

    const branch = createRes.data as { id: string; name: string };
    evidence.push(`✔ CREATE → HTTP ${createRes.status} | id: ${branch.id} | name: ${branch.name}`);

    // READ
    const listRes = await api("GET", "/api/clinic/branches");
    const branches = listRes.data as { id: string }[];
    const found = Array.isArray(branches) && branches.find((b) => b.id === branch.id);
    if (!found) {
      findings.push("الفرع لم يظهر في GET بعد الإنشاء");
    } else {
      evidence.push(`✔ READ → HTTP ${listRes.status} | الفرع موجود (${branches.length} فرع)`);
    }

    // UPDATE — change working hours (Friday becomes open)
    const updateRes = await api("POST", "/api/clinic/branches", {
      id: branch.id,
      name: "فرع الاختبار E2E (معدّل)",
      address: "شارع جديد، الرياض",
      phone: "+966500000002",
      workingHours: {
        Saturday: { open: "10:00", close: "18:00", isOpen: true },
        Sunday: { open: "10:00", close: "18:00", isOpen: true },
        Monday: { open: "10:00", close: "18:00", isOpen: true },
        Tuesday: { open: "10:00", close: "18:00", isOpen: true },
        Wednesday: { open: "10:00", close: "18:00", isOpen: true },
        Thursday: { open: "10:00", close: "18:00", isOpen: true },
        Friday: { open: "14:00", close: "20:00", isOpen: true },
      },
    });

    if (updateRes.status !== 200) {
      findings.push(`UPDATE → HTTP ${updateRes.status} — التعديل فشل`);
    } else {
      const updated = updateRes.data as { name: string };
      evidence.push(`✔ UPDATE → HTTP ${updateRes.status} | الاسم الجديد: ${updated.name}`);
    }

    // DELETE
    const deleteRes = await api("DELETE", `/api/clinic/branches?branchId=${branch.id}`);
    if (deleteRes.status !== 200) {
      findings.push(`DELETE → HTTP ${deleteRes.status} — الحذف فشل`);
    } else {
      evidence.push(`✔ DELETE → HTTP ${deleteRes.status}`);
    }

    // VERIFY
    const listAfter = await api("GET", "/api/clinic/branches");
    const branchesAfter = listAfter.data as { id: string }[];
    const stillExists = Array.isArray(branchesAfter) && branchesAfter.find((b) => b.id === branch.id);
    if (stillExists) {
      findings.push("الفرع لا يزال موجوداً بعد الحذف");
    } else {
      evidence.push(`✔ VERIFY DELETE → الفرع محذوف (${branchesAfter.length} فرع)`);
    }

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({
      id: "E2E-004C",
      name: "Branches CRUD",
      evidence,
      findings,
      severity: hasFail ? "HIGH" : "NONE",
      recommendation: hasFail ? "مراجعة الـ findings" : "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return fail({
      id: "E2E-004C",
      name: "Branches CRUD",
      evidence,
      findings: [`Exception: ${String(err)}`],
      severity: "BLOCKER",
      recommendation: "تأكد أن السيرفر يعمل",
      durationMs: Date.now() - start,
    });
  }
}

// ─── E2E-004D: Knowledge Base CRUD ───────────────────────────────────────────

async function testKnowledgeBaseCRUD(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];

  try {
    // CREATE — FAQ item
    const createFaqRes = await api("POST", "/api/clinic/kb", {
      question: "هل يوجد تخدير موضعي في جلسات الليزر؟",
      answer: "نعم، نستخدم كريم تخدير موضعي قبل كل جلسة لضمان راحتك.",
      category: "FAQ",
    });

    if (createFaqRes.status !== 200 && createFaqRes.status !== 201) {
      return fail({
        id: "E2E-004D",
        name: "Knowledge Base CRUD",
        evidence: [`POST /api/clinic/kb → HTTP ${createFaqRes.status}`, `Body: ${JSON.stringify(createFaqRes.data)}`],
        findings: ["CREATE FAQ فشل — لا يمكن الاستمرار"],
        severity: "BLOCKER",
        recommendation: "تحقق من UpsertKbSchema وأن category مقبولة",
        durationMs: Date.now() - start,
      });
    }

    const faqItem = createFaqRes.data as { id: string; question: string; category: string };
    evidence.push(`✔ CREATE FAQ → HTTP ${createFaqRes.status} | id: ${faqItem.id} | category: ${faqItem.category}`);

    // CREATE — Document/Policy item
    const createDocRes = await api("POST", "/api/clinic/kb", {
      question: "سياسة الإلغاء",
      answer: "يمكن إلغاء الموعد قبل 24 ساعة بدون رسوم. ما بعد 24 ساعة تُطبق رسوم إلغاء 50%.",
      category: "POLICY",
    });

    if (createDocRes.status === 200 || createDocRes.status === 201) {
      const docItem = createDocRes.data as { id: string; category: string };
      evidence.push(`✔ CREATE POLICY → HTTP ${createDocRes.status} | id: ${docItem.id} | category: ${docItem.category}`);

      // DELETE the policy item
      const deleteDocRes = await api("DELETE", `/api/clinic/kb?kbId=${docItem.id}`);
      if (deleteDocRes.status !== 200) {
        findings.push(`DELETE POLICY → HTTP ${deleteDocRes.status} — الحذف فشل`);
      } else {
        evidence.push(`✔ DELETE POLICY → HTTP ${deleteDocRes.status}`);
      }
    } else {
      findings.push(`CREATE POLICY → HTTP ${createDocRes.status} — Body: ${JSON.stringify(createDocRes.data)}`);
    }

    // READ all KB items
    const listRes = await api("GET", "/api/clinic/kb");
    const items = listRes.data as { id: string; category: string }[];
    const faqFound = Array.isArray(items) && items.find((i) => i.id === faqItem.id);
    if (!faqFound) {
      findings.push("عنصر FAQ لم يظهر في GET بعد الإنشاء");
    } else {
      evidence.push(`✔ READ → HTTP ${listRes.status} | ${items.length} عناصر في قاعدة المعرفة`);
    }

    // UPDATE the FAQ item
    const updateRes = await api("POST", "/api/clinic/kb", {
      id: faqItem.id,
      question: "هل يوجد تخدير موضعي في جلسات الليزر؟ (معدّل)",
      answer: "نعم، مع ضمان كامل لراحة المريض.",
      category: "FAQ",
    });

    if (updateRes.status !== 200) {
      findings.push(`UPDATE → HTTP ${updateRes.status} — التعديل فشل`);
    } else {
      const updated = updateRes.data as { question: string };
      evidence.push(`✔ UPDATE → HTTP ${updateRes.status} | السؤال: ${updated.question}`);
    }

    // DELETE FAQ
    const deleteFaqRes = await api("DELETE", `/api/clinic/kb?kbId=${faqItem.id}`);
    if (deleteFaqRes.status !== 200) {
      findings.push(`DELETE FAQ → HTTP ${deleteFaqRes.status}`);
    } else {
      evidence.push(`✔ DELETE FAQ → HTTP ${deleteFaqRes.status}`);
    }

    // VERIFY deletion
    const listAfter = await api("GET", "/api/clinic/kb");
    const itemsAfter = listAfter.data as { id: string }[];
    const stillExists = Array.isArray(itemsAfter) && itemsAfter.find((i) => i.id === faqItem.id);
    if (stillExists) {
      findings.push("عنصر FAQ لا يزال موجوداً بعد الحذف");
    } else {
      evidence.push(`✔ VERIFY DELETE → العنصر محذوف (${itemsAfter.length} عناصر)`);
    }

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({
      id: "E2E-004D",
      name: "Knowledge Base CRUD",
      evidence,
      findings,
      severity: hasFail ? "HIGH" : "NONE",
      recommendation: hasFail ? "مراجعة الـ findings وكذلك schema للـ category" : "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return fail({
      id: "E2E-004D",
      name: "Knowledge Base CRUD",
      evidence,
      findings: [`Exception: ${String(err)}`],
      severity: "BLOCKER",
      recommendation: "تأكد أن السيرفر يعمل",
      durationMs: Date.now() - start,
    });
  }
}

// ─── E2E-004E: WhatsApp Settings Persistence ────────────────────────────────

async function testWhatsAppSettings(): Promise<TestResult> {
  const start = Date.now();
  const evidence: string[] = [];
  const findings: string[] = [];

  try {
    // GET current config
    const getRes = await api("GET", "/api/clinic/config");
    if (getRes.status !== 200) {
      return fail({
        id: "E2E-004E",
        name: "WhatsApp Settings Persistence",
        evidence: [`GET /api/clinic/config → HTTP ${getRes.status}`],
        findings: ["لا يمكن قراءة إعدادات العيادة الحالية"],
        severity: "HIGH",
        recommendation: "تحقق من /api/clinic/config route",
        durationMs: Date.now() - start,
      });
    }

    const currentConfig = getRes.data as Record<string, unknown>;
    evidence.push(`✔ GET /api/clinic/config → HTTP ${getRes.status}`);
    evidence.push(`   Current wabaId: ${currentConfig.wabaId ?? "(فارغ)"}`);
    evidence.push(`   Current phoneNumberId: ${currentConfig.phoneNumberId ?? "(فارغ)"}`);

    // SAVE — update config with test values
    const saveRes = await api("POST", "/api/clinic/config", {
      wabaId: "TEST-WABA-E2E-001",
      phoneNumberId: "TEST-PHONE-E2E-001",
      accessToken: "TEST-TOKEN-E2E-001",
      webhookVerifyToken: "TEST-VERIFY-E2E-001",
      aiName: "جود E2E",
      aiPersonality: "ودية واحترافية",
    });

    if (saveRes.status !== 200) {
      findings.push(`POST /api/clinic/config → HTTP ${saveRes.status} — الحفظ فشل | Body: ${JSON.stringify(saveRes.data)}`);
    } else {
      evidence.push(`✔ SAVE config → HTTP ${saveRes.status}`);
    }

    // VERIFY persistence — re-fetch and compare
    const verifyRes = await api("GET", "/api/clinic/config");
    const newConfig = verifyRes.data as Record<string, unknown>;

    if (newConfig.wabaId !== "TEST-WABA-E2E-001") {
      findings.push(`wabaId لم يُحفظ: expected 'TEST-WABA-E2E-001', got '${newConfig.wabaId}'`);
    } else {
      evidence.push(`✔ VERIFY → wabaId محفوظ: ${newConfig.wabaId}`);
    }

    if (newConfig.phoneNumberId !== "TEST-PHONE-E2E-001") {
      findings.push(`phoneNumberId لم يُحفظ: expected 'TEST-PHONE-E2E-001', got '${newConfig.phoneNumberId}'`);
    } else {
      evidence.push(`✔ VERIFY → phoneNumberId محفوظ: ${newConfig.phoneNumberId}`);
    }

    // RESTORE original config (cleanup)
    if (saveRes.status === 200) {
      await api("POST", "/api/clinic/config", {
        wabaId: (currentConfig.wabaId as string) ?? "",
        phoneNumberId: (currentConfig.phoneNumberId as string) ?? "",
        accessToken: (currentConfig.accessToken as string) ?? "",
        webhookVerifyToken: (currentConfig.webhookVerifyToken as string) ?? "",
        aiName: (currentConfig.aiName as string) ?? "",
        aiPersonality: (currentConfig.aiPersonality as string) ?? "",
      });
      evidence.push(`✔ CLEANUP → إعادة الإعدادات الأصلية`);
    }

    const hasFail = findings.length > 0;
    return (hasFail ? fail : pass)({
      id: "E2E-004E",
      name: "WhatsApp Settings Persistence",
      evidence,
      findings,
      severity: hasFail ? "HIGH" : "NONE",
      recommendation: hasFail ? "مراجعة /api/clinic/config POST handler" : "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return fail({
      id: "E2E-004E",
      name: "WhatsApp Settings Persistence",
      evidence,
      findings: [`Exception: ${String(err)}`],
      severity: "BLOCKER",
      recommendation: "تأكد أن السيرفر يعمل وأن /api/clinic/config موجودة",
      durationMs: Date.now() - start,
    });
  }
}

// ─── MAIN RUNNER ─────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  E2E Functional CRUD Test Suite — Clinova");
  console.log(`  Target: ${BASE}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Health check first
  try {
    const health = await api("GET", "/api/health");
    if (health.status !== 200) {
      console.error(`❌ Server health check failed (HTTP ${health.status}). Aborting.`);
      process.exit(1);
    }
    console.log(`✅ Server is UP (HTTP ${health.status})\n`);
  } catch {
    console.error("❌ Cannot reach localhost:3000. Is the server running?\n   Run: npm run start\n");
    process.exit(1);
  }

  const tests = [
    testServicesCRUD,
    testDoctorsCRUD,
    testBranchesCRUD,
    testKnowledgeBaseCRUD,
    testWhatsAppSettings,
  ];

  for (const test of tests) {
    const result = await test();
    results.push(result);
    printResult(result);
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blockers = results.filter((r) => r.severity === "BLOCKER").length;

  console.log(`  Total:    ${results.length}`);
  console.log(`  ✅ PASS:  ${passed}`);
  console.log(`  ❌ FAIL:  ${failed}`);
  console.log(`  🔴 BLOCKERS: ${blockers}`);
  console.log("");

  results.forEach((r) => {
    const icon = r.status === "PASS" ? "✅" : "❌";
    const blocker = r.severity === "BLOCKER" ? " [BLOCKER]" : "";
    console.log(`  ${icon} ${r.id} — ${r.name}${blocker} (${r.durationMs}ms)`);
  });

  console.log("\n═══════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
