import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Creates a new anonymous guest user and returns its id for the client to store. */
export async function POST() {
  const user = await prisma.user.create({
    data: { isGuest: true, provider: "GUEST" },
  });
  return NextResponse.json({ userId: user.id });
}
