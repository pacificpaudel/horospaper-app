import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user?.id.startsWith("google:")) return NextResponse.json({ account: null }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ account: { email: user.email ?? "", name: user.name ?? "" } }, { headers: { "Cache-Control": "private, no-store" } });
}
