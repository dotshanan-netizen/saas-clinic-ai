import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return NextResponse.json({ error: "Forbidden: Missing tenant context" }, { status: 403 });
    }
    
    // Override clinicId with authenticated tenantId
    const clinicId = tenantId;

    const { searchParams } = new URL(req.url);

    // Default to last 7 days
    const daysStr = searchParams.get("days") || "7";
    const days = parseInt(daysStr, 10);
    const startDate = startOfDay(subDays(new Date(), days - 1));
    
    // Fetch metrics
    const metrics = await prisma.metricLog.findMany({
      where: {
        clinicId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: "asc" }
    });

    // We can fetch total conversations / bookings in the same period
    const totalBookings = await prisma.booking.count({
      where: { clinicId, createdAt: { gte: startDate } }
    });

    const totalConversations = await prisma.conversation.count({
      where: { clinicId, updatedAt: { gte: startDate } }
    });

    // Aggregate by day
    const timeSeriesData: Record<string, any> = {};
    
    for (let i = 0; i < days; i++) {
      const d = startOfDay(subDays(new Date(), (days - 1) - i)).toISOString().split("T")[0];
      timeSeriesData[d] = {
        date: d,
        llm_latency_ms: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        error_count: 0,
        latency_count: 0
      };
    }

    for (const m of metrics) {
      const d = startOfDay(m.createdAt).toISOString().split("T")[0];
      if (timeSeriesData[d]) {
        if (m.metricName === "llm_latency_ms") {
          timeSeriesData[d].llm_latency_ms += m.metricValue;
          timeSeriesData[d].latency_count += 1;
        } else if (m.metricName === "prompt_tokens") {
          timeSeriesData[d].prompt_tokens += m.metricValue;
        } else if (m.metricName === "completion_tokens") {
          timeSeriesData[d].completion_tokens += m.metricValue;
        } else if (m.metricName === "total_tokens") {
          timeSeriesData[d].total_tokens += m.metricValue;
        } else if (m.metricName === "error_count") {
          timeSeriesData[d].error_count += m.metricValue;
        }
      }
    }

    // Calculate averages for latency
    const chartData = Object.values(timeSeriesData).map(day => {
      if (day.latency_count > 0) {
        day.avg_latency_ms = Math.round(day.llm_latency_ms / day.latency_count);
      } else {
        day.avg_latency_ms = 0;
      }
      return day;
    });

    // Aggregate Totals
    const totals = {
      tokens: chartData.reduce((acc, curr) => acc + curr.total_tokens, 0),
      errors: chartData.reduce((acc, curr) => acc + curr.error_count, 0),
      avgLatency: chartData.reduce((acc, curr) => acc + curr.avg_latency_ms, 0) / (chartData.filter(d => d.latency_count > 0).length || 1),
      bookings: totalBookings,
      conversations: totalConversations
    };

    return NextResponse.json({
      totals,
      chartData
    });
  } catch (error) {
    console.error("Error fetching analytics metrics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
