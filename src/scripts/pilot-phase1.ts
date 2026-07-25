import { TenantOnboardingService } from "../lib/services/TenantOnboardingService";
import { prisma } from "../lib/db";
import { ConversationEngine } from "../lib/domain/ConversationEngine";
import { KnowledgeBaseService } from "../services/KnowledgeBaseService";
import { PrismaKnowledgeBaseRepository } from "../repositories/prisma/PrismaKnowledgeBaseRepository";

async function runPilotPhase1() {
  console.log("=== SPRINT 2.2 PHASE 1: GOLDEN PATH ===");
  const startTime = Date.now();
  let currentScenario = "Setup";

  try {
    // 1. Onboarding
    console.log("\n[1] Onboarding Pilot Clinic...");
    await prisma.clinic.deleteMany({ where: { slug: "pilot-clinic" } });
    await prisma.user.deleteMany({ where: { email: "admin@pilot.com" } });

    const clinicPayload = {
      adminEmail: "admin@pilot.com",
      adminPassword: "password123",
      adminName: "Pilot Admin",
      clinicSlug: "pilot-clinic",
      clinicName: "عيادة بايلوت للتجميل",
      logoUrl: "",
      description: "عيادة تجميل متطورة",
      contactPhone: "+966500000000",
      welcomeMessage: "أهلاً بك في عيادة بايلوت",
      customPrompt: "أنتِ مساعدة ذكية لعيادة بايلوت للتجميل. تعاملي بلطف.",
      whatsappPhoneId: "pilot-phone-id",
      whatsappWabaId: "pilot-waba-id",
      whatsappToken: "fake-token",
      whatsappVerifyToken: "fake-verify",
      isAiActive: true,
      branches: [{ name: "الفرع الرئيسي", city: "الرياض", address: "الرياض", phone: "0110000000" }],
      services: [{ name: "تنظيف بشرة", description: "تنظيف عميق", price: 300, durationMinutes: 45 }],
      doctors: [{ name: "د. تجربة", specialty: "جلدية", branchIndexes: [0], serviceIndexes: [0] }],
      knowledgeBase: [
        {
          category: "GENERAL_INFO",
          content: "سياسة الحجز: نطلب الاسم وتحديد الطبيب والوقت. لا يوجد عربون."
        }
      ]
    };

    const clinic = await TenantOnboardingService.onboard(clinicPayload);
    const clinicWithCatalog = await prisma.clinic.findUnique({
      where: { id: clinic.id },
      include: {
        branches: { where: { status: "ACTIVE" } },
        doctors: { where: { status: "ACTIVE" }, include: { services: { include: { service: true } } } },
        services: { where: { status: "ACTIVE" } },
      }
    });
    
    if (!clinicWithCatalog) throw new Error("Failed to load clinic");
    console.log("✅ Clinic Onboarded");

    // 2. Webhook Message 1
    currentScenario = "First Booking Request";
    console.log("\n[2] Simulating User Message 1...");
    const clientPhone = "+966511111111";
    let message1 = "السلام عليكم، أريد حجز تنظيف بشرة.";
    
    const res1 = await ConversationEngine.processMessage(
      clinicWithCatalog as any,
      clientPhone,
      message1,
      "WhatsApp",
      "wamid-pilot-1"
    );
    console.log(`🤖 Joud Responded: "${res1.response}"`);
    console.log(`📊 Extracted Intent: ${res1.intent}`);
    console.log(`📋 Booking Data:`, res1.bookingData);

    // 3. Webhook Message 2
    currentScenario = "Providing Missing Info";
    console.log("\n[3] Simulating User Message 2...");
    let message2 = "اسمي أحمد، أبغى د. تجربة، الأحد 10:00 ص في الفرع الرئيسي.";
    
    const res2 = await ConversationEngine.processMessage(
      clinicWithCatalog as any,
      clientPhone,
      message2,
      "WhatsApp",
      "wamid-pilot-2"
    );
    console.log(`🤖 Joud Responded: "${res2.response}"`);
    console.log(`📊 Extracted Intent: ${res2.intent}`);
    console.log(`📋 Booking Data:`, res2.bookingData);

    // 4. Verify Booking Creation
    currentScenario = "Verify Booking in DB";
    console.log("\n[4] Verifying Database Booking Record...");
    const booking = await prisma.booking.findFirst({
      where: { clinicId: clinic.id, clientPhone },
      orderBy: { createdAt: "desc" }
    });

    if (booking) {
      console.log(`✅ Booking Created: ${booking.serviceName} with ${booking.doctorName} at ${booking.timeSlot}`);
    } else {
      throw new Error("Booking was not created in the database.");
    }

    const duration = Date.now() - startTime;
    console.log("\n=========================================");
    console.log(`🎉 OPERATIONAL LOOP 1 SUCCESSFUL (${duration}ms) 🎉`);
    console.log("=========================================");

  } catch (err) {
    console.error(`\n❌ FAILED IN SCENARIO: ${currentScenario}`);
    console.error(err);
  }
}

runPilotPhase1();
