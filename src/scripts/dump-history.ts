import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conv = await prisma.conversation.findFirst({
    orderBy: { updatedAt: "desc" }
  });
  
  if (conv) {
    console.log("Client Phone:", conv.clientPhone);
    console.log("History:");
    const msgs = conv.messages as any[];
    for (const m of msgs) {
      console.log(`[${m.role}] ${m.content}`);
      if (m.bookingData) {
        console.log(`   -> State:`, m.bookingData);
      }
      if (m.sessionReset) {
        console.log(`   -> SESSION RESET`);
      }
    }
  } else {
    console.log("No conversations found");
  }
}

main().finally(() => prisma.$disconnect());
