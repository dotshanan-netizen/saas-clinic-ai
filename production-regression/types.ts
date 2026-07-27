/**
 * production-regression/types.ts
 *
 * Type definitions for the Production Regression Suite.
 *
 * LEVEL 1 — BusinessEngine replay using deterministic mocked extraction.
 *   Each step provides a pre-determined aiResult (exactly what the AI
 *   extracted in the original production conversation). The runner feeds
 *   it through BusinessEngine.processIntent and asserts the expected state.
 *
 * LEVEL 2 — Full pipeline replay using production conversation transcripts.
 *   (Not yet implemented) The same fixture structure is extended with
 *   productionAiResponse; the runner calls the real AIProvider + BusinessEngine
 *   pipeline instead of using the mocked aiResult.
 *
 * A new fixture is added by creating a directory:
 *   production-regression/PR-NNN-incident-name/
 *
 * Containing:
 *   fixture.ts     — The replay scenario data
 *   expected.ts    — Per-step assertions
 *   README.md      — Incident ID, root cause, status, description
 */

// ── Shared Types ────────────────────────────────────────────────────────────

export type ReplayLevel = 1 | 2;

export type ReplayStatus = "PENDING" | "PASSING" | "FAILING" | "BLOCKED";

// ── Booking Data Shape (mirrors ExtractedBookingData) ──────────────────────

export interface BookingFields {
  clientName: string | null;
  clientPhone: string | null;
  serviceName: string | null;
  doctorName: string | null;
  branchName: string | null;
  timeSlot: string | null;
}

// ── AI Result (Level 1 — deterministic mock) ───────────────────────────────

export interface L1AiResult {
  intent: string;
  response: string;
  bookingData: BookingFields | null;
  requiresRag: boolean;
  humanTakeover: boolean;
}

// ── Step Definition ─────────────────────────────────────────────────────────

export interface ReplayStep {
  /** The original user message from the production conversation */
  userMessage: string;

  /**
   * Level 1: Mocked AI extraction result.
   * Must match what the AI actually extracted for this message in production.
   * Set to `null` if Level 2 should drive this step instead.
   */
  l1AiResult?: L1AiResult | null;

  /**
   * Level 2 (future): The raw AI response from production.
   * The Level 2 runner will feed this through the real AIProvider
   * and compare the result to this production transcript.
   */
  productionTranscript?: {
    aiResponse: string;
    aiIntent: string;
    aiBookingData: BookingFields | null;
  } | null;

  /**
   * Expected state after processing this step.
   * Only fields listed here are asserted — omitted fields are skipped.
   */
  expect: {
    modifiedBookingData?: Partial<BookingFields>;
    resolvedIntent?: string;
    bookingCreated?: boolean;
    bookingModified?: boolean;
    finalResponseContains?: string;
    confirmedFields?: string[];
    traceDeterministicParsedTime?: string | null;
  };
}

// ── Complete Fixture ────────────────────────────────────────────────────────

export interface ReplayFixture {
  /** Unique identifier, e.g. "PR-001" */
  incidentId: string;

  /** Short name, e.g. "time-mutation" */
  incidentName: string;

  /** Prose description of what happened */
  description: string;

  /** Root cause analysis */
  rootCause: string;

  /** Current replay status */
  replayStatus: ReplayStatus;

  /** Which level(s) this fixture supports */
  level: ReplayLevel;

  /** Clinic catalog used for replay */
  clinic: {
    id: string;
    name: string;
    countryCode: string;
    allowedCountries?: string;
    branches: { id: string; name: string }[];
    doctors: {
      id: string;
      name: string;
      specialty: string;
      services?: { service: { name: string } }[];
    }[];
    services: { id: string; name: string; price: number }[];
  };

  /** Default client phone */
  clientPhone: string;

  /** Message source */
  source: string;

  /** Ordered conversation steps */
  steps: ReplayStep[];
}

// ── Runner Result ───────────────────────────────────────────────────────────

export interface StepResult {
  stepIndex: number;
  passed: boolean;
  errors: string[];
  actualModifiedBookingData?: BookingFields | null;
  actualResolvedIntent?: string;
  actualBookingCreated?: boolean;
  actualBookingModified?: boolean;
  actualFinalResponse?: string;
  actualConfirmedFields?: string[];
  actualTraceDeterministicParsedTime?: string | null;
}

export interface FixtureResult {
  incidentId: string;
  passed: boolean;
  stepResults: StepResult[];
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
}
