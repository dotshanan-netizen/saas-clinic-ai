/**
 * 🚧 PHASE A — Temporal Consistency Reproduction Test
 *
 * الهدف: إعادة إنتاج مشكلة 11:00 → 07:00 في معالجة الوقت.
 *
 * الطريقة:
 * 1. اختبار TimeNormalizer مع 20 صيغة وقت مختلفة
 * 2. اختبار validateBookingData مع كل تنسيق
 * 3. محاكاة اختلاف Timezone (UTC vs Asia/Riyadh)
 * 4. محاكاة تنسيقات AI غير متوقعة
 *
 * ممنوع:
 * - تعديل Business Logic
 * - تعديل production code (غير ملفات الاختبار والإضافة المؤقتة)
 */

import { describe, it, expect } from "vitest";
import { TimeNormalizer } from "../../lib/domain/TimeNormalizer";

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: TimeNormalizer — Basic Formats
// ═══════════════════════════════════════════════════════════════════════════════
describe("Phase A — TimeNormalizer Basic Formats", () => {

  it("[A-TN-01] should parse '11:00 ص' correctly", () => {
    const result = TimeNormalizer.normalize("11:00 ص");
    expect(result).not.toBeNull();
    expect(result).toContain("11:00 ص");
    // Must NOT be 07:00 or 7:00 or anything other than 11
    expect(result).not.toContain("07:00");
    expect(result).not.toContain("7:00");
  });

  it("[A-TN-02] should parse '11:00' (without AM/PM) as 11 AM (clinic rule)", () => {
    const result = TimeNormalizer.normalize("11:00");
    expect(result).not.toBeNull();
    expect(result).toContain("11:00 ص");
    // 11 (without context) → AM (correct for clinic hours 9-12)
  });

  it("[A-TN-03] should parse '07:00' (without AM/PM) as 7 PM (clinic PM heuristic)", () => {
    const result = TimeNormalizer.normalize("07:00");
    expect(result).not.toBeNull();
    // Hours 1-8 without AM/PM context → assumed PM (evening)
    expect(result).toContain("م");
    // NOTE: This is the heuristic! 7 without AM/PM → 7PM, not 7AM
  });

  it("[A-TN-04] should parse '07:00 صباحاً' as 7 AM (AM word found)", () => {
    const result = TimeNormalizer.normalize("07:00 صباحاً");
    expect(result).not.toBeNull();
    expect(result).toContain("ص");
    expect(result).toContain("07:00");
  });

  it("[A-TN-05] should parse '7:00 مساءً' as 7 PM (PM word found)", () => {
    const result = TimeNormalizer.normalize("7:00 مساءً");
    expect(result).not.toBeNull();
    expect(result).toContain("م");
  });

  it("[A-TN-06] should document how '23:00' (24h) is parsed — NOTE: regex matches hour=2 not 23", () => {
    const result = TimeNormalizer.normalize("23:00");
    // ⚠️ BUG: The timeRegex /(?<!...)([0-1]?[0-9])(?:[:.]([0-5][0-9]))?/
    // matches only hours 0-19. Hour 23 → regex captures "2" (only units digit).
    // Result: hour=2, isPM heuristic kicks in → "02:00 م" (WRONG, should be 23:00 → 11:00 م)
    expect(result).not.toBeNull();
    expect(result).toContain("02:00 م");
    // This is a documented limitation: the regex cannot parse 24h hours 20-23.
    // Impact: if AI outputs 24h format with hours 20-23, the time is corrupted.
  });

  it("[A-TN-07] should parse '11:00 AM' (English) correctly", () => {
    const result = TimeNormalizer.normalize("11:00 AM");
    expect(result).not.toBeNull();
    expect(result).toContain("ص");
  });

  it("[A-TN-08] should parse '07:00 am' (English lowercase) correctly", () => {
    const result = TimeNormalizer.normalize("07:00 am");
    expect(result).not.toBeNull();
    expect(result).toContain("ص");
    // "am" in extendedAmWords → should override the PM heuristic
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: TimeNormalizer — Edge Cases & AI Output Formats
// ═══════════════════════════════════════════════════════════════════════════════
describe("Phase A — AI Output Format Edge Cases", () => {

  it("[A-EF-01] should handle '11:00:00' (with seconds, from AI)", () => {
    const result = TimeNormalizer.normalize("11:00:00");
    expect(result).not.toBeNull();
    expect(result).toContain("11:00");
  });

  it("[A-EF-02] should handle '11:00+03:00' (timezone-aware, from AI)", () => {
    // AI might output ISO-like time with timezone offset
    const result = TimeNormalizer.normalize("11:00+03:00");
    // The +03:00 might confuse the regex — test what actually happens
    // This is an investigation: document behavior, not fix
    console.log(`[TIME_TRACE] AI timezone-aware input '11:00+03:00' → "${result}"`);
    // Accept any non-null result — we're documenting behavior
    // But document if it becomes 07:00:
    if (result && result.includes("07:00")) {
      console.log(`[TIME_TRACE] ⚠️ BUG REPRODUCED: '11:00+03:00' → '07:00'`);
    }
  });

  it("[A-EF-03] should handle ISO date format '2026-07-26T11:00:00'", () => {
    const result = TimeNormalizer.normalize("2026-07-26T11:00:00");
    // ISO format has many digits — TimeNormalizer might extract wrong hour
    console.log(`[TIME_TRACE] ISO input '2026-07-26T11:00:00' → "${result}"`);
  });

  it("[A-EF-04] should handle '11 ص' (short Arabic, no minutes)", () => {
    const result = TimeNormalizer.normalize("11 ص");
    expect(result).not.toBeNull();
    expect(result).toContain("11:00");
  });

  it("[A-EF-05] should handle '11:00 م' explicitly", () => {
    const result = TimeNormalizer.normalize("11:00 م");
    expect(result).not.toBeNull();
    expect(result).toContain("11:00 م");
  });

  it("[A-EF-06] should preserve already-normalized 'الأحد (26 يوليو) 11:00 ص'", () => {
    const input = "الأحد (26 يوليو) 11:00 ص";
    const result = TimeNormalizer.normalize(input);
    expect(result).toBe(input);
    // Idempotency: second call must return same
    const second = TimeNormalizer.normalize(result);
    expect(second).toBe(input);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Cross-Timezone Simulation
// ═══════════════════════════════════════════════════════════════════════════════
describe("Phase A — Timezone Simulation", () => {

  it("[A-TZ-01] should document server timezone and offset", () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    const now = new Date();
    const nowRiyadh = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
    
    console.log(`[TIME_TRACE] Server timezone: ${tz}`);
    console.log(`[TIME_TRACE] Server offset (minutes): ${offset} (UTC${offset === 0 ? "" : (offset < 0 ? "+" : "-")}${Math.abs(offset / 60)})`);
    console.log(`[TIME_TRACE] Server now: ${now.toISOString()}`);
    console.log(`[TIME_TRACE] Riyadh now: ${nowRiyadh.toISOString()}`);
    
    // If offset = 0 → server is UTC
    // If offset = -180 → server is UTC+3 (Asia/Riyadh)
    // Others → documentation
    const isUTC = offset === 0;
    const isRiyadh = offset === -180;
    console.log(`[TIME_TRACE] Server is ${isUTC ? "UTC" : isRiyadh ? "Asia/Riyadh" : "other: " + tz}`);
  });

  it("[A-TZ-02] should simulate 11:00 in UTC producing 07:00 in Riyadh (or vice versa)", () => {
    // Scenario: user asks for "11:00" in Riyadh time, system treats it as UTC
    // Riyadh 11:00 = UTC 08:00 → no 4-hour shift
    
    // Scenario: system generates slot at 11:00 in server TZ, 
    // AI interprets it as a different TZ
    const serverOffset = new Date().getTimezoneOffset();
    
    // If server is UTC (offset 0):
    //   Slots generated at "11:00 ص" in UTC = 14:00 Riyadh
    //   User expects 11:00 Riyadh = slot at "08:00 ص" in UTC generation
    //   → mismatch!
    
    // If server is Riyadh (offset -180):
    //   Slots generated in Riyadh time → should match user expectations
    
    // Test: what does a slot "11:00 ص" mean in different TZs?
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Calculate: 11:00 AM in server TZ = what time in Riyadh?
    const serverHour = 11; // 11:00 AM in server time
    const offsetHours = -serverOffset / 60; // convert to hours
    const riyadhHour = (serverHour + offsetHours + 3) % 24; // Riyadh is UTC+3
    
    console.log(`[TIME_TRACE] TZ Simulation: 11:00 ${tz} = ${(serverHour + offsetHours) % 24}:00 UTC = ${riyadhHour}:00 Riyadh`);
    console.log(`[TIME_TRACE] Forms: 11:00 ${tz} → slot in UTC generation: "${(serverHour + offsetHours) % 24}:00"`);
    console.log(`[TIME_TRACE] Expected slot in Riyadh: "${riyadhHour}:00"`);
  });

  it("[A-TZ-03] should detect day-boundary shift risk (12AM-3AM Riyadh = previous day UTC)", () => {
    const serverOffset = new Date().getTimezoneOffset(); // -180 for Riyadh, 0 for UTC
    
    // If server is Riyadh:
    //   startOfDay(new Date()) at 1AM Riyadh = midnight Riyadh = 21:00 UTC previous day
    //   → date.getDate() works correctly for Riyadh
    
    // If server is UTC:
    //   startOfDay(new Date()) at 1AM UTC = midnight UTC
    //   → But 1AM UTC = 4AM Riyadh → day is correct
    //   → Problem only at 9PM-12AM UTC = 12AM-3AM Riyadh
    
    // Test: generate today's date string in both TZs
    const todayLocal = new Date();
    const todayUTC = new Date(new Date().toUTCString().slice(0, 25));
    
    const localDay = todayLocal.getDate();
    const localMonth = todayLocal.getMonth();
    const utcDay = todayUTC.getDate();
    const utcMonth = todayUTC.getMonth();
    
    console.log(`[TIME_TRACE] Day-boundary: local date=${localDay}/${localMonth + 1} UTC date=${utcDay}/${utcMonth + 1} sameDay=${localDay === utcDay && localMonth === utcMonth}`);
    console.log(`[TIME_TRACE] If different → slots generated during 12AM-3AM Riyadh have wrong day`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: BusinessEngine Time Pipeline
// ═══════════════════════════════════════════════════════════════════════════════
describe("Phase A — Full Pipeline Time Trace", () => {

  it("[A-PL-01] should trace complete time pipeline end-to-end", () => {
    // Trace each transformation with the same base time
    const userInput = "11:00";
    const aiOutput = "11:00";  // Simulating AI output
    const aiWithAmPm = "11:00 ص"; // Simulating AI with PM context
    
    // Step 1: TimeNormalizer on raw AI output
    const tn1 = TimeNormalizer.normalize(aiOutput);
    console.log(`[TIME_TRACE] Pipeline Step: User="${userInput}" → AI="${aiOutput}" → TN="${tn1}"`);
    
    // Step 2: TimeNormalizer with AM/PM
    const tn2 = TimeNormalizer.normalize(aiWithAmPm);
    console.log(`[TIME_TRACE] Pipeline Step: User="${userInput}" → AI="${aiWithAmPm}" → TN="${tn2}"`);
    
    // Step 3: TimeNormalizer with previous time slot (simulating multi-turn)
    const tn3 = TimeNormalizer.normalize("بكرة", tn1);
    console.log(`[TIME_TRACE] Pipeline Step: "بكرة" with previous="${tn1}" → "${tn3}"`);
    
    // Verify: no step should produce 07:00 from 11:00
    [tn1, tn2].forEach((result, i) => {
      if (result && result.includes("07:00")) {
        console.log(`[TIME_TRACE] ⚠️ BUG REPRODUCED at step ${i + 1}: 11:00 → 07:00`);
      }
    });
  });

  it("[A-PL-02] should test for 11:00→07:00 in AI timezone hallucination scenario", () => {
    // Simulate: AI thinks server is UTC and converts user's Riyadh time
    // AI scenario: user says "11:00" → AI thinks it's UTC → outputs "07:00" (UTC? wrong direction)
    // Actually: AI might output "07:00" thinking it's Riyadh time from UTC
    
    // The issue: AI might output a different time than what user requested
    // This is not a code bug but an AI behavior issue
    
    const aiHallucinatedTime = "07:00";
    const tnResult = TimeNormalizer.normalize(aiHallucinatedTime);
    console.log(`[TIME_TRACE] AI hallucination: AI outputs "${aiHallucinatedTime}" → TN normalizes to "${tnResult}"`);
    
    // If AI says 07:00 without AM/PM → becomes 7PM → not in schedule
    // If AI says 07:00 AM → becomes 7AM → might match wrong slot
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: BookingService Slot Generation Format
// ═══════════════════════════════════════════════════════════════════════════════
describe("Phase A — Slot Generation Time Format", () => {

  it("[A-SG-01] should document formatArabicTime behavior for hours 0-23", () => {
    // Indirectly test formatArabicTime via its exported behavior
    // We can't test the private function directly, but we can test
    // BookingService.getAvailableSlots through integration
    
    // For now, document the expected format
    const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 23];
    const expected = {
      7: "07:00 ص",
      8: "08:00 ص",
      9: "09:00 ص",
      10: "10:00 ص",
      11: "11:00 ص",
      12: "12:00 م",
      13: "01:00 م",
      14: "02:00 م",
      15: "03:00 م",
      16: "04:00 م",
      17: "05:00 م",
      23: "11:00 م",
    };
    
    hours.forEach(h => {
      // formatArabicTime is private, so we verify through TimeNormalizer roundtrip
      // The key insight: if a schedule says startTime="07:00", the slot is "07:00 ص"
      console.log(`[TIME_TRACE] Slot format for hour ${h}: should be "${expected[h as keyof typeof expected]}"`);
    });
  });
});
