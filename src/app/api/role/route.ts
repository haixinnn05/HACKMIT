import { NextResponse } from "next/server";
import { setRole } from "@/lib/session";

/** Demo role switch for scripts. The login page is the human path. */
export async function POST(request: Request) {
  const { role } = await request.json();
  if (role !== "participant" && role !== "clinic") {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  await setRole(role);
  return NextResponse.json({ ok: true });
}
