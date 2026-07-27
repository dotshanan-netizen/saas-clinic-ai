import { describe, it, expect } from 'vitest';
import { TimeNormalizer } from '@/lib/domain/TimeNormalizer';
import { BusinessEngine } from '@/lib/domain/BusinessEngine';
import { prismaMock } from '../singleton';
import { ClinicWithCatalog } from '@/lib/domain/types';

// Shared Mock Clinic matching catalog layout
const mockClinic: ClinicWithCatalog = {
  id: "clinic-golden-test",
  name: "عيادة الاختبارات الذهبية",
  customPrompt: null,
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [
    { id: "b-press", name: "فرع الصحافة" },
  ],
  doctors: [
    {
      id: "d-sahar",
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      imageUrl: null,
      status: "ACTIVE",
      clinicId: "clinic-golden-test",
      createdAt: new Date(),
      services: [
        {
          id: "ds-botox",
          doctorId: "d-sahar",
          serviceId: "s-botox",
          createdAt: new Date(),
          service: { id: "s-botox", name: "بوتكس", description: null, duration: 30, price: 500, clinicId: "clinic-golden-test", status: "ACTIVE", createdAt: new Date() },
        },
      ],
    },
  ],
  services: [
    { id: "s-botox", name: "بوتكس", price: 500 },
  ],
};

describe('TimeNormalizer Idempotency & Digit Corruption Tests', () => {
  it('should be strictly idempotent', () => {
    const input = "السبت (19 أغسطس) 11:00 ص";
    const firstRun = TimeNormalizer.normalize(input);
    const secondRun = TimeNormalizer.normalize(firstRun);
    expect(secondRun).toBe(firstRun);
    expect(secondRun).toBe("السبت (19 أغسطس) 11:00 ص");
  });

  it('should parse 11:00 correctly regardless of the day of the month (Reproduction Suite)', () => {
    const cases = [
      { raw: "السبت (5 أغسطس) 11:00 ص", expected: "السبت (5 أغسطس) 11:00 ص" },
      { raw: "السبت (19 أغسطس) 11:00 ص", expected: "السبت (19 أغسطس) 11:00 ص" },
      { raw: "السبت (25 أغسطس) 11:00 ص", expected: "السبت (25 أغسطس) 11:00 ص" },
      { raw: "الإثنين (27 يوليو) 11:00 ص", expected: "الإثنين (27 يوليو) 11:00 ص" },
      { raw: "السبت (31 أغسطس) 11:00 ص", expected: "السبت (31 أغسطس) 11:00 ص" }
    ];

    cases.forEach(({ raw, expected }) => {
      const result = TimeNormalizer.normalize(raw);
      expect(result).toBe(expected);
    });
  });

  it('should process booking request for day 27 at 11:00 without shifting it to 07:00 (E2E Pipeline Integration)', async () => {
    // 1. Mock Doctor and Schedules
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: "d-sahar",
      name: "د. سحر",
      clinicId: "clinic-golden-test",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      schedules: [
        {
          id: "sch-1",
          doctorId: "d-sahar",
          dayOfWeek: "MONDAY",
          startTime: "09:00",
          endTime: "17:00",
          isClosed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as any);

    // 2. Mock Bookings
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.booking.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue({} as any);

    // 3. Process Request via BusinessEngine (representing the Pipeline)
    const result = await BusinessEngine.processIntent(
      mockClinic,
      "+966501234567",
      "أبغى أحجز يوم الإثنين الساعة 11 الصباح",
      {
        intent: "BookAppointment",
        response: "جاري تأكيد الحجز 🌸",
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: "فرع الصحافة",
          timeSlot: "الإثنين 11:00 ص",
        },
        requiresRag: false,
        humanTakeover: false,
      },
      "WhatsApp",
    );

    // 4. Assertions
    // Booking should be created successfully, with response showing 11:00 and not shifted to 7:00
    expect(result.finalResponse).toContain("11:00");
    expect(result.finalResponse).not.toContain("07:00");
    expect(result.finalResponse).not.toContain("7:00");
  });
});
