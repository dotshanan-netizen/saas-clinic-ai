const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
prisma.conversation.findMany({where: {clientPhone: '+201000000000'}}).then(console.log).finally(() => prisma.$disconnect());
