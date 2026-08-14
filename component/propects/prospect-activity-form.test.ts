import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActivityForm is a "use client" component built on
 * react-hook-form's useForm and next/navigation's useRouter, neither of
 * which can run outside a mounted Next.js app router under plain
 * node:test — same constraint as prospect-action-form.test.ts and
 * prospect-follow-up-mini-form.test.ts.
 */
const source = readFileSync(
  "component/propects/prospect-activity-form.tsx",
  "utf8",
);

test("validates through prospectActivitySchema and submits through createProspectActivityAction by default, never a direct service or Prisma call", () => {
  assert.match(source, /resolver: zodResolver\(prospectActivitySchema\)/);
  assert.match(source, /action = createProspectActivityAction/);
  assert.doesNotMatch(source, /prisma\./);
});

test("only registers the fields a historical note needs — prospectId, type, summary, details, occurredAt", () => {
  for (const field of ["prospectId", "type", "summary", "details", "occurredAt"]) {
    assert.match(source, new RegExp(`register\\("${field}"\\)`));
  }
});

// Ticket 22B — this form was narrowed to historical-note behavior only.
// It must never again grow the commercial-state mutation or free-text
// actor attribution that the structured follow-up workflow already owns.
test("never registers a commercial-state, next-action, or free-text actor field — that capability belongs solely to Ajouter un suivi", () => {
  for (const field of [
    "interest",
    "status",
    "nextAction",
    "followUpDate",
    "agentName",
  ]) {
    assert.doesNotMatch(source, new RegExp(`register\\("${field}"\\)`));
  }
  assert.doesNotMatch(source, /Nom du commercial/);
  assert.doesNotMatch(source, /initialAgentName/);
});

test("carries the Ticket 22B helper copy distinguishing it from a structured follow-up", () => {
  assert.match(source, /Ajouter une note d.interaction/);
  assert.match(
    source,
    /Appel, message, visite ou échange à conserver dans l.historique\./,
  );
});

// ---------------------------------------------------------------------------
// Ticket 22C
// ---------------------------------------------------------------------------

test("calls the optional onSuccess callback only after a successful creation, never on a validation/server error", () => {
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
