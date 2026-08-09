import assert from "node:assert/strict";
import test from "node:test";

import { assistantDailyReportDataSchema } from "./assistant-daily-report.schema";

test("every field is optional and defaults to an empty string", () => {
  const result = assistantDailyReportDataSchema.parse({});

  assert.deepEqual(result, {
    documentsPrepared: "",
    clientsFollowed: "",
    pendingPaymentsOrSignatures: "",
    problemsEncountered: "",
    managementDecisionNeeded: "",
  });
});

test("accepts a fully populated payload", () => {
  const result = assistantDailyReportDataSchema.parse({
    documentsPrepared: "Contrats classés.",
    clientsFollowed: "École Horizon relancée.",
    pendingPaymentsOrSignatures: "Facture en attente de signature.",
    problemsEncountered: "Imprimante en panne.",
    managementDecisionNeeded: "Valider le devis école Horizon.",
  });

  assert.equal(result.documentsPrepared, "Contrats classés.");
  assert.equal(result.managementDecisionNeeded, "Valider le devis école Horizon.");
});

test("trims whitespace and normalizes null to empty string", () => {
  const result = assistantDailyReportDataSchema.parse({
    documentsPrepared: "  Espaces autour  ",
    clientsFollowed: null,
  });

  assert.equal(result.documentsPrepared, "Espaces autour");
  assert.equal(result.clientsFollowed, "");
});

test("the payload round-trips through parse without losing data", () => {
  const input = {
    documentsPrepared: "A",
    clientsFollowed: "B",
    pendingPaymentsOrSignatures: "C",
    problemsEncountered: "D",
    managementDecisionNeeded: "E",
  };

  assert.deepEqual(assistantDailyReportDataSchema.parse(input), input);
});
