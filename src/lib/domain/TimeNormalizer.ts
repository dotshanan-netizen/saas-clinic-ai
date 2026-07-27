export class TimeNormalizer {
  private static readonly daysMap: Record<string, string> = {
    "الاحد": "الأحد", "الأحد": "الأحد", "أحد": "الأحد", "احد": "الأحد",
    "الاثنين": "الإثنين", "الإثنين": "الإثنين", "اثنين": "الإثنين", "إثنين": "الإثنين",
    "الثلاثاء": "الثلاثاء", "ثلاثاء": "الثلاثاء",
    "الاربعاء": "الأربعاء", "الأربعاء": "الأربعاء", "اربعاء": "الأربعاء", "أربعاء": "الأربعاء",
    "الخميس": "الخميس", "خميس": "الخميس",
    "الجمعة": "الجمعة", "جمعة": "الجمعة", "الجمعه": "الجمعة", "جمعه": "الجمعة",
    "السبت": "السبت", "سبت": "السبت"
  };

  private static readonly relativeDaysMap: Record<string, number> = {
    "اليوم": 0, "النهارده": 0, "النهاردة": 0,
    "بكره": 1, "غدا": 1, "الغد": 1, "بكرة": 1,
    "بعد بكره": 2, "بعد بكرة": 2, "بعد غد": 2
  };

  private static readonly monthsMap: Record<string, number> = {
    "يناير": 0, "كانون الثاني": 0, "كانون ثاني": 0,
    "فبراير": 1, "شباط": 1,
    "مارس": 2, "آذار": 2, "اذار": 2,
    "أبريل": 3, "ابريل": 3, "نيسان": 3,
    "مايو": 4, "أيار": 4, "ايار": 4,
    "يونيو": 5, "حزيران": 5,
    "يوليو": 6, "تموز": 6,
    "أغسطس": 7, "اغسطس": 7, "آب": 7, "اب": 7,
    "سبتمبر": 8, "أيلول": 8, "ايلول": 8,
    "أكتوبر": 9, "اكتوبر": 9, "تشرين الأول": 9, "تشرين اول": 9,
    "نوفمبر": 10, "تشرين الثاني": 10, "تشرين ثاني": 10,
    "ديسمبر": 11, "كانون الأول": 11, "كانون اول": 11
  };

  private static readonly monthsNamesArabic = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  private static readonly amWords = ["ص", "صباح", "الصباح", "صبح", "الصبح", "فجر", "الفجر", "صباحاً", "صباحا", "ضحى", "الضحى"];
  private static readonly pmWords = ["م", "مساء", "المساء", "ظهر", "الظهر", "عصر", "العصر", "مغرب", "المغرب", "عشاء", "العشاء", "عشا", "العشا", "ليل", "الليل", "بالليل", "مساءً", "مساءا", "عصراً", "الظهيرة"];

  private static getClinicLocalDate(countryCode: string): Date {
    const tzMap: Record<string, string> = {
      SA: "Asia/Riyadh",
      AE: "Asia/Dubai",
      QA: "Asia/Qatar",
      KW: "Asia/Kuwait",
      BH: "Asia/Bahrain",
      OM: "Asia/Muscat"
    };
    const timeZone = tzMap[countryCode] || "Asia/Riyadh";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const year = parseInt(parts.find(p => p.type === 'year')?.value || "2026", 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || "07", 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || "27", 10);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || "12", 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || "00", 10);
    const second = parseInt(parts.find(p => p.type === 'second')?.value || "00", 10);
    return new Date(year, month, day, hour, minute, second);
  }

  static isNormalized(text: string): boolean {
    const canonicalFormatRegex = /^(الأحد|الإثنين|الأثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\s*\(\s*\d{1,2}\s+[^\)]+\)\s+[0-1]?[0-9]:[0-5][0-9]\s+[صم]$/;
    return canonicalFormatRegex.test(text);
  }

  /**
   * Checks whether the text contains any signal that it is a time expression
   * (as opposed to a bare numeric identifier like a phone number or ID).
   */
  private static hasTimeContextSignal(text: string): boolean {
    // 1. Meridiem indicators (AM/PM in Arabic or English)
    // NOTE: Single-letter ص/م are handled SEPARATELY below (via regex with digit-adjacency
    // or token-boundary check) because text.includes("م") falsely matches Arabic words
    // like "رقم" (number), "اسم" (name), "يوم" (day), etc.
    const allMeridiemWords = [
      // Arabic AM (multi-character only — single "ص" is handled separately)
      "صباح", "الصباح", "صبح", "الصبح", "فجر", "الفجر", "صباحاً", "صباحا", "ضحى", "الضحى",
      // Arabic PM (multi-character only — single "م" is handled separately)
      "مساء", "المساء", "ظهر", "الظهر", "ظهرا", "ظهرًا", "عصر", "العصر", "عصرا", "عصراً",
      "مغرب", "المغرب", "عشاء", "العشاء", "عشا", "العشا", "ليل", "الليل", "بالليل",
      "مساءً", "مساءا", "الظهيرة", "ليلا",
      // English
      "am", "pm", "AM", "PM", "a.m.", "p.m.",
    ];
    for (const w of allMeridiemWords) {
      if (text.includes(w)) return true;
    }

    // Single-letter AM/PM ص/م — must be adjacent to a digit or at token boundary
    // Regex 1: digit + optional whitespace + ص/م (covers "5م", "5 م", "05:00م")
    if (/[\d\u0660-\u0669][\s\uFEFF\xA0]?[صم]/.test(text)) return true;
    // Regex 2: ص/م as a standalone token (whitespace/string boundaries around it)
    if (/(?:^|[\s\uFEFF\xA0])[صم](?:$|[\s\uFEFF\xA0.,!?;:])/.test(text)) return true;

    // 2. Time keyword (الساعة)
    if (/الساعة|الساعه|السعة/i.test(text)) return true;

    // 3. Colon or dot between digits (e.g. "5:30", "17:00", "5.30")
    if (/\d{1,2}[:.]\d{2}/.test(text)) return true;

    // 4. Arabic ordinal hour words (الخامسة, السادسة, etc.)
    if (/(الواحدة|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|الحادية عشرة|الحادية عشر|الثانية عشرة|الثانية عشر)/i.test(text)) return true;

    // 5. Day-of-week references (الأحد, الاثنين, etc.)
    for (const key of Object.keys(this.daysMap)) {
      if (text.includes(key)) return true;
    }

    // 6. Relative day references (اليوم, بكرة, etc.)
    for (const key of Object.keys(this.relativeDaysMap)) {
      if (text.includes(key)) return true;
    }

    // 7. Month references (يناير, فبراير, etc.)
    for (const key of Object.keys(this.monthsMap)) {
      if (text.includes(key)) return true;
    }

    // 8. Already-normalized format
    if (this.isNormalized(text)) return true;

    return false;
  }

  /**
   * Normalizes a conversational Arabic time string into the official format: "اليوم (تاريخ) HH:MM ص/م"
   * Example: "الثلاثاء الساعة 11 الصباح" -> "الأحد (26 يوليو) 11:00 ص" (if next Tuesday is July 28)
   * Example: "12 أغسطس الساعة 10 ص" -> "الأربعاء (12 أغسطس) 10:00 ص"
   */
  static normalize(raw: string | null, previousTimeSlot?: string | null, countryCode: string = "SA"): string | null {
    // 🚧 TIME_TRACE (Phase A — يزال بعد انتهاء التحقيق)
    const _traceInput = raw;
    if (!raw) return null;
    let text = raw.trim();
    if (!text) return null;

    // 00. Strict Idempotency Check: if it already matches the canonical output format, return it as is.
    if (this.isNormalized(text)) {
      // 🚧 TIME_TRACE (Phase A)
      console.log(`[TIME_TRACE] TimeNormalizer.idempotent: "${_traceInput}" → "${text}"`);
      return text;
    }

    // ── PHONE/NUMERIC-IDENTIFIER GUARD ──────────────────────────────────────────
    // Reject bare numeric strings that look like phone numbers, IDs, or other
    // non-time identifiers. A valid time expression must contain at least one
    // time-context signal (meridiem, keyword, colon, ordinal hour, date reference),
    // OR the numeric part must be short (1-2 digits, like "5" or "05").
    // Without any time signal, sequences of 3+ consecutive digits are rejected
    // as they are likely phone numbers (e.g. 0501234567), order IDs, etc.
    if (!this.hasTimeContextSignal(text)) {
      const digitSequences = text.match(/\d{3,}/g);
      if (digitSequences && digitSequences.length > 0) {
        return null;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    const todayLocal = this.getClinicLocalDate(countryCode);
    let resolvedDatePart = "";
    const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    // 0. Check if the string already has a formatted date part like "الأحد (26 يوليو) 10:00 ص"
    const fullDateRegex = /(الأحد|الإثنين|الأثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\s*\(\s*(\d{1,2})\s+([^\)]+)\)/;
    const fullDateMatch = text.match(fullDateRegex);
    
    if (fullDateMatch) {
      resolvedDatePart = `${fullDateMatch[1]} (${fullDateMatch[2]} ${fullDateMatch[3].trim()}) `;
    } else {
      // 1. Check if calendar date is explicitly specified (e.g. "12 أغسطس" or "12 من اغسطس")
      const monthRegex = /(\d{1,2})\s*(?:من\s+)?(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|كانون الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين الأول|تشرين الثاني|كانون الأول|كانون|تشرين)/i;
      const monthMatch = text.match(monthRegex);

      if (monthMatch) {
        const dayNum = parseInt(monthMatch[1], 10);
        const monthName = monthMatch[2];
        const monthIndex = this.monthsMap[monthName];

        if (monthIndex !== undefined) {
          const year = todayLocal.getFullYear();
          const targetDate = new Date(year, monthIndex, dayNum);
          const dayName = days[targetDate.getDay()];
          resolvedDatePart = `${dayName} (${dayNum} ${monthName}) `;
        }
      } else {
        // 2. Check relative days (e.g. "بكرة" or "اليوم")
        let offset: number | null = null;
        for (const [key, val] of Object.entries(this.relativeDaysMap)) {
          if (text.includes(key)) {
            offset = val;
            break;
          }
        }

        if (offset !== null) {
          const targetDate = new Date(todayLocal.getTime());
          targetDate.setDate(targetDate.getDate() + offset);
          const dayName = days[targetDate.getDay()];
          const dayNum = targetDate.getDate();
          const monthName = this.monthsNamesArabic[targetDate.getMonth()];
          resolvedDatePart = `${dayName} (${dayNum} ${monthName}) `;
        } else {
          // 3. Check specific days of the week (e.g. "الأحد")
          let targetDayIndex: number | null = null;
          for (const [key, val] of Object.entries(this.daysMap)) {
            if (text.includes(key)) {
              targetDayIndex = days.indexOf(val);
              break;
            }
          }

          if (targetDayIndex !== null) {
            const todayIndex = todayLocal.getDay();
            let diff = targetDayIndex - todayIndex;
            if (diff < 0) diff += 7; // next week
            const targetDate = new Date(todayLocal.getTime());
            targetDate.setDate(todayLocal.getDate() + diff);
            const dayName = days[targetDate.getDay()];
            const dayNum = targetDate.getDate();
            const monthName = this.monthsNamesArabic[targetDate.getMonth()];
            resolvedDatePart = `${dayName} (${dayNum} ${monthName}) `;
          }
        }
      }
    }

    // Fix common typos in time expressions
    text = text.replace(/السعة/g, "الساعة");

    // Normalize Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to standard ASCII digits (0-9)
    text = text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // 4. DATE-PART ISOLATION RULE:
    // Strip out any pre-extracted date expressions (e.g. "السبت (25 يوليو)" or "25 يوليو")
    // so that day-of-month digits (like 25) do NOT get misparsed as time hours!
    let timeSearchText = text;
    if (fullDateMatch) {
      timeSearchText = text.replace(fullDateRegex, "").trim();
    } else {
      timeSearchText = timeSearchText.replace(/(\d{1,2})\s*(?:من\s+)?(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|كانون الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين الأول|تشرين الثاني|كانون الأول|كانون|تشرين)/gi, "").trim();
    }

    // Extract Time (Hour and optionally Minute) from timeSearchText
    const timeRegex = /(?<!\(\s*|من\s*)([0-2]?[0-9])(?:[:.]([0-5][0-9]))?/;
    const timeMatch = timeSearchText.match(timeRegex);

    // If no time is found, and we matched a date, return null so we ask for the time.
    if (!timeMatch) return null;

    let hour = parseInt(timeMatch[1], 10);
    let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (hour > 12 && hour < 24) {
      hour = hour % 12;
      if (hour === 0) hour = 12;
    } else if (hour === 0 || hour > 24) {
      return null;
    }

    // 5. Extract Meridiem (AM/PM)
    let isPM = false;
    let isAM = false;

    // Extended PM words including noon & afternoon terms
    const extendedPmWords = [...this.pmWords, "ظهر", "الظهر", "ظهرا", "ظهرًا", "عصر", "العصر", "عصرا", "عصراً", "مساء", "المساء", "ليلا", "ليل", "م", "pm"];
    const extendedAmWords = [...this.amWords, "صباحا", "صباحاً", "فجرا", "فجراً", "ص", "am"];

    const words = text.replace(/[:.0-9]/g, " ").split(/\s+/);
    for (const w of words) {
      if (extendedPmWords.includes(w)) { isPM = true; break; }
      if (extendedAmWords.includes(w)) { isAM = true; break; }
    }

    const rawHour = parseInt(timeMatch[1], 10);
    if (rawHour >= 13 && rawHour < 24) {
      isPM = true;
    } else if (rawHour === 12 && !text.includes("منتصف الليل")) {
      // In medical clinic operating hours, 12 or "صباحي 12" refers to 12:00 PM (noon)
      isPM = true;
    } else if (!isAM && !isPM) {
      // Context-based guess for clinic hours (typically 9AM–9PM)
      if (hour >= 1 && hour <= 8) {
        isPM = true; // 1–8 without context → afternoon (13:00–20:00)
      } else {
        isAM = true; // 9, 10, 11 → morning
      }
    }

    const ampmStr = isPM ? "م" : "ص";

    // Adjust hour to be 12-based for formatting
    let h12 = hour % 12;
    if (h12 === 0) h12 = 12;

    const hStr = h12.toString().padStart(2, "0");
    const mStr = minute.toString().padStart(2, "0");

    let normalized = `${resolvedDatePart}${hStr}:${mStr} ${ampmStr}`.trim();

    // 6. Merge with previous date part if current raw has no day/date specified
    if (previousTimeSlot && !resolvedDatePart) {
      const datePartMatch = previousTimeSlot.match(/^(.*?)\s+\d{2}:\d{2}\s+[صم]$/);
      if (datePartMatch) {
        normalized = `${datePartMatch[1]} ${normalized}`;
      }
    }

    // 🚧 TIME_TRACE (Phase A — يزال بعد انتهاء التحقيق)
    const _traceHour = parseInt((_traceInput || "").match(/\d{1,2}/)?.[0] || "0", 10);
    console.log(`[TIME_TRACE] TimeNormalizer: "${_traceInput}" → hour=${_traceHour} parsedH=${hour} parsedM=${minute} isPM=${isPM} isAM=${isAM} → "${normalized}"`);

    return normalized;
  }
}
