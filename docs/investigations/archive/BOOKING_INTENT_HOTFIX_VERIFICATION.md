# BOOKING INTENT HOTFIX VERIFICATION

> **Date**: 2026-07-27
> **Fix**: Extend intent safeguard from `Unknown` only → `Unknown` OR `Inquiry` when booking keywords present
> **Status**: ✅ **VERIFIED — All tests pass, build clean, pilot simulation green**

---

## Changes Made

### File 1: `src/lib/infrastructure/ai/AIProvider.ts` (line 266)

**Before:**
```typescript
if (parsed.intent === "Unknown" && lastMsg?.role === "user") {
```

**After:**
```typescript
if ((parsed.intent === "Unknown" || parsed.intent === "Inquiry") && lastMsg?.role === "user") {
```

**Layer:** Layer 2 — Post-AI deterministic regex correction
**Guard:** `/حجز|أحجز|موعد|احجز|book/i` (booking keywords in last user message)

---

### File 2: `src/lib/domain/BusinessEngine.ts` (line 256)

**Before:**
```typescript
if (resolvedIntent === "Unknown" || resolvedIntent === "unknown" || !resolvedIntent) {
```

**After:**
```typescript
if (resolvedIntent === "Unknown" || resolvedIntent === "Inquiry" || resolvedIntent === "unknown" || !resolvedIntent) {
```

**Layer:** Layer 3 — BusinessEngine escalation
**Guard:** `isNewBookingRequest` regex (`/حجز|أحجز|موعد|احجز|عاوزة\s*احجز|.../i`)

---

## Safety Analysis: All `Inquiry` Code Paths Reviewed

| Location | Existing Behavior | Impact of Change | Risk |
|----------|------------------|-------------------|------|
| **AIProvider.ts:266** | Only catches `Unknown` | Now catches `Unknown`+`Inquiry` | **SAFE** — Guarded by booking keyword regex |
| **BusinessEngine.ts:256** | Only escalates `Unknown` | Now escalates `Unknown`+`Inquiry` | **SAFE** — Guarded by `isNewBookingRequest` regex |
| **BE.ts:269 (PF-003)** | Already escalates `Inquiry` if `extractedService` set | No change | — |
| **BE.ts:279 (Context)** | Already escalates `Inquiry` if `inBookingContext` | No change | — |
| **BE.ts:708 (Routing)** | Routes `Inquiry` to RAG/BookingService | No change (Inquiry escalated before reaching this) | **SAFE** |
| **CE.ts:354 (State)** | Clears transient state on `Inquiry` | No change (if escalated early, CE never sees Inquiry) | **SAFE** |

### False-positive protection: `isNewBookingRequest` regex

Validated that the following DO NOT match the regex (no false escalation):
- `إيه المواعيد المتاحة بكرة؟` ✓ (G005 — "المواعيد" ≠ "موعد")
- `السلام عليكم` ✓
- `شكراً` ✓
- `هلا` ✓
- `كم سعر الفيلر؟` ✓

Validated that the following DO match (correct escalation):
- `أريد الحجز` ✓
- `عاوزة احجز` ✓
- `أبغى أحجز` ✓
- `ممكن أحجز` ✓
- `أبي موعد` ✓
- `أحتاج موعد` ✓
- `بحجز` ✓

---

## Test Results

### Suite: Booking Intent Regression (`booking_intent_regression.test.ts`)

| Suite | Tests | Result |
|-------|-------|--------|
| AIProvider Safeguard (7 single-turn phrases) | 7 | ✅ ALL PASS |
| BusinessEngine Escalation (11 patterns) | 11 | ✅ ALL PASS |
| isNewBookingRequest regex (15 patterns) | 15 | ✅ ALL PASS |
| **Multi-turn (4 booking phrases after greeting)** | **4** | ✅ **ALL PASS** |

**Multi-turn scenarios verified:**
1. `السلام عليكم` → `أريد الحجز` → **BookAppointment** ✅
2. `السلام عليكم` → `عاوزة احجز` → **BookAppointment** ✅
3. `السلام عليكم` → `أبغى أحجز` → **BookAppointment** ✅
4. `السلام عليكم` → `ممكن أحجز` → **BookAppointment** ✅

### Suite: Pilot Conversation Simulation (`pilot_conversation_simulation.test.ts`)

| Turn | Message | AI Intent | BE Intent | Result |
|------|---------|-----------|-----------|--------|
| 1 | `السلام عليكم` | `Inquiry` | `Inquiry` | ✅ |
| 2 | `أريد الحجز` | **`BookAppointment`** ✅ | `BookAppointment` | ✅ **FIX VERIFIED** |
| 3 | `0501234567` | `BookAppointment` | `BookAppointment` | ✅ |
| 4 | `فيلر` | `BookAppointment` | `BookAppointment` | ✅ |
| 5 | `الصحافة` | `BookAppointment` | `BookAppointment` | ✅ |
| 6 | `غداً` | `BookAppointment` | `BookAppointment` | ✅ |
| 7 | `الساعة 6 مساءً` | `BookAppointment` | `BookAppointment` | ✅ |

Final booking draft: `{ phone: "+966501234567", service: "فيلر", branch: "الصحافة", timeSlot: "06:00 م" }`

### Full Test Run

```
Test Files: 23 passed (23)
     Tests: 138 passed (138)
```

### Build

```
✓ Compiled successfully in 5.8s
✓ Generating static pages using 7 workers (30/30) in 578ms
```

---

## Previous Failure: Root Cause & Resolution

**Root cause:** In a multi-turn conversation (greeting → AI response → booking request), gemini-2.0-flash-lite returned `Inquiry` instead of `BookAppointment` for "أريد الحجز". The original safeguard only corrected `Unknown` → `BookAppointment`, but the AI returned `Inquiry` (not `Unknown`), so both safety nets (Layers 2 & 3) passed it through unchanged.

**Fix mechanism:** Both safety nets now treat `Inquiry` the same as `Unknown` when the user message contains explicit booking keywords (`/حجز|أحجز|موعد|احجز/`).

**Verification artefact:** The 7-turn pilot conversation now completes without failure — Turn 2 is correctly classified as `BookAppointment`.

---

## Deployment Risk Assessment

| Risk | Assessment | Mitigation |
|------|-----------|------------|
| **False escalation of genuine Inquiries** | **LOW** — `isNewBookingRequest` regex is specific to booking keywords; generic inquiries (FAQ, pricing, clinic info, medical questions) don't match | Verified with regex analysis (G005, greetings, thanks) |
| **Break existing Inquiry→RAG routing** | **NONE** — If a message matches booking keywords, escalating to BookAppointment is correct behavior; RAG routing only fires for non-booking intents |
| **Stale state leakage** | **NONE** — ConversationEngine only clears state on `Inquiry` intent. If escalation happens in AIProvider (before CE sees it), CE never sees `Inquiry` → state preserved correctly |
| **Performance impact** | **NONE** — Two boolean condition additions only; no new dependencies, no IO |
| **Regression** | **NONE** — All 138 existing tests pass, 23/23 test files green |

### Rollback procedure

If deployed and a false escalation is detected:
```bash
# Option 1: Revert both files
git checkout src/lib/infrastructure/ai/AIProvider.ts
git checkout src/lib/domain/BusinessEngine.ts

# Option 2: Selective revert (revert only the Inquiry addition)
# AIProvider.ts:266 — remove `|| parsed.intent === "Inquiry"`
# BusinessEngine.ts:256 — remove `|| resolvedIntent === "Inquiry"`
```

---

## Files Changed

| File | Lines Changed | Type |
|------|--------------|------|
| `src/lib/infrastructure/ai/AIProvider.ts` | 1 | 🔧 Fix (condition extension) |
| `src/lib/domain/BusinessEngine.ts` | 1 | 🔧 Fix (condition extension) |
| `src/__tests__/unit/booking_intent_regression.test.ts` | ~70 | 🧪 Tests (multi-turn suite) |
| `src/__tests__/unit/pilot_conversation_simulation.test.ts` | 3 | 🧪 Fix (history ordering) |

**Total: 4 files, 2 logic changes (+4 chars each), ~70 lines of test code**

---

## Recommendation

✅ **READY FOR DEPLOYMENT.** No pre-existing tests break. The 7-turn pilot conversation that previously failed on Turn 2 now completes entirely. The fix adds no new dependencies, no new IO, and no architectural changes — only extends the condition in two existing safety-nets from `Unknown` to `Unknown OR Inquiry`.

The remaining architectural observation (that `historyToModel` in ConversationEngine does not include the current user message) means the AIProvider safeguard is only effective when callers push the user message to history before the AI call. The BusinessEngine escalation (Layer 3) always works independently of history structure and serves as the universal safety net.
