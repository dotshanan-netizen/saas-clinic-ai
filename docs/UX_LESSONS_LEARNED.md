# UX Lessons Learned

> **Purpose**: Permanent record of UX issues discovered in production/testing, their root causes, and implemented fixes.
> Future engineers must read this document before modifying conversation wording or the system prompt.
> Never rely on chat history for UX decisions — this document is the single source of truth.

---

## Format

Each entry records:
- **Issue**: What the user experienced
- **Root Cause**: Exactly where and why this happened in the code
- **Fix**: What was changed and why
- **Affected Files**: Every file touched
- **Regression Risk**: What could break if reverted or overridden
- **Date**: When this was implemented

---

## UX-001 — Repeated Greetings Mid-Conversation

**Date**: 2026-07-28

**Issue**:
The assistant sent "يا هلا ومسهلا" or "حياك الله" repeatedly — even when the user was in the middle of providing booking data.

**Root Cause**:
`system_prompt.txt` had a greeting style rule but no explicit constraint against re-greeting in an ongoing conversation. The LLM defaulted to greeting on every new message when it classified the intent as `Inquiry` or `Unknown`.

**Fix**:
Added an explicit rule in `system_prompt.txt`:
> "الترحيب يُقال مرة واحدة فقط في بداية المحادثة. إذا كانت المحادثة مستمرة، ادخلي في الموضوع مباشرة دون إعادة الترحيب."

**Affected Files**:
- `src/app/api/chat/system_prompt.txt`

**Regression Risk**:
- If someone reverts `system_prompt.txt` to a version without this rule, repeated greetings will return.
- The LLM (Gemini) naturally tends to greet — the prompt rule is the only control.

---

## UX-002 — Multiple Questions in One Response

**Date**: 2026-07-28

**Issue**:
The assistant sometimes asked for multiple pieces of information in the same message (e.g., "ما اسمك؟ وأي فرع تفضلين؟"). This confused users and caused them to skip fields.

**Root Cause**:
No explicit "one question at a time" rule in `system_prompt.txt`. The LLM, being helpful, would bundle questions together.

**Fix**:
Added explicit rule in `system_prompt.txt`:
> "اسأل عن حقل واحد فقط في كل رد — لا تجمعي أسئلة متعددة."

**Affected Files**:
- `src/app/api/chat/system_prompt.txt`

**Regression Risk**:
- If prompt is reverted, multi-question responses will return.
- BusinessEngine already asks for one field at a time (priority order at L658) — the prompt rule reinforces this at the LLM layer.

---

## UX-003 — Technical Fallback Exposed to User ("لم أتمكن من جلب المعلومات")

**Date**: 2026-07-28

**Issue**:
When the user asked "ايه الاوقات المتاحة؟", the assistant replied: "لم أتمكن من جلب المعلومات التفصيلية حالياً" — exposing a technical failure (RAG pipeline 401 UNAUTHENTICATED).

**Root Cause** (two layers):
1. `RAGPipeline.retrieve()` failed with `401 UNAUTHENTICATED` because `GEMINI_API_KEY` was missing from Vercel production.
2. `BusinessEngine.ts:764` detected that `aiResult.response` was a placeholder ("سأبحث...") and substituted a hardcoded fallback string that exposed the failure.

**Fix**:
- `BusinessEngine.ts:764`: Changed fallback from "عذراً، لم أتمكن من جلب المعلومات..." to customer-friendly: "للإجابة الدقيقة على هذا السؤال، تواصلي مع الاستقبال مباشرة أو اسأليني عن أي شيء ثاني وسأساعدكِ 🌷"
- `system_prompt.txt`: Added explicit availability handling rule for when RAG is unavailable — instructs AI to ask for doctor first or respond naturally without exposing failure.

**Affected Files**:
- `src/lib/domain/BusinessEngine.ts` (L764)
- `src/app/api/chat/system_prompt.txt`

**Regression Risk**:
- The underlying cause (missing `GEMINI_API_KEY`) must remain fixed in Vercel.
- If RAG fails again, the new fallback message is customer-friendly but the routing guard (`isAvailabilityQuery && currentState.doctorName`) will serve real slots directly without RAG.

---

## UX-004 — Unavailable Time Stops the Conversation

**Date**: 2026-07-28

**Issue**:
When the user requested a time that wasn't available (e.g., "باكر الساعة 9 م"), the assistant replied: "عذراً، الوقت الذي اخترته لم يعد متاحاً" and did nothing further. The booking flow stalled.

**Root Cause**:
`BusinessEngine.ts:459` had a hardcoded response that rejected the time but offered no alternatives. The `DOUBLE_BOOKING_GUARD_NO_SLOT` event cleared `timeSlot` from `modifiedBookingData` (correct) but the response didn't pivot to offering the available slots list.

**Fix**:
Changed `BusinessEngine.ts:459` response to:
> "الوقت (${validation.cleanTimeSlot}) محجوز للأسف. شوفي الأوقات المتاحة أعلاه وحددي اللي يناسبكِ 🌷"

Added rule in `system_prompt.txt`:
> "إذا كان الوقت المطلوب غير متاح، عرضي أوقات بديلة من قائمة المتاح. لا تقطعي المحادثة."

**Affected Files**:
- `src/lib/domain/BusinessEngine.ts` (L459, L619)
- `src/app/api/chat/system_prompt.txt`

**Regression Risk**:
- Response now references "الأوقات المتاحة أعلاه" — this only makes sense if the LLM includes available slots in its context. Ensure `availableSlotsText` is populated in `ConversationEngine.ts:258–270` when doctor is selected.

---

## UX-005 — Booking Collection Prompts Were Verbose and Repetitive

**Date**: 2026-07-28

**Issue**:
Individual field prompts were long and began with repetitive phrases:
- "تسعدنا خدمتكِ يا قلبي! 🌸 ممكن تفيديني باسمكِ الكريم للتسجيل؟"
- "يا هلا بكِ في عيادة ريفال! 🌸 وش الخدمة..."
- "أبشري من عيوني! 🌸 هل تفضلين..."

**Root Cause**:
Hardcoded response strings in `BusinessEngine.ts:671–687` (the field-prompting block) included greeting phrases at every turn.

**Fix**:
Shortened all field prompts to natural, direct questions:
- Name: "باسمكِ الكريم؟ 🌸"
- Service: "وش الخدمة اللي تبين تحجزين؟ 🌷"
- Branch: "أي فرع يناسبكِ — الصحافة أو التحلية؟ 🌷"
- Doctor: "تفضلين طبيبة معينة أو أي موعد متاح؟ 🌷"
- Time: "أي يوم ووقت يناسبكِ؟ 🌷"

**Affected Files**:
- `src/lib/domain/BusinessEngine.ts` (L671–687)

**Regression Risk**:
- Branch names ("الصحافة أو التحلية") are hardcoded in the branch prompt. If clinic branches change, this string must be updated. Consider making it dynamic from `clinic.branches`.

---

## UX-006 — Confirmation Message Was Verbose

**Date**: 2026-07-28

**Issue**:
Booking confirmation had redundant text ("تم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر 🌸").

**Root Cause**:
Hardcoded string in `BusinessEngine.ts:611`.

**Fix**:
Shortened to:
> "وصلني طلب الحجز 🌷\n\n✅ [fields]\n\nسيتواصل معكِ الاستقبال لتأكيد الموعد. 🌸"

Also removed "الوقت المفضل" label — changed to just "الوقت" for conciseness.

**Affected Files**:
- `src/lib/domain/BusinessEngine.ts` (L611, L524)

**Regression Risk**:
- Low. The confirmation summary format is what users see after booking is created. Any regression would appear in the booking confirmation message only.
- System prompt also has this template — keep both in sync.

---

## UX-007 — Technical Error Messages Exposed to User

**Date**: 2026-07-28

**Issue**:
When the AI provider failed, users saw: "عذراً، أواجه مشكلة تقنية حالياً. سيقوم فريق الاستقبال بالرد عليك قريباً."
The word "مشكلة تقنية" reveals internal system state to users.

**Root Cause**:
Hardcoded fallback string in `ConversationEngine.ts:470`.

**Fix**:
Changed to: "سأحولكِ لأحد فريق الاستقبال يتواصل معكِ في أقرب وقت 🌸"

**Affected Files**:
- `src/lib/domain/ConversationEngine.ts` (L470)

**Regression Risk**:
- Low. This path is only hit when `AIProvider.classifyIntentAndExtractData()` throws. The response is the same behavior (HumanTakeover) — only the wording changed.

---

## UX-008 — Availability Answer Without Doctor Context

**Date**: 2026-07-28

**Issue**:
When user asked "ايه الاوقات المتاحة؟" before selecting a doctor, the system had no doctor to query, causing RAG to be invoked (and fail).

**Root Cause**:
The routing guard in `BusinessEngine.ts:732–734` only routes to `BookingService` when `currentState.doctorName` is set. Without a doctor, it falls through to RAG — which can fail.

**Fix**:
Added explicit instruction in `system_prompt.txt`:
> "إذا لم يُحدَّد الطبيب بعد، اسأل: 'مع أي طبيبة تفضلين؟ وعلى حسب ذلك أحدد المواعيد المتاحة.'"

This keeps the user in the booking flow rather than triggering an RAG lookup that may fail.

**Affected Files**:
- `src/app/api/chat/system_prompt.txt`

**Regression Risk**:
- Medium. If LLM ignores this instruction and still marks `requiresRag: true`, BusinessEngine will attempt RAG. The RAG fallback message (UX-003 fix) handles this gracefully now.

---

## Summary Table

| ID | Issue | Root Cause Location | Fix Type | Risk |
|----|-------|-------------------|----------|------|
| UX-001 | Repeated greetings | `system_prompt.txt` — no anti-repetition rule | Prompt rule | Low |
| UX-002 | Multiple questions per turn | `system_prompt.txt` — no one-question rule | Prompt rule | Low |
| UX-003 | Technical fallback exposed | `BusinessEngine.ts:764` + missing `GEMINI_API_KEY` | Wording + Prompt | Medium |
| UX-004 | Unavailable time stops flow | `BusinessEngine.ts:459` — no alternatives offered | Wording + Prompt | Low |
| UX-005 | Verbose field prompts | `BusinessEngine.ts:671–687` — greeting in every prompt | Wording | Low |
| UX-006 | Verbose confirmation | `BusinessEngine.ts:611` — redundant text | Wording | Low |
| UX-007 | Technical error exposed | `ConversationEngine.ts:470` — "مشكلة تقنية" | Wording | Low |
| UX-008 | Availability without doctor | `system_prompt.txt` — no doctor-first guard | Prompt rule | Medium |
