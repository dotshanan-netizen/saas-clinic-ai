/**
 * PR-001: Time Mutation (B1 Regression)
 *
 * Scenario: User provides an explicit 24-hour time "23:00".
 * Before the B1 fix (TimeNormalizer regex [0-1]? → [0-2]?), hours 20-23
 * were incorrectly parsed, causing "23:00" to normalize to "11:00 ص" (AM)
 * instead of "11:00 م" (PM).
 *
 * This fixture tests that:
 * 1. TimeExtractor correctly extracts "23:00" as "11:00 م"
 * 2. The deterministic override takes priority over LLM extraction
 * 3. The final modifiedBookingData has the correct PM time
 */

import type { ReplayFixture } from "../types";

const fixture: ReplayFixture = {
  incidentId: "PR-001",
  incidentName: "time-mutation",
  description:
    "User says 'الموعد 23:00'. TimeNormalizer regex [0-1]? failed to match " +
    "hour 23, causing the time to be treated as unknown or incorrectly " +
    "normalized. Fix: expanded regex to [0-2]? to support hours 20-23.",
  rootCause:
    "BUG-B1: TimeNormalizer.ts regex /[0-1]?[0-9]:[0-5][0-9]/ used [0-1]? which " +
    "rejects hours 20-23. Changed to [0-2]? to accept hours 0-23. " +
    "Committed in 32a823f.",
  replayStatus: "PASSING",
  level: 1,

  clinic: {
    id: "clinic-pr-001",
    name: "عيادة اختبار PR-001",
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
    // ── Step 1: User initiates booking ─────────────────────────────
    {
      userMessage: "أبغى أحجز بوتكس عند دكتورة سحر",
      l1AiResult: {
        intent: "BookAppointment",
        response: "حياك الله في عيادتنا 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: "+966500000001",
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: null,
          timeSlot: null,
        },
        requiresRag: false,
        humanTakeover: false,
      },
      expect: {
        modifiedBookingData: {
          clientName: "فريال",
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: null, // User hasn't mentioned branch yet
          timeSlot: null,
        },
        resolvedIntent: "BookAppointment",
        bookingCreated: false,
        bookingModified: false,
      },
    },

    // ── Step 2: User provides 24-hour time "23:00" ────────────────
    // TimeExtractor matches Pattern 3 (24h HH:MM): "23:00" → hour=23,
    // isPM=true → normalized="11:00 م", isAmbiguous=false.
    // The deterministic time "11:00 م" OVERRIDES whatever the AI extracts.
    {
      userMessage: "الموعد 23:00",
      l1AiResult: {
        intent: "BookAppointment",
        response: "تمام، حجزنا لك",
        bookingData: {
          clientName: null,
          clientPhone: null,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: "11:00 ص", // ← LLM incorrectly extracts AM
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
          branchName: null, // User never mentioned branch in either step
          timeSlot: "11:00 م", // ← MUST be PM, overridden by deterministic time
        },
        resolvedIntent: "BookAppointment",
        // TimeExtractor trace must show the correct parsed time
        traceDeterministicParsedTime: "11:00 م",
      },
    },
  ],
};

export default fixture;
