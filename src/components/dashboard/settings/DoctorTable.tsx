/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { DoctorForm } from "./DoctorForm";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  imageUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
  branches: { branchId: string }[];
  services: { serviceId: string }[];
}

interface Branch {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
}

export function DoctorTable() {
  const clinicSlug = "rival-clinic";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Maps to resolve relation IDs to names
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  const [serviceMap, setServiceMap] = useState<Map<string, string>>(new Map());

  // Modal State
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Fetch branches, services and doctors list
  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Fetch all three datasets
      const [branchesRes, servicesRes, doctorsRes] = await Promise.all([
        fetch(`/api/clinic/branches?clinicSlug=${clinicSlug}`),
        fetch(`/api/clinic/services?clinicSlug=${clinicSlug}`),
        fetch(`/api/clinic/doctors?clinicSlug=${clinicSlug}`),
      ]);

      if (!branchesRes.ok || !servicesRes.ok || !doctorsRes.ok) {
        throw new Error("فشل في تحميل بيانات الأطباء أو الفروع أو الخدمات");
      }

      const branchesData: Branch[] = await branchesRes.json();
      const servicesData: Service[] = await servicesRes.json();
      const doctorsData: Doctor[] = await doctorsRes.json();

      // Build maps
      const bMap = new Map<string, string>();
      branchesData.forEach(b => bMap.set(b.id, b.name));
      setBranchMap(bMap);

      const sMap = new Map<string, string>();
      servicesData.forEach(s => sMap.set(s.id, s.name));
      setServiceMap(sMap);

      setDoctors(doctorsData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddNew = () => {
    setEditingDoctor(null);
    setIsFormOpen(true);
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setIsFormOpen(true);
  };

  if (loading && doctors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل قائمة الأطباء...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Doctors List Card */}
      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              🧑‍⚕️ الطاقم الطبي والأطباء
            </h2>
            <p className="text-xs text-zinc-400 mt-1">إدارة الأطباء، التخصصات، وربطهم بالفروع والخدمات الطبية</p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            ➕ إضافة طبيب جديد
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {doctors.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-xs">لا يوجد أطباء مسجلين حالياً لهذه العيادة.</p>
            <button
              onClick={handleAddNew}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              أنشئ أول طبيب الآن 🧑‍⚕️
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 text-right font-semibold">الطبيب</th>
                  <th className="pb-3 text-right font-semibold">التخصص</th>
                  <th className="pb-3 text-right font-semibold">الفروع المرتبطة</th>
                  <th className="pb-3 text-right font-semibold">الخدمات الطبية</th>
                  <th className="pb-3 text-center font-semibold">الحالة</th>
                  <th className="pb-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {doctors.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-850/10 text-zinc-200">
                    <td className="py-3.5 font-bold text-zinc-100 flex items-center gap-3">
                      {d.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.imageUrl}
                          alt={d.name}
                          className="w-8 h-8 rounded-full border border-zinc-800 object-cover"
                          onError={(e) => {
                            // Fallback if image fails to load
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-750 flex items-center justify-center font-bold text-xs text-zinc-400">
                          {d.name.replace("د. ", "").substring(0, 2)}
                        </div>
                      )}
                      <span>{d.name}</span>
                    </td>
                    <td className="py-3.5">{d.specialty}</td>
                    <td className="py-3.5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {d.branches.length === 0 ? (
                          <span className="text-zinc-500 text-[10px]">غير مرتبط بفروع</span>
                        ) : (
                          d.branches.map(br => (
                            <span key={br.branchId} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px]">
                              {branchMap.get(br.branchId) || "تحميل..."}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {d.services.length === 0 ? (
                          <span className="text-zinc-500 text-[10px]">غير مرتبط بخدمات</span>
                        ) : (
                          d.services.map(ser => (
                            <span key={ser.serviceId} className="px-2 py-0.5 bg-zinc-800/80 text-zinc-300 rounded text-[10px] border border-zinc-750">
                              {serviceMap.get(ser.serviceId) || "تحميل..."}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${d.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
                        {d.status === "ACTIVE" ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => handleEdit(d)}
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
        <DoctorForm
          doctor={editingDoctor}
          onClose={() => setIsFormOpen(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
export default DoctorTable;
