import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import { buildAdminMyProspectsWhere } from "./admin-my-prospects.service-core";
import { buildCommercialProspectWhere } from "./commercial-prospect.service-core";
import {
  buildProspectData,
  canOwnProspect,
  type ProspectCreationActor,
} from "./prospect-creation.service-core";

function validInput(overrides: Partial<ValidatedProspectInput> = {}): ValidatedProspectInput {
  return {
    product: "KARMDA",
    name: "École Wend-Panga",
    prospectType: "École privée",
    contactName: "Mme Kaboré",
    phone: "70 12 34 56",
    location: "Ouagadougou",
    interest: "INTERESTED",
    status: "NEW",
    notes: "Le directeur souhaite organiser une démonstration.",
    duplicateSchoolReviewed: false,
    schoolType: "Privée",
    ...overrides,
  };
}

/**
 * Ticket 21B — "Mes prospects" continuity across roles. 21A already proved
 * `Prospect.assignedUserId` survives every role transition at the
 * persistence layer; these tests stay at the service/route composition
 * level — the actual functions each route calls — rather than duplicating
 * 21A's low-level ownership tests.
 */

type FakeProspect = { id: string; assignedUserId: string | null };

function queryByWhere(
  prospects: FakeProspect[],
  where: { assignedUserId?: unknown },
): FakeProspect[] {
  return prospects.filter((prospect) => prospect.assignedUserId === where.assignedUserId);
}

function ids(prospects: FakeProspect[]): string[] {
  return [...prospects.map((prospect) => prospect.id)].sort();
}

// ---------------------------------------------------------------------------
// The two routes' query builders already converge on the same concept
// ---------------------------------------------------------------------------

test("buildAdminMyProspectsWhere (ADMIN/MANAGER's /admin/my-prospects) and buildCommercialProspectWhere (COMMERCIAL's /dashboard/commercial) resolve the exact same owned prospects for the same user id", () => {
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
    { id: "prospect-c", assignedUserId: "someone-else" },
  ];

  const adminWhere = buildAdminMyProspectsWhere("amidou");
  const commercialWhere = buildCommercialProspectWhere("amidou");

  const adminResult = ids(queryByWhere(prospects, adminWhere));
  const commercialResult = ids(queryByWhere(prospects, commercialWhere));

  assert.deepEqual(adminResult, commercialResult);
  assert.deepEqual(adminResult, ["prospect-a", "prospect-b"]);
});

test("neither query builder references UserRole or a .role check — ownership is resolved by identity alone", () => {
  for (const file of [
    "src/services/admin-my-prospects.service-core.ts",
    "src/services/commercial-prospect.service-core.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /UserRole/);
    assert.doesNotMatch(source, /\.role/);
  }
});

// ---------------------------------------------------------------------------
// Promotion/demotion round trip — the experience, not just the persistence
// ---------------------------------------------------------------------------

test("COMMERCIAL → MANAGER → COMMERCIAL: whichever route's builder applies at each point in the transition returns the exact same owned prospect set", () => {
  const prospects: FakeProspect[] = [
    { id: "prospect-a", assignedUserId: "amidou" },
    { id: "prospect-b", assignedUserId: "amidou" },
    { id: "prospect-c", assignedUserId: "amidou" },
  ];

  // As COMMERCIAL, Amidou's experience is served by
  // buildCommercialProspectWhere (/dashboard/commercial).
  const asCommercialBefore = ids(
    queryByWhere(prospects, buildCommercialProspectWhere("amidou")),
  );

  // After promotion to MANAGER, his experience moves to
  // buildAdminMyProspectsWhere (/admin/my-prospects) — a different route,
  // but the underlying ownership scope must be identical.
  const asManager = ids(queryByWhere(prospects, buildAdminMyProspectsWhere("amidou")));

  // After demotion back to COMMERCIAL, he's served by
  // buildCommercialProspectWhere again.
  const asCommercialAfter = ids(
    queryByWhere(prospects, buildCommercialProspectWhere("amidou")),
  );

  assert.deepEqual(asManager, asCommercialBefore);
  assert.deepEqual(asCommercialAfter, asCommercialBefore);
  assert.deepEqual(asCommercialBefore, ["prospect-a", "prospect-b", "prospect-c"]);
});

for (const [fromRole, toRole] of [
  ["COMMERCIAL", "MANAGER"],
  ["MANAGER", "COMMERCIAL"],
  ["COMMERCIAL", "ADMIN"],
  ["ADMIN", "COMMERCIAL"],
  ["MANAGER", "ADMIN"],
  ["ADMIN", "MANAGER"],
] as Array<[UserRole, UserRole]>) {
  test(`${fromRole} → ${toRole}: the personal-portfolio query still returns the same owned IDs (neither builder takes a role argument)`, () => {
    const prospects: FakeProspect[] = [
      { id: "prospect-a", assignedUserId: "amidou" },
      { id: "prospect-b", assignedUserId: "amidou" },
    ];

    // Neither builder function accepts fromRole/toRole — passed here only
    // to document which transition this iteration models.
    void fromRole;
    void toRole;

    const before = ids(queryByWhere(prospects, buildAdminMyProspectsWhere("amidou")));
    const after = ids(queryByWhere(prospects, buildAdminMyProspectsWhere("amidou")));

    assert.deepEqual(after, before);
    assert.deepEqual(after, ["prospect-a", "prospect-b"]);
  });
}

// ---------------------------------------------------------------------------
// "Everybody can prospect" holds through the unified read path
// ---------------------------------------------------------------------------

test("a prospect created by a MANAGER is immediately visible through buildAdminMyProspectsWhere — creation and 'Mes prospects' agree on ownership", () => {
  const managerActor: ProspectCreationActor = {
    id: "amidou-manager",
    firstName: "Amidou",
    lastName: "Sawadogo",
    role: "MANAGER",
  };
  const data = buildProspectData(validInput(), managerActor);

  assert.equal(data.assignedUserId, managerActor.id);

  const prospects: FakeProspect[] = [{ id: "new-prospect", assignedUserId: data.assignedUserId }];
  const where = buildAdminMyProspectsWhere(managerActor.id);

  assert.deepEqual(ids(queryByWhere(prospects, where)), ["new-prospect"]);
});

/**
 * Ticket 15H.1 established that ownership is never narrowed to
 * COMMERCIAL-only — Ticket 25M's canOwnProspect allow-list preserves
 * that (ADMIN/COMMERCIAL/MANAGER all remain eligible, unchanged) while
 * adding exactly one exclusion: the new ASSISTANT role, which never
 * existed when 15H.1 shipped and was never a candidate this invariant
 * was protecting.
 */
test("prospect creation derives ownership from the actor's identity, not a Commercial-only restriction — every pre-25M role remains eligible", () => {
  assert.equal(canOwnProspect("ADMIN"), true);
  assert.equal(canOwnProspect("COMMERCIAL"), true);
  assert.equal(canOwnProspect("MANAGER"), true);

  const source = readFileSync("src/services/prospect-creation.service-core.ts", "utf8");
  assert.match(source, /assignedUserId:\s*actor\.id/);
});

test("Ticket 25M §10: ASSISTANT is the one role excluded from prospect ownership eligibility", () => {
  assert.equal(canOwnProspect("ASSISTANT"), false);
});
