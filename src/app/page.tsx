import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased overflow-x-hidden selection:bg-emerald-500 selection:text-zinc-950" dir="rtl">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-10%] w-[60%] h-[50%] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none"></div>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-zinc-950 text-sm shadow shadow-emerald-500/10">
            CA
          </div>
          <span className="font-extrabold text-lg bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Clinic AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          <a href="#features" className="text-zinc-400 hover:text-zinc-200 text-xs font-semibold hidden md:inline transition-colors">
            الميزات
          </a>
          <a href="#pricing" className="text-zinc-400 hover:text-zinc-200 text-xs font-semibold hidden md:inline transition-colors">
            باقات الاشتراك
          </a>
          <a
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95"
          >
            جرب المحاكي مجاناً 🚀
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="max-w-6xl mx-auto w-full px-6 pt-16 pb-20 text-center flex flex-col items-center relative z-10">
        {/* Riyadh KSA Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6 animate-pulse">
          🇸🇦 مخصص لعيادات الجلدية والتجميل بالمملكة
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl">
          حول استفسارات واتساب إلى{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
            حجوزات مؤكدة
          </span>{" "}
          خلال ثوانٍ!
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-zinc-400 text-sm md:text-base max-w-2xl leading-relaxed">
          سارة هي سكرتيرة ومسؤولة مبيعات ذكية (AI Employee) تعمل على مدار 24 ساعة، ترد في ثوانٍ بلهجة سعودية بيضاء محترفة لتجيب على الأسعار، وتعرّف بالأطباء، وتجمع بيانات الحجز وتمررها لفريقك.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
          <a
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold text-sm transition-all shadow-lg active:scale-95 text-center"
          >
            دخول المحاكي ولوحة التحكم
          </a>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 font-semibold text-sm transition-all active:scale-95 text-center"
          >
            أسعار الاشتراكات
          </a>
        </div>

        {/* WhatsApp Preview Card Mockup */}
        <div className="mt-16 w-full max-w-3xl bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 backdrop-blur-sm relative shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-500"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">Sara_WhatsApp_Bot_v1.0.js</div>
          </div>
          
          <div className="space-y-4 text-right" dir="rtl">
            <div className="flex justify-start">
              <div className="bg-zinc-800/80 border border-zinc-700 text-zinc-100 text-xs md:text-sm rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                يا هلا ومسهلا بكِ في عيادتنا التجميلية 🌸
                أنا سارة مساعدتك الذكية عشان أخدمك في الحجوزات والاستفسارات. ممكن تفيديني باسمك الكريم ورقم جوالك عشان نسجلك بالنظام؟
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-emerald-500 text-zinc-950 text-xs md:text-sm rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] leading-relaxed font-semibold">
                أهلاً، أنا سارة العتيبي وجوالي 0555555555، حابة أسأل عن أسعار الفيلر عندكم.
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-zinc-800/80 border border-zinc-700 text-zinc-100 text-xs md:text-sm rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] leading-relaxed">
                يا ميت أهلاً وسهلاً بكِ أخت سارة 💕
                تسعدنا خدمتكِ عيوني. متاح عندنا جلسة فيلر الشفايف السويسري بـ 1200 ريال لنتائج طبيعية ونضارة كاملة.
                هل تفضلين نقترح عليكِ المواعيد المتاحة عند الأطباء؟
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="bg-zinc-900/30 border-y border-zinc-900 py-20 relative z-10">
        <div className="max-w-6xl mx-auto w-full px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-black">لماذا تعتمد العيادات على Clinic AI؟</h2>
            <p className="text-zinc-400 text-xs md:text-sm mt-3">صُمم ليكون موظف مبيعات وتنسيق مستقل يحل أكبر فجوة تواجه عيادات التجميل في السعودية.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-6 rounded-2xl hover:border-emerald-500/20 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 text-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <h3 className="font-bold text-lg text-zinc-200">الرد اللحظي الفوري</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                نسبة كبيرة من العملاء يراسلون عدة عيادات في نفس الوقت، من يرد أولاً يحسم الحجز. سارة ترد خلال ثوانٍ معدودة 24/7 دون أي تأخير.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-6 rounded-2xl hover:border-teal-500/20 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 text-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                🇸🇦
              </div>
              <h3 className="font-bold text-lg text-zinc-200">فهم عميق للهجة السعودية</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                تتحدث سارة اللهجة البيضاء السعودية اللبقة والمحترمة، وتفهم المصطلحات المحلية للمناطق والخدمات التجميلية بشكل طبيعي للغاية وكأنها بشري.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-900/60 border border-zinc-850 p-6 rounded-2xl hover:border-purple-500/20 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 text-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                📋
              </div>
              <h3 className="font-bold text-lg text-zinc-200">جمع البيانات الخماسية</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                تقوم سارة بجمع الاسم، الجوال، الخدمة المطلوبة، الطبيب المفضل، الفرع، والوقت المفضل بالتسلسل وبذكاء، ثم تصدر تذكرة حجز فورية.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-6xl mx-auto w-full px-6 py-20 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-black">باقات الاشتراك المقترحة</h2>
          <p className="text-zinc-400 text-xs md:text-sm mt-3">اختر الباقة المناسبة لحجم ونشاط عيادتك وابدأ في تحويل المحادثات إلى أرباح.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Tier 1 */}
          <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <div>
              <h3 className="font-bold text-lg text-zinc-200">الباقة البسيطة (Starter)</h3>
              <p className="text-xs text-zinc-400 mt-1">مناسبة للعيادات الفردية أو عيادات الأطباء المستقلين</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-zinc-100">1,499</span>
                <span className="text-xs text-zinc-400">ريال / شهرياً</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-zinc-400 border-t border-zinc-850 pt-6">
                <li>🟢 موظفة ذكية واحدة (سارة)</li>
                <li>🟢 معالجة حتى 1,500 محادثة شهرياً</li>
                <li>🟢 ربط مع رقم واتساب واحد</li>
                <li>🟢 لوحة استقبال حجوزات Airtable/Next.js</li>
              </ul>
            </div>
            <a href="/dashboard" className="mt-8 block w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-center text-xs font-bold transition-all">
              ابدأ الآن 🚀
            </a>
          </div>

          {/* Tier 2 (Pro) */}
          <div className="bg-zinc-900 border-2 border-emerald-500/30 p-6 rounded-2xl flex flex-col justify-between relative shadow-xl shadow-emerald-500/5">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-zinc-950 px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase">
              الأكثر طلباً ⭐
            </div>
            <div>
              <h3 className="font-bold text-lg text-zinc-200">باقة النمو (Growth)</h3>
              <p className="text-xs text-zinc-400 mt-1">مثالية للمراكز الطبية ذات الكفاءات المتعددة</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-emerald-400">2,999</span>
                <span className="text-xs text-zinc-400">ريال / شهرياً</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-zinc-400 border-t border-zinc-850 pt-6">
                <li>🟢 معالجة حتى 5,000 محادثة شهرياً</li>
                <li>🟢 تتبع مصادر الزوار (سناب، إنستقرام، جوجل)</li>
                <li>🟢 تخصيص كامل للردود وقائمة الأطباء والأسعار</li>
                <li>🟢 تقارير وتحليلات تحويل المبيعات شهرياً</li>
                <li>🟢 دعم فني مخصص وسريع</li>
              </ul>
            </div>
            <a href="/dashboard" className="mt-8 block w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 text-center text-xs font-extrabold shadow-lg shadow-emerald-500/10 transition-all">
              اشترك الآن
            </a>
          </div>

          {/* Tier 3 */}
          <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl flex flex-col justify-between hover:border-zinc-800 transition-colors">
            <div>
              <h3 className="font-bold text-lg text-zinc-200">باقة المجموعات (Enterprise)</h3>
              <p className="text-xs text-zinc-400 mt-1">للمجموعات الكبيرة ومراكز التجميل متعددة الفروع</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-zinc-100">5,999</span>
                <span className="text-xs text-zinc-400">ريال / شهرياً</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-zinc-400 border-t border-zinc-850 pt-6">
                <li>🟢 عدد محادثات غير محدود شهرياً</li>
                <li>🟢 توجيه الحجوزات للفروع المتعددة آلياً</li>
                <li>🟢 تخصيص عدة موظفات AI بمهام مختلفة</li>
                <li>🟢 ربط مخصص مع أنظمة العيادات (HIS/CRM)</li>
                <li>🟢 اتفاقية مستوى الخدمة للدعم الفني 24/7</li>
              </ul>
            </div>
            <a href="/dashboard" className="mt-8 block w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-center text-xs font-bold transition-all">
              تواصل معنا 📞
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 mt-auto">
        <div className="max-w-6xl mx-auto w-full px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
              CA
            </div>
            <span className="font-extrabold text-sm text-zinc-200">Clinic AI</span>
          </div>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} مشروع Clinic AI. جميع الحقوق محفوظة لتطوير سارة سكرتيرة العيادات الذكية.
          </p>
        </div>
      </footer>
    </div>
  );
}