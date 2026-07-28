import { describe, it, expect, vi, beforeEach } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { TimeNormalizer } from "../../lib/domain/TimeNormalizer";
import { ClinicWithCatalog, validateBookingData } from "../../lib/domain/types";
import { prismaMock } from "../singleton";

// ── Shared Mock Clinic ───────────────────────────────────────────────────────
// Matches the production clinic catalog for all regression scenarios.
const mockClinic: ClinicWithCatalog = {
  id: "clinic-golden-test",
  name: "عيادة الاختبارات الذهبية",
  customPrompt: null,
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [
    { id: "b-press", name: "فرع الصحافة" },
    { id: "b-tahliya", name: "فرع التحلية" },
  ],
  doctors: [
    {
      id: "d-sahar",
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-golden-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds-botox",
          doctorId: "d-sahar",
          serviceId: "s-botox",
          createdAt: new Date(),
          service: { id: "s-botox", name: "بوتكس", description: null, duration: 30, price: 500, clinicId: "clinic-golden-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
    {
      id: "d-noura",
      name: "الأخصائية نورة",
      specialty: "بشرة",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-golden-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds-clean",
          doctorId: "d-noura",
          serviceId: "s-clean",
          createdAt: new Date(),
          service: { id: "s-clean", name: "تنظيف بشرة", description: null, duration: 30, price: 300, clinicId: "clinic-golden-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
    {
      id: "d-ahmed",
      name: "د. أحمد",
      specialty: "جراحة",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-golden-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds-consult1",
          doctorId: "d-ahmed",
          serviceId: "s-consult",
          createdAt: new Date(),
          service: { id: "s-consult", name: "كشفية", description: null, duration: 15, price: 100, clinicId: "clinic-golden-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
    {
      id: "d-ali",
      name: "د. علي",
      specialty: "جلدية",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-golden-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds-consult2",
          doctorId: "d-ali",
          serviceId: "s-consult",
          createdAt: new Date(),
          service: { id: "s-consult", name: "كشفية", description: null, duration: 15, price: 100, clinicId: "clinic-golden-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
  ],
  services: [
    { id: "s-botox", name: "بوتكس", price: 500 },
    { id: "s-clean", name: "تنظيف بشرة", price: 300 },
    { id: "s-consult", name: "كشفية", price: 100 },
  ],
};

const senderPhone = "+966501234567";
const SENDER_PHONE_MOCK = "+966500000001";

// ── Golden Regression Suite ──────────────────────────────────────────────────

describe("Golden Regression Suite (G001–G010)", () => {

  // ────────────────────────────────────────────────────────────────────────────
  // G001: Happy Path — Full Booking
  //   Complete valid data → validation passes, doctor auto-resolved
  // ────────────────────────────────────────────────────────────────────────────
  it("G001: should validate a complete booking with auto-resolved doctor", () => {
    const result = validateBookingData(
      {
        clientName: "فريال",
        clientPhone: "0501234567",
        serviceName: "تنظيف بشرة",
        doctorName: null,
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص",
      },
      senderPhone,
      mockClinic,
    );

    expect(result.isValid).toBe(true);
    expect(result.cleanName).toBe("فريال");
    expect(result.normalizedService).toBe("تنظيف بشرة");
    // Single-doctor service → auto-resolve
    expect(result.normalizedDoctor).toBe("الأخصائية نورة");
    expect(result.normalizedBranch).toBe("فرع الصحافة");
    expect(result.cleanTimeSlot).toMatch(/10:00 ص$/);
    expect(result.missingFields).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G002: Memory Across Messages
  //   When AI omits a known field, BusinessEngine falls back to currentState
  // ────────────────────────────────────────────────────────────────────────────
  it("G002: should preserve service name from currentState when AI omits it", async () => {
    // Simulate message 2: user provides service name, AI extracts it
    const result1 = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "أبغى أحجز تنظيف بشرة",
      {
        intent: "BookAppointment",
        response: "حياك الله 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "تنظيف بشرة",
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
    );

    expect(result1.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");

    // Simulate message 3: AI omits serviceName (returns null), but currentState still has it
    const stateAfterMsg1 = result1.modifiedBookingData!;
    const result2 = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "اسمي فريال",
      {
        intent: "BookAppointment",
        response: "تسعدني خدمتك يا فريال 🌸",
        bookingData: {
          clientName: null,     // AI extracts null (already known)
          clientPhone: null,
          serviceName: null,    // AI omits it
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
      stateAfterMsg1,
    );

    // Service name must survive from currentState
    expect(result2.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(result2.modifiedBookingData?.clientName).toBe("فريال");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G003: Doctor Not Found
  //   Non-existent doctor on multi-doctor service → validation fails gracefully
  // ────────────────────────────────────────────────────────────────────────────
  it("G003: should fail validation gracefully when doctor not found for multi-doctor service", () => {
    const result = validateBookingData(
      {
        clientName: "سارة",
        clientPhone: "0501234567",
        serviceName: "كشفية",
        doctorName: "دكتورة غير موجودة",
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص",
      },
      senderPhone,
      mockClinic,
    );

    // Validation fails, no crash
    expect(result.isValid).toBe(false);
    // Doctor is required when service has multiple doctors
    expect(result.missingFields).toContain("الطبيب المفضل");
    // Other fields should be fine
    expect(result.normalizedService).toBe("كشفية");
    expect(result.normalizedBranch).toBe("فرع الصحافة");
    expect(result.cleanName).toBe("سارة");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G004: Service Not Found
  //   Non-existent service → validation fails gracefully
  // ────────────────────────────────────────────────────────────────────────────
  it("G004: should fail validation gracefully when service does not exist", () => {
    const result = validateBookingData(
      {
        clientName: "نورة",
        clientPhone: "0501234567",
        serviceName: "خدمة غير موجودة",
        doctorName: null,
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص",
      },
      senderPhone,
      mockClinic,
    );

    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("الخدمة المطلوبة");
    expect(result.normalizedService).toBeNull();
    // Should NOT crash
    expect(result.cleanName).toBe("نورة");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G005: Availability Inquiry (No Escalation)
  //   When AI provides time availability in its response, Inquiry must NOT
  //   escalate to BookAppointment (PF-003 fix).
  // ────────────────────────────────────────────────────────────────────────────
  it("G005: should NOT escalate Inquiry to BookAppointment when AI provides availability", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "إيه المواعيد المتاحة بكرة؟",
      {
        intent: "Inquiry",
        // AI response contains a time match → aiProvidedAvailability = true
        response: "المواعيد المتاحة بكرة: 10:00 ص, 11:00 ص",
        bookingData: {
          clientName: null,
          clientPhone: null,
          serviceName: "تنظيف بشرة",
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
    );

    // Must stay as Inquiry — not escalated to BookAppointment
    expect(result.resolvedIntent).toBe("Inquiry");
    // No booking should be created
    expect(result.bookingCreated).toBe(false);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G006: Arabic-Indic Numerals
  //   "٤ العصر" → normalizes to "04:00 م"
  // ────────────────────────────────────────────────────────────────────────────
  it("G006: should normalize Arabic-Indic numeral ٤ to 04:00 PM (عصر)", () => {
    const result = TimeNormalizer.normalize("٤ العصر");

    expect(result).not.toBeNull();
    expect(result).toContain("04:00 م");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G007: بكرة Without Time
  //   "بكرة" with no hour → returns null (asks for time)
  // ────────────────────────────────────────────────────────────────────────────
  it('G007: should return null for "بكرة" without any time expression', () => {
    const result = TimeNormalizer.normalize("بكرة");

    // No specific hour → should return null to trigger missing time prompt
    expect(result).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G008: Merge Guard — First Extraction
  //   When currentState is empty (first message), AI extraction is trusted.
  //   The Merge Guard must NOT block the first extraction.
  // ────────────────────────────────────────────────────────────────────────────
  it("G008: should trust AI extraction when currentState is empty (first message)", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "عاوزة احجز تنظيف بشرة اسمي فريال",
      {
        intent: "BookAppointment",
        response: "حياك الله 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "تنظيف بشرة",
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
      // No currentState → first extraction (defaults to empty inside processIntent)
    );

    expect(result.modifiedBookingData?.clientName).toBe("فريال");
    expect(result.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    // Must NOT be blocked or cleared
    expect(result.bookingCreated).toBe(false); // Incomplete data → not created
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G009: Calendar ≠ Memory — State Trap Prevention
  //   When a slot is unavailable, modifiedBookingData.timeSlot MUST be
  //   nullified to prevent the conversation state from trapping on the
  //   next user message (the "unavailable slot loop" bug PF-005).
  //   The user should be prompted to choose a new time instead.
  //   This test mocks prisma so that getAvailableSlots returns a schedule that
  //   does NOT include the requested time.
  // ────────────────────────────────────────────────────────────────────────────
  it("G009: should clear timeSlot from modifiedBookingData when slot is unavailable to prevent state trap", async () => {
    // Mock doctor with a schedule that doesn't include the requested time
    // This causes the Double Booking Guard to find no matching slot.
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: "d-noura",
      name: "الأخصائية نورة",
      clinicId: "clinic-golden-test",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      schedules: [
        {
          id: "sch-morning",
          doctorId: "d-noura",
          dayOfWeek: "MONDAY",
          startTime: "09:00",
          endTime: "12:00",
          isClosed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as any);

    // No existing bookings
    prismaMock.booking.findMany.mockResolvedValue([]);

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "أبغى أحجز",
      {
        intent: "BookAppointment",
        response: "جاري التحقق من المواعيد 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "تنظيف بشرة",
          doctorName: "الأخصائية نورة",
          branchName: "فرع الصحافة",
          timeSlot: "الإثنين 02:00 م", // Afternoon — not in schedule (09-12)
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
    );

    // Booking should NOT be created (slot unavailable)
    expect(result.bookingCreated).toBe(false);
    // ARCHITECTURAL RULE: Unavailable slot MUST nullify timeSlot in modifiedBookingData
    // to prevent conversation state trap (PF-005). The user's other booking context
    // (name, service, doctor, branch) is preserved — only the unavailable time is cleared.
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
    expect(result.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(result.modifiedBookingData?.doctorName).toBe("الأخصائية نورة");
    expect(result.modifiedBookingData?.branchName).toBe("فرع الصحافة");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // G010: Double Booking Prevention
  //   When a concurrent booking creates a conflict, the second request must
  //   fail gracefully without crashing. This test mocks the transaction to
  //   throw the DOUBLE_BOOKING error.
  // ────────────────────────────────────────────────────────────────────────────
  it("G010: should handle double-booking conflict gracefully", async () => {
    // Mock doctor with a schedule covering the requested time
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: "d-noura",
      name: "الأخصائية نورة",
      clinicId: "clinic-golden-test",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      schedules: [
        {
          id: "sch-full",
          doctorId: "d-noura",
          dayOfWeek: "MONDAY",
          startTime: "09:00",
          endTime: "17:00",
          isClosed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as any);

    // No existing bookings (slots available)
    prismaMock.booking.findMany.mockResolvedValue([]);

    // No existing booking for this client
    prismaMock.booking.findFirst.mockResolvedValue(null);

    // Mock the transaction to throw DOUBLE_BOOKING (simulating a concurrent conflict)
    prismaMock.$transaction.mockRejectedValue(new Error("DOUBLE_BOOKING"));

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE_MOCK,
      "أبغى أحجز",
      {
        intent: "BookAppointment",
        response: "جاري تأكيد الحجز 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "تنظيف بشرة",
          doctorName: "الأخصائية نورة",
          branchName: "فرع الصحافة",
          timeSlot: "الإثنين 10:00 ص",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
    );

    // Booking must NOT be created
    expect(result.bookingCreated).toBe(false);
    // Response must be the graceful double-booking/race-condition message
    expect(result.finalResponse).toContain("أُخذ للتو");
    // No crash
    expect(result.finalResponse).toBeTruthy();
  });
});
