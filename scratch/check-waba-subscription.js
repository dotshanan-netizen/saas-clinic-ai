const { PrismaClient } = require('../src/generated/prisma');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

function decrypt(text, ivHex, authTagHex) {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'rival_secret_default_key_32_bytes_len';
  
  // Pad or truncate key to 32 bytes
  let key = Buffer.from(encryptionKey, 'utf8');
  if (key.length < 32) {
    const padded = Buffer.alloc(32);
    key.copy(padded);
    key = padded;
  } else if (key.length > 32) {
    key = key.subarray(0, 32);
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(text, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: 'rival-clinic' },
    });

    if (!clinic) {
      console.error('Clinic not found!');
      return;
    }

    console.log('Clinic Name:', clinic.name);
    console.log('WABA ID:', clinic.whatsappWabaId);
    console.log('Phone ID:', clinic.whatsappPhoneId);

    if (!clinic.whatsappToken) {
      console.error('No whatsappToken configured!');
      return;
    }

    const parts = clinic.whatsappToken.split(':');
    if (parts.length !== 3) {
      console.error('Token is not encrypted correctly (needs 3 parts)!');
      return;
    }

    const [iv, authTag, encryptedData] = parts;
    const token = decrypt(encryptedData, iv, authTag);
    console.log('Decrypted Token prefix:', token.substring(0, 15) + '...');

    const wabaId = clinic.whatsappWabaId || '104764835940381'; // default or fetched

    // 1. GET Subscribed Apps
    console.log(`Checking subscription for WABA ID: ${wabaId}...`);
    const getRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const getData = await getRes.json();
    console.log('Current Subscriptions:', JSON.stringify(getData, null, 2));

    if (getData.error) {
      console.error('Graph API Error:', getData.error);
      return;
    }

    // Check if subscribed
    const isSubscribed = getData.data && getData.data.length > 0;
    if (isSubscribed) {
      console.log('App is already subscribed to this WABA!');
    } else {
      console.log('App is NOT subscribed. Subscribing now...');
      const postRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const postData = await postRes.json();
      console.log('Subscription response:', JSON.stringify(postData, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
