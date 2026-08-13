import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActionQueueList transitively imports ProspectActionRowActions
 * (a "use client" component built on next/navigation's useRouter and the
 * prospect-action Server Actions), which can't run outside a mounted
 * Next.js app router under plain node:test — same constraint as
 * component/propects/prospect-action-list.test.tsx.
 */
const source = readFileSync("component/actions/ProspectActionQueueList.tsx", "utf8");

test("completion is delegated entirely to Ticket 20B's ProspectActionRowActions — no queue-specific completion mutation exists here", () => {
  assert.match(
    source,
    /import\s+ProspectActionRowActions\s+from\s*"@\/component\/propects\/prospect-action-row-actions"/,
  );
  assert.match(source, /<ProspectActionRowActions/);
  assert.doesNotMatch(source, /completeProspectActionAction/);
  assert.doesNotMatch(source, /cancelProspectActionAction/);
  assert.doesNotMatch(source, /prisma\./);
});

test("never creates a FOLLOW_UP activity, changes status/interest, or records a conversion outcome from the queue", () => {
  for (const forbidden of [
    "FOLLOW_UP",
    "submitProspectFollowUp",
    "conversionOutcome",
    "conversionReason",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});

test("groups rows into three sections in EN RETARD / AUJOURD'HUI / À VENIR order, skipping empty buckets", () => {
  assert.match(source, /"OVERDUE", title: "En retard"/);
  assert.match(source, /"TODAY", title: "Aujourd’hui"/);
  assert.match(source, /"UPCOMING", title: "À venir"/);
  const overdueIndex = source.indexOf('"OVERDUE"');
  const todayIndex = source.indexOf('"TODAY"');
  const upcomingIndex = source.indexOf('"UPCOMING"');
  assert.ok(overdueIndex < todayIndex && todayIndex < upcomingIndex);
  assert.match(source, /bucketItems\.length === 0/);
});

test("shows the two distinct empty states — first-use vs filtered-empty — never conflating them", () => {
  assert.match(source, /Aucune action en attente\./);
  assert.match(source, /Aucune action ne correspond à ces filtres\./);
  assert.match(source, /Réinitialiser les filtres/);
  assert.match(source, /hasActiveFilters/);
});

test("shows an inactive-assignee warning without automatically reassigning or hiding the action", () => {
  assert.match(source, /Responsable inactif/);
  assert.doesNotMatch(source, /reassign/i);
});

test("navigates to the prospect via the precomputed role-safe href, never a hardcoded /admin or /dashboard path", () => {
  assert.match(source, /item\.prospectHref/);
  assert.doesNotMatch(source, /\/admin\/prospects\/\$\{/);
  assert.doesNotMatch(source, /\/dashboard\/commercial\/prospects\/\$\{/);
});

test("row content stays compact — no activity note, conversion reason, interest, phone, or email rendered here", () => {
  for (const forbidden of ["\\.notes", "\\.email", "\\.phone", "interest"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
});
