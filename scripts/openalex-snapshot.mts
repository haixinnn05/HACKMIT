/**
 * Saves OpenAlex background research for the studies the demo visits, so the
 * Insight tab works without a network. Snapshots land in data/openalex/ and are
 * committed; OpenAlex data is CC0. Usage: npm run openalex:snapshot
 */
import { getOpenAlexResearch } from "../src/lib/openalex";
import { getParticipant, getTrial, listParticipants } from "../src/lib/repo";
import { searchForProfile } from "../src/lib/search";

const ids = new Set<string>(["TP-FIX-001"]);
for (const persona of listParticipants().filter((p) => p.isDemoPersona)) {
  for (const hit of searchForProfile(getParticipant(persona.id)!, { limit: 6 }).hits) ids.add(hit.trial.id);
}

let saved = 0;
for (const id of ids) {
  const trial = getTrial(id);
  if (!trial) continue;
  try {
    const result = await getOpenAlexResearch(trial);
    saved += 1;
    console.log(`  ${id}  ${result.works.length} works, topic: ${result.topic?.name ?? "none"}`);
  } catch (error) {
    console.log(`  ${id}  failed: ${(error as Error).message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 250)); // stay polite to the API
}
console.log(`\nsaved ${saved} of ${ids.size} snapshots to data/openalex/`);
