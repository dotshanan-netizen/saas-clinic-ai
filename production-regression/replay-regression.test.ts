/**
 * production-regression/replay-regression.test.ts
 *
 * Vitest entry point for the Production Regression Suite.
 *
 * Auto-discovers all PR-* fixture directories, runs each through
 * the Level 1 replay runner, and reports per-fixture results.
 *
 * DESIGN:
 * - Each fixture is an isolated ReplayFixture export.
 * - The runner processes steps sequentially through BusinessEngine.processIntent.
 * - DB-dependent fixtures (PR-002) get prisma mocks set up before running.
 * - Adding new fixture: create PR-NNN-name/ with fixture.ts + README.md.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, statSync } from "fs";
import { join } from "path";

import { runLevel1 } from "./runner";
import type { ReplayFixture, FixtureResult } from "./types";
import { prismaMock } from "../src/__tests__/singleton";

// ── Fixture Discovery ────────────────────────────────────────────────────────
// Scans production-regression/ for PR-* directories containing fixture.ts

const REGRESSION_DIR = __dirname;

function discoverFixtures(): string[] {
  const entries = readdirSync(REGRESSION_DIR, { withFileTypes: true });
  const prDirs = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        /^PR-\d{3}/.test(e.name),
    )
    .map((e) => e.name)
    .sort();

  const fixturePaths: string[] = [];
  for (const dir of prDirs) {
    const fixturePath = join(REGRESSION_DIR, dir, "fixture.ts");
    try {
      if (statSync(fixturePath).isFile()) {
        fixturePaths.push(fixturePath);
      }
    } catch {
      // No fixture.ts in this directory — skip silently
    }
  }
  return fixturePaths;
}

// ── Mock Setup ───────────────────────────────────────────────────────────────
// Each fixture can declare a setupMocks function, or we use incidentId-based
// routing. For now, handle known DB-dependent fixtures by ID.

function setupMocksForFixture(incidentId: string): void {
  if (incidentId === "PR-002") {
    // ── PR-002: Booking Reset (B2) ──────────────────────────────────
    // Provide a doctor with a MONDAY schedule so getAvailableSlots
    // generates slots. The test runs on 2026-07-27 which is a Monday.
    prismaMock.doctor.findFirst.mockResolvedValue({
      id: "d-sahar",
      clinicId: "clinic-pr-002",
      name: "د. سحر",
      specialty: "جلدية وتجميل",
      bio: null,
      imageUrl: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      schedules: [
        {
          id: "sch-001",
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

    prismaMock.booking.findMany.mockResolvedValue([]);

    prismaMock.clinic.findUnique.mockResolvedValue({
      id: "clinic-pr-002",
      countryCode: "SA",
    } as any);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Production Regression Suite — Level 1", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const fixturePaths = discoverFixtures();

  if (fixturePaths.length === 0) {
    it("no regression fixtures found", () => {
      console.warn(
        "[ProductionRegression] No PR-* fixture directories found. " +
          "Create production-regression/PR-NNN-name/fixture.ts to add one.",
      );
    });
    return;
  }

  for (const fixturePath of fixturePaths) {
    // Dynamic import — vitest handles this at module resolution time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fixtureModule = require(fixturePath);
    const fixture: ReplayFixture = fixtureModule.default;

    describe(`${fixture.incidentId}: ${fixture.incidentName}`, () => {
      // ── Blocked fixtures ─────────────────────────────────────────
      if (fixture.replayStatus === "BLOCKED") {
        it("is BLOCKED — skipping until dependencies resolved", () => {
          console.warn(
            `[ProductionRegression] ${fixture.incidentId} is BLOCKED: ${fixture.rootCause}`,
          );
        });
        return;
      }

      // ── Active fixtures ──────────────────────────────────────────
      it(`replays ${fixture.steps.length} step(s) — status: ${fixture.replayStatus}`, async () => {
        // Set up DB mocks if needed
        setupMocksForFixture(fixture.incidentId);

        // Run the replay
        const result: FixtureResult = await runLevel1(fixture);

        // Detailed step reporting
        for (const stepResult of result.stepResults) {
          if (stepResult.errors.length > 0) {
            console.log(
              `[${fixture.incidentId}] Step ${stepResult.stepIndex}: ${stepResult.errors.join("; ")}`,
            );
          }
        }

        // Assert all steps passed
        expect(result.passed).toBe(true);
        expect(result.failedSteps).toBe(0);
        expect(result.passedSteps).toBe(result.totalSteps);

        // Additional context for diagnostics
        expect(result.stepResults.length).toBeGreaterThan(0);
      });
    });
  }
});
