const { PrismaClient } = require('../src/generated/prisma');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;

function encrypt(text) {
  const secretKey = process.env.ENCRYPTION_KEY || 'rival_secret_default_key_32_bytes_len';
  
  let key;
  if (secretKey.length === KEY_LEN * 2) {
    key = Buffer.from(secretKey, 'hex');
  } else {
    key = crypto.createHash('sha256').update(secretKey).digest();
  }

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

async function main() {
  try {
    const rawToken = 'EAAT0Pmohl5oBSCH8QECInZB6IpIBZCSZAwLrmBzRKUxP0vk3SifQFkgboxYIRR7tPZArSk3aP9x7WfS6ZC9BfojtFy1JzDfN4JNbxrA0I3K9IZBKGgPbrwu3y9ENkpSFRT3op9hQ0uLyUHwfJLUVKUHd52t9icpt3AJCKGmIH5XqihUhKYv65GDPGXRLOTNTIgTjSleLB2KZCMHRfcQiaD1fqsej4shSVlZC9Sn7DkDEtSTYYCLv1vMwrZBZCKTx3xYLseIDZCn3OM8HICQnJ5FKxGq56wlL7dRnrXS3XUZD';
    const phoneId = '1118087068064035';
    const wabaId = '1203758808582942';
    const verifyToken = 'RIVAL_CLINIC_VERIFY_TOKEN';

    console.log('Encrypting Access Token...');
    const encrypted = encrypt(rawToken);
    const formattedToken = `${encrypted.iv}:${encrypted.authTag}:${encrypted.encryptedData}`;

    console.log('Updating database for clinic "rival-clinic"...');
    const updatedClinic = await prisma.clinic.update({
      where: { slug: 'rival-clinic' },
      data: {
        whatsappPhoneId: phoneId,
        whatsappWabaId: wabaId,
        whatsappVerifyToken: verifyToken,
        whatsappToken: formattedToken,
        isAiActive: true,
      }
    });

    console.log('Database updated successfully for clinic:', updatedClinic.name);
    console.log('Verifying settings in DB...');
    console.log('- Phone ID:', updatedClinic.whatsappPhoneId);
    console.log('- WABA ID:', updatedClinic.whatsappWabaId);
    console.log('- Verify Token:', updatedClinic.whatsappVerifyToken);

    // 2. WABA Subscription activation
    console.log(`Checking current subscribed apps for WABA ${wabaId}...`);
    const getRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
      headers: {
        'Authorization': `Bearer ${rawToken}`
      }
    });
    const getData = await getRes.json();
    console.log('Subscribed apps response:', JSON.stringify(getData, null, 2));

    if (getData.error) {
      console.error('Meta API GET Error:', getData.error);
      return;
    }

    const isSubscribed = getData.data && getData.data.length > 0;
    if (isSubscribed) {
      console.log('App is already subscribed to this WABA!');
    } else {
      console.log('App is NOT subscribed. Subscribing now...');
      const postRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${rawToken}`
        }
      });
      const postData = await postRes.json();
      console.log('Subscription response:', JSON.stringify(postData, null, 2));
    }
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
