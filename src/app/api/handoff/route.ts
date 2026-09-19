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

/** Top-level groups, plus `fact:<key>` for one individual clinical fact. */
const FIELD_GROUPS = ["age", "condition", "facts", "practical", "questions", "contact"];
const TTL_MINUTES = 10;

function sanitizeFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (field): field is string =>
      typeof field === "string" &&
      (FIELD_GROUPS.includes(field) ||
        // A per-fact grant. The key is matched against the participant's own
        // recorded facts when the code is read, so an unknown key grants nothing.
        (field.startsWith("fact:") && /^fact:[a-z0-9_]{1,40}$/.test(field)))
  );
}

export async function POST(request: Request) {
  const participant = await getActiveParticipant();
  const body = await request.json().catch(() => ({}));

  const fields = sanitizeFields(body.fields);
  if (fields.length === 0) {
    return NextResponse.json({ error: "Choose at least one thing to share" }, { status: 400 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

  createGrant({
    participantId: participant.id,
    recipientLabel: `In-person sharing code (${token.slice(0, 8)})`,
    trialId: "*",
    allowedFields: fields,
    purpose: "Shown in person as a scannable code",
    expiresAt,
    handoffToken: token,
  });

  // Build the link from the host the request arrived on. `request.url` reports
  // the server's own bind address, which would put "localhost" into a code that
  // another device then cannot open.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const url = `${origin}/handoff/${token}`;
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 448,
    color: { dark: "#0e0d63", light: "#ffffff" },
  });

  return NextResponse.json({ dataUrl, url, expiresAt, fields, ttlMinutes: TTL_MINUTES });
}
