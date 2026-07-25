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

  /**
   * Normalizes a conversational Arabic time string into the official format: "اليوم (تاريخ) HH:MM ص/م"
   * Example: "الثلاثاء الساعة 11 الصباح" -> "الأحد (26 يوليو) 11:00 ص" (if next Tuesday is July 28)
   * Example: "12 أغسطس الساعة 10 ص" -> "الأربعاء (12 أغسطس) 10:00 ص"
   */
  static normalize(raw: string | null, previousTimeSlot?: string | null): string | null {
    if (!raw) return null;
    let text = raw.trim();
    if (!text) return null;

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
          const year = new Date().getFullYear();
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
          const targetDate = new Date();
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
            const today = new Date();
            const todayIndex = today.getDay();
            let diff = targetDayIndex - todayIndex;
            if (diff < 0) diff += 7; // next week
            const targetDate = new Date();
            targetDate.setDate(today.getDate() + diff);
            const dayName = days[targetDate.getDay()];
            const dayNum = targetDate.getDate();
            const monthName = this.monthsNamesArabic[targetDate.getMonth()];
            resolvedDatePart = `${dayName} (${dayNum} ${monthName}) `;
          }
        }
      }
    }

    // 4. Extract Time (Hour and optionally Minute)
    const timeRegex = /(?<!\(\s*|من\s*)([0-1]?[0-9])(?:[:.]([0-5][0-9]))?/;
    const timeMatch = text.match(timeRegex);

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

    const words = text.replace(/[:.0-9]/g, " ").split(/\s+/);
    for (const w of words) {
      if (this.pmWords.includes(w)) { isPM = true; break; }
      if (this.amWords.includes(w)) { isAM = true; break; }
    }

    const rawHour = parseInt(timeMatch[1], 10);
    if (rawHour >= 13 && rawHour < 24) {
      isPM = true;
    } else if (!isAM && !isPM) {
      // Context-based guess for clinic hours (typically 9AM–9PM)
      if (hour >= 1 && hour <= 8) {
        isPM = true; // 1–8 without context → afternoon (13:00–20:00)
      } else {
        isAM = true; // 9, 10, 11, 12 → morning
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

    return normalized;
  }
}
