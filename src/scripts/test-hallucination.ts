import { AIProvider } from "../lib/infrastructure/ai/AIProvider";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const clinic = await prisma.clinic.findFirst({
    include: { services: true, doctors: { include: { services: { include: { service: true } } } }, branches: true },
  });
  
  const history = [
    { role: "user", content: "0546724556", timestamp: new Date().toISOString() }
  ];
  
  const currentState = {
    clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null
  };

  const result = await AIProvider.classifyIntentAndExtractData(clinic as any, history as any, "WhatsApp", currentState);
  console.log(result);
}

run().finally(() => prisma.$disconnect());
