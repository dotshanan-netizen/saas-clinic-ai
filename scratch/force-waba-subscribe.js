const rawToken = 'EAAT0Pmohl5oBSCH8QECInZB6IpIBZCSZAwLrmBzRKUxP0vk3SifQFkgboxYIRR7tPZArSk3aP9x7WfS6ZC9BfojtFy1JzDfN4JNbxrA0I3K9IZBKGgPbrwu3y9ENkpSFRT3op9hQ0uLyUHwfJLUVKUHd52t9icpt3AJCKGmIH5XqihUhKYv65GDPGXRLOTNTIgTjSleLB2KZCMHRfcQiaD1fqsej4shSVlZC9Sn7DkDEtSTYYCLv1vMwrZBZCKTx3xYLseIDZCn3OM8HICQnJ5FKxGq56wlL7dRnrXS3XUZD';
const wabaId = '1203758808582942';

async function main() {
  try {
    console.log(`Force subscribing App to WABA ID: ${wabaId}...`);
    const postRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${rawToken}`
      }
    });
    const postData = await postRes.json();
    console.log('Subscription response:', JSON.stringify(postData, null, 2));

    console.log('\nChecking subscribed apps list again...');
    const getRes = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`, {
      headers: {
        'Authorization': `Bearer ${rawToken}`
      }
    });
    const getData = await getRes.json();
    console.log('Updated Subscribed Apps:', JSON.stringify(getData, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
