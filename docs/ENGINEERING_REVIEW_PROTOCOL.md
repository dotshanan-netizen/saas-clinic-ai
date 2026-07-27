# Clinova External Engineering Review Protocol (Pre-Pilot)

**Version**: 1.0  
**Effective Date**: 26 Jul 2026  
**Scope**: Pre-Pilot Phase (Feature Freeze)  
**Author**: Engineering Team  

---

## الهدف (Objective)

التحقق المنظم من موثوقية جزء محدد من النظام دون توسيع النطاق أو إعادة فتح الـ Audit الشامل.

**في هذه المرحلة:**
- لا نبحث عن تحسينات معمارية
- لا نبحث عن ميزات جديدة
- لا نتوسع خارج Scope المحدد
- نركز فقط على: **هل هذا المخطر يهدد الـ Pilot؟**

---

## قواعد ثابتة (Fixed Rules)

كل مراجعة تكون:

- ✋ **Read Only** — لا تعديلات ملفات
- ✋ **Scope-Locked** — نطاق محدد مسبقاً
- ✋ **No Refactoring** — لا إعادة هيكلة
- ✋ **No Feature Suggestions** — لا اقتراحات خارج الموثوقية
- ✋ **No Architecture Changes** — لا تعديلات تصميم النظام
- ✋ **No Scope Expansion** — لا توسيع النطاق
- ✋ **Evidence-Based Only** — أدلة فقط، بدون تكهنات

---

## ما يتم الإبلاغ عنه (Report Only)

كل Finding يجب أن يكون واحداً من:

1. **Bug** — خلل متكرر قابل للإعادة
2. **Logic Error** — خطأ في المنطق البرمجي
3. **Runtime Failure** — فشل أثناء التشغيل
4. **Security Issue** — مشكلة أمان قابلة للاستغلال
5. **Reliability Problem** — مشكلة في الموثوقية/الاستقرار
6. **Data Integrity Issue** — فقدان أو تلف بيانات
7. **Edge Case** — حالة حدية غير معالجة

### ما لا يتم الإبلاغ عنه:

- ❌ "هذا يمكن أن يكون أفضل"
- ❌ "الكود غير نظيف"
- ❌ "يجب استخدام Pattern مختلف"
- ❌ "هذا لا يتبع Best Practices"
- ❌ "تحسينات الأداء" (إلا إذا كانت تهدد الـ Pilot)

---

## نموذج التقرير (Report Template)

كل Finding يجب أن يحتوي على:

```
# Finding: [العنوان المختصر]

## الشدة (Severity)
- 🔴 Critical (يوقف الـ Pilot)
- 🟠 High (يهدد الـ Pilot)
- 🟡 Medium (قد يسبب مشاكل)
- 🔵 Low (تأثير محدود)

## الثقة (Confidence)
- ✅ Proven (إعادة إنتاج مؤكدة)
- 🟢 Strong (أدلة واضحة)
- 🟡 Suspected (احتمال عالي)
- ❓ Unknown (فرضية تحتاج تحقق)

## الدليل (Evidence)
- الملف والسطر
- السياق المحدد
- سبب المشكلة
- كيفية تكرارها (إن أمكن)

## الملف (File)
`src/path/to/file.ts:line`

## الدالة (Function)
`functionName()`

## التأثير على الإنتاج (Production Impact)
- وصف الأعراض الفعلية
- متى تحدث؟
- كم مرة؟
- ما النتيجة؟

## خطوات الإعادة (Reproduction Steps)
1. فعل أ
2. ثم ب
3. النتيجة: ج

## هل يوقف الـ Pilot؟ (Pilot Blocker)
- ✅ **Yes** — يجب إصلاحه قبل الـ Pilot
- ❌ **No** — لا يؤثر على الـ Pilot
- ❓ **Unknown** — يحتاج تحقق إضافي
```

---

## المراجعات المخططة (Planned Reviews)

### 1️⃣ Runtime Pipeline Review

**النطاق**
- WhatsApp Webhook ingestion
- Message queue processing
- Worker execution
- Reply delivery
- Error handling and retries

**السؤال الوحيد**
> هل يمكن أن تُضيع رسالة، أو تتكرر، أو يصل رد غير صحيح؟

**Stop Rule**: بعد الانتهاء، اسأل: هل يوجد Pilot Blocker؟

---

### 2️⃣ Booking Engine Review

**النطاق**
- Booking creation
- Availability checking
- Slot reservation
- Cancellation
- Rescheduling
- Transaction isolation

**السؤال الوحيد**
> هل يمكن إنشاء أو تعديل حجز بطريقة غير صحيحة؟

**Stop Rule**: بعد الانتهاء، اسأل: هل يوجد Pilot Blocker؟

---

### 3️⃣ AI Integration Review

**النطاق**
- System prompt
- Tool calls (booking, scheduling, etc.)
- Input validation
- Retry logic
- Fallback behavior
- Error handling

**السؤال الوحيد**
> هل يمكن للـ AI تجاوز قواعد Business Engine أو تنفيذ سلوك غير مقصود؟

**Stop Rule**: بعد الانتهاء، اسأل: هل يوجد Pilot Blocker؟

---

### 4️⃣ Database Integrity Review

**النطاق**
- Prisma schema
- Foreign key constraints
- Unique constraints
- Migrations
- Data relations
- Transaction handling

**السؤال الوحيد**
> هل يمكن فقدان البيانات أو كسر السلامة؟

**Stop Rule**: بعد الانتهاء، اسأل: هل يوجد Pilot Blocker؟

---

### 5️⃣ Frontend State Review

**النطاق**
- Route logic
- Form validation
- API error handling
- Loading states
- Error states
- Edge case UI behavior

**السؤال الوحيد**
> هل يمكن أن تسمح الواجهة بسلوك خاطئ أو تعطي المستخدم انطباعاً مضللاً؟

**Stop Rule**: بعد الانتهاء، اسأل: هل يوجد Pilot Blocker؟

---

## Stop Rule (القاعدة النهائية)

بعد **كل مراجعة**، إجابة واحدة فقط:

### ✅ **Yes — Pilot Blocker Found**
- نُوثق الـ Finding بالكامل
- ننشئ Issue/Task لإصلاحه
- **نُوقف الـ Pilot إلى أن يتم الإصلاح**

### ❌ **No — No Pilot Blocker**
- المراجعة Passed
- نوثق النتيجة: "تم التحقق، لا توجد مخاطر"
- نستمر في المرحلة التالية

### ❓ **Unknown — Needs Further Evidence**
- توثيق الفرضية
- إضافة إلى Watch List
- **لا يوقف الـ Pilot** (إلا إذا كان الخطر حرجاً)
- نراقبها بعد الـ Pilot launch

---

## متى نستخدم هذا البروتوكول

| الحالة | استخدام البروتوكول؟ |
|--------|------------------|
| اكتشاف bug مرتبط بـ Pilot | ✅ نعم |
| التحقق من جزء محدد من النظام | ✅ نعم |
| Feature Freeze + اقتراب الـ Pilot | ✅ نعم |
| طلب تحسين معماري عام | ❌ لا |
| Refactoring واسع | ❌ لا |
| بعد الـ Pilot (وضع عادي) | ❌ لا (استخدم processes عادية) |

---

## مثال تطبيق (Applied Example)

**المراجعة**: Phone Validation Review  
**المشكلة المحددة**: Regex fallback يقبل أرقام دول غير مدعومة

**النموذج**:
```
# Finding: Phone Regex Fallback Accepts Invalid Country Codes

## الشدة
🔴 Critical (عملاء خارج GCC سيرسلون أرقاماً غير صحيحة)

## الثقة
✅ Proven (3 اختبارات وحدة تفشل، إعادة الإنتاج مؤكدة)

## الدليل
- File: src/lib/domain/types.ts:52–113
- Function: extractSaudiPhone()
- السبب: Regex `/^\+?[1-9]\d{8,14}$/` يقبل أي country code من 1–9
- الإثبات: +99999999999, +555666777888 مقبولة ولكن غير صحيحة

## التأثير على الإنتاج
- ستُخزن أرقام خاطئة في DB
- WhatsApp API سيرفضها عند الإرسال
- عملاء يحصلون على "رقم غير صحيح" بدون سبب واضح

## خطوات الإعادة
1. `extractSaudiPhone("+99999999999", "SA")`
2. النتيجة: "+99999999999" (يجب أن تكون null)

## هل يوقف الـ Pilot؟
✅ **Yes** — أرقام خاطئة في DB تعني عطل في خط الرسائل

---

**الحل المطبق**: 
- ✅ إزالة regex fallback
- ✅ إضافة country whitelist ["SA", "AE", "QA", "KW", "BH", "OM"]
- ✅ اختبارات: 10/10 passing
- ✅ توثيق: بروتوكول Market Policy Enforcement
```

---

## الفوائد (Benefits)

1. **تقليل التكرار**: كل مراجعة لها حدود واضحة
2. **قابلية المقارنة**: نفس النموذج = نتائج قابلة للمراجعة
3. **عدم الانجراف**: لا نخرج عن الـ Scope المحدد
4. **وضوح المخاطر**: Pilot Blocker أم لا؟ واضح تماماً
5. **انضباط المرحلة**: Feature Freeze = لا تعديلات خارج الضرورة

---

## الالتزام (Commitment)

كل مراجعة تحت هذا البروتوكول:

- ✅ توثيق كامل
- ✅ أدلة فقط، بدون رأي
- ✅ إجابة واحدة نهائية: Blocker / Safe / Unknown
- ✅ حدود محددة (بدون توسع)
- ✅ قابلة للتتبع والمراجعة لاحقاً

---

**الحالة الحالية**: ✅ Approved and Active  
**المراجعات المكتملة**: 1 (Phone Validation)  
**المراجعات المتبقية**: 4 (Runtime, Booking, AI, DB, Frontend)
