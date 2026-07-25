import { NextResponse } from "next/server";
import { TenantOnboardingSchema } from "@/lib/validations/onboarding";
import { TenantOnboardingService } from "@/lib/services/TenantOnboardingService";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 1. Validate payload via Zod
    const parsed = TenantOnboardingSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn("[API] Invalid onboarding payload", parsed.error.issues);
      return NextResponse.json(
        { error: "بيانات غير صالحة", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // 2. Provision Tenant
    console.log(`[API] Starting onboarding for ${parsed.data.clinicSlug}`);
    const result = await TenantOnboardingService.onboard(parsed.data);

    return NextResponse.json({
      success: true,
      message: "تم إنشاء العيادة بنجاح",
      clinicId: result.id,
    });
  } catch (error: any) {
    console.error("[API] Onboarding failed", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء إنشاء العيادة" },
      { status: 500 }
    );
  }
}
