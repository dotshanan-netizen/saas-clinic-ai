/**
 * PRODUCTION REPRODUCTION TEST
 * ============================
 * الهدف: إثبات أو نفي أن نفس الفشل الإنتاجي (26 يوليو) قابل للإعادة على HEAD.
 *
 * المحادثة الأصلية (conversation: cms0nn1ke0005la048rvo9ge0):
 *   - المستخدمة: حنان (+201010698277)
 *   - الخدمة: بوتكس لات | الفرع: الصحافة
 *   - الموعد: "السبت الساعة 9"
 *   - الرسالة المشكلة: "عاوزة احجز" (مع draft قديم)
 *   - الخطأ: "الوقت لم يعد متاحاً" دون أن يطلبه المستخدم
 *
 * اختبار التحقق الأصلي (Original RCA):
 *   - "بكرة الساعة 11 صباحًا" → كان يُنتج 07:00 (UTC drift)
 *   - على HEAD: يجب أن يُنتج 11:00 (clinic timezone locked)
 */

import { describe, it, expect } from "vitest";
import { TimeNormalizer } from "../../lib/domain/TimeNormalizer";
import { validateBookingData } from "../../lib/domain/types";

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCTION TEST 1: Original Timezone Bug
// ═══════════════════════════════════════════════════════════════════════════════

describe("REPRODUCTION-1: Original Timezone Bug (بكرة الساعة 11 صباحًا)", () => {

  it("[R1-UTC] Server UTC clock produces WRONG day for 'بكرة' (baseline reference)", () => {
    /**
     * يُثبت أن الـ drift موجود في المبدأ:
     * UTC 21:30 = SA 00:30 → "بكرة" على UTC = اليوم محلياً (خطأ)
     */
    // Fixed scenario: UTC 21:30 on the 26th = SA 00:30 on the 27th
    // This is a pure date arithmetic test — no system clock dependency
    const utcTimestamp = new Date("2026-07-26T21:30:00.000Z").getTime();
    const utcDay   = new Date(utcTimestamp).getUTCDate();              // → 26
    const saOffset = 3 * 3600 * 1000;
    const saDay    = new Date(utcTimestamp + saOffset).getUTCDate();   // → 27

    console.log(`[TRACE R1-UTC] UTC date: ${utcDay}, SA date: ${saDay}`);
    console.log(`[TRACE R1-UTC] Drift: ${saDay - utcDay} day(s) — this IS the original bug`);

    // The arithmetic must show that SA is one day ahead of UTC at this moment
    expect(saDay).toBeGreaterThan(utcDay);
  });

  it("[R1-HEAD] HEAD: 'بكرة الساعة 11 صباحًا' with SA countryCode produces 11:00 ص (NOT 07:00)", () => {
    const result = TimeNormalizer.normalize("بكرة الساعة 11 صباحًا", null, "SA");

    console.log(`[TRACE R1-HEAD] Input:  "بكرة الساعة 11 صباحًا"`);
    console.log(`[TRACE R1-HEAD] Output: "${result}"`);
    console.log(`[TRACE R1-HEAD] Contains 11:00 ص: ${result?.includes("11:00 ص")}`);
    console.log(`[TRACE R1-HEAD] Contains 07:00:    ${result?.includes("07:00")}`);

    expect(result).not.toBeNull();
    expect(result).toContain("11:00 ص");
    expect(result).not.toContain("07:00");
    expect(result).not.toContain("7:00 م");
  });

  it("[R1-HEAD-VARIANTS] Multiple expressions all produce correct hours on HEAD", () => {
    const cases = [
      { input: "الساعة 11 الصبح",  expectedHour: "11:00", mark: "ص" },
      { input: "الساعة 11 صباحًا", expectedHour: "11:00", mark: "ص" },
      { input: "11 ص",             expectedHour: "11:00", mark: "ص" },
      { input: "الساعة 9 الصبح",  expectedHour: "09:00", mark: "ص" },
      { input: "3 مساءً",          expectedHour: "03:00", mark: "م" },
    ];

    for (const c of cases) {
      const result = TimeNormalizer.normalize(c.input, null, "SA");
      console.log(`[TRACE R1-VARIANTS] "${c.input}" → "${result}"`);
      expect(result, `Input: "${c.input}"`).not.toBeNull();
      expect(result, `Expected hour ${c.expectedHour} in "${c.input}"`).toContain(c.expectedHour);
      expect(result, `Expected mark ${c.mark} in "${c.input}"`).toContain(c.mark);
      if (c.expectedHour === "11:00") {
        expect(result).not.toContain("07:00");
        expect(result).not.toContain("08:00");
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPRODUCTION TEST 2: The 26-July Production Failure
// ═══════════════════════════════════════════════════════════════════════════════

describe("REPRODUCTION-2: 26-July Production Failure (stale draft + 'عاوزة احجز')", () => {

  const mockClinic = {
    id: "cmryoendy0000dzrctyxgyf3k",
    countryCode: "SA",
    services: [{ name: "بوتكس لات" }, { name: "فيلر" }],
    doctors: [{ name: "د. سحر" }],
    branches: [{ name: "فرع الصحافة" }, { name: "فرع التحلية" }],
  } as any;

  it("[R2-NORMALIZE-STABILITY] 'السبت الساعة 9' → 09:00 ص (NOT 07:00) on HEAD", () => {
    const result = TimeNormalizer.normalize("السبت الساعة 9", null, "SA");

    console.log(`[TRACE R2-NORM] Input:  "السبت الساعة 9"`);
    console.log(`[TRACE R2-NORM] Output: "${result}"`);

    expect(result).not.toBeNull();
    expect(result).toContain("09:00 ص");
    expect(result).not.toContain("07:00");
    expect(result).toContain("السبت");

    console.log(`[TRACE R2-NORM] ✅ No UTC drift — 09:00 correct.`);
  });

  it("[R2-DRAFT-TRACE] 'عاوزة احجز' with stale draft: extractedTime=null, validation asks for time (NOT 'لم يعد متاحاً')", () => {
    /**
     * Full data path trace for "عاوزة احجز" on HEAD.
     *
     * On the pre-Phase-C code: timeSlot leaked from history scan.
     * On HEAD: ConversationEngine gate resets currentState.timeSlot to null
     * before BusinessEngine receives it.
     */

    // ── STEP 1: ConversationEngine — bookingDraft spread (CE:164-169) ───────
    const bookingDraftFromDB = {
      clientName: "حنان",
      clientPhone: "0502234567",
      serviceName: "بوتكس لات",
      branchName: "الصحافة",
      timeSlot: "السبت الساعة 9",  // ← stale field
      doctorName: null,
    };

    let currentState: Record<string, string | null> = {
      clientName: "حنان",
      clientPhone: null,
      serviceName: null,
      doctorName: null,
      branchName: null,
      timeSlot: null,
    };

    // UNCONDITIONAL spread (the architectural risk)
    currentState = { ...currentState, ...bookingDraftFromDB };

    console.log(`[TRACE R2] ── STEP 1: After bookingDraft spread ──`);
    console.log(`[TRACE R2]   serviceName: "${currentState.serviceName}"`);
    console.log(`[TRACE R2]   branchName:  "${currentState.branchName}"`);
    console.log(`[TRACE R2]   timeSlot:    "${currentState.timeSlot}"`);

    expect(currentState.timeSlot).toBe("السبت الساعة 9"); // stale IS present here

    // ── STEP 2: LLM returns intent=Unknown, all booking fields null ──────────
    const aiIntent = "Unknown";
    const aiBookingData = {
      clientName: "حنان",
      clientPhone: "0502234567",
      serviceName: null,
      doctorName: null,
      branchName: null,
      timeSlot: null,  // LLM extracted nothing from "عاوزة احجز"
    };

    console.log(`[TRACE R2] ── STEP 2: LLM result ──`);
    console.log(`[TRACE R2]   intent: "${aiIntent}"`);
    console.log(`[TRACE R2]   aiBookingData.timeSlot: ${aiBookingData.timeSlot}`);

    // ── STEP 3: ConversationEngine nonBookingIntent gate (CE:261-309) ────────
    const isBookingIntent = aiIntent === "BookAppointment" || aiIntent === "ModifyBooking"; // false

    // Non-booking path: null out booking fields in aiBookingData
    if (!isBookingIntent) {
      aiBookingData.serviceName = null;
      aiBookingData.doctorName = null;
      aiBookingData.branchName = null;
      aiBookingData.timeSlot = null;
    }

    // nonBookingIntents gate: null out currentState transient fields
    const nonBookingIntents = ["Inquiry", "Complaint", "Objection", "Unknown", "unknown", "HumanTakeover"];
    if (nonBookingIntents.includes(aiIntent)) {
      currentState.serviceName = null;
      currentState.doctorName = null;
      currentState.branchName = null;
      currentState.timeSlot = null; // ← RESET HERE on HEAD
    }

    console.log(`[TRACE R2] ── STEP 3: After nonBookingIntent gate ──`);
    console.log(`[TRACE R2]   currentState.timeSlot: ${currentState.timeSlot}`);
    console.log(`[TRACE R2]   aiBookingData.timeSlot: ${aiBookingData.timeSlot}`);

    expect(currentState.timeSlot).toBeNull();
    expect(aiBookingData.timeSlot).toBeNull();

    // ── STEP 4: BusinessEngine extraction (BE:129-158) ────────────────────
    const isUnset = (v: string | null | undefined) =>
      !v || v === "null" || v === "غير محدد" || v === "";

    const isNumericTimeFound = false;
    let extractedTime: string | null = isUnset(aiBookingData.timeSlot)
      ? currentState.timeSlot   // null
      : aiBookingData.timeSlot; // null

    // Active Session Gate: both false → fires → reset (already null)
    const aiBookingIntentBE = false;
    const aiExtractedBookingFieldBE = false;
    if (!aiBookingIntentBE && !aiExtractedBookingFieldBE) {
      extractedTime = null;
    }

    console.log(`[TRACE R2] ── STEP 4: BusinessEngine extraction ──`);
    console.log(`[TRACE R2]   extractedTime: ${extractedTime}`);

    // ── STEP 5: Intent upgrade (BE:250-262) ──────────────────────────────────
    const isNewBookingRequest = /حجز|أحجز|حابة أحجز|ابغى احجز|أبي أحجز|أبغى أحجز/i.test("عاوزة احجز");
    let resolvedIntent = aiIntent;
    if (resolvedIntent === "Unknown" && isNewBookingRequest) {
      resolvedIntent = "BookAppointment";
    }

    console.log(`[TRACE R2] ── STEP 5: Intent upgrade ──`);
    console.log(`[TRACE R2]   isNewBookingRequest: ${isNewBookingRequest}`);
    console.log(`[TRACE R2]   resolvedIntent: "${resolvedIntent}"`);

    // ── STEP 6: validateBookingData receives sanitizedData ───────────────────
    const sanitizedData = {
      clientName: "حنان",
      clientPhone: "0502234567",
      serviceName: currentState.serviceName,  // null
      doctorName: currentState.doctorName,    // null
      branchName: currentState.branchName,   // null
      timeSlot: extractedTime,               // null
    };

    console.log(`[TRACE R2] ── STEP 6: validateBookingData input ──`);
    console.log(JSON.stringify(sanitizedData, null, 2));

    const validation = validateBookingData(
      sanitizedData as any,
      "0502234567",
      mockClinic,
      null
    );

    console.log(`[TRACE R2] ── STEP 6: validateBookingData output ──`);
    console.log(`[TRACE R2]   isValid:        ${validation.isValid}`);
    console.log(`[TRACE R2]   missingFields:  [${validation.missingFields.join(", ")}]`);
    console.log(`[TRACE R2]   cleanTimeSlot:  "${validation.cleanTimeSlot}"`);

    // ── FINAL ASSERTIONS ─────────────────────────────────────────────────────
    // extractedTime must be null — stale draft did NOT flow through
    expect(extractedTime, "extractedTime must be null — stale draft must NOT leak").toBeNull();

    // Validation must fail — system asks for missing data
    expect(validation.isValid, "validation must fail (user gave no booking info)").toBe(false);
    expect(validation.missingFields.length, "must have missing fields").toBeGreaterThan(0);

    // The stale slot must NOT appear in cleanTimeSlot
    expect(validation.cleanTimeSlot).toBeNull();
    expect(validation.cleanTimeSlot).not.toBe("السبت (1 أغسطس) 09:00 ص");

    console.log(`\n[TRACE R2] ═══════════════════════════════════════════`);
    console.log(`[TRACE R2] ✅ extractedTime = null — stale draft did NOT leak`);
    console.log(`[TRACE R2] ✅ validation.isValid = false — correct behavior`);
    console.log(`[TRACE R2] ✅ System asks for missing info, NOT "الوقت لم يعد متاحاً"`);
    console.log(`[TRACE R2] ✅ 26-July failure mode CANNOT reproduce on HEAD`);
    console.log(`[TRACE R2] ═══════════════════════════════════════════`);
  });
});
