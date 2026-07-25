"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClinicInfoStep } from "./components/ClinicInfoStep";
import { WhatsappAiStep } from "./components/WhatsappAiStep";
import { OperationsStep } from "./components/OperationsStep";
import { BusinessProfileStep } from "./components/BusinessProfileStep";
import { ReviewStep } from "./components/ReviewStep";

export interface WizardState {
  // Step 1: Clinic Info
  clinicName: string;
  clinicSlug: string;
  description: string;
  logoUrl: string;
  contactPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;

  // Step 2: WhatsApp & AI
  whatsappPhoneId: string;
  whatsappWabaId: string;
  whatsappToken: string;
  whatsappVerifyToken: string;
  isAiActive: boolean;

  // Step 3: Operations
  branches: Array<{ name: string; city: string; address: string; phone: string }>;
  services: Array<{ name: string; description: string; price: number; durationMinutes: number }>;
  doctors: Array<{ name: string; specialty: string; branchIndexes: number[]; serviceIndexes: number[] }>;

  // Step 4: Business Profile
  welcomeMessage: string;
  customPrompt: string;
  toneOfVoice: string;
  offersAndOccasions: string;
  salesRules: string;
  escalationPolicy: string;
}

const DEFAULT_STATE: WizardState = {
  clinicName: "",
  clinicSlug: "",
  description: "",
  logoUrl: "",
  contactPhone: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  whatsappPhoneId: "",
  whatsappWabaId: "",
  whatsappToken: "",
  whatsappVerifyToken: "",
  isAiActive: true,
  branches: [],
  services: [],
  doctors: [],
  welcomeMessage: "أهلاً بك 🌸 كيف يمكنني مساعدتك اليوم؟",
  customPrompt: "أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة بلباقة وسرعة.",
  toneOfVoice: "تحدث بلغة عربية فصحى مبسطة مع لمسات ودية.",
  offersAndOccasions: "",
  salesRules: "توجيه العميل دائماً لحجز استشارة قبل الأسعار النهائية للعمليات المعقدة.",
  escalationPolicy: "تحويل الحالات الغاضبة والاستشارات الطبية المعقدة إلى الموظف.",
};

const STEPS = [
  { id: 1, title: "العيادة", subtitle: "معلومات الأساسية" },
  { id: 2, title: "واتساب والذكاء", subtitle: "الربط التقني" },
  { id: 3, title: "العمليات", subtitle: "الفروع، الخدمات، الأطباء" },
  { id: 4, title: "دليل التشغيل", subtitle: "إعدادات البيع" },
  { id: 5, title: "المراجعة", subtitle: "الإطلاق" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("clinova_onboarding_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState({ ...DEFAULT_STATE, ...parsed });
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("clinova_onboarding_draft", JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 1));

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col" dir="rtl">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            C
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">Clinova Setup</h1>
            <p className="text-[10px] text-zinc-400">إعداد عيادة جديدة</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col md:flex-row gap-8">
        {/* Sidebar Stepper */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-24 space-y-2">
            {STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                    isActive ? "bg-indigo-500/10 border border-indigo-500/20" : "opacity-50"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      isActive
                        ? "bg-indigo-500 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                        : isPast
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-zinc-700 text-zinc-500"
                    }`}
                  >
                    {isPast ? "✓" : step.id}
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${isActive ? "text-indigo-400" : "text-zinc-300"}`}>
                      {step.title}
                    </h3>
                    <p className="text-[10px] text-zinc-500">{step.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Form Content */}
        <div className="flex-1 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl min-h-[500px] flex flex-col">
          <div className="flex-1">
            {currentStep === 1 && <ClinicInfoStep state={state} updateState={updateState} onNext={handleNext} />}
            {currentStep === 2 && <WhatsappAiStep state={state} updateState={updateState} onNext={handleNext} onPrev={handlePrev} />}
            {currentStep === 3 && <OperationsStep state={state} updateState={updateState} onNext={handleNext} onPrev={handlePrev} />}
            {currentStep === 4 && <BusinessProfileStep state={state} updateState={updateState} onNext={handleNext} onPrev={handlePrev} />}
            {currentStep === 5 && <ReviewStep state={state} onPrev={handlePrev} />}
          </div>
        </div>
      </main>
    </div>
  );
}
