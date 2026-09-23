import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user: full });
}
