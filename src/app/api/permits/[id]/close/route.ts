import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canClose } from "@/lib/permissions";
import { performSimpleTransition } from "@/lib/simpleTransition";

const bodySchema = z.object({ notes: z.string().min(1, "Completion notes are required to close a permit.") });

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
    action: "CLOSE",
    checkPermission: (permit) => canClose(user, permit),
    permissionDeniedMessage: "Only the requester can close this permit.",
    comment: `Marked complete: ${parsed.data.notes}`,
    extraData: { closedAt: new Date(), closeNotes: parsed.data.notes },
  });

  return NextResponse.json(result.body, { status: result.status });
}
