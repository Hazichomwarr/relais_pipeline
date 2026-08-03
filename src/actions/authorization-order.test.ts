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
    functionName: "updateProspectFollowUpAction",
    serviceCall: "updateProspectFollowUp(",
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
    functionName: "updateCommercialProspectFollowUpAction",
    serviceCall: "updateCommercialProspect(",
  },
  {
    file: "src/actions/commercial-prospect.actions.ts",
    functionName: "createCommercialActivityAction",
    serviceCall: "createCommercialActivity(",
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

test("createProspectAction stays intentionally public (the field-rep submission form has no login)", () => {
  const functionBody = extractFunctionBody(
    "src/actions/prospect.actions.ts",
    "createProspectAction",
  );

  assert.doesNotMatch(functionBody, /authorizeAction\(/);
});

for (const functionName of [
  "updateCommercialProspectFollowUpAction",
  "createCommercialActivityAction",
]) {
  test(`${functionName} authorizes via requireCommercial, not the admin role set`, () => {
    const functionBody = extractFunctionBody(
      "src/actions/commercial-prospect.actions.ts",
      functionName,
    );

    assert.match(functionBody, /authorizeAction\(requireCommercial\)/);
    assert.doesNotMatch(functionBody, /requireRole\(/);
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
