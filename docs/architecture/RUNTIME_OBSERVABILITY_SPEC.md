# Runtime Observability Specification

**Version**: 2.0  
**Effective**: 27 Jul 2026  
**Status**: 🟢 Active — supersedes CLINOVA_RUNTIME_SPECIFICATION.md v1.0  
**Purpose**: Define contracts between layers, ownership model, logging requirements, and production readiness gates.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Layer Ownership Matrix](#2-layer-ownership-matrix)
3. [Data Contracts Between Layers](#3-data-contracts-between-layers)
4. [State Lifecycle](#4-state-lifecycle)
5. [Intent Classification Rules](#5-intent-classification-rules)
6. [Conversation Flow](#6-conversation-flow)
7. [Error Classification](#7-error-classification)
8. [Structured Logging Specification](#8-structured-logging-specification)
9. [TIME_TRACE Evolution Plan (Phase B)](#9-timetrace-evolution-plan-phase-b)
10. [Production Readiness Gates](#10-production-readiness-gates)
11. [Version History](#11-version-history)

---

## 1. Architecture Overview

```
WhatsApp → Webhook → ConversationEngine → AIProvider → BusinessEngine → WhatsApp
                                ↕                    ↕           ↕
                           Database              Memory      Validation
                                                             ↕
                                                         Calendar
```

### Data Stores

| Store | Type | Managed By |
|-------|------|------------|
| `Conversation.history` | JSON column (Prisma) | ConversationEngine |
| `Conversation.bookingDraft` | JSON column (Prisma) | ConversationEngine |
| `Conversation.currentStateName` | String column (Prisma) | ConversationEngine |
| `Booking` | Table (Prisma) | BusinessEngine |

---

## 2. Layer Ownership Matrix

### 2.1 Core Ownership

Every component owns exactly one thing. Writing outside ownership is a bug.

| Component | Owns | Can Write | Can Read | Cannot Write |
|---|---|---|---|---|
| **ConversationEngine** | Conversation Memory (History, BookingDraft, CurrentState) | History, BookingDraft (`conversation.upsert`), CurrentState (in-memory) | Conversation, Booking | ❌ Response content, ❌ AI result values |
| **AIProvider** | Intent + Draft Response | AI Result object (intent, response, bookingData) | Prompt context, History | ❌ Conversation Memory (DB) |
| **BusinessEngine** | Final Decision + Pipeline Output (`modifiedBookingData`) | Final Response, Booking Creation (`prisma.booking`), `modifiedBookingData` (pipeline output — unrestricted) | AI Result, Validation, Calendar, currentState (read-only) | ❌ Conversation Memory (DB), ❌ BookingDraft directly |
| **Validation** | Validation Result Only | `isValid`, `missingFields[]`, normalized values | Sanitized Input | ❌ Memory, ❌ BookingData, ❌ modifiedBookingData |
| **Calendar (BookingService)** | Availability Only | `getAvailableSlots()` return value | Doctor schedules, Bookings | ❌ Memory, ❌ Validation, ❌ Response |
| **TimeExtractor** | Deterministic Time Parse | `TimeExtractionResult` (extractedTime, normalizedTime) | User message text | ❌ Memory, ❌ modifiedBookingData |
| **TimeNormalizer** | Time Canonicalization | Normalized time string (return value only) | Raw user input, previousTimeSlot | ❌ Memory, ❌ Validation, ❌ Any stored value |

### 2.2 Shared Artifact: `modifiedBookingData`

`modifiedBookingData` is a **pipeline output artifact** — it flows from BusinessEngine back to ConversationEngine. It is NOT "Conversation Memory" in the ownership sense.

| Property | Rule |
|---|---|
| **Creator** | BusinessEngine (at `BusinessEngine.ts:241-248`) |
| **Content owner** | BusinessEngine — it decides what values go into it |
| **Nulling authority** | BusinessEngine MAY null any field based on business decisions (slot unavailable, validation failure, double booking, etc.) |
| **Persister** | ConversationEngine — it receives the value and decides whether to save it as `bookingDraft` |
| **Persistence rule** | `draftToSave = (bookingCreated \|\| bookingModified) ? null : modifiedBookingData` |
| **Ownership boundary** | BusinessEngine writes the CONTENT. ConversationEngine writes the STORAGE. |

### 2.3 Shared Artifact: `currentState`

`currentState` is a **runtime reconstruction** — assembled by ConversationEngine at the start of each turn.

| Property | Rule |
|---|---|
| **Assembler** | ConversationEngine (at `ConversationEngine.ts:176-206`) |
| **Sources** | (a) defaults, (b) `conversation.bookingDraft` (if not expired), (c) `activeBooking` (if modification/cancellation) |
| **Consumer** | BusinessEngine receives it as read-only input |
| **Mutation** | ConversationEngine may null booking fields after non-booking intent detection (lines 326-337) |
| **BusinessEngine access** | Read-only. BusinessEngine must NOT write to `currentState`. |

### 2.4 Golden Rule

> **Every component can write ONLY to its Owned column or designated shared artifacts within its authority. Writing to any other component's store is a bug.**

---

## 3. Data Contracts Between Layers

### 3.1 Webhook → ConversationEngine

```
Input:  { clinicSlug, clientPhone, message, source, wamid }
Output: { response, humanTakeover, bookingData, bookingCreated, intent, stage, policy }
```

**Contract**: Webhook NEVER modifies conversation state. It only passes data.

### 3.2 ConversationEngine → AIProvider

```
Input:  { clinic, history[], source, currentState{}, availableSlotsText, businessProfile }
Output: { response, intent, humanTakeover, requiresRag, bookingData{} }
```

**Contract**: AIProvider receives context, returns AI judgment. Never writes to DB.

### 3.3 ConversationEngine → BusinessEngine

```
Input:  { clinic, clientPhone, userMessage, aiResult{}, source, currentState{} }
Output: { finalResponse, bookingCreated, bookingModified, modifiedBookingData{}, resolvedIntent, trace, immutableContext }
```

**Contract**: BusinessEngine makes the final decision. Returns `modifiedBookingData` as a proposed next state. ConversationEngine persists it or discards it based on booking outcome.

**BusinessEngine's authority over `modifiedBookingData`**: BusinessEngine MAY set or null any field in `modifiedBookingData` as a business decision. This is NOT a memory write — it's a pipeline output. ConversationEngine owns the persistence boundary.

### 3.4 BusinessEngine → Validation

```
Input:  { data{}, fallbackPhone, clinic, previousTimeSlot }
Output: { isValid, missingFields[], normalizedPhone, cleanTimeSlot, normalizedService, normalizedDoctor, normalizedBranch, cleanName }
```

**Contract**: Validation returns pass/fail + normalized values. It canonicalizes (including TimeNormalizer call) but does NOT write to memory or modify input objects.

### 3.5 BusinessEngine → Calendar (BookingService)

```
Input:  { clinicId, doctorName, serviceName? }
Output: { Record<string, string[]> } — slots available per day
```

**Contract**: Calendar is pure read. Returns available slots. Does NOT modify BookingData or Memory.

---

## 4. State Lifecycle

Each piece of booking data goes through exactly 4 phases:

### Phase 1: Creation

| Field | Creator | When |
|-------|---------|------|
| `clientName` | AIProvider (extraction) | Any message containing a name |
| `clientPhone` | AIProvider OR BusinessEngine (fallback) | Any message |
| `serviceName` | AIProvider (extraction) | Any message mentioning a service |
| `doctorName` | AIProvider (extraction) | Any message mentioning a doctor |
| `branchName` | AIProvider (extraction) | Any message mentioning a branch |
| `timeSlot` | AIProvider (extraction) → BusinessEngine (deterministic) → TimeNormalizer | Any message mentioning a time |

### Phase 2: Pipeline Processing (BusinessEngine)

All fields are assembled into `modifiedBookingData` by BusinessEngine. This is a **pipeline output**, not stored memory.

**Processing rules**:
- ✅ BusinessEngine may set any field from any source (AI, TimeExtractor, currentState)
- ✅ BusinessEngine may null any field based on business decisions
- ✅ The full `modifiedBookingData` object is returned to ConversationEngine
- ❌ BusinessEngine may NOT directly write to `conversation.bookingDraft` or `conversation.messages`

### Phase 3: Validation

Validation reads from `sanitizedData` (built from the pipeline), returns pass/fail.

**Validation rules**:
- ✅ Returns `isValid` + `missingFields[]`
- ✅ Canonicalizes (normalizes) values — this IS validation for time fields
- ❌ Does NOT modify any stored memory or pipeline data outside its return value

### Phase 4: Storage Decision (ConversationEngine)

ConversationEngine decides whether to persist `modifiedBookingData`.

**Storage rules**:
- ✅ `draftToSave = (bookingCreated || bookingModified) ? null : modifiedBookingData`
- ✅ Persisted to `conversation.bookingDraft` JSON column
- ✅ Also embedded in assistant message's `bookingData` field
- ❌ Booking data must NOT persist if booking was successfully created

---

## 5. Intent Classification Rules

### 5.1 Intent Priority

```
HumanTakeover (highest priority)
    ↓ CancelAppointment
    ↓ ModifyBooking
    ↓ BookAppointment
    ↓ Objection
    ↓ Complaint
    ↓ Inquiry
    ↓ Unknown (lowest priority)
```

### 5.2 Escalation Rules

| From | To | Condition | Authority |
|------|----|-----------|-----------|
| Unknown | Inquiry | Default fallback | BusinessEngine |
| Unknown | BookAppointment | If `userMessage` matches booking patterns | BusinessEngine |
| Inquiry | BookAppointment | If service extracted AND AI did NOT respond with availability info | BusinessEngine |
| Inquiry | BookAppointment | If in booking context + short time update | BusinessEngine |
| Inquiry | (kept as Inquiry) | If AI response contains time slot patterns (`\d{1,2}:\d{2}\s+[صم]`) | BusinessEngine |

### 5.3 Escalation Forbidden

- ❌ NEVER escalate Inquiry to BookAppointment if the AI already provided available times
- ❌ NEVER escalate HumanTakeover to any other intent
- ❌ NEVER escalate CancelAppointment to BookAppointment

---

## 6. Conversation Flow (Booking Path)

```
Step 1: Greeting
        Required: nothing
        Next: collect service OR answer question
        Owner: ConversationEngine (via AI)

Step 2: Service Selection
        Required: serviceName
        Blockers: serviceName missing
        Next: doctor (if multiple) OR branch OR time
        Owner: ConversationEngine (via AI)

Step 3: Doctor Selection
        Required: doctorName (or "أي طبيب")
        Blockers: multiple doctors for service
        Next: branch OR time
        Owner: ConversationEngine (via AI)

Step 4: Branch Selection
        Required: branchName
        Blockers: branchName missing
        Next: time
        Owner: ConversationEngine (via AI)

Step 5: Time Selection
        Required: timeSlot
        Blockers: timeSlot missing, slot unavailable
        Next: confirmation
        Owner: Validation + Calendar + BusinessEngine

Step 6: Confirmation
        Required: all 5 fields
        Output: Booking created in DB
        Owner: BusinessEngine (transaction)
```

### Flow Rules

- ✅ User can skip steps (mention service + branch + time in one message)
- ✅ User can ask about availability mid-flow (Inquiry preserved)
- ❌ User asking about availability should NOT reset the flow
- ❌ Validation failing should NOT prevent the user from continuing to provide data
- ❌ A stale bookingDraft must NOT auto-fill fields the user hasn't confirmed

---

## 7. Error Classification

Every error should be classified into exactly one category:

| Category | Examples | Action |
|----------|----------|--------|
| **Pipeline** | Request timeout, crash, missing env | Fix infrastructure |
| **Memory** | State leak, wrong currentState | Fix ownership |
| **Intent** | Wrong escalation, wrong classification | Fix escalation rules |
| **Validation** | Wrong missingFields, false pass | Fix validation logic |
| **Calendar** | Wrong availability, wrong matching | Fix booking service |
| **Database** | Schema, constraint, migration | Fix schema |
| **AI** | Wrong extraction, hallucination | Fix prompt or extraction rules |
| **Frontend** | Wrong display, missing data | Fix UI |

---

## 8. Structured Logging Specification

### 8.1 Mandatory Decision Point Logs

Every architectural decision point MUST emit a structured log. Each log event MUST include: `event`, `timestamp (ISO 8601)`, `requestId`, `clinicId`, `clientPhone`.

| # | Decision Point | Event Name | File | Required Fields |
|---|---|---|---|---|
| L1 | AI returns raw output | `AI_RESPONSE` | `AIProvider.ts` | `intent`, `rawTimeSlot`, `hasBookingData`, `model`, `latencyMs` |
| L2 | Entity extraction complete | `ENTITY_EXTRACTION` | `BusinessEngine.ts` | `extracted.name`, `extracted.phone`, `extracted.service`, `extracted.doctor`, `extracted.branch`, `extracted.timeSlot`, `aiRaw.timeSlot`, `deterministicOverride`, `currentState.timeSlot` |
| L3 | After Merge Guard | `PRE_VALIDATION` | `BusinessEngine.ts` | `finalSanitized.*` (all 6 fields), `intent`, `userMessage` |
| L4 | Time normalization | `TIME_NORMALIZER` | `TimeNormalizer.ts` | `raw`, `normalized`, `hour`, `minute`, `isPM`, `isAM`, `previousTimeSlot` |
| L5 | Validation result | `VALIDATION_RESULT` | `BusinessEngine.ts` | `isValid`, `missingFields[]`, `cleanTimeSlot`, `normalizedPhone`, `phoneRestricted` |
| L6 | Double booking check | `DOUBLE_BOOKING_CHECK` | `BusinessEngine.ts` | `searchTime`, `availableDayCount`, `totalSlots`, `doctorName` |
| L7 | Double booking slot match | `DOUBLE_BOOKING_MATCH` | `BusinessEngine.ts` | `slotMatched`, `matchType` (exact/end/include/hour), `requestedTime` |
| L8 | No slot found | `DOUBLE_BOOKING_NO_SLOT` | `BusinessEngine.ts` | `searchedTime`, `failureMode` (NO_SLOTS/SLOT_NOT_FOUND), `availableDays`, `doctorName`, `serviceName` |
| L9 | Hard Gate validation failure | `HARD_GATE_ENTRY` | `BusinessEngine.ts` | `missingFields[]`, `modifiedBookingData.timeSlot` (pre-clear value), `modifiedBookingData.*` (extant fields), `willClearTimeSlot` (boolean) |
| L10 | Draft persist decision | `DRAFT_PERSIST` | `ConversationEngine.ts` | `bookingCreated`, `bookingModified`, `draftToSave` (null or object summary), `modifiedBookingData.timeSlot` |
| L11 | Draft restore (currentState assembly) | `DRAFT_RESTORE` | `ConversationEngine.ts` | `hasDraft`, `draftExpired`, `draftAgeMs`, `timeSlot` (from draft), `isModificationOrCancel`, `activeBookingTimeSlot` |
| L12 | Intent-Aware Merge decision | `MERGE_DECISION` | `ConversationEngine.ts` | `aiTimeSlot`, `currentStateTimeSlot`, `mergedTimeSlot`, `isBookingIntent`, `aiReturnedNoBookingData` |
| L13 | Session timeout | `SESSION_TIMEOUT` | `ConversationEngine.ts` | `inactivityMs`, `bookingDraftPresent`, `bookingDraftFields` (summary), `previousStateName` |
| L14 | Pipeline complete | `PIPELINE_RESULT` | `ConversationEngine.ts` | `response` (first 100 chars), `timeSlot`, `bookingCreated`, `intent`, `stage`, `policy`, `totalLatency` |
| L15 | Non-booking intent state clear | `STATE_CLEAR` | `ConversationEngine.ts` | `intent`, `clearedFields[]`, `hadTimeSlot` |

### 8.2 Event Field Reference

```
TIMESTAMP: ISO 8601 UTC string (e.g., "2026-07-27T14:30:00.000Z")
REQUEST_ID: string — from webhook/API entry
CLINIC_ID: string — UUID
CLIENT_PHONE: string — E.164 format

For all events: { event, timestamp, requestId, clinicId, clientPhone, ...eventSpecificFields }
```

### 8.3 Logging Implementation Rules

1. **All events MUST use a structured logging function** — NOT raw `console.log`. When transitioning from TIME_TRACE Phase A, upgrade to `Logger.metric()` or a structured JSON logger.
2. **Event name MUST be uppercase with underscores** — matches the table above.
3. **PII fields** (clientPhone, clientName) MUST be logged — they are essential for incident reconstruction. The system operates in a regulated healthcare context where audit trails require identity.
4. **No silent decisions** — every if/else branch that affects timeSlot MUST have a corresponding log event.
5. **Log events MUST be emitted at the decision point** — not batched at the end.

---

## 9. TIME_TRACE Evolution Plan (Phase B)

### 9.1 Current State (Phase A)

```
Status: 🚧 Active — temporary console.log instrumentation
Files:  TimeNormalizer.ts, BusinessEngine.ts, BookingService.ts, types.ts
Count:  12 console.log statements across 5 files
Marker: "// 🚧 TIME_TRACE (Phase A — يزال بعد انتهاء التحقيق)"
Format: Console.log with "[TIME_TRACE]" prefix — unstructured
```

### 9.2 Target State (Phase B — Production)

```
Status: 🟢 Active — permanent structured logging
Logger: Logger.metric(eventName, data) OR equivalent structured logger
Format: JSON with required schema (see Section 8)
Coverage: All 15 decision points (L1-L15)
Removal: All "// 🚧 TIME_TRACE" comments and temporary console.log calls
```

### 9.3 Migration Steps

| Step | Action | Phase |
|------|--------|-------|
| 1 | Map each existing `[TIME_TRACE]` log to its corresponding event in Section 8.1 | Phase B Planning |
| 2 | Replace `console.log(`[TIME_TRACE]...`)` with `Logger.metric("EVENT_NAME", { ... })` | Phase B Implementation |
| 3 | Add new events for the 5 previously-unlogged decision points (L9-L13) | Phase B Implementation |
| 4 | Remove all `// 🚧 TIME_TRACE (Phase A)` comments | Phase B Cleanup |
| 5 | Verify coverage: every Section 8 event has exactly one emission point in code | Phase B Verification |
| 6 | Remove this section (9) from the specification | Phase B Completion |

### 9.4 Migration Trigger

Phase B MUST be triggered by **one** of:
- First production deployment after hardening implementation
- First incident that requires log-based reconstruction (proves Phase A insufficient)
- Scheduled: within 30 days of Phase A activation (whichever comes first)

---

## 10. Production Readiness Gates

### 10.1 Risk Classification

| Level | Definition | Deployment Policy |
|---|---|---|
| **HIGH** | Active in production, causes user-facing incorrect behavior, data leakage | **MUST be resolved** before deployment to production. Exception requires CTO sign-off. |
| **MEDIUM** | Possible in production, moderate impact, detectable symptoms | **Must be documented** with either (a) a mitigation plan with owner and deadline, or (b) an explicit Accepted Risk with engineering justification. |
| **LOW** | Edge case, requires multiple unlikely conditions, no data corruption | Acceptable as-is. May be tracked in backlog. |

### 10.2 Risk Inventory

#### HIGH Risks (must resolve before deployment)

| ID | Risk | Owner | Resolution |
|----|------|-------|------------|
| R4 | bookingDraft spread into currentState with stale timeSlot | ConversationEngine | P2: Selective draft restoration |
| R5 | Intent-Aware Merge `\|\|` fallthrough re-introduces stale timeSlot | ConversationEngine | P1: Guard on user time keywords |
| R13 | Hard Gate validation failure does not clear modifiedBookingData.timeSlot | BusinessEngine | P0: Clear in Hard Gate path |
| R17 | Uncleared timeSlot persists to bookingDraft | ConversationEngine | Solved by P0 (clear source) |

#### MEDIUM Risks (must document mitigation or acceptance)

| ID | Risk | Mitigation / Acceptance | Owner |
|----|------|------------------------|-------|
| R1 | Zod schema accepts any string from LLM | **Mitigation**: Add Zod `.regex()` pattern validator that rejects non-time-like strings (digits, colons, AM/PM markers, Arabic date words). Accepts only patterns matching known canonical formats or recognizable raw expressions. | AIProvider |
| R2 | Prompt includes stale currentState.timeSlot, priming LLM to regurgitate it | **Accepted Risk**: Stripping timeSlot from prompt would require tracking whether user mentioned time this turn — adds complexity. Mitigated by P1 (merge guard blocks re-entry) and P0 (draft clearance). The prompt value is a hint, not a source of truth; BusinessEngine's deterministic layer overrides LLM output. | — |
| R6 | AI returning null bookingData causes full currentState spread, bypassing merge | **Accepted Risk**: Rare LLM behavior (model returns intent but no bookingData object). The spread is conservative — it preserves all existing data rather than losing it. Safer to preserve than to clear. Mitigated by P0/P1 at other layers. | — |
| R10 | Priority chain falls through to currentState.timeSlot when AI returns null | **Mitigated by P1**: P1 guard on user time keywords at merge boundary prevents stale value from entering the chain. No additional mitigation needed. | ConversationEngine |
| R11 | Active Session Detection `!aiBookingIntent && !aiExtractedBookingField` may miss cases where AI extracts a booking field but misclassifies intent | **Accepted Risk**: The condition errs on the side of preserving data (does NOT clear when uncertain). Clearing aggressively would cause worse user experience (lost booking progress). Condition is demonstrably correct for all known production patterns. | — |
| R19 | validateBookingData calls TimeNormalizer.normalize(), transforming the value — violates strict "validation is read-only" principle | **Accepted Risk**: For time fields, normalization IS validation — parsing an ambiguous expression into canonical format is inherently transformative. The alternative (split into pre-normalization + validation) adds a pipeline stage for no practical benefit. The architectural comment at `types.ts:267-268` is acknowledged: this is intentional design, not a bug. | — |
| R20 | PM heuristic for hours 1-8 without AM/PM context | **Mitigation (P3)**: Review heuristic threshold. Consider requiring explicit AM/PM context for hours 1-5 (most ambiguous), keeping PM default for 6-8 (typical clinic PM hours). | TimeNormalizer |
| R22 | Slot format mismatch between cleanTimeSlot and BookingService slot strings | **Accepted Risk**: Matching uses 4 fallback strategies (exact, endsWith, includes, hour-level). In practice, format divergence would cause "slot unavailable" responses (visible, detectable) rather than silent data corruption. Would be caught by VALIDATION_RESULT + DOUBLE_BOOKING_CHECK logs. | — |

#### LOW Risks (acceptable, tracked in backlog)

All LOW risks per TIME_PIPELINE_HARDENING_PLAN.md Section 4 are acceptable as-is. No action required.

### 10.3 Deployment Check

Before any production deployment, the following MUST be verified:

| Check | Criteria | Verified By |
|-------|----------|-------------|
| HIGH risks | All resolved (code fix merged and tested) | CI pipeline + code review |
| MEDIUM risks | All documented (mitigation plan OR Accepted Risk with justification) | This document (Section 10.2) |
| Logging L1-L14 | All 15 decision points emit structured logs | Code review + log grep |
| Regression tests | Tests pass for changed components | CI pipeline |
| TimeSlot pipeline | No `"05:00 م"` leak reproduces in golden test | Golden regression suite |

### 10.4 Emergency Deployment

If a critical fix (security, data loss, total outage) requires deployment before meeting gates:

1. CTO must approve the exception in writing
2. A tracking issue MUST be created with 7-day resolution deadline
3. The deployment MUST have enhanced monitoring (all 15 log events verified manually)
4. Rollback plan MUST exist and be documented

---

## 11. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 26 Jul 2026 | Initial specification after 4 architectural fixes | Engineering Team |
| 2.0 | 27 Jul 2026 | Resolved ownership model (modifiedBookingData as shared artifact), added TimeExtractor/TimeNormalizer to ownership matrix, added 15-event logging spec (L1-L15), added TIME_TRACE Phase B plan, added Production Readiness Gates with risk inventory | Engineering Review |

---

**This document is the single source of truth for Clinova runtime contracts. Any code that violates it is a bug by definition, not by opinion.**

**Author**: Engineering Team (derived from investigations 26 Jul 2026, engineering review 27 Jul 2026)  
**Review Cycle**: Every 2 weeks or after any architectural change  
**Status**: 🟢 Active
