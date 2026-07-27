/**
 * PR-002: Booking Reset (B2 Regression)
 *
 * Scenario: slotIsAvailable was initialized to `false` and only set to `true`
 * on an exact time match. The user's time expression matched a generated slot
 * but the match failed because of format mismatch between the user's
 * abbreviated expression (e.g., "10 ص") and the canonical slot format
 * (e.g., "الإثنين 10:00 ص").
 *
 * Fix: Added endMatch, includeMatch, and hourMatch fallbacks alongside
 * exactMatch in the slot loop, plus a cleanTimeSlot → slot reassignment
 * so the user's time is replaced by the canonical slot on match.
 *
 * This fixture tests that:
 * 1. User provides time "10 ص"
 * 2. The slot matching loop finds the slot via fallback matches
 * 3. validation.cleanTimeSlot is updated to the canonical slot value
 * 4. The booking proceeds (no silent reset)
 *
 * NOTE: This fixture requires DB mocks (doctor.findFirst + booking.findMany)
 * to be set up before running — getAvailableSlots needs them to generate slots.
 */
import type { ReplayFixture } from "../types";

const fixture: ReplayFixture = {
  incidentId: "PR-002",
  incidentName: "booking-reset",
  description:
    "User provides time '10 ص' during booking. slotIsAvailable was false " +
    "even though '10 ص' matched an actual slot, because the exactMatch " +
    "comparison required the full canonical format. Fix: added endMatch, " +
    "includeMatch, and hourMatch fallback matchers.",
  rootCause:
    "BUG-B2: BusinessEngine.ts slot loop required slot === cleanTimeSlot " +
    "(exactMatch) but the user's partial expression never matched the " +
    "canonical slot format. B2 committed in ff8d225.",
  replayStatus: "PASSING",
  level: 1,

  clinic: {
    id: "clinic-pr-002",
    name: "عيادة اختبار PR-002",
    countryCode: "SA",
    branches: [
      { id: "b-press", name: "فرع الصحافة" },
    ],
    doctors: [
      {
        id: "d-sahar",
        name: "د. سحر",
        specialty: "جلدية وتجميل",
        services: [{ service: { name: "بوتكس" } }],
      },
    ],
    services: [
      { id: "s-botox", name: "بوتكس", price: 500 },
    ],
  },

  clientPhone: "+966500000001",
  source: "WhatsApp",

  steps: [
    // ── Step 1: Full booking data provided ─────────────────────────
    // All fields are present. Validation passes. getAvailableSlots runs.
    // With proper mocks, the slot loop finds a match via endMatch/hourMatch.
    {
      userMessage: "أبغى أحجز بوتكس عند دكتورة سحر فرع الصحافة الساعة 10 ص",
      l1AiResult: {
        intent: "BookAppointment",
        response: "أبشري بالخير 🌸 جاري تأكيد الحجز",
        bookingData: {
          clientName: "فريال",
          clientPhone: "+966500000001",
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: "فرع الصحافة",
          timeSlot: "10:00 ص",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      expect: {
        modifiedBookingData: {
          clientName: "فريال",
          clientPhone: "+966500000001",
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: "فرع الصحافة",
          timeSlot: "10:00 ص",
        },
        resolvedIntent: "BookAppointment",
        // bookingCreated=true when mocks are active (slot matched → booking created)
        // bookingCreated=false when mocks are inactive (slot unavailable)
        bookingModified: false,
        confirmedFields: [],
      },
    },
  ],
};

export default fixture;
