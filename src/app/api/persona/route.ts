import { NextResponse } from "next/server";
import { getParticipant } from "@/lib/repo";
import { setActiveParticipant } from "@/lib/session";

/** Demo persona switch. Only prepared synthetic personas are selectable. */
export async function POST(request: Request) {
  const { id } = await request.json();
  if (typeof id !== "string" || !getParticipant(id)) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }
  await setActiveParticipant(id);
  return NextResponse.json({ ok: true });
}
