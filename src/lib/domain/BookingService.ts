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

  static async getAvailableSlots(clinicId: string, doctorName: string, serviceName?: string): Promise<Record<string, string[]>> {
    let targetDoctors: any[] = [];
    if (doctorName === "ANY" || doctorName === "أي طبيب") {
      if (serviceName) {
        const doctorServices = await prisma.doctorService.findMany({
          where: { 
            service: { clinicId, name: serviceName, status: "ACTIVE" }, 
            doctor: { status: "ACTIVE" } 
          },
          include: { doctor: { include: { schedules: true } } }
        });
        targetDoctors = doctorServices.map((ds) => ds.doctor);
      } else {
        targetDoctors = await prisma.doctor.findMany({
          where: { clinicId, status: "ACTIVE" },
          include: { schedules: true }
        });
      }
    } else {
      const doctor = await prisma.doctor.findFirst({
        where: { clinicId, name: doctorName, status: "ACTIVE" },
        include: { schedules: true },
      });
      if (doctor) {
        targetDoctors = [doctor];
      }
    }

    if (targetDoctors.length === 0) {
      console.log(JSON.stringify({
        event: "AVAILABLE_SLOTS_EMPTY",
        reason: "DOCTOR_NOT_FOUND_IN_DB",
        clinicId,
        doctorNameSearched: doctorName,
        serviceFilter: serviceName || null,
        timestamp: new Date().toISOString(),
        hint: "The doctor name passed to getAvailableSlots did not match any ACTIVE doctor record in the database. Check: (1) doctor exists in DB with this exact name, (2) doctor status is ACTIVE, (3) normalizeToOfficial output matches DB stored name exactly."
      }));
      return {};
    }

    const targetDoctorNames = targetDoctors.map((d) => d.name);
    const existingBookings = await prisma.booking.findMany({
      where: {
        clinicId: clinicId,
        doctorName: { in: targetDoctorNames },
        status: { not: "CANCELLED" },
      },
      select: { timeSlot: true, doctorName: true },
    });

    const doctorsSlots: Record<string, string[]>[] = [];
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { countryCode: true }
    });
    const countryCode = clinic?.countryCode || "SA";
    const today = startOfDay(this.getClinicLocalDate(countryCode));
    const monthsMapArabic = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];

    for (const doc of targetDoctors) {
      const docBookings = existingBookings.filter((b) => b.doctorName === doc.name);
      const docBookedSlots = new Set(docBookings.map((b) => b.timeSlot));
      const docSlots: Record<string, string[]> = {};
      
      let limit = 7;
      let foundSlots = false;

      while (limit <= 30 && !foundSlots) {
        for (let i = limit - 7; i < limit; i++) {
          const date = addDays(today, i);
          const enDay = format(date, "EEEE");
          const upperDay = enDay.toUpperCase();
          const arDay = dayMap[enDay];
          if (!arDay) continue;

          const schedule = doc.schedules.find((s: any) => s.dayOfWeek === upperDay);
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

            if (!docBookedSlots.has(slotString)) {
              slots.push(slotString);
            }

            currentMin += 30;
            if (currentMin >= 60) {
              currentHour += 1;
              currentMin -= 60;
            }
          }

          if (slots.length > 0) {
            docSlots[arDayWithDate] = slots;
          }
        }

        if (Object.keys(docSlots).length > 0) {
          foundSlots = true;
        } else {
          limit += 7;
        }
      }
      doctorsSlots.push(docSlots);
    }

    // ── DIAGNOSTIC: Log when zero slots were generated ─────────────────────
    const totalGeneratedSlots = doctorsSlots.reduce((sum, ds) => sum + Object.keys(ds).length, 0);
    if (totalGeneratedSlots === 0) {
      const diagnosticPayload: any = {
        event: "AVAILABLE_SLOTS_EMPTY",
        reason: "NO_SLOTS_GENERATED",
        clinicId,
        doctorNameSearched: doctorName,
        targetDoctorCount: targetDoctors.length,
        targetDoctorNames: targetDoctors.map((d: any) => ({ name: d.name, scheduleCount: d.schedules?.length || 0 })),
        today: format(new Date(), "yyyy-MM-dd"),
        timestamp: new Date().toISOString(),
      };

      // Add per-doctor schedule breakdown for deep diagnostics
      diagnosticPayload.doctorScheduleDetails = targetDoctors.map((d: any) => ({
        name: d.name,
        schedules: (d.schedules || []).map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isClosed: s.isClosed,
        })),
      }));

      console.log(JSON.stringify(diagnosticPayload));
    }
    // ───────────────────────────────────────────────────────────────────────

    // Merge slots by dayKey
    const mergedAvailableSlots: Record<string, string[]> = {};
    for (const docSlots of doctorsSlots) {
      for (const [dayKey, slots] of Object.entries(docSlots)) {
        if (!mergedAvailableSlots[dayKey]) {
          mergedAvailableSlots[dayKey] = [];
        }
        for (const slot of slots) {
          if (!mergedAvailableSlots[dayKey].includes(slot)) {
            mergedAvailableSlots[dayKey].push(slot);
          }
        }
      }
    }

    // Sort keys or preserve order? They are already chronologically built, so order is fine.
    return mergedAvailableSlots;
  }
}
