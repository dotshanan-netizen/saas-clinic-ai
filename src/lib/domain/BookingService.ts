import { prisma } from "@/lib/db";
import { format, addDays, startOfDay } from "date-fns";

const dayMap: Record<string, string> = {
  Sunday: "الأحد",
  Monday: "الإثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
  Saturday: "السبت",
};

function formatArabicTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "م" : "ص";
  let h = hour % 12;
  if (h === 0) h = 12;
  const hStr = h.toString().padStart(2, "0");
  const mStr = minute.toString().padStart(2, "0");
  return `${hStr}:${mStr} ${ampm}`;
}

export class BookingService {
  static async getAvailableSlots(clinicId: string, doctorName: string): Promise<Record<string, string[]>> {
    const doctor = await prisma.doctor.findFirst({
      where: { clinicId, name: doctorName, status: "ACTIVE" },
      include: { schedules: true },
    });

    if (!doctor) return {};

    const existingBookings = await prisma.booking.findMany({
      where: {
        clinicId: clinicId,
        doctorName: doctorName,
        status: { not: "CANCELLED" },
      },
      select: { timeSlot: true },
    });

    const bookedSlots = new Set(existingBookings.map((b) => b.timeSlot));
    const today = startOfDay(new Date());
    const availableSlots: Record<string, string[]> = {};

    const monthsMapArabic = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];

    let limit = 7;
    let foundSlots = false;

    while (limit <= 30 && !foundSlots) {
      for (let i = limit - 7; i < limit; i++) {
        const date = addDays(today, i);
        const enDay = format(date, "EEEE");
        const upperDay = enDay.toUpperCase();
        const arDay = dayMap[enDay];

        const schedule = doctor.schedules.find((s) => s.dayOfWeek === upperDay);
        if (!schedule || schedule.isClosed) continue;

        const [startHour, startMin] = schedule.startTime.split(":").map(Number);
        const [endHour, endMin] = schedule.endTime.split(":").map(Number);

        const slots: string[] = [];
        let currentHour = startHour;
        let currentMin = startMin;

        const dayNum = date.getDate();
        const arMonth = monthsMapArabic[date.getMonth()];
        const arDayWithDate = `${arDay} (${dayNum} ${arMonth})`;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const timeString = formatArabicTime(currentHour, currentMin);
          const slotString = `${arDayWithDate} ${timeString}`;

          if (!bookedSlots.has(slotString)) {
            slots.push(slotString);
          }

          currentMin += 30;
          if (currentMin >= 60) {
            currentHour += 1;
            currentMin -= 60;
          }
        }

        if (slots.length > 0) {
          availableSlots[arDayWithDate] = slots;
        }
      }

      if (Object.keys(availableSlots).length > 0) {
        foundSlots = true;
      } else {
        limit += 7;
      }
    }

    return availableSlots;
  }
}
