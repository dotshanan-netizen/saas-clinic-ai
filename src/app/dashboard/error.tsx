"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 flex-col gap-4 p-8">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-red-100 max-w-lg text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">عذراً، حدث خطأ غير متوقع</h2>
        <p className="text-gray-600 mb-6 text-sm">
          لقد واجهنا مشكلة فنية أثناء تحميل هذه الصفحة. يرجى محاولة إعادة المحاولة أو العودة للصفحة الرئيسية.
        </p>
        <button
          onClick={() => reset()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
