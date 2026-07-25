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

  private static readonly amWords = ["ص", "صباح", "الصباح", "صبح", "الصبح", "فجر", "الفجر", "صباحاً", "صباحا", "ضحى", "الضحى"];
  private static readonly pmWords = ["م", "مساء", "المساء", "ظهر", "الظهر", "عصر", "العصر", "مغرب", "المغرب", "عشاء", "العشاء", "عشا", "العشا", "ليل", "الليل", "بالليل", "مساءً", "مساءا", "عصراً", "الظهيرة"];

  /**
   * Normalizes a conversational Arabic time string into the official format: "اليوم HH:MM ص/م"
   * Example: "الثلاثاء الساعة 11 الصباح" -> "الثلاثاء 11:00 ص"
   * Example: "2 الظهر يوم الاحد" -> "الأحد 02:00 م"
   */
  static normalize(raw: string | null): string | null {
    if (!raw) return null;
    let text = raw.trim();
    if (!text) return null;

    // 1. Extract Day
    let foundDay: string | null = null;
    
    // Check relative days
    for (const [key, offset] of Object.entries(this.relativeDaysMap)) {
      if (text.includes(key)) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        foundDay = dayNames[d.getDay()];
        break;
      }
    }

    // Check specific days
    if (!foundDay) {
      for (const [key, val] of Object.entries(this.daysMap)) {
        if (text.includes(key)) {
          foundDay = val;
          break;
        }
      }
    }
    
    const dayPart = foundDay ? `${foundDay} ` : "";

    // 2. Extract Time (Hour and optionally Minute)
    const timeRegex = /([0-1]?[0-9])(?:[:.]([0-5][0-9]))?/;
    const timeMatch = text.match(timeRegex);
    if (!timeMatch) return null;

    let hour = parseInt(timeMatch[1], 10);
    let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (hour > 12 && hour < 24) {
      hour = hour % 12;
      if (hour === 0) hour = 12;
    } else if (hour === 0 || hour > 24) {
      return null;
    }

    // 3. Extract Meridiem (AM/PM)
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

    return `${dayPart}${hStr}:${mStr} ${ampmStr}`.trim();
  }
}
