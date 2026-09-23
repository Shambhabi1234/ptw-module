import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canVerifyClosure } from "@/lib/permissions";
import { performSimpleTransition } from "@/lib/simpleTransition";

const bodySchema = z.object({ notes: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const notes = parsed.success ? parsed.data.notes : undefined;

  const result = await performSimpleTransition({
    permitId: id,
    user,
    action: "VERIFY",
    checkPermission: () => canVerifyClosure(user),
    permissionDeniedMessage: "Only a Safety Officer can verify permit closure.",
    comment: notes ? `Closure verified: ${notes}` : "Closure verified — area confirmed clean.",
    extraData: { verifiedAt: new Date() },
  });

  return NextResponse.json(result.body, { status: result.status });
}
