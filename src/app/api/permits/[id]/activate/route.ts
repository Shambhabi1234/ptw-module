import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { performSimpleTransition } from "@/lib/simpleTransition";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const result = await performSimpleTransition({
    permitId: id,
    user,
    action: "ACTIVATE",
    // Any authenticated role tied to the permit can activate once approved
    // (in practice usually the requester, on site, about to start work).
    // Admin can always act.
    checkPermission: (permit) =>
      user.role === "ADMIN" || (user.role === "REQUESTER" && user.id === permit.requesterId),
    permissionDeniedMessage: "Only the requester can activate this permit.",
    comment: "Work activated — inside the approved time window.",
    extraData: { activatedAt: new Date() },
  });

  return NextResponse.json(result.body, { status: result.status });
}
