import { prisma } from "../src/lib/db";
import { ConversationEngine } from "../src/lib/domain/ConversationEngine";
import { extractSaudiPhone } from "../src/lib/domain/types";
import crypto from "crypto";

async function runFrictionlessTests() {
  console.log("\n======================================================");
  console.log(" FRICTIONLESS BOOKING VERIFICATION TESTS");
  console.log("======================================================\n");

  const clinic = await prisma.clinic.findFirst({
    include: {
      branches: { where: { status: "ACTIVE" } },
      doctors: { where: { status: "ACTIVE" } },
      services: { where: { status: "ACTIVE" } },
    },
  });

  if (!clinic) {
    console.error("No clinic found in DB.");
    process.exit(1);
  }

  const TEST_PHONE = "+966500000002";
  const TESTS_PASSED: string[] = [];
  const TESTS_FAILED: string[] = [];

  function pass(id: string, msg: string) {
    TESTS_PASSED.push(id);
    console.log("[PASS] " + id + " — " + msg);
  }
  function fail(id: string, msg: string) {
    TESTS_FAILED.push(id);
    console.error("[FAIL] " + id + " — " + msg);
  }

  // Clear previous runs
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: { in: [TEST_PHONE] } } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });

  // ─── FT1: Verify contactPhone defaults to conversation sender phone ───────
  console.log("[FT1] Testing default contactPhone fallback...");
  // Standard booking flow using official branch name "فرع الصحافة"
  await ConversationEngine.processMessage(
    clinic, 
    TEST_PHONE, 
    "أبغى أحجز تنظيف البشرة العميق باسم سارة العلي في فرع الصحافة يوم الأحد الساعة 10 صباحاً مع د. سحر", 
    "Simulator", 
    crypto.randomUUID()
  );

  const booking1 = await prisma.booking.findFirst({
    where: { clinicId: clinic.id, clientName: "سارة العلي" },
  });

  if (booking1 && booking1.clientPhone === TEST_PHONE) {
    pass("FT1-DEFAULT-PHONE", "Booking contactPhone matches sender WhatsApp phone: " + booking1.clientPhone);
  } else {
    fail("FT1-DEFAULT-PHONE", "Expected booking contactPhone " + TEST_PHONE + ". Got: " + (booking1?.clientPhone || "null"));
  }

  // ─── FT2: Verify custom contact phone override ──────────────────────────────
  console.log("\n[FT2] Testing custom contactPhone override...");
  const SENDER_PHONE = "+966500000009";
  const CUSTOM_PHONE = "+966551234567";

  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: { in: [SENDER_PHONE, CUSTOM_PHONE] } } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: SENDER_PHONE } });

  await ConversationEngine.processMessage(
    clinic, 
    SENDER_PHONE, 
    "أبغى أحجز تنظيف البشرة العميق باسم ياسمين ورقم التواصل 0551234567 في فرع الصحافة الأحد الساعة 11 صباحاً مع د. سحر", 
    "Simulator", 
    crypto.randomUUID()
  );

  const booking2 = await prisma.booking.findFirst({
    where: { clinicId: clinic.id, clientName: "ياسمين" },
  });

  const toLocalFormat = (p: string | null | undefined) => {
    if (!p) return "";
    const clean = p.replace(/[\s-+]/g, "");
    if (clean.startsWith("966")) {
      return "0" + clean.slice(3);
    }
    return clean;
  };

  const normalizedStored = toLocalFormat(booking2?.clientPhone);
  const normalizedExpected = toLocalFormat(CUSTOM_PHONE);

  if (booking2 && normalizedStored === normalizedExpected) {
    pass("FT2-CUSTOM-OVERRIDE", "Booking contactPhone successfully updated to custom phone: " + booking2.clientPhone);
  } else {
    fail("FT2-CUSTOM-OVERRIDE", "Expected custom contactPhone " + CUSTOM_PHONE + ". Got: " + (booking2?.clientPhone || "null"));
  }

  // ─── FT3: Verify zero-friction message for booking on behalf of others ───────
  console.log("\n[FT3] Testing zero-friction message response when booking for others...");
  const SENDER_PHONE_3 = "+966500000099";
  
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: SENDER_PHONE_3 } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: SENDER_PHONE_3 } });

  // Book for wife without giving a phone number explicitly, using official branch and doctor
  const response = await ConversationEngine.processMessage(
    clinic, 
    SENDER_PHONE_3, 
    "أبغى أحجز لزوجتي ريما، والاسم ريما، تنظيف البشرة العميق في فرع الصحافة الأحد الساعة 12 ظهراً مع د. سحر", 
    "Simulator", 
    crypto.randomUUID()
  );

  if (response && response.response.includes("سأتواصل مع زوجتك على نفس رقم الواتساب الحالي")) {
    pass("FT3-ZERO-FRICTION-MSG", "System appended zero-friction contact notice for wife's booking");
  } else {
    fail("FT3-ZERO-FRICTION-MSG", "Missing zero-friction contact notice in response: " + response?.response);
  }

  // Clean up
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: { in: [TEST_PHONE, SENDER_PHONE, CUSTOM_PHONE, SENDER_PHONE_3] } } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: { in: [TEST_PHONE, SENDER_PHONE, SENDER_PHONE_3] } } });

  console.log("\n======================================================");
  console.log(` RESULTS: ${TESTS_PASSED.length} PASS / ${TESTS_FAILED.length} FAIL`);
  if (TESTS_FAILED.length > 0) {
    process.exit(1);
  } else {
    console.log(" ALL FRICTIONLESS BOOKING TESTS PASSED ✅");
    process.exit(0);
  }
}

runFrictionlessTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
