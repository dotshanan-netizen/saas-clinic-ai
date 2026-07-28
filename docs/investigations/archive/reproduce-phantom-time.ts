/**
 * Reproduction Script: Phantom Time Bug Conversation
 * 
 * Simulates the exact WhatsApp conversation that triggered the phantom time bug:
 *   1. "0501234567" → bot greeting
 *   2. "بوتكس" → service selection, bot asks branch
 *   3. "الصحافة" → branch selection → phantom time "05:00 م" error
 * 
 * Run: npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/reproduce-phantom-time.ts
 */

import { prisma } from "../src/lib/db";
import { ConversationEngine } from "../src/lib/domain/ConversationEngine";
import crypto from "crypto";

const TEST_PHONE = "+966501234567"; // Matches Hanan's phone from production
const SOURCE = "ReproductionTest";

async function reproduce() {
  console.log("\n================================================================");
  console.log(" PHANTOM TIME BUG — CONVERSATION REPRODUCTION");
  console.log("================================================================\n");

  // 1. Fetch clinic
  const clinic = await prisma.clinic.findFirst({
    include: {
      branches: { where: { status: "ACTIVE" } },
      doctors: { where: { status: "ACTIVE" }, include: { services: { include: { service: true } } } },
      services: { where: { status: "ACTIVE" } },
    },
  });

  if (!clinic) {
    console.error("❌ No clinic found in DB. Run 'npx prisma db push && npx prisma db seed' first.");
    process.exit(1);
  }

  console.log(`Clinic: ${clinic.name} (${clinic.id})\n`);

  // 2. Clean up any previous conversation for this phone
  console.log(" Cleaning previous conversation & bookings for", TEST_PHONE);
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  console.log(" Done.\n");

  // 3. Send messages sequentially to simulate the conversation
  const messages = [
    { text: "0501234567", label: "Step 1: User sends phone number" },
    { text: "بوتكس", label: "Step 2: User says 'Botox'" },
    { text: "الصحافة", label: "Step 3: User says 'Al-Sahafa branch'" },
  ];

  for (const msg of messages) {
    console.log(`\n--- ${msg.label} ---`);
    console.log(`[SEND] "${msg.text}"`);

    const result = await ConversationEngine.processMessage(
      clinic as any,
      TEST_PHONE,
      msg.text,
      SOURCE,
      crypto.randomUUID()
    );

    console.log(`[RESPONSE] ${result.response.substring(0, 200)}`);
    console.log(`[INTENT] ${result.intent}`);
    console.log(`[STAGE] ${result.stage}`);
    console.log(`[BOOKING CREATED] ${result.bookingCreated}`);
  }

  // 4. Summary
  console.log("\n================================================================");
  console.log(" REPRODUCTION COMPLETE");
  console.log("================================================================\n");

  // Check what was stored
  const conversation = await prisma.conversation.findUnique({
    where: {
      clinicId_clientPhone: {
        clinicId: clinic.id,
        clientPhone: TEST_PHONE,
      },
    },
  });

  if (conversation) {
    console.log("Conversation state:", conversation.currentStateName);
    console.log("Booking draft:", JSON.stringify(conversation.bookingDraft, null, 2));
  }

  // Cleanup
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  await prisma.conversation.deleteMany({ where: { clinicId: clinic.id, clientPhone: TEST_PHONE } });
  console.log("\nCleanup complete.");

  process.exit(0);
}

reproduce().catch((e) => {
  console.error("Reproduction failed:", e);
  process.exit(1);
});
