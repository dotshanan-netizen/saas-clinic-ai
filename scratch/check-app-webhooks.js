const rawToken = 'EAAT0Pmohl5oBSCH8QECInZB6IpIBZCSZAwLrmBzRKUxP0vk3SifQFkgboxYIRR7tPZArSk3aP9x7WfS6ZC9BfojtFy1JzDfN4JNbxrA0I3K9IZBKGgPbrwu3y9ENkpSFRT3op9hQ0uLyUHwfJLUVKUHd52t9icpt3AJCKGmIH5XqihUhKYv65GDPGXRLOTNTIgTjSleLB2KZCMHRfcQiaD1fqsej4shSVlZC9Sn7DkDEtSTYYCLv1vMwrZBZCKTx3xYLseIDZCn3OM8HICQnJ5FKxGq56wlL7dRnrXS3XUZD';
const appId = '139444812578714';

async function main() {
  try {
    console.log(`Checking subscriptions for App ID: ${appId}...`);
    const res = await fetch(`https://graph.facebook.com/v18.0/${appId}/subscriptions`, {
      headers: {
        'Authorization': `Bearer ${rawToken}`
      }
    });

    const data = await res.json();
    console.log('App Subscriptions:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
