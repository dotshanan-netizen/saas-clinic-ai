const rawToken = 'EAAT0Pmohl5oBSAfZCec1HjAy0ts41FN3aWufwIkrtqtWzZARcdCekepuQT2aHtMBxwV87nNcr4QRmzgKziWSud1LeNxeUOWfYyWCFh7zoiRJHaowVeiN2u2BTU0pXlJcNKs0rp65KT5RdKZAv0ZAUqw7ZBY3XMOkZBwxbfMIlCjjCF1FSIQD6wlQsX4OHhIQZDZD';
const phoneId = '1183207968212546';

async function main() {
  try {
    console.log(`Checking status for Phone ID: ${phoneId}...`);
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}?fields=status,name_status,verified_name,code_verification_status,display_phone_number,quality_rating,platform_type`, {
      headers: {
        'Authorization': `Bearer ${rawToken}`
      }
    });

    const data = await res.json();
    console.log('Phone Status Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
