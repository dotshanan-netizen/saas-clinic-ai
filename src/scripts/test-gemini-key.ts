import 'dotenv/config';

async function testKey() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Testing key:', key?.substring(0, 20) + '...');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'قل مرحبا باختصار' }] }],
      generationConfig: { temperature: 0.1 }
    })
  });
  
  const data = await resp.json();
  if (!resp.ok) {
    console.error('❌ API Error:', JSON.stringify(data.error, null, 2));
  } else {
    console.log('✅ gemini-2.0-flash-lite يعمل بنجاح!');
    console.log('Response:', data.candidates[0].content.parts[0].text);
  }
}

testKey();
