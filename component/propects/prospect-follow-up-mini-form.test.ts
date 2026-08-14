import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectFollowUpMiniForm is a "use client" component built on
 * react-hook-form's useForm/useWatch and next/navigation's useRouter,
 * neither of which can run outside a mounted Next.js app router under
 * plain node:test — same constraint as LedgerEntryForm.test.ts.
 */
const source = readFileSync(
  "component/propects/prospect-follow-up-mini-form.tsx",
  "utf8",
);

test("validates through prospectFollowUpWorkflowSchema and submits through submitProspectFollowUpAction, never a direct service or Prisma call", () => {
  assert.match(source, /resolver: zodResolver\(prospectFollowUpWorkflowSchema\)/);
  assert.match(source, /submitProspectFollowUpAction\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("initializes status and interest from the prospect's current values, never defaulting to NEW", () => {
  assert.match(source, /status: initialValues\.status/);
  assert.match(source, /interest: initialValues\.interest/);
  assert.doesNotMatch(source, /status: "NEW"/);
});

test("derives the terminal/active split from the shared core helper, never a hand-rolled WON/LOST check", () => {
  assert.match(
    source,
    /import\s*\{[^}]*isTerminalProspectStatus[^}]*\}\s*from\s*"@\/src\/services\/prospect-status\.service-core"/,
  );
  assert.match(source, /isTerminalProspectStatus\(/);
  assert.doesNotMatch(source, /selectedStatus === "WON"/);
  assert.doesNotMatch(source, /selectedStatus === "LOST"/);
});

test("hides the next-action section for a terminal status and shows the required closed-opportunity copy", () => {
  assert.match(source, /isActiveStatus \? \(/);
  assert.match(
    source,
    /Aucune prochaine action n’est requise pour une opportunité\s*\n?\s*clôturée\./,
  );
});

test("watches status reactively via useWatch, not the raw watch() function (React Compiler-friendly, matches repo convention)", () => {
  assert.match(source, /useWatch\(\{ control, name: "status" \}\)/);
  assert.doesNotMatch(source, /\bwatch\("status"\)/);
});

test("never lets the client supply a trusted actor/creator/lifecycle field — only prospectId, note, status, interest, conversion outcome/reason, completedActionId, and next-action fields are registered", () => {
  for (const field of [
    "prospectId",
    "note",
    "status",
    "interest",
    "conversionOutcome",
    "conversionReason",
    "conversionReasonNote",
    "completedActionId",
    "nextActionTitle",
    "nextActionAssignedToUserId",
    "nextActionDueAt",
  ]) {
    assert.match(source, new RegExp(`register\\("${field}"\\)`));
  }

  for (const trustedField of [
    "actorUserId",
    "createdByUserId",
    "completedByUserId",
    "canceledByUserId",
  ]) {
    assert.doesNotMatch(source, new RegExp(`register\\("${trustedField}"\\)`));
  }
});

test("the assignee dropdown is populated from the assignableUsers prop, never a hardcoded role filter", () => {
  assert.match(source, /assignableUsers\.map\(/);
  assert.doesNotMatch(source, /role === "COMMERCIAL"/);
});

test("the completed-action dropdown offers an explicit no-op option and is built from the openActions prop, not a second task list implementation", () => {
  assert.match(source, /Aucune action à terminer/);
  assert.match(source, /openActions\.map\(/);
});

// ---------------------------------------------------------------------------
// Ticket 20D
// ---------------------------------------------------------------------------

test("filters the reason dropdown from the shared compatibility core, never a hardcoded per-outcome list", () => {
  assert.match(
    source,
    /import\s*\{[^}]*listConversionReasonsForOutcome[^}]*\}\s*from\s*"@\/src\/services\/prospect-conversion\.service-core"/,
  );
  assert.match(source, /listConversionReasonsForOutcome\(selectedOutcome\)/);
});

test("clears a now-incompatible reason when the outcome changes, using the same compatibility predicate the server enforces", () => {
  assert.match(
    source,
    /import\s*\{[^}]*isConversionReasonAllowedForOutcome[^}]*\}\s*from\s*"@\/src\/services\/prospect-conversion\.service-core"/,
  );
  assert.match(source, /isConversionReasonAllowedForOutcome\(selectedOutcome, selectedReason\)/);
  assert.match(source, /setValue\("conversionReason", ""\)/);
});

test("WON/LOST outcome sets the matching status for convenience, without bypassing server validation", () => {
  assert.match(source, /selectedOutcome === "WON" \|\| selectedOutcome === "LOST"/);
  assert.match(source, /setValue\("status", selectedOutcome\)/);
});

test("shows the OTHER explanation field only when the selected reason requires one, driven by the shared core helper", () => {
  assert.match(
    source,
    /import\s*\{[^}]*conversionReasonRequiresNote[^}]*\}\s*from\s*"@\/src\/services\/prospect-conversion\.service-core"/,
  );
  assert.match(source, /conversionReasonRequiresNote\(selectedReason\)/);
  assert.match(source, /reasonRequiresNote &&/);
});

test("outcome and reason option lists come from the centralized options file, never inline hardcoded labels", () => {
  assert.match(
    source,
    /import\s*\{[^}]*conversionOutcomeOptions[^}]*conversionReasonOptions[^}]*\}\s*from\s*"@\/src\/lib\/prospect-conversion-options"/,
  );
  assert.match(source, /conversionOutcomeOptions\.map\(/);
  assert.doesNotMatch(source, /value: "ADVANCED", label:/);
});

// ---------------------------------------------------------------------------
// Ticket 22C
// ---------------------------------------------------------------------------

test("calls the optional onSuccess callback only after a successful submission, never on a validation/server error", () => {
  assert.match(
    source,
    /router\.refresh\(\);\s*\n\s*onSuccess\?\.\(\);/,
  );
  const failureReturnIndex = source.indexOf(
    'setFeedback({ type: "error", message: result.message });',
  );
  const onSuccessCallIndex = source.indexOf("onSuccess?.();");
  assert.ok(failureReturnIndex > 0);
  assert.ok(onSuccessCallIndex > failureReturnIndex);
});
