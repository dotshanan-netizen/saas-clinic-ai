/**
 * P0 Regression — Booking Intent Reliability
 *
 * Verifies that common Arabic booking phrases are correctly classified
 * as BookAppointment by BOTH the AIProvider safeguard AND the
 * BusinessEngine escalation.
 *
 * Tested phrases:
 *   - "أريد الحجز"      ← the original failing phrase
 *   - "عاوزة احجز"
 *   - "أبغى أحجز"
 *   - "أبي موعد"
 *   - "أحتاج موعد"
 *   - "بحجز"
 *   - "ممكن أحجز"
 *
 * Layers tested:
 *   1. AIProvider.post-AI safeguard (deterministic regex correction)
 *   2. BusinessEngine.isNewBookingRequest escalation
 *   3. Full pipeline through ConversationEngine (via BusinessEngine)
 */

import "dotenv/config";
import { describe, it, expect } from "vitest";
import { AIProvider } from "../../lib/infrastructure/ai/AIProvider";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog, ChatMessage, ExtractedBookingData } from "../../lib/domain/types";

// ── Mock Clinic ───────────────────────────────────────────────────────────────
const mockClinic: ClinicWithCatalog = {
  id: "regression-clinic-booking-intent",
  name: "عيادة اختبار نية الحجز",
  customPrompt: null,
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [
    { id: "b1", name: "فرع الصحافة" },
    { id: "b2", name: "فرع التحلية" },
  ],
  doctors: [
    {
      id: "d1", name: "د. سارة", specialty: "جلدية وتجميل",
      services: [
        { service: { name: "فيلر" } },
        { service: { name: "بوتوكس" } },
      ],
    },
  ],
  services: [
    { id: "s1", name: "فيلر", price: 1500 },
    { id: "s2", name: "بوتوكس", price: 1000 },
  ],
};

const SENDER_PHONE = "+966501234567";

// ── Helper: build conversation history for a first-turn booking phrase ────────
function buildHistory(message: string): ChatMessage[] {
  return [
    {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    },
  ];
}

// ── Helper: build 2-turn conversation history (greeting → booking request) ──
function buildMultiTurnHistory(bookingMessage: string): ChatMessage[] {
  return [
    {
      role: "user",
      content: "السلام عليكم",
      timestamp: new Date(Date.now() - 10000).toISOString(),
    },
    {
      role: "assistant",
      content: "وعليكم السلام! كيف أقدر أساعدك؟ 🌸",
      timestamp: new Date(Date.now() - 5000).toISOString(),
    },
    {
      role: "user",
      content: bookingMessage,
      timestamp: new Date().toISOString(),
    },
  ];
}

// ── Helper: run a booking phrase through AIProvider + BusinessEngine ──────────
async function testBookingPhrase(phrase: string): Promise<{
  aiIntent: string;
  aiResponse: string;
  aiTimeSlot: string | null;
  beIntent: string;
  beResponse: string;
  beTimeSlot: string | null;
}> {
  const history = buildHistory(phrase);
  const currentState: Record<string, unknown> = {
    clientName: null,
    clientPhone: null,
    serviceName: null,
    doctorName: null,
    branchName: null,
    timeSlot: null,
  };

  // Step 1: AIProvider
  const aiResult = await AIProvider.classifyIntentAndExtractData(
    mockClinic,
    history,
    "WhatsApp",
    currentState,
    "",
    ""
  );

  // Step 2: BusinessEngine
  const beResult = await BusinessEngine.processIntent(
    mockClinic,
    SENDER_PHONE,
    phrase,
    {
      intent: aiResult.intent,
      bookingData: aiResult.bookingData,
      requiresRag: aiResult.requiresRag,
      response: aiResult.response,
      humanTakeover: aiResult.humanTakeover,
    },
    "WhatsApp",
    {
      clientName: null,
      clientPhone: null,
      serviceName: null,
      doctorName: null,
      branchName: null,
      timeSlot: null,
    }
  );

  return {
    aiIntent: aiResult.intent,
    aiResponse: aiResult.response,
    aiTimeSlot: aiResult.bookingData?.timeSlot || null,
    beIntent: beResult.resolvedIntent,
    beResponse: beResult.finalResponse,
    beTimeSlot: beResult.modifiedBookingData?.timeSlot || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: AIProvider Safeguard (deterministic regex correction)
// ═══════════════════════════════════════════════════════════════════════════════
describe("P0 — AIProvider Booking Intent Safeguard", () => {
  const phrases = [
    { text: "أريد الحجز",     label: "أريد الحجز" },
    { text: "عاوزة احجز",     label: "عاوزة احجز" },
    { text: "أبغى أحجز",      label: "أبغى أحجز" },
    { text: "أبي موعد",       label: "أبي موعد" },
    { text: "أحتاج موعد",     label: "أحتاج موعد" },
    { text: "بحجز",           label: "بحجز" },
    { text: "ممكن أحجز",      label: "ممكن أحجز" },
  ];

  phrases.forEach(({ text, label }) => {
    it(`should classify "${label}" as BookAppointment (AIProvider safeguard)`, async () => {
      const result = await testBookingPhrase(text);

      // The AIProvider safeguard at AIProvider.ts:258-269 corrects Unknown → BookAppointment
      // when the user message contains booking keywords.
      // This test documents the intent AFTER the safeguard has run.
      console.log(`[${label}] AI intent="${result.aiIntent}" → BE intent="${result.beIntent}" response="${result.aiResponse.substring(0, 80)}"`);

      // PRIMARY ASSERTION: After all safeguards, resolved intent is BookAppointment
      expect(result.beIntent).toBe("BookAppointment");

      // SECONDARY ASSERTION: Response is non-empty (either from AI or BusinessEngine fallback)
      expect(result.beResponse.length).toBeGreaterThan(0);

      // TERTIARY ASSERTION: timeSlot remains null (no phantom time)
      expect(result.beTimeSlot).toBeNull();
      expect(result.aiTimeSlot).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: BusinessEngine Escalation (safety net for Unknown intent)
// ═══════════════════════════════════════════════════════════════════════════════
describe("P0 — BusinessEngine Booking Intent Escalation", () => {
  const phrases = [
    { text: "أريد الحجز",  isBooking: true  },
    { text: "شكراً",        isBooking: false },
    { text: "عاوزة احجز",   isBooking: true  },
    { text: "أبغى أحجز",    isBooking: true  },
    { text: "أبي موعد",     isBooking: true  },
    { text: "أحتاج موعد",   isBooking: true  },
    { text: "بحجز",          isBooking: true  },
    { text: "ممكن أحجز",     isBooking: true  },
    { text: "السلام عليكم", isBooking: false },
    { text: "عاوزة ألغي",   isBooking: false },  // contains "ألغي" → not a booking request
  ];

  phrases.forEach(({ text, isBooking }) => {
    it(`should ${isBooking ? "ESCALATE" : "NOT escalate"} "${text}" via BusinessEngine`, async () => {
      const result = await BusinessEngine.processIntent(
        mockClinic,
        SENDER_PHONE,
        text,
        {
          intent: "Unknown",  // Simulate AI returning Unknown
          bookingData: {
            clientName: null,
            clientPhone: null,
            serviceName: null,
            doctorName: null,
            branchName: null,
            timeSlot: null,
          },
          requiresRag: false,
          response: "",
          humanTakeover: false,
        },
        "WhatsApp",
        {
          clientName: null,
          clientPhone: null,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: null,
        }
      );

      if (isBooking) {
        expect(result.resolvedIntent).toBe("BookAppointment");
        expect(result.finalResponse.length).toBeGreaterThan(0);
        console.log(`[BusinessEngine] "${text}" → intent="${result.resolvedIntent}" response="${result.finalResponse.substring(0, 80)}"`);
      } else {
        expect(result.resolvedIntent).not.toBe("BookAppointment");
      }

      // Never produce phantom timeSlot from these phrases alone
      expect(result.modifiedBookingData?.timeSlot).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Intent Pattern from User Message (isNewBookingRequest regex)
// ═══════════════════════════════════════════════════════════════════════════════
describe("P0 — isNewBookingRequest regex patterns", () => {
  // This mirrors the regex in BusinessEngine.ts:250
  const isBooking = (msg: string) =>
    /حجز|أحجز|موعد|احجز|عاوزة\s*احجز|عايز\s*احجز|أريد\s*الحجز|أبغى\s*(أحجز|موعد)|أبي\s*(أحجز|موعد)|أحتاج\s*(موعد|حجز)/i.test(msg)
    && !/تعديل|تغيير|تغير/i.test(msg);

  const tests = [
    { input: "أريد الحجز",      expected: true  },
    { input: "عاوزة احجز",      expected: true  },
    { input: "أبغى أحجز",       expected: true  },
    { input: "أبي موعد",        expected: true  },
    { input: "أحتاج موعد",      expected: true  },
    { input: "بحجز",            expected: true  },
    { input: "ممكن أحجز",       expected: true  },
    { input: "السلام عليكم",    expected: false },
    { input: "عاوزة ألغي",      expected: false },
    { input: "شكراً",           expected: false },
    { input: "عندي تعديل",      expected: false },  // "تعديل" excluded
    { input: "أريد تغيير",      expected: false },  // "تغيير" excluded
    { input: "أبغى أحجز موعد",  expected: true  },
    { input: "بدي حجز",         expected: true  },  // matches "حجز"
    { input: "موعد",            expected: true  },
    { input: "احجز",            expected: true  },
  ];

  tests.forEach(({ input, expected }) => {
    it(`regex match "${input}" → ${expected}`, () => {
      expect(isBooking(input)).toBe(expected);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Multi-turn Conversation Regression
// ═══════════════════════════════════════════════════════════════════════════════
// The P0 bug was only reproducible in multi-turn context: after a greeting →
// AI greeting response, the AI classifies booking phrases as "Inquiry" instead
// of "BookAppointment". This suite verifies the fix.
//
// Each test simulates:
//   Turn 1: "السلام عليكم" → AI returns Inquiry (greeting)
//   Turn 2: booking phrase → AI may return Inquiry → safeguards escalate
//
// The test verifies the FINAL resolved intent through both AIProvider safeguard
// AND BusinessEngine escalation.
// ═══════════════════════════════════════════════════════════════════════════════
describe("P0 — Multi-Turn Conversation Booking Intent", () => {
  const scenarios = [
    { label: "أريد الحجز",  text: "أريد الحجز" },
    { label: "عاوزة احجز",  text: "عاوزة احجز" },
    { label: "أبغى أحجز",   text: "أبغى أحجز" },
    { label: "ممكن أحجز",   text: "ممكن أحجز" },
  ];

  scenarios.forEach(({ label, text }) => {
    it(`should classify "${label}" as BookAppointment after greeting (multi-turn)`, async () => {
      const history = buildMultiTurnHistory(text);

      // Step 1: AIProvider with full conversation history (greeting + booking)
      const aiResult = await AIProvider.classifyIntentAndExtractData(
        mockClinic,
        history,
        "WhatsApp",
        {
          clientName: null,
          clientPhone: null,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
        "",
        ""
      );

      // State after greeting: phone auto-injected by BE, no booking data
      const currentState = {
        clientName: null,
        clientPhone: SENDER_PHONE,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };

      // Step 2: BusinessEngine with the booking phrase and post-greeting state
      const beResult = await BusinessEngine.processIntent(
        mockClinic,
        SENDER_PHONE,
        text,
        {
          intent: aiResult.intent,
          bookingData: aiResult.bookingData,
          requiresRag: aiResult.requiresRag,
          response: aiResult.response,
          humanTakeover: aiResult.humanTakeover,
        },
        "WhatsApp",
        currentState
      );

      console.log(`[MultiTurn/${label}] AI intent="${aiResult.intent}" → BE intent="${beResult.resolvedIntent}" response="${aiResult.response.substring(0, 80)}"`);

      // PRIMARY ASSERTION: resolved intent must be BookAppointment
      expect(beResult.resolvedIntent).toBe("BookAppointment");

      // SECONDARY ASSERTION: response is non-empty
      expect(beResult.finalResponse.length).toBeGreaterThan(0);

      // TERTIARY ASSERTION: no phantom timeSlot
      expect(beResult.modifiedBookingData?.timeSlot).toBeNull();
      expect(aiResult.bookingData?.timeSlot).toBeNull();
    });
  });
});
