import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * AssistantDailyReportForm is a "use client" component built on
 * react-hook-form's useForm and next/navigation's useRouter, neither of
 * which can run outside a mounted Next.js app router under plain
 * node:test (same constraint documented in
 * component/finances/LedgerEntryForm.test.ts). These assertions run
 * against the source directly instead of rendering the component.
 */
const source = readFileSync(
  "component/daily-reports/AssistantDailyReportForm.tsx",
  "utf8",
);

test("renders both the save-draft and submit actions, never a single combined form action", () => {
  assert.match(source, /Enregistrer le brouillon/);
  assert.match(source, /Envoyer le rapport/);
});

test("save persists via createDailyReportAction on first save, updateDailyReportAction afterward — dispatched on activeReportId, not on props.mode", () => {
  assert.match(source, /activeReportId\s*\?[\s\S]{0,40}updateDailyReportAction/);
  assert.match(source, /:\s*await createDailyReportAction/);
});

test("submitting calls persistDraft before submitDailyReportAction, so the submitted content always matches what's on screen", () => {
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

test("reportDate for a new report comes from the centralized business-date helper, not a hand-rolled toISOString slice", () => {
  assert.match(source, /formatDailyReportIsoDate\(new Date\(\)\)/);
  assert.doesNotMatch(source, /toISOString\(\)\.slice/);
});

test("a first successful save navigates to the new report with a saved flash flag", () => {
  assert.match(source, /router\.push\(`\/reports\/\$\{reportId\}\?saved=1`\)/);
});

test("a successful submission navigates with a submitted flash flag", () => {
  assert.match(source, /router\.push\(`\/reports\/\$\{reportId\}\?submitted=1`\)/);
});
