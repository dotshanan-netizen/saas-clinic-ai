const { PrismaClient } = require('../src/generated/prisma');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;

function decrypt(encryptedData, ivHex, authTagHex) {
  const secretKey = process.env.ENCRYPTION_KEY || 'rival_secret_default_key_32_bytes_len';
  
  let key;
  if (secretKey.length === KEY_LEN * 2) {
    key = Buffer.from(secretKey, 'hex');
  } else {
    key = crypto.createHash('sha256').update(secretKey).digest();
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: 'rival-clinic' }
    });

    if (!clinic || !clinic.whatsappToken) {
      console.error('Clinic or Token not found!');
      return;
    }

    const parts = clinic.whatsappToken.split(':');
    const [iv, authTag, encryptedData] = parts;
    const token = decrypt(encryptedData, iv, authTag);

    const phoneId = clinic.whatsappPhoneId;
    const recipient = '201152276498'; // user 011 number

    console.log(`Sending template message to ${recipient} using Phone ID: ${phoneId}...`);

    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: 'hello_world', // default Meta sandbox template
          language: {
            code: 'en_US'
          }
        }
      })
    });

    const data = await res.json();
    console.log('Meta API Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error sending message:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
