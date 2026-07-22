const msg = "أبغى أحجز تنظيف البشرة العميق باسم ياسمين ورقم التواصل 0551234567 في فرع الصحافة الأحد الساعة 11 صباحاً مع د. سحر";
const m = msg.match(/(?:التواصل|رقم|جوال|هاتف|رقمي)\s*[:]?\s*([+]?[0-9\s-]{9,15})/i);
const fallback = msg.match(/(?<!\d)(?:0)?5\d{8}(?!\d)/);

console.log("m:", m);
if (m) console.log("m[1]:", m[1]);
console.log("fallback:", fallback);
