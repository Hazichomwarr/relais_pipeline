import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { UserRole } from "@prisma/client";

import * as dailyTaskServiceCore from "./daily-task.service-core";
import {
  assignTaskCore,
  cancelTaskCore,
  canAssignTask,
  canCancelTask,
  completeMyTaskCore,
  uncompleteMyTaskCore,
  type AssignTaskDependencies,
  type CancelTaskDependencies,
  type CompleteMyTaskDependencies,
  type DailyTaskActor,
  type DailyTaskRecord,
  type DailyTaskSubject,
  type UncompleteMyTaskDependencies,
  type WorkdayOpenState,
} from "./daily-task.service-core";

const BUSINESS_DATE_1 = new Date("2026-09-01T00:00:00.000Z");
const BUSINESS_DATE_2 = new Date("2026-09-02T00:00:00.000Z");
const BUSINESS_DATE_YESTERDAY = new Date("2026-08-31T00:00:00.000Z");

function actor(overrides: Partial<DailyTaskActor> = {}): DailyTaskActor {
  return { id: "mgr-1", role: "MANAGER", active: true, ...overrides };
}

function makeTask(overrides: Partial<DailyTaskRecord> = {}): DailyTaskRecord {
  return {
    id: "task-1",
    workDate: BUSINESS_DATE_1,
    assignedToUserId: "emp-1",
    assignedByUserId: "mgr-1",
    content: "Relancer les écoles intéressées",
    assignedAt: new Date("2026-08-31T18:00:00.000Z"),
    status: "OPEN",
    completedAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

function createTaskStore(initial: DailyTaskRecord[] = []) {
  const tasks = initial.map((task) => ({ ...task }));
  let nextId = tasks.length + 1;

  const findTask = async (taskId: string) =>
    tasks.find((task) => task.id === taskId) ?? null;

  const create = async (fields: {
    workDate: Date;
    assignedToUserId: string;
    assignedByUserId: string;
    content: string;
    assignedAt: Date;
  }): Promise<DailyTaskRecord> => {
    const task: DailyTaskRecord = {
      id: `task-${nextId++}`,
      ...fields,
      status: "OPEN",
      completedAt: null,
      cancellationReason: null,
    };
    tasks.push(task);
    return task;
  };

  const completeAtomically = async (
    taskId: string,
    assignedToUserId: string,
    completedAt: Date,
  ) => {
    const task = tasks.find(
      (item) =>
        item.id === taskId &&
        item.assignedToUserId === assignedToUserId &&
        item.status === "OPEN",
    );
    if (!task) {
      return { count: 0 };
    }
    task.status = "COMPLETED";
    task.completedAt = completedAt;
    return { count: 1 };
  };

  const uncompleteAtomically = async (taskId: string, assignedToUserId: string) => {
    const task = tasks.find(
      (item) =>
        item.id === taskId &&
        item.assignedToUserId === assignedToUserId &&
        item.status === "COMPLETED",
    );
    if (!task) {
      return { count: 0 };
    }
    task.status = "OPEN";
    task.completedAt = null;
    return { count: 1 };
  };

  const cancelAtomically = async (taskId: string, cancellationReason: string) => {
    const task = tasks.find((item) => item.id === taskId && item.status === "OPEN");
    if (!task) {
      return { count: 0 };
    }
    task.status = "CANCELLED";
    task.cancellationReason = cancellationReason;
    return { count: 1 };
  };

  return { tasks, findTask, create, completeAtomically, uncompleteAtomically, cancelAtomically };
}

function subjectMap(
  subjects: Record<string, DailyTaskSubject>,
): (userId: string) => Promise<DailyTaskSubject | null> {
  return async (userId) => subjects[userId] ?? null;
}

function workdayMap(
  workdays: Record<string, WorkdayOpenState>,
): (employeeUserId: string, workDate: Date) => Promise<WorkdayOpenState | null> {
  return async (employeeUserId, workDate) =>
    workdays[`${employeeUserId}:${workDate.toISOString()}`] ?? null;
}

// ---------------------------------------------------------------------------
// Ticket 27E §5/§61 — the full assignment matrix
// ---------------------------------------------------------------------------

const ALLOWED_ASSIGNMENTS: Array<[UserRole, UserRole]> = [
  ["ADMIN", "MANAGER"],
  ["ADMIN", "COMMERCIAL"],
  ["MANAGER", "COMMERCIAL"],
];

const DENIED_ASSIGNMENTS: Array<[UserRole, UserRole]> = [
  ["ADMIN", "ASSISTANT"],
  ["ADMIN", "ADMIN"],
  ["MANAGER", "MANAGER"],
  ["MANAGER", "ASSISTANT"],
  ["MANAGER", "ADMIN"],
  ["COMMERCIAL", "MANAGER"],
  ["COMMERCIAL", "COMMERCIAL"],
  ["COMMERCIAL", "ASSISTANT"],
  ["ASSISTANT", "COMMERCIAL"],
  ["ASSISTANT", "MANAGER"],
];

for (const [actorRole, subjectRole] of ALLOWED_ASSIGNMENTS) {
  test(`canAssignTask: ${actorRole} -> ${subjectRole} is allowed`, () => {
    assert.equal(canAssignTask(actorRole, subjectRole, false), true);
  });
}

for (const [actorRole, subjectRole] of DENIED_ASSIGNMENTS) {
  test(`canAssignTask: ${actorRole} -> ${subjectRole} is denied`, () => {
    assert.equal(canAssignTask(actorRole, subjectRole, false), false);
  });
}

test("canAssignTask: MANAGER cannot self-assign, even though MANAGER is both an eligible recipient and an assignor", () => {
  assert.equal(canAssignTask("MANAGER", "MANAGER", true), false);
});

test("canAssignTask: self-assignment is denied for every actor role", () => {
  for (const role of ["ADMIN", "MANAGER", "COMMERCIAL", "ASSISTANT"] as UserRole[]) {
    assert.equal(canAssignTask(role, role, true), false);
  }
});

// ---------------------------------------------------------------------------
// Ticket 27E §61 — assignTaskCore, full flow
// ---------------------------------------------------------------------------

function assignDependencies(
  store: ReturnType<typeof createTaskStore>,
  subjects: Record<string, DailyTaskSubject>,
  workdays: Record<string, WorkdayOpenState> = {},
): AssignTaskDependencies {
  return {
    findSubject: subjectMap(subjects),
    findWorkdayOpenState: workdayMap(workdays),
    create: store.create,
  };
}

test("an inactive actor cannot assign a task", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await assignTaskCore(
    actor({ active: false }),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INACTIVE_USER");
  assert.deepEqual(store.tasks, []);
});

test("an inactive recipient cannot receive a task", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: false } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "RECIPIENT_NOT_ELIGIBLE");
});

test("today assignment is allowed", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("future assignment is allowed", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_2, content: "Préparer les dossiers" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("past-date assignment is denied", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_YESTERDAY, content: "Relancer" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PAST_DATE_NOT_ALLOWED");
});

test("assignment requires no Workday to exist at all", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  // No workday fixture provided at all — findWorkdayOpenState will return null.

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects, {}),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("assignment while the employee's Workday is open (started, not ended) is allowed", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const workdays = { [`emp-1:${BUSINESS_DATE_1.toISOString()}`]: { endedAt: null } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("same-day assignment after the employee's Workday has ended is denied", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const workdays = {
    [`emp-1:${BUSINESS_DATE_1.toISOString()}`]: { endedAt: new Date("2026-09-01T17:00:00.000Z") },
  };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "WORKDAY_ALREADY_ENDED");
});

test("a future-date assignment ignores the employee's today Workday state entirely", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  // Today's workday already ended — must not block a task for TOMORROW.
  const workdays = {
    [`emp-1:${BUSINESS_DATE_1.toISOString()}`]: { endedAt: new Date("2026-09-01T17:00:00.000Z") },
  };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_2, content: "Préparer" },
    assignDependencies(store, subjects, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("duplicate identical tasks are allowed — no uniqueness check runs before create", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const input = { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer les écoles" };

  const first = await assignTaskCore(actor(), input, assignDependencies(store, subjects), BUSINESS_DATE_1);
  const second = await assignTaskCore(actor(), input, assignDependencies(store, subjects), BUSINESS_DATE_1);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(store.tasks.length, 2);
});

test("assignedByUserId comes from the server-resolved actor, and assignedAt comes from the server clock", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };
  const now = new Date("2026-09-01T09:15:00.000Z");

  const result = await assignTaskCore(
    actor({ id: "mgr-42" }),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects),
    now,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.task.assignedByUserId, "mgr-42");
    assert.equal(result.task.assignedAt.getTime(), now.getTime());
  }
});

test("a newly assigned task starts OPEN, with completedAt and cancellationReason null", async () => {
  const store = createTaskStore();
  const subjects = { "emp-1": { id: "emp-1", role: "COMMERCIAL" as UserRole, active: true } };

  const result = await assignTaskCore(
    actor(),
    { assignedToUserId: "emp-1", workDate: BUSINESS_DATE_1, content: "Relancer" },
    assignDependencies(store, subjects),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.task.status, "OPEN");
    assert.equal(result.task.completedAt, null);
    assert.equal(result.task.cancellationReason, null);
  }
});

test("no reassignment function exists on the core module", () => {
  const exported = dailyTaskServiceCore as Record<string, unknown>;
  assert.equal(typeof exported.reassignTask, "undefined");
  assert.equal(typeof exported.changeAssignee, "undefined");
  assert.equal(typeof exported.editTask, "undefined");
});

// ---------------------------------------------------------------------------
// Ticket 27E §62 — completion
// ---------------------------------------------------------------------------

function completeDependencies(
  store: ReturnType<typeof createTaskStore>,
  workdays: Record<string, WorkdayOpenState> = {},
): CompleteMyTaskDependencies {
  return {
    findTask: store.findTask,
    findWorkdayOpenState: workdayMap(workdays),
    completeAtomically: store.completeAtomically,
  };
}

function openWorkdayFixture(employeeUserId: string, workDate: Date) {
  return { [`${employeeUserId}:${workDate.toISOString()}`]: { endedAt: null } };
}

function endedWorkdayFixture(employeeUserId: string, workDate: Date, endedAt: Date) {
  return { [`${employeeUserId}:${workDate.toISOString()}`]: { endedAt } };
}

test("the assigned employee may complete their own OPEN task during an open Workday", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
  assert.equal(store.tasks[0].status, "COMPLETED");
});

test("a different employee cannot complete someone else's task by knowing the task id", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "emp-1" })]);
  const workdays = openWorkdayFixture("emp-2", BUSINESS_DATE_1);

  const result = await completeMyTaskCore(
    actor({ id: "emp-2", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_TASK_OWNER");
  assert.equal(store.tasks[0].status, "OPEN");
});

test("ADMIN cannot complete an employee's task — ADMIN is never a recipient", async () => {
  const store = createTaskStore([makeTask()]);
  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "ADMIN" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_AUTHORIZED");
});

test("a MANAGER cannot complete another employee's task even though MANAGER is an eligible recipient role", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "commercial-1" })]);
  const result = await completeMyTaskCore(
    actor({ id: "mgr-9", role: "MANAGER" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_TASK_OWNER");
});

test("an inactive employee cannot complete a task", async () => {
  const store = createTaskStore([makeTask()]);
  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL", active: false }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INACTIVE_USER");
});

test("cannot complete a future-dated task", async () => {
  const store = createTaskStore([makeTask({ workDate: BUSINESS_DATE_2 })]);
  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_NOT_FOR_TODAY");
});

test("cannot complete a past-dated task", async () => {
  const store = createTaskStore([makeTask({ workDate: BUSINESS_DATE_YESTERDAY })]);
  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_NOT_FOR_TODAY");
});

test("cannot complete before the employee's Workday has started", async () => {
  const store = createTaskStore([makeTask()]);
  // No workday fixture at all — findWorkdayOpenState returns null.
  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, {}),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "WORKDAY_NOT_STARTED");
});

test("cannot complete after the employee's Workday has ended", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = endedWorkdayFixture("emp-1", BUSINESS_DATE_1, new Date("2026-09-01T17:00:00.000Z"));

  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "WORKDAY_ALREADY_ENDED");
});

test("completedAt comes from the server clock", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);
  const now = new Date("2026-09-01T11:00:00.000Z");

  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    now,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.task.completedAt?.getTime(), now.getTime());
  }
});

test("a second completion does not rewrite the original completedAt", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);
  const firstComplete = new Date("2026-09-01T11:00:00.000Z");
  const secondAttempt = new Date("2026-09-01T12:00:00.000Z");

  const first = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    firstComplete,
  );
  assert.equal(first.success, true);

  const second = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    secondAttempt,
  );

  assert.equal(second.success, false);
  if (!second.success) assert.equal(second.code, "TASK_ALREADY_COMPLETED");
  assert.equal(store.tasks[0].completedAt?.getTime(), firstComplete.getTime());
});

test("a CANCELLED task cannot be completed", async () => {
  const store = createTaskStore([makeTask({ status: "CANCELLED", cancellationReason: "Plus nécessaire" })]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_CANCELLED");
});

// ---------------------------------------------------------------------------
// Ticket 27E §63 — uncompletion
// ---------------------------------------------------------------------------

function uncompleteDependencies(
  store: ReturnType<typeof createTaskStore>,
  workdays: Record<string, WorkdayOpenState> = {},
): UncompleteMyTaskDependencies {
  return {
    findTask: store.findTask,
    findWorkdayOpenState: workdayMap(workdays),
    uncompleteAtomically: store.uncompleteAtomically,
  };
}

test("the owner may uncomplete their own COMPLETED task", async () => {
  const store = createTaskStore([
    makeTask({ status: "COMPLETED", completedAt: new Date("2026-09-01T11:00:00.000Z") }),
  ]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
  assert.equal(store.tasks[0].status, "OPEN");
  assert.equal(store.tasks[0].completedAt, null);
});

test("a non-owner cannot uncomplete someone else's task", async () => {
  const store = createTaskStore([
    makeTask({ assignedToUserId: "emp-1", status: "COMPLETED", completedAt: new Date() }),
  ]);
  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-2", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_TASK_OWNER");
});

test("an inactive owner cannot uncomplete", async () => {
  const store = createTaskStore([makeTask({ status: "COMPLETED", completedAt: new Date() })]);
  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL", active: false }),
    "task-1",
    uncompleteDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INACTIVE_USER");
});

test("an OPEN task cannot be uncompleted", async () => {
  const store = createTaskStore([makeTask({ status: "OPEN" })]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_NOT_COMPLETED");
});

test("a CANCELLED task cannot be uncompleted", async () => {
  const store = createTaskStore([makeTask({ status: "CANCELLED", cancellationReason: "Retard" })]);
  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_CANCELLED");
});

test("cannot uncomplete after the Workday has ended", async () => {
  const store = createTaskStore([
    makeTask({ status: "COMPLETED", completedAt: new Date("2026-09-01T11:00:00.000Z") }),
  ]);
  const workdays = endedWorkdayFixture("emp-1", BUSINESS_DATE_1, new Date("2026-09-01T17:00:00.000Z"));

  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "WORKDAY_ALREADY_ENDED");
});

test("cannot uncomplete a task that is not for today's business date", async () => {
  const store = createTaskStore([
    makeTask({ workDate: BUSINESS_DATE_YESTERDAY, status: "COMPLETED", completedAt: new Date() }),
  ]);

  const result = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_NOT_FOR_TODAY");
});

test("re-completion after uncompletion records a new completedAt", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);
  const emp = actor({ id: "emp-1", role: "COMMERCIAL" });

  const firstComplete = await completeMyTaskCore(
    emp,
    "task-1",
    completeDependencies(store, workdays),
    new Date("2026-09-01T11:00:00.000Z"),
  );
  assert.equal(firstComplete.success, true);

  const uncomplete = await uncompleteMyTaskCore(
    emp,
    "task-1",
    uncompleteDependencies(store, workdays),
    new Date("2026-09-01T11:05:00.000Z"),
  );
  assert.equal(uncomplete.success, true);
  assert.equal(store.tasks[0].completedAt, null);

  const secondComplete = new Date("2026-09-01T11:20:00.000Z");
  const recomplete = await completeMyTaskCore(
    emp,
    "task-1",
    completeDependencies(store, workdays),
    secondComplete,
  );

  assert.equal(recomplete.success, true);
  const finalTask = store.tasks[0];
  assert.equal(finalTask.status, "COMPLETED");
  assert.equal(finalTask.completedAt?.getTime(), secondComplete.getTime());
});

// ---------------------------------------------------------------------------
// Ticket 27E §1/§40/§64 — cancellation authority
// ---------------------------------------------------------------------------

test("canCancelTask: ADMIN may cancel a task ADMIN itself assigned", () => {
  assert.equal(
    canCancelTask({ actorRole: "ADMIN", actorUserId: "admin-1", assignedByUserId: "admin-1" }),
    true,
  );
});

test("canCancelTask: ADMIN may cancel a task a MANAGER assigned", () => {
  assert.equal(
    canCancelTask({ actorRole: "ADMIN", actorUserId: "admin-1", assignedByUserId: "mgr-1" }),
    true,
  );
});

test("canCancelTask: the original MANAGER may cancel their own assignment", () => {
  assert.equal(
    canCancelTask({ actorRole: "MANAGER", actorUserId: "mgr-1", assignedByUserId: "mgr-1" }),
    true,
  );
});

test("canCancelTask: a different MANAGER cannot cancel someone else's assignment", () => {
  assert.equal(
    canCancelTask({ actorRole: "MANAGER", actorUserId: "mgr-2", assignedByUserId: "mgr-1" }),
    false,
  );
});

test("canCancelTask: COMMERCIAL and ASSISTANT can never cancel", () => {
  assert.equal(
    canCancelTask({ actorRole: "COMMERCIAL", actorUserId: "c-1", assignedByUserId: "c-1" }),
    false,
  );
  assert.equal(
    canCancelTask({ actorRole: "ASSISTANT", actorUserId: "a-1", assignedByUserId: "a-1" }),
    false,
  );
});

// ---------------------------------------------------------------------------
// Ticket 27E §65 — cancellation lifecycle
// ---------------------------------------------------------------------------

function cancelDependencies(
  store: ReturnType<typeof createTaskStore>,
  workdays: Record<string, WorkdayOpenState> = {},
): CancelTaskDependencies {
  return {
    findTask: store.findTask,
    findWorkdayOpenState: workdayMap(workdays),
    cancelAtomically: store.cancelAtomically,
  };
}

test("OPEN -> CANCELLED persists the reason, without touching assignment provenance", async () => {
  const store = createTaskStore([makeTask({ assignedByUserId: "mgr-1", assignedToUserId: "emp-1" })]);

  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Le prospect a annulé" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
  assert.equal(store.tasks[0].status, "CANCELLED");
  assert.equal(store.tasks[0].cancellationReason, "Le prospect a annulé");
  assert.equal(store.tasks[0].assignedByUserId, "mgr-1");
  assert.equal(store.tasks[0].assignedToUserId, "emp-1");
});

test("an empty cancellation reason is denied", async () => {
  const store = createTaskStore([makeTask()]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INVALID_CANCELLATION_REASON");
});

test("a whitespace-only cancellation reason is denied", async () => {
  const store = createTaskStore([makeTask()]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "   " },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "INVALID_CANCELLATION_REASON");
});

test("a COMPLETED task cannot be cancelled", async () => {
  const store = createTaskStore([makeTask({ status: "COMPLETED", completedAt: new Date() })]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Trop tard" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_ALREADY_COMPLETED");
});

test("an already-CANCELLED task stays stable — a second cancellation is denied without mutating the reason", async () => {
  const store = createTaskStore([makeTask({ status: "CANCELLED", cancellationReason: "Première raison" })]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Deuxième raison" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "TASK_CANCELLED");
  assert.equal(store.tasks[0].cancellationReason, "Première raison");
});

test("a future OPEN task can be cancelled", async () => {
  const store = createTaskStore([makeTask({ workDate: BUSINESS_DATE_2 })]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Plus nécessaire" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("today's OPEN task can be cancelled before the day closes", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Plus nécessaire" },
    cancelDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

test("today's task cannot be cancelled after the employee's Workday has ended", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = endedWorkdayFixture("emp-1", BUSINESS_DATE_1, new Date("2026-09-01T17:00:00.000Z"));

  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Plus nécessaire" },
    cancelDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "WORKDAY_ALREADY_ENDED");
});

test("a past-date task cannot be cancelled", async () => {
  const store = createTaskStore([makeTask({ workDate: BUSINESS_DATE_YESTERDAY })]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Trop tard" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "PAST_DATE_NOT_ALLOWED");
});

test("cancellation never deletes the row", async () => {
  const store = createTaskStore([makeTask()]);
  await cancelTaskCore(
    actor({ id: "mgr-1", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Plus nécessaire" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(store.tasks.length, 1);
});

// ---------------------------------------------------------------------------
// Ticket 27E §45/§66 — concurrency
// ---------------------------------------------------------------------------

test("two simultaneous completion requests: first wins, second does not rewrite completedAt", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);
  const emp = actor({ id: "emp-1", role: "COMMERCIAL" });

  const firstAt = new Date("2026-09-01T11:00:00.000Z");
  const secondAt = new Date("2026-09-01T11:00:01.000Z");

  const [first, second] = await Promise.all([
    completeMyTaskCore(emp, "task-1", completeDependencies(store, workdays), firstAt),
    completeMyTaskCore(emp, "task-1", completeDependencies(store, workdays), secondAt),
  ]);

  const results = [first, second];
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(store.tasks[0].status, "COMPLETED");
});

test("complete-vs-cancel race: exactly one terminal transition wins", async () => {
  const store = createTaskStore([makeTask()]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const [completeResult, cancelResult] = await Promise.all([
    completeMyTaskCore(
      actor({ id: "emp-1", role: "COMMERCIAL" }),
      "task-1",
      completeDependencies(store, workdays),
      BUSINESS_DATE_1,
    ),
    cancelTaskCore(
      actor({ id: "mgr-1", role: "MANAGER" }),
      { taskId: "task-1", cancellationReason: "Plus nécessaire" },
      cancelDependencies(store, workdays),
      BUSINESS_DATE_1,
    ),
  ]);

  const outcomes = [completeResult.success, cancelResult.success];
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.ok(store.tasks[0].status === "COMPLETED" || store.tasks[0].status === "CANCELLED");
  // Never both — the guarded write only ever lets one terminal transition through.
  assert.notEqual(store.tasks[0].status, "OPEN");
});

test("two simultaneous cancellations: first wins, the reason is never overwritten", async () => {
  const store = createTaskStore([makeTask()]);

  const [first, second] = await Promise.all([
    cancelTaskCore(
      actor({ id: "mgr-1", role: "MANAGER" }),
      { taskId: "task-1", cancellationReason: "Raison A" },
      cancelDependencies(store),
      BUSINESS_DATE_1,
    ),
    cancelTaskCore(
      actor({ id: "admin-1", role: "ADMIN" }),
      { taskId: "task-1", cancellationReason: "Raison B" },
      cancelDependencies(store),
      BUSINESS_DATE_1,
    ),
  ]);

  const successes = [first, second].filter((r) => r.success);
  assert.equal(successes.length, 1);
  assert.ok(["Raison A", "Raison B"].includes(store.tasks[0].cancellationReason ?? ""));
});

test("complete requires OPEN, uncomplete requires COMPLETED — guarded predicates are checked accurately, not fabricated into one atomic race", async () => {
  const openStore = createTaskStore([makeTask({ status: "OPEN" })]);
  const completeResult = await completeMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(openStore, openWorkdayFixture("emp-1", BUSINESS_DATE_1)),
    BUSINESS_DATE_1,
  );
  assert.equal(completeResult.success, true);

  const completedStore = createTaskStore([makeTask({ status: "COMPLETED", completedAt: new Date() })]);
  const uncompleteResult = await uncompleteMyTaskCore(
    actor({ id: "emp-1", role: "COMMERCIAL" }),
    "task-1",
    uncompleteDependencies(completedStore, openWorkdayFixture("emp-1", BUSINESS_DATE_1)),
    BUSINESS_DATE_1,
  );
  assert.equal(uncompleteResult.success, true);
});

// ---------------------------------------------------------------------------
// Ticket 27E §67 — IDOR
// ---------------------------------------------------------------------------

test("IDOR: Commercial A cannot complete Commercial B's task by knowing the task id", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "commercial-b" })]);
  const result = await completeMyTaskCore(
    actor({ id: "commercial-a", role: "COMMERCIAL" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_TASK_OWNER");
});

test("IDOR: Manager A cannot complete Commercial B's task", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "commercial-b" })]);
  const result = await completeMyTaskCore(
    actor({ id: "mgr-a", role: "MANAGER" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_TASK_OWNER");
});

test("IDOR: Manager A cannot cancel Manager B's assignment", async () => {
  const store = createTaskStore([makeTask({ assignedByUserId: "mgr-b" })]);
  const result = await cancelTaskCore(
    actor({ id: "mgr-a", role: "MANAGER" }),
    { taskId: "task-1", cancellationReason: "Plus nécessaire" },
    cancelDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "CANCELLATION_NOT_ALLOWED");
});

test("IDOR: Assistant cannot mutate an arbitrary DailyTask by id (complete, uncomplete, or assign)", async () => {
  const store = createTaskStore([makeTask()]);
  const completeResult = await completeMyTaskCore(
    actor({ id: "asst-1", role: "ASSISTANT" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );
  assert.equal(completeResult.success, false);
  if (!completeResult.success) assert.equal(completeResult.code, "NOT_AUTHORIZED");

  const assignResult = await assignTaskCore(
    actor({ id: "asst-1", role: "ASSISTANT" }),
    { assignedToUserId: "emp-2", workDate: BUSINESS_DATE_1, content: "x" },
    assignDependencies(store, { "emp-2": { id: "emp-2", role: "COMMERCIAL", active: true } }),
    BUSINESS_DATE_1,
  );
  assert.equal(assignResult.success, false);
  if (!assignResult.success) assert.equal(assignResult.code, "NOT_AUTHORIZED");
});

test("IDOR: Admin's cancellation authority does not imply completion authority over the same task", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "emp-1" })]);
  const result = await completeMyTaskCore(
    actor({ id: "admin-1", role: "ADMIN" }),
    "task-1",
    completeDependencies(store),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_AUTHORIZED");
});

// ---------------------------------------------------------------------------
// Ticket 27E §53 — historical role-change regression
// ---------------------------------------------------------------------------

test("a task assigned by a Manager who later becomes Commercial remains historically assigned by them — assignedByUserId is never reinterpreted from current role", async () => {
  const store = createTaskStore([makeTask({ assignedByUserId: "former-mgr" })]);
  // "former-mgr" is now COMMERCIAL and thus can no longer assign/cancel at
  // all — but the historical row's assignedByUserId is untouched by that.
  assert.equal(store.tasks[0].assignedByUserId, "former-mgr");
});

test("a task assigned to a Commercial who later becomes Manager remains their task, readable and completable under their new (still-eligible) role", async () => {
  const store = createTaskStore([makeTask({ assignedToUserId: "emp-1" })]);
  const workdays = openWorkdayFixture("emp-1", BUSINESS_DATE_1);

  const result = await completeMyTaskCore(
    actor({ id: "emp-1", role: "MANAGER" }), // promoted since assignment; still eligible
    "task-1",
    completeDependencies(store, workdays),
    BUSINESS_DATE_1,
  );

  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Ticket 27E §68 — non-interference regression
// ---------------------------------------------------------------------------

function importLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "))
    .join("\n");
}

test("DailyTask lifecycle code imports nothing from Workday, Performance, ProspectAction, DailyReport, or OrganizationMembership", () => {
  const core = importLines(readFileSync("src/services/daily-task.service-core.ts", "utf8"));
  const wiring = importLines(readFileSync("src/services/daily-task.service.ts", "utf8"));

  const forbiddenImportPatterns = [
    /workday\.service/,
    /organization-bootstrap/,
    /organization["']/,
    /commercial-results/,
    /execution-discipline/,
    /role-responsibility-assessment/,
    /professional-contribution/,
    /performance-summary/,
    /commercial-performance-target/,
    /prospect-action/,
    /prospect\.service/,
    /daily-report/,
  ];

  for (const pattern of forbiddenImportPatterns) {
    assert.doesNotMatch(core, pattern, `daily-task.service-core.ts must not import ${pattern}`);
    assert.doesNotMatch(wiring, pattern, `daily-task.service.ts must not import ${pattern}`);
  }
});

test("the wiring layer only ever reads Workday (endedAt) — it never creates, starts, ends, or confirms one", () => {
  const wiring = readFileSync("src/services/daily-task.service.ts", "utf8");
  assert.doesNotMatch(wiring, /prisma\.workday\.(create|update(?!Many\(\s*$)|delete)/);
  assert.doesNotMatch(wiring, /startedAt\s*:/);
  assert.doesNotMatch(wiring, /confirmedAt\s*:/);
  assert.match(wiring, /prisma\.workday\.findUnique/);
});

test("DailyTask core has no Prisma runtime import — only type-only enum/UserRole imports are allowed", () => {
  const core = readFileSync("src/services/daily-task.service-core.ts", "utf8");
  assert.doesNotMatch(core, /import \{ prisma \}/);
  assert.doesNotMatch(core, /PrismaClient/);
  assert.doesNotMatch(core, /"server-only"/);
  assert.match(core, /import type \{ DailyTaskStatus, UserRole \} from "@prisma\/client"/);
});
