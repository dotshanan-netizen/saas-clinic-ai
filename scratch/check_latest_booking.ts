import { prisma } from '../src/lib/db';
prisma.booking.findMany({
  orderBy: { createdAt: 'desc' },
  take: 1
})
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
