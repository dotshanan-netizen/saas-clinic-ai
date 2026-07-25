"use client";

import React, { useState, useEffect } from "react";

interface BookingItem {
  id: string;
  clientPhone: string;
  clientName: string;
  serviceName: string;
  doctorName: string;
  branchName: string;
  timeSlot: string;
  status: string;
  updatedAt: string;
}

const HOURS = [
  "09:00 ص", "09:30 ص", "10:00 ص", "10:30 ص", "11:00 ص", "11:30 ص", 
  "12:00 م", "12:30 م", "01:00 م", "01:30 م", "02:00 م", "02:30 م", 
  "03:00 م", "03:30 م", "04:00 م", "04:30 م", "05:00 م", "05:30 م", 
  "06:00 م", "06:30 م", "07:00 م", "07:30 م", "08:00 م", "08:30 م", "09:00 م"
];



// Map DAYS key to standard display representation
const DAYS_FULL = [
  { key: "Saturday", label: "السبت" },
  { key: "Sunday", label: "الأحد" },
  { key: "Monday", label: "الإثنين" },
  { key: "Tuesday", label: "الثلاثاء" },
  { key: "Wednesday", label: "الأربعاء" },
  { key: "Thursday", label: "الخميس" },
  { key: "Friday", label: "الجمعة" }
];

export default function AppointmentsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bookings`);
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
    // eslint-disable-next-line
    fetchBookings();
  }, []);

  // Filter bookings based on selected doctor and branch
  const filteredBookings = bookings.filter((b) => {
    const matchDoc = selectedDoctor === "all" || b.doctorName === selectedDoctor;
    const matchBranch = selectedBranch === "all" || b.branchName === selectedBranch;
    return matchDoc && matchBranch;
  });

  const pendingBookings = filteredBookings.filter((b) => b.status === "PENDING");
  const confirmedBookings = filteredBookings.filter((b) => b.status === "CONFIRMED");

  // Match a booking to a specific day and hour in the grid
  const getBookingForSlot = (dayLabel: string, hourLabel: string) => {
    return confirmedBookings.find((b) => {
      const slot = b.timeSlot.toLowerCase();
      const matchDay = slot.includes(dayLabel.toLowerCase()) || 
                       (dayLabel === "السبت" && slot.includes("sat")) ||
                       (dayLabel === "الأحد" && slot.includes("sun")) ||
                       (dayLabel === "الإثنين" && slot.includes("mon")) ||
                       (dayLabel === "الثلاثاء" && slot.includes("tue")) ||
                       (dayLabel === "الأربعاء" && slot.includes("wed")) ||
                       (dayLabel === "الخميس" && slot.includes("thu")) ||
                       (dayLabel === "الجمعة" && slot.includes("fri"));

      const cleanHour = hourLabel.replace(" ص", "").replace(" م", "");
      const matchHour = slot.includes(cleanHour);

      return matchDay && matchHour;
    });
  };

  const uniqueDoctors = Array.from(new Set(bookings.map((b) => b.doctorName).filter(Boolean)));
  const uniqueBranches = Array.from(new Set(bookings.map((b) => b.branchName).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Page Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">جدول المواعيد الشاغرة (Schedule)</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">التحقق الفوري من شواغر الأطباء وتأكيد طلبات الحجز المعلقة</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Doctor Filter */}
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-md"
          >
            <option value="all">كل الأطباء 🧑‍⚕️</option>
            {uniqueDoctors.map((doc) => (
              <option key={doc} value={doc}>{doc}</option>
            ))}
          </select>

          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-md"
          >
            <option value="all">كل الفروع 📍</option>
            {uniqueBranches.map((br) => (
              <option key={br} value={br}>{br}</option>
            ))}
          </select>

          <button
            onClick={fetchBookings}
            className="p-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-350 hover:text-zinc-100 transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer border border-zinc-800 hover:border-zinc-700 shadow-md"
          >
            🔄 تحديث
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-140px)]">
        
        {/* SECTION 1: Weekly Calendar Grid Schedule (Rightmost - 8 Cols) - bg-zinc-950/50 */}
        <section className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col overflow-hidden h-full shadow-lg">
          <div className="p-4 border-b border-zinc-900 bg-zinc-950/50 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-2">
              📅 عرض تقويم الأسبوع التفاعلي
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-5 bg-zinc-950/20">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-2">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                جاري تحميل التقويم...
              </div>
            ) : (
              <div className="min-w-[900px] border border-zinc-850 rounded-xl overflow-hidden shadow-2xl bg-zinc-950">
                
                {/* Grid Header Days */}
                <div className="grid grid-cols-8 bg-zinc-900/60 border-b border-zinc-850 text-center py-3 text-xs font-bold text-zinc-300">
                  <div className="border-l border-zinc-850/50 text-zinc-500">الساعة</div>
                  {DAYS_FULL.map((day) => (
                    <div key={day.key} className="border-l border-zinc-850/50 last:border-0">{day.label}</div>
                  ))}
                </div>

                {/* Grid Rows Hours */}
                <div className="divide-y divide-zinc-850/60">
                  {HOURS.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 hover:bg-zinc-900/20 transition-colors">
                      
                      {/* Hour Label */}
                      <div className="bg-zinc-900/20 py-4 text-center text-[10px] text-zinc-400 font-bold border-l border-zinc-850/50 flex items-center justify-center select-none">
                        {hour}
                      </div>

                      {/* Day Columns */}
                      {DAYS_FULL.map((day) => {
                        const booking = getBookingForSlot(day.label, hour);
                        return (
                          <div
                            key={day.key}
                            className="p-1.5 min-h-[64px] border-l border-zinc-850/50 last:border-0 flex items-center justify-center relative group"
                          >
                            {booking ? (
                              <div className="w-full h-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 flex flex-col justify-between text-right shadow-sm hover:scale-[1.02] transition-transform">
                                <span className="font-bold text-emerald-400 text-[10px] truncate">{booking.clientName}</span>
                                <span className="text-zinc-300 text-[9px] truncate font-medium mt-0.5">{booking.serviceName}</span>
                                <span className="text-[8px] text-zinc-500 truncate mt-1">{booking.doctorName}</span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-zinc-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity select-none cursor-pointer hover:text-indigo-400">
                                ➕ حجز شاغر
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: Pending Requests List (Leftmost - 4 Cols) - bg-zinc-900 */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col overflow-hidden h-full shadow-md">
          <div className="p-4 border-b border-zinc-850 bg-zinc-900/30 shrink-0">
            <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              طلبات معلقة بانتظار الإجراء ({pendingBookings.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-950/20">
            {loading ? (
              <div className="text-center text-xs text-zinc-500 py-8">جاري تحميل الطلبات...</div>
            ) : pendingBookings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 text-2xl shadow-inner">
                  📅
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-zinc-400">لا توجد طلبات معلقة</h4>
                  <p className="text-[10px] text-zinc-650 max-w-[200px] mx-auto leading-relaxed">
                    جميع الحجوزات المستلمة تم جدولتها وتأكيد موعدها بنجاح مع المرضى.
                  </p>
                </div>
              </div>
            ) : (
              pendingBookings.map((b) => (
                <div key={b.id} className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl space-y-3 shadow-md hover:border-zinc-800 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-zinc-200">{b.clientName}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{b.clientPhone}</span>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-zinc-400 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900">
                    <div>
                      <span className="text-zinc-500 font-bold ml-1">🩺 الخدمة:</span> {b.serviceName}
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold ml-1">🧑‍⚕️ الطبيب:</span> {b.doctorName}
                    </div>
                    <div>
                      <span className="text-zinc-500 font-bold ml-1">📅 الوقت:</span> <span className="text-indigo-400 font-bold font-mono">{b.timeSlot}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleUpdateStatus(b.id, "CONFIRMED")}
                      disabled={updatingId !== null}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer shadow-emerald-500/5"
                    >
                      {updatingId === b.id ? "..." : "✅ تأكيد الموعد"}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(b.id, "CANCELLED")}
                      disabled={updatingId !== null}
                      className="flex-1 py-2 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-50 text-rose-450 font-bold text-xs rounded-xl transition-all border border-zinc-700 cursor-pointer"
                    >
                      {updatingId === b.id ? "..." : "❌ إلغاء"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
