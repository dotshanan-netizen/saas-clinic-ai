import { prisma } from '../src/lib/db';
prisma.doctor.findMany({include:{services:{include:{service:true}}}})
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
