import fetch from "node-fetch";

const API_URL = process.env.API_URL || "http://localhost:3000";
const CONCURRENCY = 20;

async function runLoadTest() {
  console.log(`Starting Load Test against ${API_URL}/api/webhook/whatsapp with ${CONCURRENCY} concurrent requests`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    const testPhone = "9665" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "966555555555",
                  phone_number_id: "123456789_TEST_PHONE_ID"
                },
                contacts: [
                  {
                    profile: { name: `Test User ${i}` },
                    wa_id: testPhone
                  }
                ],
                messages: [
                  {
                    from: testPhone,
                    id: `ABEG_LOAD_TEST_${Date.now()}_${i}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: { body: "السلام عليكم، اختبار تحميل" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    promises.push(
      fetch(`${API_URL}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => res.status)
        .catch(err => err.message)
    );
  }

  const results = await Promise.all(promises);
  const endTime = Date.now();

  const successCount = results.filter(status => status === 200).length;
  const failCount = results.length - successCount;

  console.log("=== Load Test Results ===");
  console.log(`Total Requests: ${CONCURRENCY}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Time: ${endTime - startTime}ms`);
  
  if (failCount > 0) {
    console.log("Some requests failed. Statuses:", results.filter(status => status !== 200));
  }
}

runLoadTest().catch(console.error);
