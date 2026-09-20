import { cookies } from "next/headers";
import { getParticipant, listParticipants } from "./repo";
import type { ParticipantProfile } from "./types";

/**
 * Demo session handling.
 *
 * There is no authentication in the prototype and there should not be the
 * appearance of one. The active identity is a cookie naming one of the prepared
 * synthetic personas, and the UI says so on every screen. A real deployment
 * replaces this with server-side auth and role checks; the read path below is
 * the single place that decides "who is asking", which is what makes that
 * replacement tractable.
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
 * Which face of the app this browser is using. Like the persona, this is a demo
 * affordance and not authentication: the research-team face is a simulated staff
 * account and says so on every screen. A real deployment replaces it with
 * server-side roles and site membership checks.
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
