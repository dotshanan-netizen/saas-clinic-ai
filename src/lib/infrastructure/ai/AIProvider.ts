import { ChatMessage, ExtractedBookingData, ClinicWithCatalog } from "@/lib/domain/types";
import fs from "fs";
import path from "path";

export type AIIntent = 
  | "BookAppointment" 
  | "CancelAppointment" 
  | "Inquiry" 
  | "Complaint" 
  | "HumanTakeover"
  | "Unknown";

export interface AIClassificationResult {
  response: string;
  intent: AIIntent;
  humanTakeover: boolean;
  requiresRag: boolean;
  bookingData: ExtractedBookingData;
}

export class AIProvider {
  static async classifyIntentAndExtractData(
    clinic: ClinicWithCatalog,
    history: ChatMessage[],
    source: string,
    currentState: any
  ): Promise<AIClassificationResult> {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey && (!openaiKey || !openaiKey.startsWith("sk-"))) {
      throw new Error("No valid AI Provider keys found.");
    }

    const branchesList = clinic.branches.map((b) => b.name).join(" - ");
    const servicesList = clinic.services.map((s) => `${s.name} (${s.price} ريال)`).join(" - ");

    // Build Service to Doctors mapping
    const serviceToDoctors: Record<string, string[]> = {};
    clinic.services.forEach(s => serviceToDoctors[s.name] = []);
    clinic.doctors.forEach((d) => {
      if (d.services && d.services.length > 0) {
        d.services.forEach(ds => {
          if (serviceToDoctors[ds.service.name]) {
            serviceToDoctors[ds.service.name].push(`${d.name} (${d.specialty})`);
          }
        });
      } else {
        // Fallback
        if (!serviceToDoctors["عام"]) serviceToDoctors["عام"] = [];
        serviceToDoctors["عام"].push(`${d.name} (${d.specialty})`);
      }
    });
    const doctorsMappingStr = JSON.stringify(serviceToDoctors, null, 2);

    let baseSystemPrompt = "أنتِ سارة، مساعدة ذكية لعيادة التجميل.";
    try {
      const promptFilePath = path.join(process.cwd(), "src/app/api/chat/system_prompt.txt");
      baseSystemPrompt = fs.readFileSync(promptFilePath, "utf8");
    } catch (err) {
      console.warn("Could not read system_prompt.txt, using fallback.");
    }

    const systemPrompt = `
${baseSystemPrompt}

اسم العيادة الحالي: ${clinic.name}
التعليمات الخاصة بالعيادة:
${clinic.customPrompt || "تحدثي باسم العيادة بلطف."}

الخدمات المتوفرة: ${servicesList}
الأطباء المرتبطين بكل خدمة:
${doctorsMappingStr}
الفروع: ${branchesList}

--- 
البيانات الحالية للعميل (Current State):
الاسم: ${currentState.clientName || 'غير محدد'}
رقم الجوال: ${currentState.clientPhone || 'غير محدد'}
الخدمة المطلوبة: ${currentState.serviceName || 'غير محدد'}
الطبيب: ${currentState.doctorName || 'غير محدد'}
الفرع: ${currentState.branchName || 'غير محدد'}
الوقت المفضل: ${currentState.timeSlot || 'غير محدد'}

التعليمات الفنية لعملك كمحرك ذكاء اصطناعي آمن:
- تذكري البيانات الحالية جيداً ولا تطلبيها مرة أخرى من العميل!
- لإنشاء حجز (BookAppointment)، يجب أن تجمعي 6 بيانات أساسية: (الاسم، الجوال، الخدمة، الطبيب، الفرع، الوقت).
- لا تقومي أبداً بتأكيد الحجز أو إخبار المستخدم بأنه "تم رفع الطلب" إلا إذا اكتملت جميع البيانات الستة. إذا كانت هناك بيانات ناقصة، استمري في سؤال المستخدم عنها بلطف ضمن حقل "response".
- إذا سأل العميل عن المواعيد المتاحة، فلا تدّعي أنك تستطيعين التحقق من جدول المواعيد مباشرة. اطلبي منه اليوم أو الوقت المفضل إذا لم يذكره، ثم أوضحي أن فريق الاستقبال سيؤكد الموعد النهائي حسب التوفر. وإذا كان العميل قد ذكر بالفعل الوقت أو اليوم المفضل، فلا تطلبيه مرة أخرى، واكتفي بإبلاغه أن فريق الاستقبال سيؤكد التوفر.
- عند طلب الاسم والجوال لأول مرة، استخدمي صيغة لطيفة ومباشرة، مثلاً: "ممتاز 🌷 حتى أتمكن من حجز موعد لك مع [الطبيب] لـ [الخدمة]، أحتاج: الاسم الكامل، ورقم الجوال."

- يجب عليك تحديد نية المستخدم بدقة وإرجاع رد بصيغة JSON فقط:
{
  "response": "ردك باللغة العربية",
  "intent": "BookAppointment | CancelAppointment | Inquiry | Complaint | HumanTakeover | Unknown",
  "humanTakeover": false,
  "requiresRag": false,
  "bookingData": {
    "clientName": "...",
    "clientPhone": "...",
    "serviceName": "...",
    "doctorName": "...",
    "branchName": "...",
    "timeSlot": "..."
  }
}

قواعد هامة جداً للاستفسارات (Inquiry):
- اجعل "requiresRag": false إذا كنت تستطيعين الإجابة بناءً على أسماء الخدمات، الأطباء، الفروع المتوفرة أعلاه أو من البيانات الحالية للعميل، واكتبي الإجابة كاملة في حقل response.
- اجعل "requiresRag": true فقط إذا كان السؤال يحتاج للبحث في قاعدة المعرفة (كأسئلة عن سياسات العيادة، أجهزة غير مذكورة، الخ) ولا تكتبي إجابة من تأليفك.
`;

    let rawJson = "";

    try {
      if (geminiKey) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`;
        
        const contents = history.slice(-10).map((h) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content || "" }]
        }));

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json"
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`AI API Error: ${await response.text()}`);
        }
        
        const data = await response.json();
        rawJson = data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("No Gemini key");
      }
    } catch (e) {
      // Fallback to OpenAI if Gemini fails
      const apiUrl = "https://api.openai.com/v1/chat/completions";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            ...history.slice(-10).map((h) => ({ role: h.role, content: h.content || "" })),
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API Error: ${await response.text()}`);
      }

      const data = await response.json();
      rawJson = data.choices[0].message.content;
    }

    const parsed = JSON.parse(rawJson);

    return {
      response: parsed.response || "",
      intent: parsed.intent || "Unknown",
      humanTakeover: !!parsed.humanTakeover,
      requiresRag: !!parsed.requiresRag,
      bookingData: parsed.bookingData || {
        clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null
      }
    };
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    try {
      if (!geminiKey) throw new Error("No Gemini Key");
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`;
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] }
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding Error: ${await response.text()}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (e) {
      if (!openaiKey) throw new Error("No OpenAI Key for fallback embedding");
      const apiUrl = "https://api.openai.com/v1/embeddings";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small", // Wait, dimensions must match!
          // BUT schema has vector(768). text-embedding-3-small can output 768 dimensions!
          dimensions: 768,
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI Embedding Error: ${await response.text()}`);
      }
      const data = await response.json();
      return data.data[0].embedding;
    }
  }
}
