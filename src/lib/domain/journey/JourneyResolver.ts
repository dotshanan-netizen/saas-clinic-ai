export type JourneyStage =
  | "Discovery"
  | "Exploration"
  | "Evaluation"
  | "Decision"
  | "Booking"
  | "Booking Management"
  | "Aftercare"
  | "Escalation";

export class JourneyResolver {
  static resolveStage(
    history: any[],
    currentState: any,
    intentId: string,
    buyingIntent: string = "low"
  ): JourneyStage {
    if (intentId === "human_takeover" || intentId === "complaint") {
      return "Escalation";
    }

    if (intentId === "modify_booking" || intentId === "cancel_booking") {
      return "Booking Management";
    }

    if (intentId === "aftercare") {
      return "Aftercare";
    }

    if (intentId === "booking" || buyingIntent === "high") {
      return "Booking";
    }

    if (intentId === "price_inquiry" || intentId === "service_inquiry" || intentId === "doctor_inquiry") {
      return "Exploration";
    }

    if (history.length <= 2) {
      return "Discovery";
    }

    return "Exploration";
  }
}
