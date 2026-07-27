# 🔍 Forensic Time Pipeline Audit (TIME_PIPELINE_FORENSIC_AUDIT.md)

## 📌 Executive Audit Directive
هذا التحقيق الجنائي المعماري يُجرى بقرار رسمي لـ **تجميد كافة الإصلاحات الموضعية لمسار الوقت (Time Pipeline Freeze)**، والقيام بمراجعة شاملة ودقيقة لكافة المكونات والدوال التي تتطرق لتأويل، مطابقة، أو تعديل الوقت من لحظة استقبال رسالة واتساب إلى لحظة إنشاء الحجز في قاعدة البيانات.

---

## 🗺️ 1. End-to-End Time Processing Sequence Map

يمر الوقت بسلسلة معالجة ممتدة عبر 7 محطات مستقلة:

```text
[1. WhatsApp Webhook] 
       ↓ (userMessage: "السبت 10 م")
[2. AI Extraction - AIProvider.ts]
       ↓ (aiResult.bookingData.timeSlot: "السبت 10 م")
[3. ConversationEngine.ts - History Merge]
       ↓ (currentState.timeSlot)
[4. BusinessEngine.ts - Fallback Extraction & Pre-Validation]
       ↓ (sanitizedData.timeSlot: "السبت 10 م")
[5. validateBookingData() - types.ts]
       ↓ (invokes TimeNormalizer.normalize())
[6. TimeNormalizer.ts - Parsing & Date Injection]
       ↓ (Converts "السبت 10 م" ➔ "السبت (25 يوليو) 05:00 م")  ⚠️ [CRITICAL FLAW DETECTED]
[7. BusinessEngine.ts - Double Booking Guard]
       ↓ (Compares "05:00 م" against availableSlots)
[Database Prisma Booking]
```

---

## 🔬 2. Forensic Discovery of Critical Root Causes

### 🚨 Root Cause 1: Day-of-Month Digit Corruption in `TimeNormalizer.ts`
- **العطل الفعلي:** عند إدخال `"السبت 10 م"` في يوم 25 يوليو، يقوم `TimeNormalizer.ts` بإقحام تاريخ اليوم النصي `"السبت (25 يوليو) 10 م"`.
- **مكمن الخلل البرمجي (L120 in TimeNormalizer.ts):**
  ```typescript
  const timeRegex = /(?<!\(\s*|من\s*)([0-1]?[0-9])(?:[:.]([0-5][0-9]))?/;
  ```
- **التشخيص الجنائي:** عند تشغيل هذا التعبير النمطي على السلسلة ذات التاريخ النصي المقحم `"السبت (25 يوليو) 10:00 م"`، يلتقط التعبير النمطي رقم **25 (يوم الشهر)** بدلاً من الوقت **10**! وبسبب مطابقة التعبير لآحاد رقم 25 (وهو الرقم 5)، يتم تحويل الرقم إلى `hour = 5` مسائياً (`05:00 م`)!
- **النتيجة:** تتحول **10 مساءً** تلقائياً وسحرياً إلى **5 مساءً (05:00 م)**!

---

### 🚨 Root Cause 2: Double Time Normalization Execution
- **العطل الفعلي:** يُستدعى `TimeNormalizer.normalize()` مرتين متتاليتين على نفس النص:
  1. الاستدعاء الأول: في `BusinessEngine.ts` (السطر 107).
  2. الاستدعاء الثاني: في `types.ts` داخل `validateBookingData()` (السطر 216).
- **التشخيص الجنائي:** المرة الأولى تُقحم التاريخ النصي `"السبت (25 يوليو) 10 م"`. المرة الثانية تمرر السلسلة المقحمة إلى `TimeNormalizer` مرة أخرى، مما يُفعل عطل `Day-of-Month Digit Corruption` ويلتقط رقم 25 كـ 5 مساءً!

---

### 🚨 Root Cause 3: Disconnect Between Offered Slots & Time Normalizer Context
- **العطل الفعلي:** `TimeNormalizer.normalize()` يعالج الوقت في معزل كامل عن قائمة السلوتات المتاحة الفعالة (`availableSlots`).
- **التشخيص الجنائي:** عند عرض خيارات مثل `09:00, 09:30, 10:00` في الفترة المسائية، وإدخال العميل لرقم `"9"`، يقوم `TimeNormalizer` بافتراض صباحي افتراضي `09:00 ص` بدون الاطلاع على السلوتات المعروضة `09:00 م` في عيادة التجميل.

---

### 🚨 Root Cause 4: International Country Restrictor in `types.ts`
- **العطل الفعلي:** في البيئة الإنتاجية (`process.env.NODE_ENV === "production"`)، تقوم `validateBookingData` بفحص دولة الرقم عبر `parsePhoneNumberFromString(phone)`.
- **التشخيص الجنائي:** الأرقام الدولية القادمة من مصر (`+20...`) أو الإمارات (`+971...`) تفشل في مطابقة قائمة `allowedCountries` الخاصة بالعيادة (`SA`)، مما يرفع `phoneRestricted = true` ويُصدر رسالة *"الرجاء تزويدنا برقم تواصل صحيح..."*.

---

## 🏛️ 3. Architecture Master Plan for Time Pipeline

تعتمد البنية المستقبلية للوقت على المبادئ المعمارية الحازمة التالية:

1. **مبدأ Single Execution:** يُمنع حظراً باتاً استدعاء `TimeNormalizer.normalize()` أكثر من مرة واحدة لكل طلب.
2. **مبدأ Offered Slots as Context Source of Truth:** عند وجود قائمة سلوتات معروضة `availableSlots` من `BookingService`، تُمرر كـ Context إلى `TimeNormalizer` أو حارس المطابقة لحل الأرقام المجردة (`9`, `10`, `12`) مباشرة إلى السلوت المتاح المقابل.
3. **مبدأ Date-Part Isolation:** يُفصل التاريخ المكتوب عن الوقت العددي قبل تشغيل التعبير النمطي، لمنع التقاط أرقام اليوم والشهر (مثل `25` أو `12`) كأرقام ساعات.
