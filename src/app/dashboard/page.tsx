"use client";

import React, { useState, useEffect } from "react";


interface ConversationItem {
  id: string;
  clientPhone: string;
  clientName: string | null;
  serviceName: string | null;
  status: string;
  lastMessage: string | null;
  updatedAt: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
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
  
  // State for Conversations (Patients list)
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // State for selected patient details
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
  const selectedPhoneRef = React.useRef<string | null>(null);

  const updateSelectedPhone = (phone: string | null) => {
    setSelectedClientPhone(phone);
    selectedPhoneRef.current = phone;
  };

  const [selectedMessages, setSelectedMessages] = useState<ChatMessage[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // States for sending manual replies
  const [newMessageText, setNewMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // AI Takeover State
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [patientNotes, setPatientNotes] = useState("");

  // Fetch active conversations list
  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await fetch(`/api/conversations`);
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  // Fetch conversation details (messages & booking) for selected patient
  const fetchConversationDetails = async (phone: string, silent = false) => {
    try {
      if (!silent) setLoadingDetails(true);
      const res = await fetch(`/api/conversations?clientPhone=${encodeURIComponent(phone)}`);
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSelectedMessages(data.messages);
        setSelectedBooking(data.booking);
        setIsAiPaused(data.humanTakeover || false);
      }
    } catch (err) {
      console.error("Error fetching conversation details:", err);
    } finally {
      if (!silent) setLoadingDetails(false);
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
        setSelectedBooking((prev) => prev ? { ...prev, status: newStatus } : prev);
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

  // Toggle Human Takeover Status
  const handleToggleAi = async (newState: boolean) => {
    if (!selectedClientPhone || togglingAi) return;
    try {
      setTogglingAi(true);
      const res = await fetch("/api/conversations/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientPhone: selectedClientPhone,
          humanTakeover: newState,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsAiPaused(data.humanTakeover);
      } else {
        alert("فشل تحديث حالة الذكاء الاصطناعي للمحادثة.");
      }
    } catch (err) {
      console.error("Error toggling AI:", err);
    } finally {
      setTogglingAi(false);
    }
  };

  useEffect(() => {
    let active = true;

    const doFetch = (silent = false) => {
      if (!active) return;
      fetchConversations(silent);
      if (selectedPhoneRef.current) {
        fetchConversationDetails(selectedPhoneRef.current, silent);
      }
    };

    // Initial fetch
    setTimeout(() => doFetch(false), 0);

    // Poll every 5 seconds silently
    const intervalId = setInterval(() => doFetch(true), 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
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
        return { dot: "bg-amber-500", label: "قيد الانتظار", textClass: "text-amber-400" };
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

  // Get name initials for avatar
  const getInitials = (name: string | null) => {
    if (!name) return "ع";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const selectedPatientName = conversations.find(c => c.id === selectedConversationId)?.clientName || "عميل جديد";

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans" dir="rtl">
      {/* Sub Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">مساحة عمل المحادثات</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">متابعة رسائل المرضى والردود الذكية الفورية للـ AI</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchConversations()}
            className="p-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer border border-zinc-800 hover:border-zinc-700 shadow-md"
          >
            🔄 تحديث البيانات
          </button>
        </div>
      </header>

      {/* 3-Column Workspace */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-140px)]">
        
        {/* COLUMN 1: Active Patients List (Rightmost - 3 Cols) - Darker bg-zinc-950 */}
        <section className="lg:col-span-3 bg-zinc-950 border border-zinc-900/80 rounded-2xl flex flex-col overflow-hidden h-full shadow-lg">
          <div className="p-4 border-b border-zinc-900/80 bg-zinc-950/50 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              محادثات المرضى النشطة
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {loadingConversations ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                جاري تحميل المرضى...
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                <span className="text-3xl">💬</span>
                <p className="text-zinc-500 text-xs">لا توجد محادثات نشطة حالياً.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id;
                const statusInfo = getStatusDisplay(conv.status);

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      updateSelectedPhone(conv.clientPhone);
                      fetchConversationDetails(conv.clientPhone);
                    }}
                    data-testid={`patient-btn-${conv.clientPhone}`}
                    className={`w-full text-right p-4 rounded-xl border transition-all flex flex-col gap-2 outline-none cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-800 shadow-md ring-1 ring-zinc-850"
                        : "bg-zinc-950 border-zinc-900 hover:bg-zinc-900/50 hover:border-zinc-850"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-zinc-200">
                        {conv.clientName || "عميل جديد"}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[10px] text-zinc-400 truncate text-right w-full leading-relaxed">
                      {conv.lastMessage || getMockLastMessage(conv.status)}
                    </div>

                    <div className="flex items-center justify-between w-full mt-1 pt-2 border-t border-zinc-900">
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                        isAiPaused && isSelected
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25"
                      }`}>
                        {isAiPaused && isSelected ? "👩‍💻 موظف" : "🤖 ذكاء اصطناعي"}
                      </span>

                      <span 
                        className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                          conv.status === "PENDING"
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            : conv.status === "CONFIRMED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border-zinc-800"
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

        {/* COLUMN 2: Chat Workspace (Middle - 5 Cols) - Brightest focus bg-zinc-900/30 */}
        <section className="lg:col-span-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden h-full shadow-2xl">
          
          {/* Header layout refinement */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between shrink-0 h-[64px]">
            {selectedClientPhone ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                    {getInitials(selectedPatientName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-zinc-200">{selectedPatientName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[8px] text-zinc-500">متصل الآن</span>
                    </div>
                  </div>
                </div>

                {/* Contextual Action Button */}
                <div className="flex items-center gap-2">
                  {isAiPaused ? (
                    <button
                      onClick={() => handleToggleAi(false)}
                      disabled={togglingAi}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow-sm"
                    >
                      {togglingAi ? "..." : "🤖 تشغيل الرد الآلي"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleAi(true)}
                      disabled={togglingAi}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-400 border border-amber-500/30 rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow-sm"
                    >
                      {togglingAi ? "..." : "❌ إيقاف الرد الذكي"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-2">
                💬 المحادثة
              </h3>
            )}
          </div>

          {/* Chat Viewport and Empty States Refinements */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-zinc-950/20">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 text-2xl shadow-lg">
                  💬
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-zinc-300">ابدأ متابعة محادثات المرضى</h4>
                  <p className="text-[11px] text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                    اختر مريضاً من القائمة الجانبية لعرض تاريخ الرسائل وبدء الرد أو تفعيل الذكاء الاصطناعي.
                  </p>
                </div>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ml-2"></div>
                جاري تحميل سجل المحادثة...
              </div>
            ) : selectedMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-650">لا توجد رسائل مسجلة.</div>
            ) : (
              selectedMessages.map((msg, idx) => {
                if (msg.role === "system") return null;
                return (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line shadow-sm border ${
                      msg.role === "user" 
                        ? "bg-indigo-600 text-white rounded-tl-none border-indigo-500 font-medium" 
                        : "bg-zinc-900 text-zinc-200 rounded-tr-none border-zinc-800"
                    }`}
                  >
                    {msg.content}
                    {msg.timestamp && (
                      <span className={`block text-[8px] mt-2 text-left ${msg.role === "user" ? "text-indigo-200" : "text-zinc-500"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>

          {/* Chat Composer */}
          {selectedClientPhone && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex gap-2 shrink-0">
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
                className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-4 py-3 text-xs outline-none text-zinc-200 focus:border-indigo-500 transition-all placeholder-zinc-600"
                disabled={sendingMessage}
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !newMessageText.trim()}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                {sendingMessage ? "..." : "إرسال"}
              </button>
            </div>
          )}
        </section>

        {/* COLUMN 3: Context Panel & Booking Details (Leftmost - 4 Cols) - bg-zinc-900 */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col overflow-hidden h-full shadow-md">
          <div className="p-4 border-b border-zinc-850 bg-zinc-900/30 shrink-0">
            <h3 className="font-bold text-zinc-300 text-xs flex items-center gap-2">
              📋 لوحة معلومات العميل (Context)
            </h3>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {!selectedClientPhone ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500 text-xl">
                  📋
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-zinc-400">ملف العميل الذكي</h4>
                  <p className="text-[10px] text-zinc-600 max-w-[200px] mx-auto leading-relaxed">
                    هنا تظهر بيانات حجز المريض، ملخص الذكاء الاصطناعي، وملاحظات العمل التفاعلية.
                  </p>
                </div>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">جاري تحميل الملف...</div>
            ) : (
              <div className="space-y-4" data-testid="booking-details">
                
                {/* 1. Customer Journey / Patient Status Badge */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-bold">رحلة المريض الحالية</span>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    !selectedBooking 
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                      : selectedBooking.status === "PENDING"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : selectedBooking.status === "CONFIRMED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : selectedBooking.status === "CANCELLED"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-800"
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
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-1.5">
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
                    <span className="text-xs font-semibold text-zinc-300 block">لا يوجد حجز مسجل</span>
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
                      <hr className="border-zinc-850/50" />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">الفرع المختار</span>
                          <span className="text-xs font-semibold text-zinc-200" data-testid="detail-branch-name">{selectedBooking.branchName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">الوقت المفضل</span>
                          <span className="text-xs font-semibold text-zinc-200 font-mono" data-testid="detail-time-slot">{selectedBooking.timeSlot}</span>
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
                          className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                        >
                          {updatingStatus ? "..." : "✅ تأكيد الحجز"}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedBooking.id, "CANCELLED")}
                          disabled={updatingStatus}
                          data-testid="cancel-booking-btn"
                          className="flex-1 py-2.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 disabled:opacity-50 text-rose-400 font-bold text-xs transition-all border border-zinc-700 cursor-pointer"
                        >
                          {updatingStatus ? "..." : "❌ إلغاء الموعد"}
                        </button>
                      </div>
                    )}
                    {selectedBooking.status === "CONFIRMED" && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl py-2.5 text-center" data-testid="confirmed-status-banner">
                        <span className="text-emerald-400 font-bold text-xs">🟢 الحجز مؤكد</span>
                      </div>
                    )}
                    {selectedBooking.status === "CANCELLED" && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl py-2.5 text-center" data-testid="cancelled-status-banner">
                        <span className="text-rose-400 font-bold text-xs">🔴 الموعد ملغى</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. AI Summary */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] text-zinc-500 block font-bold">ملخص الذكاء الاصطناعي (AI Summary)</span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                    المريض يرغب في حجز موعد لتنظيف البشرة هيدرافيشيل ويفضل طبيباً غير محدد في فرع الصحافة الساعة 6 مساءً.
                  </p>
                </div>

                {/* 5. Patient Profile Details */}
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                  <span className="text-[10px] text-zinc-500 block font-bold">بيانات المريض الأساسية</span>
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[9px] text-zinc-500 block">اسم المريض</span>
                      <span className="text-xs font-bold text-zinc-200" data-testid="detail-client-name">{selectedBooking?.clientName || "عميل جديد"}</span>
                    </div>
                    <hr className="border-zinc-850/40" />
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
                    className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-[10px] text-zinc-300 focus:border-indigo-500 outline-none resize-none transition-all"
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
