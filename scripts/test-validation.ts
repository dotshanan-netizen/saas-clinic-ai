import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { validateBookingData, ExtractedBookingData } from '../src/lib/domain/types';

const data: ExtractedBookingData = {
  clientName: 'ياسمين',
  clientPhone: '0551234567',
  serviceName: 'تنظيف البشرة العميق',
  doctorName: 'د. سحر',
  branchName: 'الصحافة',
  timeSlot: 'الأحد الساعة 11 صباحاً'
};

const clinic = {
  id: "cmrvf3dqe0000dzz0cgojpe7r",
  name: "Mock Clinic",
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [{ name: "الصحافة" }],
  services: [{ name: "تنظيف البشرة العميق", price: 100 }],
  doctors: [{ name: "د. سحر", specialty: "جلدية", services: [] }]
};

const result = validateBookingData(data, "+966500000009", clinic as any);
console.log(JSON.stringify(result, null, 2));
