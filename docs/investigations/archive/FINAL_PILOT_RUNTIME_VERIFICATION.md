# FINAL PILOT RUNTIME VERIFICATION

> **Date**: 2026-07-27
> **Test**: Full 7-turn pilot conversation through live AIProvider + BusinessEngine pipeline
> **Simulation**: Intent-Aware Merge + P2 state management modeled after ConversationEngine.ts
> **Result**: ❌ **FAIL** — Turn 2 failure

---

## Executive Summary

The booking intent fix (prompt extension + post-AI safeguard + BusinessEngine escalation) **works for single-turn scenarios** but **fails in multi-turn conversation context**. When "أريد الحجز" is the user's **second message** (after greeting → AI response), gemini-2.0-flash-lite returns `Inquiry` instead of `BookAppointment` with the exact same greeting response — treating the booking request as a re-greeting.

The safeguard layers (2 & 3) only correct `Unknown` → `BookAppointment`, not `Inquiry` → `BookAppointment`, so the failure propagates undetected.

---

## Test Results

| Turn | User Message | AI Intent | Expected | Result |
|------|-------------|-----------|----------|--------|
| 1 | `السلام عليكم` | `Inquiry` | `Inquiry` | ✅ PASS |
| 2 | `أريد الحجز` | `Inquiry` ❌ | `BookAppointment` | ❌ **FAIL** |
| 3 | `0501234567` | — | `BookAppointment` | ⏹️ Stopped |
| 4 | `فيلر` | — | `BookAppointment` | ⏹️ Stopped |
| 5 | `الصحافة` | — | `BookAppointment` | ⏹️ Stopped |
| 6 | `غداً` | — | `BookAppointment` | ⏹️ Stopped |
| 7 | `الساعة 6 مساءً` | — | `BookAppointment` | ⏹️ Stopped |

---

## Failure Details — Turn 2

### Raw AI Response
```json
{
  "response": "يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸",
  "intent": "Inquiry",
  "humanTakeover": false,
  "requiresRag": false,
  "bookingData": {
    "clientName": null,
    "clientPhone": null,
    "serviceName": null,
    "doctorName": null,
    "branchName": null,
    "timeSlot": null
  },
  "usage": {
    "promptTokens": 3452,
    "completionTokens": 73,
    "totalTokens": 3525
  }
}
```

### Raw State (before Turn 2)
```json
{
  "clientName": null,
  "clientPhone": "+966501234567",
  "serviceName": null,
  "doctorName": null,
  "branchName": null,
  "timeSlot": null
}
```

### Raw History (before Turn 2)
```json
[
  { "role": "user", "content": "السلام عليكم" },
  { "role": "assistant", "content": "يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸" }
]
```

### Observations
- AI returned **exact same response** as the greeting — treating "أريد الحجز" as a re-greeting
- AI extracted **no booking data** (all null)
- `promptTokens`: 3452, `completionTokens`: 73 (very short response)
- The booking intent fix's **post-AI safeguard** (AIProvider.ts:258-271) only handles `Unknown` → `BookAppointment`, not `Inquiry` → `BookAppointment`
- The **BusinessEngine escalation** (line 256) only handles `Unknown` → `BookAppointment`, not `Inquiry` → `BookAppointment`
- Phone was already in state from Turn 1 (`+966501234567` via BusinessEngine auto-injection)

---

## Turn 1 — Passed

| Field | Value |
|-------|-------|
| User message | `السلام عليكم` |
| AI intent | `Inquiry` ✅ |
| AI response | `"يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸"` |
| BE resolved intent | `Inquiry` |
| BE response | `"يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸"` |
| BE bookingData | `{ clientName:null, clientPhone:+966501234567, ...all null }` |
| timeSlot | `null` ✅ |
| Booking created | `false` |

No phantom time, no Unknown intent, no stale state.

---

## Root Cause Analysis

### Why the original fix doesn't cover this scenario

The booking intent fix was designed and tested with **single-turn first messages**. The regression test (`booking_intent_regression.test.ts`) sends each booking phrase as the *only* message in an empty conversation. When a conversation has history, the AI sees:

1. user: "السلام عليكم"
2. assistant: "يا هلا ومسهلا بكِ! كيف أقدر أساعدكِ اليوم؟ 🌸"
3. user: "أريد الحجز"

The AI interprets "أريد الحجز" as a continuation of the greeting phase rather than a booking request. The system prompt saying "إذا كان طلب المستخدم هو حجز موعد (مثل: 'أبغى أحجز'، 'احجز لي'، 'أريد الحجز')" doesn't override this context-based misclassification.

### Why layers 2 & 3 don't catch it

| Layer | Trigger | Handles |
|-------|---------|---------|
| Layer 1: AI Prompt | — | Extended booking examples |
| Layer 2: Post-AI Safeguard (AIProvider.ts:258) | `intent === "Unknown"` | Corrects `Unknown`→`BookAppointment` |
| Layer 3: BusinessEngine escalation (line 256) | `intent === "Unknown"` | Corrects `Unknown`→`BookAppointment` |
| **GAP** | **`intent === "Inquiry"`** | **NOT handled by any layer** |

When the AI returns `Inquiry` (not `Unknown`), both safety nets pass it through unchanged.

---

## Remaining Risks

| Risk | Severity | Impact | Mitigation Needed |
|------|----------|--------|-------------------|
| **Multi-turn AI misclassification**: AI returns `Inquiry` instead of `BookAppointment` for booking keywords in conversations with history | **CRITICAL** | Any booking request after AI's initial greeting response will fail to register as a booking | Extend Layer 2 or Layer 3 to correct `Inquiry`→`BookAppointment` when message has booking keywords |
| **First-turn booking**: Single-message booking requests (no history) | RESOLVED ✅ | — | Prompt extension works |
| **Phantom timeSlot**: AI hallucinates `timeSlot` | Low (not reproduced) | — | Can't confirm, needs production monitoring |
| **Unknown intent on first turn**: AI returns `Unknown` for "أريد الحجز" as first message | RESOLVED ✅ | — | Prompt + safeguards work |
| **Stale booking state**: Greeting inherits previous booking data | RESOLVED ✅ | — | Active Session Gate + lifecycle tests pass |

---

## Production Recommendation

**DO NOT DEPLOY** the current fix in isolation. While it resolves the original P0 (Unknown intent on first-turn booking), it does NOT resolve multi-turn conversation scenarios where the AI misclassifies booking requests as `Inquiry`.

### Required changes before production deployment

**Option A (recommended — minimal change):**
Extend both the post-AI safeguard (AIProvider.ts:258) and BusinessEngine escalation (line 256) to also handle `Inquiry` → `BookAppointment` when the message contains booking keywords:

```typescript
// AIProvider.ts — extend condition
if ((parsed.intent === "Unknown" || parsed.intent === "Inquiry") && lastMsg?.role === "user") {
```

```typescript
// BusinessEngine.ts — extend condition  
if ((resolvedIntent === "Unknown" || resolvedIntent === "Inquiry") && isNewBookingRequest) {
```

**Option B (more robust):**
Add `isNewBookingRequest` check BEFORE the Inquiry branch in BusinessEngine.ts (around line 269), catching all booking-pattern messages regardless of AI intent.

**Option C (most robust):**
Use `isNewBookingRequest` as a pre-check in ConversationEngine, forcing intent to `BookAppointment` before the AI call when the message matches booking patterns — eliminating AI misclassification entirely for booking keyword messages.

### Verification needed after fix
1. Re-run `pilot_conversation_simulation.test.ts` — all 7 turns must pass
2. Re-run `booking_intent_regression.test.ts` — all 33 tests must still pass
3. Run full `npm test` — no regression
4. Run `npm run build` — clean compile

---

## Raw Data Archive

All raw data captured at failure point:

- **Turn 2 raw AI JSON**: See above (intent=`Inquiry`, response=greeting)
- **Turn 2 raw state**: `clientPhone="+966501234567"`, all other fields null
- **Turn 2 raw history**: 2 messages (user greeting + assistant greeting)
- **Turn 1 raw AI JSON**: intent=`Inquiry`, response=greeting, bookingData=all null
- **Turn 1 raw BE**: resolvedIntent=`Inquiry`, bookingData.phone set to sender

The simulation script is at `src/__tests__/unit/pilot_conversation_simulation.test.ts` and can be re-run after any fix.
