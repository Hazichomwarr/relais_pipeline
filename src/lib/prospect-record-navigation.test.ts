import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProspectRecordNavigationProps,
  getProspectNavigationContextLabel,
} from "./prospect-record-navigation";
import type { AdjacentProspects } from "@/src/services/prospect-navigation.service-core";

test("admin/manager context label names the assigned commercial", () => {
  const label = getProspectNavigationContextLabel(
    { assignedUserId: "commercial-1", assignedUserName: "Amidou Koane" },
    "admin",
  );

  assert.equal(label, "Navigation parmi les prospects de Amidou Koane");
});

test("commercial context label uses the simpler generic wording", () => {
  const label = getProspectNavigationContextLabel(
    { assignedUserId: "commercial-1", assignedUserName: "Amidou Koane" },
    "commercial",
  );

  assert.equal(label, "Navigation parmi mes prospects");
});

test("an unassigned prospect has no context label for either role", () => {
  assert.equal(
    getProspectNavigationContextLabel(
      { assignedUserId: null, assignedUserName: "Sans commercial" },
      "admin",
    ),
    null,
  );
  assert.equal(
    getProspectNavigationContextLabel(
      { assignedUserId: null, assignedUserName: "Sans commercial" },
      "commercial",
    ),
    null,
  );
});

function adjacent(
  overrides: Partial<AdjacentProspects> = {},
): AdjacentProspects {
  return {
    previous: { id: "prospect-d", name: "École D" },
    next: { id: "prospect-b", name: "École B" },
    context: { assignedUserId: "commercial-1", assignedUserName: "Amidou Koane" },
    ...overrides,
  };
}

test("builds previous/next hrefs from the base path, neighbor id, and encoded returnTo", () => {
  const props = buildProspectRecordNavigationProps({
    role: "admin",
    basePath: "/admin/prospects",
    adjacent: adjacent(),
    safeReturnTo: "/admin?userId=123",
  });

  assert.equal(
    props.previousHref,
    "/admin/prospects/prospect-d?returnTo=%2Fadmin%3FuserId%3D123",
  );
  assert.equal(props.previousLabel, "École D");
  assert.equal(
    props.nextHref,
    "/admin/prospects/prospect-b?returnTo=%2Fadmin%3FuserId%3D123",
  );
  assert.equal(props.nextLabel, "École B");
});

test("a missing neighbor produces a null href and label", () => {
  const props = buildProspectRecordNavigationProps({
    role: "commercial",
    basePath: "/dashboard/commercial/prospects",
    adjacent: adjacent({ previous: null }),
    safeReturnTo: "/dashboard/commercial",
  });

  assert.equal(props.previousHref, null);
  assert.equal(props.previousLabel, null);
  assert.notEqual(props.nextHref, null);
});

test("returnHref always equals the safeReturnTo value verbatim", () => {
  const props = buildProspectRecordNavigationProps({
    role: "admin",
    basePath: "/admin/prospects",
    adjacent: adjacent(),
    safeReturnTo: "/admin?status=QUALIFIED",
  });

  assert.equal(props.returnHref, "/admin?status=QUALIFIED");
});

test("contextLabel reflects the role and unassigned state via the same rule as getProspectNavigationContextLabel", () => {
  const props = buildProspectRecordNavigationProps({
    role: "commercial",
    basePath: "/dashboard/commercial/prospects",
    adjacent: adjacent({
      context: { assignedUserId: null, assignedUserName: "Sans commercial" },
    }),
    safeReturnTo: "/dashboard/commercial",
  });

  assert.equal(props.contextLabel, null);
});
