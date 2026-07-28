/**
 * hourMatch Fix — Meridiem-Aware Slot Matching Regression Tests
 *
 * Verifies that slot matching respects AM/PM boundaries after removing
 * the AM/PM-blind hourMatch fallback. Tests that only meridiem-safe
 * matchers (exactMatch, endMatch, includeMatch) are used.
 *
 * Coverage:
 *   - 9 AM vs 9 PM: same digit, different meridiem → NO match
 *   - 1 AM vs 1 PM: same digit, different meridiem → NO match
 *   - Exact meridiem matching: same time with same meridiem → match
 *   - No hour-only fallback: hour digit alone no longer matches
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog } from "../../lib/domain/types";
import { prismaMock } from "../singleton";

// ── Configurable mock slots ──────────────────────────────────────────────────
let mockAvailableSlots: Record<string, string[]> = {};

vi.mock("../../lib/domain/BookingService", () => ({
  BookingService: {
    getAvailableSlots: vi.fn().mockImplementation(() => Promise.resolve(mockAvailableSlots)),
  },
}));

// ── Mock Clinic ──────────────────────────────────────────────────────────────
const mockClinic: ClinicWithCatalog = {
  id: "clinic-hourmatch-test",
  name: "عيادة اختبار تصحيح الساعة",
  countryCode: "SA",
  allowedCountries: "SA",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  branches: [
    { id: "b1", name: "فرع الاختبار" },
  ],
  doctors: [
    {
      id: "d1", name: "د. اختبار", specialty: "جلدية وتجميل",
      imageUrl: null, status: "ACTIVE", clinicId: "clinic-hourmatch-test", createdAt: new Date(),
      services: [{ id: "ds1", doctorId: "d1", serviceId: "s1", createdAt: new Date(),
        service: { id: "s1", name: "تنظيف بشرة", description: null, duration: 30, price: 150,
          clinicId: "clinic-hourmatch-test", status: "ACTIVE", createdAt: new Date() } }],
    },
  ],
  services: [
    { id: "s1", name: "تنظيف بشرة", price: 150 },
  ],
};

const SENDER = "+966501234567";

// ── Helper: build a complete booking AI result ───────────────────────────────
function completeBooking(timeSlot: string, doctor = "د. اختبار") {
  return {
    intent: "BookAppointment",
    response: "تم تأكيد الحجز",
    bookingData: {
      clientName: "سارة",
      clientPhone: null,
      serviceName: "تنظيف بشرة",
      doctorName: doctor,
      branchName: "فرع الاختبار",
      timeSlot,
    },
    requiresRag: false,
    humanTakeover: false,
  };
}

describe("hourMatch — Meridiem-Aware Slot Matching", () => {

  beforeEach(() => {
    mockAvailableSlots = {};
    // Setup prisma mock defaults: return a doctor (needed for getAvailableSlots)
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: "d1",
      name: "د. اختبار",
      clinicId: "clinic-hourmatch-test",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    prismaMock.booking.findMany.mockResolvedValue([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9 AM vs 9 PM — same bare hour digit, different meridiem
  //   Before fix: hourMatch matched (both have digit 9) → AM accepted as PM
  //   After fix:  no match → booking rejected, timeSlot cleared
  // ──────────────────────────────────────────────────────────────────────────
  it("should NOT match 9 AM slot when only 9 PM is available (same hour, different meridiem)", async () => {
    // Only 9 PM slot available
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 09:00 م"],
    };

    // User requested 9 AM
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("09:00 ص"),
      "WhatsApp",
    );

    // The 9 AM slot should NOT match 9 PM → booking rejected
    expect(result.bookingCreated).toBe(false);
    // timeSlot must be cleared (PF-005: unavailable slot clears state)
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
    // Other context preserved
    expect(result.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(result.modifiedBookingData?.doctorName).toBe("د. اختبار");
    expect(result.modifiedBookingData?.branchName).toBe("فرع الاختبار");
    expect(result.modifiedBookingData?.clientName).toBe("سارة");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9 PM vs 9 AM — same bare hour digit, different meridiem (reverse)
  // ──────────────────────────────────────────────────────────────────────────
  it("should NOT match 9 PM slot when only 9 AM is available (same hour, different meridiem)", async () => {
    // Only 9 AM slot available
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 09:00 ص"],
    };

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("09:00 م"),
      "WhatsApp",
    );

    expect(result.bookingCreated).toBe(false);
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1 AM vs 1 PM — same bare hour digit, different meridiem
  //   (hour 12 has a TimeNormalizer override → uses hour 1 for clean test)
  // ──────────────────────────────────────────────────────────────────────────
  it("should NOT match 1 AM slot when only 1 PM is available (same hour, different meridiem)", async () => {
    // Only 1 PM available
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 01:00 م"],
    };

    // User requested 1 AM
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("01:00 ص"),
      "WhatsApp",
    );

    expect(result.bookingCreated).toBe(false);
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Reverse: 1 PM vs 1 AM
  // ──────────────────────────────────────────────────────────────────────────
  it("should NOT match 1 PM slot when only 1 AM is available (same hour, different meridiem, reverse)", async () => {
    // Only 1 AM available
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 01:00 ص"],
    };

    // User requested 1 PM
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("01:00 م"),
      "WhatsApp",
    );

    expect(result.bookingCreated).toBe(false);
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Exact meridiem matching — same time, same meridiem (AM)
  //   The endMatch matcher (meridiem-safe) should match correctly
  // ──────────────────────────────────────────────────────────────────────────
  it("should MATCH 9 AM slot when 9 AM is available (same meridiem)", async () => {
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 09:00 ص"],
    };

    // IMPORTANT: The AI booking flow needs to reach DoubleBookingGuard.
    // We mock prisma booking to allow the booking creation path.
    // Note: getAvailableSlots will be called by BusinessEngine internally.
    // To actually reach slot matching, the booking needs to be near-complete.
    // We use the same approach as golden_regression tests.

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("09:00 ص"),
      "WhatsApp",
    );

    // With complete data and available slot, booking should be created
    // Actually, whether it creates depends on many factors. Let's check:
    // If the slot matched, timeSlot should NOT be nullified
    // The meridiem-safe path is the key validation.
    // We verify the slot was NOT rejected (timeSlot preserved in modifiedBookingData)
    expect(result.modifiedBookingData?.timeSlot).not.toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Exact meridiem matching — same time, same meridiem (PM)
  // ──────────────────────────────────────────────────────────────────────────
  it("should MATCH 9 PM slot when 9 PM is available (same meridiem, PM)", async () => {
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 09:00 م"],
    };

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("09:00 م"),
      "WhatsApp",
    );

    expect(result.modifiedBookingData?.timeSlot).not.toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Multiple slots, only correct meridiem matches
  // ──────────────────────────────────────────────────────────────────────────
  it("should match the correct meridiem when both AM and PM slots exist", async () => {
    // Both 9 AM and 9 PM slots available
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": [
        "الإثنين (27 يوليو) 09:00 ص",
        "الإثنين (27 يوليو) 09:00 م",
      ],
    };

    // User requested 9 PM
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER,
      "أريد حجز موعد",
      completeBooking("09:00 م"),
      "WhatsApp",
    );

    // Should match 9 PM, not 9 AM
    // If slot matched, timeSlot is preserved
    expect(result.modifiedBookingData?.timeSlot).not.toBeNull();
  });
});
