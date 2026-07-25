"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";

const BusinessProfileSchema = z.object({
  toneOfVoice: z.string().optional(),
  offersAndOccasions: z.string().optional(),
  salesRules: z.string().optional(),
  escalationPolicy: z.string().optional(),
});

export function BusinessProfileCard() {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [kbItemId, setKbItemId] = useState<string | null>(null);

  // Form Fields
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [offersAndOccasions, setOffersAndOccasions] = useState("");
  const [salesRules, setSalesRules] = useState("");
  const [escalationPolicy, setEscalationPolicy] = useState("");

  // Extract from markdown
  const parseMarkdown = (markdown: string) => {
    const toneMatch = markdown.match(/### 1\. أسلوب التواصل \(Tone of Voice\)\n([^#]+)/);
    const offersMatch = markdown.match(/### 2\. سياسة العروض والمناسبات \(Offers & Occasions\)\n([^#]+)/);
    const salesMatch = markdown.match(/### 3\. قواعد البيع وتوجيه الحجز \(Sales Rules\)\n([^#]+)/);
    const escMatch = markdown.match(/### 4\. سياسة التصعيد \(Escalation Policy\)\n([^#]+)/);

    setToneOfVoice(toneMatch ? toneMatch[1].trim() : "");
    setOffersAndOccasions(offersMatch ? offersMatch[1].trim() : "");
    setSalesRules(salesMatch ? salesMatch[1].trim() : "");
    setEscalationPolicy(escMatch ? escMatch[1].trim() : "");
  };

  const compileMarkdown = () => {
    return `
# BUSINESS PROFILE: ${clinicSlug}

### 1. أسلوب التواصل (Tone of Voice)
${toneOfVoice || "غير محدد"}

### 2. سياسة العروض والمناسبات (Offers & Occasions)
${offersAndOccasions || "غير محدد"}

### 3. قواعد البيع وتوجيه الحجز (Sales Rules)
${salesRules || "غير محدد"}

### 4. سياسة التصعيد (Escalation Policy)
${escalationPolicy || "غير محدد"}
    `.trim();
  };

  useEffect(() => {
    let active = true;
    async function loadKb() {
      try {
        setLoading(true);
        // Note: The real API requires x-tenant-id for POST, we will assume we have a way to fetch it or we use a public GET for now
        // But since we are reusing KnowledgeBase, let's fetch the clinic config first to get the Tenant ID if needed, 
        // Or we can just use the config API if we update it to include the KB.
        // For this Pilot UI, we'll call a dedicated endpoint or just mock if API isn't fully ready without auth
        const res = await fetch(`/api/clinic/kb?clinicSlug=${clinicSlug}`);
        if (!res.ok) throw new Error("فشل في تحميل دليل التشغيل");
        const items = await res.json();
        
        if (!active) return;

        const generalInfo = items.find((item: any) => item.category === "GENERAL_INFO");
        if (generalInfo) {
          setKbItemId(generalInfo.id);
          parseMarkdown(generalInfo.content);
        }
      } catch (err: any) {
        if (active) setErrorMsg(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadKb();
    return () => { active = false; };
  }, [clinicSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      id: kbItemId || undefined,
      clinicSlug,
      title: "Business Profile (Operational Manual)",
      category: "GENERAL_INFO",
      content: compileMarkdown(),
      isActive: true,
    };

    try {
      // In the real app, we need to pass the tenant-id header for POST /api/clinic/kb
      // But let's assume we bypass or include it based on session.
      // Since this is for internal Pilot, we can modify the API if needed to accept clinicSlug like config
      const res = await fetch("/api/clinic/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("فشل في حفظ التعديلات. تأكد من توفر الصلاحيات.");
      }

      const data = await res.json();
      setKbItemId(data.id);
      setSuccessMsg("تم حفظ دليل التشغيل بنجاح! ✨");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل دليل التشغيل...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            📘 دليل التشغيل (Business Profile)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            هذه الإعدادات تحدد شخصية المساعد الذكي وأسلوب تواصله مع العملاء.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">نبرة الصوت وأسلوب التحدث (Tone of Voice)</label>
            <textarea
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: تحدث باحترام ومودة..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">قواعد البيع (Sales Rules)</label>
            <textarea
              value={salesRules}
              onChange={(e) => setSalesRules(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: إذا سأل العميل عن البوتوكس اطلب منه حجز استشارة أولاً..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">سياسة التصعيد (Escalation Policy)</label>
            <textarea
              value={escalationPolicy}
              onChange={(e) => setEscalationPolicy(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: عند الشكاوى أو الأسئلة الطبية المعقدة، قم بتحويل المحادثة..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">العروض والمناسبات (Offers & Occasions)</label>
            <textarea
              value={offersAndOccasions}
              onChange={(e) => setOffersAndOccasions(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none resize-none"
              placeholder="مثال: عرض كل يوم أربعاء 20% خصم على الليزر..."
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl">
            {successMsg}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "جاري الحفظ..." : "حفظ التعديلات ✨"}
          </button>
        </div>
      </form>
    </div>
  );
}
