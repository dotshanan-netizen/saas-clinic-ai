"use client";

import React, { useState } from "react";
import { WizardState } from "../page";

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function OperationsStep({ state, updateState, onNext, onPrev }: Props) {
  // Local states for quick adds
  const [newBranch, setNewBranch] = useState({ name: "", city: "", address: "", phone: "" });
  const [newService, setNewService] = useState({ name: "", description: "", price: 0, durationMinutes: 30 });
  const [newDoctor, setNewDoctor] = useState({ name: "", specialty: "" });

  const handleAddBranch = () => {
    if (newBranch.name && newBranch.city) {
      updateState({ branches: [...state.branches, { ...newBranch }] });
      setNewBranch({ name: "", city: "", address: "", phone: "" });
    }
  };

  const handleAddService = () => {
    if (newService.name && newService.price >= 0) {
      updateState({ services: [...state.services, { ...newService }] });
      setNewService({ name: "", description: "", price: 0, durationMinutes: 30 });
    }
  };

  const handleAddDoctor = () => {
    if (newDoctor.name && newDoctor.specialty) {
      // By default link to all existing branches and services (for simplicity in wizard)
      updateState({
        doctors: [
          ...state.doctors,
          {
            ...newDoctor,
            branchIndexes: state.branches.map((_, i) => i),
            serviceIndexes: state.services.map((_, i) => i),
          },
        ],
      });
      setNewDoctor({ name: "", specialty: "" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.branches.length === 0) {
      alert("يجب إضافة فرع واحد على الأقل");
      return;
    }
    if (state.services.length === 0) {
      alert("يجب إضافة خدمة واحدة على الأقل");
      return;
    }
    if (state.doctors.length === 0) {
      alert("يجب إضافة طبيب واحد على الأقل");
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <div className="flex-1 space-y-8 overflow-y-auto pr-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            ⚙️ بيانات العمليات الأساسية
          </h2>
          <p className="text-xs text-zinc-400 mt-1">أضف الفروع، الخدمات، والأطباء للعيادة.</p>
        </div>

        {/* Branches */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">📍 الفروع ({state.branches.length})</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="اسم الفرع"
              value={newBranch.name}
              onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <input
              type="text"
              placeholder="المدينة"
              value={newBranch.city}
              onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={handleAddBranch}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold"
            >
              إضافة
            </button>
          </div>
          <div className="space-y-2">
            {state.branches.map((b, i) => (
              <div key={i} className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                {b.name} - {b.city}
              </div>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">💎 الخدمات ({state.services.length})</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="اسم الخدمة"
              value={newService.name}
              onChange={(e) => setNewService({ ...newService, name: e.target.value })}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <input
              type="number"
              placeholder="السعر"
              value={newService.price || ""}
              onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) })}
              className="w-24 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={handleAddService}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold"
            >
              إضافة
            </button>
          </div>
          <div className="space-y-2">
            {state.services.map((s, i) => (
              <div key={i} className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                {s.name} - {s.price} SAR ({s.durationMinutes} دقيقة)
              </div>
            ))}
          </div>
        </div>

        {/* Doctors */}
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-100 mb-3">🧑‍⚕️ الأطباء ({state.doctors.length})</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="اسم الطبيب"
              value={newDoctor.name}
              onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <input
              type="text"
              placeholder="التخصص"
              value={newDoctor.specialty}
              onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={handleAddDoctor}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold"
            >
              إضافة
            </button>
          </div>
          <div className="space-y-2">
            {state.doctors.map((d, i) => (
              <div key={i} className="text-xs text-zinc-400 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                {d.name} ({d.specialty})
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="flex justify-between pt-6 mt-6 border-t border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          السابق
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          التالي: دليل التشغيل
        </button>
      </div>
    </form>
  );
}
