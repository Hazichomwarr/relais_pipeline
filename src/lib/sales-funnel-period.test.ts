import assert from "node:assert/strict";
import test from "node:test";

import { resolveSalesFunnelPeriod } from "./sales-funnel-period";

const REFERENCE = new Date("2026-08-13T10:00:00.000Z");

test('period="all" has no lower or upper date bound', () => {
  const resolved = resolveSalesFunnelPeriod("all", REFERENCE);
  assert.equal(resolved.from, null);
  assert.equal(resolved.toExclusive, null);
  assert.equal(resolved.label, "Tout");
});

test('period="today" delegates to the centralized business-day boundary, not a second implementation', () => {
  const resolved = resolveSalesFunnelPeriod("today", REFERENCE);
  assert.deepEqual(resolved.from, new Date("2026-08-13T00:00:00.000Z"));
  assert.deepEqual(resolved.toExclusive, new Date("2026-08-14T00:00:00.000Z"));
  assert.equal(resolved.label, "Aujourd’hui");
});

test('period="month" resolves to the business-local calendar month', () => {
  const resolved = resolveSalesFunnelPeriod("month", REFERENCE);
  assert.deepEqual(resolved.from, new Date("2026-08-01T00:00:00.000Z"));
  assert.deepEqual(resolved.toExclusive, new Date("2026-09-01T00:00:00.000Z"));
  assert.equal(resolved.label, "Ce mois");
});

test('period="year" resolves to the business-local calendar year', () => {
  const resolved = resolveSalesFunnelPeriod("year", REFERENCE);
  assert.deepEqual(resolved.from, new Date("2026-01-01T00:00:00.000Z"));
  assert.deepEqual(resolved.toExclusive, new Date("2027-01-01T00:00:00.000Z"));
});

test("bucket resolution does not depend on the developer machine's local timezone", () => {
  const originalTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const resolved = resolveSalesFunnelPeriod("today", REFERENCE);
    assert.deepEqual(resolved.from, new Date("2026-08-13T00:00:00.000Z"));
  } finally {
    process.env.TZ = originalTz;
  }
});
