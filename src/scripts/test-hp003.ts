import { BusinessEngine } from "../lib/domain/BusinessEngine";
import { prisma } from "../lib/db";
import { validateBookingData, ExtractedBookingData, ClinicWithCatalog } from "../lib/domain/types";

async function run() {
  const clinic = await prisma.clinic.findFirst({
    include: {
      branches: true,
      doctors: { include: { services: { include: { service: true } } } },
      services: true,
    },
  });

  if (!clinic) throw new Error("Clinic not found");

  const clinicData: ClinicWithCatalog = {
    id: clinic.id,
    name: clinic.name,
    customPrompt: clinic.customPrompt,
    countryCode: clinic.countryCode,
    allowedCountries: clinic.allowedCountries,
    branches: clinic.branches.map(b => ({ id: b.id, name: b.name })),
    doctors: clinic.doctors.map(d => ({
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      services: d.services.map(ds => ({ service: { name: ds.service.name } }))
    })),
    services: clinic.services.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
    }))
  };

  const bookingData: ExtractedBookingData = {
    clientName: "أحمد",
    clientPhone: "+966511111114",
    serviceName: "تنظيف بشرة",
    doctorName: "د. تجربة",
    branchName: "الفرع الرئيسي",
    timeSlot: "الثلاثاء الساعة 11 الصباح",
  };

  const validation = validateBookingData(bookingData, "+966511111114", clinicData);
  console.log("Validation Result:", validation);

  if (validation.isValid) {
    const { BookingService } = await import("../lib/domain/BookingService");
    const slots = await BookingService.getAvailableSlots(clinicData.id, validation.normalizedDoctor!);
    console.log("Available Slots for Doctor:", slots);
    
    let isAvail = false;
    for (const arr of Object.values(slots)) {
      if (arr.includes(validation.cleanTimeSlot!)) {
        isAvail = true;
      }
    }
    console.log("Is Slot Available:", isAvail);
  }
}

run().catch(console.error);
