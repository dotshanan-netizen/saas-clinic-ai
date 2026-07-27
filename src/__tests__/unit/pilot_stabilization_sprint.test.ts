import { describe, it, expect, vi } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { TimeNormalizer } from "../../lib/domain/TimeNormalizer";
import { ClinicWithCatalog, validateBookingData } from "../../lib/domain/types";

// Mock BookingService for PF-005 (slot-unavailable state trap test).
// Returns empty slots so the Double Booking Guard rejects every requested time.
// Safe for existing tests: PF-001/002 don't call processIntent, PF-003/004 reach
// the HARD GATE (missing fields) before hitting the Double Booking Guard.
vi.mock("../../lib/domain/BookingService", () => ({
  BookingService: {
    getAvailableSlots: vi.fn().mockResolvedValue({}),
  },
}));

const mockClinic: ClinicWithCatalog = {
  id: "clinic-test-pilot",
  name: "عيادة الاختبار والتثبيت",
  countryCode: "SA",
  allowedCountries: "SA",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  branches: [
    {
      id: "b1",
      name: "الفرع الرئيسي",
      clinicId: "clinic-test-pilot",
      address: "الرياض",
      phone: "0110000000",
      status: "ACTIVE",
      createdAt: new Date(),
    }
  ],
  doctors: [
    {
      id: "d1",
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-test-pilot",
      createdAt: new Date(),
      services: [
        {
          id: "ds1",
          doctorId: "d1",
          serviceId: "s2",
          createdAt: new Date(),
          service: {
            id: "s2",
            name: "ليزر إزالة شعر",
            description: null,
            duration: 45,
            price: 300,
            clinicId: "clinic-test-pilot",
            status: "ACTIVE",
            createdAt: new Date()
          }
        }
      ]
    }
  ],
  services: [
    {
      id: "s1",
      name: "تنظيف بشرة",
      description: null,
      duration: 30,
      price: 150,
      clinicId: "clinic-test-pilot",
      status: "ACTIVE",
      createdAt: new Date()
    },
    {
      id: "s2",
      name: "ليزر إزالة شعر",
      description: null,
      duration: 45,
      price: 300,
      clinicId: "clinic-test-pilot",
      status: "ACTIVE",
      createdAt: new Date()
    }
  ]
};

describe("Pilot Stabilization Sprint - Advanced Regression Suite (PF-001, PF-002, PF-003, PF-004)", () => {

  // -------------------------------------------------------------------------
  // PF-001 REGRESSION TEST: WhatsApp International Phone Auto-Injection
  // -------------------------------------------------------------------------
  it("PF-001: should NOT trigger phone prompt or country restriction for international WhatsApp senders (+20...)", async () => {
    const internationalSenderPhone = "+201152276498";
    
    // Simulate production environment check
    process.env.NODE_ENV = "production";

    const validationResult = validateBookingData(
      {
        clientName: "فاطمة",
        clientPhone: internationalSenderPhone,
        serviceName: "تنظيف بشرة",
        doctorName: "د. سحر",
        branchName: "الفرع الرئيسي",
        timeSlot: "الأحد 10:00 ص",
        source: "WhatsApp"
      },
      internationalSenderPhone,
      mockClinic
    );

    // WhatsApp sender numbers must NEVER be phoneRestricted
    expect(validationResult.phoneRestricted).toBe(false);
    expect(validationResult.missingFields).not.toContain("رقم جوال للتواصل من (السعودية)");
    expect(validationResult.isValid).toBe(true);
  });

  // -------------------------------------------------------------------------
  // PF-002 REGRESSION TEST: Offered Slot Matching & 12 Noon / Typo Resolution
  // -------------------------------------------------------------------------
  it("PF-002: should resolve typos like 'السعة 6' and colloquial 'صباحي 12' to 12 PM noon", () => {
    const rawTypo = TimeNormalizer.normalize("السبت السعة 6");
    const rawNoonColloquial = TimeNormalizer.normalize("صباحي الساعة 12");

    expect(rawTypo).includes("06:00 م");
    expect(rawNoonColloquial).includes("12:00 م");
  });

  // -------------------------------------------------------------------------
  // PF-003 REGRESSION TEST: Dialogue Loop Break on Service Selection
  // -------------------------------------------------------------------------
  it("PF-003: should upgrade intent to BookAppointment and set service when user selects a service after Inquiry", async () => {
    const senderPhone = "+966501234567";
    const aiResult = {
      intent: "Inquiry",
      response: "عندنا عروض ممتازة على تنظيف البشرة والليزر! وش الخدمة اللي حابة تحجزيها؟",
      bookingData: {
        clientName: null,
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null
      },
      requiresRag: false,
      humanTakeover: false,
    };

    const result = await BusinessEngine.processIntent(
      mockClinic,
      senderPhone,
      "أبغى أحجز خدمة ليزر إزالة شعر",
      aiResult,
      "WhatsApp"
    );

    expect(result.resolvedIntent).toBe("BookAppointment");
    expect(result.modifiedBookingData?.serviceName).toBe("ليزر إزالة شعر");
  });

  // -------------------------------------------------------------------------
  // PF-005 REGRESSION TEST: Slot-Unavailable State Trap
  // -------------------------------------------------------------------------
  it("PF-005: should exit the unavailable-slot branch when user sends a new message after slot rejection", async () => {
    const senderPhone = "+966501234567";

    // ─── Turn 1: User books a time slot that is unavailable ─────────────────
    const turn1Result = await BusinessEngine.processIntent(
      mockClinic,
      senderPhone,
      "أبغى أحجز عند د. سحر بكره الساعة 3 العصر",
      {
        intent: "BookAppointment",
        response: "حياك الله",
        bookingData: {
          clientName: "فاطمة",
          clientPhone: null,
          serviceName: "ليزر إزالة شعر",
          doctorName: "د. سحر",
          branchName: "الفرع الرئيسي",
          timeSlot: "الأحد (27 يوليو) 03:00 ع",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp"
    );

    // Turn 1: Must report the slot is unavailable
    expect(turn1Result.finalResponse).toContain("لم يعد متاحاً");
    // Turn 1: modifiedBookingData must have timeSlot cleared so state doesn't trap
    expect(turn1Result.modifiedBookingData?.timeSlot).toBeNull();

    // ─── Turn 2: User sends a new message (greeting) ───────────────────────
    const turn2Result = await BusinessEngine.processIntent(
      mockClinic,
      senderPhone,
      "السلام عليكم",
      {
        intent: "Inquiry",
        response: "وعليكم السلام! كيف أقدر أساعدك؟ 🌸",
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
      // Use Turn 1's modifiedBookingData as currentState — this is what
      // ConversationEngine reconstructs from the assistant message's bookingData
      turn1Result.modifiedBookingData!
    );

    // Turn 2: Must NOT contain the "unavailable slot" message — the state trap is broken
    expect(turn2Result.finalResponse).not.toContain("لم يعد متاحاً");
    // Turn 2: Greeting ("السلام عليكم") is classified as Inquiry with null bookingData.
    // The active-session gate correctly prevents stale state inheritance.
    // The AI's original greeting response is returned instead of stale booking state.
    expect(turn2Result.resolvedIntent).toBe("Inquiry");
    // The conversation starts fresh, no stale booking data leaks
    expect(turn2Result.modifiedBookingData?.serviceName).toBeNull();
    expect(turn2Result.modifiedBookingData?.doctorName).toBeNull();
    expect(turn2Result.modifiedBookingData?.branchName).toBeNull();
    expect(turn2Result.modifiedBookingData?.timeSlot).toBeNull();
  });

  // -------------------------------------------------------------------------
  // PF-004 REGRESSION TEST: Composite Single-Message Multi-Entity Extraction
  // -------------------------------------------------------------------------
  it("PF-004: should extract Name, Service, and Doctor simultaneously from composite message", async () => {
    const senderPhone = "+966501234567";
    const aiResult = {
      intent: "BookAppointment",
      response: "حياك الله 🌸",
      bookingData: {
        clientName: "فريال",
        clientPhone: null,
        serviceName: "ليزر إزالة شعر",
        doctorName: "دكتورة سحر",
        branchName: null,
        timeSlot: null
      },
      requiresRag: false,
      humanTakeover: false,
    };

    const result = await BusinessEngine.processIntent(
      mockClinic,
      senderPhone,
      "اسمي فريال عاوزة تحجز ليزر إزالة شعر عند دكتورة سحر",
      aiResult,
      "WhatsApp"
    );

    expect(result.modifiedBookingData?.clientName).toBe("فريال");
    expect(result.modifiedBookingData?.serviceName).toBe("ليزر إزالة شعر");
    expect(result.modifiedBookingData?.doctorName).toBe("د. سحر");
  });

});
