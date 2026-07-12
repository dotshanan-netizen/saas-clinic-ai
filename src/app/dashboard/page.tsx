"use client";

import React, { useState, useEffect } from "react";

interface ConversationItem {
  id: string;
  clientPhone: string;
  clientName: string | null;
  serviceName: string | null;
  status: string;
  updatedAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  doctorName: string;
  branchName: string;
  timeSlot: string;
  status: string;
}

export default function Dashboard() {
  const clinicSlug = "rival-clinic";
  
  // State for Conversations (Patients list)
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // State for selected patient details
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch active conversations list
  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const res = await fetch(`/api/conversations?clinicSlug=${clinicSlug}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Fetch conversation details (messages & booking) for selected patient
  const fetchConversationDetails = async (phone: string) => {
    try {
      setLoadingDetails(true);
      const res = await fetch(`/api/conversations?clinicSlug=${clinicSlug}&clientPhone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMessages(data.messages);
        setSelectedBooking(data.booking);
      }
    } catch (err) {
      console.error("Error fetching conversation details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Update booking status in DB and reflect in UI
  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    if (updatingStatus) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", bookingId, status: newStatus }),
      });
      if (res.ok) {
        // Update local state immediately (no full page reload)
        setSelectedBooking((prev) => prev ? { ...prev, status: newStatus } : prev);
        // Also refresh the sidebar list to reflect new status
        fetchConversations();
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Helpers for Status Icons/Labels
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return { dot: "bg-emerald-500", label: "مؤكد", textClass: "text-emerald-400" };
      case "CANCELLED":
        return { dot: "bg-rose-500", label: "ملغى", textClass: "text-rose-400" };
      default:
        return { dot: "bg-orange-500", label: "قيد الانتظار", textClass: "text-orange-400" };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased" dir="rtl">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-zinc-950 text-lg shadow-lg shadow-emerald-500/10">
            CA
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              لوحة موظف الاستقبال – Clinic AI
            </h1>
            <p className="text-xs text-zinc-400">إدارة حجوزات ومحادثات المرضى لعيادة ريفال للتجميل</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchConversations}
            className="p-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer border border-zinc-750"
          >
            🔄 تحديث البيانات
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            الصفحة الرئيسية
          </a>
        </div>
      </header>

      {/* Main Receptionist Panel Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* COLUMN 1: Booking Details (Leftmost - 4 Cols) */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
              📋 تفاصيل الحجز المبدئي
            </h3>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-xs">لا توجد تفاصيل حجز معروضة حالياً.</p>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">جاري تحميل تفاصيل الحجز...</div>
            ) : !selectedBooking ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="text-3xl mb-2">🟡</div>
                <h4 className="text-zinc-300 font-semibold mb-1 text-xs">طلب قيد المراجعة</h4>
                <p className="text-[10px] max-w-[200px] leading-relaxed">العميل لم يستكمل كامل البيانات المطلوبة بعد للحفظ في قاعدة البيانات.</p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="booking-details">
                <div className="space-y-3">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">اسم المريض</span>
                      <span className="text-xs font-bold text-zinc-200" data-testid="detail-client-name">{selectedBooking.clientName}</span>
                    </div>
                    <hr className="border-zinc-850" />
                    <div>
                      <span className="text-[10px] text-zinc-500 block">رقم الجوال</span>
                      <span className="text-xs font-semibold text-zinc-200 font-mono" data-testid="detail-client-phone">{selectedBooking.clientPhone}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الخدمة المطلوبة</span>
                        <span className="text-xs font-semibold text-zinc-200" data-testid="detail-service-name">{selectedBooking.serviceName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الطبيب المفضل</span>
                        <span className="text-xs font-semibold text-zinc-200" data-testid="detail-doctor-name">{selectedBooking.doctorName}</span>
                      </div>
                    </div>
                    <hr className="border-zinc-850" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الفرع المختار</span>
                        <span className="text-xs font-semibold text-zinc-200" data-testid="detail-branch-name">{selectedBooking.branchName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">الوقت المفضل</span>
                        <span className="text-xs font-semibold text-zinc-200" data-testid="detail-time-slot">{selectedBooking.timeSlot}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Phase 3 */}
                {selectedBooking.status === "PENDING" && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedBooking.id, "CONFIRMED")}
                      disabled={updatingStatus}
                      data-testid="confirm-booking-btn"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-xs transition-colors"
                    >
                      {updatingStatus ? "جاري التحديث..." : "✅ تأكيد الحجز"}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedBooking.id, "CANCELLED")}
                      disabled={updatingStatus}
                      data-testid="cancel-booking-btn"
                      className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-rose-400 font-bold text-xs transition-colors border border-zinc-700"
                    >
                      {updatingStatus ? "..." : "❌ إلغاء الموعد"}
                    </button>
                  </div>
                )}
                {selectedBooking.status === "CONFIRMED" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center" data-testid="confirmed-status-banner">
                    <span className="text-emerald-400 font-bold text-xs">🟢 الحجز مؤكد</span>
                  </div>
                )}
                {selectedBooking.status === "CANCELLED" && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-center" data-testid="cancelled-status-banner">
                    <span className="text-rose-400 font-bold text-xs">🔴 الموعد ملغى</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 2: Chat History (Middle - 5 Cols) */}
        <section className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
              💬 سجل المحادثة
            </h3>
            {selectedClientPhone && (
              <span className="text-[10px] text-zinc-500 font-mono">{selectedClientPhone}</span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/40">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-xs">الرجاء اختيار مريض من قائمة الطلبات لعرض سجل حواره.</p>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">جاري تحميل سجل المحادثة...</div>
            ) : selectedMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">لا توجد رسائل مسجلة.</div>
            ) : (
              selectedMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow ${
                      msg.role === "user" 
                        ? "bg-emerald-500 text-zinc-950 rounded-tl-none font-medium" 
                        : "bg-zinc-800 text-zinc-100 rounded-tr-none border border-zinc-750"
                    }`}
                  >
                    {msg.content}
                    {msg.timestamp && (
                      <span className={`block text-[8px] mt-1.5 text-left ${msg.role === "user" ? "text-emerald-900" : "text-zinc-500"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 3: Active Patients (Rightmost - 3 Cols) */}
        <section className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              طلبات اليوم (المرضى)
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loadingConversations ? (
              <div className="p-4 text-center text-xs text-zinc-500">جاري تحميل المرضى...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-650">لا توجد محادثات نشطة حالياً.</div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id;
                const statusInfo = getStatusDisplay(conv.status);

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      setSelectedClientPhone(conv.clientPhone);
                      fetchConversationDetails(conv.clientPhone);
                    }}
                    data-testid={`patient-btn-${conv.clientPhone}`}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 outline-none cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-700"
                        : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-850"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-zinc-200">
                        {conv.clientName || "عميل جديد"}
                      </span>
                      <span 
                        className={`text-[10px] font-semibold flex items-center gap-1.5 ${statusInfo.textClass}`}
                        data-testid={`patient-status-${conv.clientPhone}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                        {statusInfo.label}
                      </span>
                    </div>
                    {conv.serviceName && (
                      <span className="text-[10px] text-zinc-400">{conv.serviceName}</span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {conv.clientPhone}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} لوحة الاستقبال - Clinic AI.
      </footer>
    </div>
  );
}
