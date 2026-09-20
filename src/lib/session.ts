import { cookies } from "next/headers";
import { getParticipant, listParticipants } from "./repo";
import type { ParticipantProfile } from "./types";

/**
 * Demo session handling.
 *
 * Login chooses a role — patient or clinic — with no password. The active
 * patient identity is a cookie naming one of the prepared personas. A real
 * deployment replaces both with server-side auth; the read path below is the
 * single place that decides "who is asking".
 */

const COOKIE = "tp_persona";

export async function getActiveParticipant(): Promise<ParticipantProfile> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  const participant = id ? getParticipant(id) : null;
  if (participant) return participant;
  const all = listParticipants();
  return all.find((p) => p.isDemoPersona) ?? all[0];
}

export async function setActiveParticipant(id: string) {
  const store = await cookies();
  store.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
}

export const PERSONA_COOKIE = COOKIE;

/**
 * Which face of the app this browser is using, set at login.
 */
export type Role = "participant" | "clinic";
const ROLE_COOKIE = "mz_role";

export async function getRole(): Promise<Role | null> {
  const value = (await cookies()).get(ROLE_COOKIE)?.value;
  return value === "participant" || value === "clinic" ? value : null;
}

export async function setRole(role: Role) {
  (await cookies()).set(ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearRole() {
  (await cookies()).delete(ROLE_COOKIE);
}

export async function hasChosenPersona(): Promise<boolean> {
  return Boolean((await cookies()).get(COOKIE)?.value);
}

/** The simulated member of staff signed in to the research-team face. */
export const STAFF = {
  id: "coord-fixture-1",
  name: "R. Alvarez",
  title: "Research Coordinator",
  site: "Harborview Cancer Center, Cambridge",
  label: "R. Alvarez, Research Coordinator (simulated staff account)",
};
