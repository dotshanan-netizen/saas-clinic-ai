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
  const token = process.env.META_ACCESS_TOKEN;
  const targetPhone = '201031103049'; // +20 10 31103049
  const testRecipient = '201152276498'; // user phone

  if (!token) {
    console.error('❌ Error: META_ACCESS_TOKEN is not defined in .env file!');
    process.exit(1);
  }

  console.log('🔄 Step 1: Verifying Access Token validity...');
  try {
    const debugRes = await fetch(`https://graph.facebook.com/v18.0/debug_token?input_token=${token}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const debugData = await debugRes.json();
    if (debugData.error) {
      console.error('❌ Token Verification Failed (debug_token):', JSON.stringify(debugData.error, null, 2));
      process.exit(1);
    }
    console.log('✅ Token is valid. Scopes:', debugData.data?.scopes);
  } catch (err) {
    // If debug_token is restricted, we try calling /me
    console.log('⚠️ Could not run debug_token, testing with /me...');
    const meRes = await fetch('https://graph.facebook.com/v18.0/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    if (meData.error) {
      console.error('❌ Token Verification Failed (/me):', JSON.stringify(meData.error, null, 2));
      process.exit(1);
    }
    console.log('✅ Token is valid. User name:', meData.name);
  }

  console.log('\n🔄 Step 2: Fetching WABAs and discovering phone numbers...');
  let wabaId = null;
  let phoneId = null;
  let wabaName = null;

  // We can query business accounts if business ID is accessible, or directly fetch WABAs
  const businessId = '707093202173326';
  const wabaEndpoints = [
    `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`,
    `https://graph.facebook.com/v18.0/${businessId}/client_whatsapp_business_accounts`
  ];

  let found = false;

  for (const url of wabaEndpoints) {
    try {
      console.log(`Querying Meta endpoint: ${url}...`);
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
        for (const waba of data.data) {
          console.log(`Found WABA ID: ${waba.id} (${waba.name})`);
          
          // Query phone numbers in this WABA
          const phoneRes = await fetch(`https://graph.facebook.com/v18.0/${waba.id}/phone_numbers`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const phoneData = await phoneRes.json();
          
          if (phoneData.data && phoneData.data.length > 0) {
            for (const phone of phoneData.data) {
              const sanitizedNum = phone.display_phone_number.replace(/\D/g, '');
              console.log(`- Phone: ${phone.display_phone_number} (ID: ${phone.id})`);
              
              if (sanitizedNum === targetPhone || sanitizedNum.includes(targetPhone)) {
                wabaId = waba.id;
                phoneId = phone.id;
                wabaName = waba.name;
                found = true;
                console.log(`🌟 MATCH FOUND for target production number! Phone ID: ${phoneId}, WABA ID: ${wabaId}`);
                break;
              } else if (!phoneId) {
                // Keep track of the first available number as fallback
                wabaId = waba.id;
                phoneId = phone.id;
                wabaName = waba.name;
              }
            }
          }
          if (found) break;
        }
      }
      if (found) break;
    } catch (e) {
      console.warn(`⚠️ Warning: Failed to query ${url}:`, e.message);
    }
  }

  if (phoneId) {
    if (!found) {
      console.log(`⚠️ Target phone number +20 10 31103049 not found. Falling back to first available number: (ID: ${phoneId})`);
    }
  } else {
    console.error(`\n❌ Error: Could not find any registered phone number in Business ID: ${businessId}!`);
    process.exit(1);
  }

  console.log('\n🔄 Step 3: Subscribing App to the WABA...');
  const subRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const subData = await subRes.json();
  console.log('Subscription response:', JSON.stringify(subData, null, 2));

  console.log('\n🔄 Step 4: Encrypting credentials and updating Database...');
  const encrypted = encrypt(token);
  const formattedToken = `${encrypted.iv}:${encrypted.authTag}:${encrypted.encryptedData}`;

  const updatedClinic = await prisma.clinic.update({
    where: { slug: 'rival-clinic' },
    data: {
      whatsappPhoneId: phoneId,
      whatsappWabaId: wabaId,
      whatsappToken: formattedToken,
      whatsappVerifyToken: 'RIVAL_CLINIC_VERIFY_TOKEN',
      isAiActive: true,
    }
  });

  console.log('✅ Database updated successfully for clinic:', updatedClinic.name);
  console.log('- Phone ID:', updatedClinic.whatsappPhoneId);
  console.log('- WABA ID:', updatedClinic.whatsappWabaId);

  console.log('\n🔄 Step 5: Sending test template message to recipient...');
  const msgRes = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: testRecipient,
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }
      }
    })
  });
  const msgData = await msgRes.json();
  console.log('Test message dispatch result:', JSON.stringify(msgData, null, 2));

  console.log('\n🎉 ALL DONE! Please reply to the template message on your phone to trigger the first webhook POST!');
}

main()
  .catch(err => {
    console.error('Fatal Error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
