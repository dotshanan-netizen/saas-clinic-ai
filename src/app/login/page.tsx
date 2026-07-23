"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "فشل تسجيل الدخول. يرجى التحقق من البيانات.");
      }

      // Login success, redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center font-sans antialiased overflow-x-hidden relative" dir="rtl">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-zinc-900/40 border border-zinc-850 rounded-2xl backdrop-blur-md shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-400 flex items-center justify-center font-bold text-zinc-950 text-xl shadow-lg shadow-indigo-500/10 mb-4">
            CA
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-200 bg-clip-text text-transparent">
            تسجيل الدخول – Clinova AI
          </h1>
          <p className="text-xs text-zinc-400 mt-2">أدخل بيانات مدير العيادة للوصول إلى لوحة الاستقبال</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs text-zinc-400 font-bold block mb-2">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@clinic.com"
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:border-indigo-500 focus:outline-none transition-all placeholder:text-zinc-650"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-bold block mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:border-indigo-500 focus:outline-none transition-all placeholder:text-zinc-650"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:opacity-50 text-zinc-950 font-extrabold text-sm transition-all shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95"
          >
            {loading ? "جاري التحقق..." : "دخول اللوحة 🚀"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-850 text-center">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            الصفحة الرئيسية للموقع
          </Link>
        </div>
      </div>
    </div>
  );
}
