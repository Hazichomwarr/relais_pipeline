import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminUrl } from "./admin-search-params";
import { getAssignedUserName } from "./prospect-ownership";

test("prefers the linked User name, including for an inactive historical User", () => {
  const name = getAssignedUserName({
    agentName: "Historical spelling",
    assignedUser: {
      firstName: "Aminata",
      lastName: "Ouédraogo",
    },
  });

  assert.equal(name, "Aminata Ouédraogo");
});

test("falls back to the historical agentName for unresolved prospects", () => {
  const name = getAssignedUserName({
    agentName: "Commercial Ouagadougou",
    assignedUser: null,
  });

  assert.equal(name, "Commercial Ouagadougou");
});

test("dashboard User filtering uses userId and preserves other URL filters", () => {
  const url = buildAdminUrl(
    "product=KARMDA&date=2026-08-03",
    "userId",
    "cm123",
  );

  assert.equal(
    url,
    "/admin?product=KARMDA&date=2026-08-03&userId=cm123",
  );
  assert.equal(url.includes("agent="), false);
});
