import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ConnectionManager } from "@/lib/infrastructure/resilience/ConnectionManager";

export async function GET() {
  try {
    const health = await ConnectionManager.checkHealth(prisma);
    
    if (health.status !== "ok") {
      return NextResponse.json({
        status: "error",
        message: "System dependency failure",
        details: health.details,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    return NextResponse.json({ 
      status: "ok", 
      message: "System is healthy",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Healthcheck failed:", err);
    return NextResponse.json({ 
      status: "error", 
      message: err.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
