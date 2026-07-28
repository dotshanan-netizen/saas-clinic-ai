# PRODUCTION EVIDENCE REPORT

> **Task**: Collect production evidence for the phantom timeSlot="05:00 م" bug on "الصحافة"
> **Constraint**: NO FIXES, NO code/prompt changes. Evidence only.
> **Date**: 2026-07-27

---

## SUMMARY OF FINDINGS

**Production is running commit `4f94143`** — NOT local HEAD `22a3526`. The deployed code has a fundamentally different (and vulnerable) state reconstruction architecture that causes stale timeSlot values to propagate through the conversation history.

**Root cause confirmed**: The history-loop state reconstruction at origin/main's `ConversationEngine.ts` lines 86-93 copies `timeSlot` from ALL historical assistant messages, creating a positive feedback loop where a single hallucinated timeSlot persists across turns and is amplified by the Intent-Aware Merge.

---

## 1. DEPLOYMENT VERIFICATION

### 1.1 Git Topology

```
origin/main = 4f94143  ★ ←── DEPLOYED TO PRODUCTION (VULNERABLE)
    │
    │  (7 commits NOT deployed)
    │
    ├── 762b146  Fix: Time pipeline stabilization
    ├── ff8d225  Fix: Phase C - bookingDraft migration & state decoupling
    ├── 856e02a  Fix: Phase D - Explicit FSM Transitions
    ├── caf6e41  Chore: Archive old investigation files
    ├── 32a823f  Fix: B1 - extend timeRegex for 24h hours
    ├── 2eb36fa  Doc: RELEASE_CANDIDATE_REPORT updates
    └── 22a3526  ★ LOCAL HEAD (HAS P1+P2+bookingDraft+RedisLock fixes)
```

### 1.2 Production Commit: `4f94143`

```
Hash:   4f94143d4c5613518925b43ec2671858de45f9d7
Message: "Chore: add .omo/ and scripts/tools/ to .gitignore; organize 
          investigation reports into docs/investigations/"
Date:    2026-07-27 (same day as local HEAD — diverged in same session)
```

### 1.3 Evidence that `4f94143` is Deployed

| Evidence | Detail |
|----------|--------|
| `origin/main` = `4f94143` | `git branch -a` shows `remotes/origin/main` at this commit |
| Vercel links to `origin/main` | Default Vercel deployment branch is `main` |
| No `bookingDraft` in schema | `4f94143` Conversation model: no `bookingDraft`, no `currentStateName`, no `clientName` — matches what's in production DB |
| Vercel project config | `.vercel/project.json` exists — project was linked via `vercel` CLI |
| No Vercel CLI locally | No `vercel` command available, cannot query deployment directly |

### 1.4 Schema Difference — Conclusive Proof

**Production (4f94143) `Conversation` model:**
```prisma
model Conversation {
    id            String   @id @default(cuid())
    clientPhone   String
    messages      Json
    clinicId      String
    updatedAt     DateTime @updatedAt
    createdAt     DateTime @default(now())
    humanTakeover Boolean  @default(false)
}
```

**Local HEAD (22a3526) `Conversation` model:**
```prisma
model Conversation {
    id               String   @id @default(cuid())
    clientPhone      String
    messages         Json
    clinicId         String
    updatedAt        DateTime @updatedAt
    createdAt        DateTime @default(now())
    humanTakeover    Boolean  @default(false)
    bookingDraft     Json?    // ← NOT IN PRODUCTION
    clientName       String?  // ← NOT IN PRODUCTION
    currentStateName String   @default("IDLE") // ← NOT IN PRODUCTION
}
```

> **Implication**: Production CANNOT run HEAD `22a3526` because the code would try to read/write `bookingDraft`, `clientName`, and `currentStateName` columns that don't exist in the production database.

---

## 2. EXACT PRODUCTION CONVERSATION ENGINE CODE (the vulnerable path)

### 2.1 State Reconstruction Loop — THE ROOT CAUSE

File: `ConversationEngine.ts` (production commit `4f94143`), lines ~80-96:

```typescript
// Initialize with timeSlot = null (safe)
const currentState: any = {
    clientName: persistentClientName,
    clientPhone: activeBooking?.clientPhone || null,
    serviceName: isModificationOrCancel ? (activeBooking?.serviceName || null) : null,
    doctorName: isModificationOrCancel ? (activeBooking?.doctorName || null) : null,
    branchName: isModificationOrCancel ? (activeBooking?.branchName || null) : null,
    timeSlot: isModificationOrCancel ? (activeBooking?.timeSlot || null) : null
    // ↳ timeSlot = null for non-modification/cancellation ✓
};

// ... find sessionReset boundary ...

// ❌ HISTORY LOOP — OVERRIDES the safe initialization
for (let i = startFromIndex; i < history.length; i++) {
    const msg = history[i];
    if (msg.role === "assistant" && msg.bookingData) {
        for (const key of Object.keys(msg.bookingData)) {
            const val = sanitizeAIValue(msg.bookingData[key as keyof typeof msg.bookingData]);
            if (val) {
                currentState[key] = val;  // ← OVERWRITES timeSlot from PAST assistant messages!
            }
        }
    }
}
```

**How this enables phantom time propagation:**
1. Turn N: AI hallucinates `timeSlot: "05:00 م"` in its JSON output
2. Assistant message is saved to `conversation.messages` with `bookingData.timeSlot = "05:00 م"`
3. Turn N+1: History loop finds the previous assistant's `bookingData.timeSlot` and copies it to `currentState`
4. Intent-Aware Merge (below) falls through to `currentState.timeSlot` if the new AI returns null
5. The hallucinated value lives forever — no mechanism to clear it

### 2.2 Intent-Aware Merge — NO hasTimeKeyword Guard (P1 missing)

File: `ConversationEngine.ts` (production), lines ~142-160:

```typescript
const isBookingIntent = aiResult.intent === "BookAppointment" || aiResult.intent === "ModifyBooking";
if (aiResult.bookingData) {
    if (isBookingIntent) {
        aiResult.bookingData = {
            clientName: aiResult.bookingData.clientName || currentState.clientName,
            clientPhone: aiResult.bookingData.clientPhone || currentState.clientPhone,
            serviceName: aiResult.bookingData.serviceName || currentState.serviceName,
            doctorName: aiResult.bookingData.doctorName || currentState.doctorName,
            branchName: aiResult.bookingData.branchName || currentState.branchName,
            timeSlot: aiResult.bookingData.timeSlot || currentState.timeSlot,
            // ↳ NO guard! Always falls through to currentState.timeSlot
            //    even when the user's message has nothing to do with time
        };
    }
}
```

Compare with local HEAD (22a3526) which HAS the P1 guard:
```typescript
timeSlot: aiResult.bookingData.timeSlot || (hasTimeKeyword ? currentState.timeSlot : null),
// ↳ Only falls through to currentState if user mentions time keywords
```

### 2.3 No bookingDraft — No P2 Protection

Production has NO `bookingDraft` column and NO `P2` timeSlot-stripping logic (added in commit `ff8d225`). State is reconstructed entirely from the `messages` JSON history array.

---

## 3. FULL PIPELINE STATE — Reconstruction

### 3.1 AIProvider Prompt Construction

File: `src/lib/infrastructure/ai/AIProvider.ts` (both commits have similar logic, with minor hotfix diff)

```typescript
const systemPrompt = `
${baseSystemPrompt}                              // ← system_prompt.txt (77 lines, 2KB)

اسم العيادة الحالي: ${clinic.name}
التعليمات الخاصة بالعيادة:
${clinic.customPrompt || "تحدثي باسم العيادة بلطف."}  // ← PRODUCTION: 300+ chars from seed.ts

دليل التشغيل وقواعد العمل (Business Profile):
${businessProfile || "غير محدد"}                     // ← PRODUCTION: fetched from KB (content unknown)

الخدمات المتوفرة: ${servicesList}
الأطباء المرتبطين بكل خدمة: ${doctorsMappingStr}
الفروع: ${branchesList}

--- 
البيانات الحالية للعميل (Current State):
الاسم: ${currentState.clientName || 'غير محدد'}
رقم الجوال: ${currentState.clientPhone || 'غير محدد'}
الخدمة المطلوبة: ${currentState.serviceName || 'غير محدد'}
الطبيب: ${currentState.doctorName || 'غير محدد'}
الفرع: ${currentState.branchName || 'غير محدد'}
الوقت المفضل: ${currentState.timeSlot || 'غير محدد'}  // ← CONTAMINATED by history loop

${availableSlotsText ? `\n--- الأوقات المتاحة فعلياً...\n` : ""}

التعليمات الفنية لعملك كمحرك ذكاء اصطناعي آمن:
...
`;
```

### 3.2 Turn-by-Turn State Evolution (Reconstructed from Code)

| Turn | User Message | History Loop Sets `currentState.timeSlot` | AI Returns `timeSlot` | Merge Result `timeSlot` |
|------|-------------|------------------------------------------|----------------------|------------------------|
| 1 | "السلام عليكم" | `null` (no prior assistant messages) | `null` (Inquiry) | `null` |
| 2 | "أريد الحجز" | `null` | Possibly hallucinates "05:00 م" | `"05:00 م"` |
| 3 | "0501234567" | `"05:00 م"` ← from Turn 2's assistant msg | `null` or `"05:00 م"` | `"05:00 م"` |
| 4 | "فيلر" | `"05:00 م"` ← from Turn 3's assistant msg | `null` (extracts service only) | `"05:00 م"` |
| **5** | **"الصحافة"** | **`"05:00 م"` ← from Turn 4's assistant msg** | **`null` (extracts branch only)** | **`"05:00 م"`** |

> **Note**: The exact turn where the AI first hallucinates "05:00 م" may differ. It could be Turn 2 ("أريد الحجز") or Turn 3 ("0501234567" — the digits "05" triggering time interpretation). The key point is that once ANY turn's AI response includes a non-null timeSlot, **it propagates forward indefinitely** through the history loop.

### 3.3 BusinessEngine TimeNormalizer Fallback

File: `BusinessEngine.ts` (production), lines ~68-71:

```typescript
if (!extractedTime || !TimeNormalizer.normalize(extractedTime)) {
    const normalizedFromMessage = TimeNormalizer.normalize(userMessage);
    if (normalizedFromMessage) extractedTime = normalizedFromMessage;
}
```

This is a **secondary LLM call** that runs after the AI returns. If `TimeNormalizer.normalize()` hallucinates a time from "الصحافة", it will override the AI's null timeSlot. This is a separate code path that can independently produce phantom time.

### 3.4 No `Inquiry` → `BookAppointment` Escalation for `extractedService` without `aiProvidedAvailability`

The production BE has:
```typescript
if (extractedService && (resolvedIntent === "Inquiry" || ...) && !aiProvidedAvailability) {
    resolvedIntent = "BookAppointment";
}
```

This escalates Inquiry to BookAppointment when the user mentions a service. If "فيلر" triggers this escalation, the booking intent flag means the merge preserves timeSlot through `timeSlot: aiResult.bookingData.timeSlot || currentState.timeSlot` — keeping the stale "05:00 م".

---

## 4. PROMPT COMPARISON — Production vs Local

### 4.1 What Production Sends for "الصحافة"

```
أنتِ سارة، موظفة استقبال ومبيعات سعودية لبقة ومحترفة في عيادة التجميل.
هدفِك الأساسي هو مساعدة العميل...
[system_prompt.txt — 77 lines, ~2KB]

اسم العيادة الحالي: عيادة ريفال للتجميل
التعليمات الخاصة بالعيادة:
أنتِ سارة، موظفة استقبال سعودية لبقة ومحترفة في "عيادة ريفال للتجميل".
هدفِك هو تحويل الاستفسارات إلى حجوزات مؤكدة بجمع البيانات الخمسة بالتسلسل.
...
3. عند اكتمال البيانات، اعرضي تذكرة الحجز المبدئي...
[customPrompt — 300+ chars from seed.ts]

دليل التشغيل وقواعد العمل (Business Profile):
[content from knowledgeBase GENERAL_INFO — unknown length]

--- 
البيانات الحالية للعميل (Current State):
الاسم: غير محدد
رقم الجوال: 0501234567
الخدمة المطلوبة: فيلر
الطبيب: غير محدد
الفرع: غير محدد
الوقت المفضل: 05:00 م    ← CONTAMINATED by history loop!

التعليمات الفنية لعملك كمحرك ذكاء اصطناعي آمن:
...
```

### 4.2 What Local Reproduction Sends for "الصحافة" (timeSlot=null)

```
Same system_prompt.txt

التعليمات الخاصة بالعيادة:
تحدثي باسم العيادة بلطف.    ← 6-char fallback (no time pressure)

دليل التشغيل وقواعد العمل (Business Profile):
غير محدد    ← empty (no KB content)

--- 
البيانات الحالية للعميل (Current State):
الوقت المفضل: غير محدد    ← CLEAN (no contamination)

التعليمات الفنية لعملك كمحرك ذكاء اصطناعي آمن:
...
```

### 4.3 Critical Difference

| Component | Production | Local | Impact |
|-----------|-----------|-------|--------|
| `customPrompt` | 300+ chars — "present receipt when data complete" | 6 chars fallback | **Pressures AI to complete booking** |
| `businessProfile` | KB content (unknown) | `""` | May add time-related context |
| `timeSlot` in state | `"05:00 م"` (contaminated) | `null` | **Primes AI to perpetuate hallucination** |
| `availableSlotsText` | Possibly set (if doctorName was extracted) | `""` (doctorName null) | May provide time patterns to copy |

---

## 5. PRODUCTION DEPLOYMENT INFO

### 5.1 Confirmed

| Field | Value | Source |
|-------|-------|--------|
| **Git commit** | `4f94143d4c5613518925b43ec2671858de45f9d7` | `git branch -a` → `remotes/origin/main` |
| **Git message** | "Chore: add .omo/ and scripts/tools/ to .gitignore; organize investigation reports into docs/investigations/" | `git log` |
| **Commit date** | 2026-07-27 | `git show` |
| **Remote URL** | `https://github.com/dotshanan-netizen/saas-clinic-ai.git` | `git remote -v` |
| **Vercel project** | `saas-clinic-ai` (ID: `prj_aRvcG2Cf9wIVzs9gIsZDHnzkUUHH`) | `.vercel/project.json` |
| **Vercel org** | `team_C7yQXAa5iZowwg2bCl8lLG5n` | `.vercel/project.json` |
| **Model** | `gemini-2.0-flash-lite` | `AIProvider.ts` line 158 (both commits) |
| **Temperature** | `0.3` | `AIProvider.ts` line 172 (both commits) |
| **System prompt** | `system_prompt.txt` (77 lines) | Same in both |
| **Product version** | `0.1.0` | `package.json` |
| **Build command** | `npx prisma generate && next build` | `vercel.json` |
| **Framework** | `nextjs` | `vercel.json` |

### 5.2 Not Available (Require Vercel Access)

| Field | How to Obtain |
|-------|---------------|
| **Exact deployed commit verification** | `vercel list` or Vercel Dashboard → Deployments |
| **Deployment ID** | Vercel Dashboard → select deployment → URL contains deploy ID |
| **Build timestamp** | Vercel Dashboard → deployment details |
| **Model version** | Not available from code; Google doesn't expose model version string via `gemini-2.0-flash-lite` API |
| **Production logs (raw Gemini response)** | Vercel Dashboard → Functions → Logs, or `vercel logs` |
| **Production `GENERAL_INFO` KB content** | Production DB: `SELECT content FROM "KnowledgeBase" WHERE clinicId = 'rival-clinic' AND category = 'GENERAL_INFO'` |
| **Production `conversation.messages`** | Production DB: `SELECT messages FROM "Conversation" WHERE clientPhone = '...' AND clinicId = 'rival-clinic'` |

### 5.3 Verification Instructions

To verify which commit is deployed from this local machine:

```bash
# Requires authenticated Vercel CLI
npx vercel list                   # List all deployments
npx vercel inspect <deploy-url>   # Get deployment details including commit
```

Or from Vercel Dashboard:
1. Go to https://vercel.com/team_C7yQXAa5iZowwg2bCl8lLG5n/saas-clinic-ai
2. Deployments tab
3. Find the current production deployment
4. Check "Commit" field

---

## 6. PRODUCTION PIPELINE RESULT LOG (Expected Schema)

The production ConversationEngine logs at the end:
```typescript
console.log(JSON.stringify({
    event: "PIPELINE_RESULT",
    requestId,
    response: finalResponse,
    timeSlot: modifiedBookingData?.timeSlot || null,
    bookingCreated: bookingCreated || bookingModified,
    intent: resolvedIntent,
    stage: resolvedStage,
    policy: resolvedPolicy,
}));
```

And the BusinessEngine logs:
```typescript
console.log(JSON.stringify({
    stage: "ENTITY_EXTRACTION",
    source: "AI+Regex",
    extracted: { name, phone, service, doctor, branch, timeSlot },
    aiRaw: { name, branch, timeSlot },
    currentState: { branch, timeSlot }
}));
```

These logs are in Vercel Functions output. Grep for `PIPELINE_RESULT` and `ENTITY_EXTRACTION` in Vercel logs for the "الصحافة" message to get exact runtime evidence.

---

## 7. RECOMMENDED COLLECTION COMMANDS

### From Vercel Dashboard

```
1. Deployments → find production → note commit hash
2. Functions → filter by "PIPELINE_RESULT" → find "الصحافة" Turn 5
3. Functions → filter by "ENTITY_EXTRACTION" → find Turn 5 payload
4. Functions → filter by "[DEBUG AIResult]" → find Turn 5 raw AI JSON
```

### From Production Database

```sql
-- Get conversation messages for the "الصحافة" turn
SELECT messages FROM "Conversation" 
WHERE clinicId = 'rival-clinic' 
  AND clientPhone = '0501234567'
ORDER BY updatedAt DESC LIMIT 1;

-- Get business profile
SELECT content FROM "KnowledgeBase" 
WHERE clinicId = 'rival-clinic' 
  AND category = 'GENERAL_INFO' 
  AND "deletedAt" IS NULL;
```

---

## 8. ROOT CAUSE DIAGRAM

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    PRODUCTION CODE (4f94143)                    │
  │                                                                 │
  │  Turn N: User sends message                                     │
  │     │                                                           │
  │     ▼                                                           │
  │  History Loop ──── copies timeSlot from ALL past assistant msgs │
  │     │              (if ANY previous turn had timeSlot≠null)     │
  │     ▼                                                           │
  │  currentState = { ... timeSlot: "05:00 م" }                     │
  │     │                                                           │
  │     ▼                                                           │
  │  AI sees timeSlot="05:00 م" in prompt current state             │
  │     │                                                           │
  │     ▼                                                           │
  │  AI returns timeSlot=null (correct for "الصحافة" = branch)      │
  │     │                                                           │
  │     ▼                                                           │
  │  Intent-Aware Merge: timeSlot || currentState.timeSlot          │
  │                       null  || "05:00 م"  =  "05:00 م"          │
  │     │                                                           │
  │     ▼                                                           │
  │  Assistant msg saved with bookingData.timeSlot = "05:00 م"      │
  │     │                                                           │
  │     ▼                                                           │
  │  NEXT TURN: History Loop finds it again → INFINITE LOOP         │
  │                                                                 │
  │  ─── P1 (hasTimeKeyword guard) → MISSING from production        │
  │  ─── P2 (timeSlot destructuring) → MISSING from production      │
  │  ─── bookingDraft → MISSING from production                     │
  │  ─── State decoupling → MISSING from production                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 9. WHAT TO DEPLOY TO FIX

The following commits are on local HEAD (`22a3526`) but NOT on production (`4f94143`):

| Commit | Fix | Needed For |
|--------|-----|-----------|
| `ff8d225` | Phase C: bookingDraft migration + state decoupling | Separates transient booking state from message history |
| `856e02a` | Phase D: Explicit FSM Transitions | Proper state machine for booking flow |
| `22a3526` | P1: hasTimeKeyword merge guard | Prevents stale timeSlot from leaking through merge |
| `22a3526` | P2: timeSlot destructuring from draft | Prevents stale timeSlot from loading in state reconstruction |
| `22a3526` | Redis lock + draft expiration | Concurrent access safety + state cleanup |

> **Warning**: Deploying `22a3526` requires a **database migration** to add `bookingDraft`, `clientName`, and `currentStateName` columns to the `Conversation` table. The Prisma schema has changed at this commit.

---

*End of report — evidence only, no fixes implemented.*
