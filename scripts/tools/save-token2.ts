import { PrismaClient } from './src/generated/prisma';
import encryption from './src/lib/encryption';
const p = new PrismaClient();

async function run() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return console.log('No token');
  
  const { iv, authTag, encryptedData } = encryption.encrypt(token);
  const full = `${iv}:${authTag}:${encryptedData}`;
  
  await p.clinic.update({ 
    where: { slug: 'rival-clinic' }, 
    data: { whatsappToken: full }
  });
  console.log('Saved encrypted token correctly!');
}
run().catch(console.error).finally(() => p.$disconnect());
