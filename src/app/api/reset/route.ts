import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/db";

/** Returns the demo to its seeded state. Present so a public demo can be wiped
 *  between sessions without redeploying. */
export async function POST() {
  resetDemoData();
  return NextResponse.json({ ok: true });
}
