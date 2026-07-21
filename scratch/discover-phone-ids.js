const rawToken = 'EAAT0Pmohl5oBSCH8QECInZB6IpIBZCSZAwLrmBzRKUxP0vk3SifQFkgboxYIRR7tPZArSk3aP9x7WfS6ZC9BfojtFy1JzDfN4JNbxrA0I3K9IZBKGgPbrwu3y9ENkpSFRT3op9hQ0uLyUHwfJLUVKUHd52t9icpt3AJCKGmIH5XqihUhKYv65GDPGXRLOTNTIgTjSleLB2KZCMHRfcQiaD1fqsej4shSVlZC9Sn7DkDEtSTYYCLv1vMwrZBZCKTx3xYLseIDZCn3OM8HICQnJ5FKxGq56wlL7dRnrXS3XUZD';
const businessId = '707093202173326';

async function main() {
  try {
    // Try both owned and client accounts
    const endpoints = [
      `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`,
      `https://graph.facebook.com/v18.0/${businessId}/client_whatsapp_business_accounts`
    ];

    for (const url of endpoints) {
      console.log(`Fetching from: ${url}...`);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${rawToken}`
        }
      });
      const data = await res.json();
      console.log('Response:', JSON.stringify(data, null, 2));

      if (data.data && data.data.length > 0) {
        for (const waba of data.data) {
          console.log(`Found WABA: ${waba.name} (ID: ${waba.id})`);
          console.log(`Fetching phone numbers for WABA ID: ${waba.id}...`);
          const phoneRes = await fetch(`https://graph.facebook.com/v18.0/${waba.id}/phone_numbers`, {
            headers: {
              'Authorization': `Bearer ${rawToken}`
            }
          });
          const phoneData = await phoneRes.json();
          console.log(`Phone numbers under WABA ${waba.id}:`, JSON.stringify(phoneData, null, 2));
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
