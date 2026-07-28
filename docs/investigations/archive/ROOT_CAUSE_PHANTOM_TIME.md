# Root Cause Forensic — Phantom Time (05:00 PM)

**Incident:** System rejected branch-only input `"الصحافة"` with `"عذراً، الوقت الذي اخترته (05:00 م) لم يعد متاحاً"` despite the user never mentioning any time.

**Date:** 2026-07-27  
**Method:** Manual Pilot trace via WhatsApp conversation log  

---

## 1. Complete Pipeline Trace (per turn)

### Turn 1: `"السلام عليكم"`

| Stage | Input → Output | Source |
|-------|---------------|--------|
| User message | `"السلام عليكم"` | — |
| **AI response** | `intent: "Inquiry", bookingData: { ..., timeSlot: null }` | ✅ No phantom |
| TimeExtractor | `"السلام عليكم"` → `null` | `TimeExtractor.ts:44-195` |
| TimeNormalizer | not triggered (intent is Inquiry) | — |
| BusinessEngine | intent not BookAppointment → skip validation | `BusinessEngine.ts:286` |

### Turn 2: `"أريد الحجز"`

| Stage | Input → Output | Source |
|-------|---------------|--------|
| User message | `"أريد الحجز"` | — |
| **AI response** | `intent: "BookAppointment", bookingData: { clientName: ..., timeSlot: null }` | ✅ No phantom |
| TimeExtractor | `"أريد الحجز"` → `null` | `TimeExtractor.ts:44-195` |
| Intent upgrade | `"حجز"` matched → `BookAppointment` | `BusinessEngine.ts:250` |
| validateBookingData | `timeSlot = null` → `missingFields: ["الوقت المناسب"]` → AI asked for service | `types.ts:267-276` |

### Turn 3: `"0501234567"`

| Stage | Input → Output | Source |
|-------|---------------|--------|
| User message | `"0501234567"` | — |
| currentState | service=null, branch=null, timeSlot=null | `ConversationEngine.ts:189-196` |
| **AI response** | `intent: "BookAppointment", bookingData: { clientPhone: "0501234567", timeSlot: null }` | ✅ No phantom |
| TimeExtractor | `"0501234567"` → `null` | `TimeExtractor.ts:44-195` |
| extractPhone | `clientPhone = "0501234567"` set from message | `BusinessEngine.ts:167-171` |

### Turn 4: `"فيلر"`

| Stage | Input → Output | Source |
|-------|---------------|--------|
| User message | `"فيلر"` | — |
| currentState | service=null, branch=null, timeSlot=null | `ConversationEngine.ts:189-196` |
| **AI response** | `intent: "BookAppointment", bookingData: { serviceName: "فيلر", timeSlot: null }` | ✅ No phantom |
| TimeExtractor | `"فيلر"` → `null` | `TimeExtractor.ts:44-195` |
| extractService | `normalizeToOfficial("فيلر", services)` → `"فيلر"` | `BusinessEngine.ts:173-176` |
| BusinessEngine | validates, asks for branch → correct | `BusinessEngine.ts:338-351` |

### 🔴 Turn 5: `"الصحافة"` — THE CRASH

| Stage | Input → Output | timeSlot Value | Source |
|-------|---------------|----------------|--------|
| User message | `"الصحافة"` | — | — |
| currentState | `{ service: "فيلر", branch: null, timeSlot: null }` | **null** | `ConversationEngine.ts:189-196` |
| Draft restoration | timeSlot explicitly excluded | **null** | `ConversationEngine.ts:211-212` |
| currentState passed to AI | service="فيلر", branch="غير محدد", timeSlot="غير محدد" | **غير محدد** | `AIProvider.ts:106-112` |
| **AI Response (RAW)** | `intent: "BookAppointment", bookingData: { branchName: "فرع الصحافة", **timeSlot: "05:00 م"** }` | **"05:00 م" ← PHANTOM ORIGIN** | `AIProvider.ts:228-255` |
| Zod validation | `timeSlot: "05:00 م"` → passes schema (valid string) | `"05:00 م"` | `AIProvider.ts:242-250` |
| **TimeExtractor** | `extract("الصحافة")` → **null** | ❌ NOT the source | `TimeExtractor.ts:44-195` |
| BusinessEngine L130-134 | `isNumericTimeFound = false` → `extractedTime = aiResult.bookingData.timeSlot` | `"05:00 م"` ← flows through | `BusinessEngine.ts:130-134` |
| BusinessEngine L193-202 | `!isUnset("05:00 م")` → **true** → TimeNormalizer block **SKIPPED** | `"05:00 م"` ← bypasses TN | `BusinessEngine.ts:193-202` |
| Regex fallback L162-189 | Matches branch `"فرع الصحافة"` → no time regex runs | ❌ NOT the source | `BusinessEngine.ts:173-189` |
| **Controlled Merge Guard** L291-319 | `currentState.timeSlot` is null → guard **never fires for timeSlot** | ❌ NOT the source | `BusinessEngine.ts:297-319` |
| **validateBookingData** | `data.timeSlot = "05:00 م"` → passed to TimeNormalizer | `"05:00 م"` | `types.ts:267-268` |
| **TimeNormalizer.normalize** | `"05:00 م"` → idempotent return `"05:00 م"` (already canonical) | `"05:00 م"` ← NOT modified | `TimeNormalizer.ts` |
| **DoubleBookingGuard** | `getAvailableSlots(...)` → no slot matches → REJECT | `"05:00 م"` | `BusinessEngine.ts:359-448` |

---

## 2. The Phantom Origin — Verdict

```
timeSlot = "05:00 م"

Created by: ☑ LLM  (gemini-2.0-flash-lite)
Source file:    src/lib/infrastructure/ai/AIProvider.ts
Function:       AIProvider.classifyIntentAndExtractData()
Line:           46-264 (the full AI call, specifically line 242-250 where
                the response JSON is parsed and the Zod schema accepts
                any string as a valid timeSlot, including confabulated ones)

Not created by:
  ☐ TimeExtractor      → "الصحافة" matches zero patterns → null
  ☐ TimeNormalizer     → SKIPPED (extractedTime already set from AI)
  ☐ Regex fallback     → None of the 3 regex blocks match time in "الصحافة"
  ☐ Booking merge      → currentState.timeSlot = null, guard never fires
  ☐ Conversation state → Explicitly excluded from draft at ConversationEngine.ts:212
  ☐ validateBookingData→ Only passes through the AI value unchanged
  ☐ Hardcoded string   → "05:00 م" appears nowhere in src/*.ts code
```

---

## 3. Why the LLM Confabulated "05:00 م"

Three contributing factors in the **system prompt** (`AIProvider.ts:82-150`):

### Factor A: Mandatory 5-field output (line 118)
```
- لإنشاء حجز (BookAppointment)، يجب أن تجمعي 5 بيانات أساسية: (الاسم، الخدمة، الطبيب، الفرع، الوقت).
```
The AI is explicitly told: "for a booking, you MUST collect 5 fields: name, service, doctor, branch, **time**." This pressures the model to fill a timeSlot even when absent.

### Factor B: JSON schema always includes timeSlot (lines 131-145)
```json
"bookingData": {
    "clientName": "...",
    "clientPhone": "...",
    "serviceName": "...",
    "doctorName": "...",
    "branchName": "...",
    "timeSlot": "..."
}
```
Every response must include all 6 fields. The AI cannot omit timeSlot. It must either set it to `""`, `null`, or a string. The model's training favors filling values over leaving them empty.

### Factor C: CurrentState shows timeSlot as "غير محدد" (lines 106-112)
```
الوقت المفضل: غير محدد
```
The AI sees `currentState.timeSlot = null` rendered as `"غير محدد"`. Combined with Factor A, the model interprets this as "the time needs to be collected now" rather than "the user didn't say any time yet."

### Factor D: No available slots were provided (ConversationEngine.ts:255-263)
```typescript
if (currentState.doctorName) {  // ← doctorName is null at this point
  const slotsData = await BookingService.getAvailableSlots(...);
  // → NEVER REACHED
}
```
Since the doctor has not been selected yet, `availableSlotsText = ""`. The AI receives no real available slot list to constrain its output. Without this constraint, the model freely confabulates a plausible time.

### Why "05:00 م" specifically?
`"05:00 م"` (5:00 PM) is a statistically common appointment time in the model's training distribution for clinic booking scenarios in the Middle East. The LLM's next-token prediction associates "booking" + "clinic" + "evening" → `05:00 م` as a high-probability completion.

---

## 4. Verification: No Other Component Could Produce "05:00 م"

| Component | Input | Output | Reason |
|-----------|-------|--------|--------|
| `TimeExtractor.extract("الصحافة")` | "الصحافة" | `null` | No digit, no `:`, no AM/PM, no keyword match |
| `TimeNormalizer.normalize("05:00 م", ...)` | "05:00 م" | "05:00 م" | Strictly idempotent — already canonical |
| Regex fallback (BusinessEngine:162-189) | "الصحافة" | No time extraction | Only matches name/service/doctor/branch patterns |
| Controlled Merge Guard | `currentState.timeSlot=null` | Guard not triggered | No existing value to protect |
| `validateBookingData` | `data.timeSlot="05:00 م"` | `cleanTimeSlot="05:00 م"` | Passes through unchanged |
| Draft restoration (`ConversationEngine.ts:212`) | `bookingDraft.timeSlot` | **Explicitly destructured away** | `const { timeSlot: _staleTimeSlot, ...safeDraftFields }` |
| Hardcoded in `src/**/*.ts` | — | — | grep returns ZERO matches in source code |

---

## 5. Forensic Summary

| Question | Answer |
|----------|--------|
| **What created `timeSlot = "05:00 م"`?** | LLM (gemini-2.0-flash-lite) confabulation |
| **Exact origin file** | `src/lib/infrastructure/ai/AIProvider.ts` |
| **Exact origin function** | `AIProvider.classifyIntentAndExtractData()` |
| **Exact origin line range** | Lines 155-255 — the AI API call + JSON response parsing |
| **Why did it pass through?** | Zod schema (line 7-20) accepts any string for timeSlot — no groundedness check |
| **Why wasn't it caught?** | No component validates that the AI's timeSlot extraction is grounded in the user's message |
| **Why "05:00 م"?** | Statistical probability — common appointment time in training data |
| **Could it happen again?** | ✅ Yes — on ANY turn where the AI returns BookAppointment with no user-provided time, the model may confabulate a different time (02:00 م, 10:00 ص, etc.) |
