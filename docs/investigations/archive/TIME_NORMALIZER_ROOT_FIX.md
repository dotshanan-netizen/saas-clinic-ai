# TimeNormalizer Root-Cause Fix Report

## Bug Summary

A WhatsApp user sending Saudi phone number `0501234567` caused TimeNormalizer to inject a phantom time `05:00 م` into the booking pipeline. The bug appeared at **Step 1** of a conversation where the phone number was the input, not any later step.

## Root Cause

`TimeNormalizer.normalize("0501234567")` — the time regex at `TimeNormalizer.ts` line 180:

```
/(?<!\(\s*|من\s*)([0-2]?[0-9])(?:[:.]([0-5][0-9]))?/
```

matched the leading `05` in `0501234567` as:
- **hour** = `5` (from `05`)
- **minute** = `0`
- **AM/PM guess** = `PM` (TimeNormalizer's heuristic: hours 1-8 with no explicit meridiem → PM)
- **Result**: `05:00 م` (5:00 PM)

The regex had no guard against numeric identifiers (phone numbers, IDs, invoice numbers, etc.) — it blindly matched any 1-2 digit prefix regardless of context. The remaining digits `1234567` were simply ignored after the first match.

**Key Finding**: Gemini (`gemini-2.5-flash`) correctly returned `timeSlot: null` at every conversation step. The LLM was innocent — the bug was purely in the deterministic TimeNormalizer regex.

## Investigation Process

1. **Diagnostic logging** added at 3 pipeline points:
   - `DIAGNOSTIC_AI_PROVIDER` — full prompt + raw Gemini response (AIProvider.ts)
   - `DIAGNOSTIC_TIME_EXTRACTOR` — TimeExtractor input/output (BusinessEngine.ts)
   - `DIAGNOSTIC_FULL_PIPELINE` — complete pipeline snapshot (ConversationEngine.ts)

2. **Reproduction script** `scripts/reproduce-phantom-time.ts` simulated the 3-step WhatsApp conversation:
   - Step 1: `0501234567` (phone number)
   - Step 2: `بوتكس` (service)
   - Step 3: `الصحافة` (branch)

3. **Diagnostic logs** revealed the phantom time originated from `TimeNormalizer.normalize()`, not from Gemini.

## Design Change

### Guard: `hasTimeContextSignal()`

Added a private static method `TimeNormalizer.hasTimeContextSignal(text)` that checks whether the input contains any signal that it is a time expression, as opposed to a bare numeric identifier.

**8 context signal categories** (checked in order, any match → accept):

| # | Category | Examples |
|---|---|---|
| 1 | Meridiem words (multi-char) | صباح, مساء, ظهر, عصر, am, pm, a.m. |
| 2 | Time keyword | الساعة, الساعه |
| 3 | Colon/dot between digits | `5:30`, `17:00`, `5.30` |
| 4 | Arabic ordinal hours | الواحدة, الثانية, ..., العاشرة |
| 5 | Day-of-week references | الأحد, الاثنين, ..., السبت |
| 6 | Relative day references | اليوم, بكرة, بعد بكره, الأمس |
| 7 | Month references | يناير, فبراير, ..., ديسمبر |
| 8 | Normalized date pattern | `(27 يوليو)` (already-normalized output) |

**Single-letter meridiem ص / م** are handled via separate regex checks (digit-adjacency or token-boundary) instead of `text.includes()`, because `includes("م")` falsely matches Arabic words like "رقم" (number), "اسم" (name), "يوم" (day).

### Rejection Logic

```typescript
if (!this.hasTimeContextSignal(text)) {
  const digitSequences = text.match(/\d{3,}/g);
  if (digitSequences && digitSequences.length > 0) {
    return null;  // reject — bare numeric identifier
  }
}
// proceed with normal normalization
```

- **Threshold**: 3+ consecutive digits triggers the guard
- **Short numbers** (1-2 digits like "5", "05") pass through — they're valid time expressions
- **Phone numbers** (10+ digits), **IDs** (any length ≥ 3), **invoices** (INV-20260727), **tracking numbers** all get rejected

### Key Design Decisions

- **Not a special-case**: No `startsWith("05")` or phone-number prefix check — the guard is structural and regex-based
- **No pipeline changes**: Only `TimeNormalizer.ts` was modified. AIProvider, BusinessEngine, ConversationEngine, Prompt, and Booking flow are untouched
- **No type-safety violations**: No `as any`, `@ts-ignore`, or `@ts-expect-error`

## Test Results

**26/26 tests passing** (1 test file, 2 describe blocks):

### Positive Cases (12) — Must accept valid time expressions

| Input | Expected | Status |
|---|---|---|
| `"5"` (bare single digit) | `05:00 م` | ✓ |
| `"05"` (bare two digits) | `05:00 م` | ✓ |
| `"5pm"` (English meridiem) | `05:00 م` | ✓ |
| `"5 pm"` (space + meridiem) | `05:00 م` | ✓ |
| `"الساعة 5"` (time keyword) | `05:00 م` | ✓ |
| `"17:00"` (colon 24h) | `05:00 م` | ✓ |
| `"5:30"` (colon half-hour) | `05:30 م` | ✓ |
| `"٥ مساءً"` (Arabic-Indic + meridiem) | `05:00 م` | ✓ |
| `"10 صباحاً"` (Arabic AM) | `10:00 ص` | ✓ |
| `"3 عصراً"` (Arabic PM) | `03:00 م` | ✓ |
| `"الأحد الساعة 10 ص"` (full context) | `الأحد (2 أغسطس) 10:00 ص` | ✓ |
| `"بكرة الساعة 2 الظهر"` (relative day) | `الثلاثاء (28 يوليو) 02:00 م` | ✓ |

### Negative Cases (11) — Must reject numeric identifiers

| Input | Expected | Status |
|---|---|---|
| `"0501234567"` (Saudi phone) | `null` | ✓ |
| `"+966501234567"` (international phone) | `null` | ✓ |
| `"966501234567"` (bare international) | `null` | ✓ |
| `"1234567890"` (random ID) | `null` | ✓ |
| `"INV-20260727"` (invoice) | `null` | ✓ |
| `"1Z999AA10123456784"` (tracking) | `null` | ✓ |
| `"500"` (short 3-digit) | `null` | ✓ |
| `"123"` (short 3-digit) | `null` | ✓ |
| `"0500"` (short 4-digit) | `null` | ✓ |
| `"رقم 123456"` (Arabic text + number) | `null` | ✓ |
| `"order 99999"` (English text + number) | `null` | ✓ |

### Existing Tests (3) — No regression

| Test | Status |
|---|---|
| Strict idempotency | ✓ |
| Day-of-month independence (5 variants) | ✓ |
| E2E pipeline integration (booking for day 27 at 11:00) | ✓ |

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Rejecting valid time expressions | Low | 12 positive tests cover all common Arabic time formats |
| False-positive with Arabic words containing "م"/"ص" | Fixed | Token-boundary regex replaces `includes()` for single-letter meridiem |
| Performance impact | Negligible | `hasTimeContextSignal()` runs O(n) simple regex/string operations; called once per normalize |
| E2E booking flow regression | Low | Full pipeline test confirms booking request for day 27 at 11:00 works correctly |
| Short 2-digit time like "5" still passes | By design | 1-2 digit numbers < 3 consecutive digits are valid times |

## Files Changed

| File | Change |
|---|---|
| `src/lib/domain/TimeNormalizer.ts` | Added `hasTimeContextSignal()` guard at line 80; fixed single-letter meridiem check |
| `src/__tests__/unit/TimeNormalizer.test.ts` | Added 23 new tests (12 positive + 11 negative) in "TimeNormalizer Numeric-Identifier Guard" describe block |
| `scripts/reproduce-phantom-time.ts` | New reproduction script (kept for future regression runs) |

## Files Not Changed (per constraint)

- `src/lib/infrastructure/ai/AIProvider.ts` — diagnostics added temporarily, then removed
- `src/lib/domain/BusinessEngine.ts` — diagnostics added temporarily, then removed
- `src/lib/domain/ConversationEngine.ts` — diagnostics added temporarily, then removed
- All Prompt/System Prompt files
- All Booking flow files
