import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canCancel } from "@/lib/permissions";
import { performSimpleTransition } from "@/lib/simpleTransition";

const bodySchema = z.object({ reason: z.string().min(1, "A reason is required to cancel a permit.") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const result = await performSimpleTransition({
    permitId: id,
    user,
    action: "CANCEL",
    checkPermission: (permit) => canCancel(user, permit),
    permissionDeniedMessage: "You cannot cancel this permit.",
    comment: `Cancelled: ${parsed.data.reason}`,
    extraData: { cancelledAt: new Date(), cancelReason: parsed.data.reason },
  });

  return NextResponse.json(result.body, { status: result.status });
}
