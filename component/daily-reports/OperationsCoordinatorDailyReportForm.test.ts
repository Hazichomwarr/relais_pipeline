import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Same constraint as AssistantDailyReportForm.test.ts — a "use client"
 * react-hook-form component can't run under plain node:test, so these
 * assertions run against the source directly.
 */
const source = readFileSync(
  "component/daily-reports/OperationsCoordinatorDailyReportForm.tsx",
  "utf8",
);

test("renders both the save-draft and submit actions", () => {
  assert.match(source, /Enregistrer le brouillon/);
  assert.match(source, /Envoyer le rapport/);
});

test("prospecting targets are imported from the shared schema, never hand-duplicated numbers", () => {
  assert.match(
    source,
    /import\s*\{[^}]*DIGITAL_SERVICES_PROSPECTING_TARGET[^}]*KARMDA_SCHOOL_PROSPECTING_TARGET[^}]*\}\s*from\s*"@\/src\/lib\/validations\/operations-coordinator-daily-report\.schema"/,
  );
});

test("unchecking the installation/training exception clears its justification field", () => {
  assert.match(
    source,
    /if \(!prospectingException\)[\s\S]{0,60}setValue\("prospectingExceptionReason", ""\)/,
  );
});

test("the justification field is only rendered when the exception checkbox is checked", () => {
  assert.match(source, /\{Boolean\(prospectingException\) && \(/);
  assert.match(source, /Justification \*/);
});

test("save persists via createDailyReportAction on first save, updateDailyReportAction afterward", () => {
  assert.match(source, /activeReportId\s*\?[\s\S]{0,40}updateDailyReportAction/);
  assert.match(source, /:\s*await createDailyReportAction/);
});

test("submitting calls persistDraft before submitDailyReportAction", () => {
  const submitFn = source.match(
    /async function onSubmitReport[\s\S]*?\n}/,
  )?.[0];

  assert.ok(submitFn, "onSubmitReport not found");
  assert.match(submitFn!, /persistDraft\(values\)/);
  assert.match(submitFn!, /submitDailyReportAction\(\{ reportId \}\)/);
  assert.ok(
    submitFn!.indexOf("persistDraft(values)") <
      submitFn!.indexOf("submitDailyReportAction"),
    "persistDraft must run before submitDailyReportAction",
  );
});

test("the create/update payload never includes a client-claimed templateType or status", () => {
  assert.doesNotMatch(source, /templateType:/);
  assert.doesNotMatch(source, /status:\s*["']SUBMITTED["']/);
});

test("counts above target are never capped client-side — no Math.min against the targets", () => {
  assert.doesNotMatch(source, /Math\.min\(/);
});
