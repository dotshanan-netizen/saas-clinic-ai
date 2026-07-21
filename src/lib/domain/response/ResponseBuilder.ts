import { ClinicWithCatalog } from "@/lib/domain/types";
import { JourneyStage } from "../journey/JourneyResolver";
import { PolicyOutput } from "../policies/PolicyEngine";

export class ResponseBuilder {
  static buildPromptContext(
    clinic: ClinicWithCatalog,
    journeyStage: JourneyStage,
    policy: PolicyOutput,
    currentState: any
  ): string {
    const branchesList = clinic.branches.map((b) => b.name).join(" - ");
    const servicesList = clinic.services.map((s) => `${s.name} (${s.price} ريال)`).join(" - ");

    return `
اسم العيادة: ${clinic.name}
المرحلة الحالية للعميل: ${journeyStage}

سياسة الحوار المطبقة (Conversation Policy):
- السماح بالدعوة للحجز: ${policy.allowBookingPrompt ? "نعم" : "لا (أجيبي فقط دون إلحاح بالحجز)"}
- السماح بالنصائح الطبية: ${policy.allowMedicalAdvice ? "نعم" : "لا (لا تقدمي تشخيصات أو أدوية)"}
- أسلوب التختيم: ${policy.closingStyle}

الخدمات المتوفرة: ${servicesList}
الفروع: ${branchesList}

البيانات الحالية للعميل:
الاسم: ${currentState.clientName || "غير محدد"}
رقم الجوال: ${currentState.clientPhone || "غير محدد"}
الخدمة المطلوبة: ${currentState.serviceName || "غير محدد"}
الفرع: ${currentState.branchName || "غير محدد"}
الوقت المفضل: ${currentState.timeSlot || "غير محدد"}
`;
  }
}
