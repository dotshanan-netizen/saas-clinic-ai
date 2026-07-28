import { describe, it, expect, vi, beforeEach } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog, ExtractedBookingData } from "../../lib/domain/types";

// ── Configurable mock for BookingService ────────────────────────────────────
// Tests that need empty slots (greeting after failed booking) set this to {}.
// Tests that need continuation (choosing another slot) set this to populated data.
let mockAvailableSlots: Record<string, string[]> = {};

vi.mock("../../lib/domain/BookingService", () => ({
  BookingService: {
    getAvailableSlots: vi.fn().mockImplementation(() => Promise.resolve(mockAvailableSlots)),
  },
}));

// ── Mock Clinic ─────────────────────────────────────────────────────────────
const mockClinic: ClinicWithCatalog = {
  id: "clinic-lifecycle-test",
  name: "عيادة اختبار دورة حياة الحجز",
  countryCode: "SA",
  allowedCountries: "SA",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  branches: [
    { id: "b1", name: "فرع الاختبار" },
    { id: "b2", name: "فرع التحلية" },
    { id: "b3", name: "فرع الصحافة" },
  ],
  doctors: [
    {
      id: "d1", name: "د. سحر", specialty: "جلدية وتجميل",
      imageUrl: null, status: "ACTIVE", clinicId: "clinic-lifecycle-test", createdAt: new Date(),
      services: [{ id: "ds1", doctorId: "d1", serviceId: "s1", createdAt: new Date(),
        service: { id: "s1", name: "تنظيف بشرة", description: null, duration: 30, price: 150,
          clinicId: "clinic-lifecycle-test", status: "ACTIVE", createdAt: new Date() } }],
    },
    {
      id: "d2", name: "د. أحمد", specialty: "جراحة",
      imageUrl: null, status: "ACTIVE", clinicId: "clinic-lifecycle-test", createdAt: new Date(),
      services: [{ id: "ds2", doctorId: "d2", serviceId: "s2", createdAt: new Date(),
        service: { id: "s2", name: "كشفية", description: null, duration: 15, price: 100,
          clinicId: "clinic-lifecycle-test", status: "ACTIVE", createdAt: new Date() } }],
    },
  ],
  services: [
    { id: "s1", name: "تنظيف بشرة", price: 150 },
    { id: "s2", name: "كشفية", price: 100 },
  ],
};

const SENDER = "+966501234567";

describe("Booking State Lifecycle — Stale State Prevention", () => {

  beforeEach(() => {
    // Default: empty slots (simulating slot-unavailable scenario).
    // Tests that need available slots override this.
    mockAvailableSlots = {};
  });

  // ── Helper: build a booking AI result ───────────────────────────────────────
  function bookingAI(overrides?: Partial<{
    intent: string;
    response: string;
    name: string | null;
    phone: string | null;
    service: string | null;
    doctor: string | null;
    branch: string | null;
    time: string | null;
  }>) {
    const o = overrides || {};
    return {
      intent: o.intent ?? "BookAppointment",
      response: o.response ?? "جاري التحقق من المواعيد 🌸",
      bookingData: {
        clientName: o.name ?? null,
        clientPhone: o.phone ?? null,
        serviceName: o.service ?? null,
        doctorName: o.doctor ?? null,
        branchName: o.branch ?? null,
        timeSlot: o.time ?? null,
      },
      requiresRag: false,
      humanTakeover: false,
    };
  }

  // ── Helper: build an inquiry/greeting AI result ─────────────────────────────
  function greetingAI(response?: string) {
    return {
      intent: "Inquiry",
      response: response ?? "وعليكم السلام! كيف أقدر أساعدك؟ 🌸",
      bookingData: { clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null },
      requiresRag: false,
      humanTakeover: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: Greeting after failed booking
  // ═══════════════════════════════════════════════════════════════════════════
  it("G001-SL: greeting after failed booking must NOT inherit stale booking state", async () => {
    // ── Turn 1: Booking with unavailable slot ──────────────────────────────
    const turn1 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "أبغى أحجز عند د. سحر بكره الساعة 3 العصر",
      bookingAI({ name: "فريال", service: "تنظيف بشرة", doctor: "د. سحر", branch: "فرع الاختبار", time: "الأحد (27 يوليو) 03:00 م" }),
      "WhatsApp"
    );
    expect(turn1.finalResponse).toContain("محجوز للأسف");
    // PF-005: timeSlot cleared
    expect(turn1.modifiedBookingData?.timeSlot).toBeNull();
    // Other fields preserved in modifiedBookingData (this is the state handed to next turn)
    expect(turn1.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(turn1.modifiedBookingData?.doctorName).toBe("د. سحر");

    // ── Turn 2: Greeting ───────────────────────────────────────────────────
    const turn2 = await BusinessEngine.processIntent(
      mockClinic, SENDER, "السلام عليكم",
      greetingAI(),
      "WhatsApp",
      turn1.modifiedBookingData!  // ← stale state has booking data
    );

    // The greeting must NOT inherit stale booking state
    expect(turn2.finalResponse).not.toContain("محجوز للأسف");
    expect(turn2.resolvedIntent).toBe("Inquiry");
    // Booking-specific fields must be null in modifiedBookingData
    expect(turn2.modifiedBookingData?.serviceName).toBeNull();
    expect(turn2.modifiedBookingData?.doctorName).toBeNull();
    expect(turn2.modifiedBookingData?.branchName).toBeNull();
    expect(turn2.modifiedBookingData?.timeSlot).toBeNull();
    // Customer identity (name) persists across conversations
    expect(turn2.modifiedBookingData?.clientName).toBe("فريال");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: Greeting after successful booking (state with all booking data)
  // ═══════════════════════════════════════════════════════════════════════════
  it("G002-SL: greeting after previous booking must not inherit stale state", async () => {
    // Simulate state from previous booking (all fields populated)
    const previousState: ExtractedBookingData = {
      clientName: "نورة",
      clientPhone: "+966501234567",
      serviceName: "تنظيف بشرة",
      doctorName: "د. سحر",
      branchName: "فرع الاختبار",
      timeSlot: "الإثنين (27 يوليو) 10:00 ص",
    };

    const result = await BusinessEngine.processIntent(
      mockClinic, SENDER, "هلا",
      greetingAI("هلا وغلا! 🌸"),
      "WhatsApp",
      previousState
    );

    // Must return greeting response, not booking-related
    expect(result.finalResponse).not.toContain("لم يعد متاحاً");
    expect(result.resolvedIntent).toBe("Inquiry");
    // Booking-specific fields must NOT leak from previous state
    expect(result.modifiedBookingData?.serviceName).toBeNull();
    expect(result.modifiedBookingData?.doctorName).toBeNull();
    expect(result.modifiedBookingData?.branchName).toBeNull();
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
    // Identity preserved
    expect(result.modifiedBookingData?.clientName).toBe("نورة");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Greeting after long inactivity (stale state with all data)
  // ═══════════════════════════════════════════════════════════════════════════
  it("G003-SL: greeting after inactivity must not inherit stale booking state", async () => {
    const staleState: ExtractedBookingData = {
      clientName: "سارة",
      clientPhone: null,
      serviceName: "كشفية",
      doctorName: "د. أحمد",
      branchName: "فرع التحلية",
      timeSlot: "الثلاثاء (28 يوليو) 04:00 م",
    };

    const result = await BusinessEngine.processIntent(
      mockClinic, SENDER, "السلام عليكم",
      greetingAI(),
      "WhatsApp",
      staleState
    );

    expect(result.resolvedIntent).toBe("Inquiry");
    expect(result.modifiedBookingData?.serviceName).toBeNull();
    expect(result.modifiedBookingData?.doctorName).toBeNull();
    expect(result.modifiedBookingData?.branchName).toBeNull();
    expect(result.modifiedBookingData?.timeSlot).toBeNull();
    expect(result.modifiedBookingData?.clientName).toBe("سارة");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: New booking request after failed booking
  // ̲When AI correctly classifies the new request as BookAppointment,
  //  the active session gate allows inheritance and continuation.
  // ═══════════════════════════════════════════════════════════════════════════
  it("G004-SL: new explicit booking request after failed booking should continue booking flow", async () => {
    // ── Turn 1: Failed booking (all data, slot unavailable) ───────────────
    const turn1 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "أبغى أحجز تنظيف بشرة عند د. سحر فرع الاختبار بكره 3 العصر",
      bookingAI({ name: "فريال", service: "تنظيف بشرة", doctor: "د. سحر", branch: "فرع الاختبار", time: "الإثنين (27 يوليو) 03:00 م" }),
      "WhatsApp"
    );
    expect(turn1.modifiedBookingData?.timeSlot).toBeNull();
    expect(turn1.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");

    // ── Turn 2: User says "عاوزة أحجز" and AI correctly recognizes booking intent
    // (AI returns BookAppointment with the new information)
    const turn2 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "عاوزة أحجز عند د. سحر",
      bookingAI({ name: "فريال", service: "تنظيف بشرة", doctor: "د. سحر", branch: "فرع الاختبار", time: null }),
      "WhatsApp",
      turn1.modifiedBookingData!
    );

    // AI returned BookAppointment → active session → inheritance works
    // Booking fields should be inherited from turn1 state
    expect(turn2.resolvedIntent).toBe("BookAppointment");
    expect(turn2.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(turn2.modifiedBookingData?.doctorName).toBe("د. سحر");
    expect(turn2.modifiedBookingData?.branchName).toBe("فرع الاختبار");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 5: Genuine booking continuation (mid-booking progression)
  // ═══════════════════════════════════════════════════════════════════════════
  it("G005-SL: genuine mid-booking continuation preserves extracted state", async () => {
    // Turn 1: User provides name and service, AI extracts them
    const turn1 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "اسمي فريال أبغى أحجز تنظيف بشرة",
      bookingAI({ name: "فريال", service: "تنظيف بشرة" }),
      "WhatsApp"
    );
    expect(turn1.modifiedBookingData?.clientName).toBe("فريال");
    expect(turn1.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");

    // Turn 2: User provides branch, AI extracts it with BookAppointment intent
    const turn2 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "فرع الصحافة",
      bookingAI({ name: "فريال", service: "تنظيف بشرة", doctor: null, branch: "فرع الصحافة" }),
      "WhatsApp",
      turn1.modifiedBookingData!
    );

    // AI returned BookAppointment → active session → inheritance preserves previous fields
    expect(turn2.resolvedIntent).toBe("BookAppointment");
    expect(turn2.modifiedBookingData?.clientName).toBe("فريال");
    expect(turn2.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(turn2.modifiedBookingData?.branchName).toBe("فرع الصحافة");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 6: Slot unavailable then choosing another slot
  // ═══════════════════════════════════════════════════════════════════════════
  it("G006-SL: choosing a new slot after unavailable-slot rejection should work", async () => {
    // ── Turn 1: Slot unavailable → timeSlot cleared ───────────────────────
    const turn1 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "أبغى أحجز عند د. سحر بكره 3 العصر",
      bookingAI({ name: "فريال", service: "تنظيف بشرة", doctor: "د. سحر", branch: "فرع الاختبار", time: "الإثنين (27 يوليو) 03:00 م" }),
      "WhatsApp"
    );
    expect(turn1.finalResponse).toContain("محجوز للأسف");
    expect(turn1.modifiedBookingData?.timeSlot).toBeNull();
    // Other context preserved for continuation
    expect(turn1.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(turn1.modifiedBookingData?.doctorName).toBe("د. سحر");

    // ── Turn 2: User picks a new time, AI extracts it with booking intent ──
    // Make the new slot available so DOUBLE_BOOKING_GUARD doesn't reject it
    mockAvailableSlots = {
      "الإثنين (27 يوليو)": ["الإثنين (27 يوليو) 10:00 ص"],
    };
    const turn2 = await BusinessEngine.processIntent(
      mockClinic, SENDER,
      "طيب 10 الصباح",
      bookingAI({
        name: "فريال", service: "تنظيف بشرة", doctor: "د. سحر",
        branch: "فرع الاختبار", time: "الإثنين (27 يوليو) 10:00 ص",
      }),
      "WhatsApp",
      turn1.modifiedBookingData!
    );

    // AI returned BookAppointment → active session → inheritance preserves context
    expect(turn2.resolvedIntent).toBe("BookAppointment");
    // Booking context from turn1 is preserved
    expect(turn2.modifiedBookingData?.serviceName).toBe("تنظيف بشرة");
    expect(turn2.modifiedBookingData?.doctorName).toBe("د. سحر");
    expect(turn2.modifiedBookingData?.branchName).toBe("فرع الاختبار");
    // New time is set
    expect(turn2.modifiedBookingData?.timeSlot).toBe("الإثنين (27 يوليو) 10:00 ص");
  });
});
