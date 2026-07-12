import { NextRequest, NextResponse } from "next/server";
import { PrismaBranchRepository } from "@/repositories/prisma/PrismaBranchRepository";
import { BranchService } from "@/services/BranchService";
import { UpsertBranchSchema } from "@/dtos";

const branchRepository = new PrismaBranchRepository();
const branchService = new BranchService(branchRepository);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicSlug = searchParams.get("clinicSlug");

    if (!clinicSlug) {
      return NextResponse.json({ error: "Required parameter 'clinicSlug' is missing" }, { status: 400 });
    }

    const branches = await branchService.getBranches(clinicSlug);
    return NextResponse.json(branches);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/branches error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = UpsertBranchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    const branch = await branchService.upsertBranch(result.data);
    return NextResponse.json(branch);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("POST /api/clinic/branches error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Required parameter 'branchId' is missing" }, { status: 400 });
    }

    const deleted = await branchService.deleteBranch(branchId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/branches error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
