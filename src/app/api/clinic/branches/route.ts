import { NextRequest, NextResponse } from "next/server";
import { PrismaBranchRepository } from "@/repositories/prisma/PrismaBranchRepository";
import { BranchService } from "@/services/BranchService";
import { UpsertBranchSchema } from "@/dtos";
import { prisma } from "@/lib/db";

const branchRepository = new PrismaBranchRepository();
const branchService = new BranchService(branchRepository);

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const branches = await branchService.getBranches(clinic.slug);
    return NextResponse.json(branches);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("GET /api/clinic/branches error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const clinic = await prisma.clinic.findUnique({ where: { id: tenantId } });
    if (!clinic) return NextResponse.json({ error: "Forbidden: Clinic not found" }, { status: 403 });

    const body = await req.json();
    // Force the DTO to use the authenticated clinicSlug
    body.clinicSlug = clinic.slug;
    
    const result = UpsertBranchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    if (result.data.id) {
      // Ownership check for update
      const existing = await prisma.branch.findUnique({ where: { id: result.data.id } });
      if (!existing || existing.clinicId !== tenantId) {
        return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
      }
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
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json({ error: "Required parameter 'branchId' is missing" }, { status: 400 });
    }

    // Ownership check for delete
    const existing = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!existing || existing.clinicId !== tenantId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
    }

    const deleted = await branchService.deleteBranch(branchId);
    return NextResponse.json(deleted);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("DELETE /api/clinic/branches error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
