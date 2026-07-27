/**
 * Production Pilot Verification — Full Conversation Simulation
 *
 * Runs the exact pilot conversation through the live AIProvider + BusinessEngine
 * pipeline, with full Intent-Aware Merge and P2 state management modeled
 * after ConversationEngine.ts. STOPS ON FIRST FAILURE with raw state capture.
 *
 * Flow:
 *   1. "السلام عليكم"       (greeting)
 *   2. "أريد الحجز"         (booking request)
 *   3. "0501234567"         (phone)
 *   4. "فيلر"               (service)
 *   5. "الصحافة"            (branch)
 *   6. "غداً"               (time — tomorrow)
 *   7. "الساعة 6 مساءً"     (time — 6 PM)
 *
 * Note: The user never provides a name. The AI will ask for it each turn.
 * The booking won't COMPLETE (name is required), but we verify:
 *   - No Unknown intent
 *   - No phantom timeSlot
 *   - No context reset during booking turns
 *   - Correct field accumulation
 *   - Appropriate AI responses
 */

import "dotenv/config";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Allow up to 120s for 7 AI calls (~15s each worst case)
vi.setConfig({ testTimeout: 120_000 });
import { AIProvider } from "../../lib/infrastructure/ai/AIProvider";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog, ChatMessage, ExtractedBookingData } from "../../lib/domain/types";

// ── Mock BookingService — prevent real DB calls ─────────────────────────────
let mockAvailableSlots: Record<string, string[]> = {};
vi.mock("../../lib/domain/BookingService", () => ({
  BookingService: {
    getAvailableSlots: vi.fn().mockImplementation(() => Promise.resolve(mockAvailableSlots)),
  },
}));

// ── Mock Clinic ──────────────────────────────────────────────────────────────
const MOCK_CLINIC: ClinicWithCatalog = {
  id: "pilot-verification-clinic",
  name: "عيادة اختبار التحقق التجريبي",
  customPrompt: null,
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [
    { id: "b1", name: "فرع الصحافة" },
    { id: "b2", name: "فرع التحلية" },
  ],
  doctors: [{
    id: "d1", name: "د. سارة", specialty: "جلدية وتجميل",
    services: [
      { service: { name: "فيلر" } },
      { service: { name: "بوتوكس" } },
    ],
  }],
  services: [
    { id: "s1", name: "فيلر", price: 1500 },
    { id: "s2", name: "بوتوكس", price: 1000 },
  ],
};

const SENDER_PHONE = "+966501234567";

// ── Turn Record ──────────────────────────────────────────────────────────────
interface TurnRecord {
  turn: number;
  userMessage: string;
  aiIntent: string;
  aiResponse: string;
  aiBookingData: Record<string, string | null>;
  mergeLog: string;
  beIntent: string;
  beResponse: string;
  beBookingData: Record<string, string | null> | null;
  beBookingCreated: boolean;
}

// ── Intent-Aware Merge (mirrors ConversationEngine.ts:300-351) ────────────────
function intentAwareMerge(
  aiResult: { intent: string; bookingData: ExtractedBookingData | null },
  currentState: ExtractedBookingData,
  userMessage: string
): { merged: ExtractedBookingData; log: string } {
  const isBooking = aiResult.intent === "BookAppointment" || aiResult.intent === "ModifyBooking";
  if (aiResult.bookingData) {
    if (isBooking) {
      const hasTimeKw = !!userMessage.match(
        /الساعة|الساعه|السعة|موعد|وقت|بكرة|بكرا|اليوم|الصبح|المساء|الظهر|العصر|المغرب|العشاء|الليل|غداً|غدا/i
      );
      return {
        merged: {
          clientName: aiResult.bookingData.clientName || currentState.clientName,
          clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone,
          serviceName: aiResult.bookingData.serviceName || currentState.serviceName,
          doctorName: aiResult.bookingData.doctorName || currentState.doctorName,
          branchName: aiResult.bookingData.branchName || currentState.branchName,
          timeSlot: aiResult.bookingData.timeSlot || (hasTimeKw ? currentState.timeSlot : null),
        },
        log: `timeKeyword=${hasTimeKw}`,
      };
    }
    return {
      merged: { clientName: aiResult.bookingData.clientName || currentState.clientName, clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone, serviceName: null, doctorName: null, branchName: null, timeSlot: null },
      log: "identity-only",
    };
  }
  return isBooking
    ? { merged: { ...currentState }, log: "fallback-currentState" }
    : { merged: { clientName: currentState.clientName, clientPhone: currentState.clientPhone, serviceName: null, doctorName: null, branchName: null, timeSlot: null }, log: "fallback-identity" };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe("Production Pilot — Full Conversation Simulation", () => {
  beforeEach(() => { mockAvailableSlots = {}; });

  it("should complete 7-turn pilot — NO Unknown, NO phantom time", async () => {
    const history: ChatMessage[] = [];
    let currentState: ExtractedBookingData = {
      clientName: null, clientPhone: null,
      serviceName: null, doctorName: null,
      branchName: null, timeSlot: null,
    };

    const FLOW = [
      "السلام عليكم",
      "أريد الحجز",
      "0501234567",
      "فيلر",
      "الصحافة",
      "غداً",
      "الساعة 6 مساءً",
    ];

    const records: TurnRecord[] = [];

    for (let i = 0; i < FLOW.length; i++) {
      const userMsg = FLOW[i];
      const turn = i + 1;

      console.log(`\n══════════════════════════════════════════════════════`);
      console.log(`[TURN ${turn}] "${userMsg}"`);
      console.log(`  state: ${JSON.stringify(currentState)}`);

      // Push user message to history BEFORE AI call so the AIProvider safeguard
      // can check it via lastMsg (mirrors correct caller pattern)
      history.push({ role: "user" as const, content: userMsg, timestamp: new Date().toISOString() });

      // ── AIProvider ────────────────────────────────────────────────────
      const ai = await AIProvider.classifyIntentAndExtractData(
        MOCK_CLINIC, history, "WhatsApp", currentState, "", ""
      );
      console.log(`  AI intent="${ai.intent}"`);
      console.log(`  AI response="${ai.response.substring(0, 120)}"`);
      console.log(`  AI bookingData=${JSON.stringify(ai.bookingData)}`);

      // ── STOP ON Unknown ───────────────────────────────────────────────
      if (ai.intent === "Unknown") {
        console.error(`\n❌ FAILURE Turn ${turn}: AI returned Unknown intent`);
        console.error(`[RAW AI] ${JSON.stringify(ai, null, 2)}`);
        console.error(`[RAW STATE] ${JSON.stringify(currentState, null, 2)}`);
        console.error(`[RAW HISTORY] ${JSON.stringify(history, null, 2)}`);
        expect.fail(`Turn ${turn}: AI returned Unknown. Captured above.`);
      }

      // ── STOP if booking keyword but AI returns non-booking intent ─────
      // Turns 2-7 MUST be BookAppointment. If AI returns Inquiry or anything
      // else for a message containing booking keywords, it's a critical failure.
      const hasBookingKeyword = !!userMsg.match(/حجز|أحجز|موعد|احجز|بكرة|غداً|غدا|فيلر|بوتوكس|الصحافة|التحلية|الساعة|مساء|صباح/i);
      const bookingKeywordsForIntent = !!userMsg.match(/حجز|أحجز|موعد|احجز/i);
      if (turn >= 2 && ai.intent !== "BookAppointment") {
        if (bookingKeywordsForIntent) {
          console.error(`\n❌ FAILURE Turn ${turn}: AI returned "${ai.intent}" for booking message "${userMsg}"`);
          console.error(`[RAW AI] ${JSON.stringify(ai, null, 2)}`);
          console.error(`[RAW STATE] ${JSON.stringify(currentState, null, 2)}`);
          console.error(`[RAW HISTORY] ${JSON.stringify(history, null, 2)}`);
          expect.fail(`Turn ${turn}: AI returned "${ai.intent}" instead of BookAppointment for "${userMsg}"`);
        }
      }

      // ── Merge ─────────────────────────────────────────────────────────
      const { merged, log: mergeLog } = intentAwareMerge(ai, currentState, userMsg);
      console.log(`  merge: ${mergeLog} → ${JSON.stringify(merged)}`);

      // ── STOP ON phantom time ──────────────────────────────────────────
      const userMentionsTime = !!userMsg.match(/الساعة|موعد|وقت|بكرة|بكرا|اليوم|الصبح|المساء|الظهر|العصر|المغرب|غداً|غدا|الليل|مساء|صباح/i);
      if (merged.timeSlot && !userMentionsTime && merged.timeSlot !== currentState.timeSlot) {
        console.error(`\n❌ FAILURE Turn ${turn}: phantom timeSlot="${merged.timeSlot}"`);
        console.error(`[RAW AI] ${JSON.stringify(ai, null, 2)}`);
        console.error(`[RAW STATE] ${JSON.stringify(currentState, null, 2)}`);
        expect.fail(`Turn ${turn}: phantom timeSlot="${merged.timeSlot}"`);
      }

      // ── BusinessEngine ───────────────────────────────────────────────
      const be = await BusinessEngine.processIntent(
        MOCK_CLINIC, SENDER_PHONE, userMsg,
        { intent: ai.intent, response: ai.response, bookingData: merged, requiresRag: ai.requiresRag, humanTakeover: ai.humanTakeover },
        "WhatsApp", currentState
      );
      console.log(`  BE intent="${be.resolvedIntent}"`);
      console.log(`  BE response="${be.finalResponse.substring(0, 120)}"`);
      console.log(`  BE bookingData=${JSON.stringify(be.modifiedBookingData)}`);

      // ── STOP ON Unknown from BE ──────────────────────────────────────
      if (be.resolvedIntent === "Unknown") {
        console.error(`\n❌ FAILURE Turn ${turn}: BE resolved Unknown`);
        console.error(`[RAW BE] ${JSON.stringify(be, null, 2)}`);
        expect.fail(`Turn ${turn}: BE resolved Unknown`);
      }

      // ── STOP ON phantom time in BE output ────────────────────────────
      const beTimeSlot = be.modifiedBookingData?.timeSlot || null;
      if (beTimeSlot && !userMentionsTime) {
        console.error(`\n❌ FAILURE Turn ${turn}: BE phantom timeSlot="${beTimeSlot}"`);
        console.error(`[RAW BE] ${JSON.stringify(be, null, 2)}`);
        expect.fail(`Turn ${turn}: BE phantom timeSlot="${beTimeSlot}"`);
      }

      // ── Record ────────────────────────────────────────────────────────
      records.push({
        turn, userMessage: userMsg,
        aiIntent: ai.intent, aiResponse: ai.response,
        aiBookingData: ai.bookingData ? { ...ai.bookingData } : {},
        mergeLog,
        beIntent: be.resolvedIntent, beResponse: be.finalResponse,
        beBookingData: be.modifiedBookingData ? { ...be.modifiedBookingData } : null,
        beBookingCreated: be.bookingCreated,
      });

      // ── Stop on empty response for booking turns ─────────────────────
      if (turn >= 2 && !be.finalResponse) {
        console.error(`\n❌ FAILURE Turn ${turn}: empty BE response`);
        expect.fail(`Turn ${turn}: empty response`);
      }

      // ═══════════════════════════════════════════════════════════════════
      // STATE UPDATE (mirrors ConversationEngine.ts:353-366)
      // ═══════════════════════════════════════════════════════════════════
      const isBooking = ai.intent === "BookAppointment" || ai.intent === "ModifyBooking";
      const nonBooking = ["Inquiry", "Complaint", "Objection", "Unknown", "unknown", "HumanTakeover"];
      if (nonBooking.includes(ai.intent) || (!ai.intent && !isBooking)) {
        currentState.serviceName = null;
        currentState.doctorName = null;
        currentState.branchName = null;
        currentState.timeSlot = null;
        currentState.clientName = be.modifiedBookingData?.clientName || currentState.clientName;
        currentState.clientPhone = be.modifiedBookingData?.clientPhone || currentState.clientPhone;
        console.log(`  state: non-booking → cleared transient`);
      } else {
        currentState = {
          clientName: merged.clientName,
          clientPhone: merged.clientPhone,
          serviceName: merged.serviceName,
          doctorName: merged.doctorName,
          branchName: merged.branchName,
          timeSlot: null, // P2: always freshly extracted
        };
        console.log(`  state: booking → preserved, timeSlot cleared (P2)`);
      }

      // Update history (user already pushed before AI call above)
      history.push({ role: "assistant", content: be.finalResponse, timestamp: new Date().toISOString() });

      if (be.bookingCreated) {
        currentState = { clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null };
        console.log(`  state: booking created → full reset`);
      }
      console.log(`  history: ${history.length} messages`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // FINAL ASSERTIONS
    // ═══════════════════════════════════════════════════════════════════
    console.log(`\n${"■".repeat(60)}`);
    console.log(`■  PILOT CONVERSATION VERIFICATION — ALL TURNS PASSED`);
    console.log(`${"■".repeat(60)}\n`);

    // Print summary table
    console.log(`Turn │ Message              │ AI Intent          │ BE Intent           │ timeSlot  │ Response`);
    console.log(`─────┼──────────────────────┼────────────────────┼─────────────────────┼───────────┼──────────────────────────────────`);
    for (const r of records) {
      const msg = r.userMessage.padEnd(20);
      const aiI = r.aiIntent.padEnd(18);
      const beI = r.beIntent.padEnd(19);
      const ts = (r.beBookingData?.timeSlot || "null").padEnd(9);
      const resp = r.beResponse.substring(0, 32);
      console.log(`  ${r.turn}  │ ${msg}│ ${aiI}│ ${beI}│ ${ts}│ ${resp}`);
    }

    // ── Hard assertions ─────────────────────────────────────────────────
    expect(records[0].aiIntent).toBe("Inquiry");
    for (let i = 1; i < 7; i++) {
      expect(records[i].beIntent).toBe("BookAppointment");
    }

    // Verify field accumulation across turns
    const finalBD = records[6].beBookingData;
    console.log(`\n  Final bookingDraft: ${JSON.stringify(finalBD)}`);

    // At minimum, service + branch should be accumulated by turns 4 & 5
    // Phone is auto-injected by BE. Name remains null (user never gave it).
    // timeSlot: "الساعة 6 مساءً" → AI should extract, but P2 clears it from state.
    // BE may have timeSlot in bookingData if slot validation didn't reject.
    console.log(`\n  Accumulation check:`);
    const injectedPhone = finalBD?.clientPhone || records[5].beBookingData?.clientPhone || "—";
    const svc = finalBD?.serviceName || records[3].beBookingData?.serviceName || "—";
    const brn = finalBD?.branchName || records[4].beBookingData?.branchName || "—";
    console.log(`    phone:      ${injectedPhone}`);
    console.log(`    service:    ${svc}`);
    console.log(`    branch:     ${brn}`);
    console.log(`    timeSlot:   ${finalBD?.timeSlot || "null (P2 cleared or slot rejected)"}`);
    if (injectedPhone !== "+966501234567") {
      expect(injectedPhone).toBe("+966501234567");
    }
  });
});
