import { NextRequest, NextResponse } from "next/server";
import { MetaGraphClient } from "@/lib/meta/MetaGraphClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, token, wabaId, phoneId } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing required parameter 'token'" }, { status: 400 });
    }

    const businessId = "707093202173326";

    // Action 1: Fetch WABAs
    if (action === "fetch-wabas") {
      const data = await MetaGraphClient.fetchWabas(token, businessId);
      if (data.error) {
        return NextResponse.json({ error: data.error.message || "Failed to fetch WABAs" }, { status: 400 });
      }
      return NextResponse.json({ wabas: data.data || [] });
    }

    // Action 2: Fetch Phone Numbers
    if (action === "fetch-phones") {
      if (!wabaId) {
        return NextResponse.json({ error: "Missing required parameter 'wabaId'" }, { status: 400 });
      }
      const data = await MetaGraphClient.fetchPhones(token, wabaId);
      if (data.error) {
        return NextResponse.json({ error: data.error.message || "Failed to fetch phone numbers" }, { status: 400 });
      }
      return NextResponse.json({ phones: data.data || [] });
    }

    // Action 3: Subscribe App to WABA
    if (action === "subscribe-app") {
      if (!wabaId) {
        return NextResponse.json({ error: "Missing required parameter 'wabaId'" }, { status: 400 });
      }
      const data = await MetaGraphClient.subscribeApp(token, wabaId);
      if (data.error || !data.success) {
        return NextResponse.json({ error: data.error?.message || "Failed to subscribe WABA" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Action 4: Verify Phone status
    if (action === "verify-phone") {
      if (!phoneId) {
        return NextResponse.json({ error: "Missing required parameter 'phoneId'" }, { status: 400 });
      }
      const data = await MetaGraphClient.verifyPhone(token, phoneId);
      if (data.error) {
        return NextResponse.json({ error: data.error.message || "Failed to verify phone status" }, { status: 400 });
      }
      return NextResponse.json({
        status: data.status || "CONNECTED",
        verified_name: data.verified_name || "Hdco"
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in whatsapp-proxy setup API:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

