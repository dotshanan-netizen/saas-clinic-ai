/**
 * TimeExtractor — Deterministic Time Extraction Layer
 *
 * PURPOSE:
 * Explicit numeric times (11, 9 PM, 10:30) must ALWAYS be extracted using
 * deterministic parsing, NOT by the LLM. The LLM may only interpret ambiguous
 * expressions (صباح, مساء, بكره الصبح, بعد الظهر).
 *
 * DESIGN:
 * - TimeExtractor scans the user message for numeric time patterns BEFORE the
 *   LLM processes it.
 * - When a deterministic match is found, the matched expression is stripped
 *   from the text sent to the LLM (preventing dual-parsing conflicts).
 * - The extracted time is passed directly to BusinessEngine as the canonical
 *   time value.
 * - If TimeExtractor finds nothing, the LLM's time expression is used as
 *   a fallback (and still normalized by TimeNormalizer).
 *
 * RULES:
 * - No AM/PM heuristics — only explicit indicators (ص/م/صباحاً/مساءً/AM/PM).
 * - Hours 13-23 are valid 24h format → isPM.
 * - Hours 0-12 require AM/PM context; if missing, return as-is for
 *   TimeNormalizer to handle with its existing logic.
 * - Already-normalized Arabic time strings (HH:MM ص/م) are idempotent.
 */

export interface TimeExtractionResult {
  /** The raw time expression found in the text (e.g. "11", "9 PM", "10:30") */
  extractedTime: string | null;
  /** The time normalized to Arabic canonical format (e.g. "11:00 ص") */
  normalizedTime: string | null;
  /** The original text with the time expression removed */
  remainingText: string;
  /** Whether the expression is purely numeric (false) or needs semantic interpretation (true) */
  isAmbiguous: boolean;
}

export class TimeExtractor {
  /**
   * Attempts to extract a deterministic numeric time from the message.
   * Returns the extracted time + cleaned text if found, or null if no
   * explicit numeric time pattern is detected.
   */
  static extract(text: string | null): TimeExtractionResult {
    if (!text || !text.trim()) {
      return { extractedTime: null, normalizedTime: null, remainingText: text || "", isAmbiguous: false };
    }

    // ── Pattern 1: Already-normalized canonical format (idempotent) ────
    const canonicalRegex = /^(الأحد|الإثنين|الأثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\s*\(\s*\d{1,2}\s+[^\)]+\)\s+([0-1]?[0-9]|[0-2][0-3]):[0-5][0-9]\s+[صم]$/;
    const canonicalMatch = text.match(canonicalRegex);
    if (canonicalMatch) {
      return {
        extractedTime: text,
        normalizedTime: text,
        remainingText: text,
        isAmbiguous: false,
      };
    }

    // ── Pattern 2: HH:MM with explicit AM/PM (Arabic or English) ─────
    const explicitTimeRegex = /(\d{1,2}):(\d{2})\s*(ص|م|صباحاً|صباحا|مساءً|مساءا|AM|PM|am|pm|A\.M\.|P\.M\.)/;
    const explicitMatch = text.match(explicitTimeRegex);
    if (explicitMatch) {
      const [fullMatch, hStr, mStr, meridiem] = explicitMatch;
      let hour = parseInt(hStr, 10);
      const minute = parseInt(mStr, 10);
      const isPM = /^(م|مساءً|مساءا|PM|pm|P\.M\.)$/i.test(meridiem);

      if (hour > 12) hour = hour % 12;
      if (isPM && hour < 12) hour += 12;

      const normalized = `${hStr.padStart(2, "0")}:${mStr} ${isPM ? "م" : "ص"}`;
      const remainingText = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();

      return {
        extractedTime: fullMatch,
        normalizedTime: normalized,
        remainingText,
        isAmbiguous: false,
      };
    }

    // ── Pattern 3: HH:MM (24h format, no AM/PM) ──────────────────────
    const h24Regex = /(?<!\d)([0-1][0-9]|2[0-3]):([0-5][0-9])(?!\d)/;
    const h24Match = text.match(h24Regex);
    if (h24Match) {
      const [fullMatch, hStr, mStr] = h24Match;
      const hour = parseInt(hStr, 10);
      const minute = parseInt(mStr, 10);
      const isPM = hour >= 12;
      const h12 = hour % 12 || 12;
      const normalized = `${h12.toString().padStart(2, "0")}:${mStr} ${isPM ? "م" : "ص"}`;
      const remainingText = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();

      return {
        extractedTime: fullMatch,
        normalizedTime: normalized,
        remainingText,
        isAmbiguous: false,
      };
    }

    // ── Pattern 4: HH (bare hour with explicit AM/PM) ─────────────────
    const bareHourRegex = /(\d{1,2})\s*(ص|م|صباحاً|صباحا|مساءً|مساءا|AM|PM|am|pm|A\.M\.|P\.M\.)(?:\s|$)/;
    const bareHourMatch = text.match(bareHourRegex);
    if (bareHourMatch) {
      const [fullMatch, hStr, meridiem] = bareHourMatch;
      let hour = parseInt(hStr, 10);
      if (hour > 12) hour = hour % 12;
      const isPM = /^(م|مساءً|مساءا|PM|pm|P\.M\.)$/i.test(meridiem);
      if (isPM && hour < 12) hour += 12;

      const h12 = hour % 12 || 12;
      const normalized = `${h12.toString().padStart(2, "0")}:00 ${isPM ? "م" : "ص"}`;
      const remainingText = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();

      return {
        extractedTime: fullMatch,
        normalizedTime: normalized,
        remainingText,
        isAmbiguous: false,
      };
    }

    // ── Pattern 5: HH:MM bare (no AM/PM context) ─────────────────────
    const bareTimeRegex = /(?<!\d)([0-1]?[0-9]|2[0-3]):([0-5][0-9])(?!\d)/;
    const bareTimeMatch = text.match(bareTimeRegex);
    if (bareTimeMatch) {
      const [fullMatch, hStr, mStr] = bareTimeMatch;
      const hour = parseInt(hStr, 10);
      const minute = parseInt(mStr, 10);

      // If hour > 12, it's 24h format → isPM
      // If hour <= 12, ambiguous → let TimeNormalizer handle it
      if (hour > 12) {
        const isPM = true;
        const h12 = hour % 12 || 12;
        const normalized = `${h12.toString().padStart(2, "0")}:${mStr} ${isPM ? "م" : "ص"}`;
        const remainingText = text.replace(fullMatch, "").replace(/\s+/g, " ").trim();
        return {
          extractedTime: fullMatch,
          normalizedTime: normalized,
          remainingText,
          isAmbiguous: true, // AM/PM not explicit, but hour > 12 gives us PM
        };
      }

      // Hour <= 12 without AM/PM → ambiguous, return extracted but let
      // TimeNormalizer handle it (which may apply its heuristic)
      return {
        extractedTime: fullMatch,
        normalizedTime: null, // Let TimeNormalizer handle
        remainingText: text,
        isAmbiguous: true,
      };
    }

    // ── Pattern 6: Bare digit hour (e.g. "الساعة 11") ────────────────
    // Only extract if preceded by "الساعة" or similar time keywords
    const hourKeywordRegex = /(?:الساعة|الساعه|السعة|السعه)\s+(\d{1,2})(?:\s|$)/i;
    const hourKeywordMatch = text.match(hourKeywordRegex);
    if (hourKeywordMatch) {
      const [fullMatch, hStr] = hourKeywordMatch;
      const hour = parseInt(hStr, 10);

      if (hour > 12) {
        const h12 = hour % 12 || 12;
        const normalized = `${h12.toString().padStart(2, "0")}:00 م`;
        return {
          extractedTime: fullMatch,
          normalizedTime: normalized,
          remainingText: text,
          isAmbiguous: true, // No AM/PM — let pipeline decide
        };
      }

      // Hour <= 12 → ambiguous. Extract but don't strip from message
      // because TimeNormalizer needs the context words
      return {
        extractedTime: fullMatch,
        normalizedTime: null,
        remainingText: text,
        isAmbiguous: true,
      };
    }

    // ── No deterministic time found ───────────────────────────────────
    return {
      extractedTime: null,
      normalizedTime: null,
      remainingText: text,
      isAmbiguous: false,
    };
  }

  /**
   * Checks if a time expression is purely numeric (can be parsed deterministically).
   */
  static isNumericTime(text: string): boolean {
    return /\d{1,2}:\d{2}/.test(text) || /\d{1,2}\s*(ص|م|صباحاً|مساءً|AM|PM)/i.test(text);
  }
}
