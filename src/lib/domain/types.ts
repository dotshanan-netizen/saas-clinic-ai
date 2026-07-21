export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  bookingData?: ExtractedBookingData | null;
  sessionReset?: boolean;
}

export interface ExtractedBookingData {
  clientName: string | null;
  clientPhone: string | null;
  serviceName: string | null;
  doctorName: string | null;
  branchName: string | null;
  timeSlot: string | null;
}

export interface ClinicWithCatalog {
  id: string;
  name: string;
  customPrompt: string | null;
  branches: { id: string; name: string }[];
  doctors: { 
    id: string; 
    name: string; 
    specialty: string;
    services?: { service: { name: string } }[];
  }[];
  services: { id: string; name: string; price: number }[];
}

// Helpers
export function sanitizeAIValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "غير محدد" ||
    str === ""
  ) {
    return null;
  }
  return str;
}

export function extractSaudiPhone(text: string | null): string | null {
  const sanitized = sanitizeAIValue(text);
  if (!sanitized) return null;
  const clean = sanitized.replace(/[\s-]/g, "");
  const match = clean.match(/(?<!\d)(?:\+?966|0)?5\d{8}(?!\d)/);
  return match ? match[0] : null;
}

export function isValidSaudiPhone(phone: string): boolean {
  return extractSaudiPhone(phone) !== null;
}

export function normalizeToOfficial(
  extracted: string | null,
  officialList: string[]
): string | null {
  const sanitized = sanitizeAIValue(extracted);
  if (!sanitized) return null;
  const clean = sanitized.trim().toLowerCase();

  const exact = officialList.find((o) => o.toLowerCase() === clean);
  if (exact) return exact;

  const partial = officialList.find(
    (o) => o.toLowerCase().includes(clean) || clean.includes(o.toLowerCase())
  );
  if (partial) return partial;

  const words = clean.split(/\s+/);
  const scored = officialList
    .map((o) => {
      const oWords = o.toLowerCase().split(/\s+/);
      const overlap = words.filter((w) =>
        oWords.some((ow) => ow.includes(w) || w.includes(ow))
      ).length;
      return { name: o, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);

  if ((scored[0]?.overlap || 0) > 0) return scored[0].name;

  return null;
}

export interface BookingValidationResult {
  isValid: boolean;
  missingFields: string[];
  normalizedPhone: string | null;
  normalizedService: string | null;
  normalizedDoctor: string | null;
  normalizedBranch: string | null;
  cleanName: string | null;
  cleanTimeSlot: string | null;
}

export function validateBookingData(
  data: ExtractedBookingData,
  fallbackPhone: string,
  clinic: ClinicWithCatalog
): BookingValidationResult {
  const cleanName = sanitizeAIValue(data.clientName);
  const rawPhone = sanitizeAIValue(data.clientPhone) || fallbackPhone;
  const phone = extractSaudiPhone(rawPhone);
  
  const serviceNames = clinic.services.map((s) => s.name);
  const doctorNames = clinic.doctors.map((d) => d.name);
  const branchNames = clinic.branches.map((b) => b.name);

  const service = normalizeToOfficial(data.serviceName, serviceNames);
  const doctor = normalizeToOfficial(data.doctorName, doctorNames) || "غير محدد";
  const branch = normalizeToOfficial(data.branchName, branchNames);
  const timeSlot = sanitizeAIValue(data.timeSlot);

  const missingFields: string[] = [];
  if (!cleanName || cleanName.length <= 1) missingFields.push("الاسم");
  if (!phone) missingFields.push("رقم الجوال الصحيح");
  if (!service) missingFields.push("الخدمة المطلوبة");
  if (!branch) missingFields.push("الفرع المفضل");
  if (!timeSlot) missingFields.push("الوقت المناسب");

  return {
    isValid: missingFields.length === 0,
    missingFields,
    normalizedPhone: phone,
    normalizedService: service,
    normalizedDoctor: doctor,
    normalizedBranch: branch,
    cleanName,
    cleanTimeSlot: timeSlot,
  };
}

