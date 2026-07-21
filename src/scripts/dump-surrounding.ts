import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const conversations = await prisma.conversation.findMany();
  for (const conv of conversations) {
    const msgs = conv.messages as any[];
    if (!msgs) continue;
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].content && msgs[i].content.includes("0546724556") && msgs[i].timestamp.includes("08:59:53")) {
        console.log("---- CONVERSATION DUMP ----");
        for (let j = Math.max(0, i - 4); j <= Math.min(msgs.length - 1, i + 2); j++) {
          console.log(`[${msgs[j].role}] ${msgs[j].content}`);
          if (msgs[j].bookingData) console.log("State:", msgs[j].bookingData);
        }
      }
    }
  }
}

run().finally(() => prisma.$disconnect());
