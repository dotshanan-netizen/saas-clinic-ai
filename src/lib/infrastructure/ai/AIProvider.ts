import { ChatMessage, ExtractedBookingData, ClinicWithCatalog } from "@/lib/domain/types";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { Logger } from "../logging/Logger";

const AIResponseSchema = z.object({
  response: z.string().default(""),
  intent: z.enum(["BookAppointment", "CancelAppointment", "ModifyBooking", "Inquiry", "Complaint", "HumanTakeover", "Objection", "Unknown"]).catch("Unknown"),
  humanTakeover: z.boolean().catch(false).default(false),
  requiresRag: z.boolean().catch(false).default(false),
  bookingData: z.object({
    clientName: z.string().nullable().optional().catch(null),
    clientPhone: z.string().nullable().optional().catch(null),
    serviceName: z.string().nullable().optional().catch(null),
    doctorName: z.string().nullable().optional().catch(null),
    branchName: z.string().nullable().optional().catch(null),
    timeSlot: z.string().nullable().optional().catch(null),
  }).catch({ clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null }).default({ clientName: null, clientPhone: null, serviceName: null, doctorName: null, branchName: null, timeSlot: null })
});

export type AIIntent = 
  | "BookAppointment" 
  | "CancelAppointment" 
  | "ModifyBooking"
  | "Inquiry" 
  | "Complaint" 
  | "HumanTakeover"
  | "Objection"
  | "Unknown";

export interface AIClassificationResult {
  response: string;
  intent: AIIntent;
  humanTakeover: boolean;
  requiresRag: boolean;
  bookingData: ExtractedBookingData;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  diagnostic?: {
    systemPrompt: string;
    rawResponse: string;
  };
}

export class AIProvider {
  static async classifyIntentAndExtractData(
    clinic: ClinicWithCatalog,
    history: ChatMessage[],
    source: string,
    currentState: Record<string, unknown>,
    availableSlotsText: string = "",
    businessProfile: string = ""
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
    } catch {
      console.warn("Could not read system_prompt.txt, using fallback.");
    }

    const systemPrompt = `
${baseSystemPrompt}

اسم العيادة الحالي: ${clinic.name}
التعليمات الخاصة بالعيادة:
${clinic.customPrompt || "تحدثي باسم العيادة بلطف."}

دليل التشغيل وقواعد العمل (Business Profile):
${businessProfile || "غير محدد"}

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

${availableSlotsText ? `\n--- الأوقات المتاحة فعلياً للطبيب المحدد ---\n${availableSlotsText}\nاعتمدي حصراً على هذه الأوقات ولا تقترحي أوقاتاً من خارجها.\n` : ""}

التعليمات الفنية لعملك كمحرك ذكاء اصطناعي آمن:
- إذا كان طلب المستخدم هو حجز موعد (مثل: "أبغى أحجز"، "احجز لي"، "أريد الحجز"، "عاوزة احجز"، "أبي موعد"، "أحتاج موعد"، "أبغى موعد"، "حجز"، إلخ)، أو كان العميل يستكمل معك بيانات الحجز بالرد على أسئلتك (مثل تقديم الخدمة، الطبيب، الفرع، الاسم، أو الموعد)، فيجب تصنيف النية دائماً كـ "BookAppointment" لمتابعة وتجميع البيانات.
- تنبيه هام: لا تجعلي النية أبداً "Unknown" أو "Inquiry" عندما يذكر العميل أي معلومة تخص الحجز (كالخدمة أو الفرع أو الموعد) طالما بدأت عملية الحجز.
- لإنشاء حجز (BookAppointment)، يجب أن تجمعي 5 بيانات أساسية: (الاسم، الخدمة، الطبيب، الفرع، الوقت).
- لا تقومي أبداً بتأكيد الحجز أو إخبار المستخدم بأنه "تم الحجز" إلا إذا اكتملت جميع البيانات الخمسة. إذا كانت هناك بيانات ناقصة، اجعلي النية "BookAppointment" واستمري في سؤال المستخدم عنها بلطف ضمن حقل "response".
- اقترحي دائماً أوقاتاً متاحة وحقيقية من قائمة "الأوقات المتاحة فعلياً". إذا لم يذكر العميل طبيباً بعد، اطلبي منه اختيار الطبيب.
- عند طلب الاسم لأول مرة، استخدمي صيغة لطيفة ومباشرة.

- إذا طلب المستخدم إلغاء حجز قائم أو إلغاء طلب الحجز الحالي (بما في ذلك التعبيرات الصريحة أو الضمنية أو اللهجات أو الأخطاء الإملائية مثل: "ألغي حجزي"، "كنسل"، "احذف الموعد"، "احذفه لو سمحت"، "الغي الموعد"، "خلاص بلاش"، "ما أبي أكمل"، "انس الموضوع"، "طنش"، "مو ضروري"، "فلتلغ الموعد"، "مش عاوز احجز خلاص"، "شيل الحجز يا طيب"، "تراجعت عن الحجز"، "ألقيه"، "كنسله", "الغيي الحجز"، "الغي")، فاجعلي النية دائماً "CancelAppointment" (ولا تجعليها HumanTakeover أو Complaint).
- هام جداً: إذا قال المستخدم "خلاص شكراً" أو "شكراً خلاص" أو "بلاش خلاص" أو "ما ودي خلاص" أثناء عملية جمع بيانات الحجز، فيجب تصنيف النية كـ "CancelAppointment" فوراً (لأنها تعني التراجع وإلغاء الجلسة).
- عبارات التردد أو التفكير أو الاعتراض على الأسعار (مثل: "بفكر بالموضوع"، "بشاور زوجي"، "بشوف الميزانية"، "غالي") تصنف كـ "Objection" أو "Inquiry" وليست CancelAppointment أبداً.
- كلمات الشكر البسيطة دون كلمة "خلاص" (مثل: "شكراً"، "تسلم"، "يعطيك العافية") هي مجرد استفسار أو إنهاء ودود للمحادثة (Inquiry) ولا تصنفيها كـ "CancelAppointment" أبداً.
- إذا طلب المستخدم تعديل/تغيير تفاصيل حجز قائم (مثل الفرع، الخدمة، الطبيب، أو الموعد)، اجعلي النية "ModifyBooking" وقومي بتحديث الحقول المطلوبة في "bookingData" مع الاحتفاظ بباقي التفاصيل كما هي في (Current State).
- إذا ذكر المستخدم رقماً صريحاً للتواصل بخصوص الحجز (مثال: "رقم التواصل 0551234567")، يجب استخراجه وحفظه في حقل "clientPhone" في الـ "bookingData" وتصنيف النية كـ "BookAppointment" (طالما هو طلب حجز جديد).


- يجب عليك تحديد نية المستخدم بدقة وإرجاع رد بصيغة JSON فقط:
{
  "response": "ردك باللغة العربية",
  "intent": "BookAppointment | CancelAppointment | ModifyBooking | Inquiry | Complaint | HumanTakeover | Objection | Unknown",
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
- اجعل "requiresRag": true فقط إذا كان السؤال يحتاج للبحث في قاعدة المعرفة (كأسئلة عن سياسات العيادة، أجهزة غير مذكورة، الخ)، واكتبي في حقل response رداً احتياطياً مناسباً بصيغة: "سأبحث عن هذه المعلومة لك، هل يمكنك الانتظار لحظة؟" أو ما يناسب السياق — حتى يكون الرد مفيداً في حال فشل البحث.
`;

    let rawJson = "";
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number; } | null = null;

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
        console.log("[DEBUG Gemini response]:", JSON.stringify(data, null, 2));
        rawJson = data.candidates[0].content.parts[0].text;
        if (data.usageMetadata) {
          usage = {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0
          };
        }
      } else {
        throw new Error("No Gemini key");
      }
    } catch (err: any) {
      console.error("[Gemini Fetch Failed, falling back to OpenAI]:", err.message || err);
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

      try {
        if (!response.ok) {
          throw new Error(`AI API Error: ${await response.text()}`);
        }

        const data = await response.json();
        console.log("[DEBUG OpenAI response]:", JSON.stringify(data, null, 2));
        rawJson = data.choices[0].message.content;
        if (data.usage) {
          usage = {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
          };
        }
      } catch (openAiErr: any) {
        console.error("[OpenAI Fallback Also Failed]:", openAiErr.message || openAiErr);
        throw openAiErr;
      }
    }

    let parsed: z.infer<typeof AIResponseSchema>;
    try {
      // Basic cleanup for possible markdown code blocks around JSON
      let cleanedRawJson = rawJson.trim();
      if (cleanedRawJson.startsWith("```json")) {
        cleanedRawJson = cleanedRawJson.substring(7);
      } else if (cleanedRawJson.startsWith("```")) {
        cleanedRawJson = cleanedRawJson.substring(3);
      }
      if (cleanedRawJson.endsWith("```")) {
        cleanedRawJson = cleanedRawJson.slice(0, -3);
      }
      
      const rawParsed = JSON.parse(cleanedRawJson);
      const validationResult = AIResponseSchema.safeParse(rawParsed);
      
      if (validationResult.success) {
        parsed = validationResult.data;
      } else {
        console.error("Zod AI response validation failed:", validationResult.error);
        Logger.metric("zod_validation_error", 1, { requestId: "unknown", clinicId: clinic.id, error: validationResult.error.message });
        parsed = AIResponseSchema.parse({});
      }
    } catch (e: any) {
      console.error("Failed to parse AI response JSON", e);
      Logger.metric("json_parse_error", 1, { requestId: "unknown", clinicId: clinic.id, error: e.message });
      parsed = AIResponseSchema.parse({});
    }

    // ── POST-AI INTENT SAFEGUARD ──────────────────────────────────────────────
    // If the AI returned Unknown but the last user message clearly indicates a
    // booking request, correct the intent to BookAppointment. This catches model
    // failures where the AI fails to recognize common booking phrases despite
    // explicit prompt instructions. The BusinessEngine also has a similar safety
    // net (line 256-258) but earlier correction prevents empty responses from
    // propagating through the Intent-Aware Merge.
    const lastMsg = history.length > 0 ? history[history.length - 1] : null;
    if ((parsed.intent === "Unknown" || parsed.intent === "Inquiry") && lastMsg?.role === "user") {
      const userText = lastMsg.content || "";
      const isBookingRequest = /حجز|أحجز|موعد|احجز|book/i.test(userText)
        && !/إلغاء|كنسل|تعديل|تغيير|cancel|modify|delete/i.test(userText);
      if (isBookingRequest) {
        parsed.intent = "BookAppointment";
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    return {
      response: parsed.response,
      intent: parsed.intent as AIIntent,
      humanTakeover: parsed.humanTakeover,
      requiresRag: parsed.requiresRag,
      bookingData: parsed.bookingData as ExtractedBookingData,
      usage,
      diagnostic: {
        systemPrompt,
        rawResponse: rawJson,
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
    } catch {
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
