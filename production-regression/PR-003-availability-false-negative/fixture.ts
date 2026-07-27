/**
 * PR-003: AM/PM Heuristic Bug (B3 Regression — DEFERRED)
 *
 * Scenario: TimeNormalizer uses a heuristic to infer AM/PM when the user
 * provides a bare hour (e.g., "10") without explicit ص/م indicators.
 * The heuristic sometimes misclassifies PM times as AM (or vice versa)
 * when the context words (صباح, مساء) are ambiguous or missing.
 *
 * Proposed fix (B3 — approved but pending CTO decision):
 * "D+B" approach: Deterministic first (explicit ص/م wins), then Bayesian
 * fallback using time-of-day priors from clinic schedules.
 *
 * This fixture is BLOCKED until B3 is implemented.
 * Once implemented, this fixture becomes a permanent regression test
 * proving that ambiguous times are resolved with correct AM/PM.
 */
import type { ReplayFixture } from "../types";

const fixture: ReplayFixture = {
  incidentId: "PR-003",
  incidentName: "availability-false-negative",
  description:
    "User says 'الساعة 10' without AM/PM. TimeNormalizer heuristic infers " +
    "AM incorrectly for an evening appointment. The heuristic uses simple " +
    "context matching (صباح → AM, مساء → PM) and defaults to AM for bare hours. " +
    "This causes false negatives in slot availability checks when the intended " +
    "time is PM.\n\n" +
    "(B3 approved by CTO but deferred — no implementation started.)",
  rootCause:
    "BUG-B3: TimeNormalizer AM/PM heuristic defaults bare hours to AM. " +
    "Fix: 'D+B' approach — deterministic explicit indicators first, then " +
    "Bayesian fallback using clinic schedule time-of-day priors. " +
    "Deferred pending CTO decision on implementation timing.",
  replayStatus: "BLOCKED",
  level: 1,

  clinic: {
    id: "clinic-pr-003",
    name: "عيادة اختبار PR-003",
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
    // ── Step 1: User provides bare hour without AM/PM ──────────────
    // CURRENT BEHAVIOR (before B3 fix): "10" → inferred as AM (incorrect for PM intent)
    // EXPECTED BEHAVIOR (after B3 fix): "10" → Bayesian priors → correct PM
    {
      userMessage: "أبغى أحجز بوتكس الساعة 10",
      l1AiResult: {
        intent: "BookAppointment",
        response: "حياك الله 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: "+966500000001",
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: "فرع الصحافة",
          timeSlot: "10:00 ص", // ← Current heuristic defaults to AM
        },
        requiresRag: false,
        humanTakeover: false,
      },
      expect: {
        modifiedBookingData: {
          timeSlot: "10:00 ص", // ← Placeholder: update when B3 lands
        },
        resolvedIntent: "BookAppointment",
        confirmedFields: [],
      },
    },
  ],
};

export default fixture;
