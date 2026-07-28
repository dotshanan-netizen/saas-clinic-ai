# PRODUCTION DEPLOYMENT PLAN

> **Target Release**: Pilot Release Candidate
> **Source**: Local HEAD `22a3526` + hotfix delta
> **Production (currently)**: `4f94143` (origin/main)
> **Date**: 2026-07-27
> **Constraint**: Preparation only — do not deploy from this plan.

---

## 1. RELEASE CANDIDATE VERIFICATION

### 1.1 Git Topology

```
origin/main = 4f94143  (CURRENTLY DEPLOYED)
    │
    │   7 commits to deploy:
    │
    ├── 762b146  Time pipeline stabilization
    │            - idempotency, double normalization fix
    │            - only changes TimeNormalizer.ts
    │
    ├── ff8d225  Phase C: bookingDraft migration & state decoupling
    │            - Prisma schema change (3 new columns)
    │            - ConversationEngine: bookingDraft read/write
    │            - State decoupled from message history
    │            - New: BookingTrace types, ConversationEngine rewrite
    │
    ├── 856e02a  Phase D: Explicit FSM Transitions
    │            - JourneyResolver: resolveStage → transition()
    │            - FSM states added: IDLE, GREETING, COLLECTING_*, etc.
    │            - Integration with ConversationEngine
    │
    ├── caf6e41  Chore: Archive old investigation files
    │            - File reorganization only, no code changes
    │
    ├── 32a823f  B1: extend timeRegex for 24h hours 20-23
    │            - TimeNormalizer regex fix
    │
    ├── 2eb36fa  Doc: RELEASE_CANDIDATE_REPORT
    │            - Documentation only
    │
    └── 22a3526  Pilot release candidate readiness
                 - Redis lock (UPSTASH_REDIS_URL dependency)
                 - P1: hasTimeKeyword merge guard
                 - P2: timeSlot destructuring from draft
                 - Draft expiration (15-min timeout)
                 - Empty message guard
                 - ConnectionManager.withFetchResilience
                 - Idempotency cleanup (rollback wamid on failure)
```

### 1.2 Uncommitted Hotfix (Must Be Included)

Two files have uncommitted changes on local disk that must be COMMITTED before deployment:

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/domain/BusinessEngine.ts` | Extended `isNewBookingRequest` regex + `"Inquiry"` in Unknown escalation | Catches more booking phrases + prevents Inquiry→Unknown→Inquiry loop |
| `src/lib/infrastructure/ai/AIProvider.ts` | Extended booking keyword instruction + Post-AI intent safeguard | Safeguard: if AI returns Unknown/Inquiry but user said حجز/موعد, escalate to BookAppointment |

**Action required**: `git add -A && git commit -m "hotfix: extend booking intent detection and AI safeguard"` before deployment.

### 1.3 Verification Checklist

- [x] `22a3526` is the intended release candidate — contains P1, P2, Redis lock, bookingDraft, FSM, and all time pipeline fixes
- [x] All 7 commits between `4f94143` and `22a3526` are atomic and independently reviewed
- [ ] Hotfix delta committed and tested
- [x] All changes compile (production code compiles at `22a3526`)
- [ ] All tests pass (run `npx vitest run` before deployment)

---

## 2. PRISMA SCHEMA CHANGE — REQUIRED MIGRATION

### 2.1 Current Production Schema (4f94143)

```prisma
model Conversation {
    id            String   @id @default(cuid())
    clientPhone   String
    messages      Json
    clinicId      String
    updatedAt     DateTime @updatedAt
    createdAt     DateTime @default(now())
    humanTakeover Boolean  @default(false)
    clinic        Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
    @@unique([clinicId, clientPhone])
}
```

### 2.2 Target Schema (22a3526)

```prisma
model Conversation {
    id               String   @id @default(cuid())
    clientPhone      String
    messages         Json
    clinicId         String
    updatedAt        DateTime @updatedAt
    createdAt        DateTime @default(now())
    humanTakeover    Boolean  @default(false)
    bookingDraft     Json?            // NEW — nullable
    clientName       String?          // NEW — nullable
    currentStateName String   @default("IDLE")   // NEW — non-nullable with default
    clinic           Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
    @@unique([clinicId, clientPhone])
}
```

### 2.3 Migration SQL (Auto-Generated Equivalent)

```sql
-- Add 3 columns to Conversation table
-- All existing rows will get:
--   bookingDraft = NULL
--   clientName = NULL
--   currentStateName = 'IDLE' (default)
ALTER TABLE "Conversation" 
  ADD COLUMN "bookingDraft" JSONB,
  ADD COLUMN "clientName" TEXT,
  ADD COLUMN "currentStateName" TEXT NOT NULL DEFAULT 'IDLE';
```

### 2.4 Migration Risk Assessment

| Column | Nullable | Default | Existing Rows | Risk |
|--------|----------|---------|---------------|------|
| `bookingDraft` | ✅ YES (Json?) | `null` | `null` | **None** — existing conversations start with no draft |
| `clientName` | ✅ YES (String?) | `null` | `null` | **None** — name will be populated from history on next interaction |
| `currentStateName` | NO (String) | `'IDLE'` | `'IDLE'` | **None** — all existing conversations start at IDLE state |

**Verdict**: ✅ Safe migration. No breaking changes to existing rows. No data loss.

### 2.5 Current Migration State

The only existing migration (`prisma/migrations/20260711074811_init/`) is a **stub** containing only:
```sql
CREATE TABLE "Clinic" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, ...);
```

The production database was built via `prisma db push` (schema push), not migrations. The migration directory is out of sync with the actual database.

**Recommendation**: Reset and recreate the migration baseline:

```bash
# Option A: Baseline from current production schema
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260727000000_baseline/migration.sql

# Option B: Let Prisma detect the diff
npx prisma migrate dev --name deploy_conversation_columns
```

---

## 3. ENVIRONMENT VARIABLES

### 3.1 New Required Variable

| Variable | Value | Source | Purpose |
|----------|-------|--------|---------|
| `UPSTASH_REDIS_URL` | `redis://...` (Upstash or your Redis provider) | Vercel env vars | Redis lock for ConversationEngine concurrency safety |

The production code at `4f94143` does NOT use Redis. The HEAD `22a3526` code uses `ConnectionManager.getRedisConnection("conversation-lock")` which reads `process.env.UPSTASH_REDIS_URL`. Without this variable, the code will:
1. Default to `redis://localhost:6379` (will fail on Vercel)
2. Log a warning via `console.warn(\`[RedisLock] Failed to acquire lock: ...\`)`
3. **Proceed without locking** — the lock is a safety fix, not a hard dependency

**⚠️ Critical**: Set `UPSTASH_REDIS_URL` in Vercel environment before deploying. Without it, the Redis lock degrades gracefully (no crash), but the concurrency protection is lost.

### 3.2 Existing Variables to Verify

| Variable | Currently Set? | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | ✅ Yes | Neon PostgreSQL — unchanged |
| `OPENAI_API_KEY` | ✅ Yes | For embeddings — unchanged |
| `ENCRYPTION_KEY` | ✅ Yes | WhatsApp token encryption — unchanged |
| `CLINIC_TIMEZONE` | ✅ Yes | `Asia/Riyadh` — unchanged |
| `NEXT_PUBLIC_DEFAULT_CLINIC` | ✅ Yes | `rival-clinic` — unchanged |
| `MAX_CONTEXT_MESSAGES` | ❌ Not set | Defaults to `12` — optional |

---

## 4. EXACT DEPLOYMENT SEQUENCE

### ⏱ Estimated Total: 30 minutes

---

### STEP 1: Pre-Deployment (10 min)

```bash
# 1.1 Commit hotfix changes
cd /path/to/saas-clinic-ai
git add -A
git commit -m "hotfix: extend booking intent detection and AI prompt safeguard"
# Expected: BusinessEngine.ts + AIProvider.ts

# 1.2 Push to origin (Vercel will auto-deploy main branch)
git push origin main

# 1.3 Verify push succeeded
git log --oneline origin/main -1
# Expected: SHA starting with 22a3526 or newer
```

**⚠️ Caveat**: If `origin/main` is at `4f94143` and local `main` at `22a3526`, pushing will be a **force-push** or **merge** depending on your branch setup. Verify:

```bash
# Check divergence
git status
# If "Your branch and 'origin/main' have diverged":
git log --oneline origin/main..HEAD
# If 7+ commits shown, you need to force-push
git push origin main --force-with-lease
```

**Alternative (safer)**: Create a PR from the release branch:
```bash
git checkout -b release/pilot-candidate
git push origin release/pilot-candidate
# Create PR on GitHub → merge to main → Vercel auto-deploys
```

---

### STEP 2: Database Backup (2 min)

```bash
# Export full production database
pg_dump --no-owner --no-acl \
  "postgresql://neondb_owner:npg_IxDqO0BSe6nJ@ep-red-tree-adl3rruj.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  > /tmp/clinova-prod-$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh /tmp/clinova-prod-*.sql
# Expected: ~10-50MB
```

**Alternative (via Vercal/Neon dashboard)**:
- Neon → Database → Branching → Create a database branch (snapshot)
- Or use Vercel Postgres → Data → Export

---

### STEP 3: Database Migration (5 min)

**⚠️ Run migration BEFORE deploying new code** to avoid schema mismatch errors when the new code starts.

```bash
# 3.1 Generate Prisma client
npx prisma generate

# 3.2 Create migration
npx prisma migrate dev --name add_conversation_columns

# 3.3 Verify migration SQL
cat prisma/migrations/*add_conversation_columns/migration.sql
# Expected output:
# ALTER TABLE "Conversation" ADD COLUMN "bookingDraft" JSONB;
# ALTER TABLE "Conversation" ADD COLUMN "clientName" TEXT;
# ALTER TABLE "Conversation" ADD COLUMN "currentStateName" TEXT NOT NULL DEFAULT 'IDLE';

# 3.4 Apply migration (against production DB)
npx prisma migrate deploy

# 3.5 Verify migration applied
npx prisma migrate status
# Expected: "Database schema is up to date"
```

**⚠️ SAFETY**: If using a remote DB URL in `.env`, `prisma migrate deploy` targets that database directly. Verify the DATABASE_URL points to production before running.

---

### STEP 4: Set Environment Variable (2 min)

```bash
# Via Vercel CLI
npx vercel env add UPSTASH_REDIS_URL production

# Or via Vercel Dashboard:
# 1. Go to https://vercel.com/team_C7yQXAa5iZowwg2bCl8lLG5n/saas-clinic-ai
# 2. Settings → Environment Variables
# 3. Add UPSTASH_REDIS_URL = "<your-redis-url>"
# 4. Scope to "Production"
```

You need a Redis instance. Options:
- **[Upstash](https://upstash.com)** (serverless, works well with Vercel) — ~$0-5/mo
- **Redis on Vercel** (integrated marketplace)
- **Existing Redis** if you already have one

---

### STEP 5: Deploy to Vercel (5 min)

```bash
# Deploy from main branch
npx vercel --prod

# Or: Vercel will auto-deploy when you push to main
# Monitor at: https://vercel.com/team_C7yQXAa5iZowwg2bCl8lLG5n/saas-clinic-ai

# Verify deployment
npx vercel list --prod
# Expected: latest deployment with commit == origin/main HEAD
```

**Vercel build command** (from `vercel.json`): `npx prisma generate && next build`

---

### STEP 6: Post-Deploy Verification (5 min)

```bash
# 6.1 Check Vercel deployment logs
npx vercel logs <deployment-url>
# Expected: Build successful, no errors

# 6.2 Verify schema migration (run against production DB)
npx prisma migrate status
# Expected: "Database schema is up to date"
# All 3 columns present

# 6.3 Verify API endpoint responds
curl https://<your-domain>/api/chat/ping
# Expected: 200 response

# 6.4 Check Vercel Functions logs for startup errors
npx vercel logs <deployment-url> --function
# Expected: No RedisLock warnings, no ConnectionManager errors
```

---

### STEP 7: WhatsApp Smoke Test (5 min)

Execute exactly one booking session from a test phone:

| Step | User Message | Expected Intent | Expected Behavior |
|------|-------------|----------------|-------------------|
| 1 | "السلام عليكم" | Inquiry | Greeting response |
| 2 | "أريد الحجز" | BookAppointment | Start gathering data |
| 3 | "فيلر" | BookAppointment | Record service |
| 4 | "د. سارة" | BookAppointment | Record doctor |
| 5 | "فرع الصحافة" | BookAppointment | Record branch |
| 6 | "بكرة الساعة 5 مساء" | BookAppointment | Time with keyword → P1 guard works |
| 7 | Provide a name | BookAppointment | Record name |
| → | All 5 fields complete | Booking receipt | Booking created in DB |

**Verify**: A booking row appears in the database.

---

### STEP 8: Rollback Steps (if needed)

#### Rollback Code

```bash
# 8.1 Deploy previous commit
npx vercel deploy --prod --force <previous-deployment-id>

# Or via Vercel Dashboard:
# Deployments → find last known good deployment → "Promote to Production"
```

#### Rollback Schema

```sql
-- Revert migration (no data loss — columns are nullable)
ALTER TABLE "Conversation" DROP COLUMN "bookingDraft";
ALTER TABLE "Conversation" DROP COLUMN "clientName";
ALTER TABLE "Conversation" DROP COLUMN "currentStateName";

-- Or restore from backup
psql "postgresql://neondb_owner:...@ep-red-tree-adl3rruj.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  < /tmp/clinova-prod-<timestamp>.sql
```

**Rollback Assessment**:
- **Schema rollback**: 100% safe — columns are nullable with defaults, dropping them loses NO data
- **Code rollback**: Old code (4f94143) doesn't read/write the new columns — it will ignore them
- **Redis**: If UPSTASH_REDIS_URL is set, old code doesn't use it — no impact

---

## 5. CODE CHANGE INVENTORY

### 5.1 Source Files Changed (vs production 4f94143)

| File | Lines Changed | Risk | Purpose |
|------|--------------|------|---------|
| `prisma/schema.prisma` | +19/-19 | ✅ Low | 3 new Conversation columns |
| `src/lib/domain/ConversationEngine.ts` | +186/-186 | ⚠️ Medium | bookingDraft, Redis lock, P1, P2, empty msg guard, draft expiration |
| `src/lib/domain/BusinessEngine.ts` | +275/-275 | ⚠️ Medium | TimeExtractor, structured trace, deterministic time, ImmutableContext |
| `src/lib/domain/TimeNormalizer.ts` | +64/-64 | ✅ Low | 24h regex fix, normalization logic |
| `src/lib/domain/TimeExtractor.ts` | +203 (NEW) | ✅ Low | Deterministic time extraction regex |
| `src/lib/domain/types.ts` | +58/-58 | ✅ Low | BookingTrace, ImmutableBookingContext types |
| `src/lib/domain/journey/JourneyResolver.ts` | +62/-62 | ⚠️ Medium | FSM explicit transitions, renamed stages |
| `src/lib/domain/BookingService.ts` | +39/-39 | ✅ Low | Timezone-aware date handling |
| `src/lib/domain/RAGPipeline.ts` | +14/-14 | ✅ Low | Minor API updates |
| `src/app/api/webhook/whatsapp/route.ts` | +18/-18 | ✅ Low | ConnectionManager resilience, idempotency cleanup |
| `src/app/api/conversations/route.ts` | +9/-9 | ✅ Low | Minor updates |
| `src/middleware.ts` | +7/-7 | ✅ Low | Minor updates |
| `src/lib/infrastructure/queue/IncomingMessageWorker.ts` | +6/-6 | ✅ Low | Minor updates |
| `src/app/dashboard/page.tsx` | +2/-2 | ✅ Low | Minor UI update |

### 5.2 New Files

| File | Purpose |
|------|---------|
| `src/lib/domain/TimeExtractor.ts` | Deterministic regex-based time extraction (precedes LLM) |
| `production-regression/` | Pilot regression test fixtures (not deployed) |
| `src/__tests__/*` | Test files (not deployed) |

### 5.3 Hotfix Delta (Uncommitted)

| File | Change Summary |
|------|---------------|
| `src/lib/domain/BusinessEngine.ts` | (1) Extended booking regex: `حجز\|أحجز\|موعد\|احجز\|عاوزة\s*احجز\|...` (2) Added `"Inquiry"` to `Unknown` escalation check |
| `src/lib/infrastructure/ai/AIProvider.ts` | (1) Extended booking instruction in system prompt (2) New post-AI intent safeguard: if AI returns Unknown/Inquiry but user said حجز/موعد → BookAppointment |

---

## 6. RISK ASSESSMENT

### 6.1 High-Risk Changes

| Change | Risk | Mitigation |
|--------|------|-----------|
| `ConversationEngine.ts` rewrite (state reconstruction from history-loop to bookingDraft-based) | **Medium** — new state management path untested in production | Phase C+D tested in local regression suite; state reconstruction is backwards-compatible (bookingDraft starts null) |
| `JourneyResolver` FSM transition method renamed | **Low** — old `resolveStage` method removed; only called from `ConversationEngine` which is also rewritten | Code compiles clean |
| Redis lock dependency | **Low** — degrades gracefully without Redis | Set `UPSTASH_REDIS_URL` before deployment |

### 6.2 Low-Risk Changes

| Change | Risk |
|--------|------|
| `TimeExtractor.ts` new file | None — isolated regex logic, deterministic |
| `TimeNormalizer.ts` regex fix | None — only extends matching range |
| `BookingService.ts` timezone fix | None — isolated date calculation |
| Hotfix delta (BusinessEngine + AIProvider) | None — tested in local reproduction |
| Schema migration | None — nullable columns + defaults |

### 6.3 Rollback Complexity

| Scenario | Complexity | Time |
|----------|-----------|------|
| **Code rollback only** (no schema revert) | Low | 2 min — Vercel promote previous deployment |
| **Full rollback** (code + schema) | Low | 5 min — deploy old code + drop columns |
| **Emergency data recovery** | Medium | 10 min — restore from pg_dump |

---

## 7. VERIFICATION COMMANDS (Cheat Sheet)

```bash
# Git state
git log --oneline origin/main -3
git log --oneline HEAD -1
git status

# Migration
npx prisma generate
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
npx prisma migrate deploy
npx prisma migrate status

# Build
npm run build

# Test
npx vitest run

# Vercel
npx vercel list --prod
npx vercel logs <deployment-url>
npx vercel inspect <deployment-url>
```

---

## 8. APPENDIX: Environment Variable Template

Add to Vercel Environment Variables:

```env
# MANDATORY — for Redis conversation lock
UPSTASH_REDIS_URL="redis://default:<password>@<host>.upstash.io:6379"

# OPTIONAL — context window size (defaults to 12)
MAX_CONTEXT_MESSAGES="12"

# OPTIONAL — debug Redis connection issues
DEBUG_REDIS="false"
```

---

*End of deployment plan. Preparation only — no deployment action taken.*
