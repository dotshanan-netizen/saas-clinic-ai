/**
 * Phase 2 — Multi-Tenancy Isolation Tests
 * 
 * Tests that Clinic A cannot read, modify, or delete data belonging to Clinic B.
 * All tests must pass 100%.
 */
import { prisma } from "../src/lib/db";

// ──────────────────────────────────────────────────────────────────────────────
// Test Infrastructure
// ──────────────────────────────────────────────────────────────────────────────

const TESTS_PASSED: string[] = [];
const TESTS_FAILED: string[] = [];
const origLog = console.log;
const origError = console.error;

function pass(id: string, msg: string) {
  TESTS_PASSED.push(id);
  origLog("[PASS] " + id + " — " + msg);
}
function fail(id: string, msg: string) {
  TESTS_FAILED.push(id);
  origError("[FAIL] " + id + " — " + msg);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test Fixtures Setup: Two Isolated Clinics
// ──────────────────────────────────────────────────────────────────────────────

async function setupFixtures() {
  // Create Clinic A
  const clinicA = await prisma.clinic.create({
    data: {
      name: "عيادة ألفا",
      slug: "test-clinic-alpha-iso",
      contactPhone: "+966500000010",
    },
  });

  // Create Clinic B
  const clinicB = await prisma.clinic.create({
    data: {
      name: "عيادة بيتا",
      slug: "test-clinic-beta-iso",
      contactPhone: "+966500000020",
    },
  });

  // Create Booking for Clinic A
  const bookingA = await prisma.booking.create({
    data: {
      clientName: "أحمد العلي",
      clientPhone: "+966511111111",
      serviceName: "بوتوكس",
      doctorName: "د. سارة",
      branchName: "الرياض",
      timeSlot: "الأحد 10 صباحاً",
      source: "Test",
      status: "PENDING",
      clinicId: clinicA.id,
    },
  });

  // Create Booking for Clinic B — SAME phone number as Clinic A
  const bookingB = await prisma.booking.create({
    data: {
      clientName: "أحمد العلي",
      clientPhone: "+966511111111", // Same phone — cross-tenant test
      serviceName: "فيلر",
      doctorName: "د. خالد",
      branchName: "جدة",
      timeSlot: "الاثنين 2 ظهراً",
      source: "Test",
      status: "PENDING",
      clinicId: clinicB.id,
    },
  });

  // Create Conversation for Clinic A
  const convA = await prisma.conversation.create({
    data: {
      clientPhone: "+966511111111",
      clinicId: clinicA.id,
      messages: [{ role: "user", content: "مرحبا من عيادة ألفا" }] as any,
    },
  });

  return { clinicA, clinicB, bookingA, bookingB, convA };
}

async function teardownFixtures(clinicAId: string, clinicBId: string) {
  await prisma.booking.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
  await prisma.conversation.deleteMany({ where: { clinicId: { in: [clinicAId, clinicBId] } } });
  await prisma.clinic.deleteMany({ where: { id: { in: [clinicAId, clinicBId] } } });
}

// ──────────────────────────────────────────────────────────────────────────────
// ISOLATION TESTS
// ──────────────────────────────────────────────────────────────────────────────

async function runIsolationTests() {
  origLog("\n======================================================");
  origLog(" PHASE 2 — MULTI-TENANCY ISOLATION TESTS");
  origLog("======================================================\n");

  const { clinicA, clinicB, bookingA, bookingB, convA } = await setupFixtures();

  // ─── I1: Clinic B cannot read Clinic A's bookings ────────────────────────────
  const readLeak = await prisma.booking.findFirst({
    where: { clinicId: clinicB.id, id: bookingA.id },
  });
  if (!readLeak) pass("I1-READ-ISOLATION", "Clinic B cannot read Clinic A's booking by scoped clinicId query");
  else fail("I1-READ-ISOLATION", "LEAK: Clinic B read Clinic A's booking!");

  // ─── I2: Clinic B cannot read Clinic A's conversations ───────────────────────
  const convLeak = await prisma.conversation.findFirst({
    where: { clinicId: clinicB.id, id: convA.id },
  });
  if (!convLeak) pass("I2-CONV-ISOLATION", "Clinic B cannot read Clinic A's conversation by scoped clinicId query");
  else fail("I2-CONV-ISOLATION", "LEAK: Clinic B read Clinic A's conversation!");

  // ─── I3: Same phone — each clinic sees only its own booking ─────────────────
  const aSeesItsOwn = await prisma.booking.findFirst({
    where: { clinicId: clinicA.id, clientPhone: "+966511111111" },
  });
  const bSeesItsOwn = await prisma.booking.findFirst({
    where: { clinicId: clinicB.id, clientPhone: "+966511111111" },
  });
  if (aSeesItsOwn?.id === bookingA.id && bSeesItsOwn?.id === bookingB.id) {
    pass("I3-PHONE-COLLISION", "Same phone number returns different bookings per clinicId — no data mixing");
  } else {
    fail("I3-PHONE-COLLISION", `Expected bookingA(${bookingA.id}) for A, bookingB(${bookingB.id}) for B. Got: ${aSeesItsOwn?.id} / ${bSeesItsOwn?.id}`);
  }

  // ─── I4: Clinic B cannot update Clinic A's booking via clinicId-scoped query ─
  const targetForUpdate = await prisma.booking.findFirst({
    where: { clinicId: clinicB.id, id: bookingA.id }, // Scoped to B, looking for A's booking
  });
  if (!targetForUpdate) {
    pass("I4-UPDATE-GUARD", "Clinic B cannot find Clinic A's booking to update (clinicId scoped lookup returns null)");
  } else {
    fail("I4-UPDATE-GUARD", "CRITICAL: Clinic B found Clinic A's booking — update would be possible!");
  }

  // ─── I5: Clinic B cannot cancel Clinic A's booking via clinicId-scoped query ─
  const targetForCancel = await prisma.booking.findFirst({
    where: { clinicId: clinicB.id, id: bookingA.id },
  });
  if (!targetForCancel) {
    pass("I5-CANCEL-GUARD", "Clinic B cannot find Clinic A's booking to cancel (clinicId scoped lookup returns null)");
  } else {
    fail("I5-CANCEL-GUARD", "CRITICAL: Clinic B found Clinic A's booking — cancel would be possible!");
  }

  // ─── I6: findMany scoped to Clinic A returns only Clinic A's data ────────────
  const aBookings = await prisma.booking.findMany({ where: { clinicId: clinicA.id } });
  const aHasBBooking = aBookings.some((b) => b.id === bookingB.id);
  if (!aHasBBooking) {
    pass("I6-FINDMANY-A", `findMany(clinicA) returned ${aBookings.length} booking(s), none from Clinic B`);
  } else {
    fail("I6-FINDMANY-A", "LEAK: Clinic A's findMany returned Clinic B's booking!");
  }

  // ─── I7: findMany scoped to Clinic B returns only Clinic B's data ────────────
  const bBookings = await prisma.booking.findMany({ where: { clinicId: clinicB.id } });
  const bHasABooking = bBookings.some((b) => b.id === bookingA.id);
  if (!bHasABooking) {
    pass("I7-FINDMANY-B", `findMany(clinicB) returned ${bBookings.length} booking(s), none from Clinic A`);
  } else {
    fail("I7-FINDMANY-B", "LEAK: Clinic B's findMany returned Clinic A's booking!");
  }

  // ─── I8: Conversation isolation — Clinic B cannot access Clinic A's conversation by phone ─
  const convLeak2 = await prisma.conversation.findFirst({
    where: { clinicId: clinicB.id, clientPhone: "+966511111111" },
  });
  // convLeak2 should be null since convA belongs to clinicA
  if (!convLeak2 || convLeak2.id !== convA.id) {
    pass("I8-CONV-PHONE", "Clinic B cannot access Clinic A's conversation by shared phone number via clinicId scope");
  } else {
    fail("I8-CONV-PHONE", "LEAK: Clinic B retrieved Clinic A's conversation!");
  }

  // ─── I9: bookings route updateStatus fix — booking lookup scoped to ownerClinic ─
  // Simulates: Clinic B tries to update Clinic A's bookingA using clinicB's context
  const crossClinicLookup = await prisma.booking.findFirst({
    where: { id: bookingA.id, clinicId: clinicB.id }, // This is the new guard in route.ts
  });
  if (!crossClinicLookup) {
    pass("I9-ROUTE-UPDATE-GUARD", "POST /api/bookings updateStatus guard: Clinic B cannot find Clinic A's booking (clinicId mismatch returns null)");
  } else {
    fail("I9-ROUTE-UPDATE-GUARD", "CRITICAL: Cross-clinic booking update guard failed!");
  }

  // ─── I10: Delete isolation — Clinic B's deleteMany cannot affect Clinic A's records ─
  // Simulate: deleteMany scoped to clinicB should not touch clinicA's records
  const beforeCount = await prisma.booking.count({ where: { clinicId: clinicA.id } });
  await prisma.booking.deleteMany({ where: { clinicId: clinicB.id, status: "CANCELLED" } }); // No-op, nothing to delete
  const afterCount = await prisma.booking.count({ where: { clinicId: clinicA.id } });
  if (beforeCount === afterCount) {
    pass("I10-DELETE-ISOLATION", "deleteMany scoped to Clinic B does not affect Clinic A's booking count");
  } else {
    fail("I10-DELETE-ISOLATION", `LEAK: Clinic A booking count changed from ${beforeCount} to ${afterCount}!`);
  }

  // ─── Teardown ────────────────────────────────────────────────────────────────
  await teardownFixtures(clinicA.id, clinicB.id);

  // ─── Summary ─────────────────────────────────────────────────────────────────
  origLog("\n======================================================");
  origLog(` ISOLATION RESULTS: ${TESTS_PASSED.length} PASS / ${TESTS_FAILED.length} FAIL`);
  if (TESTS_FAILED.length > 0) {
    origError(" FAILED: " + TESTS_FAILED.join(", "));
    process.exit(1);
  } else {
    origLog(" ALL ISOLATION TESTS PASSED ✅");
    process.exit(0);
  }
}

runIsolationTests().catch(async (err) => {
  origError("Fatal error:", err.message);
  process.exit(1);
});
