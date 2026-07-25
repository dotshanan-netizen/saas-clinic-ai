const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
prisma.clinic.update({
  where: { slug: 'rival-clinic' },
  data: { whatsappPhoneId: '1183207968212546' }
}).then(c => console.log('Restored to', c.whatsappPhoneId))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
