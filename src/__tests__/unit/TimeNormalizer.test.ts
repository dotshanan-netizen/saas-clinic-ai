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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Numeric-Identifier Guard (Phantom Time Root-Cause Fix)
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeNormalizer Numeric-Identifier Guard (Phantom Time Fix)', () => {
  // ── POSITIVE CASES: Must still accept valid time expressions ─────────────

  it('should accept bare single-digit number "5"', () => {
    const result = TimeNormalizer.normalize("5");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00");
  });

  it('should accept bare two-digit number "05"', () => {
    const result = TimeNormalizer.normalize("05");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00");
  });

  it('should accept "5pm" with English meridiem', () => {
    const result = TimeNormalizer.normalize("5pm");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00 م");
  });

  it('should accept "5 pm" with space before meridiem', () => {
    const result = TimeNormalizer.normalize("5 pm");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00 م");
  });

  it('should accept "الساعة 5" with time keyword', () => {
    const result = TimeNormalizer.normalize("الساعة 5");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00");
  });

  it('should accept "17:00" with colon 24h format', () => {
    const result = TimeNormalizer.normalize("17:00");
    expect(result).not.toBeNull();
    expect(result).toContain("05:00 م");
  });

  it('should accept "5:30" with colon half-hour', () => {
    const result = TimeNormalizer.normalize("5:30");
    expect(result).not.toBeNull();
    expect(result).toContain("05:30");
  });

  it('should accept "٥ مساءً" with Arabic-Indic digit and meridiem', () => {
    const result = TimeNormalizer.normalize("٥ مساءً");
    expect(result).not.toBeNull();
  });

  it('should accept "10 صباحاً" with explicit Arabic AM', () => {
    const result = TimeNormalizer.normalize("10 صباحاً");
    expect(result).not.toBeNull();
    expect(result).toContain("10:00 ص");
  });

  it('should accept "3 عصراً" with explicit Arabic PM', () => {
    const result = TimeNormalizer.normalize("3 عصراً");
    expect(result).not.toBeNull();
    expect(result).toContain("03:00 م");
  });

  it('should accept "الأحد الساعة 10 ص" with full context', () => {
    const result = TimeNormalizer.normalize("الأحد الساعة 10 ص");
    expect(result).not.toBeNull();
    expect(result).toContain("10:00 ص");
  });

  it('should accept "بكرة الساعة 2 الظهر" with relative day', () => {
    const result = TimeNormalizer.normalize("بكرة الساعة 2 الظهر");
    expect(result).not.toBeNull();
    expect(result).toContain("02:00 م");
  });

  // ── NEGATIVE CASES: Must reject numeric identifiers ──────────────────────

  it('should reject Saudi phone number "0501234567"', () => {
    const result = TimeNormalizer.normalize("0501234567");
    expect(result).toBeNull();
  });

  it('should reject international phone "+966501234567"', () => {
    const result = TimeNormalizer.normalize("+966501234567");
    expect(result).toBeNull();
  });

  it('should reject bare international "966501234567"', () => {
    const result = TimeNormalizer.normalize("966501234567");
    expect(result).toBeNull();
  });

  it('should reject random numeric ID "1234567890"', () => {
    const result = TimeNormalizer.normalize("1234567890");
    expect(result).toBeNull();
  });

  it('should reject invoice number "INV-20260727"', () => {
    const result = TimeNormalizer.normalize("INV-20260727");
    expect(result).toBeNull();
  });

  it('should reject tracking number "1Z999AA10123456784"', () => {
    const result = TimeNormalizer.normalize("1Z999AA10123456784");
    expect(result).toBeNull();
  });

  it('should reject short 3-digit "500"', () => {
    const result = TimeNormalizer.normalize("500");
    expect(result).toBeNull();
  });

  it('should reject short 3-digit "123"', () => {
    const result = TimeNormalizer.normalize("123");
    expect(result).toBeNull();
  });

  it('should reject short 4-digit "0500"', () => {
    const result = TimeNormalizer.normalize("0500");
    expect(result).toBeNull();
  });

  it('should reject "رقم 123456" (text with long number, no time signal)', () => {
    const result = TimeNormalizer.normalize("رقم 123456");
    expect(result).toBeNull();
  });

  it('should reject "order 99999" (English with long number)', () => {
    const result = TimeNormalizer.normalize("order 99999");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Idempotency & Digit Corruption (Original Tests)
// ─────────────────────────────────────────────────────────────────────────────

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
