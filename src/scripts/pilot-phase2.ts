import { prisma } from "../lib/db";
import { ConversationEngine } from "../lib/domain/ConversationEngine";

async function runPhase2() {
  console.log("=== SPRINT 2.2 PHASE 2: HAPPY PATH SUITE ===\n");
  const clinic = await prisma.clinic.findUnique({
    where: { slug: "pilot-clinic" },
    include: {
      branches: { where: { status: "ACTIVE" } },
      doctors: { where: { status: "ACTIVE" }, include: { services: { include: { service: true } } } },
      services: { where: { status: "ACTIVE" } },
    }
  });

  if (!clinic) throw new Error("Pilot clinic not found. Run phase 1 first.");

  const testCases = [
    {
      id: "HP-001",
      name: "Inquiry about prices",
      phone: "+966511111112",
      message: "كم سعر تنظيف البشرة؟",
      expectedIntent: "Inquiry",
      expectedResolvedIntent: "Inquiry"
    },
    {
      id: "HP-002",
      name: "Inquiry about offers",
      phone: "+966511111113",
      message: "هل عندكم عروض اليوم؟",
      expectedIntent: "Inquiry",
      expectedResolvedIntent: "Inquiry"
    },
    {
      id: "HP-003",
      name: "Booking with specific doctor",
      phone: "+966511111114",
      message: "السلام عليكم، اسمي سارة، أبغى أحجز عند د. تجربة يوم الثلاثاء الساعة 11 الصباح لخدمة تنظيف بشرة في الفرع الرئيسي",
      expectedIntent: "BookAppointment",
      expectedResolvedIntent: "Booking",
      expectBookingCreated: true
    },
    {
      id: "HP-004",
      name: "Booking at specific branch",
      phone: "+966511111115",
      message: "أنا ريم، أبغى أحجز تنظيف بشرة في الفرع الرئيسي يوم الأربعاء الساعة 2 الظهر",
      expectedIntent: "BookAppointment",
      expectedResolvedIntent: "Booking",
      expectBookingCreated: false 
    },
    {
      id: "HP-005",
      name: "Returning customer (has active booking)",
      phone: "+966511111114",
      message: "أبغى أحجز موعد آخر",
      expectedIntent: "BookAppointment",
      expectedResolvedIntent: "Booking"
    },
    {
      id: "HP-006",
      name: "Rescheduling",
      phone: "+966511111114",
      message: "أبغى أعدل موعدي اللي حجزته ليوم الخميس الساعة 11 الصباح بدال الثلاثاء",
      expectedIntent: "ModifyBooking",
      expectedResolvedIntent: "Modify Booking"
    },
    {
      id: "HP-007",
      name: "Canceling",
      phone: "+966511111114",
      message: "أبغى ألغي موعدي",
      expectedIntent: "CancelAppointment",
      expectedResolvedIntent: "Cancel Booking"
    },
    {
      id: "HP-008",
      name: "Booking after working hours",
      phone: "+966511111116",
      message: "ابغى أحجز عند د. تجربة اليوم الساعة 10 بالليل تنظيف بشرة وانا محمد والفرع الرئيسي",
      expectedIntent: "BookAppointment",
      expectedResolvedIntent: "Booking",
      expectBookingCreated: false 
    },
    {
      id: "HP-009",
      name: "Choosing a non-existent service",
      phone: "+966511111117",
      message: "أبغى أحجز ليزر إزالة شعر",
      expectedIntent: "Inquiry",
      expectedResolvedIntent: "Inquiry",
      expectBookingCreated: false
    },
    {
      id: "HP-010",
      name: "Booking with unavailable doctor",
      phone: "+966511111118",
      message: "أبغى أحجز عند دكتور خيالي لتنظيف البشرة",
      expectedIntent: "Inquiry",
      expectedResolvedIntent: "Inquiry",
      expectBookingCreated: false
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    console.log(`\n---------------------------------------`);
    console.log(`Scenario: ${tc.id} - ${tc.name}`);
    console.log(`User: ${tc.message}`);
    const start = Date.now();
    try {
      const res = await ConversationEngine.processMessage(
        clinic as any,
        tc.phone,
        tc.message,
        "WhatsApp",
        `wamid-${tc.id}-${Date.now()}`
      );
      
      console.log(`\nJoud (Intent: ${res.intent}):`);
      console.log(`${res.response}`);
      
      let failReason = "";
      // processMessage returns resolved intent (e.g. 'Booking', 'Modify Booking')
      if (tc.expectedResolvedIntent && res.intent !== tc.expectedResolvedIntent) {
        failReason = `Intent mismatch. Expected ${tc.expectedResolvedIntent}, got ${res.intent}.`;
      }
      
      if (tc.expectBookingCreated !== undefined && !!res.bookingCreated !== tc.expectBookingCreated) {
        failReason = `BookingCreated mismatch. Expected ${tc.expectBookingCreated}, got ${!!res.bookingCreated}.`;
      }

      if (failReason) {
        console.log(`\nResult: FAIL ❌`);
        console.log(`Bug: ${failReason}`);
      } else {
        console.log(`\nResult: PASS ✅`);
        passed++;
      }
      
    } catch (err: any) {
      console.log(`\nResult: FAIL ❌`);
      console.log(`Bug: Exception thrown: ${err.message}`);
    }
    console.log(`Duration: ${Date.now() - start}ms`);
  }

  console.log(`\n=======================================`);
  console.log(`Passed ${passed}/${testCases.length} Scenarios`);
  console.log(`=======================================`);
}

runPhase2();
