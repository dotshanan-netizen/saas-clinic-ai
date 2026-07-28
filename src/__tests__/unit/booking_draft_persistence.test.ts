import { describe, it, expect } from "vitest";
import {
  inferBookingStage,
  determineDraftToSave,
  BookingStage,
} from "../../lib/domain/ConversationEngine";

// ── BookingStage Inference ──────────────────────────────────────────────────

describe("inferBookingStage", () => {
  it("should return IDLE when draft is null", () => {
    expect(inferBookingStage(null)).toBe("IDLE");
  });

  it("should return IDLE when draft is undefined", () => {
    expect(inferBookingStage(undefined)).toBe("IDLE");
  });

  it("should return IDLE when draft is empty object", () => {
    expect(inferBookingStage({})).toBe("IDLE");
  });

  it("should return IDLE when draft has no booking fields", () => {
    expect(inferBookingStage({ clientName: "سميرة" })).toBe("IDLE");
  });

  it("should return COLLECTING when draft has only serviceName", () => {
    expect(inferBookingStage({ serviceName: "بوتكس" })).toBe("COLLECTING");
  });

  it("should return COLLECTING when draft has serviceName + doctorName but no timeSlot", () => {
    expect(inferBookingStage({ serviceName: "بوتكس", doctorName: "د. سحر" })).toBe("COLLECTING");
  });

  it("should return COLLECTING when draft has serviceName + timeSlot but no doctorName", () => {
    expect(inferBookingStage({ serviceName: "بوتكس", timeSlot: "10:00" })).toBe("COLLECTING");
  });

  it("should return COLLECTING when draft has all fields but some are null", () => {
    expect(inferBookingStage({
      serviceName: "بوتكس",
      doctorName: null,
      timeSlot: "10:00",
    })).toBe("COLLECTING");
  });

  it("should return CONFIRMING when draft has serviceName + doctorName + timeSlot", () => {
    expect(inferBookingStage({
      serviceName: "بوتكس",
      doctorName: "د. سحر",
      timeSlot: "10:00 ص",
    })).toBe("CONFIRMING");
  });

  it("should return CONFIRMING when draft has all booking fields", () => {
    expect(inferBookingStage({
      clientName: "سميرة",
      clientPhone: "+966501234567",
      serviceName: "بوتكس",
      doctorName: "د. سحر",
      branchName: "فرع الصحافة",
      timeSlot: "10:00 ص",
    })).toBe("CONFIRMING");
  });
});

// ── Draft Persistence Decision ──────────────────────────────────────────────

describe("determineDraftToSave", () => {
  const sampleDraft = {
    clientName: "سميرة",
    serviceName: "بوتكس",
    branchName: "فرع الصحافة",
  };
  const updatedDraft = {
    ...sampleDraft,
    timeSlot: "10:00 ص",
  };

  // ── Timeout Rules ─────────────────────────────────────────────────────────

  describe("timeout rules", () => {
    it("should return null when timed out (regardless of other state)", () => {
      const result = determineDraftToSave(
        "Inquiry", true, false, false, sampleDraft, updatedDraft
      );
      expect(result).toBeNull();
    });

    it("should return null when timed out even with booking intent", () => {
      const result = determineDraftToSave(
        "BookAppointment", true, false, false, sampleDraft, updatedDraft
      );
      expect(result).toBeNull();
    });

    it("should return null when timed out even with no previous draft", () => {
      const result = determineDraftToSave(
        "Inquiry", true, false, false, null, { serviceName: "بوتكس" }
      );
      expect(result).toBeNull();
    });
  });

  // ── Booking Completion Rules ──────────────────────────────────────────────

  describe("booking completion rules", () => {
    it("should return null when booking was created", () => {
      const result = determineDraftToSave(
        "BookAppointment", false, true, false, sampleDraft, updatedDraft
      );
      expect(result).toBeNull();
    });

    it("should return null when booking was modified", () => {
      const result = determineDraftToSave(
        "ModifyBooking", false, false, true, sampleDraft, updatedDraft
      );
      expect(result).toBeNull();
    });

    it("should return null when both created and modified", () => {
      const result = determineDraftToSave(
        "BookAppointment", false, true, true, sampleDraft, updatedDraft
      );
      expect(result).toBeNull();
    });
  });

  // ── Non-Booking Intent in Active Flow (THE FIX) ───────────────────────────

  describe("non-booking intent in active flow — preserve draft", () => {
    it("should preserve draft on Inquiry when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "Inquiry", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on Complaint when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "Complaint", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on Objection when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "Objection", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on Unknown when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "Unknown", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on Greeting when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "Greeting", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on GeneralQuestion when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        "GeneralQuestion", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on HumanTakeover when in COLLECTING stage", () => {
      // HumanTakeover == true means the AI failed; we should still preserve the draft
      const result = determineDraftToSave(
        "HumanTakeover", false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on undefined/null intent when in COLLECTING stage", () => {
      const result = determineDraftToSave(
        null, false, false, false, sampleDraft, null
      );
      expect(result).toBe(sampleDraft);
    });

    it("should preserve draft on Inquiry when in CONFIRMING stage", () => {
      const confirmingDraft = {
        serviceName: "بوتكس",
        doctorName: "د. سحر",
        timeSlot: "10:00 ص",
      };
      const result = determineDraftToSave(
        "Inquiry", false, false, false, confirmingDraft, null
      );
      expect(result).toBe(confirmingDraft);
    });

    it("should preserve draft even when modifiedBookingData has null booking fields", () => {
      // This simulates the exact bug scenario: modifiedBookingData nulls all booking fields
      const nulledData = {
        clientName: "سميرة",
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };
      const result = determineDraftToSave(
        "Inquiry", false, false, false, sampleDraft, nulledData
      );
      // Should preserve the original draft, not write the nulled data
      expect(result).toBe(sampleDraft);
      expect(result).not.toBe(nulledData);
      expect((result as any).serviceName).toBe("بوتكس");
    });
  });

  // ── Booking Intent During Active Flow ─────────────────────────────────────

  describe("booking intent during active flow — update draft", () => {
    it("should write modifiedBookingData on BookAppointment when in COLLECTING", () => {
      const result = determineDraftToSave(
        "BookAppointment", false, false, false, sampleDraft, updatedDraft
      );
      expect(result).toBe(updatedDraft);
      expect((result as any).timeSlot).toBe("10:00 ص");
    });

    it("should write modifiedBookingData on ModifyBooking when in COLLECTING", () => {
      const result = determineDraftToSave(
        "ModifyBooking", false, false, false, sampleDraft, updatedDraft
      );
      expect(result).toBe(updatedDraft);
    });
  });

  // ── IDLE Stage Behavior ───────────────────────────────────────────────────

  describe("IDLE stage behavior", () => {
    it("should write modifiedBookingData when IDLE and intent is BookAppointment", () => {
      const result = determineDraftToSave(
        "BookAppointment", false, false, false, null, { serviceName: "بوتكس" }
      );
      expect(result).toEqual({ serviceName: "بوتكس" });
    });

    it("should write modifiedBookingData when IDLE and intent is Inquiry (no draft)", () => {
      // Inquiry from fresh conversation — no draft to preserve
      const result = determineDraftToSave(
        "Inquiry", false, false, false, null, { serviceName: null }
      );
      expect(result).toEqual({ serviceName: null });
    });

    it("should write modifiedBookingData when IDLE and intent is Unknown (no draft)", () => {
      const result = determineDraftToSave(
        "Unknown", false, false, false, null, {}
      );
      expect(result).toEqual({});
    });
  });

  // ── SCENARIO: Booking → Inquiry → Continue Booking ────────────────────────

  describe("regression scenario: Booking → Inquiry → Continue Booking", () => {
    it("TURN 1: BookAppointment in IDLE → should write extracted booking data", () => {
      const result = determineDraftToSave(
        "BookAppointment", false, false, false, null,
        { clientName: null, serviceName: "بوتكس", doctorName: null, branchName: null, timeSlot: null }
      );
      expect((result as any).serviceName).toBe("بوتكس");
    });

    it("TURN 2: Inquiry in COLLECTING (draft={service:بوتكس}) → should preserve draft", () => {
      const previousDraft = { clientName: null, serviceName: "بوتكس", doctorName: null, branchName: null, timeSlot: null };
      const nulledModifiedData = { clientName: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null };
      
      const result = determineDraftToSave(
        "Inquiry", false, false, false, previousDraft, nulledModifiedData
      );
      
      expect((result as any).serviceName).toBe("بوتكس");
      expect(result).toBe(previousDraft);
    });

    it("TURN 3: BookAppointment in COLLECTING → should write updated data", () => {
      const previousDraft = { clientName: null, serviceName: "بوتكس", doctorName: null, branchName: null, timeSlot: null };
      const updatedData = { clientName: null, serviceName: "بوتكس", doctorName: null, branchName: "فرع الصحافة", timeSlot: null };
      
      const result = determineDraftToSave(
        "BookAppointment", false, false, false, previousDraft, updatedData
      );
      
      expect((result as any).branchName).toBe("فرع الصحافة");
      expect(result).toBe(updatedData);
    });
  });

  // ── SCENARIO: Explicit Cancellation ───────────────────────────────────────

  describe("regression scenario: explicit cancellation", () => {
    it("CancelBooking should clear draft when draft is present", () => {
      const result = determineDraftToSave(
        "CancelBooking", false, false, false, sampleDraft, null
      );
      // CancelBooking is not in NON_BOOKING_INTENTS_FOR_DRAFT, so it falls to default
      // which returns modifiedBookingData (null). But this shows CancelBooking should
      // be handled like booking completion — the BusinessEngine returns bookingCreated/modified
      // or the intent itself isn't preserved. So this test validates the correct edge case.
      expect(result).toBeNull();
    });
  });

  // ── SCENARIO: Price Question During Booking ──────────────────────────────

  describe("regression scenario: price question during booking", () => {
    it("should preserve draft when user asks 'كم السعر؟' (Inquiry) mid-booking", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس", branchName: "فرع الصحافة" };
      const result = determineDraftToSave(
        "Inquiry", false, false, false, draft, { clientName: "سميرة", serviceName: null, branchName: null, timeSlot: null }
      );
      expect(result).toBe(draft);
      expect((result as any).serviceName).toBe("بوتكس");
    });
  });

  // ── SCENARIO: Available Times Question During Booking ─────────────────────

  describe("regression scenario: 'what times are available?' during booking", () => {
    it("should preserve draft when user asks about availability (Inquiry)", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس", doctorName: "د. سحر", branchName: "فرع الصحافة" };
      const result = determineDraftToSave(
        "Inquiry", false, false, false, draft, null
      );
      expect(result).toBe(draft);
    });
  });

  // ── SCENARIO: Doctor Question During Booking ──────────────────────────────

  describe("regression scenario: doctor question during booking", () => {
    it("should preserve draft when user asks 'which doctor?' (Inquiry)", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس", branchName: "فرع الصحافة" };
      const result = determineDraftToSave(
        "Inquiry", false, false, false, draft, { clientName: "سميرة", serviceName: null, branchName: null, timeSlot: null }
      );
      expect(result).toBe(draft);
    });
  });

  // ── SCENARIO: Complaint During Booking → Booking Cancelled ────────────────

  describe("regression scenario: complaint during booking", () => {
    it("Complaint should preserve draft (not cancel the booking flow)", () => {
      // Complaint is treated as a non-booking intent that preserves the draft.
      // If the complaint leads to cancellation, that would come as CancelBooking intent.
      const draft = { clientName: "سميرة", serviceName: "بوتكس" };
      const result = determineDraftToSave(
        "Complaint", false, false, false, draft, null
      );
      expect(result).toBe(draft);
    });
  });

  // ── SCENARIO: Multiple Inquiries During Booking ───────────────────────────

  describe("regression scenario: multiple inquiries during booking", () => {
    it("should preserve draft across multiple consecutive inquiries", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس", branchName: "فرع الصحافة" };
      
      // Inquiry 1
      const r1 = determineDraftToSave("Inquiry", false, false, false, draft, null);
      expect(r1).toBe(draft);
      
      // Inquiry 2 (using the preserved draft as input for next turn)
      const r2 = determineDraftToSave("Inquiry", false, false, false, r1, null);
      expect(r2).toBe(r1);
      expect((r2 as any).serviceName).toBe("بوتكس");
      
      // Inquiry 3
      const r3 = determineDraftToSave("Inquiry", false, false, false, r2, null);
      expect(r3).toBe(r2);
      expect((r3 as any).serviceName).toBe("بوتكس");
      
      // Final booking turn
      const finalData = { clientName: "سميرة", serviceName: "بوتكس", branchName: "فرع الصحافة", timeSlot: "10:00 ص" };
      const r4 = determineDraftToSave("BookAppointment", false, false, false, r3, finalData);
      expect(r4).toBe(finalData);
      expect((r4 as any).timeSlot).toBe("10:00 ص");
    });
  });

  // ── SCENARIO: Normal Inquiry (No Active Booking) ──────────────────────────

  describe("regression scenario: normal inquiry with no active booking", () => {
    it("should not create a draft from scratch for Inquiry when in IDLE", () => {
      const result = determineDraftToSave(
        "Inquiry", false, false, false, null, { clientName: null, serviceName: null }
      );
      // null previousDraft → IDLE → non-booking intent → write modifiedBookingData
      // (which is null/empty — no draft created)
      expect(result).toEqual({ clientName: null, serviceName: null });
    });
  });

  // ── SCENARIO: Booking Completed → Draft Cleared ───────────────────────────

  describe("regression scenario: booking completed — draft cleared", () => {
    it("should return null when booking is created", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس", doctorName: "د. سحر", branchName: "فرع الصحافة", timeSlot: "10:00 ص" };
      const result = determineDraftToSave(
        "BookAppointment", false, true, false, draft, draft
      );
      expect(result).toBeNull();
    });
  });

  // ── SCENARIO: Booking Timeout ─────────────────────────────────────────────

  describe("regression scenario: booking timeout — draft expired", () => {
    it("should return null when timedOut is true", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس" };
      const result = determineDraftToSave(
        "BookAppointment", true, false, false, draft, draft
      );
      expect(result).toBeNull();
    });

    it("should clear draft even if a non-booking intent caused the timeout", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس" };
      const result = determineDraftToSave(
        "Inquiry", true, false, false, draft, null
      );
      expect(result).toBeNull();
    });
  });

  // ── SCENARIO: Explicit Booking Cancellation ───────────────────────────────

  describe("regression scenario: explicit cancellation — draft cleared", () => {
    it("CancelAppointment intent should not preserve draft", () => {
      const draft = { clientName: "سميرة", serviceName: "بوتكس" };
      // CancelAppointment is not in NON_BOOKING_INTENTS_FOR_DRAFT
      const result = determineDraftToSave(
        "CancelAppointment", false, false, false, draft, null
      );
      expect(result).toBeNull();
    });
  });
});
