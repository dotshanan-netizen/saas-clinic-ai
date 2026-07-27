export type JourneyStage =
  | "Idle"
  | "Greeting"
  | "Collecting_Service"
  | "Collecting_Doctor"
  | "Collecting_Time"
  | "Pre_Validation"
  | "Confirmed"
  | "Booking Management"
  | "Escalation";

export class JourneyResolver {
  static resolveStage(
    history: { role: string; content: string }[],
    currentState: Record<string, unknown>,
    intentId: string,
    buyingIntent: string = "low",
    isValidated: boolean = false
  ): JourneyStage {
    if (intentId === "human_takeover" || intentId === "complaint" || intentId === "Escalation") {
      return "Escalation";
    }

    if (intentId === "modify_booking" || intentId === "cancel_booking" || intentId === "ModifyBooking" || intentId === "CancelAppointment") {
      return "Booking Management";
    }
    
    // Phase 1: FSM State Routing
    if (intentId === "Greeting" || intentId === "GeneralInquiry") {
      return history.length <= 2 ? "Idle" : "Greeting";
    }

    if (intentId === "booking" || intentId === "BookAppointment" || buyingIntent === "high") {
      if (isValidated) {
        return "Confirmed"; // Actually, confirmed is when booking is created
      }
      if (!currentState.serviceName) {
        return "Collecting_Service";
      }
      if (!currentState.doctorName) {
        return "Collecting_Doctor";
      }
      if (!currentState.timeSlot) {
        return "Collecting_Time";
      }
      
      // If we have time but not confirmed yet
      return "Pre_Validation";
    }

    if (history.length === 0) {
      return "Idle";
    }

    return "Greeting";
  }
}
