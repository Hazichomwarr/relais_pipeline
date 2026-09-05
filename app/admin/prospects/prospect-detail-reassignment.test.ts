import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * This page transitively imports next-auth (via requireRole), so it's
 * asserted against source, like every other authorization test in this
 * repo.
 */
const PAGE = "app/admin/prospects/[prospectId]/page.tsx";

test("authorizes before fetching the prospect", () => {
  const source = readFileSync(PAGE, "utf8");
  const authorizeIndex = source.indexOf('requireRole("ADMIN", "MANAGER")');
  const fetchIndex = source.indexOf("getProspectById(");

  assert.ok(authorizeIndex >= 0);
  assert.ok(fetchIndex >= 0);
  assert.ok(authorizeIndex < fetchIndex);
});

test("fetches transfer history and eligible reassignment targets alongside the existing data, in the same bounded Promise.all", () => {
  const source = readFileSync(PAGE, "utf8");
  const promiseAllIndex = source.indexOf("await Promise.all([");
  const promiseAllBlock = source.slice(promiseAllIndex, source.indexOf("]);", promiseAllIndex));

  assert.match(promiseAllBlock, /getProspectAssignmentTransfers\(prospect\.id\)/);
  assert.match(promiseAllBlock, /listProspectReassignmentEligibleUsers\(\)/);
});

test("renders ProspectResponsibilitySection and ProspectAssignmentHistory, passing the truthful responsible display (not the legacy agentName-falling-back helper) for ownership", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /<ProspectResponsibilitySection/);
  assert.match(source, /responsible={responsible}/);
  assert.match(source, /const responsible = getResponsibleUserDisplay\(prospect\)/);
  assert.match(source, /<ProspectAssignmentHistory transfers={transfers} \/>/);
});

test("never writes assignedUserId directly on this page — reassignment only ever happens through ProspectResponsibilitySection's dialog, which calls the 28B service", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.doesNotMatch(source, /\.prospect\.update/);
  assert.doesNotMatch(source, /reassignProspect\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("the old 'Commercial assigné' header box and duplicate InfoField are gone — ownership is shown once, by ProspectResponsibilitySection", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.doesNotMatch(source, /Commercial assigné/);
});

test("getProspectAssignmentTransfers is scoped to this one prospect — never a company-wide transfer read", () => {
  const source = readFileSync(PAGE, "utf8");

  assert.match(source, /getProspectAssignmentTransfers\(prospect\.id\)/);
  assert.doesNotMatch(source, /getProspectAssignmentTransfers\(\)/);
});

test("Ticket 28C §91: management transfer history is never fetched before requireRole(ADMIN, MANAGER) authorizes — the only place this page reaches getProspectAssignmentTransfers is behind that gate", () => {
  const source = readFileSync(PAGE, "utf8");
  const authorizeIndex = source.indexOf('requireRole("ADMIN", "MANAGER")');
  const historyFetchIndex = source.indexOf("getProspectAssignmentTransfers(");

  assert.ok(authorizeIndex >= 0 && historyFetchIndex >= 0);
  assert.ok(authorizeIndex < historyFetchIndex);
});

test("Ticket 28C §25/§42/§60: no Commercial-facing page or component ever imports getProspectAssignmentTransfers or ProspectAssignmentHistory", () => {
  const commercialFacingFiles = [
    "app/dashboard/commercial/prospects/[prospectId]/page.tsx",
    "app/schools/[prospectId]/page.tsx",
    "app/products/digital-services/[prospectId]/page.tsx",
    "app/products/lokari/[prospectId]/page.tsx",
    "app/products/nia/[prospectId]/page.tsx",
  ];

  for (const file of commercialFacingFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /getProspectAssignmentTransfers/, `${file} must not read transfer history`);
    assert.doesNotMatch(source, /ProspectAssignmentHistory/, `${file} must not render transfer history`);
    assert.doesNotMatch(source, /ReassignProspectDialog/, `${file} must not render the reassignment control`);
  }
});
