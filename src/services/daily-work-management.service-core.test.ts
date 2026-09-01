import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import * as dailyWorkManagementServiceCore from "./daily-work-management.service-core";
import {
  composeDailyWorkManagementOverview,
  resolveMissingUserIds,
  type RosterUser,
} from "./daily-work-management.service-core";
import type { DailyTaskRecord } from "./daily-task.service-core";
import type { WorkdayRecord } from "./workday.service-core";

const WORK_DATE = new Date("2026-09-01T00:00:00.000Z");

function user(overrides: Partial<RosterUser> = {}): RosterUser {
  return {
    id: "user-1",
    firstName: "Amidou",
    lastName: "Koané",
    role: "COMMERCIAL",
    active: true,
    ...overrides,
  };
}

function workday(overrides: Partial<WorkdayRecord> = {}): WorkdayRecord {
  return {
    id: "workday-1",
    employeeUserId: "user-1",
    workDate: WORK_DATE,
    expectedStartTime: 480,
    expectedEndTime: 1020,
    startedAt: new Date("2026-09-01T07:57:00.000Z"),
    confirmedAt: null,
    confirmedByUserId: null,
    endedAt: null,
    ...overrides,
  };
}

function task(overrides: Partial<DailyTaskRecord> = {}): DailyTaskRecord {
  return {
    id: "task-1",
    workDate: WORK_DATE,
    assignedToUserId: "user-1",
    assignedByUserId: "mgr-1",
    content: "Relancer les écoles",
    assignedAt: new Date("2026-09-01T09:00:00.000Z"),
    status: "OPEN",
    completedAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveMissingUserIds
// ---------------------------------------------------------------------------

test("resolveMissingUserIds: empty when every referenced id is already in the roster", () => {
  const roster = [user({ id: "user-1" }), user({ id: "mgr-1", role: "MANAGER" })];
  const missing = resolveMissingUserIds(
    roster,
    [workday({ employeeUserId: "user-1" })],
    [task({ assignedToUserId: "user-1", assignedByUserId: "mgr-1" })],
  );
  assert.deepEqual(missing, []);
});

test("resolveMissingUserIds: finds a workday employee not in the roster (e.g. deactivated same day)", () => {
  const missing = resolveMissingUserIds(
    [],
    [workday({ employeeUserId: "former-emp" })],
    [],
  );
  assert.deepEqual(missing, ["former-emp"]);
});

test("resolveMissingUserIds: finds a task assignor not in the roster (e.g. an ADMIN, never part of the roster query)", () => {
  const roster = [user({ id: "emp-1" })];
  const missing = resolveMissingUserIds(
    roster,
    [],
    [task({ assignedToUserId: "emp-1", assignedByUserId: "admin-1" })],
  );
  assert.deepEqual(missing, ["admin-1"]);
});

// ---------------------------------------------------------------------------
// composeDailyWorkManagementOverview — roster/read composition (27G §75)
// ---------------------------------------------------------------------------

test("an active roster of Manager, Commercial, and Assistant all appear as agents", () => {
  const roster = [
    user({ id: "mgr-1", role: "MANAGER" }),
    user({ id: "com-1", role: "COMMERCIAL" }),
    user({ id: "ast-1", role: "ASSISTANT" }),
  ];
  const agents = composeDailyWorkManagementOverview({ id: "admin-1", role: "ADMIN" }, roster, [], []);

  assert.deepEqual(
    agents.map((a) => a.user.id).sort(),
    ["ast-1", "com-1", "mgr-1"],
  );
});

test("today's Workday is joined onto the correct agent, and no others", () => {
  const roster = [user({ id: "emp-1" }), user({ id: "emp-2" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "emp-1" })],
    [],
  );

  const emp1 = agents.find((a) => a.user.id === "emp-1");
  const emp2 = agents.find((a) => a.user.id === "emp-2");
  assert.ok(emp1?.workday);
  assert.equal(emp2?.workday, null);
});

test("today's tasks are joined onto the correct agent's task list", () => {
  const roster = [user({ id: "emp-1" }), user({ id: "emp-2" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ id: "t1", assignedToUserId: "emp-1" })],
  );

  const emp1 = agents.find((a) => a.user.id === "emp-1");
  const emp2 = agents.find((a) => a.user.id === "emp-2");
  assert.equal(emp1?.tasks.length, 1);
  assert.equal(emp2?.tasks.length, 0);
});

test("an employee with no Workday remains visible with workday: null — never inferred as absent", () => {
  const roster = [user({ id: "emp-1" })];
  const agents = composeDailyWorkManagementOverview({ id: "admin-1", role: "ADMIN" }, roster, [], []);
  assert.equal(agents[0].workday, null);
});

test("an employee with tasks but no Workday is represented truthfully — tasks never imply attendance", () => {
  const roster = [user({ id: "emp-1" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "emp-1" })],
  );

  assert.equal(agents[0].workday, null);
  assert.equal(agents[0].tasks.length, 1);
});

test("a same-day historical Workday for someone no longer in the active roster is preserved, not dropped (27A §8)", () => {
  const roster = [user({ id: "emp-1" })]; // "former-emp" deliberately absent — simulates same-day deactivation
  const extraUsers = [user({ id: "former-emp", firstName: "Ancien", lastName: "Employé", active: false })];

  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "former-emp" })],
    [],
    extraUsers,
  );

  const formerAgent = agents.find((a) => a.user.id === "former-emp");
  assert.ok(formerAgent, "the deactivated employee's Workday must still appear");
  assert.ok(formerAgent.workday);
});

test("task assignor names resolve correctly, including an assignor who is not part of the roster (e.g. ADMIN)", () => {
  const roster = [user({ id: "emp-1" })];
  const extraUsers = [
    user({ id: "admin-1", role: "ADMIN", firstName: "Hamza", lastName: "Admin" }),
  ];

  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "emp-1", assignedByUserId: "admin-1" })],
    extraUsers,
  );

  assert.equal(agents[0].tasks[0].assignedByName, "Hamza Admin");
});

// ---------------------------------------------------------------------------
// Confirmation presentation matrix (27G §76)
// ---------------------------------------------------------------------------

for (const subjectRole of ["MANAGER", "COMMERCIAL", "ASSISTANT"] as UserRole[]) {
  test(`ADMIN sees the confirm hint for an unconfirmed ${subjectRole}`, () => {
    const roster = [user({ id: "emp-1", role: subjectRole })];
    const agents = composeDailyWorkManagementOverview(
      { id: "admin-1", role: "ADMIN" },
      roster,
      [workday({ employeeUserId: "emp-1" })],
      [],
    );
    assert.equal(agents[0].canConfirmStart, true);
  });
}

test("MANAGER sees the confirm hint for Commercial and Assistant", () => {
  for (const subjectRole of ["COMMERCIAL", "ASSISTANT"] as UserRole[]) {
    const roster = [user({ id: "emp-1", role: subjectRole })];
    const agents = composeDailyWorkManagementOverview(
      { id: "mgr-1", role: "MANAGER" },
      roster,
      [workday({ employeeUserId: "emp-1" })],
      [],
    );
    assert.equal(agents[0].canConfirmStart, true, `expected MANAGER to confirm ${subjectRole}`);
  }
});

test("MANAGER does not see the confirm hint for self", () => {
  const roster = [user({ id: "mgr-1", role: "MANAGER" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "mgr-1", role: "MANAGER" },
    roster,
    [workday({ employeeUserId: "mgr-1" })],
    [],
  );
  assert.equal(agents[0].canConfirmStart, false);
});

test("MANAGER does not see the confirm hint for another Manager", () => {
  const roster = [user({ id: "mgr-2", role: "MANAGER" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "mgr-1", role: "MANAGER" },
    roster,
    [workday({ employeeUserId: "mgr-2" })],
    [],
  );
  assert.equal(agents[0].canConfirmStart, false);
});

test("no confirm hint before a Workday exists", () => {
  const roster = [user({ id: "emp-1" })];
  const agents = composeDailyWorkManagementOverview({ id: "admin-1", role: "ADMIN" }, roster, [], []);
  assert.equal(agents[0].canConfirmStart, false);
});

test("no confirm hint once already confirmed", () => {
  const roster = [user({ id: "emp-1" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "emp-1", confirmedAt: new Date("2026-09-01T08:10:00.000Z") })],
    [],
  );
  assert.equal(agents[0].canConfirmStart, false);
});

test("the confirm hint remains available for an eligible ended-but-unconfirmed Workday (27A §24/25)", () => {
  const roster = [user({ id: "emp-1" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "emp-1", endedAt: new Date("2026-09-01T17:00:00.000Z"), confirmedAt: null })],
    [],
  );
  assert.equal(agents[0].canConfirmStart, true);
});

// ---------------------------------------------------------------------------
// Assignment presentation matrix (27G §77)
// ---------------------------------------------------------------------------

test("ADMIN sees the assign hint for Manager and Commercial, not Assistant", () => {
  const roster = [
    user({ id: "mgr-1", role: "MANAGER" }),
    user({ id: "com-1", role: "COMMERCIAL" }),
    user({ id: "ast-1", role: "ASSISTANT" }),
  ];
  const agents = composeDailyWorkManagementOverview({ id: "admin-1", role: "ADMIN" }, roster, [], []);

  assert.equal(agents.find((a) => a.user.id === "mgr-1")?.canAssignTask, true);
  assert.equal(agents.find((a) => a.user.id === "com-1")?.canAssignTask, true);
  assert.equal(agents.find((a) => a.user.id === "ast-1")?.canAssignTask, false);
});

test("MANAGER sees the assign hint only for Commercial — not self, not another Manager, not Assistant", () => {
  const roster = [
    user({ id: "mgr-1", role: "MANAGER" }),
    user({ id: "mgr-2", role: "MANAGER" }),
    user({ id: "com-1", role: "COMMERCIAL" }),
    user({ id: "ast-1", role: "ASSISTANT" }),
  ];
  const agents = composeDailyWorkManagementOverview({ id: "mgr-1", role: "MANAGER" }, roster, [], []);

  assert.equal(agents.find((a) => a.user.id === "com-1")?.canAssignTask, true);
  assert.equal(agents.find((a) => a.user.id === "mgr-1")?.canAssignTask, false);
  assert.equal(agents.find((a) => a.user.id === "mgr-2")?.canAssignTask, false);
  assert.equal(agents.find((a) => a.user.id === "ast-1")?.canAssignTask, false);
});

test("assignment is available before the employee's Workday starts", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview({ id: "admin-1", role: "ADMIN" }, roster, [], []);
  assert.equal(agents[0].canAssignTask, true);
});

test("assignment is available during an open Workday", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "com-1", endedAt: null })],
    [],
  );
  assert.equal(agents[0].canAssignTask, true);
});

test("assignment is unavailable after the Workday has ended", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [workday({ employeeUserId: "com-1", endedAt: new Date("2026-09-01T17:00:00.000Z") })],
    [],
  );
  assert.equal(agents[0].canAssignTask, false);
});

// ---------------------------------------------------------------------------
// Cancellation presentation matrix (27G §78)
// ---------------------------------------------------------------------------

test("ADMIN sees the cancel hint on any OPEN task, regardless of assignor", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", assignedByUserId: "mgr-1", status: "OPEN" })],
  );
  assert.equal(agents[0].tasks[0].canCancel, true);
});

test("MANAGER sees the cancel hint only on their own OPEN assignment", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "mgr-1", role: "MANAGER" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", assignedByUserId: "mgr-1", status: "OPEN" })],
  );
  assert.equal(agents[0].tasks[0].canCancel, true);
});

test("MANAGER does not see the cancel hint on another Manager's OPEN assignment", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "mgr-1", role: "MANAGER" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", assignedByUserId: "mgr-2", status: "OPEN" })],
  );
  assert.equal(agents[0].tasks[0].canCancel, false);
});

test("MANAGER does not see the cancel hint on an ADMIN-assigned task", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "mgr-1", role: "MANAGER" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", assignedByUserId: "admin-1", status: "OPEN" })],
  );
  assert.equal(agents[0].tasks[0].canCancel, false);
});

test("no cancel hint on a COMPLETED task, even for ADMIN", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", status: "COMPLETED", completedAt: new Date() })],
  );
  assert.equal(agents[0].tasks[0].canCancel, false);
});

test("no cancel hint on an already-CANCELLED task", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", status: "CANCELLED", cancellationReason: "Plus nécessaire" })],
  );
  assert.equal(agents[0].tasks[0].canCancel, false);
});

test("a cancelled task remains visible in the composed output, with its reason", () => {
  const roster = [user({ id: "com-1", role: "COMMERCIAL" })];
  const agents = composeDailyWorkManagementOverview(
    { id: "admin-1", role: "ADMIN" },
    roster,
    [],
    [task({ assignedToUserId: "com-1", status: "CANCELLED", cancellationReason: "Le client a annulé" })],
  );
  assert.equal(agents[0].tasks.length, 1);
  assert.equal(agents[0].tasks[0].cancellationReason, "Le client a annulé");
});

// ---------------------------------------------------------------------------
// No impersonation (27G §79) — structural
// ---------------------------------------------------------------------------

test("the composition core exposes no employee-impersonation function (start/end/complete/uncomplete for someone else)", () => {
  const exported = dailyWorkManagementServiceCore as Record<string, unknown>;
  assert.equal(typeof exported.startWorkdayFor, "undefined");
  assert.equal(typeof exported.endWorkdayFor, "undefined");
  assert.equal(typeof exported.completeTaskFor, "undefined");
  assert.equal(typeof exported.uncompleteTaskFor, "undefined");
});

// ---------------------------------------------------------------------------
// Non-interference / structural checks on the wiring layer
// ---------------------------------------------------------------------------

test("the roster query excludes ADMIN and queries an exact workDate, never a date range", () => {
  const wiring = readFileSync("src/services/daily-work-management.service.ts", "utf8");
  assert.match(wiring, /DAILY_WORK_ROSTER_ROLES.*=.*\["MANAGER", "COMMERCIAL", "ASSISTANT"\]/);
  assert.doesNotMatch(wiring, /"ADMIN"/);
  assert.match(wiring, /where: \{ workDate \}/);
  assert.doesNotMatch(wiring, /gte|lte|gt:|lt:/);
});

test("the composition core has no Prisma import", () => {
  const core = readFileSync("src/services/daily-work-management.service-core.ts", "utf8");
  assert.doesNotMatch(core, /import \{ prisma \}/);
  assert.doesNotMatch(core, /"server-only"/);
});
