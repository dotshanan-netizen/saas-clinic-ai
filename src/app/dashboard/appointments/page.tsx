"use client";

import React, { useState, useEffect } from "react";

interface BookingItem {
  id: string;
  clientPhone: string;
  clientName: string;
  serviceName: string;
  status: string;
  updatedAt: string;
}

export default function AppointmentsPage() {
  const clinicSlug = "rival-clinic";
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/conversations?clinicSlug=${clinicSlug}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      setUpdatingId(bookingId);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", bookingId, status: newStatus }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Simple categorization
  const pendingBookings = bookings.filter((b) => b.status === "PENDING");
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Page Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-zinc-200">إدارة الحجوزات والمواعيد (Appointments)</h2>
          <p className="text-[10px] text-zinc-500">متابعة تأكيد المواعيد وإلغائها وإدارة طلبات الحجز المعلقة</p>
        </div>

        <button
          onClick={fetchBookings}
          className="p-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer border border-zinc-750"
        >
          🔄 تحديث القائمة
        </button>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8 overflow-y-auto">
        {/* Navigation Breadcrumb */}
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <span>لوحة التحكم</span>
          <span>/</span>
          <span className="text-zinc-400 font-medium">المواعيد</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-zinc-400">جاري تحميل المواعيد الحالية...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* List 1: Pending Bookings */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[550px]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <h3 className="font-bold text-xs text-orange-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  طلبات معلقة ({pendingBookings.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {pendingBookings.length === 0 ? (
                  <p className="text-center text-xs text-zinc-650 py-8">لا توجد طلبات معلقة حالياً.</p>
                ) : (
                  pendingBookings.map((b) => (
                    <div key={b.id} className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-zinc-200">{b.clientName}</span>
                        <span className="text-[8px] text-zinc-500 font-mono">{b.clientPhone}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{b.serviceName}</div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleUpdateStatus(b.id, "CONFIRMED")}
                          disabled={updatingId !== null}
                          className="flex-1 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(b.id, "CANCELLED")}
                          disabled={updatingId !== null}
                          className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-750 disabled:opacity-50 text-rose-400 font-bold text-[10px] rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* List 2: Confirmed Appointments */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[550px]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <h3 className="font-bold text-xs text-emerald-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  حجوزات مؤكدة ({confirmedBookings.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {confirmedBookings.length === 0 ? (
                  <p className="text-center text-xs text-zinc-650 py-8">لا توجد حجوزات مؤكدة.</p>
                ) : (
                  confirmedBookings.map((b) => (
                    <div key={b.id} className="bg-zinc-950 border border-emerald-500/10 p-3 rounded-xl border-l-2 border-l-emerald-500 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-zinc-200">{b.clientName}</span>
                        <span className="text-[8px] text-zinc-500 font-mono">{b.clientPhone}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{b.serviceName}</div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">🟢 مؤكد</span>
                        <button
                          onClick={() => handleUpdateStatus(b.id, "CANCELLED")}
                          disabled={updatingId !== null}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-rose-400 font-bold text-[9px] rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                        >
                          إلغاء الموعد
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* List 3: Cancelled Appointments */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[550px]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <h3 className="font-bold text-xs text-rose-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  المواعيد الملغاة ({cancelledBookings.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {cancelledBookings.length === 0 ? (
                  <p className="text-center text-xs text-zinc-650 py-8">لا توجد مواعيد ملغاة.</p>
                ) : (
                  cancelledBookings.map((b) => (
                    <div key={b.id} className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl space-y-2 opacity-60">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-xs text-zinc-450">{b.clientName}</span>
                        <span className="text-[8px] text-zinc-600 font-mono">{b.clientPhone}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">{b.serviceName}</div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[8px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-bold">🔴 ملغى</span>
                        <button
                          onClick={() => handleUpdateStatus(b.id, "PENDING")}
                          disabled={updatingId !== null}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-indigo-400 font-bold text-[9px] rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                        >
                          إعادة تفعيل
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
