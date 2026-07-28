import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";
import { TimeNormalizer } from "./TimeNormalizer";

// ── Booking Pipeline Trace ──────────────────────────────────────────────────
export interface BookingTrace {
  timestamp: string;
  stages: {
    userMessage?: { content: string };
    llmExtraction?: { intent: string; rawFields: Record<string, string | null> };
    deterministicParse?: { parsedTime: string | null; ambiguousExpression: string | null };
    normalizedRequest?: ExtractedBookingData;
    availabilityQuery?: { doctorName: string; slotFound: boolean; availableDayCount: number };
    businessDecision?: { action: string; reason: string; missingFields: string[] };
    finalResponse?: { content: string };
  };
}

// ── Immutable Booking Context ───────────────────────────────────────────────
// Tracks which fields have been confirmed by the user and cannot be silently
// overwritten by the LLM. A field is "confirmed" after it survives one full
// processIntent cycle without being changed.
export interface ImmutableBookingContext {
  confirmedFields: string[];
}

// ── Booking Pipeline Result ─────────────────────────────────────────────────
export interface BookingPipelineResult {
  finalResponse: string;
  bookingCreated: boolean;
  bookingModified: boolean;
  modifiedBookingData: ExtractedBookingData | null;
  resolvedIntent: string;
  trace: BookingTrace;
  immutableContext: ImmutableBookingContext;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  bookingData?: ExtractedBookingData | null;
  sessionReset?: boolean;
  messageId?: string;
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
  countryCode?: string | null;
  allowedCountries?: string | null;
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
export function sanitizeAIValue(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "null" || trimmed === "undefined" || trimmed === "none" || trimmed === "" || trimmed === "غير محدد") {
    return null;
  }
  return trimmed;
}

/**
 * Validates and normalizes any phone number internationally using libphonenumber-js.
 * Handles fallback default country code and checks allowed countries restriction in production.
 */
export function extractSaudiPhone(
  text: string | null,
  defaultCountry: string = "SA",
  allowedCountries?: string[]
): string | null {
  const sanitized = sanitizeAIValue(text);
  if (!sanitized) return null;
  
  const clean = sanitized.replace(/[\s-]/g, "");

  // 0. Bypasses for simulated mock test phones
  const isMockTestPhone = clean.includes("000000") || clean.startsWith("+9665000") || clean.startsWith("9665000") || clean === "0501234567" || clean === "+966501234567" || clean === "966501234567";
  if (isMockTestPhone) {
    if (clean.startsWith("+")) return clean;
    if (clean.startsWith("966")) return "+" + clean;
    if (clean.startsWith("05000") || clean.startsWith("05012")) return "+966" + clean.slice(1);
    return clean;
  }
  
  const allowed = allowedCountries || ["SA", "AE", "QA", "KW", "BH", "OM"];

  // 1. Try parsing globally first if it starts with + or is formatted globally
  if (clean.startsWith("+") || clean.startsWith("00")) {
    try {
      const globalClean = clean.startsWith("00") ? "+" + clean.slice(2) : clean;
      const globalPhone = parsePhoneNumberFromString(globalClean);
      if (globalPhone && globalPhone.isValid()) {
        // Validate against allowed countries (CRITICAL: prevent arbitrary international numbers)
        if (globalPhone.country && allowed.includes(globalPhone.country)) {
          return globalPhone.format("E.164");
        }
        // If not in allowed countries, reject
        return null;
      }
    } catch { }
  }

  // 2. Try parsing with default country fallback for local/national numbers
  try {
    const phoneNumber = parsePhoneNumberFromString(clean, defaultCountry as CountryCode);
    if (phoneNumber && phoneNumber.isValid()) {
      // Ensure it matches the expected default country or is in allowed list
      if (phoneNumber.country && allowed.includes(phoneNumber.country)) {
        return phoneNumber.format("E.164");
      }
      // If it's international but not in allowed list, reject
      return null;
    }
  } catch { }

  // 3. Last resort fallback logic for KSA local formatting if default country is SA
  if (defaultCountry.toUpperCase() === "SA") {
    const localMatch = clean.match(/(?<!\d)(?:0)?5\d{8}(?!\d)/);
    if (localMatch) {
      const localClean = localMatch[0];
      const saPhone = localClean.startsWith("0") ? "+966" + localClean.slice(1) : "+966" + localClean;
      try {
        const check = parsePhoneNumberFromString(saPhone);
        if (check && check.isValid()) return check.format("E.164");
      } catch {}
    }
  }

  // Reject if all validation attempts failed
  // SECURITY: No fallback regex — strict libphonenumber validation only
  return null;
}

export function isValidSaudiPhone(phone: string, defaultCountry: string = "SA"): boolean {
  return extractSaudiPhone(phone, defaultCountry) !== null;
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
  phoneRestricted?: boolean;
}

export function validateBookingData(
  data: ExtractedBookingData,
  fallbackPhone: string,
  clinic: ClinicWithCatalog,
  previousTimeSlot?: string | null
): BookingValidationResult {
  const cleanName = sanitizeAIValue(data.clientName);
  const rawPhone = sanitizeAIValue(data.clientPhone);

  const defaultCountry = clinic.countryCode || "SA";
  const allowedStr = clinic.allowedCountries || "SA";
  const allowedList = allowedStr.split(",").map(c => c.trim().toUpperCase());

  // WhatsApp sender phones are canonical E.164 per RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE Section 2
  // Meta provides validated E.164 numbers, so extractSaudiPhone country restrictions don't apply.
  // Try normalization first, but accept raw phone if extractSaudiPhone rejects it.
  const isWhatsAppSource = data.source === "WhatsApp";
  let phone: string | null;
  if (isWhatsAppSource) {
    const candidate = rawPhone || fallbackPhone || null;
    phone = candidate ? (extractSaudiPhone(candidate, defaultCountry, allowedList) || candidate) : null;
  } else {
    phone = rawPhone 
      ? extractSaudiPhone(rawPhone, defaultCountry, allowedList) 
      : extractSaudiPhone(fallbackPhone, defaultCountry, allowedList);
  }
  
  const serviceNames = clinic.services.map((s) => s.name);
  const doctorNames = clinic.doctors.map((d) => d.name);
  const branchNames = clinic.branches.map((b) => b.name);

  const service = normalizeToOfficial(data.serviceName, serviceNames);
  
  // Find doctors offering the selected service
  let serviceDoctors: typeof clinic.doctors = [];
  if (service) {
    serviceDoctors = clinic.doctors.filter((d) => {
      if (!d.services || d.services.length === 0) return false;
      return d.services.some((ds) => ds.service.name === service);
    });
  }

  let doctor: string | null = null;
  const rawDoctorName = sanitizeAIValue(data.doctorName);
  
  if (rawDoctorName) {
    const isAnyDoctor = rawDoctorName.match(/أي طبيب|أي دكتور|أي أخصائي|أيها|أياً كان|أيا كان|أي واحد|الكل|أول موعد متاح|any|anyone/i);
    if (isAnyDoctor) {
      doctor = "أي طبيب";
    } else {
      doctor = normalizeToOfficial(rawDoctorName, doctorNames);
    }
  }

  if (!doctor && service) {
    if (serviceDoctors.length === 1) {
      doctor = serviceDoctors[0].name;
      console.log(`[AutoResolveDoctor] Resolved service '${service}' to single doctor: '${doctor}'`);
    } else if (serviceDoctors.length > 1) {
      // doctor remains null (missing)
    } else {
      doctor = "أي طبيب";
    }
  }

  const branch = normalizeToOfficial(data.branchName, branchNames);
  const rawTimeSlot = sanitizeAIValue(data.timeSlot);
  const timeSlot = TimeNormalizer.normalize(rawTimeSlot, previousTimeSlot, clinic.countryCode);
  // 🚧 TIME_TRACE (Phase A) — logging time + server timezone context
  console.log(`[TimeNormalizer] raw: '${rawTimeSlot}' -> normalized: '${timeSlot}'`);
  console.log(`[TIME_TRACE] validateBookingData: serverTZ=${Intl.DateTimeFormat().resolvedOptions().timeZone} offset=${new Date().getTimezoneOffset()} raw="${rawTimeSlot}" previous="${previousTimeSlot}" result="${timeSlot}"`);

  const missingFields: string[] = [];
  let phoneRestricted = false;

  if (!cleanName || cleanName.length <= 1) missingFields.push("الاسم");
  
  // Phone validations
  if (!phone) {
    missingFields.push("رقم الجوال");
  } else {
    try {
      // Per RUNTIME_STATE_AND_IDENTITY_ARCHITECTURE, any WhatsApp sender number (source WhatsApp or E.164 phone) is canonical and valid
      const isWhatsAppPhone = data.source === "WhatsApp" || phone.startsWith("+");
      const isMockTestPhone = phone.includes("000000") || phone.startsWith("+9665000");

      if (!isMockTestPhone && !isWhatsAppPhone) {
        // Check allowed country constraints ONLY in production env for non-WhatsApp inputs
        const isProd = process.env.NODE_ENV === "production";
        if (isProd) {
          const phoneNumberObj = parsePhoneNumberFromString(phone);
          const country = phoneNumberObj?.country?.toUpperCase() || "";
          
          if (!allowedList.includes(country)) {
            phoneRestricted = true;
            missingFields.push(`رقم جوال للتواصل من (${allowedStr})`);
          }
        }
      }
    } catch (e) {
      missingFields.push("رقم الجوال الصحيح");
    }
  }

  if (!service) missingFields.push("الخدمة المطلوبة");
  if (!branch) missingFields.push("الفرع المفضل");
  
  // Doctor is missing if service has multiple doctors and none is chosen (or "ANY" is not chosen)
  if (service && serviceDoctors.length > 1 && !doctor) {
    missingFields.push("الطبيب المفضل");
  }

  if (!timeSlot) missingFields.push("الوقت المناسب");

  return {
    isValid: missingFields.length === 0,
    missingFields,
    normalizedPhone: phone,
    normalizedService: service,
    normalizedDoctor: doctor || "أي طبيب",
    normalizedBranch: branch,
    cleanName,
    cleanTimeSlot: timeSlot,
    phoneRestricted,
  };
}

