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

  private static readonly amWords = ["ص", "صباح", "الصباح", "صبح", "الصبح", "فجر", "الفجر"];
  private static readonly pmWords = ["م", "مساء", "المساء", "ظهر", "الظهر", "عصر", "العصر", "مغرب", "المغرب", "عشاء", "العشاء", "عشا", "العشا", "ليل", "الليل", "بالليل"];

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
    for (const [key, val] of Object.entries(this.daysMap)) {
      if (text.includes(key)) {
        foundDay = val;
        break;
      }
    }
    if (!foundDay) return null;

    // 2. Extract Time (Hour and optionally Minute)
    // Matches 1 to 12, optionally followed by :00, :30, etc.
    const timeRegex = /([0-1]?[0-9])(?:[:.]([0-5][0-9]))?/;
    const timeMatch = text.match(timeRegex);
    if (!timeMatch) return null;

    let hour = parseInt(timeMatch[1], 10);
    let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    // Validate hour
    if (hour > 12 && hour < 24) {
      // 24-hour format provided implicitly
      hour = hour % 12;
      if (hour === 0) hour = 12;
      // If hour > 12, it's definitely PM, but we'll let the PM logic handle it or override it here
    } else if (hour === 0 || hour > 24) {
      return null; // invalid hour
    }

    // 3. Extract Meridiem (AM/PM)
    let isPM = false;
    let isAM = false;

    // Check words
    const words = text.replace(/[:.0-9]/g, " ").split(/\s+/);
    for (const w of words) {
      if (this.pmWords.includes(w)) {
        isPM = true;
        break;
      }
      if (this.amWords.includes(w)) {
        isAM = true;
        break;
      }
    }

    // Default to AM/PM based on context if missing? (e.g. 14 -> 2 PM)
    if (parseInt(timeMatch[1], 10) >= 12 && parseInt(timeMatch[1], 10) < 24) {
      isPM = true;
    } else if (!isAM && !isPM) {
      // If no explicit AM/PM, try to guess based on standard clinic hours
      // 9, 10, 11 are usually AM. 1, 2, 3, 4, 5, 6 are usually PM.
      if (hour >= 1 && hour <= 8) {
        isPM = true; // 1-8 are typically PM (13:00 - 20:00)
      } else {
        isAM = true; // 9, 10, 11, 12 are typically AM
      }
    }

    const ampmStr = isPM ? "م" : "ص";

    // Adjust hour to be 12-based for formatting
    let h12 = hour % 12;
    if (h12 === 0) h12 = 12;

    const hStr = h12.toString().padStart(2, "0");
    const mStr = minute.toString().padStart(2, "0");

    return `${foundDay} ${hStr}:${mStr} ${ampmStr}`;
  }
}
