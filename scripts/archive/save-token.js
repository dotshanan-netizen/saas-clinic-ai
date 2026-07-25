const { PrismaClient } = require('./src/generated/prisma'); const { encrypt } = require('./src/lib/encryption.js') || require('./src/lib/encryption.ts'); // wait, I can just run a ts-node script!
