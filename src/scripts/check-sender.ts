import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const convs = await prisma.conversation.findMany();
  for (const c of convs) {
    if (JSON.stringify(c.messages).includes("0546724556")) {
      console.log("SENDER ID:", c.clientPhone);
    }
  }
}
run().finally(() => prisma.$disconnect());
