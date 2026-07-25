const url = "http://localhost:3000/api/chat";
const message = process.argv[2] || "هلا";
const clientPhone = process.argv[3] || "+966555555555";
const source = process.argv[4] || "Simulator";

async function main() {
  try {
    const res = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        clientPhone,
        clinicSlug: "rival-clinic",
        source,
      }),
    });

    if (!res.ok) {
      console.error("HTTP Error:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    console.log("\n💬 رد المساعد الذكي:");
    console.log(data.response);
    
    if (data.bookingData) {
      console.log("\n📋 البيانات المستخرجة للحجز:");
      console.log(JSON.stringify(data.bookingData, null, 2));
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

main();
