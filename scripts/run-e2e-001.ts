async function runTest() {
  console.log("=== Running E2E-001: Onboarding ===");
  try {
    const payload = {
      adminEmail: "admin2@alhayat.com",
      adminPassword: "Password123!",
      adminName: "أحمد المدير",
      clinicSlug: "alhayat-clinic-2",
      clinicName: "عيادة الحياة",
      logoUrl: "https://example.com/logo.png",
      description: "عيادة متخصصة في طب الأسنان",
      contactPhone: "+966500000001",
      welcomeMessage: "أهلاً بك 🌸 كيف يمكنني مساعدتك اليوم؟",
      customPrompt: "أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة بلباقة وسرعة.",
      whatsappPhoneId: "1234567890",
      whatsappWabaId: "0987654321",
      whatsappToken: "EAATestToken123",
      whatsappVerifyToken: "my-secret-token",
      isAiActive: true,
      branches: [
        { name: "فرع العليا", city: "الرياض", address: "", phone: "" }
      ],
      services: [
        { name: "تنظيف أسنان", description: "", price: 300, durationMinutes: 30 }
      ],
      doctors: [
        { name: "د. محمد", specialty: "طبيب أسنان", branchIndexes: [0], serviceIndexes: [0] }
      ],
      knowledgeBase: [
        {
          category: "GENERAL_INFO",
          content: "BUSINESS PROFILE: عيادة الحياة"
        }
      ]
    };

    const res = await fetch("http://localhost:3000/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (res.ok) {
      console.log("✅ SUCCESS! Clinic created successfully.");
      console.log("Response:", data);
    } else {
      console.error("❌ FAILED!");
      console.error("Status:", res.status);
      console.error("Response:", data);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Network or Execution Error:", err);
    process.exit(1);
  }
}

runTest();

export {};
