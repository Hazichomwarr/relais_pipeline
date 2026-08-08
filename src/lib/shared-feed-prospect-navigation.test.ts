import assert from "node:assert/strict";
import test from "node:test";

import { resolveSharedFeedProspectHref } from "./shared-feed-prospect-navigation";

const karmdaProspect = {
  id: "prospect-1",
  product: "KARMDA" as const,
  assignedUserId: "commercial-1",
};

const nonSchoolProspect = {
  id: "prospect-2",
  product: "DIGITAL_SERVICES" as const,
  assignedUserId: "commercial-1",
};

test("ADMIN always receives the admin detail link, regardless of ownership or product", () => {
  const viewer = { id: "admin-1", role: "ADMIN" as const };

  assert.equal(
    resolveSharedFeedProspectHref(viewer, karmdaProspect),
    "/admin/prospects/prospect-1",
  );
  assert.equal(
    resolveSharedFeedProspectHref(viewer, nonSchoolProspect),
    "/admin/prospects/prospect-2",
  );
});

test("MANAGER always receives the admin detail link", () => {
  const viewer = { id: "manager-1", role: "MANAGER" as const };

  assert.equal(
    resolveSharedFeedProspectHref(viewer, karmdaProspect),
    "/admin/prospects/prospect-1",
  );
});

test("COMMERCIAL viewing their own prospect receives the editable commercial detail link", () => {
  const viewer = { id: "commercial-1", role: "COMMERCIAL" as const };

  assert.equal(
    resolveSharedFeedProspectHref(viewer, karmdaProspect),
    "/dashboard/commercial/prospects/prospect-1",
  );
  assert.equal(
    resolveSharedFeedProspectHref(viewer, nonSchoolProspect),
    "/dashboard/commercial/prospects/prospect-2",
  );
});

test("COMMERCIAL viewing another commercial's KARMDA school receives the read-only school summary link", () => {
  const viewer = { id: "commercial-2", role: "COMMERCIAL" as const };

  assert.equal(
    resolveSharedFeedProspectHref(viewer, karmdaProspect),
    "/schools/prospect-1",
  );
});

test("COMMERCIAL viewing another commercial's non-KARMDA prospect receives no link — never an unauthorized editable route", () => {
  const viewer = { id: "commercial-2", role: "COMMERCIAL" as const };

  assert.equal(resolveSharedFeedProspectHref(viewer, nonSchoolProspect), null);
});

test("COMMERCIAL viewing an unassigned non-KARMDA prospect receives no link", () => {
  const viewer = { id: "commercial-2", role: "COMMERCIAL" as const };
  const unassigned = {
    id: "prospect-3",
    product: "LOKARI" as const,
    assignedUserId: null,
  };

  assert.equal(resolveSharedFeedProspectHref(viewer, unassigned), null);
});
