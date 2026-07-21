import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const convs = await prisma.conversation.findMany();
  for (const c of convs) {
    const msgs = c.messages as any[];
    for(let i=0; i<msgs.length; i++) {
      if (msgs[i].content && msgs[i].content.includes('0501234567')) {
        console.log(JSON.stringify(msgs[i], null, 2));
      }
    }
  }
}
run().finally(() => prisma.$disconnect());
