import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const conversations = await prisma.conversation.findMany();
  for (const conv of conversations) {
    const msgs = conv.messages as any[];
    if (!msgs) continue;
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].content && msgs[i].content.includes("0546724556")) {
        console.log("FOUND MESSAGE:", msgs[i]);
        if (i + 1 < msgs.length) {
          console.log("NEXT ASSISTANT MESSAGE:", msgs[i+1]);
        }
      }
    }
  }
}

run().finally(() => prisma.$disconnect());
