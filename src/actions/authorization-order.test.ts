import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 13D.1 requires every mutating Server Action to authorize before
 * validating, and validate before calling its business service. Since these
 * "use server" files transitively import next-auth (which needs next/server),
 * they can't be executed under plain node:test outside Next's own runtime —
 * so this asserts the required ordering directly against the source, the
 * same technique this repo already uses for migration-safety checks
 * (see prisma/*.migration.test.ts).
 */
const gatedActions = [
  {
    file: "src/actions/prospect.actions.ts",
    functionName: "createProspectAction",
    serviceCall: "createProspect(",
  },
  {
    file: "src/actions/prospect-activity.actions.ts",
    functionName: "createProspectActivityAction",
    serviceCall: "createProspectActivity(",
  },
  {
    file: "src/actions/user.actions.ts",
    functionName: "createUserAction",
    serviceCall: "createUser(",
  },
  {
    file: "src/actions/user.actions.ts",
    functionName: "updateUserAction",
    serviceCall: "updateUser(",
  },
  {
    file: "src/actions/user.actions.ts",
    functionName: "deactivateUserAction",
    serviceCall: "deactivateUser(",
  },
  {
    file: "src/actions/auth.actions.ts",
    functionName: "changePasswordAction",
    serviceCall: "changePassword(",
  },
  {
    file: "src/actions/commercial-prospect.actions.ts",
    functionName: "createCommercialActivityAction",
    serviceCall: "createCommercialActivity(",
  },
  {
    file: "src/actions/prospect-action.actions.ts",
    functionName: "createProspectActionAction",
    serviceCall: "createProspectAction(",
  },
  {
    file: "src/actions/prospect-action.actions.ts",
    functionName: "completeProspectActionAction",
    serviceCall: "completeProspectAction(",
  },
  {
    file: "src/actions/prospect-action.actions.ts",
    functionName: "cancelProspectActionAction",
    serviceCall: "cancelProspectAction(",
  },
  {
    file: "src/actions/prospect-follow-up.actions.ts",
    functionName: "submitProspectFollowUpAction",
    serviceCall: "submitProspectFollowUp(",
  },
  {
    file: "src/actions/personal-note.actions.ts",
    functionName: "createPersonalNoteAction",
    serviceCall: "createMyPersonalNote(",
  },
  {
    file: "src/actions/personal-note.actions.ts",
    functionName: "updatePersonalNoteAction",
    serviceCall: "updateMyPersonalNote(",
  },
  {
    file: "src/actions/personal-note.actions.ts",
    functionName: "deletePersonalNoteAction",
    serviceCall: "deleteMyPersonalNote(",
  },
  {
    file: "src/actions/financial-ledger.actions.ts",
    functionName: "createLedgerEntryAction",
    serviceCall: "createLedgerEntry(",
  },
  {
    file: "src/actions/financial-ledger.actions.ts",
    functionName: "reverseLedgerEntryAction",
    serviceCall: "reverseLedgerEntry(",
  },
  {
    file: "src/actions/daily-report.actions.ts",
    functionName: "createDailyReportAction",
    serviceCall: "createOwnDailyReport(",
  },
  {
    file: "src/actions/daily-report.actions.ts",
    functionName: "updateDailyReportAction",
    serviceCall: "updateOwnDailyReport(",
  },
  {
    file: "src/actions/daily-report.actions.ts",
    functionName: "submitDailyReportAction",
    serviceCall: "submitOwnDailyReport(",
  },
];

for (const action of gatedActions) {
  test(`${action.functionName} authorizes before validating and before calling its service`, () => {
    const functionBody = extractFunctionBody(action.file, action.functionName);

    const authorizeIndex = functionBody.search(/authorizeAction\(/);
    const validateIndex = functionBody.indexOf(".safeParse(");
    const serviceIndex = functionBody.indexOf(action.serviceCall);

    assert.ok(
      authorizeIndex >= 0,
      `${action.functionName} has no authorizeAction(...) call`,
    );
    assert.ok(
      validateIndex >= 0,
      `${action.functionName} has no .safeParse(...) call`,
    );
    assert.ok(
      serviceIndex >= 0,
      `${action.functionName} never calls ${action.serviceCall}`,
    );
    assert.ok(
      authorizeIndex < validateIndex,
      `${action.functionName} must authorize before validating`,
    );
    assert.ok(
      validateIndex < serviceIndex,
      `${action.functionName} must validate before calling its service`,
    );
  });
}

for (const functionName of [
  "createUserAction",
  "updateUserAction",
  "deactivateUserAction",
]) {
  test(`${functionName} authorizes via requireAdmin, not the ADMIN-or-MANAGER role set (Ticket 13D.3)`, () => {
    const functionBody = extractFunctionBody("src/actions/user.actions.ts", functionName);

    assert.match(functionBody, /requireAdmin\(\)/);
    assert.doesNotMatch(
      functionBody,
      /requireRole\(\s*"ADMIN"\s*,\s*"MANAGER"\s*\)/,
    );
  });
}

test("createUserAction derives the creation-history actor from the authenticated admin, never client input", () => {
  const functionBody = extractFunctionBody(
    "src/actions/user.actions.ts",
    "createUserAction",
  );

  assert.match(
    functionBody,
    /createUser\(parsed\.data, authorization\.user\.id\)/,
  );
  assert.doesNotMatch(functionBody, /parsed\.data\.(actorUserId|creatorUserId|createdBy)/);
  assert.doesNotMatch(functionBody, /values\.(actorUserId|creatorUserId|createdBy)/);
});

for (const functionName of [
  "createLedgerEntryAction",
  "reverseLedgerEntryAction",
]) {
  test(`${functionName} authorizes via requireAdmin — financial mutations are ADMIN-only (Ticket 17A)`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/financial-ledger.actions.ts",
      functionName,
    );

    assert.match(functionBody, /requireAdmin\(\)/);
    assert.doesNotMatch(
      functionBody,
      /requireRole\(\s*"ADMIN"\s*,\s*"MANAGER"\s*\)/,
    );
  });

  test(`${functionName} never accepts a creator/reverser id from client input — it always comes from the authenticated session`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/financial-ledger.actions.ts",
      functionName,
    );

    assert.doesNotMatch(functionBody, /parsed\.data\.createdByUserId/);
    assert.doesNotMatch(functionBody, /parsed\.data\.reversedByUserId/);
    assert.doesNotMatch(functionBody, /values\.createdByUserId/);
    assert.doesNotMatch(functionBody, /values\.reversedByUserId/);
    assert.match(functionBody, /authorization\.user\.id/);
  });
}

test("changePasswordAction still authorizes through assertCanChangePassword (narrowed to ADMIN-only elevation one layer down)", () => {
  const functionBody = extractFunctionBody(
    "src/actions/auth.actions.ts",
    "changePasswordAction",
  );

  assert.match(functionBody, /assertCanChangePassword\(/);
});

test("createProspectAction authorizes via requireAuthenticatedUser — prospecting is role-neutral for any authenticated active User (Ticket 15H.1)", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect.actions.ts",
    "createProspectAction",
  );

  assert.match(functionBody, /authorizeAction\(\(\) => requireAuthenticatedUser\(\)\)/);
  assert.doesNotMatch(functionBody, /requireRole\(/);
  assert.doesNotMatch(functionBody, /requireAdmin\(/);
  assert.doesNotMatch(functionBody, /requireCommercial\(/);
});

test("createProspectAction never accepts an owner from client input — the Commercial is always the authenticated caller", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect.actions.ts",
    "createProspectAction",
  );

  assert.doesNotMatch(functionBody, /parsed\.data\.assignedUserId/);
  assert.doesNotMatch(functionBody, /parsed\.data\.agentName/);
  assert.doesNotMatch(functionBody, /values\.assignedUserId/);
  assert.match(functionBody, /createProspect\(authorization\.user, parsed\.data\)/);
});

test("createCommercialActivityAction authorizes via requireCommercial, not the admin role set", () => {
  const functionBody = extractFunctionBody(
    "src/actions/commercial-prospect.actions.ts",
    "createCommercialActivityAction",
  );

  assert.match(functionBody, /authorizeAction\(requireCommercial\)/);
  assert.doesNotMatch(functionBody, /requireRole\(/);
});

for (const functionName of [
  "createProspectActionAction",
  "completeProspectActionAction",
  "cancelProspectActionAction",
]) {
  test(`${functionName} authorizes via requireAuthenticatedUser — ProspectAction participation is role-neutral (Ticket 20B, following 15H.1)`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/prospect-action.actions.ts",
      functionName,
    );

    assert.match(functionBody, /authorizeAction\(\(\) => requireAuthenticatedUser\(\)\)/);
    assert.doesNotMatch(functionBody, /requireRole\(/);
    assert.doesNotMatch(functionBody, /requireAdmin\(/);
    assert.doesNotMatch(functionBody, /requireCommercial\(/);
  });
}

test("createProspectActionAction never accepts a creator id from client input — it always comes from the authenticated session", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect-action.actions.ts",
    "createProspectActionAction",
  );

  assert.doesNotMatch(functionBody, /parsed\.data\.createdByUserId/);
  assert.doesNotMatch(functionBody, /values\.createdByUserId/);
  assert.match(functionBody, /createProspectAction\(authorization\.user, parsed\.data\)/);
});

test("completeProspectActionAction never accepts a completer id from client input — it always comes from the authenticated session", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect-action.actions.ts",
    "completeProspectActionAction",
  );

  assert.doesNotMatch(functionBody, /parsed\.data\.completedByUserId/);
  assert.doesNotMatch(functionBody, /values\.completedByUserId/);
  assert.match(functionBody, /authorization\.user/);
});

test("cancelProspectActionAction never accepts a canceler id from client input — it always comes from the authenticated session", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect-action.actions.ts",
    "cancelProspectActionAction",
  );

  assert.doesNotMatch(functionBody, /parsed\.data\.canceledByUserId/);
  assert.doesNotMatch(functionBody, /values\.canceledByUserId/);
  assert.match(functionBody, /authorization\.user/);
});

test("submitProspectFollowUpAction authorizes via requireAuthenticatedUser — ownership scoping happens inside the service, keyed off the actor's role (Ticket 20C, following 20B/15H.1)", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect-follow-up.actions.ts",
    "submitProspectFollowUpAction",
  );

  assert.match(functionBody, /authorizeAction\(\(\) => requireAuthenticatedUser\(\)\)/);
  assert.doesNotMatch(functionBody, /requireRole\(/);
  assert.doesNotMatch(functionBody, /requireAdmin\(/);
  assert.doesNotMatch(functionBody, /requireCommercial\(/);
});

test("submitProspectFollowUpAction never accepts an actor/creator/completer id from client input — it always comes from the authenticated session", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect-follow-up.actions.ts",
    "submitProspectFollowUpAction",
  );

  assert.doesNotMatch(functionBody, /parsed\.data\.actorUserId/);
  assert.doesNotMatch(functionBody, /parsed\.data\.createdByUserId/);
  assert.doesNotMatch(functionBody, /parsed\.data\.completedByUserId/);
  assert.doesNotMatch(functionBody, /values\.actorUserId/);
  assert.match(
    functionBody,
    /submitProspectFollowUp\(authorization\.user, parsed\.data\)/,
  );
});

const selfServiceActions = [
  {
    file: "src/actions/commercial-profile.actions.ts",
    functionName: "updateOwnProfileAction",
    serviceCall: "updateOwnProfile(",
  },
  {
    file: "src/actions/self-account.actions.ts",
    functionName: "changeOwnPasswordAction",
    serviceCall: "changeOwnPassword(",
  },
];

for (const action of selfServiceActions) {
  test(`${action.functionName} authorizes before validating and before calling its service`, () => {
    const functionBody = extractFunctionBody(action.file, action.functionName);

    const authorizeIndex = functionBody.search(/authorizeSelf\(\)/);
    const validateIndex = functionBody.indexOf(".safeParse(");
    const serviceIndex = functionBody.indexOf(action.serviceCall);

    assert.ok(authorizeIndex >= 0, `${action.functionName} has no authorizeSelf() call`);
    assert.ok(validateIndex >= 0, `${action.functionName} has no .safeParse(...) call`);
    assert.ok(
      serviceIndex >= 0,
      `${action.functionName} never calls ${action.serviceCall}`,
    );
    assert.ok(
      authorizeIndex < validateIndex,
      `${action.functionName} must authorize before validating`,
    );
    assert.ok(
      validateIndex < serviceIndex,
      `${action.functionName} must validate before calling its service`,
    );
  });

  test(`${action.functionName} never accepts a userId from the client — the target is always the authenticated caller`, () => {
    const functionBody = extractFunctionBody(action.file, action.functionName);

    assert.doesNotMatch(functionBody, /parsed\.data\.userId/);
    assert.doesNotMatch(functionBody, /values\.userId/);
    assert.doesNotMatch(functionBody, /\buserId\s*:\s*parsed\.data/);
  });
}

test("changeOwnPasswordAction's authorizeSelf() is identity-based (requireAuthenticatedUser), not role-based — every authenticated role reaches the same workflow (Ticket 25F)", () => {
  const source = readFileSync("src/actions/self-account.actions.ts", "utf8");

  assert.match(source, /requireAuthenticatedUser\(\)/);
  assert.doesNotMatch(source, /requireRole\(/);
  assert.doesNotMatch(source, /requireAdmin\(/);
  assert.doesNotMatch(source, /requireManager\(/);
  assert.doesNotMatch(source, /requireCommercial\(/);
});

test("changeOwnPasswordAction always targets the authenticated actor re-verified via assertActiveAccountAccess, never a value derived from parsed input", () => {
  const functionBody = extractFunctionBody(
    "src/actions/self-account.actions.ts",
    "changeOwnPasswordAction",
  );

  assert.match(functionBody, /changeOwnPassword\(\s*account\.id,/);
  assert.doesNotMatch(functionBody, /changeOwnPassword\(\s*parsed\.data/);
});

for (const functionName of [
  "createPersonalNoteAction",
  "updatePersonalNoteAction",
  "deletePersonalNoteAction",
]) {
  test(`${functionName} authorizes via requireAuthenticatedUser — every role manages only their own notes`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/personal-note.actions.ts",
      functionName,
    );

    assert.match(functionBody, /authorizeAction\(\(\) => requireAuthenticatedUser\(\)\)/);
    assert.doesNotMatch(functionBody, /requireRole\(/);
    assert.doesNotMatch(functionBody, /requireAdmin\(/);
  });

  test(`${functionName} never accepts a userId from client input — ownership comes from the session`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/personal-note.actions.ts",
      functionName,
    );

    assert.doesNotMatch(functionBody, /parsed\.data\.userId/);
    assert.doesNotMatch(functionBody, /values\.userId/);
    assert.match(functionBody, /authorization\.user\.id/);
  });
}

for (const functionName of [
  "createDailyReportAction",
  "updateDailyReportAction",
  "submitDailyReportAction",
]) {
  test(`${functionName} authorizes via requireAuthenticatedUser — every assigned role manages only their own daily reports (Ticket 19A)`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/daily-report.actions.ts",
      functionName,
    );

    assert.match(functionBody, /authorizeAction\(\(\) => requireAuthenticatedUser\(\)\)/);
    assert.doesNotMatch(functionBody, /requireRole\(/);
    assert.doesNotMatch(functionBody, /requireAdmin\(/);
  });

  test(`${functionName} never accepts an owner/user id from client input — ownership comes from the session`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/daily-report.actions.ts",
      functionName,
    );

    assert.doesNotMatch(functionBody, /parsed\.data\.ownerUserId/);
    assert.doesNotMatch(functionBody, /parsed\.data\.userId/);
    assert.doesNotMatch(functionBody, /values\.ownerUserId/);
    assert.doesNotMatch(functionBody, /values\.userId/);
    assert.match(functionBody, /authorization\.user\.id/);
  });
}

test("loginAction stays intentionally public (it's the entry point that establishes identity)", () => {
  const functionBody = extractFunctionBody(
    "src/actions/auth.actions.ts",
    "loginAction",
  );

  assert.doesNotMatch(functionBody, /authorizeAction\(/);
});

function extractFunctionBody(file: string, functionName: string): string {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(`function ${functionName}`);
  assert.ok(start >= 0, `could not find function ${functionName} in ${file}`);

  const nextExportIndex = source.indexOf("\nexport ", start + 1);
  return nextExportIndex === -1
    ? source.slice(start)
    : source.slice(start, nextExportIndex);
}
