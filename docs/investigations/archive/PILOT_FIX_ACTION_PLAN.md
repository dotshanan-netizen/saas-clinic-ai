# AUDIT FINDINGS — ACTION PLAN FOR PILOT LAUNCH

## 🔴 BLOCKING ISSUES (Fix Now — 2–3 Days)

### 1. BYPASS_AUTH Authentication Bypass
**Priority**: CRITICAL  
**Time**: 30 minutes  
**Action**:
```typescript
// BEFORE (src/middleware.ts:9)
if (process.env.BYPASS_AUTH === "true") {

// AFTER — Option A: Remove entirely
if (false) {  // Dead code path; delete in cleanup

// OR Option B: Restrict to dev only
if (process.env.BYPASS_AUTH === "true" && (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview")) {
  // Only in dev/preview, never in production
  const isLocalhost = request.headers.get("x-forwarded-for") === "127.0.0.1" || 
                      new URL(request.url).hostname === "localhost";
  if (!isLocalhost) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```
**Verification**: Run `npm run test` → ensure auth tests pass; verify `.env.production` does NOT have `BYPASS_AUTH`

---

### 2. Rotate All Exposed Secrets
**Priority**: CRITICAL  
**Time**: 1 hour  
**Action**:
```bash
# 1. DELETE .env from Git history (one-time)
git filter-branch --tree-filter 'rm -f .env' HEAD
git push origin --force

# 2. Rotate secrets in each service:
# - OpenAI: Regenerate API key at https://platform.openai.com/account/api-keys
# - Gemini: Rotate at https://console.cloud.google.com/
# - Meta: Regenerate System User token in Meta App Dashboard
# - Neon DB: Change password in Neon dashboard
# - JWT_SECRET: Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# - ENCRYPTION_KEY: Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Add to Vercel UI (do NOT commit):
# - OPENAI_API_KEY
# - GEMINI_API_KEY
# - META_ACCESS_TOKEN
# - DATABASE_URL
# - JWT_SECRET
# - ENCRYPTION_KEY
# - WHATSAPP_VERIFY_TOKEN

# 4. Verify .gitignore
grep "\.env" .gitignore  # Must show: .env*
```
**Verification**: Run `git log --name-status --diff-filter=D` → confirm `.env` is deleted; verify Vercel env vars UI has all secrets

---

### 3. Fix Phone Validation Regex
**Priority**: HIGH  
**Time**: 1 hour  
**Action**:
```typescript
// BEFORE (src/lib/domain/types.ts:102-104)
const structuralMatch = clean.match(/^\+?[1-9]\d{8,14}$/);
if (structuralMatch) {
  return clean.startsWith("+") ? clean : "+" + clean;
}
return null;

// AFTER — Strict validation only
// Remove the fallback regex; rely 100% on libphonenumber
// If libphonenumber fails, reject (don't accept invalid numbers)
// The code already has libphonenumber validation (lines 68-84); 
// just delete the fallback structural match (lines 102-104)

// NEW CODE (delete lines 86-108 entirely):
// Delete this entire block:
if (defaultCountry.toUpperCase() === "SA") { ... return saPhone; }
// Delete this:
const structuralMatch = clean.match(/^\+?[1-9]\d{8,14}$/);
if (structuralMatch) { ... return clean; }
// Result: Return null if libphonenumber fails
return null;
```
**Test**: Run unit test:
```bash
npm run test -- phone-validation.test.ts
# Expected: 3 tests FAIL (those are the invalid ones we reject now)
# Modify tests to expect null for invalid numbers
npm run test -- phone-validation.test.ts
# Expected: 0 tests fail
```

---

### 4. Verify Encryption Token Format
**Priority**: HIGH  
**Time**: 1.5 hours  
**Action**:
```typescript
// AUDIT: Where are tokens stored/encrypted?
// Search for all calls to encrypt():
// grep -r "encrypt(" src/ --include="*.ts"

// LIKELY location: WhatsApp token storage in ClinicService
// File: src/services/ClinicService.ts (or similar)
// Look for: 
// 1. How token is received (from Meta API)
// 2. How token is encrypted before DB save
// 3. Format: should be "iv:authTag:encryptedData" (colon-delimited)

// ADD VALIDATION in decrypt calls:
// FILE: src/app/api/webhook/whatsapp/route.ts:131
const parts = storedToken.split(":");
if (parts.length !== 3) {
  console.error("[DecryptError] Token format invalid. Expected 'iv:authTag:encryptedData', got:", storedToken.slice(0, 50));
  return NextResponse.json({ error: "Invalid token format" }, { status: 500 });
}
const [iv, authTag, encryptedData] = parts;
try {
  const decryptedToken = decrypt(encryptedData, iv, authTag);
  console.log("[DecryptSuccess] Token decrypted successfully");
} catch (err) {
  console.error("[DecryptFailed]", err, "Token may have been corrupted");
  return NextResponse.json({ error: "Token decryption failed" }, { status: 500 });
}
```
**Verification**: 
```bash
# Manual test: Create a clinic with WhatsApp token
# Send a test message via API
# Check logs for "[DecryptSuccess]" message
```

---

### 5. Enable TypeScript Build Checks
**Priority**: HIGH  
**Time**: 30 minutes  
**Action**:
```typescript
// BEFORE (next.config.ts:4-8)
typescript: {
  ignoreBuildErrors: true,  // ← DELETE
},
eslint: {
  ignoreDuringBuilds: true,  // ← DELETE
}

// AFTER
typescript: {
  // Remove ignoreBuildErrors; let TypeScript fail builds with errors
},
eslint: {
  // Remove ignoreDuringBuilds; let ESLint fail builds with warnings
}

// Next.js will now fail if there are unresolved type errors
```
**Action**: Fix any TypeScript errors that surface:
```bash
npm run build
# Will now show all type errors
# Fix each one (do NOT use 'as any' or '@ts-ignore')
```

---

### 6. Create Deployment Runbook
**Priority**: HIGH  
**Time**: 1.5 hours  
**Action**: Create file `DEPLOYMENT_RUNBOOK.md`:
```markdown
# Pilot Deployment Runbook

## Pre-Deployment Checklist (48 hours before)
- [ ] All blocking issues fixed
- [ ] Load tests passed (race condition < 0.1% failure)
- [ ] E2E tests passing on staging
- [ ] Secrets verified in Vercel UI (NOT in code)
- [ ] Database backups enabled
- [ ] Rollback plan documented

## Deployment Steps
1. Merge PR to `main` branch
2. Vercel auto-deploys on push to `main`
3. Run E2E tests: `npm run test:e2e`
4. Monitor Vercel logs for errors
5. Test login → dashboard → create booking

## Post-Deployment Validation
- [ ] Login works (auth not bypassed)
- [ ] Create test booking
- [ ] Receive WhatsApp message
- [ ] Check database for booking record

## Rollback (if critical error)
1. Revert last commit: `git revert HEAD`
2. Push to main (Vercel auto-redeploys)
3. Alert team; investigate error

## Monitoring (First 24 hours)
- Check Vercel logs for errors
- Monitor database connection
- Verify WhatsApp webhook is processing
```

---

## ⚠️ MEDIUM PRIORITY (Fix Before Pilot — 2–3 Days)

### 7. Race Condition Load Test
**Priority**: HIGH  
**Time**: 3 hours  
**Action**:
```bash
# Run existing load test
npm run test -- src/__tests__/integration/booking-race-condition.test.ts

# If failure rate > 0.1%:
# Implement pessimistic locking in BusinessEngine.ts
# Option A: SELECT ... FOR UPDATE (PostgreSQL)
# Option B: Version-based optimistic locking with retry
```

---

### 8. Increase Test Coverage
**Priority**: MEDIUM  
**Time**: 8 hours (ongoing)  
**Action**:
```bash
# Current: 14 tests / 35,928 files = 0.04% coverage
# Target: 25% (before Pilot)
# Focus: Critical paths
# 1. Phone validation
# 2. Booking state transitions
# 3. Auth middleware
# 4. Multi-tenancy isolation

npm run test:coverage
# Will show which files are untested
```

---

## ✅ VERIFICATION CHECKLIST

### Before Staging Deploy:
- [ ] `BYPASS_AUTH` removed or restricted to dev
- [ ] All secrets rotated (not in `.env`)
- [ ] Phone regex fixed (only accepts valid numbers)
- [ ] Encryption token format validated
- [ ] TypeScript build errors enabled
- [ ] Runbook created

### Before Pilot Production Deploy:
- [ ] E2E tests passing on staging
- [ ] Load test passed (race condition < 0.1%)
- [ ] Manual sanity test: login → booking → WhatsApp
- [ ] Vercel dashboard shows no errors
- [ ] Database backups enabled

### Post-Deploy Monitoring:
- [ ] Check Vercel logs for first 24 hours
- [ ] Verify WhatsApp webhook is receiving messages
- [ ] Monitor database connection stability
- [ ] Alert setup configured

---

## TIMELINE

```
TODAY (Jul 26)
├─ Issue #1-5: Fix (2–3 hours)
├─ Issue #6-8: Additional work (2–3 hours)
│
TOMORROW (Jul 27)
├─ Code review & merge PR
├─ Deploy to staging
├─ Run E2E tests
└─ Load test race condition

DAY 3 (Jul 28)
├─ Final QA on staging
├─ Rotate secrets (production)
├─ Prepare Pilot clinic
└─ Ready for Pilot deploy

DAY 4 (Jul 29)
└─ Deploy to production (Pilot clinic)
```

**PILOT LAUNCH DATE**: July 29–30, 2026 (pending all fixes)

---

## SUMMARY

| Issue | Priority | Fix Time | Blocker? |
|-------|----------|----------|----------|
| BYPASS_AUTH | CRITICAL | 30 min | YES |
| Secrets | CRITICAL | 1 hour | YES |
| Phone Regex | HIGH | 1 hour | YES |
| Token Format | HIGH | 1.5 hours | YES |
| TypeScript | HIGH | 30 min | YES |
| Runbook | HIGH | 1.5 hours | YES |
| Race Condition | HIGH | 3 hours | MAYBE |
| Test Coverage | MEDIUM | 8 hours | NO |

**Total Time**: 12 hours (can be parallelized to ~4 hours with team)

---

**Status**: 🔴 BLOCKED → 🟡 ACTIONABLE → 🟢 READY (in 5–8 days)
