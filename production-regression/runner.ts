/**
 * production-regression/runner.ts
 *
 * Level 1 Replay Runner.
 *
 * Processes a ReplayFixture through BusinessEngine.processIntent,
 * comparing each step's output against expected values.
 *
 * DESIGN:
 * - Stateless: takes a fixture, returns a FixtureResult.
 * - Mock-agnostic: the caller sets up DB mocks before calling run().
 * - Extensible for Level 2: same fixture format, different execution path.
 */

import { BusinessEngine } from "@/lib/domain/BusinessEngine";
import { ClinicWithCatalog, ExtractedBookingData } from "@/lib/domain/types";
import type {
  ReplayFixture,
  FixtureResult,
  StepResult,
  BookingFields,
} from "./types";

// ── Convert mock clinic shape to ClinicWithCatalog ──────────────────────────
function toClinicWithCatalog(fixture: ReplayFixture): ClinicWithCatalog {
  return fixture.clinic as ClinicWithCatalog;
}

// ── Convert booking fields to ExtractedBookingData ─────────────────────────
function toExtractedBookingData(fields: BookingFields | null): ExtractedBookingData | null {
  if (!fields) return null;
  return {
    clientName: fields.clientName ?? null,
    clientPhone: fields.clientPhone ?? null,
    serviceName: fields.serviceName ?? null,
    doctorName: fields.doctorName ?? null,
    branchName: fields.branchName ?? null,
    timeSlot: fields.timeSlot ?? null,
  };
}

// ── Assert helpers ─────────────────────────────────────────────────────────

function assertField(
  actual: string | null | undefined,
  expected: string | null | undefined,
  fieldName: string,
  errors: string[],
): void {
  if (expected === undefined) return; // Not asserted
  const a = actual ?? null;
  const e = expected ?? null;
  if (a !== e) {
    errors.push(
      `${fieldName}: expected "${e}", got "${a}"`,
    );
  }
}

function assertStringContains(
  actual: string | undefined,
  expectedSubstring: string | undefined,
  errors: string[],
): void {
  if (expectedSubstring === undefined) return;
  if (!actual || !actual.includes(expectedSubstring)) {
    errors.push(
      `finalResponse: expected to contain "${expectedSubstring}", got "${actual ?? ""}"`,
    );
  }
}

function assertArrayContains(
  actual: string[] | undefined,
  expectedItems: string[] | undefined,
  errors: string[],
): void {
  if (expectedItems === undefined) return;
  const a = actual ?? [];
  for (const item of expectedItems) {
    if (!a.includes(item)) {
      errors.push(`confirmedFields: expected to include "${item}", got [${a.join(", ")}]`);
    }
  }
}

// ── Main Runner ─────────────────────────────────────────────────────────────

export async function runLevel1(fixture: ReplayFixture): Promise<FixtureResult> {
  const clinic = toClinicWithCatalog(fixture);
  const stepResults: StepResult[] = [];

  for (let i = 0; i < fixture.steps.length; i++) {
    const step = fixture.steps[i];
    const errors: string[] = [];
    const stepResult: StepResult = {
      stepIndex: i,
      passed: false,
      errors: [],
    };

    // Skip steps without Level 1 AI mock (reserved for Level 2)
    if (!step.l1AiResult) {
      stepResult.passed = true;
      stepResult.errors = ["SKIPPED — No Level 1 AI mock, reserved for Level 2"];
      stepResults.push(stepResult);
      continue;
    }

    // Determine currentState from the last step's modifiedBookingData
    // (or undefined for the first step / fresh conversation)
    const currentState: ExtractedBookingData | undefined =
      i > 0 && stepResults[i - 1].actualModifiedBookingData
        ? (stepResults[i - 1].actualModifiedBookingData as ExtractedBookingData)
        : undefined;

    try {
      const result = await BusinessEngine.processIntent(
        clinic,
        fixture.clientPhone,
        step.userMessage,
        {
          intent: step.l1AiResult.intent,
          response: step.l1AiResult.response,
          bookingData: toExtractedBookingData(step.l1AiResult.bookingData),
          requiresRag: step.l1AiResult.requiresRag,
          humanTakeover: step.l1AiResult.humanTakeover,
        },
        fixture.source,
        currentState,
      );

      // Record actual values for propagation and diagnostics
      stepResult.actualModifiedBookingData = result.modifiedBookingData
        ? {
            clientName: result.modifiedBookingData.clientName,
            clientPhone: result.modifiedBookingData.clientPhone,
            serviceName: result.modifiedBookingData.serviceName,
            doctorName: result.modifiedBookingData.doctorName,
            branchName: result.modifiedBookingData.branchName,
            timeSlot: result.modifiedBookingData.timeSlot,
          }
        : null;
      stepResult.actualResolvedIntent = result.resolvedIntent;
      stepResult.actualBookingCreated = result.bookingCreated;
      stepResult.actualBookingModified = result.bookingModified;
      stepResult.actualFinalResponse = result.finalResponse;
      stepResult.actualConfirmedFields = result.immutableContext?.confirmedFields;
      stepResult.actualTraceDeterministicParsedTime =
        result.trace?.stages?.deterministicParse?.parsedTime ?? null;

      // ── Assertions ─────────────────────────────────────────────
      const expect = step.expect;

      // Booking data fields
      if (expect.modifiedBookingData) {
        const mbd = expect.modifiedBookingData;
        assertField(result.modifiedBookingData?.clientName, mbd.clientName, "clientName", errors);
        assertField(result.modifiedBookingData?.clientPhone, mbd.clientPhone, "clientPhone", errors);
        assertField(result.modifiedBookingData?.serviceName, mbd.serviceName, "serviceName", errors);
        assertField(result.modifiedBookingData?.doctorName, mbd.doctorName, "doctorName", errors);
        assertField(result.modifiedBookingData?.branchName, mbd.branchName, "branchName", errors);
        assertField(result.modifiedBookingData?.timeSlot, mbd.timeSlot, "timeSlot", errors);
      }

      // Intent
      if (expect.resolvedIntent !== undefined) {
        assertField(result.resolvedIntent, expect.resolvedIntent, "resolvedIntent", errors);
      }

      // Booking flags
      if (expect.bookingCreated !== undefined) {
        assertField(
          String(result.bookingCreated),
          String(expect.bookingCreated),
          "bookingCreated",
          errors,
        );
      }
      if (expect.bookingModified !== undefined) {
        assertField(
          String(result.bookingModified),
          String(expect.bookingModified),
          "bookingModified",
          errors,
        );
      }

      // Final response content
      if (expect.finalResponseContains !== undefined) {
        assertStringContains(result.finalResponse, expect.finalResponseContains, errors);
      }

      // Immutable context
      if (expect.confirmedFields !== undefined) {
        assertArrayContains(
          result.immutableContext?.confirmedFields,
          expect.confirmedFields,
          errors,
        );
      }

      // Trace: deterministic parse
      if (expect.traceDeterministicParsedTime !== undefined) {
        assertField(
          result.trace?.stages?.deterministicParse?.parsedTime ?? null,
          expect.traceDeterministicParsedTime,
          "trace.deterministicParse.parsedTime",
          errors,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`EXCEPTION: ${msg}`);
      stepResult.actualFinalResponse = `ERROR: ${msg}`;
    }

    stepResult.passed = errors.length === 0;
    stepResult.errors = errors;
    stepResults.push(stepResult);
  }

  const totalSteps = stepResults.length;
  const passedSteps = stepResults.filter((s) => s.passed).length;
  const failedSteps = totalSteps - passedSteps;

  return {
    incidentId: fixture.incidentId,
    passed: failedSteps === 0,
    stepResults,
    totalSteps,
    passedSteps,
    failedSteps,
  };
}
