import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * "use server" — transitively pulls in Prisma via the service layer it
 * calls, so (like every other server action/service file in this repo)
 * it can't be executed under plain node:test. Asserted against the
 * source.
 */
const source = readFileSync(
  "src/actions/professional-contribution.actions.ts",
  "utf8",
);

test("Ticket 25K.2 §3/§4: creation returns the durable assessmentId on success, not just success:true, so the caller can redirect without a second lookup", () => {
  assert.match(
    source,
    /export type CreateProfessionalContributionAssessmentActionResult =\s*\n\s*\| \{ success: true; assessmentId: string \}/,
  );
  assert.match(
    source,
    /return \{ success: true, assessmentId: result\.assessmentId \};/,
  );
});

test("createProfessionalContributionAssessmentAction's declared return type matches its actual result type", () => {
  assert.match(
    source,
    /export async function createProfessionalContributionAssessmentAction\(\s*\n\s*values: unknown,\s*\n\s*\): Promise<CreateProfessionalContributionAssessmentActionResult>/,
  );
});
