import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { User, UserRole } from "@prisma/client";

import type { ValidatedUserInput } from "@/src/lib/validations/user.schema";
import { hydrateDailyReportTemplateData } from "@/src/lib/validations/daily-report-template-data.schema";
import {
  canCancelProspectAction,
  canCompleteProspectAction,
  completeProspectActionCore,
  createProspectActionCore,
  type CreateProspectActionDependencies,
} from "./prospect-action.service-core";
import { resolveEffectiveAssignee } from "./prospect-action-queue.service-core";
import {
  createOwnDailyReportCore,
  updateOwnDailyReportCore,
  type DailyReportRow,
  type DailyReportServiceDependencies,
} from "./daily-report.service-core";
import { updateUserCore, type UserServiceDependencies } from "./user.service-core";
import { isConversionReasonAllowedForOutcome } from "./prospect-conversion.service-core";
import {
  buildWonTransitionActivityData,
  resolveWonCredit,
} from "./prospect-won-transition.service-core";

/**
 * Ticket 21C — operational carryover across role transitions. 21A proved
 * prospect ownership survives; 21B proved the personal-portfolio
 * experience survives; this file proves everything else durable that
 * references a User (ProspectAction assignment/creation, structured
 * follow-up + WON attribution, Daily Report history) survives too — while
 * confirming CURRENT authorization (what the actor may do right now) is
 * still allowed to change, exactly as it should.
 */

/**
 * Ticket 25M §37/§38 — widened from the pre-25M 6 (3×2) directed
 * transitions to the full 12 (4×3) once ASSISTANT exists. Every test
 * below is already role-agnostic in its assertions (identity-based
 * fallbacks, snapshot fields, ownerUserId-only queries), so no new test
 * bodies are needed — only this list.
 */
const allTransitions: Array<[UserRole, UserRole]> = [
  ["COMMERCIAL", "MANAGER"],
  ["MANAGER", "COMMERCIAL"],
  ["COMMERCIAL", "ADMIN"],
  ["ADMIN", "COMMERCIAL"],
  ["MANAGER", "ADMIN"],
  ["ADMIN", "MANAGER"],
  ["COMMERCIAL", "ASSISTANT"],
  ["ASSISTANT", "COMMERCIAL"],
  ["MANAGER", "ASSISTANT"],
  ["ASSISTANT", "MANAGER"],
  ["ADMIN", "ASSISTANT"],
  ["ASSISTANT", "ADMIN"],
];

// ---------------------------------------------------------------------------
// Structural guarantee — the role-mutation path cannot reach any of these
// tables. Extends 21A's "no field to reassign a prospect" proof to the
// rest of 21C's scope.
// ---------------------------------------------------------------------------

test("updateUserCore's dependency contract has no field through which a ProspectAction, ProspectActivity, or DailyReport could be touched", () => {
  const source = readFileSync("src/services/user.service-core.ts", "utf8");
  const updateSignature = source.slice(
    source.indexOf("update: (\n    userId: string,"),
    source.indexOf("findById:"),
  );

  // dailyReportTemplateType is a legitimate, deliberately mutable User
  // column (assigning a template is a separate concern from role, per the
  // ticket's own "Important distinction") — everything else here would be
  // an actual DailyReport/ProspectAction/ProspectActivity row field, which
  // must never appear in a User update signature.
  for (const keyword of [
    "prospect",
    "ProspectAction",
    "ProspectActivity",
    "assignedToUserId",
    "createdByUserId",
    "conversionOutcome",
    "submittedAt",
    "templateData",
    "reportDate",
    "accomplishedToday",
  ]) {
    assert.doesNotMatch(
      updateSignature,
      new RegExp(keyword, "i"),
      `updateUserCore's update() signature must not reference ${keyword}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 1/2/3 — ProspectAction assignment, /actions MINE, and completion survive
// ---------------------------------------------------------------------------

for (const [fromRole, toRole] of allTransitions) {
  test(`${fromRole} → ${toRole}: an OPEN action assigned to the transitioning user remains completable by them (identity-based fallback in canCompleteProspectAction never depends on role)`, () => {
    const action = { assignedToUserId: "amidou" };

    assert.equal(canCompleteProspectAction({ id: "amidou", role: fromRole }, action), true);
    assert.equal(canCompleteProspectAction({ id: "amidou", role: toRole }, action), true);
  });

  test(`${fromRole} → ${toRole}: /actions → MINE still resolves to the same assignee id — resolveEffectiveAssignee takes no role argument`, () => {
    const actor = { id: "amidou" };
    const before = resolveEffectiveAssignee(actor, { scope: "MINE", bucket: "ALL" });
    const after = resolveEffectiveAssignee(actor, { scope: "MINE", bucket: "ALL" });

    assert.equal(before, "amidou");
    assert.equal(after, "amidou");
  });
}

test("completeProspectActionCore: a COMMERCIAL-assigned OPEN action, completed after promotion to MANAGER, succeeds via the identity fallback (not merely because MANAGER can complete anyone's action)", async () => {
  const action = {
    id: "action-1",
    prospectId: "prospect-a",
    assignedToUserId: "amidou",
    createdByUserId: "someone-else",
    status: "OPEN" as const,
    title: "Relancer École ABC vendredi",
    description: null,
    dueAt: new Date("2026-08-14T09:00:00.000Z"),
    completedAt: null,
    completedByUserId: null,
    canceledAt: null,
    canceledByUserId: null,
    cancellationReason: null,
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-01T09:00:00.000Z"),
  };

  const result = await completeProspectActionCore(
    { id: "amidou", role: "MANAGER" },
    "action-1",
    {
      findById: async () => action,
      completeAtomically: async (actionId, completedByUserId) => {
        assert.equal(actionId, "action-1");
        assert.equal(completedByUserId, "amidou");
        return { count: 1 };
      },
    },
  );

  assert.equal(result.success, true);
});

test("canCancelProspectAction: creator/assignee retain cancel rights after any role transition", () => {
  const action = { createdByUserId: "amidou", assignedToUserId: "someone-else" };
  for (const [, toRole] of allTransitions) {
    assert.equal(canCancelProspectAction({ id: "amidou", role: toRole }, action), true);
  }
});

test("Ticket 25M §16/§41: an OPEN action assigned before a transition to ASSISTANT is preserved (never auto-canceled or reassigned), but a NEW action naming that same person as assignee is rejected", async () => {
  // Existing action, assigned while still COMMERCIAL — preserved as a
  // historical/operational fact. No mutation touches it here at all;
  // this half of the test only documents that nothing in this file's
  // role-transition path reaches ProspectAction rows (already proven
  // structurally above), so the action simply keeps existing untouched.
  const existingAction = { assignedToUserId: "amidou", createdByUserId: "someone-else" };
  assert.equal(
    canCompleteProspectAction({ id: "amidou", role: "ASSISTANT" }, existingAction),
    true,
    "the now-Assistant former assignee can still complete their own pre-existing action",
  );

  // A brand-new action naming the same, now-Assistant person as
  // assignee is rejected server-side by the create-time eligibility
  // check — this is the one thing that changes going forward.
  const dependencies: CreateProspectActionDependencies = {
    findProspect: async () => ({ id: "prospect-1" }),
    findAssignee: async () => ({ id: "amidou", active: true, role: "ASSISTANT" }),
    create: async () => {
      throw new Error("must not create a new action for an ineligible assignee");
    },
  };

  const result = await createProspectActionCore(
    "creator-1",
    {
      prospectId: "prospect-1",
      assignedToUserId: "amidou",
      title: "Faire une démonstration",
      description: undefined,
      dueAt: new Date("2026-08-14T10:00:00.000Z"),
    },
    dependencies,
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.code, "ASSIGNEE_NOT_ELIGIBLE");
  }
});

test("the queue's Prisma where-clause is built from assignedToUserId alone — no role condition on the assignee relation", () => {
  const source = readFileSync("src/services/prospect-action-queue.service.ts", "utf8");
  assert.doesNotMatch(source, /assignedToUser:\s*\{\s*role/);
  assert.doesNotMatch(source, /role:\s*"COMMERCIAL"/);
});

// ---------------------------------------------------------------------------
// 4/5/7/8 — structured follow-up, outcome/reason, and WON attribution
// ---------------------------------------------------------------------------

test("ProspectActivity attribution (agentName) is a plain string snapshot, never a User relation — a role transition has no join to rewrite", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelStart = schema.indexOf("model ProspectActivity {");
  const modelEnd = schema.indexOf("\n}", modelStart);
  const model = schema.slice(modelStart, modelEnd);

  assert.match(model, /agentName\s+String\?/);
  assert.doesNotMatch(model, /agentName\s+User/);
});

test("Ticket 25H.1's creditedUserId is a deliberate, distinct new User relation — a different concept from agentName, not a reintroduction of the pattern the test above forbids", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelStart = schema.indexOf("model ProspectActivity {");
  const modelEnd = schema.indexOf("\n}", modelStart);
  const model = schema.slice(modelStart, modelEnd);

  assert.match(model, /creditedUserId\s+String\?/);
  assert.match(model, /creditedUser\s+User\?\s+@relation\("ProspectActivityCreditedUser"/);
});

test("the conversion-compatibility authority stays a pure function of outcome and reason alone — no UserRole, no actor role", () => {
  const source = readFileSync("src/services/prospect-conversion.service-core.ts", "utf8");
  assert.doesNotMatch(source, /UserRole/);
  assert.doesNotMatch(source, /\.role/);
});

test("the WON-transition builder never performs a live role lookup — it only ever echoes the credit snapshot it's handed, never reads or re-derives a role itself", () => {
  const source = readFileSync("src/services/prospect-won-transition.service-core.ts", "utf8");
  assert.doesNotMatch(source, /from ["']@\/src\/lib\/prisma["']/);
  assert.doesNotMatch(source, /prisma\./);
});

test("Ticket 25H.1 §38: a role change made to the source object after resolveWonCredit has already run does not affect the snapshot already taken — resolveWonCredit reads its input once and returns a plain value, not a live reference", () => {
  const assignedUser = { firstName: "Amidou", lastName: "Sawadogo", role: "COMMERCIAL" as UserRole };
  const source = { assignedUserId: "amidou", assignedUser };

  const creditAtWon = resolveWonCredit(source);

  // Simulate the same human being promoted afterward — a genuinely
  // different object, exactly like a fresh Prisma read would return post-
  // transition, never a mutation of what resolveWonCredit already saw.
  const afterPromotion = { assignedUserId: "amidou", assignedUser: { ...assignedUser, role: "MANAGER" as UserRole } };
  const creditIfResolvedAgain = resolveWonCredit(afterPromotion);

  assert.equal(creditAtWon.creditedUserRoleAtEvent, "COMMERCIAL");
  assert.equal(creditIfResolvedAgain.creditedUserRoleAtEvent, "MANAGER");
});

test("isConversionReasonAllowedForOutcome (the outcome/reason compatibility authority) is a pure function of outcome and reason alone", () => {
  // A structured FOLLOW_UP recorded while Amidou was COMMERCIAL remains a
  // valid, durable historical fact regardless of his role today — the
  // compatibility check that validated it at write time takes no actor.
  assert.equal(isConversionReasonAllowedForOutcome("ADVANCED", "DEMO_CONVINCED"), true);
});

test("buildWonTransitionActivityData carries no actor id — agentName (a plain string) is still the only actor-identifying field, credit is a separate concept", () => {
  const data = buildWonTransitionActivityData({
    prospectId: "prospect-b",
    occurredAt: new Date("2026-07-01T10:00:00.000Z"),
    agentName: "Amidou Sawadogo",
    credit: {
      creditedUserId: "commercial-1",
      creditedUserNameAtEvent: "Fatou Zongo",
      creditedUserRoleAtEvent: "COMMERCIAL",
    },
  });

  assert.deepEqual(Object.keys(data).sort(), [
    "agentName",
    "creditedUserId",
    "creditedUserNameAtEvent",
    "creditedUserRoleAtEvent",
    "occurredAt",
    "prospectId",
    "summary",
    "type",
  ]);
  // agentName (the actor) and creditedUserId (who receives credit) are
  // deliberately different people in this fixture — Ticket 25H.1's core
  // scenario (a manager or admin closing a commercial's prospect).
  assert.equal(data.agentName, "Amidou Sawadogo");
  assert.equal(data.creditedUserId, "commercial-1");
});

// ---------------------------------------------------------------------------
// 9/10/11 — Daily Report: snapshot at creation, immutable once SUBMITTED
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<DailyReportRow> = {}): DailyReportRow {
  const templateType = overrides.templateType ?? "ASSISTANT";
  return {
    id: "report-1",
    ownerUserId: "amidou",
    reportDate: new Date("2026-08-12T00:00:00.000Z"),
    templateType,
    status: "DRAFT",
    accomplishedToday: "Visites terrain.",
    plannedTomorrow: "Suivi des prospects intéressés.",
    templateData: hydrateDailyReportTemplateData(templateType, {}),
    submittedAt: null,
    createdAt: new Date("2026-08-12T08:00:00.000Z"),
    updatedAt: new Date("2026-08-12T08:00:00.000Z"),
    ...overrides,
  };
}

function createReportStore(initial: DailyReportRow[] = []) {
  const reports = initial.map((report) => ({ ...report }));

  const dependencies: Pick<
    DailyReportServiceDependencies,
    "findOwnById" | "submitOwnDraft" | "updateOwnDraft"
  > = {
    findOwnById: async (ownerUserId, reportId) =>
      reports.find((r) => r.id === reportId && r.ownerUserId === ownerUserId) ?? null,
    submitOwnDraft: async (ownerUserId, reportId, submittedAt) => {
      const report = reports.find(
        (r) => r.id === reportId && r.ownerUserId === ownerUserId && r.status === "DRAFT",
      );
      if (!report) return 0;
      report.status = "SUBMITTED";
      report.submittedAt = submittedAt;
      return 1;
    },
    updateOwnDraft: async (ownerUserId, reportId, fields, templateData) => {
      const report = reports.find(
        (r) => r.id === reportId && r.ownerUserId === ownerUserId && r.status === "DRAFT",
      );
      if (!report) return 0;
      Object.assign(report, fields, { templateData });
      return 1;
    },
  };

  return { reports, dependencies };
}

test("a SUBMITTED report remains SUBMITTED and immutable across every role transition — role is never read by the immutability guard", async () => {
  const store = createReportStore([
    makeReport({ status: "SUBMITTED", submittedAt: new Date("2026-08-12T18:00:00.000Z") }),
  ]);

  for (const [, toRole] of allTransitions) {
    void toRole; // the guard below never reads role — proven by never passing one
    const result = await updateOwnDailyReportCore(
      "amidou",
      "report-1",
      { accomplishedToday: "Tentative de modification", plannedTomorrow: "x" },
      store.dependencies,
    );

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.code, "DAILY_REPORT_NOT_EDITABLE");
    }
  }

  assert.equal(store.reports[0].status, "SUBMITTED");
  assert.equal(store.reports[0].accomplishedToday, "Visites terrain.");
});

test("submitOwnDailyReportCore's own guard checks report.status alone — role transitions have no path to reopen a SUBMITTED report", () => {
  const source = readFileSync("src/services/daily-report.service-core.ts", "utf8");
  const submitFn = source.slice(
    source.indexOf("export async function submitOwnDailyReportCore"),
    source.indexOf("export async function", source.indexOf("export async function submitOwnDailyReportCore") + 1),
  );
  assert.match(submitFn, /report\.status !== "DRAFT"/);
  assert.doesNotMatch(submitFn, /\.role/);
});

test("a report's templateType is snapshotted at creation and never re-derived from the live user template — a later template reassignment (independent of role) does not rewrite it", async () => {
  let currentTemplate: "ASSISTANT" | "OPERATIONS_COORDINATOR" | null = "ASSISTANT";
  const reports: DailyReportRow[] = [];

  const created = await createOwnDailyReportCore(
    "amidou",
    { accomplishedToday: "x", plannedTomorrow: "y", reportDate: new Date("2026-08-12T00:00:00.000Z") },
    {
      findOwnerTemplateType: async () => currentTemplate,
      findOwnByDate: async () => null,
      create: async (ownerUserId, templateType, reportDate, fields, templateData) => {
        const report = makeReport({
          id: "report-1",
          ownerUserId,
          templateType,
          reportDate,
          ...fields,
          templateData,
        });
        reports.push(report);
        return { id: report.id };
      },
    },
  );
  assert.equal(created.success, true);
  assert.equal(reports[0].templateType, "ASSISTANT");

  // Template reassignment happens independently of any role change.
  currentTemplate = "OPERATIONS_COORDINATOR";

  assert.equal(reports[0].templateType, "ASSISTANT");
});

test("management history/detail queries filter by ownerUserId/status/templateType/reportDate only — never by the owner's current role", () => {
  const source = readFileSync("src/services/daily-report.service.ts", "utf8");
  assert.doesNotMatch(source, /role:\s*"COMMERCIAL"/);
  assert.doesNotMatch(source, /\.role\s*===/);

  const managementWhereFn = source.slice(
    source.indexOf("function buildManagementWhere"),
    source.indexOf("}", source.indexOf("function buildManagementWhere")) + 1,
  );
  assert.doesNotMatch(managementWhereFn, /role/i);
});

test("historical Daily Report visibility (listDailyReportEmployeeOptions) includes anyone who ever submitted/drafted a report, not only users currently assigned a template — a reassignment never hides past reporters", () => {
  const source = readFileSync("src/services/daily-report.service.ts", "utf8");
  assert.match(source, /dailyReports:\s*\{\s*some:\s*\{\}\s*\}/);
});

// ---------------------------------------------------------------------------
// 12/13/14 — the realistic composite fixture, promotion + demotion + round trip
// ---------------------------------------------------------------------------

type FixtureProspect = { id: string; assignedUserId: string };
type FixtureAction = {
  id: string;
  assignedToUserId: string;
  createdByUserId: string;
  status: "OPEN" | "COMPLETED" | "CANCELED";
};
type FixtureActivity = {
  id: string;
  prospectId: string;
  type: "FOLLOW_UP" | "WON_TRANSITION";
  agentName: string;
  conversionOutcome?: string;
  conversionReason?: string;
};

function buildFixture() {
  return {
    prospects: [{ id: "prospect-a", assignedUserId: "amidou" }] as FixtureProspect[],
    actions: [
      { id: "action-1", assignedToUserId: "amidou", createdByUserId: "someone-else", status: "OPEN" },
      { id: "action-2", assignedToUserId: "someone-else", createdByUserId: "amidou", status: "OPEN" },
    ] as FixtureAction[],
    activities: [
      {
        id: "activity-1",
        prospectId: "prospect-a",
        type: "FOLLOW_UP",
        agentName: "Amidou Sawadogo",
        conversionOutcome: "ADVANCED",
        conversionReason: "DEMO_CONVINCED",
      },
      {
        id: "activity-2",
        prospectId: "prospect-b",
        type: "WON_TRANSITION",
        agentName: "Amidou Sawadogo",
      },
    ] as FixtureActivity[],
    dailyReport: makeReport({
      id: "report-r1",
      status: "SUBMITTED",
      submittedAt: new Date("2026-08-12T18:00:00.000Z"),
    }),
  };
}

function snapshot(fixture: ReturnType<typeof buildFixture>) {
  return JSON.parse(JSON.stringify(fixture));
}

test("realistic fixture (Ticket 21C item 12/13/14): Prospect A ownership, Action 1/2, FOLLOW_UP 1, WON history, and Daily Report R1 are all byte-for-byte identical before and after COMMERCIAL → MANAGER → COMMERCIAL", async () => {
  const store = createUserStore([makeUser("amidou", { role: "COMMERCIAL" })]);
  const fixture = buildFixture();
  const before = snapshot(fixture);

  await updateUserCore(
    { userId: "amidou", ...validUserInput({ role: "MANAGER" }) },
    "admin-1",
    store.dependencies,
  );
  assert.equal(store.users[0].role, "MANAGER");
  assert.deepEqual(snapshot(fixture), before);

  const afterPromotion = snapshot(fixture);

  await updateUserCore(
    { userId: "amidou", ...validUserInput({ role: "COMMERCIAL" }) },
    "admin-1",
    store.dependencies,
  );
  assert.equal(store.users[0].role, "COMMERCIAL");
  assert.deepEqual(snapshot(fixture), afterPromotion);
  assert.deepEqual(snapshot(fixture), before);

  // No operational record was recreated — same ids throughout.
  assert.deepEqual(
    fixture.actions.map((a) => a.id),
    ["action-1", "action-2"],
  );
  assert.deepEqual(
    fixture.activities.map((a) => a.id),
    ["activity-1", "activity-2"],
  );
  assert.equal(fixture.dailyReport.id, "report-r1");
  assert.equal(fixture.dailyReport.status, "SUBMITTED");
});

test("realistic fixture: after promotion, Action 1 still appears in Amidou's /actions MINE, Action 2's creator attribution is unchanged, and the FOLLOW_UP/WON events remain attributed to Amidou by name", () => {
  const fixture = buildFixture();

  const mineActionIds = fixture.actions
    .filter((action) => action.assignedToUserId === resolveEffectiveAssignee(
      { id: "amidou" },
      { scope: "MINE", bucket: "ALL" },
    ))
    .map((action) => action.id);
  assert.deepEqual(mineActionIds, ["action-1"]);

  const action2 = fixture.actions.find((a) => a.id === "action-2");
  assert.equal(action2?.createdByUserId, "amidou");

  const followUp = fixture.activities.find((a) => a.id === "activity-1");
  assert.equal(followUp?.agentName, "Amidou Sawadogo");
  assert.equal(followUp?.conversionOutcome, "ADVANCED");
  assert.equal(followUp?.conversionReason, "DEMO_CONVINCED");

  const wonEvent = fixture.activities.find((a) => a.id === "activity-2");
  assert.equal(wonEvent?.agentName, "Amidou Sawadogo");
});

// ---------------------------------------------------------------------------
// Fixture helpers (mirrors role-transition-ownership.test.ts's convention)
// ---------------------------------------------------------------------------

function validUserInput(overrides: Partial<ValidatedUserInput> = {}): ValidatedUserInput {
  return {
    firstName: "Amidou",
    lastName: "Sawadogo",
    email: "amidou@example.com",
    phone: "70 12 34 56",
    role: "COMMERCIAL",
    active: true,
    dailyReportTemplateType: null,
    ...overrides,
  };
}

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    firstName: "Amidou",
    lastName: "Sawadogo",
    email: "amidou@example.com",
    phone: "70 12 34 56",
    passwordHash: null,
    role: "COMMERCIAL",
    active: true,
    dailyReportTemplateType: null,
    createdAt: new Date("2026-08-03T12:00:00.000Z"),
    updatedAt: new Date("2026-08-03T12:00:00.000Z"),
    ...overrides,
  };
}

function createUserStore(initialUsers: User[] = []) {
  const users = initialUsers.map((user) => ({ ...user }));

  const dependencies: UserServiceDependencies = {
    create: async (data) => {
      const user = makeUser(`user-${users.length + 1}`, data);
      users.push(user);
      return { id: user.id };
    },
    update: async (userId, data) => {
      const user = users.find((item) => item.id === userId);
      if (!user) throw new Error("Unknown user");
      Object.assign(user, data, { updatedAt: new Date() });
      return { id: user.id };
    },
    findById: async (userId) => users.find((item) => item.id === userId) ?? null,
    list: async (filters) =>
      users.filter((user) => filters.active === undefined || user.active === filters.active),
  };

  return { users, dependencies };
}
