const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
prisma.clinic.findMany({select: {id: true, slug: true, whatsappPhoneId: true}}).then(console.log).finally(() => prisma.$disconnect());
