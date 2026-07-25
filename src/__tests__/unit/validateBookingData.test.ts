import { describe, it, expect } from 'vitest';
import { validateBookingData, ClinicWithCatalog } from '../../lib/domain/types';

describe('validateBookingData', () => {
  const mockClinic: ClinicWithCatalog = {
    id: "clinic-1",
    name: "Test Clinic",
    customPrompt: "Prompt",
    countryCode: "SA",
    allowedCountries: "SA",
    branches: [
      { id: "branch-1", name: "فرع الصحافة" }
    ],
    doctors: [
      {
        id: "doc-sahar",
        name: "د. سحر",
        specialty: "جلدية",
        services: [
          { service: { name: "بوتكس" } }
        ]
      },
      {
        id: "doc-noura",
        name: "الأخصائية نورة",
        specialty: "بشرة",
        services: [
          { service: { name: "تنظيف بشرة" } }
        ]
      },
      {
        id: "doc-ahmed",
        name: "د. أحمد",
        specialty: "جراحة",
        services: [
          { service: { name: "كشفية" } }
        ]
      },
      {
        id: "doc-ali",
        name: "د. علي",
        specialty: "جلدية",
        services: [
          { service: { name: "كشفية" } }
        ]
      }
    ],
    services: [
      { id: "serv-botox", name: "بوتكس", price: 500 },
      { id: "serv-clean", name: "تنظيف بشرة", price: 300 },
      { id: "serv-consult", name: "كشفية", price: 100 }
    ]
  };

  it('should auto-resolve doctor if service has only 1 doctor', () => {
    const result = validateBookingData(
      {
        clientName: "سارة الأحمد",
        clientPhone: "0501234567",
        serviceName: "تنظيف بشرة",
        doctorName: null,
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص"
      },
      "+966501234567",
      mockClinic
    );
    expect(result.isValid).toBe(true);
    expect(result.normalizedDoctor).toBe("الأخصائية نورة");
  });

  it('should mark doctor as missing if service has multiple doctors and none chosen', () => {
    const result = validateBookingData(
      {
        clientName: "سارة الأحمد",
        clientPhone: "0501234567",
        serviceName: "كشفية",
        doctorName: null,
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص"
      },
      "+966501234567",
      mockClinic
    );
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain("الطبيب المفضل");
  });

  it('should pass if doctor is specified as ANY for a multi-doctor service', () => {
    const result = validateBookingData(
      {
        clientName: "سارة الأحمد",
        clientPhone: "0501234567",
        serviceName: "كشفية",
        doctorName: "أي طبيب متاح",
        branchName: "فرع الصحافة",
        timeSlot: "الأحد 10:00 ص"
      },
      "+966501234567",
      mockClinic
    );
    expect(result.isValid).toBe(true);
    expect(result.normalizedDoctor).toBe("أي طبيب");
  });
});
