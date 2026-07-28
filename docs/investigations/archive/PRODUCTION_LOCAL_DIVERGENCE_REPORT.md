# PRODUCTION vs LOCAL DIVERGENCE REPORT

> **Task**: Investigate why WhatsApp production reproduced timeSlot="05:00 م" for "الصحافة" (×2 confirmed) while local runtime produced timeSlot=null.
> **Constraint**: DO NOT FIX — evidence only.
> **Date**: 2026-07-27

---

## EXECUTIVE SUMMARY

**Finding**: The phantom timeSlot="05:00 م" in production is **not caused by a code path difference** in the conversation engine. Both P1 (hasTimeKeyword merge guard) and P2 (timeSlot destructuring from draft) are deployed identically at HEAD `22a3526`. The root cause is a **prompt-level divergence** between the production model invocation and the local reproduction call.

**Primary Divergence**: The production prompt is approximately **300+ tokens heavier** with additional behavioral pressure (customPrompt + businessProfile) that creates a semantic context where the AI is more likely to hallucinate timeSlot on Turn 5 when the user says "الصحافة" (a branch name — the last data point before time collection in the booking flow).

---

## ARCHITECTURE OVERVIEW

```
Production WhatsApp                             Local Reproduction
══════════════════                               ══════════════════
WhatsApp → Webhook → ConversationEngine          Direct: AIProvider.classifyIntentAndExtractData()
  ├─ currentState from DB (draft)                     ├─ currentState from code (nulls)
  ├─ AIProvider (classifyIntentAndExtractData)        ├─ AIProvider (classifyIntentAndExtractData)
  ├─ BusinessEngine (processBooking)              ✗   ─── NO BusinessEngine
  │    ├─ TimeExtractor (deterministic)
  │    ├─ TimeNormalizer (LLM fallback)
  │    ├─ Entity extraction (name, phone, service, doctor, branch)
  │    ├─ Intent escalation (Inquiry→BookAppointment)
  │    └─ Controlled Merge Guard
  ├─ Draft update (bookingDraft saved to DB)
  └─ Response → WhatsApp
```

---

## DIVERGENCE 1: customPrompt (HIGH IMPACT)

| Aspect | Production | Local |
|--------|-----------|-------|
| Source | `prisma/seed.ts` — 300+ char Arabic prompt | `null` (fallback to 6-word default) |
| Value | 12-line instruction emphasizing time collection + "present receipt when data complete" | `"تحدثي باسم العيادة بلطف."` |

**Production customPrompt** (from seed.ts lines 30-43):
```
أنتِ سارة، موظفة استقبال سعودية لبقة ومحترفة في "عيادة ريفال للتجميل".
هدفِك هو تحويل الاستفسارات إلى حجوزات مؤكدة بجمع البيانات الخمسة بالتسلسل.
...
قواعد مهمة:
1. ممنوع الاستشارات الطبية أو التشخيص...
2. اجمعي البيانات الخمسة التالية واحداً تلو الآخر بالتسلسل:
   - الاسم الثلاثي ورقم الجوال
   - الخدمة المطلوبة
   - الطبيب المفضل (أو اقتراح المتاح)
   - الفرع المفضل (الصحافة أم التحلية)
   - الوقت المفضل (صباحي أم مسائي، وفي أي يوم)
3. عند اكتمال البيانات، اعرضي تذكرة الحجز المبدئي...
```

**Mechanism**: The customPrompt is injected AFTER the system_prompt.txt in the final prompt (AIProvider.ts line 95):
```
التعليمات الخاصة بالعيادة:
${clinic.customPrompt || "تحدثي باسم العيادة بلطف."}
```
In production, this 300+ char Arabic instruction follows the system_prompt.txt's zero-hallucination policy. In many LLMs, **later instructions partially override earlier ones**. The customPrompt's rule #3 ("عند اكتمال البيانات، اعرضي تذكرة الحجز المبدئي") creates pressure on the AI to "complete" the booking when it extracts "الصحافة" (branch) — making it the 4th data point collected — and the AI may hallucinate a time to finish the set.

**Likelihood**: ★★★★☆ (HIGH — 300+ tokens of behavioral pressure that the local prompt lacks entirely)

---

## DIVERGENCE 2: businessProfile (MODERATE-HIGH IMPACT)

| Aspect | Production | Local |
|--------|-----------|-------|
| Source | `knowledgeBase` table (`GENERAL_INFO` category) | `""` (empty string) |
| In prompt | `businessProfile` content (if exists in DB) | `"غير محدد"` |

**Mechanism**: AIProvider.ts line 97-98:
```
دليل التشغيل وقواعد العمل (Business Profile):
${businessProfile || "غير محدد"}
```
In production, if a `GENERAL_INFO` KB entry exists for the clinic, its content is injected here. This could contain:
- Working hours (e.g., "مواعيد العمل من 10 صباحاً إلى 10 مساءً")
- Price lists
- Policies

If the businessProfile mentions working hours, it directly feeds the AI time-related patterns, increasing the risk of hallucination.

**NOTE**: The actual content of the production KB `GENERAL_INFO` entry is **unknown** — this divergence is the #1 blocker for a complete diagnosis. A production database dump of the knowledgeBase table for clinic `rival-clinic` where `category = "GENERAL_INFO"` is needed.

**Likelihood**: ★★★☆☆ (MODERATE — depends on actual KB content; could range from "informative" to "triggering")

---

## DIVERGENCE 3: availableSlotsText (MODERATE IMPACT — CONDITIONAL)

| Aspect | Production | Local |
|--------|-----------|-------|
| Injected when | `currentState.doctorName` is set AND slots exist | `""` (never populated) |
| Production Turn 5 | UNKNOWN — depends on doctorName state | `""` |

**Mechanism**: ConversationEngine.ts populates `availableSlotsText` from availability data (lines 253-280) only if `currentState.doctorName` is truthy. In the local reproduction, doctorName was `null` throughout all 5 turns.

If production's AI extracted a doctor on Turn 4 ("فيلر") — which the local AI did **not** do — then `availableSlotsText` would contain actual time slot entries. This could:
1. Provide the AI with real time patterns to copy (e.g., "05:00 م" could be a real slot)
2. Create a context where the AI defaults to the first available slot when the user provides the branch name

**BUT**: Even if the AI hallucinated time on Turn 4, P2 clears timeSlot from the draft before Turn 5. So it couldn't leak across turns. The AI would need to independently hallucinate time on Turn 5.

**Likelihood**: ★★☆☆☆ (LOW-MODERATE — depends on whether doctorName was set in production; even if set, the AI still had to independently output timeSlot on Turn 5)

---

## DIVERGENCE 4: BusinessEngine Pipeline (MODERATE IMPACT)

| Aspect | Production | Local |
|--------|-----------|-------|
| TimeExtractor | ✓ — deterministic regex parse | ✗ — skipped |
| TimeNormalizer | ✓ — LLM fallback time normalization | ✗ — skipped |
| Entity extraction | ✓ — regex + fuzzy normalizeToOfficial | ✗ — skipped |
| Controlled Merge Guard | ✓ — prevents AI from overwriting known values | ✗ — skipped |

**Mechanism**: In production, BusinessEngine.processBooking runs AFTER AIProvider returns. When TimeExtractor finds no deterministic time in "الصحافة", the `isNumericTimeFound` flag is `false`. Then:

```javascript
// BusinessEngine.ts line 193-201
if (!extractedTime || isUnset(extractedTime)) {
  if (!isNumericTimeFound) {
    const { TimeNormalizer } = await import("./TimeNormalizer");
    const normalizedFromMessage = TimeNormalizer.normalize(userMessage, null, clinic.countryCode || "SA");
    if (normalizedFromMessage) {
      extractedTime = normalizedFromMessage;
    }
  }
}
```

The TimeNormalizer runs an **LLM call** to normalize ambiguous time expressions. If this LLM call hallucinates "05:00 م" from "الصحافة", it would override the AI's null timeSlot. This is a **separate model invocation** that the local test doesn't trigger.

**Likelihood**: ★★★☆☆ (MODERATE — TimeNormalizer is a separate LLM call that could hallucinate; the BE pipeline also has intent escalation logic that could change booking context)

---

## DIVERGENCE 5: Model Version (MODERATE-HIGH — UNVERIFIABLE)

| Aspect | Production | Local |
|--------|-----------|-------|
| Model | `gemini-2.0-flash-lite` | `gemini-2.0-flash-lite` |
| Endpoint | `generativelanguage.googleapis.com/v1beta/...` | same endpoint |
| Temperature | 0.3 | 0.3 |
| **Model version** | UNKNOWN (deployed weeks ago) | CURRENT (today) |

**Mechanism**: Google's Gemini API endpoint serves a **live, versioned model**. The production phantom time occurred at an earlier, unspecified date. If Google updated the model between production's run and today's local test, the same prompt could produce different outputs.

Google frequently rolls minor model updates without changing the API name. A "fixed" model would:
- Still receive the exact same production divergences
- But NOT hallucinate timeSlot
- This would explain why local reproduction (today) fails to reproduce a bug that occurred twice in production (earlier date)

**Likelihood**: ★★★☆☆ (MODERATE — impossible to verify without production logs or deployed-at timestamp; consistent with behavioral change pattern)

---

## DIVERGENCE 6: History Depth & Token Count (LOW IMPACT)

| Aspect | Production | Local |
|--------|-----------|-------|
| History sent | `history.slice(-10)` (last 10 turns) | Full 5-turn history |
| Token count | 10 context messages (if available) | 5 messages |

On production Turn 5, the conversation likely had more than 5 historical turns, and CE limits to the last 10. The local test has exactly 5 turns. This is effectively equivalent — both send full relevant history.

**Likelihood**: ★☆☆☆☆ (LOW — no meaningful difference)

---

## DIVERGENCE 7: Temperature Non-Determinism (LOW IMPACT — INHERENT)

| Aspect | Production×2 | Local |
|--------|-------------|-------|
| Temperature | 0.3 (identical) | 0.3 (identical) |

At temperature=0.3, the model has enough stochastic variance to produce different outputs across invocations. Two production reproductions + zero local reproductions is a **3-sample pattern**, not definitive statistical proof.

**Likelihood**: ★☆☆☆☆ (LOW — temperature effect is small at 0.3; consistent hallucination ×2 suggests structural cause)

---

## DIVERGENCE TABLE — FINAL RANKING

| # | Divergence | Likelihood | Verifiability | Notes |
|---|---|---|---|---|
| **1** | **customPrompt** | HIGH (★★★★☆) | ✓ Verified | 300+ chars vs 6 words — clear structural difference |
| **2** | **businessProfile** | MOD-HIGH (★★★☆☆) | ✗ Needs prod DB dump | Content of GENERAL_INFO KB entry unknown |
| **3** | **BusinessEngine pipeline** | MODERATE (★★★☆☆) | ✓ Code evidence | TimeNormalizer is a second LLM call |
| **4** | **Model version** | MODERATE (★★★☆☆) | Unverifiable w/o Vercel logs | Google may have updated model since production deployment |
| **5** | **availableSlotsText** | LOW-MOD (★★☆☆☆) | ✗ Needs prod state | Depends on doctorName extraction in production |
| **6** | **History depth** | LOW (★☆☆☆☆) | ✓ Trivial | 10 vs 5 history turns — effectively same |
| **7** | **Temperature** | LOW (★☆☆☆☆) | ✓ Known | 0.3 identical both; stochastic variance alone unlikely ×2 |

---

## CONCLUSION

The divergence is **NOT in the code path** — P1, P2, and all safeguards are identically deployed at HEAD `22a3526`. The divergence is in the **prompt composition and pipeline execution**:

**Most likely root cause chain**:
1. Production prompt has ~300+ more tokens of behavioral pressure from `customPrompt` + `businessProfile`
2. The customPrompt's "اجمعي البيانات الخمسة... عند اكتمال البيانات، اعرضي تذكرة الحجز" creates completion pressure
3. When "الصحافة" (branch) is extracted on Turn 5, the AI sees 4/5 data points filled and may confabulate a time to "complete" the booking
4. The production BusinessEngine's TimeNormalizer provides a secondary LLM path that could amplify or independently produce the hallucination
5. A model version update between production-deployment-time and today may explain why the CURRENT model doesn't reproduce the hallucination

**To confirm**: A side-by-side test with the EXACT production prompt (including 300+ char customPrompt + real businessProfile from KB) needs to be run.

---

## WHAT WE STILL DON'T KNOW (BLOCKERS)

| Missing Information | Why Needed | How to Obtain |
|---|---|---|
| Production `GENERAL_INFO` KB content | businessProfile content is the #1 unknown prompt variable | Production DB dump: `SELECT content FROM "KnowledgeBase" WHERE clinicId = 'rival-clinic' AND category = 'GENERAL_INFO'` |
| Production doctorName on Turn 4 | Determines whether availableSlotsText was populated | Production DB: check bookingDraft state before and after Turn 4 |
| Deploy timestamp on Vercel | Determines which model version was active when phantom occurred | Vercel dashboard → deployments → deployment timestamp |
| Production Turn 5 raw AI JSON output | Would show whether the AI returned timeSlot directly or BE modified it | Production logs (if PIPELINE_RESULT was logged) |
| TimeNormalizer output for "الصحافة" | Would confirm/rule out hallucination from the secondary LLM call | Production logs or local reproduction with TimeNormalizer enabled |
| Number of production conversations before Turn 5 | More history = more token pressure | Production DB: count messages in the conversation |
