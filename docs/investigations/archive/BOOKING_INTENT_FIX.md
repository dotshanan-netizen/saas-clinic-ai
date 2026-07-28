# P0 — Booking Intent Reliability Fix

## Root Cause

The AI model (gemini-2.0-flash-lite) returned `intent: "Unknown", response: ""` for `"أريد الحجز"` — a clear booking request. The same failure pattern was observed for other common Arabic booking phrases.

### Why the model failed

Two contributing factors:

1. **Insufficient prompt examples** — The AIProvider system prompt (line 117) listed only two booking examples (`"أبغى أحجز", "احجز لي"`) with "إلخ" (etc.). The model failed to generalize from these to structurally different but semantically identical phrases like `"أريد الحجز"`.

2. **Contradictory instructions** — The system_prompt.txt (line 50) enforces a **Zero Hallucination Policy**: *"يُمنع منعاً باتاً افتراض أو تخمين أي حقل لم يذكره العميل صراحة"*. When the model couldn't extract any booking data from the message, this policy suppressed the booking intent alongside the empty fields — the model chose "Unknown" over "BookAppointment with null data" as the safer output.

### Why the crash didn't surface in production

Despite the AI returning Unknown, the **BusinessEngine safety net** at line 256-258 **already escalates** Unknown → BookAppointment when the message matches `/حجز|.../i`. But:
- The escalation happens AFTER the ConversationEngine's Intent-Aware Merge, which uses identity-only merge for Unknown intents (nulling booking fields).
- The response text was empty (`response: ""`), requiring the BusinessEngine Hard Gate (line 613-677) to generate a fallback.
- **User impact**: delayed response (extra code paths) and a generic fallback message instead of a context-aware booking prompt.

---

## Changes Made

### 1. AIProvider.ts — Extended prompt examples (line 117)

**Before:**
```
- إذا كان طلب المستخدم هو حجز موعد (مثل: "أبغى أحجز"، "احجز لي"، إلخ)، يجب أن تكون النية دائماً "BookAppointment"، حتى لو كانت بعض البيانات ناقصة.
```

**After:**
```
- إذا كان طلب المستخدم هو حجز موعد (مثل: "أبغى أحجز"، "احجز لي"، "أريد الحجز"، "عاوزة احجز"، "أبي موعد"، "أحتاج موعد"، "أبغى موعد"، "حجز"، إلخ)، يجب أن تكون النية دائماً "BookAppointment"، حتى لو كانت بعض البيانات ناقصة.
- تنبيه هام: لا تجعلي النية أبداً "Unknown" عندما يطلب العميل حجز موعد بأي صيغة مشابهة — أي جملة تحتوي على كلمة "حجز" أو "موعد" أو "احجز" تعبر عن طلب حجز ما لم تكن صراحةً إلغاء أو تعديل.
```

**Effect:** 6 additional explicit booking examples + a stronger imperative rule telling the model to never return Unknown for any sentence containing حجز/موعد/احجز unless explicitly a cancel/modify request.

### 2. AIProvider.ts — Post-AI intent safeguard (lines 258-271)

Added a **deterministic regex safeguard** that runs AFTER the model response is parsed:

```typescript
const lastMsg = history.length > 0 ? history[history.length - 1] : null;
if (parsed.intent === "Unknown" && lastMsg?.role === "user") {
  const userText = lastMsg.content || "";
  const isBookingRequest = /حجز|أحجز|موعد|احجز|book/i.test(userText)
    && !/إلغاء|كنسل|تعديل|تغيير|cancel|modify|delete/i.test(userText);
  if (isBookingRequest) {
    parsed.intent = "BookAppointment";
  }
}
```

**Effect:** Catches ANY model failure (regardless of prompt) for booking phrases. If the user message contains booking keywords and the model returned Unknown, the intent is corrected to BookAppointment BEFORE it reaches ConversationEngine's Intent-Aware Merge. This ensures the merge uses full merge (preserving identity fields) instead of identity-only merge (nulling booking fields).

### 3. BusinessEngine.ts — Extended `isNewBookingRequest` regex (line 250)

**Before:**
```javascript
/حجز|أحجز|حابة أحجز|ابغى احجز|أبي أحجز|أبغى أحجز/i
```

**After:**
```javascript
/حجز|أحجز|موعد|احجز|عاوزة\s*احجز|عايز\s*احجز|أريد\s*الحجز|أبغى\s*(أحجز|موعد)|أبي\s*(أحجز|موعد)|أحتاج\s*(موعد|حجز)/i
```

**Effect:** Matches 12+ common booking patterns including Egyptian/Lavantine (`عاوزة`, `عايز`), full phrases (`أريد الحجز`, `أحتاج موعد`), and standalone keywords (`موعد`, `احجز`). The `تعديل|تغيير|تغير` exclusion prevents false escalation for modification requests.

---

## Files Changed

| File | Change | Impact |
|------|--------|--------|
| `src/lib/infrastructure/ai/AIProvider.ts` | Extended prompt examples (line 117) + post-AI safeguard (lines 258-271) | Prevents model from returning Unknown for booking phrases at the earliest point |
| `src/lib/domain/BusinessEngine.ts` | Extended `isNewBookingRequest` regex (line 250) | Second-layer safety net catches booking phrases that bypass the first safeguard |
| `src/__tests__/unit/booking_intent_regression.test.ts` | 27 tests across 3 suites | Permanent regression coverage |

---

## Regression Results

### Suite 1: AIProvider + BusinessEngine (full pipeline, real AI calls)

| Phrase | AI Intent (after safeguard) | BE Intent | Response | timeSlot |
|--------|---------------------------|-----------|----------|----------|
| أريد الحجز | ✅ BookAppointment | BookAppointment | "حياك الله، يا قلبي! 🌸 ممكن أعرف اسمكِ الكريم؟" | null |
| عاوزة احجز | ✅ BookAppointment | BookAppointment | "حياك الله، يا قلبي! 🌸 ممكن تقولي لي اسمك..." | null |
| أبغى أحجز | ✅ BookAppointment | BookAppointment | "حياك الله، يا قلبي! 🌷 عشان أقدر أساعدك..." | null |
| أبي موعد | ✅ BookAppointment | BookAppointment | "حياك الله، يا قلبي! 🌸 ممكن تقولي لي اسمكِ..." | null |
| أحتاج موعد | ✅ BookAppointment | BookAppointment | "أهلاً وسهلاً بكِ 🌷، حابة أساعدك في حجز موعد..." | null |

### Suite 2: BusinessEngine escalation (simulated AI Unknown)

| Phrase | Intent (Unknown → ?) | Result |
|--------|---------------------|--------|
| أريد الحجز | Unknown → **BookAppointment** | ✅ |
| عاوزة احجز | Unknown → **BookAppointment** | ✅ |
| أبغى أحجز | Unknown → **BookAppointment** | ✅ |
| أبي موعد | Unknown → **BookAppointment** | ✅ |
| أحتاج موعد | Unknown → **BookAppointment** | ✅ |
| السلام عليكم | Unknown → **Inquiry** | ✅ |
| شكراً | Unknown → **Inquiry** | ✅ |
| عاوزة ألغي | Unknown → **Inquiry** | ✅ |

### Suite 3: Regex patterns

- 14 tests covering all booking patterns + exclusions → **14/14 passed**

### Runtime: 11.65s (27 tests, 10.7s in LLM calls)
- 5 real AI calls (gemini-2.0-flash-lite)
- 8 BusinessEngine-only tests
- 14 regex-only tests

---

## Defense-in-Depth Architecture

```
User Message: "أريد الحجز"
     │
     ▼
┌────────────────────────────────────────────────┐
│ LAYER 1: Improved Prompt (AIProvider.ts:117)   │
│ 6 explicit booking examples + strong rule      │
│ Prevents model misclassification at source     │
└────────────────────┬───────────────────────────┘
                     │ (model might still fail)
                     ▼
┌────────────────────────────────────────────────┐
│ LAYER 2: Post-AI Safeguard (AIProvider.ts:258) │
│ Deterministic regex: corrects Unknown →        │
│ BookAppointment if message has booking keywords│
└────────────────────┬───────────────────────────┘
                     │ (safeguard might be bypassed)
                     ▼
┌────────────────────────────────────────────────┐
│ LAYER 3: BusinessEngine Escalation (line 256)  │
│ isNewBookingRequest regex matches booking      │
│ patterns and upgrades Unknown → BookAppointment│
└────────────────────┬───────────────────────────┘
                     │
                     ▼
          ✅ BookAppointment + proper response
```

## Verification Against Phantom Time

The fix does NOT reintroduce the phantom time bug:
- The post-AI safeguard only corrects `intent`, never touches `timeSlot`
- The BusinessEngine escalation only upgrades `intent`, `timeSlot` follows existing deterministic pipeline
- Regression tests confirm `timeSlot === null` for all 5 booking phrases
