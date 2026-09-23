import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [plants, areas, equipment] = await Promise.all([
    prisma.plant.findMany({ orderBy: { name: "asc" } }),
    prisma.area.findMany({ orderBy: { name: "asc" }, include: { owner: { select: { id: true, name: true } } } }),
    prisma.equipment.findMany({ orderBy: { tag: "asc" } }),
  ]);

  return NextResponse.json({ plants, areas, equipment });
}
