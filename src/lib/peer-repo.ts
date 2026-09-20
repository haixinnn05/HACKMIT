import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { modelLabel } from "./ai";
import { mutualView, rankWithModel } from "./peer-ai";
import { differentDiagnosis, needsGentleReminder, scorePair, type PeerField, type PeerMatch, type PeerOptIn } from "./peers";
import type { ParticipantProfile } from "./types";
import { getParticipant, listEnrollments, listInquiriesForParticipant, listSavedTrialIds } from "./repo";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parse = <T,>(value: unknown, fallback: T): T => { try { return JSON.parse(String(value)) as T; } catch { return fallback; } };

const rowToOptIn = (row: any): PeerOptIn => ({
  participantId: row.participant_id, alias: row.alias, offers: parse(row.offers, [] as PeerField[]), about: row.about,
});

export function getPeerOptIn(participantId: string): PeerOptIn | null {
  const row = getDb().prepare("SELECT * FROM peer_optins WHERE participant_id = ?").get(participantId);
  return row ? rowToOptIn(row) : null;
}

export function savePeerOptIn(input: PeerOptIn) {
  getDb().prepare("INSERT OR REPLACE INTO peer_optins (participant_id, alias, offers, about, created_at) VALUES (?,?,?,?,?)")
    .run(input.participantId, input.alias, JSON.stringify(input.offers), input.about, new Date().toISOString());
}

/** Opting out also ends open conversations, so leaving really is leaving. */
export function removePeerOptIn(participantId: string) {
  const db = getDb();
  db.prepare("DELETE FROM peer_optins WHERE participant_id = ?").run(participantId);
  db.prepare("UPDATE peer_connections SET state = 'ended', updated_at = ? WHERE (from_id = ? OR to_id = ?) AND state IN ('pending','accepted')")
    .run(new Date().toISOString(), participantId, participantId);
}

const interestedIn = (participantId: string, trialId: string) =>
  listSavedTrialIds(participantId).includes(trialId) || listInquiriesForParticipant(participantId).some((i) => i.trialId === trialId);

const takingPartIn = (participantId: string, trialId: string) =>
  listEnrollments(participantId).some((e) => e.trialId === trialId && e.status === "participating");

export type MatchOutcome =
  | { status: "not_opted_in" }
  | { status: "enrolled" }
  | { status: "ok"; matches: PeerMatch[] };

/**
 * Suggested people for one participant, optionally about one study. Returns a
 * handful, never a list to browse. Anyone taking part in the study in question
 * is left out, in both directions.
 */
/** Everyone this person may be compared with, after the rules no model gets a say in. */
function eligiblePairs(participantId: string, trialId: string | null) {
  const me = getParticipant(participantId);
  const mine = getPeerOptIn(participantId);
  if (!me || !mine) return { status: "not_opted_in" as const };
  if (trialId && takingPartIn(participantId, trialId)) return { status: "enrolled" as const };

  const connected = new Set(listPeerConnections(participantId).filter((c) => c.state === "pending" || c.state === "accepted")
    .map((c) => (c.fromId === participantId ? c.toId : c.fromId)));

  const rows = getDb().prepare("SELECT * FROM peer_optins WHERE participant_id != ?").all(participantId) as any[];
  const pairs: { them: ParticipantProfile; theirs: PeerOptIn; sameStudy: boolean }[] = [];
  for (const theirs of rows.map(rowToOptIn)) {
    if (connected.has(theirs.participantId)) continue;
    if (trialId && takingPartIn(theirs.participantId, trialId)) continue;
    const them = getParticipant(theirs.participantId);
    if (them) pairs.push({ them, theirs, sameStudy: trialId ? interestedIn(theirs.participantId, trialId) : false });
  }
  return { status: "ok" as const, me, mine, pairs };
}

const rank = (m: PeerMatch) => (m.sameStudy ? 2 : 0) + (m.strength === "strong" ? 1 : 0) + m.reasons.length / 10;

export function findPeerMatches(participantId: string, trialId: string | null): MatchOutcome {
  const found = eligiblePairs(participantId, trialId);
  if (found.status !== "ok") return found;
  const matches = found.pairs
    .map(({ them, theirs, sameStudy }) => scorePair(found.me, found.mine, them, theirs, sameStudy))
    .filter((match): match is PeerMatch => match !== null);
  return { status: "ok", matches: matches.sort((a, b) => rank(b) - rank(a)).slice(0, 3) };
}

export type SmartMatchOutcome =
  | { status: "not_opted_in" } | { status: "enrolled" }
  | { status: "ok"; matches: PeerMatch[]; matchedBy: { kind: "model"; model: string } | { kind: "rules"; why: string } };

/**
 * The matcher the app uses. The language model ranks and explains; the rules
 * decide who may be compared and remain the fallback, and the screen says which
 * one produced what is shown.
 *
 * Two rules stay in code even when the model is on. A different diagnosis is
 * never a match, however much else two people share. And nobody the rules would
 * refuse outright on diagnosis is ever sent to the model.
 */
export async function findPeerMatchesSmart(participantId: string, trialId: string | null): Promise<SmartMatchOutcome> {
  const found = eligiblePairs(participantId, trialId);
  if (found.status !== "ok") return found;

  const candidates = found.pairs
    .filter(({ them, theirs }) => !differentDiagnosis(found.me, found.mine, them, theirs))
    .map(({ them, theirs, sameStudy }) => ({
      participantId: them.id, alias: theirs.alias, about: theirs.about, sameStudy,
      facts: mutualView(found.me, found.mine, them, theirs),
    }));

  const ranked = await rankWithModel(candidates);
  if (ranked) {
    return { status: "ok", matches: ranked.matches.sort((a, b) => rank(b) - rank(a)).slice(0, 3), matchedBy: { kind: "model", model: ranked.model } };
  }
  const rules = findPeerMatches(participantId, trialId);
  return rules.status === "ok"
    ? { ...rules, matchedBy: { kind: "rules", why: modelLabel() ? "The language model did not answer, so these come from the built-in rules." : "No language model is connected, so these come from the built-in rules." } }
    : rules;
}

/* ------------------------------------------------------------- connections */

export interface PeerConnection {
  id: string; trialId: string | null; fromId: string; toId: string;
  state: "pending" | "accepted" | "declined" | "ended" | "reported";
  reasons: string[]; note: string | null; createdAt: string; updatedAt: string;
}

const rowToConnection = (row: any): PeerConnection => ({
  id: row.id, trialId: row.trial_id, fromId: row.from_id, toId: row.to_id, state: row.state,
  reasons: parse(row.reasons, [] as string[]), note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
});

export function createPeerConnection(input: { trialId: string | null; fromId: string; toId: string; reasons: string[]; note: string | null }): PeerConnection {
  const now = new Date().toISOString();
  const id = randomUUID();
  getDb().prepare("INSERT INTO peer_connections (id, trial_id, from_id, to_id, state, reasons, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, input.trialId, input.fromId, input.toId, "pending", JSON.stringify(input.reasons), input.note, now, now);
  return getPeerConnection(id)!;
}

export function getPeerConnection(id: string): PeerConnection | null {
  const row = getDb().prepare("SELECT * FROM peer_connections WHERE id = ?").get(id);
  return row ? rowToConnection(row) : null;
}

export function listPeerConnections(participantId: string): PeerConnection[] {
  return (getDb().prepare("SELECT * FROM peer_connections WHERE from_id = ? OR to_id = ? ORDER BY updated_at DESC")
    .all(participantId, participantId) as any[]).map(rowToConnection);
}

export function setPeerConnectionState(id: string, state: PeerConnection["state"]) {
  getDb().prepare("UPDATE peer_connections SET state = ?, updated_at = ? WHERE id = ?").run(state, new Date().toISOString(), id);
}

export interface PeerMessage { id: string; connectionId: string; senderId: string; text: string; reminder: boolean; createdAt: string }

export function addPeerMessage(connectionId: string, senderId: string, text: string): PeerMessage {
  const message: PeerMessage = {
    id: randomUUID(), connectionId, senderId, text: text.slice(0, 800),
    reminder: needsGentleReminder(text), createdAt: new Date().toISOString(),
  };
  const db = getDb();
  db.prepare("INSERT INTO peer_messages (id, connection_id, sender_id, text, reminder, created_at) VALUES (?,?,?,?,?,?)")
    .run(message.id, connectionId, senderId, message.text, message.reminder ? 1 : 0, message.createdAt);
  db.prepare("UPDATE peer_connections SET updated_at = ? WHERE id = ?").run(message.createdAt, connectionId);
  return message;
}

export function listPeerMessages(connectionId: string): PeerMessage[] {
  return (getDb().prepare("SELECT * FROM peer_messages WHERE connection_id = ? ORDER BY created_at").all(connectionId) as any[])
    .map((row) => ({ id: row.id, connectionId: row.connection_id, senderId: row.sender_id, text: row.text, reminder: Boolean(row.reminder), createdAt: row.created_at }));
}
