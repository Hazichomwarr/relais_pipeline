import assert from "node:assert/strict";
import test from "node:test";

import { buildDigitalServicesDirectoryWhere } from "./digital-services-directory.service-core";

test("always scopes to product: DIGITAL_SERVICES", () => {
  const where = buildDigitalServicesDirectoryWhere();

  assert.equal(where.product, "DIGITAL_SERVICES");
  assert.equal(where.name, undefined);
});

test("a search term filters by name only — not contactName/phone/location", () => {
  const where = buildDigitalServicesDirectoryWhere({ search: "Orange Market" });

  assert.deepEqual(where.name, {
    contains: "Orange Market",
    mode: "insensitive",
  });
  assert.equal("contactName" in where, false);
  assert.equal("phone" in where, false);
  assert.equal("location" in where, false);
  assert.equal("OR" in where, false);
});

test("trims surrounding whitespace before searching", () => {
  const where = buildDigitalServicesDirectoryWhere({ search: "  Orange  " });

  assert.deepEqual(where.name, { contains: "Orange", mode: "insensitive" });
});

test("a blank/whitespace-only search is treated as no search", () => {
  const where = buildDigitalServicesDirectoryWhere({ search: "   " });

  assert.equal(where.name, undefined);
  assert.equal(where.product, "DIGITAL_SERVICES");
});

test("search is always case-insensitive", () => {
  const where = buildDigitalServicesDirectoryWhere({ search: "orange" });

  assert.equal(
    (where.name as { mode?: string } | undefined)?.mode,
    "insensitive",
  );
});
