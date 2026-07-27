export type JourneyStage =
  | "IDLE"
  | "GREETING"
  | "COLLECTING_SERVICE"
  | "COLLECTING_DOCTOR"
  | "COLLECTING_TIME"
  | "PRE_VALIDATION"
  | "CONFIRMED"
  | "BOOKING_MANAGEMENT"
  | "ESCALATION";

export class JourneyResolver {
  static transition(
    currentStateName: string,
    intentId: string,
    bookingCreated: boolean,
    currentState: Record<string, unknown>
  ): JourneyStage {
    const state = (currentStateName || "IDLE").toUpperCase() as JourneyStage;

    if (intentId === "HumanTakeover" || intentId === "Complaint" || intentId === "Escalation") {
      return "ESCALATION";
    }

    if (intentId === "ModifyBooking" || intentId === "CancelAppointment" || intentId === "Booking Management") {
      return "BOOKING_MANAGEMENT";
    }
    
    if (intentId === "Greeting" || intentId === "GeneralInquiry") {
      return "GREETING";
    }

    if (intentId === "BookAppointment") {
      if (bookingCreated) {
        return "IDLE";
      }
      if (!currentState.serviceName) {
        return "COLLECTING_SERVICE";
      }
      if (!currentState.doctorName) {
        return "COLLECTING_DOCTOR";
      }
      if (!currentState.timeSlot) {
        return "COLLECTING_TIME";
      }
      return "PRE_VALIDATION";
    }

    return state;
  }
}
