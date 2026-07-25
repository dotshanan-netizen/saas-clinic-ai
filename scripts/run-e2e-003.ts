async function runTest() {
  console.log("=== Running E2E-003: Dashboard Data Verification ===");
  try {
    const res = await fetch("http://localhost:3000/api/conversations?clinicSlug=alhayat-clinic-2", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();
    
    if (res.ok) {
      console.log("✅ SUCCESS! Conversations fetched.");
      console.log("Conversations array length:", Array.isArray(data) ? data.length : "Not an array");
      if (Array.isArray(data)) {
        console.log("Expected empty array for new clinic:", data.length === 0 ? "YES" : "NO");
      }
    } else {
      console.error("❌ FAILED API!");
      console.error("Status:", res.status);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Network or Execution Error:", err);
    process.exit(1);
  }
}

runTest();

export {};
