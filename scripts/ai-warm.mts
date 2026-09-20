/**
 * Pre-generates the study briefs the demo visits, so nobody watches a 30-second
 * wait. Results are cached in the database by model, prompt version and source
 * text, so a changed record regenerates by itself. Usage: npm run ai:warm
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=["']?([^"'\n]*)["']?$/); if (m && m[2]) process.env[m[1]] = m[2]; }

const { AI_METADATA, generateTrialBrief } = await import("../src/lib/ai");
const { assessTrial } = await import("../src/lib/assess");
const { getParticipant, getTrial, listParticipants } = await import("../src/lib/repo");
const { searchForProfile } = await import("../src/lib/search");

if (!AI_METADATA.configured) { console.log("No model is configured. Run: npm run ai:check"); process.exit(1); }

const jobs: [string, string][] = [];
for (const persona of listParticipants().filter((p) => p.isDemoPersona)) {
  jobs.push([persona.id, "TP-FIX-001"]);
  for (const hit of searchForProfile(getParticipant(persona.id)!, { limit: 3 }).hits) jobs.push([persona.id, hit.trial.id]);
}
console.log(`Warming ${jobs.length} briefs with ${AI_METADATA.model}, one at a time (the API slows under parallel load)...\n`);

let done = 0, dropped = 0;
for (let i = 0; i < jobs.length; i += 1) {
  await Promise.all(jobs.slice(i, i + 1).map(async ([personaId, trialId]) => {
    const started = Date.now();
    const trial = getTrial(trialId)!;
    const brief = await generateTrialBrief(trial, assessTrial(trial, getParticipant(personaId)!));
    done += 1; dropped += brief.droppedClaims;
    console.log(`  ${personaId.padEnd(10)} ${trialId.padEnd(12)} ${brief.mode.padEnd(16)} ${brief.claims.length} claims, ${brief.droppedClaims} dropped, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }));
}
console.log(`\n${done} briefs ready. ${dropped} quoted statement(s) were dropped because they were not found in the source.`);
