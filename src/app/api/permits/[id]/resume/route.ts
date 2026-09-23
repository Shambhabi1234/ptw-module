import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canSuspend } from "@/lib/permissions";
import { performSimpleTransition } from "@/lib/simpleTransition";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const result = await performSimpleTransition({
    permitId: id,
    user,
    action: "RESUME",
    checkPermission: () => canSuspend(user), // same role can resume as can suspend
    permissionDeniedMessage: "Only a Safety Officer can resume a suspended permit.",
    comment: "Resumed after suspension.",
    extraData: { suspendedAt: null },
  });

  return NextResponse.json(result.body, { status: result.status });
}
