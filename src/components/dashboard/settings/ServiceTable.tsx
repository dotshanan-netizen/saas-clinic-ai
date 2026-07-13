/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { ServiceForm } from "./ServiceForm";

interface Service {
  id: string;
  name: string;
  price: number;
  description: string | null;
  durationMinutes: number;
  status: "ACTIVE" | "INACTIVE";
}

export function ServiceTable() {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Fetch services
  const loadServices = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/clinic/services?clinicSlug=${clinicSlug}`);
      if (!res.ok) {
        throw new Error("فشل في تحميل قائمة الخدمات الطبية");
      }
      const data = await res.json();
      setServices(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleAddNew = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  if (loading && services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل قائمة الخدمات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Services List Card */}
      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              🩺 الخدمات العلاجية والتجميلية
            </h2>
            <p className="text-xs text-zinc-400 mt-1">إضافة وتعديل الخدمات الطبية، التسعير، والمدد الزمنية للجلسات</p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            ➕ إضافة خدمة جديدة
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {services.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-xs">لا يوجد خدمات علاجية مسجلة حالياً لهذه العيادة.</p>
            <button
              onClick={handleAddNew}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              أنشئ أول خدمة الآن 🩺
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 text-right font-semibold">الخدمة</th>
                  <th className="pb-3 text-right font-semibold">الوصف</th>
                  <th className="pb-3 text-center font-semibold">السعر (ريال)</th>
                  <th className="pb-3 text-center font-semibold">مدة الجلسة (دقيقة)</th>
                  <th className="pb-3 text-center font-semibold">الحالة</th>
                  <th className="pb-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-850/10 text-zinc-200">
                    <td className="py-3.5 font-bold text-zinc-100">{s.name}</td>
                    <td className="py-3.5 text-zinc-455 max-w-xs truncate">{s.description || "—"}</td>
                    <td className="py-3.5 text-center font-mono text-indigo-400 font-semibold">{s.price}</td>
                    <td className="py-3.5 text-center font-mono">{s.durationMinutes}</td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${s.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
                        {s.status === "ACTIVE" ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => handleEdit(s)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form for Add/Edit */}
      {isFormOpen && (
        <ServiceForm
          service={editingService}
          onClose={() => setIsFormOpen(false)}
          onSaved={loadServices}
        />
      )}
    </div>
  );
}
export default ServiceTable;
