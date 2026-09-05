import assert from "node:assert/strict";
import test from "node:test";

import { resolveReassignProspectErrorPresentation } from "./reassign-prospect-error-presentation";

test("CONCURRENTLY_REASSIGNED gets the exact deliberate conflict copy and requires a state refresh — never a generic 'une erreur est survenue'", () => {
  const presentation = resolveReassignProspectErrorPresentation(
    "CONCURRENTLY_REASSIGNED",
    "fallback",
  );

  assert.match(presentation.message, /réassigné pendant que vous le consultiez/);
  assert.equal(presentation.refreshCurrentState, true);
});

for (const code of ["TARGET_NOT_FOUND", "TARGET_INACTIVE", "TARGET_ROLE_NOT_ELIGIBLE"] as const) {
  test(`${code} gets the "cannot receive this prospect" copy and requires a target-options refresh`, () => {
    const presentation = resolveReassignProspectErrorPresentation(code, "fallback");

    assert.match(presentation.message, /ne peut plus recevoir ce prospect/);
    assert.equal(presentation.refreshCurrentState, true);
  });
}

test("SAME_ASSIGNEE gets the exact 'already responsible' copy and does not require a refresh", () => {
  const presentation = resolveReassignProspectErrorPresentation("SAME_ASSIGNEE", "fallback");

  assert.equal(presentation.message, "Cette personne est déjà responsable de ce prospect.");
  assert.equal(presentation.refreshCurrentState, false);
});

for (const code of [
  "PROSPECT_NOT_FOUND",
  "ACTOR_NOT_FOUND",
  "ACTOR_INACTIVE",
  "ACTOR_NOT_AUTHORIZED",
  "INVALID_REASON",
  "REASSIGN_FAILED",
] as const) {
  test(`${code} falls back to the domain's own message verbatim, never a rewritten/generic one`, () => {
    const presentation = resolveReassignProspectErrorPresentation(
      code,
      "le message exact du domaine",
    );

    assert.equal(presentation.message, "le message exact du domaine");
    assert.equal(presentation.refreshCurrentState, false);
  });
}

test("an undefined code (authorization/validation failure caught before the core ran) falls back to the provided message", () => {
  const presentation = resolveReassignProspectErrorPresentation(undefined, "message d’autorisation");

  assert.equal(presentation.message, "message d’autorisation");
  assert.equal(presentation.refreshCurrentState, false);
});
