# PHASE A — Temporal Consistency Hypotheses

> **الهدف**: تحديد السبب الجذري لمشكلة Temporal Consistency (11:00 → 07:00) من خلال 5 فرضيات قابلة للاختبار.
>
> **الطريقة**: كل فرضية لها Evidence من الكود، و Verification Method، وتُسجل Result بعد الاختبار.

---

## H1 — Timezone Offset

| البند | المحتوى |
|---|---|
| **الفرضية** | الخادم يعمل بـ UTC ولكن عمليات الوقت تستخدم `new Date()` المحلي. `startOfDay(new Date())` في UTC يعطي منتصف ليل UTC = 3 صباحًا بتوقيت الرياض. هذا لا يسبب تغييرًا في الساعة مباشرة (لأن الساعات تأتي من جدول المواعيد، وليس من Date)، لكنه يسبب انحرافًا في حساب اليوم (Day-of-week) إذا كان توقيت الخادم يختلف عن توقيت العيادة. |
| **Evidence (Code)** | `BookingService.ts:76`: `const today = startOfDay(new Date())` — لا يوجد تحديد Timezone. `TimeNormalizer.ts:110`: `const today = new Date()` — نفس الشيء. لا يوجد `TZ` متغير بيئة في `.env` أو `package.json`. |
| **Verification Method** | 1. تشغيل `node -e "console.log(new Date().getTimezoneOffset())"` على خادم Production (أو محاكاة UTC بـ `TZ=UTC`)<br>2. مقارنة `startOfDay(new Date())` في UTC vs Asia/Riyadh<br>3. التحقق من أن `format(date, "EEEE")` يعطي نفس اليوم في UTC و Riyadh |
| **Result** | (تسجل بعد الاختبار) |

### تفاصيل H1

```
السيناريو:
  الوقت في الرياض: 2026-07-28 01:00 ص (الأربعاء)
  الوقت في UTC:    2026-07-27 22:00 (الثلاثاء)

  BookingService:
    today = startOfDay(new Date())  →  2026-07-27 00:00 UTC (الثلاثاء)
    addDays(today, 0)              →  2026-07-27 00:00 UTC (الثلاثاء)
    format(date, "EEEE")           →  "Tuesday"

  TimeNormalizer (لـ "بكرة"):
    targetDate = new Date() + 1     →  2026-07-28 01:00 +03 (الأربعاء)
    getDay()                       →  3 (الأربعاء)

  الخلاصة:
  BookingService و TimeNormalizer يستخدمان `new.Date()` في نفس runtime.
  لذا كلاهما يعاني من نفس مشكلة Timezone — لكن بشكل متسق (كلاهما UTC أو كلاهما Asia/Riyadh).
  المشكلة تظهر فقط إذا تشغلا في Timezones مختلفة (مثلاً: BookingService في UTC، TimeNormalizer في +03).
```

---

## H2 — JavaScript Date Parsing & Date-fns `startOfDay`

| البند | المحتوى |
|---|---|
| **الفرضية** | `startOfDay(new Date())` يُعيد منتصف الليل في التوقيت المحلي للخادم. إذا كان الخادم في UTC، فإن منتصف الليل UTC = 3 صباحًا Riyadh. هذا يؤثر على `date.getDate()` و `date.getMonth()` و `format(date, "EEEE")` — لكنه لا يؤثر على الساعات نفسها (لأن الساعات تُقرأ من الـ Schedule وليس من Date). |
| **Evidence (Code)** | `BookingService.ts:76` تستخدم `startOfDay` و `addDays` لتوليد المواعيد. الساعات تأتي من `schedule.startTime.split(":").map(Number)` (سطر 102) — مستقلة عن Timezone. أما `date.getDate()` (سطر 109) فيتأثر بالـ Timezone. |
| **Verification Method** | 1. محاكاة `TZ=UTC` و `TZ=Asia/Riyadh`<br>2. إنشاء `startOfDay(new Date())` في كلا التوقيتين<br>3. حساب `addDays(today, 0).getDate()` — هل يختلف اليوم بين UTC و Riyadh؟ |
| **Result** | (تسجل بعد الاختبار) |

### تفاصيل H2

```
الفرق الحرج:
  UTC midnight  =  00:00 UTC
  Riyadh midnight = 21:00 UTC (اليوم السابق)

  إذا كان الوقت في الرياض 10:00 مساءً:
    UTC: 2026-07-27 19:00
    startOfDay(UTC) = 2026-07-27 00:00 UTC → getDate() = 27
    startOfDay(Riyadh) = 2026-07-27 00:00 +03 → getDate() = 27
    (نفس اليوم - متطابق)

  إذا كان الوقت في الرياض 02:00 صباحًا:
    UTC: 2026-07-27 23:00
    startOfDay(UTC) = 2026-07-27 00:00 UTC → getDate() = 27
    startOfDay(Riyadh) = 2026-07-28 00:00 +03 → getDate() = 28
    (يختلف اليوم بيوم!)

  التأثير: في الساعات الأولى من الصباح (12-3 AM Riyadh)،Slot Generation
  تستخدم تاريخ UTC (اليوم السابق) بينما TimeNormalizer يستخدم تاريخ Riyadh (اليوم الحالي).
```

---

## H3 — Prisma Serialization (String TimeSlot)

| البند | المحتوى |
|---|---|
| **الفرضية** | `booking.timeSlot` يُخزّن كـ `String` (بدون Timezone أو Timestamp). عند قراءته من DB، لا يمكن تحديد Timezone الأصلية. أي مقارنة بين Slot مُولّد (من `new Date()`) و Slot مُخزّن (String بارد) تفقد معلومات Timezone. |
| **Evidence (Code)** | Prisma schema: `timeSlot String` (لا DateTime، لا Timezone). `BookingService.ts:85`: `new Set(docBookings.map((b) => b.timeSlot))` — مقارنة نصوص مباشرة بدون أي تحويل زمني. |
| **Verification Method** | 1. إدخال `timeSlot` بقيمة "الأحد (26 يوليو) 11:00 ص" من Asia/Riyadh<br>2. قراءتها من UTC — هل تتطابق مع slot مُولّد في UTC لنفس الوقت المطلق؟<br>3. التحقق من أن المقارنة `slot === validation.cleanTimeSlot` تعتمد على النص فقط |
| **Result** | (تسجل بعد الاختبار) |

### تفاصيل H3

```
مشكلة الـ String TimeSlot:
  Slot مُولّد في Asia/Riyadh:  "الأحد (26 يوليو) 11:00 ص" (09:00 UTC)
  Slot مُولّد في UTC:          "الأحد (26 يوليو) 11:00 ص" (11:00 UTC ≠ 09:00 UTC)
  
  نفس النص! لكن دلالة زمنية مختلفة.
  
  عندما يحاول Double-Booking Guard مقارنة slot مع booking.timeSlot المخزّن:
    "الأحد (26 يوليو) 11:00 ص" === "الأحد (26 يوليو) 11:00 ص" → true (نصيًا)
    
  لكنهما يشيران إلى وقتين مطلقين مختلفين!
  
  الخلاصة: String TimeSlot يفقد الـ Timezone Context. أي مقارنة نصية قد تعطي
  نتائج خاطئة إذا تولّدت الـ Slots في Timezone غير Timezone التخزين.
```

---

## H4 — TimeNormalizer AM/PM Heuristic

| البند | المحتوى |
|---|---|
| **الفرضية** | TimeNormalizer لديه قاعدة تخمين AM/PM للساعات 1-8 بدون سياق: تعتبر PM. هذا صحيح لساعات العيادة (1-8 مساءً = 13:00-20:00)، لكنه خطأ إذا المستخدم قصد 7 صباحًا أو 8 صباحًا. الساعة 11 (بدون سياق) تُعتبر AM وهذا صحيح. لكن إذا دخلت قيمة خاطئة من AI (مثلاً "07:00" بدون AM/PM)، تصبح 7 PM = 19:00، وهو وقت غير موجود في جدول العيادة. |
| **Evidence (Code)** | `TimeNormalizer.ts:178-184`: `if (hour >= 1 && hour <= 8) { isPM = true; } else { isAM = true; }`. `hour` هنا هو بعد تحويل 24h→12h (سطر 151-152). |
| **Verification Method** | 1. اختبار `TimeNormalizer.normalize("7:00")` → هل يُرجع "07:00 م"؟<br>2. اختبار `TimeNormalizer.normalize("11:00")` → هل يُرجع "11:00 ص"؟<br>3. اختبار `TimeNormalizer.normalize("07:00 ص")` → هل "ص" تمنع الـ PM heuristic؟<br>4. اختبار `TimeNormalizer.normalize("7:00 مساءً")` → هل "مساءً" تمنع الـ AM heuristic؟ |
| **Result** | (تسجل بعد الاختبار) |

### تفاصيل H4

```
جدول تحويل TimeNormalizer للساعات بدون سياق AM/PM:

  الساعة  →  التفسير
  1       →  01:00 م (13:00)
  2       →  02:00 م (14:00)
  3       →  03:00 م (15:00)
  4       →  04:00 م (16:00)
  5       →  05:00 م (17:00)
  6       →  06:00 م (18:00)
  7       →  07:00 م (19:00) ← خطأ إذا كان القصد 7 صباحًا
  8       →  08:00 م (20:00) ← خطأ إذا كان القصد 8 صباحًا
  9       →  09:00 ص (09:00) ✓
  10      →  10:00 ص (10:00) ✓
  11      →  11:00 ص (11:00) ✓
  12      →  12:00 م (12:00) ✓
```

---

## H5 — AI Output Formatting Inconsistency

| البند | المحتوى |
|---|---|
| **الفرضية** | الـ AI Provider (Gemini/GPT) قد يُخرج تنسيقات وقت غير متوقعة: 24h ("14:00")، 12h بدون مسافة ("11:00ص")، إنجليزي ("11:00 AM")، ISO ("2026-07-26T11:00:00")، أو Timezone-aware ("11:00+03:00"). الـ TimeNormalizer قد يتعامل مع بعضها بشكل غير صحيح — خاصة إذا الـ AI أخرج Timezone info وتم تجاهلها. |
| **Evidence (Code)** | `AIProvider.ts` الـ Zod schema لـ `timeSlot` يقبل `z.string().nullable().optional()` — أي string. لا يوجد Validation على التنسيق. `TimeNormalizer.ts` يتعامل مع Timezone info في النص بشكل محدود (لا يتعرف على "UTC" أو "+03:00"). |
| **Verification Method** | 1. مراجعة AI responses السابقة من Logger<br>2. اختبار TimeNormalizer مع: "14:00" و "2:00 م" و "02:00 PM" و "11:00 AM" و "11:00+03:00" و "2026-07-26T11:00:00"<br>3. التحقق من أن الـ AI لا يخرج Timezone-aware strings |
| **Result** | (تسجل بعد الاختبار) |

### تفاصيل H5

```
التنسيقات المحتملة من AI:

  "11:00"           → 11:00 ص  (ساعة 11 بدون سياق → AM) ✓
  "11:00 ص"         → 11:00 ص  (مع سياق)              ✓
  "11:00 AM"        → 11:00 ص  (am في extendedAmWords) ✓ 
  "23:00"           → 11:00 م  (24h → PM)             ✓
  "11:00+03:00"     → 11:00 ص  (Timezone stripped)    ؟
  "2026-07-26T11:00" → ساعة 11 من التاريخ → قد يخطئ   ؟
  "11:00:00"        → 11:00 ص  (ثواني موجودة)          ؟
  "11 ص"            → الوقت "11" + "ص" في extendedAmWords → 11:00 ص ✓
```

---

## خريطة التحقق (Verification Matrix)

| H# | الأولوية | سهولة التحقق | يعطل 11:00→07:00؟ |
|---|---|---|---|
| H1 | 🟡 Medium | سهل (محاكاة TZ) | يُفسّر انحراف اليوم، لا الساعة |
| H2 | 🟡 Medium | سهل (محاكاة TZ) | يُفسّر انحراف اليوم في الصباح الباكر |
| H3 | 🟡 Medium | سهل (قراءة الكود) | يُفسّر فقدان Context، لا تحويل مباشر |
| H4 | 🔴 High | سهل (اختبار وحدة) | يُفسّر تحويل 1-8 → PM، لكن 11 يبقى AM |
| H5 | 🔴 High | متوسط (تحليل AI logs) | يُفسّر تحويل غير متوقع حسب تنسيق AI |

---

## الخلاصة الأولية

من تحليل الكود وحده، **H4 و H5 هما الأكثر احتمالاً** لتفسير مشكلة 11:00→07:00:

- **H4**: إذا أخرج AI `timeSlot: "07:00"` بدون AM/PM (بسبب خطأ في فهمه)، يصبح 7 PM وليس 7 AM. لكن هذا لا يشرح 11:00→07:00 (11 يبقى AM).
- **H5**: إذا أخرج AI تنسيقًا غير متوقع يقرأه TimeNormalizer بشكل خاطئ، أو إذا الـ AI نفسه حوّل التوقيت (مثلاً: استلم "11:00" كـ UTC وحوّلها إلى "07:00" لتوقيت آخر).

**الفرضية الإضافية غير المسماة**: قد يكون الـ AI نفسه يقوم بتحويل Timezone (يعتقد أن "11:00" هي UTC ويحولها إلى توقيت المستخدم). هذا خارج نطاق الكود — يعتمد على System Prompt.
