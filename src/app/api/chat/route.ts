import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

// Type definition for a message in the conversation history
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function isValidSaudiPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s-]/g, "");
  return /^(?:\+?966|0)?5\d{8}$/.test(clean);
}

// Normalization layer: matches GPT's extracted text to official DB names
// GPT suggests → code matches → DB name is the single source of truth
function normalizeToOfficial(
  extracted: string | null,
  officialList: string[]
): string | null {
  if (!extracted) return null;
  const clean = extracted.trim().toLowerCase();

  // 1. Exact match
  const exact = officialList.find((o) => o.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Partial containment (official contains extracted OR extracted contains official)
  const partial = officialList.find(
    (o) => o.toLowerCase().includes(clean) || clean.includes(o.toLowerCase())
  );
  if (partial) return partial;

  // 3. Word-level overlap score
  const words = clean.split(/\s+/);
  const scored = officialList
    .map((o) => {
      const oWords = o.toLowerCase().split(/\s+/);
      const overlap = words.filter((w) =>
        oWords.some((ow) => ow.includes(w) || w.includes(ow))
      ).length;
      return { name: o, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);

  if (scored[0]?.overlap > 0) return scored[0].name;

  return null; // no match — leave as null, don’t guess
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, clientPhone, clinicSlug, source = "Simulator", action } = body;

    if (!clientPhone || !clinicSlug) {
      return NextResponse.json(
        { error: "Missing required fields: clientPhone, clinicSlug" },
        { status: 400 }
      );
    }

    // 1. Fetch the clinic with all catalog data
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
      include: {
        branches: true,
        doctors: true,
        services: true,
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    // Handle Reset Action
    if (action === "reset") {
      await prisma.conversation.deleteMany({
        where: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      });
      return NextResponse.json({ success: true, message: "Conversation reset successfully" });
    }

    if (!message) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 450 });
    }

    // 2. Fetch or create the conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        clinicId_clientPhone: {
          clinicId: clinic.id,
          clientPhone: clientPhone,
        },
      },
    });

    let history: ChatMessage[] = [];
    if (conversation && conversation.messages) {
      history = conversation.messages as unknown as ChatMessage[];
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    history.push(userMsg);

    let responseText = "";
    let humanTakeover = false;
    let extractedBookingData: any = null;

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey && apiKey.startsWith("sk-")) {
      // --- OPENAI MODE ---
      // Build dynamic lists for prompt
      const branchesList = clinic.branches.map((b) => b.name).join(" - ");
      const doctorsList = clinic.doctors.map((d) => `${d.name} (${d.specialty})`).join(" - ");
      const servicesList = clinic.services.map((s) => `${s.name} (${s.price} ريال)`).join(" - ");

      // Read base system prompt from file
      let baseSystemPrompt = "أنتِ سارة، مساعدة ذكية لعيادة التجميل.";
      try {
        const promptFilePath = path.join(process.cwd(), "src/app/api/chat/system_prompt.txt");
        baseSystemPrompt = fs.readFileSync(promptFilePath, "utf8");
      } catch (err) {
        console.error("Error reading system_prompt.txt, using fallback:", err);
      }

      // Dynamic system prompt incorporating catalog and rules
      const systemPrompt = `
${baseSystemPrompt}

اسم العيادة الحالي: ${clinic.name}
التعليمات الخاصة بالعيادة:
${clinic.customPrompt || "تحدثي باسم العيادة بلطف وسجلي المواعيد."}

قائمة الخدمات المتوفرة في العيادة وأسعارها:
${servicesList}

قائمة الأطباء والأخصائيين المتاحين:
${doctorsList}

قائمة فروع العيادة الجغرافية:
${branchesList}

مصدر قدوم العميل الحالي: ${source}

التعليمات الفنية المهمة جداً:
- يجب أن تكون إجابتك بصيغة JSON فقط متوافقة مع هذا الهيكل:
{
  "response": "نص الرد الخاص بكِ باللهجة البيضاء السعودية اللبقة والمحترمة، مخاطبة العميل بالمؤنث افتراضياً، وبشكل قصير ومحدد.",
  "humanTakeover": false, // اجعليها true فقط إذا كان العميل غاضباً، أو لديه شكوى، أو يصر على استشارة طبية معقدة، أو يطلب التحدث مع بشري.
  "bookingData": {
    "clientName": "الاسم الثلاثي للعميل إذا تم ذكره (سواء في هذه الرسالة أو في الرسائل السابقة)، وإلا ضعيه null",
    "clientPhone": "رقم الجوال الذي ذكره العميل، وإلا ضعيه null",
    "serviceName": "اسم الخدمة المطلوبة تماماً كما وردت في قائمة الخدمات أعلاه إذا حددها، وإلا null",
    "doctorName": "اسم الطبيب المختار تماماً كما ورد في قائمة الأطباء أعلاه إذا حدده، وإلا null",
    "branchName": "اسم الفرع المختار تماماً كما ورد في قائمة الفروع أعلاه إذا حدده، وإلا null",
    "timeSlot": "الوقت والتاريخ المفضل للحجز (مثال: مساء السبت، أو صباح الثلاثاء) إذا تم تحديده، وإلا null"
  }
}

ملاحظات توجيهية:
1. اجمعي البيانات الخمسة بالتسلسل. لا تسألي عن شيئين معاً.
2. إذا تم جمع البيانات الخمسة بالكامل (الاسم ورقم الجوال، الخدمة، الطبيب، الفرع، والوقت المفضل)، صممي تذكرة حجز مبدئي واضحة داخل الـ response واشرحي للعميلة أن موظف الاستقبال سيتواصل لتأكيد الحجز النهائي.
3. التزمي التام بعدم إعطاء تشخيص طبي والاعتذار بلطف.
`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
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
          const errText = await response.text();
          throw new Error(`OpenAI API error: ${errText}`);
        }

        const data = await response.json();
        const rawJson = data.choices[0].message.content;
        const parsed = JSON.parse(rawJson);

        if (!parsed || typeof parsed.response !== "string") {
          throw new Error("Invalid or empty response string from OpenAI");
        }

        responseText = parsed.response;
        humanTakeover = !!parsed.humanTakeover;
        extractedBookingData = parsed.bookingData;
      } catch (error) {
        console.error("Error calling OpenAI:", error);
        // If OpenAI fails, run fallback simulator so the system doesn't crash
        const fallback = runFallbackSimulation(history, clinic, clientPhone);
        responseText = fallback.response;
        extractedBookingData = fallback.bookingData;
      }
    } else {
      // --- FALLBACK SIMULATION MODE ---
      // Runs locally when no API Key is available
      const fallback = runFallbackSimulation(history, clinic, clientPhone);
      responseText = fallback.response;
      extractedBookingData = fallback.bookingData;
    }

    // Apply Normalization: replace GPT's extracted names with official DB names
    if (extractedBookingData) {
      const serviceNames = clinic.services.map((s: any) => s.name);
      const doctorNames = clinic.doctors.map((d: any) => d.name);
      const branchNames = clinic.branches.map((b: any) => b.name);

      extractedBookingData.serviceName = normalizeToOfficial(
        extractedBookingData.serviceName,
        serviceNames
      );
      extractedBookingData.doctorName = normalizeToOfficial(
        extractedBookingData.doctorName,
        doctorNames
      );
      extractedBookingData.branchName = normalizeToOfficial(
        extractedBookingData.branchName,
        branchNames
      );
    }

    // 3. Save assistant message to history
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: responseText,
      timestamp: new Date().toISOString(),
    };
    history.push(assistantMsg);

    // 4. Update conversation in DB
    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { messages: history as any },
      });
    } else {
      await prisma.conversation.create({
        data: {
          clientPhone,
          clinicId: clinic.id,
          messages: history as any,
        },
      });
    }

    // 5. If bookingData is fully complete, create a Booking record
    let bookingCreated = null;
    let existingBookingFound = false; // Business Decision flag
    const hasName = extractedBookingData?.clientName && extractedBookingData.clientName.trim().length > 1;
    const phoneToUse = extractedBookingData?.clientPhone || clientPhone;
    const isPhoneValid = isValidSaudiPhone(phoneToUse);
    const hasService = extractedBookingData?.serviceName;
    const hasBranch = extractedBookingData?.branchName;
    const hasTime = extractedBookingData?.timeSlot;

    if (
      extractedBookingData &&
      hasName &&
      isPhoneValid &&
      hasService &&
      hasBranch &&
      hasTime
    ) {
      const finalPhone = phoneToUse.replace(/[\s-]/g, "");
      const finalDoctor = extractedBookingData.doctorName || "غير محدد (أي طبيب متاح)";

      // Check if this booking already exists to prevent duplicate bookings from page reloads
      const existingBooking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: finalPhone,
          serviceName: extractedBookingData.serviceName,
          doctorName: finalDoctor,
          branchName: extractedBookingData.branchName,
          timeSlot: extractedBookingData.timeSlot,
        },
      });

      if (!existingBooking) {
        bookingCreated = await prisma.booking.create({
          data: {
            clientName: extractedBookingData.clientName,
            clientPhone: finalPhone,
            serviceName: extractedBookingData.serviceName,
            doctorName: finalDoctor,
            branchName: extractedBookingData.branchName,
            timeSlot: extractedBookingData.timeSlot,
            source: source,
            clinicId: clinic.id,
            status: "PENDING",
          },
        });
        console.log("New booking created automatically:", bookingCreated.id);
      } else {
        // Business Decision: Duplicate detected
        // Response Builder overrides AI response — Business Logic owns the decision, not AI
        existingBookingFound = true;
        console.log("Duplicate booking detected, overriding AI response:", existingBooking.id);
        responseText = `لديكِ طلب حجز مُسجَّل بالفعل 🌷\n\n✅ الاسم: ${existingBooking.clientName}\n✅ الجوال: ${existingBooking.clientPhone}\n✅ الخدمة: ${existingBooking.serviceName}\n✅ الطبيب: ${existingBooking.doctorName}\n✅ الفرع: ${existingBooking.branchName}\n✅ الوقت المفضل: ${existingBooking.timeSlot}\n\nطلبك قيد المراجعة من موظف الاستقبال، وسيتواصل معكِ لتأكيد الموعد النهائي. 🌸`;
      }
    }

    return NextResponse.json({
      response: responseText,
      humanTakeover,
      bookingData: extractedBookingData,
      bookingCreated: !!bookingCreated,
      existingBookingFound,
    });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// Simple Rule-Based Simulator for local/demo testing without OpenAI API Key
function runFallbackSimulation(history: ChatMessage[], clinic: any, clientPhone: string) {
  // Extract all user messages to check inputs
  const userMessages = history
    .filter((h) => h.role === "user")
    .map((h) => h.content.trim());

  // Extracted fields placeholder
  let clientName: string | null = null;
  let serviceName: string | null = null;
  let doctorName: string | null = null;
  let branchName: string | null = null;
  let timeSlot: string | null = null;

  // Analyze conversation to extract state
  // Let's check user inputs to match our database values
  for (const text of userMessages) {
    // 1. Name Check (Usually in first/second response)
    if (text.includes("اسمي") || text.includes("معاك") || text.includes("أنا")) {
      const match = text.match(/(?:اسمي|معاك|أنا)\s+([أ-ي\s]{3,20})/);
      if (match) clientName = match[1].trim();
    } else if (
      text.split(" ").length >= 2 &&
      text.split(" ").length <= 4 &&
      !clientName &&
      !text.includes("ريال") &&
      !text.includes("فرع") &&
      !text.includes("؟") &&
      !text.includes("علاج") &&
      !text.includes("حبوب") &&
      !text.includes("السلام")
    ) {
      // Fallback name capture
      clientName = text;
    }

    // 2. Service Check
    for (const service of clinic.services) {
      if (text.includes(service.name) || text.toLowerCase().includes(service.name.toLowerCase())) {
        serviceName = service.name;
      }
    }

    // 3. Doctor Check
    for (const doc of clinic.doctors) {
      if (text.includes(doc.name) || text.toLowerCase().includes(doc.name.toLowerCase())) {
        doctorName = doc.name;
      }
    }

    // 4. Branch Check
    for (const b of clinic.branches) {
      if (text.includes(b.name) || text.includes(b.name.replace("فرع ", ""))) {
        branchName = b.name;
      }
    }

    // 5. Time Check
    if (text.includes("صباح") || text.includes("مساء") || text.includes("يوم") || text.includes("الساعة")) {
      timeSlot = text;
    }
  }

  // Formatting response based on state machine
  let response = "";

  if (!clientName) {
    response = `يا هلا ومسهلا بكِ في ${clinic.name} 🌸\nأنا سارة مساعدتك الذكية عشان أخدمك في الحجوزات والاستفسارات. ممكن تفيديني باسمك الكريم ورقم جوالك عشان نسجلك بالنظام؟`;
  } else if (!serviceName) {
    const listServices = clinic.services.map((s: any) => `- ${s.name} (${s.price} ريال)`).join("\n");
    response = `حياكِ الله يا ${clientName}، تسعدنا خدمتكِ 💖\nوش الإجراء اللي حابة تحجزيه اليوم؟ عندنا هذه الخدمات الرائعة حالياً:\n${listServices}`;
  } else if (!doctorName) {
    const listDocs = clinic.doctors.map((d: any) => `- ${d.name} (${d.specialty})`).join("\n");
    response = `تسلمين يا قلبي، بخصوص خدمة (${serviceName})، هل فيه طبيب أو أخصائي معين تفضلين تحجزين معه؟\nمتاح عندنا:\n${listDocs}\n(أو تقدرين تقولين المتاح)`;
  } else if (!branchName) {
    const listBranches = clinic.branches.map((b: any) => `- ${b.name}`).join("\n");
    response = `تمام يا روحي، الحجز مع (${doctorName}). أي فرع يناسبك أكثر للزيارة؟\nمتاح عندنا:\n${listBranches}`;
  } else if (!timeSlot) {
    response = `على راسي، حجزك في (${branchName}). وش الوقت والتاريخ المفضل لكِ؟ تفضلين فترات صباحية (9 لـ 12) ولا مسائية (4 لـ 9)؟ وفي أي يوم؟`;
  } else {
    // All captured
    response = `ألف مبروك يا عيوني! تم تسجيل طلب حجزك المبدئي بنجاح 🎉
  
📋 تفاصيل تذكرة الحجز:
👤 الاسم: ${clientName}
📞 الجوال: ${clientPhone}
🏥 الفرع: ${branchName}
🩺 الطبيب: ${doctorName}
💆‍♀️ الخدمة: ${serviceName}
⏰ الموعد المفضل: ${timeSlot}
  
الآن حجزك تسجل بالنظام، وموظف الاستقبال بيتواصل معك لتأكيده النهائي خلال دقائق بسيطة. ننتظرك بكل حب! 💕`;
  }

  return {
    response,
    bookingData: {
      clientName,
      clientPhone,
      serviceName,
      doctorName,
      branchName,
      timeSlot,
    },
  };
}
