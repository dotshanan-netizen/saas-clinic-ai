import { NextRequest, NextResponse } from "next/server";
import { PrismaBranchRepository } from "@/repositories/prisma/PrismaBranchRepository";
import { BranchService } from "@/services/BranchService";
import { UpdateBranchWorkingHoursSchema } from "@/dtos";

const branchRepository = new PrismaBranchRepository();
const branchService = new BranchService(branchRepository);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Required parameter 'branchId' is missing" }, { status: 400 });
    }

    const hours = await branchService.getWorkingHours(branchId);
    return NextResponse.json(hours);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/branches/working-hours error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = UpdateBranchWorkingHoursSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    const updatedHours = await branchService.updateWorkingHours(result.data);
    return NextResponse.json(updatedHours);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/branches/working-hours error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
