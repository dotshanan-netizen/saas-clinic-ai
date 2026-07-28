import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog } from "../../lib/domain/types";

// Mock BookingService to return empty slots (simulating the production scenario
// where getAvailableSlots returns {} despite zero bookings).
// BusinessEngine imports BookingService dynamically (await import()),
// so vi.mock at module level intercepts it regardless.
vi.mock("../../lib/domain/BookingService", () => ({
  BookingService: {
    getAvailableSlots: vi.fn().mockResolvedValue({}),
  },
}));

// ── Shared Mock Clinic ───────────────────────────────────────────────────────
const mockClinic: ClinicWithCatalog = {
  id: "clinic-diag-test",
  name: "عيادة اختبار التشخيص",
  countryCode: "SA",
  allowedCountries: "SA",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  branches: [{ id: "b1", name: "فرع الاختبار" }],
  doctors: [
    {
      id: "d1",
      name: "د. تشخيص",
      specialty: "اختبار",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-diag-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds1", doctorId: "d1", serviceId: "s1", createdAt: new Date(),
          service: { id: "s1", name: "خدمة اختبار", description: null, duration: 30, price: 100, clinicId: "clinic-diag-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
  ],
  services: [{ id: "s1", name: "خدمة اختبار", price: 100 }],
};

const SENDER_PHONE = "+966501234567";

describe("Booking Diagnostics — Empty Slots Logging", () => {
  let capturedLogs: string[];

  beforeEach(() => {
    capturedLogs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      capturedLogs.push(args.map((a: any) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject slot and emit NO_SLOTS_AVAILABLE diagnostic when getAvailableSlots returns {}", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز عند د. تشخيص بكره الساعة 3 العصر",
      {
        intent: "BookAppointment",
        response: "حياك الله",
        bookingData: {
          clientName: "مريض",
          clientPhone: null,
          serviceName: "خدمة اختبار",
          doctorName: "د. تشخيص",
          branchName: "فرع الاختبار",
          timeSlot: "الإثنين (27 يوليو) 03:00 م",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp"
    );

    // Behavioral contract: slot rejected
    expect(result.bookingCreated).toBe(false);
    expect(result.finalResponse).toContain("محجوز للأسف");

    // PF-005: timeSlot cleared from state
    expect(result.modifiedBookingData?.timeSlot).toBeNull();

    // PF-005: booking context preserved
    expect(result.modifiedBookingData?.clientName).toBe("مريض");
    expect(result.modifiedBookingData?.serviceName).toBe("خدمة اختبار");
    expect(result.modifiedBookingData?.doctorName).toBe("د. تشخيص");
    expect(result.modifiedBookingData?.branchName).toBe("فرع الاختبار");

    // Verify DOUBBLE_BOOKING_GUARD_NO_SLOT diagnostic was emitted
    const noSlotEvents = capturedLogs.filter((log) => log.includes("DOUBLE_BOOKING_GUARD_NO_SLOT"));
    expect(noSlotEvents.length).toBeGreaterThanOrEqual(1);

    // Verify the diagnostic has the expected structure
    const parsedEvent = JSON.parse(noSlotEvents[0]);
    expect(parsedEvent.event).toBe("DOUBLE_BOOKING_GUARD_NO_SLOT");
    // When getAvailableSlots returns {}, the failureMode must be NO_SLOTS_AVAILABLE
    expect(parsedEvent.failureMode).toBe("NO_SLOTS_AVAILABLE");
    // totalSlotsChecked must be 0
    expect(parsedEvent.totalSlotsChecked).toBe(0);
    // availableDays must be empty
    expect(parsedEvent.availableDays).toEqual([]);
    // Diagnostic must include the hint
    expect(parsedEvent.hint).toContain("getAvailableSlots returned ZERO slots");
  });

  it("should preserve context and clear timeSlot on subsequent turn after slot rejection", async () => {
    // ─── Turn 1: Slot rejected ─────────────────────────────────────────────
    const turn1 = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز عند د. تشخيص بكره الساعة 3 العصر",
      {
        intent: "BookAppointment",
        response: "حياك الله",
        bookingData: {
          clientName: "مريض",
          clientPhone: null,
          serviceName: "خدمة اختبار",
          doctorName: "د. تشخيص",
          branchName: "فرع الاختبار",
          timeSlot: "الإثنين (27 يوليو) 03:00 م",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp"
    );

    expect(turn1.finalResponse).toContain("محجوز للأسف");
    expect(turn1.modifiedBookingData?.timeSlot).toBeNull();

    // ─── Turn 2: Greeting → must NOT repeat the unavailable-slot message ──
    const turn2 = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "السلام عليكم",
      {
        intent: "Inquiry",
        response: "وعليكم السلام! 🌸",
        bookingData: {
          clientName: null,
          clientPhone: null,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
      turn1.modifiedBookingData!
    );

    // Must NOT repeat the unavailable slot message
    expect(turn2.finalResponse).not.toContain("لم يعد متاحاً");
    // Greeting → no stale state inheritance → correctly classified as Inquiry
    expect(turn2.resolvedIntent).toBe("Inquiry");
  });
});
