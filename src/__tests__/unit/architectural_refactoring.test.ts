import { describe, it, expect, vi, beforeEach } from "vitest";
import { BusinessEngine } from "../../lib/domain/BusinessEngine";
import { ClinicWithCatalog, ExtractedBookingData } from "../../lib/domain/types";
import { prismaMock } from "../singleton";

// ── Shared Mock Clinic ───────────────────────────────────────────────────────
const mockClinic: ClinicWithCatalog = {
  id: "clinic-arch-test",
  name: "عيادة اختبار البنية المعمارية",
  customPrompt: null,
  countryCode: "SA",
  allowedCountries: "SA",
  branches: [
    { id: "b-press", name: "فرع الصحافة" },
    { id: "b-tahliya", name: "فرع التحلية" },
  ],
  doctors: [
    {
      id: "d-sahar",
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      services: [{ service: { name: "بوتكس" } }],
    },
  ],
  services: [
    { id: "s-botox", name: "بوتكس", price: 500 },
  ],
};

const SENDER_PHONE = "+966500000001";

// ── Helper: Minimal AI Result ───────────────────────────────────────────────
function makeAiResult(overrides: Partial<{
  intent: string;
  response: string;
  bookingData: ExtractedBookingData | null;
  requiresRag: boolean;
  humanTakeover: boolean;
}> = {}) {
  return {
    intent: overrides.intent ?? "BookAppointment",
    response: overrides.response ?? "رد تجريبي",
    bookingData: overrides.bookingData ?? null,
    requiresRag: overrides.requiresRag ?? false,
    humanTakeover: overrides.humanTakeover ?? false,
  };
}

// ── Default booking data used across tests ──────────────────────────────────
const defaultBookingData: ExtractedBookingData = {
  clientName: "فريال",
  clientPhone: SENDER_PHONE,
  serviceName: "بوتكس",
  doctorName: "د. سحر",
  branchName: "فرع الصحافة",
  timeSlot: "10:00 ص",
};

describe("Architectural Refactoring — Booking Pipeline", () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-01: Deterministic Time Priority
  //   When TimeExtractor finds a numeric time with AM/PM in userMessage, it
  //   MUST override the LLM's timeSlot — visible in the trace.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-01: deterministic numeric time overrides LLM extraction in trace", async () => {
    // "3 م" = 3 PM → explicit AM/PM → deterministic match
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز بوتكس الساعة 3 م",
      makeAiResult({
        bookingData: { ...defaultBookingData, timeSlot: "10:00 ص" },
      }),
      "WhatsApp",
    );

    // The trace MUST show deterministicParse with the numeric time
    expect(result.trace).toBeDefined();
    expect(result.trace.stages.deterministicParse).toBeDefined();
    // "3 م" with "م" (PM) → TimeExtractor matches bare hour + explicit PM
    expect(result.trace.stages.deterministicParse!.parsedTime).toBeTruthy();
    // The parsed time should be "03:00 م" (3 PM normalized)
    expect(result.trace.stages.deterministicParse!.parsedTime).toMatch(/3.*م/);
    // The business decision should have the final response
    expect(result.trace.stages.finalResponse).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-02: Immutable Context Returned
  //   processIntent MUST return immutableContext with confirmedFields
  //   that are unchanged from currentState. Uses Inquiry intent to avoid
  //   the DB-dependent double-booking guard.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-02: returns immutableContext with confirmed fields from currentState", async () => {
    const currentState: ExtractedBookingData = {
      clientName: "فريال",
      clientPhone: SENDER_PHONE,
      serviceName: "بوتكس",
      doctorName: "د. سحر",
      branchName: "فرع الصحافة",
      timeSlot: null,
    };

    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "اسمي فريال ودي أحجز",
      makeAiResult({
        intent: "Inquiry",  // Non-booking intent → avoids DB-reliant validation
        bookingData: {
          clientName: "فريال",
          clientPhone: null,
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: "فرع الصحافة",
          timeSlot: null,
        },
      }),
      "WhatsApp",
      currentState,
    );

    expect(result.immutableContext).toBeDefined();
    expect(Array.isArray(result.immutableContext.confirmedFields)).toBe(true);
    // Fields that matched currentState should be in confirmedFields
    expect(result.immutableContext.confirmedFields).toContain("clientName");
    expect(result.immutableContext.confirmedFields).toContain("serviceName");
    expect(result.immutableContext.confirmedFields).toContain("doctorName");
    expect(result.immutableContext.confirmedFields).toContain("branchName");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-03: Backward Compatible Return Type
  //   The legacy return fields (finalResponse, bookingCreated, etc.)
  //   MUST still be present alongside trace and immutableContext.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-03: backward compatible — legacy fields still present", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز بوتكس",
      makeAiResult({ bookingData: { ...defaultBookingData } }),
      "WhatsApp",
    );

    // Legacy fields
    expect(result).toHaveProperty("finalResponse");
    expect(result).toHaveProperty("bookingCreated");
    expect(result).toHaveProperty("bookingModified");
    expect(result).toHaveProperty("modifiedBookingData");
    expect(result).toHaveProperty("resolvedIntent");
    // New fields
    expect(result).toHaveProperty("trace");
    expect(result).toHaveProperty("immutableContext");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-04: Trace Contains All Expected Stages
  //   The structured trace MUST include userMessage, llmExtraction,
  //   deterministicParse, normalizedRequest, and finalResponse stages.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-04: trace includes all expected stages", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز عند دكتورة سحر بكره الساعة 10 ص",
      makeAiResult({
        intent: "BookAppointment",
        response: "حياك الله",
        bookingData: {
          clientName: "فريال",
          clientPhone: SENDER_PHONE,
          serviceName: "بوتكس",
          doctorName: "د. سحر",
          branchName: null,
          timeSlot: "10:00 ص",
        },
      }),
      "WhatsApp",
    );

    const stages = result.trace.stages;
    expect(stages.userMessage).toBeDefined();
    expect(stages.userMessage!.content).toContain("أبغى أحجز");
    expect(stages.llmExtraction).toBeDefined();
    expect(stages.llmExtraction!.intent).toBe("BookAppointment");
    expect(stages.deterministicParse).toBeDefined();
    expect(stages.normalizedRequest).toBeDefined();
    expect(stages.finalResponse).toBeDefined();
    expect(stages.finalResponse!.content).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-05: Deterministic Parse Records Null for Non-Numeric Messages
  //   When TimeExtractor finds nothing, the trace records deterministicParse
  //   with null parsedTime but the stage is present.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-05: trace records deterministicParse for non-numeric messages", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "اسمي فريال",
      makeAiResult({
        bookingData: {
          clientName: "فريال",
          clientPhone: SENDER_PHONE,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
      }),
      "WhatsApp",
    );

    expect(result.trace.stages.deterministicParse).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RT-06: ImmutableContext Is Empty for Fresh Conversations
  //   When no currentState is provided (fresh conversation), the
  //   immutableContext MUST have an empty confirmedFields array.
  // ──────────────────────────────────────────────────────────────────────────
  it("RT-06: empty immutableContext when no currentState", async () => {
    const result = await BusinessEngine.processIntent(
      mockClinic,
      SENDER_PHONE,
      "أبغى أحجز",
      makeAiResult({
        bookingData: {
          clientName: "فريال",
          clientPhone: SENDER_PHONE,
          serviceName: null,
          doctorName: null,
          branchName: null,
          timeSlot: null,
        },
      }),
      "WhatsApp",
      // No currentState → fresh conversation → default initialized
    );

    expect(result.immutableContext).toBeDefined();
    expect(result.immutableContext.confirmedFields).toEqual([]);
  });
});
