import { prisma } from "../db";
import { ClinicWithCatalog, ExtractedBookingData, validateBookingData, extractSaudiPhone } from "./types";
import { Logger } from "../infrastructure/logging/Logger";

function normalizeToOfficial(extracted: string | null, officialList: string[]): string | null {
  if (!extracted) return null;
  const clean = extracted.trim().toLowerCase();
  const exact = officialList.find((o) => o.toLowerCase() === clean);
  if (exact) return exact;
  const partial = officialList.find(
    (o) => o.toLowerCase().includes(clean) || clean.includes(o.toLowerCase())
  );
  if (partial) return partial;
  return null;
}

export class BusinessEngine {
  static async processIntent(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    userMessage: string,
    aiResult: {
      intent: string;
      bookingData: ExtractedBookingData | null;
      requiresRag: boolean;
      response: string;
      humanTakeover: boolean;
    },
    source: string,
    currentState?: ExtractedBookingData
  ): Promise<{
    finalResponse: string;
    bookingCreated: boolean;
    bookingModified: boolean;
    modifiedBookingData: ExtractedBookingData | null;
  }> {
    let finalResponse = aiResult.response;
    let bookingCreated = false;
    let bookingModified = false;
    let modifiedBookingData: ExtractedBookingData | null = aiResult.bookingData
      ? { ...aiResult.bookingData }
      : null;

    if (!currentState) {
      currentState = {
        clientName: null,
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };
    }

    // Robust Regex-based Fallback Extraction when AI returns empty/null fields but userMessage contains booking info
    let extractedName = aiResult.bookingData?.clientName || currentState.clientName;
    let extractedPhone = aiResult.bookingData?.clientPhone || currentState.clientPhone;
    let extractedService = aiResult.bookingData?.serviceName || currentState.serviceName;
    let extractedDoctor = aiResult.bookingData?.doctorName || currentState.doctorName;
    let extractedBranch = aiResult.bookingData?.branchName || currentState.branchName;
    let extractedTime = aiResult.bookingData?.timeSlot || currentState.timeSlot;

    if (!extractedName || extractedName === "null") {
      const nameMatch = userMessage.match(/باسم\s+([^\s]+)/) || userMessage.match(/الاسم\s+([^\s]+)/);
      if (nameMatch) extractedName = nameMatch[1].trim();
    }
    if (!extractedPhone || extractedPhone === "null") {
      const phoneMatch = userMessage.match(/(?:التواصل|رقم|جوال|هاتف|رقمي)\s*[:]?\s*([+]?[0-9\s-]{9,15})/i) || userMessage.match(/(?<!\d)(?:0)?5\d{8}(?!\d)/);
      if (phoneMatch) extractedPhone = phoneMatch[1].replace(/[\s-]/g, "");
    }
    if (!extractedService) {
      const serviceMatch = clinic.services.find(s => userMessage.includes(s.name));
      if (serviceMatch) extractedService = serviceMatch.name;
    }
    if (!extractedDoctor) {
      const doctorMatch = clinic.doctors.find(d => userMessage.includes(d.name));
      if (doctorMatch) extractedDoctor = doctorMatch.name;
    }
    if (!extractedBranch) {
      const branchMatch = clinic.branches.find(b => userMessage.includes(b.name));
      if (branchMatch) extractedBranch = branchMatch.name;
    }
    if (!extractedTime) {
      const timeMatch = userMessage.match(/(?:يوم\s+)?[^\s]*(?:الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|السبت|الجمعة)\s+(?:الساعة\s+)?\d+\s+(?:صباحاً|مساءً|ظهراً|عصراً)/) || userMessage.match(/\d+\s+(?:صباحاً|مساءً|ظهراً|عصراً)/);
      if (timeMatch) extractedTime = timeMatch[0].trim();
    }

    const sanitizedData: ExtractedBookingData = {
      clientName: extractedName,
      clientPhone: extractedPhone,
      serviceName: extractedService,
      doctorName: extractedDoctor,
      branchName: extractedBranch,
      timeSlot: extractedTime,
    };

    if (modifiedBookingData) {
      modifiedBookingData.clientName = extractedName;
      modifiedBookingData.clientPhone = extractedPhone;
      modifiedBookingData.serviceName = extractedService;
      modifiedBookingData.doctorName = extractedDoctor;
      modifiedBookingData.branchName = extractedBranch;
      modifiedBookingData.timeSlot = extractedTime;
    }

    const isNewBookingRequest = userMessage.match(/حجز|أحجز|حابة أحجز|ابغى احجز|أبي أحجز/i) && !userMessage.match(/تعديل|تغيير|تغير/i);
    let resolvedIntent = aiResult.intent;
    if (isNewBookingRequest && userMessage.match(/التواصل|رقم|جوال/i) && userMessage.match(/(?:05|966)\d{7,10}/)) {
      resolvedIntent = "BookAppointment";
    }

    if (resolvedIntent === "BookAppointment" || resolvedIntent === "ModifyBooking") {
      const branchNames = clinic.branches.map((b) => b.name);
      const serviceNames = clinic.services.map((s) => s.name);
      const doctorNames = clinic.doctors.map((d) => d.name);

      // Controlled Merge Guard using normalizeToOfficial
      if (sanitizedData.branchName !== currentState.branchName) {
        const hasMention = normalizeToOfficial(userMessage, branchNames) !== null;
        if (!hasMention) {
          sanitizedData.branchName = currentState.branchName || null;
          if (modifiedBookingData) modifiedBookingData.branchName = currentState.branchName || null;
        }
      }

      if (sanitizedData.serviceName !== currentState.serviceName) {
        const hasMention = normalizeToOfficial(userMessage, serviceNames) !== null;
        if (!hasMention) {
          sanitizedData.serviceName = currentState.serviceName || null;
          if (modifiedBookingData) modifiedBookingData.serviceName = currentState.serviceName || null;
        }
      }

      if (sanitizedData.doctorName !== currentState.doctorName) {
        const hasMention = normalizeToOfficial(userMessage, doctorNames) !== null;
        if (!hasMention) {
          sanitizedData.doctorName = currentState.doctorName || null;
          if (modifiedBookingData) modifiedBookingData.doctorName = currentState.doctorName || null;
        }
      }

      // Execute Central Validation Gate
      const validation = validateBookingData(sanitizedData, clientPhone, clinic);

      console.log(`[ValidationGate] isValid: ${validation.isValid}`);
      console.log(`[ValidationGate] Missing: ${validation.missingFields.join(", ")}`);
      console.log(`[ValidationGate] CleanName: '${validation.cleanName}'`);

      if (validation.isValid) {
        const finalPhone = validation.normalizedPhone!;
        const isModification = resolvedIntent === "ModifyBooking" || userMessage.match(/تغيير|تعديل|أغير|أعدل|خليه|بدل|غيرت/i);
        let activeBooking = null;

        if (isModification) {
          activeBooking = await prisma.booking.findFirst({
            where: {
              clinicId: clinic.id,
              clientPhone: finalPhone,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            orderBy: { createdAt: "desc" },
          });
        }

        if (activeBooking) {
          await prisma.booking.update({
            where: { id: activeBooking.id },
            data: {
              serviceName: validation.normalizedService!,
              doctorName: validation.normalizedDoctor!,
              branchName: validation.normalizedBranch!,
              timeSlot: validation.cleanTimeSlot!,
            },
          });
          bookingModified = true;
          finalResponse = `وصلني تعديل الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${validation.normalizedDoctor}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم تحديث موعدك، وسيتواصل معك موظف الاستقبال للتأكيد النهائي. 🌸`;
        } else {
          // Check for duplicates
          const existingBooking = await prisma.booking.findFirst({
            where: {
              clinicId: clinic.id,
              clientPhone: finalPhone,
              serviceName: validation.normalizedService!,
              doctorName: validation.normalizedDoctor!,
              branchName: validation.normalizedBranch!,
              timeSlot: validation.cleanTimeSlot!,
            },
          });

          if (!existingBooking) {
            await prisma.booking.create({
              data: {
                clientName: validation.cleanName!,
                clientPhone: finalPhone,
                serviceName: validation.normalizedService!,
                doctorName: validation.normalizedDoctor!,
                branchName: validation.normalizedBranch!,
                timeSlot: validation.cleanTimeSlot!,
                source: source,
                clinicId: clinic.id,
                status: "PENDING",
              },
            });
            bookingCreated = true;

            const defaultCountry = clinic.countryCode || "SA";
            const userPhoneNormalized = extractSaudiPhone(clientPhone, defaultCountry);
            const isContactPhoneDifferent = finalPhone !== userPhoneNormalized && finalPhone !== clientPhone;

            let contactNote = "";
            const isForOther = userMessage.match(/زوجتي|والدتي|أمي|اختي|أختي|بنتي|ابنتي|صديقتي|ابني|ولدي/i);

            if (isForOther && !isContactPhoneDifferent) {
              const relation = userMessage.match(/زوجتي/i) ? "زوجتك" :
                               userMessage.match(/والدتي|أمي/i) ? "والدتك" :
                               userMessage.match(/اختي|أختي/i) ? "أختك" :
                               userMessage.match(/بنتي|ابنتي/i) ? "ابنتك" :
                               userMessage.match(/صديقتي/i) ? "صديقتك" : "الشخص المعني";
              contactNote = `\n\nسأتواصل مع ${relation} على نفس رقم الواتساب الحالي، وإذا كنت تفضل رقماً آخر للتواصل، أرجو تزويدي به 🌷`;
            }

            finalResponse = `وصلني طلب الحجز بنجاح 🌷\n\n✅ الاسم: ${validation.cleanName}\n✅ الجوال: ${finalPhone}\n✅ الخدمة: ${validation.normalizedService}\n✅ الطبيب: ${validation.normalizedDoctor}\n✅ الفرع: ${validation.normalizedBranch}\n✅ الوقت المفضل: ${validation.cleanTimeSlot}\n\nتم إرسال طلبك لموظف الاستقبال، وسيتواصل معك لتأكيد الموعد النهائي حسب التوفر. 🌸${contactNote}`;
          } else {
            finalResponse = `لدينا طلب حجز مُسجّل مسبقاً بنفس التفاصيل يا ${validation.cleanName} 🌷 تم إرسال طلبك بالفعل للاستقبال. إذا أردت إنشاء طلب جديد أو تعديل الحجز، أخبرني وسأبدأ معك طلبًا جديدًا.`;
          }
        }
      } else {
        // HARD GATE BLOCKED BOOKING
        const isHallucinatedSuccess = finalResponse.match(/تم|نجاح|ارسال|رفع|وصلني|حجز/i);

        if (validation.phoneRestricted) {
          finalResponse = `عذراً، تدعم العيادة حالياً أرقام التواصل الخاصة بالدول التالية فقط: ${clinic.allowedCountries || "SA"} 🌷`;
        } else if (sanitizedData.clientPhone && !validation.normalizedPhone) {
          finalResponse = "رقم الجوال يبدو غير صحيح. أرجو تزويدنا برقم تواصل صحيح بالصيغة الدولية أو المحلية 🌷";
        } else if (isHallucinatedSuccess || validation.missingFields.length > 0) {
          finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${validation.missingFields.join(" و ")} 🌷`;
        }

        if (validation.missingFields.includes("الاسم")) modifiedBookingData.clientName = null;
        if (validation.missingFields.includes("رقم الجوال الصحيح") || validation.phoneRestricted) modifiedBookingData.clientPhone = null;
        if (validation.missingFields.includes("الخدمة المطلوبة")) modifiedBookingData.serviceName = null;
        if (validation.missingFields.includes("الفرع المفضل")) modifiedBookingData.branchName = null;
        if (validation.missingFields.includes("الوقت المناسب")) modifiedBookingData.timeSlot = null;
      }
    } else if (resolvedIntent === "CancelAppointment") {
      const defaultCountry = clinic.countryCode || "SA";
      const extractedPhone = extractSaudiPhone(clientPhone, defaultCountry);
      const finalPhone = extractedPhone || clientPhone;

      const activeBooking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: finalPhone,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeBooking) {
        await prisma.booking.update({
          where: { id: activeBooking.id },
          data: { status: "CANCELLED" },
        });
        bookingModified = true;
        finalResponse = `تم إلغاء حجزك بنجاح يا ${activeBooking.clientName} 🌷 تم إخطار الاستقبال بالإلغاء.`;
      } else {
        const hasDraft = currentState && (currentState.serviceName || currentState.branchName || currentState.timeSlot || currentState.clientName);
        if (hasDraft) {
          bookingModified = true;
          finalResponse = "تم إلغاء طلب الحجز وإعادة تعيين الجلسة بنجاح 🌷 إذا كنت ترغب في البدء من جديد، أنا هنا لمساعدتك.";
        } else {
          finalResponse = "لا يوجد لديك حجز نشط حالياً لإلغائه 🌷 إذا كنت ترغب في حجز موعد جديد، أنا هنا لمساعدتك.";
        }
      }
    } else if (resolvedIntent === "Inquiry") {
      if (aiResult.requiresRag) {
        const { RAGPipeline } = await import("./RAGPipeline");
        const chunks = await RAGPipeline.retrieve(clinic.id, userMessage, 3);
        finalResponse = await RAGPipeline.generateGroundedResponse(clinic, userMessage, chunks);
      } else {
        finalResponse = aiResult.response;
      }
    } else if (resolvedIntent === "HumanTakeover" || resolvedIntent === "Complaint") {
      const reason = resolvedIntent === "Complaint" ? "شكوى أو اعتراض من العميل" : "طلب تصعيد للموظف البشري";
      Logger.info(`[HumanTakeoverTriggered] Action required. Reason: ${reason}`, { clinicId: clinic.id, clientPhone });
      finalResponse = "تم إيقاف الرد الآلي وتحويل محادثتك لموظف الاستقبال البشري فوراً لمساعدتك. سيقوم بالتواصل معك في أقرب وقت. 👩‍💻";
      bookingCreated = false;
      bookingModified = false;
      modifiedBookingData = {
        clientName: null,
        clientPhone: null,
        serviceName: null,
        doctorName: null,
        branchName: null,
        timeSlot: null,
      };
    }

    if (finalResponse) {
      finalResponse = finalResponse.replace(/\s*E2E\s*/gi, " ");
      finalResponse = finalResponse.replace(/\s*التجريبي\s*/g, " ");
      finalResponse = finalResponse.replace(/\s+/g, " ").trim();
    }

    return { finalResponse, bookingCreated, bookingModified, modifiedBookingData, resolvedIntent };
  }
}
