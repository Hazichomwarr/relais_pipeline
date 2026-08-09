import assert from "node:assert/strict";
import test from "node:test";

import {
  createDailyReportSchema,
  submitDailyReportSchema,
  updateDailyReportSchema,
} from "./daily-report.schema";

test("createDailyReportSchema accepts a valid past business date with content", () => {
  const result = createDailyReportSchema.safeParse({
    reportDate: "2026-08-01",
    accomplishedToday: "Visité 3 écoles.",
    plannedTomorrow: "Relancer les prospects du matin.",
  });

  assert.equal(result.success, true);
});

test("createDailyReportSchema rejects a malformed reportDate", () => {
  const result = createDailyReportSchema.safeParse({
    reportDate: "09/08/2026",
    accomplishedToday: "x",
    plannedTomorrow: "y",
  });

  assert.equal(result.success, false);
});

test("createDailyReportSchema rejects a reportDate more than a day in the future", () => {
  const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isoDate = farFuture.toISOString().slice(0, 10);

  const result = createDailyReportSchema.safeParse({
    reportDate: isoDate,
    accomplishedToday: "x",
    plannedTomorrow: "y",
  });

  assert.equal(result.success, false);
});

test("createDailyReportSchema allows blank content for a draft (autosave-friendly)", () => {
  const result = createDailyReportSchema.safeParse({
    reportDate: "2026-08-01",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.accomplishedToday, "");
    assert.equal(result.data.plannedTomorrow, "");
  }
});

test("createDailyReportSchema trims content", () => {
  const result = createDailyReportSchema.parse({
    reportDate: "2026-08-01",
    accomplishedToday: "  Texte avec espaces  ",
    plannedTomorrow: "  Autre texte  ",
  });

  assert.equal(result.accomplishedToday, "Texte avec espaces");
  assert.equal(result.plannedTomorrow, "Autre texte");
});

test("updateDailyReportSchema requires a reportId", () => {
  const missing = updateDailyReportSchema.safeParse({
    accomplishedToday: "x",
    plannedTomorrow: "y",
  });
  const present = updateDailyReportSchema.safeParse({
    reportId: "report-1",
    accomplishedToday: "x",
    plannedTomorrow: "y",
  });

  assert.equal(missing.success, false);
  assert.equal(present.success, true);
});

test("submitDailyReportSchema only accepts a reportId", () => {
  assert.deepEqual(Object.keys(submitDailyReportSchema.shape), ["reportId"]);
});

test("client schemas silently drop ownerUserId, templateType, status, and submittedAt — those are server/domain controlled", () => {
  const created = createDailyReportSchema.safeParse({
    reportDate: "2026-08-01",
    accomplishedToday: "x",
    plannedTomorrow: "y",
    ownerUserId: "attacker-controlled",
    templateType: "OPERATIONS_COORDINATOR",
    status: "SUBMITTED",
    submittedAt: "2026-08-01T00:00:00.000Z",
  });

  assert.equal(created.success, true);
  if (created.success) {
    const data = created.data as Record<string, unknown>;
    assert.equal("ownerUserId" in data, false);
    assert.equal("templateType" in data, false);
    assert.equal("status" in data, false);
    assert.equal("submittedAt" in data, false);
  }

  const updated = updateDailyReportSchema.safeParse({
    reportId: "report-1",
    ownerUserId: "attacker-controlled",
    templateType: "OPERATIONS_COORDINATOR",
    status: "SUBMITTED",
    submittedAt: "2026-08-01T00:00:00.000Z",
  });

  assert.equal(updated.success, true);
  if (updated.success) {
    const data = updated.data as Record<string, unknown>;
    assert.equal("ownerUserId" in data, false);
    assert.equal("templateType" in data, false);
    assert.equal("status" in data, false);
    assert.equal("submittedAt" in data, false);
  }
});
