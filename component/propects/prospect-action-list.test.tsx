import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActionList transitively imports ProspectActionRowActions (a
 * "use client" component built on next/navigation's useRouter and the
 * prospect-action Server Actions), which can't run outside a mounted
 * Next.js app router under plain node:test — same constraint documented
 * in component/finances/LedgerEntryForm.test.ts and
 * component/finances/ReverseLedgerEntryForm.test.ts. These assertions
 * run against the source directly instead of rendering the component.
 */
const source = readFileSync(
  "component/propects/prospect-action-list.tsx",
  "utf8",
);

test("splits actions into an OPEN list and a terminal history list, never re-deriving status elsewhere", () => {
  assert.match(source, /action\.status === "OPEN"/);
  assert.match(source, /action\.status !== "OPEN"/);
});

test("shows an empty state only when there are no actions at all", () => {
  assert.match(source, /actions\.length === 0/);
  assert.match(source, /Aucune action pour ce prospect/);
});

test("derives overdue from the shared core helper, never a hand-rolled date comparison", () => {
  assert.match(source, /isOverdueProspectAction\(action\)/);
  assert.match(
    source,
    /import\s*\{[^}]*isOverdueProspectAction[^}]*\}\s*from\s*"@\/src\/services\/prospect-action\.service-core"/,
  );
  assert.match(source, /En retard/);
});

test("computes canComplete/canCancel from the same pure core functions the service uses for enforcement", () => {
  assert.match(
    source,
    /import\s*\{[^}]*canCancelProspectAction[^}]*canCompleteProspectAction[^}]*\}\s*from\s*"@\/src\/services\/prospect-action\.service-core"/,
  );
  assert.match(
    source,
    /canComplete=\{canCompleteProspectAction\(viewer, action\)\}/,
  );
  assert.match(
    source,
    /canCancel=\{canCancelProspectAction\(viewer, action\)\}/,
  );
});

test("shows the cancellation reason for canceled actions and the completion moment for completed ones", () => {
  assert.match(source, /action\.cancellationReason/);
  assert.match(source, /Motif :/);
  assert.match(source, /Terminé le/);
  assert.match(source, /Annulé le/);
});

test("never performs a Prisma call directly — reads flow through the service layer's props only", () => {
  assert.doesNotMatch(source, /prisma\./);
});

// Ticket 22C — the "+ Nouvelle action" composer trigger and its collapsible
// form live in this same section header/footer instead of a separate,
// permanently-visible card competing with the list.
test("exposes optional headerAction and footer slots for the on-demand composer, defaulting to nothing so existing usage is unaffected", () => {
  assert.match(source, /headerAction\?: ReactNode/);
  assert.match(source, /footer\?: ReactNode/);
  assert.match(source, /\{headerAction\}/);
  assert.match(source, /\{footer\}/);
});

test("the footer slot renders after the action lists, never gating whether the lists themselves are shown", () => {
  const listsIndex = source.indexOf("Aucune action pour ce prospect");
  const footerIndex = source.lastIndexOf("{footer}");
  assert.ok(listsIndex > 0);
  assert.ok(footerIndex > listsIndex);
});
