# Stable Baseline Protection: docs/BASELINE.md

* **تاريخ تثبيت الـ Baseline:** 2026-07-23  
* **الـ Git Tag المعتمد:** `pilot-stable`  

---

## 1. مكونات الـ Core Pipeline الأساسي
يمثل هذا المخطط الهيكل الأساسي لتدفق المحادثة الحية للبوت، وهو محمي تماماً من التعديل العشوائي:

```
WhatsApp App (Client Device)
           ↓
Meta Cloud API Webhook
           ↓
POST /api/webhook/whatsapp (Synchronous Processing)
           ↓
ConversationEngine.processMessage()
           ↓
Prisma DB (Save Message & Context)
           ↓
BusinessEngine (Intent Classification & Rules)
           ↓
AI Generation (Gemini/OpenAI Response)
           ↓
Meta Graph Messages API (Send)
           ↓
WhatsApp App (Client Device Received)
```

---

## 2. قواعد الحماية (Stable Baseline Protection Rules)
* **ممنوع التعديل المباشر:** يمنع منعاً باتاً التعديل على ملفات الـ Core Pipeline مباشرةً في الـ `main` branch.
* **التطوير المنفصل:** أي ميزة جديدة، تحسين (Optimization)، أو تحسين هيكلي (Refactoring) يجب أن يتم في Branch مستقلة تماماً.
* **بروتوكول الدمج (Merge Protocol):** لا يتم دمج أي كود مع الـ `main` إلا بعد:
  1. مراجعة الكود بدقة (Code Review).
  2. التأكد من نجاح الـ Build بالكامل.
  3. نجاح اختبار الانحدار الإلزامي (Regression Test) بنسبة 100%.
  4. موافقة إدارة المشروع المباشرة.

---

## 3. اختبار الانحدار الإلزامي (Mandatory Regression Test)
قبل الموافقة على أي دمج، يجب تنفيذ هذا الاختبار يدوياً وتوثيقه:
1. إرسال رسالة "السلام عليكم" أو "هاي" من هاتف حقيقي للبوت.
2. التأكد من استقبال الـ Webhook بنجاح.
3. التحقق من حفظ الرسالة في قاعدة البيانات.
4. التأكد من بدء تشغيل الـ Business Engine.
5. التحقق من توليد رد صحيح عبر الذكاء الاصطناعي.
6. التحقق من وصول الرد لهاتف العميل الحقيقي عبر WhatsApp.
7. التأكد من ظهور المحادثة محدثة بالكامل داخل الـ Dashboard.

---

## 4. الملفات الحساسة (Sensitive Files - Do Not Touch)
تعتبر هذه الملفات هي العمود الفقري للـ Baseline الحالي، ويُمنع تعديلها إلا بموافقة مباشرة:
* `src/app/api/webhook/whatsapp/route.ts` (الـ Webhook وإدارة التزامن)
* `src/lib/domain/ConversationEngine.ts` (محرر وسير المحادثة والـ Context)
* `src/lib/domain/BusinessEngine.ts` (موزع العمليات والتحقق من الحجوزات)
* `src/lib/auth.ts` (تشفير وإدارة الجلسات)
* `src/lib/meta/MetaGraphClient.ts` (موصل إرسال واستقبال البيانات مع Meta)
