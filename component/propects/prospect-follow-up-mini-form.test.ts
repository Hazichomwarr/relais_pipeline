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

test("never lets the client supply a trusted actor/creator/lifecycle field — only prospectId, note, status, interest, completedActionId, and next-action fields are registered", () => {
  for (const field of [
    "prospectId",
    "note",
    "status",
    "interest",
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
