# 🛡️ Forensic Investigation Protocol (FORENSIC_INVESTIGATION_PROTOCOL.md)

## 📌 Executive Summary & Purpose
هذا البروتوكول هو **الدستور المعماري الإجباري (Mandatory Engineering Protocol)** لمعالجة أي ملاحظة ميدانية أو خلل برمجي في منصة Clinova أثناء مرحلة الـ Pilot. يُحظر بموجب هذا الدستور حظراً باتاً كتابة أي سطر كود أو إصلاح موصلي بعد القراءة الأولى أو عند ظهور الأعراض الأوليّة.

```text
[الطور الأول: التحقيق الجنائي الشامل - يُحظر تعديل الكود]
Runtime Trace ➔ End-to-End Lineage ➔ Decision Points ➔ Forensic Audit Report
                                ↓ (موافقة معمارية)
[الطور الثاني: الإصلاح الشامل المنفرد والتأكيد]
Single Master Fix ➔ Automated Regression Test Suite ➔ Verification & Closure
```

---

## 🔒 1. القواعد الثمانية الحاكمة (The 8 Mandatory Rules)

1. **القاعدة الأولى (التجميد الفوري للكود - Code Freeze First):** عند رصد أي ملاحظة أو عطل، يُمنع تعديل أي ملف كود إطلاقاً قبل إتمام الطور الأول الشامل وإصدار التقرير الجنائي.
2. **القاعدة الثانية (السؤال البنيوي الأول - Multi-Component Lineage Question):** لا يكون السؤال الأول "أين الكود؟" بل "كم مكوناً (Component) مرت به هذه المعلومة في كامل مسار التشغيل؟".
3. **القاعدة الثالثة (التتبع الكامل - Full End-to-End Runtime Trace):** تتبع مسار البيانات عبر كافة الطبقات الثماني:
   ```text
   WhatsApp Meta Webhook ➔ AI Extraction ➔ Conversation Engine ➔ Business Engine ➔ Validation ➔ Time Normalizer ➔ Booking Engine ➔ Prisma Database
   ```
4. **القاعدة الرابعة (تحديد نقاط التحويل والقرار - Transformation & Decision Mapping):** توثيق كل دالة تقوم بتطبيع، تحويل، تنقية، أو إصدار قرار على البيانات في كامل المسار.
5. **القاعدة الخامسة (استكشاف الجذور المتعددة - Multi-Root Cause Discovery):** البحث عن كافة الأسباب البنيوية المتظافرة معاً وليس السبب الظاهري الأول فقط.
6. **القاعدة السادسة (التوثيق المعماري الجنائي - Canonical Forensic Audit Report):** كتابة وتثبيت مستند معماري جنائي رسمي يشرح المسار كاملاً ومكامين الخلل قبل أي تعديل.
7. **القاعدة السابعة (الإصلاح الشامل المنفرد - Single Master Fix):** تنفذ جميع التعديلات في جولة إصلاح واحدة شاملة ومأهولة بناءً على فهم كامل لمسار النظام.
8. **القاعدة الثامنة (اختبار التراجع المؤتمت الإجباري - Mandatory Regression Suite):** لا تُغلق أي قضية إلا بعد وجود اختبار مؤتمت يضمن عدم عودتها نهائياً.

---

## 📋 2. هيكل التقرير الجنائي المعماري الإجباري (Mandatory Audit Template)

كل تحقيق جنائي يجب أن ينتج تقريراً بالهيكل التالي:

```markdown
# 🔍 [Audit Title] (FORENSIC_AUDIT_[NAME].md)

## 🗺️ 1. End-to-End Execution Sequence Map
- رسم تسلسل البيانات وتدفقها عبر جميع المكونات الثمانية.

## 🔬 2. Forensic Discovery of Root Causes
- Root Cause 1: [السبب البنيوي الأول]
- Root Cause 2: [السبب البنيوي الثاني]
- Root Cause N: [الأسباب المتظافرة]

## 🏛️ 3. Master Architecture Rules
- المبادئ المعمارية الحازمة لإعادة بناء المسار.

## 🧪 4. Regression Verification Plan
- أسماء ووصف اختبارات التراجع المؤتمتة المطلوبة.
```

---

## 🏆 3. النتيجة المعمارية المتوقعة
يضمن هذا البروتوكول إنهاء دورات "جرّب ➔ أصلح ➔ جرّب ➔ أصلح" المتكررة، وتحويل العملية الهندسية في Clinova إلى **حوكمة معمارية رصينة ومستقرة (Quality Governance)** تناسب منصات الـ SaaS الاحترافية.
