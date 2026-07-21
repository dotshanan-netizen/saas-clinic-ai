import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log("--- Conversations ---");
  const convos = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(convos, null, 2));

  console.log("\n--- Bookings ---");
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(bookings, null, 2));

  console.log("\n--- ProcessedWebhooks ---");
  const webhooks = await prisma.processedWebhook.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(webhooks, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
