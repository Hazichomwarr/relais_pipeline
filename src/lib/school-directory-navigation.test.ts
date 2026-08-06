import assert from "node:assert/strict";
import test from "node:test";

import { resolveSchoolDetailHref } from "./school-directory-navigation";

test("admin always opens the full admin prospect page", () => {
  const href = resolveSchoolDetailHref(
    { id: "admin-1", role: "ADMIN" },
    { id: "school-1", assignedUserId: "commercial-1" },
  );

  assert.equal(href, "/admin/prospects/school-1");
});

test("manager always opens the full admin prospect page", () => {
  const href = resolveSchoolDetailHref(
    { id: "manager-1", role: "MANAGER" },
    { id: "school-1", assignedUserId: "commercial-1" },
  );

  assert.equal(href, "/admin/prospects/school-1");
});

test("commercial opens their own editable page for a school they own", () => {
  const href = resolveSchoolDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "school-1", assignedUserId: "commercial-1" },
  );

  assert.equal(href, "/dashboard/commercial/prospects/school-1");
});

test("commercial opens the read-only summary for another commercial's school", () => {
  const href = resolveSchoolDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "school-1", assignedUserId: "someone-else" },
  );

  assert.equal(href, "/schools/school-1");
});

test("commercial opens the read-only summary for an unassigned school", () => {
  const href = resolveSchoolDetailHref(
    { id: "commercial-1", role: "COMMERCIAL" },
    { id: "school-1", assignedUserId: null },
  );

  assert.equal(href, "/schools/school-1");
});
