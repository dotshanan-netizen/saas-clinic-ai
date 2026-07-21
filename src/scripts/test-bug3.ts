import { ConversationEngine } from "../lib/domain/ConversationEngine";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTest() {
  const clinicId = "cmrjidx4a0000dzr82r0gdvh4";
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      services: true,
      doctors: { include: { services: { include: { service: true } } } },
      branches: true,
    },
  });
  if (!clinic) throw new Error("Clinic not found");
  
  const clientPhone = "+966500000000"; // Fake whatsapp sender
  const message = "0546724556"; // The 10-digit number the user entered
  const source = "WhatsApp";

  console.log(`Processing message: ${message}`);
  const result = await ConversationEngine.processMessage(clinic as any, clientPhone, message, source);
  console.log("Result:", result);
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
