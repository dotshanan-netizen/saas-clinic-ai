# 📐 Canonical Time Slot Contract (عقد تنسيق المواعيد في Clinova)

## 📌 الهدف (Purpose)
إرساء عقد موحد ونهائي (Canonical Integration Contract) لتمثيل ومقارنة صيغ المواعيد (Time Slots) بين كافة طبقات النظام (`TimeNormalizer` ➔ `BusinessEngine` ➔ `BookingService` ➔ `Database`) مع الالتزام التام بمبدأ **Single Responsibility Principle**.

---

## 🏛️ 1. مواصفات العقد الموحد (Canonical Format Specification)

يتألف العقد الموحد لأي موعد داخل Clinova من **بنية هيكلية مجردة** (Structured Object) تُستخدم للمقارنة والمطابقة، بجانب **تمثيل للعرض** (Display String):

```typescript
export interface CanonicalTimeSlot {
  isoDate: string | null;   // e.g. "2026-07-26" (تاريخ ISO الموحد للنظام)
  timeStr: string;          // e.g. "10:00 م" (الوقت بنسق قياسي)
  dayName: string | null;   // e.g. "الأحد"
  display: string;          // e.g. "الأحد (26 يوليو) 10:00 م" (نص للعرض على العميل فقط)
}
```

---

## 🔄 2. الفصل النظيف للمسؤوليات (Clean Separation of Responsibilities)

```text
TimeNormalizer
    ↓ (نص اللغة الطبيعية ➔ وقت مجرد/تاريخ مجرد)
BusinessEngine
    ↓ (تفسير السياق وإكمال التاريخ المقصود وتشكيل Canonical)
BookingService
    ↓ (مطابقة المواعيد بناءً على isoDate + timeStr الفعليين وليس نص العرض)
```

### 1. طبقة التقييس النصي (`TimeNormalizer`)
- **المسؤولية الوحيدة:** تحويل اللغة الطبيعية إلى تمثيل زمني مجرد (Pure Parsing).
- **الحدود:** لا تتدخل إطلاقاً في قاعدة البيانات، ولا تعرف جدول المواعيد، ولا تملأ تواريخ افتراضية بناءً على توفر العيادة.
- **المخرج:** تُرجع التعبير الزمني المحلل (سواء كان وقتاً مجرداً `"10:00 م"` أو تاريخاً معيناً).

### 2. محرك الأعمال والقواعد (`BusinessEngine`)
- **المسؤولية:** تفسير المعنى ضمن سياق المحادثة (Contextual Resolution).
- **الدور:** إذا ورد وقت مجرد (مثل `"10:00 م"`)، يستعين `BusinessEngine` بسياق المحادثة أو اليوم المستهدف (مثل "اليوم" أو الموعد القادم) لربطه بتاريخ ISO محدد (`isoDate`) وتشكيل الـ `CanonicalTimeSlot` الكامل.

### 3. طبقة الجدولة والمواعيد (`BookingService`)
- **المسؤولية:** إدارة واسترجاع المواعيد الفعالة والمتاحة.
- **المطابقة:** تتم المقارنة الداخلية برمجياً بواسطة **المكونات الهيكلية (`isoDate` + `timeStr`)** بدلاً من الاعتماد المباشر على نص العرض `display` عبر `Array.includes()`.

---

## 🔒 3. الضمانة المعمارية (Architectural Integrity Guarantee)
تضمن هذه الهيكلية استقلالية كل طبقة، وتسهل كتابة اختبارات وحدات منفصلة (Isolated Unit Tests)، وتمنع انكسار مسارات الحجز عند تغيير صياغات أو تنسيقات العرض للمستخدم النهائي.
