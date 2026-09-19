import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createGrant } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";

/**
 * Creates the in-person handoff code.
 *
 * The returned image encodes a URL and nothing else. No diagnosis, no trial
 * identifier, no bearer credential that would grant account access — a scanned
 * code is visible to anyone in the room and cannot be un-shared, so it carries
 * only a pointer to server-side data the participant has already scoped and can
 * revoke.
 */

const FIELD_GROUPS = ["basics", "condition", "practical", "questions", "contact"];
const TTL_MINUTES = 15;

export async function POST(request: Request) {
  const participant = await getActiveParticipant();
  const body = await request.json().catch(() => ({}));

  const fields: string[] = Array.isArray(body.fields)
    ? body.fields.filter((field: unknown) => typeof field === "string" && FIELD_GROUPS.includes(field))
    : [];
  if (fields.length === 0) {
    return NextResponse.json({ error: "Choose at least one thing to share" }, { status: 400 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

  createGrant({
    participantId: participant.id,
    recipientLabel: `In-person handoff code (${token.slice(0, 8)})`,
    trialId: "*",
    allowedFields: fields,
    purpose: "Shown in person as a scannable code",
    expiresAt,
    handoffToken: token,
  });

  const origin = new URL(request.url).origin;
  const url = `${origin}/handoff/${token}`;
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 448,
    color: { dark: "#1c1a17", light: "#ffffff" },
  });

  return NextResponse.json({ dataUrl, url, expiresAt, fields });
}
