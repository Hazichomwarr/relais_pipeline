import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ReassignProspectDialog transitively imports the reassignment Server
 * Action (which imports "server-only" services), so — like every other
 * page/action-adjacent file in this repo — it can't be rendered under
 * plain node:test outside Next's runtime. Asserted against source instead.
 * ProspectAssignmentHistory has no such import chain and is covered by a
 * real render test (ProspectAssignmentHistory.test.tsx).
 */
const dialogSource = readFileSync(
  "component/propects/ReassignProspectDialog.tsx",
  "utf8",
);
const sectionSource = readFileSync(
  "component/propects/ProspectResponsibilitySection.tsx",
  "utf8",
);

test("ReassignProspectDialog calls the existing 28B reassignProspectAction — never writes assignedUserId or imports a second transfer service", () => {
  assert.match(dialogSource, /from "@\/src\/actions\/prospect-assignment-transfer\.actions"/);
  assert.match(dialogSource, /reassignProspectAction\(/);
  assert.doesNotMatch(dialogSource, /assignedUserId\s*[:=]/);
  assert.doesNotMatch(dialogSource, /prisma\./);
  assert.doesNotMatch(dialogSource, /from "@\/src\/lib\/prisma"/);
});

test("ReassignProspectDialog validates target and reason client-side before submitting", () => {
  assert.match(dialogSource, /if \(!targetUserId\)/);
  assert.match(dialogSource, /reason\.trim\(\)\.length === 0/);
});

test("ReassignProspectDialog only shows success after the server call resolves — setSuccess never appears before the awaited reassignProspectAction call", () => {
  const confirmHandlerIndex = dialogSource.indexOf("async function handleConfirm");
  const handlerBody = dialogSource.slice(confirmHandlerIndex);
  const awaitIndex = handlerBody.indexOf("await reassignProspectAction(");
  const setSuccessIndex = handlerBody.indexOf("setSuccess(");

  assert.ok(awaitIndex >= 0 && setSuccessIndex >= 0);
  assert.ok(awaitIndex < setSuccessIndex, "setSuccess must be called only after the awaited server call, never optimistically before it");
});

test("ReassignProspectDialog only closes the dialog after cancel or the user's own Fermer click on success — handleConfirm itself never calls setOpen(false)", () => {
  const confirmHandlerIndex = dialogSource.indexOf("async function handleConfirm");
  const nextFunctionIndex = dialogSource.indexOf("\n  return (", confirmHandlerIndex);
  const handlerBody = dialogSource.slice(confirmHandlerIndex, nextFunctionIndex);

  assert.doesNotMatch(handlerBody, /setOpen\(false\)/);
});

test("ReassignProspectDialog uses resolveReassignProspectErrorPresentation for every failure, and refreshes state only when that mapping says to", () => {
  assert.match(dialogSource, /resolveReassignProspectErrorPresentation\(/);
  assert.match(dialogSource, /presentation\.refreshCurrentState/);
  assert.match(dialogSource, /router\.refresh\(\)/);
});

test("ReassignProspectDialog is a proper accessible dialog: role, aria-modal, labelled title/description, Escape handling, focus trap", () => {
  assert.match(dialogSource, /role="dialog"/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /aria-labelledby="reassign-prospect-dialog-title"/);
  assert.match(dialogSource, /aria-describedby="reassign-prospect-dialog-description"/);
  assert.match(dialogSource, /event\.key === "Escape"/);
  assert.match(dialogSource, /event\.key !== "Tab"/);
});

test("ReassignProspectDialog's target option renders only name and role as visible text", () => {
  assert.match(
    dialogSource,
    /\{user\.firstName\} \{user\.lastName\} — \{getUserRoleLabel\(user\.role\)\}/,
  );
});

test("ProspectResponsibilitySection renders ResponsibleUserInfo and ReassignProspectDialog — no second display/dialog implementation", () => {
  assert.match(sectionSource, /<ResponsibleUserInfo responsible={responsible} \/>/);
  assert.match(sectionSource, /<ReassignProspectDialog/);
});

test("ProspectResponsibilitySection never writes assignedUserId or queries Prisma directly — it is presentation only", () => {
  assert.doesNotMatch(sectionSource, /assignedUserId\s*[:=]/);
  assert.doesNotMatch(sectionSource, /prisma\./);
});
