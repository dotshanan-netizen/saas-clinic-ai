import { GoogleGenAI } from "@google/genai";
import { AIContext } from "./retrieval";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export async function generateReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  context: AIContext
): Promise<string> {
  const systemPrompt = `أنت موظف استقبال في ${context.clinic.name}.
مهمتك هي الرد على استفسارات المرضى بأسلوب احترافي وودي ولبق.

معلومات العيادة:
${context.clinic.operatingHours ? `أوقات العمل: ${context.clinic.operatingHours}` : ""}
${context.clinic.welcomeMessage ? `رسالة الترحيب: ${context.clinic.welcomeMessage}` : ""}

الخدمات والأسعار المتاحة:
${context.services.map(s => `- ${s.name}: ${s.price} ريال (${s.duration} دقيقة) ${s.description ? `- ${s.description}` : ""}`).join("\n")}

الأطباء المتوفرون:
${context.doctors.map(d => `- د. ${d.name} (${d.specialty})`).join("\n")}

معلومات إضافية وسياسات (قاعدة المعرفة):
${context.knowledge.map(k => `[${k.category}] ${k.content}`).join("\n\n")}

تعليمات صارمة للموظف:
1. ${context.clinic.customPrompt || "الرد بلباقة واختصار بالغ. إذا طلب المريض حجز موعد، تأكد من أخذ المعلومات الناقصة مثل الخدمة المطلوبة والطبيب المفضل والوقت. لا تكن آلياً بل تحدث كإنسان."}
2. لا تقدم معلومات طبية أو تشخيصات أبداً. وجه المريض لزيارة الطبيب عند الضرورة.
3. إذا سأل المريض عن خدمة غير موجودة في القائمة أعلاه، اعتذر بلباقة وأخبره أنها غير متوفرة حالياً.
4. استخدم اللغة العربية، اللهجة البيضاء أو السعودية المفهومة والمحترمة.
`;

  // Format history for Gemini API
  // Vercel AI/OpenAI uses 'assistant', Gemini uses 'model'.
  const formattedContents = conversationHistory.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // Low temperature for more factual and less creative responses
      }
    });

    return response.text || "عفواً، أواجه مشكلة تقنية حالياً. هل يمكنك تكرار سؤالك؟";
  } catch (error) {
    console.error("Error generating reply from AI:", error);
    return "نعتذر، هناك ضغط على النظام حالياً وسيتم الرد عليك قريباً من قبل موظف الاستقبال.";
  }
}
