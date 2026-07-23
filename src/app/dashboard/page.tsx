"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

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

  // States for sending manual replies
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // AI Takeover State (contextual action placeholder)
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [patientNotes, setPatientNotes] = useState("");

  // Fetch active conversations list
  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const res = await fetch(`/api/conversations?clinicSlug=${clinicSlug}`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
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
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
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

  // Handle manual message dispatch
  const handleSendMessage = async () => {
    if (!selectedClientPhone || !newMessageText.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientPhone: selectedClientPhone,
          messageText: newMessageText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Append the new message to state immediately
        setSelectedMessages((prev) => [...prev, data.message]);
        setNewMessageText("");
      } else {
        const errorData = await res.json();
        alert(`فشل إرسال الرسالة: ${errorData.error || "خطأ غير معروف"}`);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("حدث خطأ أثناء محاولة إرسال الرسالة.");
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    let active = true;
    
    setTimeout(() => {
      if (active) {
        fetchConversations();
      }
    }, 0);

    return () => {
      active = false;
    };
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

  // Mock message preview helper
  const getMockLastMessage = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "تم تأكيد موعدكم بنجاح، ننتظركم في الفرع 🌸";
      case "CANCELLED":
        return "تم إلغاء الموعد بناءً على طلبكم ❌";
      default:
        return "أرغب في حجز موعد لتنظيف البشرة هيدرافيشيل...";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Sub Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-zinc-200">مساحة عمل المحادثات</h2>
          <p className="text-[10px] text-zinc-500">متابعة رسائل المرضى والردود الذكية الفورية</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchConversations}
            className="p-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer border border-zinc-750"
          >
            🔄 تحديث البيانات
          </button>
        </div>
      </header>

      {/* 3-Column Workspace */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* COLUMN 1: Active Patients List (Rightmost - 3 Cols) */}
        <section className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-zinc-100 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              محادثات المرضى
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loadingConversations ? (
              <div className="p-4 text-center text-xs text-zinc-500">جاري تحميل المرضى...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-600">لا توجد محادثات نشطة حالياً.</div>
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
                    className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1 outline-none cursor-pointer ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-750"
                        : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-850"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-zinc-200">
                        {conv.clientName || "عميل جديد"}
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Last Message Preview */}
                    <div className="text-[10px] text-zinc-400 truncate text-right w-full">
                      {getMockLastMessage(conv.status)}
                    </div>

                    <div className="flex items-center justify-between w-full mt-1.5 pt-1.5 border-t border-zinc-850/50">
                      {/* Conversation Mode Indicator Badge */}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                        isAiPaused && isSelected
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}>
                        {isAiPaused && isSelected ? "👩‍💻 موظف" : "🤖 ذكاء اصطناعي"}
                      </span>

                      {/* Small Pending Booking Badge */}
                      <span 
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          conv.status === "PENDING"
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                        data-testid={`patient-status-${conv.clientPhone}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN 2: Chat Workspace / Conversation Area (Middle - 5 Cols) */}
        <section className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-zinc-100 text-xs flex items-center gap-2">
              💬 المحادثة
            </h3>

            {/* Contextual Takeover Action in Header */}
            {selectedClientPhone && (
              <div className="flex items-center gap-2">
                {isAiPaused ? (
                  <button
                    onClick={() => setIsAiPaused(false)}
                    className="px-2.5 py-1 bg-zinc-850 hover:bg-zinc-800 text-emerald-400 border border-zinc-700 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                  >
                    🤖 تشغيل الرد الآلي (Resume AI)
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAiPaused(true)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                  >
                    ❌ إيقاف الرد والتدخل (Take Over)
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/40">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-xs">الرجاء اختيار مريض من القائمة لعرض المحادثة.</p>
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
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-md ${
                      msg.role === "user" 
                        ? "bg-indigo-600 text-white rounded-tl-none font-medium" 
                        : "bg-zinc-800 text-zinc-100 rounded-tr-none border border-zinc-750"
                    }`}
                  >
                    {msg.content}
                    {msg.timestamp && (
                      <span className={`block text-[8px] mt-1.5 text-left ${msg.role === "user" ? "text-indigo-200" : "text-zinc-500"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Composer */}
          {selectedClientPhone && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900 flex gap-2 shrink-0">
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="اكتب ردك هنا للتدخل البشري..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs outline-none text-zinc-200 focus:border-indigo-500 transition-colors"
                disabled={sendingMessage}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !newMessageText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {sendingMessage ? "..." : "إرسال"}
              </button>
            </div>
          )}
        </section>

        {/* COLUMN 3: Context Panel & Booking Details (Leftmost - 4 Cols) */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-[600px]">
          <div className="p-4 border-b border-zinc-800 shrink-0">
            <h3 className="font-bold text-zinc-100 text-xs flex items-center gap-2">
              📋 لوحة معلومات العميل (Context)
            </h3>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-xs">اختر مريضاً لعرض بيانات الحجز والتحكم.</p>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">جاري تحميل بيانات العميل...</div>
            ) : (
              <div className="space-y-4" data-testid="booking-details">
                
                {/* 1. Customer Journey / Patient Status */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold">رحلة المريض الحالية</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    !selectedBooking 
                      ? "bg-amber-500/10 text-amber-400" 
                      : selectedBooking.status === "PENDING"
                      ? "bg-blue-500/10 text-blue-400"
                      : selectedBooking.status === "CONFIRMED"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : selectedBooking.status === "CANCELLED"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {!selectedBooking 
                      ? "🟡 عميل جديد" 
                      : selectedBooking.status === "PENDING"
                      ? "🔵 طلب حجز"
                      : selectedBooking.status === "CONFIRMED"
                      ? "🟢 موعد مؤكد"
                      : selectedBooking.status === "CANCELLED"
                      ? "🔴 موعد ملغى"
                      : "⚫ تمت الزيارة"
                    }
                  </span>
                </div>

                {/* 2. Next Action (Contextual Guide) */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-1">
                  <span className="text-[10px] text-zinc-500 block font-bold">⭐ الإجراء القادم المقترح</span>
                  <span className="text-[10px] text-indigo-400 font-semibold leading-relaxed">
                    {selectedBooking?.status === "PENDING" 
                      ? "تأكيد موعد العميل فوراً لتجنب فقدان الحجز" 
                      : selectedBooking?.status === "CONFIRMED"
                      ? "لا يوجد إجراء مطلوب، الرد الآلي يتابع مع العميل"
                      : "المتابعة مع العميل لمحاولة إعادة جدولة الموعد"
                    }
                  </span>
                </div>

                {/* 3. Booking Details & Status actions */}
                {!selectedBooking ? (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2 text-center text-zinc-500">
                    <span className="text-xs font-semibold text-zinc-300 block">طلب معلق أو قيد النقاش</span>
                    <p className="text-[10px] leading-relaxed">العميل لم يقم بإتمام حجز موعد مؤكد بعد.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
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

                    {/* Booking actions */}
                    {selectedBooking.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(selectedBooking.id, "CONFIRMED")}
                          disabled={updatingStatus}
                          data-testid="confirm-booking-btn"
                          className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          {updatingStatus ? "..." : "✅ تأكيد الحجز"}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedBooking.id, "CANCELLED")}
                          disabled={updatingStatus}
                          data-testid="cancel-booking-btn"
                          className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 disabled:opacity-50 text-rose-400 font-bold text-xs transition-colors border border-zinc-700 cursor-pointer"
                        >
                          {updatingStatus ? "..." : "❌ إلغاء الموعد"}
                        </button>
                      </div>
                    )}
                    {selectedBooking.status === "CONFIRMED" && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2 text-center" data-testid="confirmed-status-banner">
                        <span className="text-emerald-400 font-bold text-xs">🟢 الحجز مؤكد</span>
                      </div>
                    )}
                    {selectedBooking.status === "CANCELLED" && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 text-center" data-testid="cancelled-status-banner">
                        <span className="text-rose-400 font-bold text-xs">🔴 الموعد ملغى</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. AI Summary (Placeholder) */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] text-zinc-500 block font-bold">ملخص الذكاء الاصطناعي (AI Summary)</span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    المريض يرغب في حجز موعد لتنظيف البشرة هيدرافيشيل ويفضل طبيباً غير محدد في فرع الصحافة الساعة 6 مساءً.
                  </p>
                </div>

                {/* 5. Patient Profile Details */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] text-zinc-500 block font-bold">بيانات المريض الأساسية</span>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[9px] text-zinc-500 block">اسم المريض</span>
                      <span className="text-xs font-bold text-zinc-200" data-testid="detail-client-name">{selectedBooking?.clientName || "عميل جديد"}</span>
                    </div>
                    <hr className="border-zinc-850/50" />
                    <div>
                      <span className="text-[9px] text-zinc-500 block">رقم الجوال</span>
                      <span className="text-xs font-semibold text-zinc-200 font-mono" data-testid="detail-client-phone">{selectedClientPhone}</span>
                    </div>
                  </div>
                </div>

                {/* 6. Patient Notes */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] text-zinc-500 block font-bold">ملاحظات موظف الاستقبال</span>
                  <textarea
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظات إضافية هنا..."
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[10px] text-zinc-300 focus:border-indigo-500 outline-none resize-none transition-colors"
                  />
                </div>

              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
