/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { BranchForm } from "./BranchForm";
import { WorkingHoursEditor } from "./WorkingHoursEditor";

interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export function BranchTable() {
  const clinicSlug = process.env.NEXT_PUBLIC_DEFAULT_CLINIC || "rival-clinic";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal / Editor States
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [activeHoursBranch, setActiveHoursBranch] = useState<{ id: string; name: string } | null>(null);

  // Fetch branches
  const loadBranches = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/clinic/branches?clinicSlug=${clinicSlug}`);
      if (!res.ok) {
        throw new Error("فشل في تحميل قائمة الفروع");
      }
      const data = await res.json();
      setBranches(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleAddNew = () => {
    setEditingBranch(null);
    setIsFormOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsFormOpen(true);
  };

  const handleOpenHours = (branch: Branch) => {
    setActiveHoursBranch({ id: branch.id, name: branch.name });
  };

  if (loading && branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-zinc-400">جاري تحميل قائمة الفروع...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branches List Card */}
      <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              📍 فروع العيادة
            </h2>
            <p className="text-xs text-zinc-400 mt-1">إضافة وإدارة الفروع الجغرافية وتعديل ساعات عملها</p>
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            ➕ إضافة فرع جديد
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {branches.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-xs">لا يوجد فروع مسجلة حالياً لهذه العيادة.</p>
            <button
              onClick={handleAddNew}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              أنشئ أول فرع الآن 🚀
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 text-right font-semibold">الفرع</th>
                  <th className="pb-3 text-right font-semibold">المدينة</th>
                  <th className="pb-3 text-right font-semibold">العنوان</th>
                  <th className="pb-3 text-right font-semibold">الهاتف</th>
                  <th className="pb-3 text-center font-semibold">الحالة</th>
                  <th className="pb-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-850/10 text-zinc-200">
                    <td className="py-3.5 font-bold text-zinc-100">{b.name}</td>
                    <td className="py-3.5">{b.city}</td>
                    <td className="py-3.5 text-zinc-400 max-w-xs truncate">{b.address}</td>
                    <td className="py-3.5 text-zinc-400">{b.phone || "—"}</td>
                    <td className="py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${b.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
                        {b.status === "ACTIVE" ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(b)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors cursor-pointer"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleOpenHours(b)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 rounded-lg font-medium transition-colors cursor-pointer"
                        >
                          🕒 ساعات العمل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide down editor for Working Hours */}
      {activeHoursBranch && (
        <WorkingHoursEditor
          branchId={activeHoursBranch.id}
          branchName={activeHoursBranch.name}
          onClose={() => setActiveHoursBranch(null)}
        />
      )}

      {/* Modal Form for Add/Edit */}
      {isFormOpen && (
        <BranchForm
          branch={editingBranch}
          onClose={() => setIsFormOpen(false)}
          onSaved={loadBranches}
        />
      )}
    </div>
  );
}
export default BranchTable;
