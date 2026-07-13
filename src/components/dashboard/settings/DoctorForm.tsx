/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";

interface Branch {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

interface Service {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  imageUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
  branches: { branchId: string }[];
  services: { serviceId: string }[];
}

interface DoctorFormProps {
  doctor: Doctor | null; // Null means Add New Doctor
  onClose: () => void;
  onSaved: () => void;
}

export function DoctorForm({ doctor, onClose, onSaved }: DoctorFormProps) {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic Lists from Backend
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loadingLists, setLoadingLists] = useState<boolean>(true);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Fetch branches and services on mount
  useEffect(() => {
    let active = true;
    async function loadLists() {
      try {
        setLoadingLists(true);
        const [branchesRes, servicesRes] = await Promise.all([
          fetch(`/api/clinic/branches?clinicSlug=${clinicSlug}`),
          fetch(`/api/clinic/services?clinicSlug=${clinicSlug}`),
        ]);

        if (!branchesRes.ok || !servicesRes.ok) {
          throw new Error("فشل في تحميل خيارات الفروع أو الخدمات");
        }

        const branchesData: Branch[] = await branchesRes.json();
        const servicesData: Service[] = await servicesRes.json();

        if (!active) return;

        // Display only active branches/services for new selections,
        // but keep inactive ones if they are already linked to this doctor
        setAvailableBranches(branchesData.filter(b => b.status === "ACTIVE"));
        setAvailableServices(servicesData.filter(s => s.status === "ACTIVE"));
      } catch (err: unknown) {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : "فشل في تحميل القوائم");
      } finally {
        if (active) {
          setLoadingLists(false);
        }
      }
    }

    loadLists();
    return () => {
      active = false;
    };
  }, []);

  // Populate form if editing
  useEffect(() => {
    if (doctor) {
      setName(doctor.name);
      setSpecialty(doctor.specialty);
      setImageUrl(doctor.imageUrl || "");
      setStatus(doctor.status);
      setSelectedBranches(doctor.branches.map(b => b.branchId));
      setSelectedServices(doctor.services.map(s => s.serviceId));
    } else {
      setName("");
      setSpecialty("");
      setImageUrl("");
      setStatus("ACTIVE");
      setSelectedBranches([]);
      setSelectedServices([]);
    }
  }, [doctor]);

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
    );
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);

    // Basic Validation
    if (name.trim().length < 3) {
      setErrorMsg("يجب أن يكون اسم الطبيب 3 حروف على الأقل");
      setSaving(false);
      return;
    }
    if (specialty.trim().length < 3) {
      setErrorMsg("يجب كتابة تخصص الطبيب بالتفصيل (3 حروف على الأقل)");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        clinicSlug,
        id: doctor?.id || undefined,
        name,
        specialty,
        imageUrl: imageUrl || undefined,
        status,
        branchIds: selectedBranches,
        serviceIds: selectedServices,
      };

      const res = await fetch("/api/clinic/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل في حفظ بيانات الطبيب");
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6 flex-shrink-0">
          <h3 className="text-md font-bold text-zinc-100 flex items-center gap-2">
            {doctor ? "✏️ تعديل بيانات الطبيب والعلاقات" : "➕ إضافة طبيب جديد وطاقم"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
          {loadingLists ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs text-zinc-400">جاري تحميل البيانات الأساسية...</p>
            </div>
          ) : (
            <>
              {/* Section 1: General Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 border-r-2 border-indigo-500 pr-2">المعلومات العامة</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">اسم الطبيب *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                      placeholder="مثال: د. نجلاء، د. أحمد"
                      required
                    />
                  </div>

                  {/* Specialty */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">التخصص الطبي *</label>
                    <input
                      type="text"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                      placeholder="مثال: أخصائية جلدية وتجميل"
                      required
                    />
                  </div>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">رابط صورة الطبيب (اختياري)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl text-zinc-200 text-sm focus:outline-none transition-colors"
                    placeholder="https://example.com/ryan.png"
                  />
                </div>
              </div>

              {/* Section 2: Available Branches */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 border-r-2 border-indigo-500 pr-2">الفروع المتاحة للعمل</h4>
                {availableBranches.length === 0 ? (
                  <p className="text-[10px] text-zinc-500">لا توجد فروع نشطة حالياً. يرجى تفعيل الفروع أولاً.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableBranches.map(b => (
                      <label
                        key={b.id}
                        className={`flex items-center gap-3 p-3 bg-zinc-950 border rounded-xl cursor-pointer transition-all hover:bg-zinc-900/60 ${selectedBranches.includes(b.id) ? "border-indigo-500 bg-indigo-950/10" : "border-zinc-800"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(b.id)}
                          onChange={() => handleBranchToggle(b.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-900 border-zinc-800 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-200 font-medium">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Available Services */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 border-r-2 border-indigo-500 pr-2">الخدمات والعلاجات المقدمة</h4>
                {availableServices.length === 0 ? (
                  <p className="text-[10px] text-zinc-500">لا توجد خدمات نشطة حالياً. يرجى إضافة خدمات أولاً.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableServices.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-3 bg-zinc-950 border rounded-xl cursor-pointer transition-all hover:bg-zinc-900/60 ${selectedServices.includes(s.id) ? "border-indigo-500 bg-indigo-950/10" : "border-zinc-800"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(s.id)}
                          onChange={() => handleServiceToggle(s.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-900 border-zinc-800 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-200 font-medium">{s.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: Status Selector */}
              {doctor && (
                <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-300">حالة الطبيب</span>
                    <span className="block text-[10px] text-zinc-500 mt-1">تعطيل الطبيب يمنع العملاء من حجز مواعيد جديدة معه</span>
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">نشط</option>
                    <option value="INACTIVE">معطل</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl flex items-center gap-2 flex-shrink-0">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Buttons Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || loadingLists}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "جاري الحفظ..." : "حفظ الطبيب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default DoctorForm;
