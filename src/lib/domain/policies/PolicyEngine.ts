export interface PolicyOutput {
  allowBookingPrompt: boolean;
  allowMedicalAdvice: boolean;
  closingStyle: "soft_inquiry" | "price_inquiry" | "booking_direct" | "medical_disclaimer" | "emergency_escalation" | "human_escalation";
  escalation: boolean;
}

export class PolicyEngine {
  static getPolicyForIntent(intentId: string, buyingIntent: string = "low"): PolicyOutput {
    const isBuyingIntent = buyingIntent === "high" || intentId === "booking";

    switch (intentId) {
      case "medical_emergency":
        return {
          allowBookingPrompt: false,
          allowMedicalAdvice: false,
          closingStyle: "emergency_escalation",
          escalation: true,
        };

      case "aftercare":
        return {
          allowBookingPrompt: false,
          allowMedicalAdvice: false,
          closingStyle: "medical_disclaimer",
          escalation: false,
        };

      case "modify_booking":
        return {
          allowBookingPrompt: true,
          allowMedicalAdvice: false,
          closingStyle: "booking_direct",
          escalation: false,
        };

      case "cancel_booking":
        return {
          allowBookingPrompt: false,
          allowMedicalAdvice: false,
          closingStyle: "human_escalation",
          escalation: false,
        };

      case "human_takeover":
      case "complaint":
        return {
          allowBookingPrompt: false,
          allowMedicalAdvice: false,
          closingStyle: "human_escalation",
          escalation: true,
        };

      case "price_inquiry":
      case "service_inquiry":
      case "doctor_inquiry":
        return {
          allowBookingPrompt: isBuyingIntent,
          allowMedicalAdvice: false,
          closingStyle: isBuyingIntent ? "booking_direct" : "soft_inquiry",
          escalation: false,
        };

      case "booking":
      default:
        return {
          allowBookingPrompt: true,
          allowMedicalAdvice: false,
          closingStyle: "booking_direct",
          escalation: false,
        };
    }
  }
}
