import { prisma } from "@/lib/db";
import { AIClassificationResult } from "../infrastructure/ai/AIProvider";
import {
  ClinicWithCatalog,
  validateBookingData,
  sanitizeAIValue,
  normalizeToOfficial,
  extractSaudiPhone,
  ExtractedBookingData,
} from "@/lib/domain/types";
export class BusinessEngine {
  static async processIntent(
    clinic: ClinicWithCatalog,
    clientPhone: string,
    userMessage: string,
    aiResult: AIClassificationResult,
    source: string,
    currentState: ExtractedBookingData
  ): Promise<{ finalResponse: string; bookingCreated: boolean; bookingModified: boolean; modifiedBookingData?: ExtractedBookingData | null }> {
    let finalResponse = aiResult.response;
    let bookingCreated = false;
    let bookingModified = false;

    // Sanitize all extracted booking fields from AI first
    const rawData = aiResult.bookingData || {
      clientName: null,
      clientPhone: null,
      serviceName: null,
      doctorName: null,
      branchName: null,
      timeSlot: null,
    };

    const sanitizedData = {
      clientName: sanitizeAIValue(rawData.clientName),
      clientPhone: sanitizeAIValue(rawData.clientPhone),
      serviceName: sanitizeAIValue(rawData.serviceName),
      doctorName: sanitizeAIValue(rawData.doctorName),
      branchName: sanitizeAIValue(rawData.branchName),
      timeSlot: sanitizeAIValue(rawData.timeSlot),
    };

    const modifiedBookingData = { ...sanitizedData };

    if (aiResult.intent === "BookAppointment" || aiResult.intent === "ModifyBooking") {
      // 1. Controlled Merge Guard: Prevent AI from mutating unmentioned fields
      // Check if user explicitly mentioned a branch or service in their text
      const branchNames = clinic.branches.map((b) => b.name);
      const serviceNames = clinic.services.map((s) => s.name);
      const doctorNames = clinic.doctors.map((d) => d.name);

      const userBranchMention = normalizeToOfficial(userMessage, branchNames);
      const userServiceMention = normalizeToOfficial(userMessage, serviceNames);
      const userDoctorMention = normalizeToOfficial(userMessage, doctorNames);

      // If branch changed and user did NOT mention it in their message, revert to previous state
      if (sanitizedData.branchName !== currentState.branchName) {
        const hasMention = normalizeToOfficial(userMessage, branchNames) !== null;
        if (!hasMention) {
          sanitizedData.branchName = currentState.branchName || null;
          modifiedBookingData.branchName = currentState.branchName || null;
        }
      }

      // If service changed and user did NOT mention it in their message, revert to previous state
      if (sanitizedData.serviceName !== currentState.serviceName) {
        const hasMention = normalizeToOfficial(userMessage, serviceNames) !== null;
        if (!hasMention) {
          sanitizedData.serviceName = currentState.serviceName || null;
          modifiedBookingData.serviceName = currentState.serviceName || null;
        }
      }

      // If doctor changed and user did NOT mention it in their message, revert to previous state
      if (sanitizedData.doctorName !== currentState.doctorName) {
        const hasMention = normalizeToOfficial(userMessage, doctorNames) !== null;
        if (!hasMention) {
          sanitizedData.doctorName = currentState.doctorName || null;
          modifiedBookingData.doctorName = currentState.doctorName || null;
        }
      }

      // 2. Execute Central Validation Gate
      const validation = validateBookingData(sanitizedData, clientPhone, clinic);

      console.log(`[ValidationGate] isValid: ${validation.isValid}`);
      console.log(`[ValidationGate] Missing: ${validation.missingFields.join(", ")}`);
      console.log(`[ValidationGate] CleanName: '${validation.cleanName}'`);

      if (validation.isValid) {
        const finalPhone = validation.normalizedPhone!;

        // Check if there is an active booking to modify
        const isModification = aiResult.intent === "ModifyBooking" || userMessage.match(/تغيير|تعديل|أغير|أعدل|خليه|بدل|غيرت/i);
        let activeBooking = null;
        if (isModification) {
          activeBooking = await prisma.booking.findFirst({
            where: {
              clinicId: clinic.id,
              clientPhone: finalPhone,
              status: { in: ["PENDING", "CONFIRMED"] }
            },
            orderBy: { createdAt: "desc" }
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
            }
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
            // Zero-Friction: append contact message if booking on behalf of another without a custom number
            const userPhoneNormalized = extractSaudiPhone(clientPhone);
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
        // HARD GATE BLOCKED BOOKING: Ensure AI never claims booking succeeded
        const isHallucinatedSuccess = finalResponse.match(/تم|نجاح|ارسال|رفع|وصلني|حجز/i);

        if (sanitizedData.clientPhone && !validation.normalizedPhone) {
          finalResponse =
            "رقم الجوال يبدو غير صحيح. أرجو إرسال رقم سعودي يبدأ بـ 05 ويتكون من 10 أرقام 🌷";
        } else if (isHallucinatedSuccess || validation.missingFields.length > 0) {
          finalResponse = `عذراً، حتى أتمكن من تأكيد الحجز، لا يزال ينقصنا معرفة: ${validation.missingFields.join(" و ")} 🌷`;
        }

        // Nullify missing fields in DTO
        if (validation.missingFields.includes("الاسم")) modifiedBookingData.clientName = null;
        if (validation.missingFields.includes("رقم الجوال الصحيح")) modifiedBookingData.clientPhone = null;
        if (validation.missingFields.includes("الخدمة المطلوبة")) modifiedBookingData.serviceName = null;
        if (validation.missingFields.includes("الفرع المفضل")) modifiedBookingData.branchName = null;
        if (validation.missingFields.includes("الوقت المناسب")) modifiedBookingData.timeSlot = null;
      }
    } else if (aiResult.intent === "CancelAppointment") {
      const extractedPhone = extractSaudiPhone(clientPhone);
      const finalPhone = extractedPhone || clientPhone;
      
      const activeBooking = await prisma.booking.findFirst({
        where: {
          clinicId: clinic.id,
          clientPhone: finalPhone,
          status: { in: ["PENDING", "CONFIRMED"] }
        },
        orderBy: { createdAt: "desc" }
      });

      if (activeBooking) {
        await prisma.booking.update({
          where: { id: activeBooking.id },
          data: { status: "CANCELLED" }
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
    } else if (aiResult.intent === "Inquiry") {
      if (aiResult.requiresRag) {
        const { RAGPipeline } = await import("./RAGPipeline");
        const chunks = await RAGPipeline.retrieve(clinic.id, userMessage, 3);
        finalResponse = await RAGPipeline.generateGroundedResponse(clinic, userMessage, chunks);
      } else {
        finalResponse = aiResult.response;
      }
    } else if (aiResult.intent === "HumanTakeover") {
      finalResponse = "تم تحويل المحادثة لموظف الاستقبال. سيتم الرد عليك في أقرب وقت ممكن. 👩‍💻";
    }

    // Clean internal test tags from final response
    if (finalResponse) {
      finalResponse = finalResponse.replace(/\s*E2E\s*/gi, " ");
      finalResponse = finalResponse.replace(/\s*التجريبي\s*/g, " ");
      finalResponse = finalResponse.replace(/\s+/g, " ").trim();
    }

    return { finalResponse, bookingCreated, bookingModified, modifiedBookingData };
  }
}
