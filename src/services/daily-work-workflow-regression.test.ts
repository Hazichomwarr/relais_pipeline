import assert from "node:assert/strict";
import test from "node:test";

import {
  assignTaskCore,
  cancelTaskCore,
  completeMyTaskCore,
  type AssignTaskDependencies,
  type CancelTaskDependencies,
  type CompleteMyTaskDependencies,
  type DailyTaskRecord,
  type DailyTaskSubject,
  type WorkdayOpenState,
} from "./daily-task.service-core";
import { composeDailyWorkManagementOverview } from "./daily-work-management.service-core";
import {
  confirmWorkdayStartForCore,
  endMyWorkdayCore,
  startMyWorkdayCore,
  type ConfirmWorkdayStartDependencies,
  type EndWorkdayDependencies,
  type StartWorkdayDependencies,
  type WorkdayRecord,
  type WorkdaySubject,
} from "./workday.service-core";

/**
 * Ticket 27H §46 — proves the pieces built separately across 27C/27E/27G
 * actually compose into the two real end-to-end workflows a workday
 * lives through, at the service/fixture level (no production write).
 */

const BUSINESS_DATE = new Date("2026-09-01T00:00:00.000Z");

const MANAGER = { id: "mgr-1", role: "MANAGER" as const, active: true };
const EMPLOYEE = { id: "emp-1", role: "COMMERCIAL" as const, active: true };
const ADMIN = { id: "admin-1", role: "ADMIN" as const, active: true };

function makeWorkdayStore() {
  const workdays: WorkdayRecord[] = [];
  let nextId = 1;

  const findExisting = async (employeeUserId: string, workDate: Date) =>
    workdays.find(
      (w) => w.employeeUserId === employeeUserId && w.workDate.getTime() === workDate.getTime(),
    ) ?? null;

  const create = async (fields: {
    employeeUserId: string;
    workDate: Date;
    expectedStartTime: number;
    expectedEndTime: number;
    startedAt: Date;
  }) => {
    if (await findExisting(fields.employeeUserId, fields.workDate)) {
      return { outcome: "DUPLICATE" as const };
    }
    const workday: WorkdayRecord = {
      id: `workday-${nextId++}`,
      confirmedAt: null,
      confirmedByUserId: null,
      endedAt: null,
      ...fields,
    };
    workdays.push(workday);
    return { outcome: "CREATED" as const, workday };
  };

  const endAtomically = async (workdayId: string, employeeUserId: string, endedAt: Date) => {
    const workday = workdays.find(
      (w) => w.id === workdayId && w.employeeUserId === employeeUserId && w.endedAt === null,
    );
    if (!workday) return { count: 0 };
    workday.endedAt = endedAt;
    return { count: 1 };
  };

  const confirmAtomically = async (workdayId: string, confirmedByUserId: string, confirmedAt: Date) => {
    const workday = workdays.find((w) => w.id === workdayId && w.confirmedAt === null);
    if (!workday) return { count: 0 };
    workday.confirmedAt = confirmedAt;
    workday.confirmedByUserId = confirmedByUserId;
    return { count: 1 };
  };

  return {
    workdays,
    startDependencies: { findExisting, create } satisfies StartWorkdayDependencies,
    endDependencies: { findCurrent: findExisting, endAtomically } satisfies EndWorkdayDependencies,
    findWorkday: findExisting,
    confirmAtomically,
  };
}

function makeTaskStore() {
  const tasks: DailyTaskRecord[] = [];
  let nextId = 1;

  const findTask = async (taskId: string) => tasks.find((t) => t.id === taskId) ?? null;

  const create = async (fields: {
    workDate: Date;
    assignedToUserId: string;
    assignedByUserId: string;
    content: string;
    assignedAt: Date;
  }) => {
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

  const completeAtomically = async (taskId: string, assignedToUserId: string, completedAt: Date) => {
    const task = tasks.find(
      (t) => t.id === taskId && t.assignedToUserId === assignedToUserId && t.status === "OPEN",
    );
    if (!task) return { count: 0 };
    task.status = "COMPLETED";
    task.completedAt = completedAt;
    return { count: 1 };
  };

  const cancelAtomically = async (taskId: string, cancellationReason: string) => {
    const task = tasks.find((t) => t.id === taskId && t.status === "OPEN");
    if (!task) return { count: 0 };
    task.status = "CANCELLED";
    task.cancellationReason = cancellationReason;
    return { count: 1 };
  };

  return { tasks, findTask, create, completeAtomically, cancelAtomically };
}

test("Ticket 27H §46: assign -> visible before start -> start -> confirm -> complete -> end -> visible in management, with every fact server-declared and none inferred", async () => {
  const workdayStore = makeWorkdayStore();
  const taskStore = makeTaskStore();

  const subjects: Record<string, WorkdaySubject & DailyTaskSubject> = {
    [EMPLOYEE.id]: { id: EMPLOYEE.id, role: EMPLOYEE.role, active: true },
  };
  const workdayOpenState: Record<string, WorkdayOpenState> = {};

  const assignDeps: AssignTaskDependencies = {
    findSubject: async (id) => subjects[id] ?? null,
    findWorkdayOpenState: async (id, date) => workdayOpenState[`${id}:${date.toISOString()}`] ?? null,
    create: taskStore.create,
  };

  // 1. Manager assigns the task before the employee has started their day.
  const assignResult = await assignTaskCore(
    { id: MANAGER.id, role: MANAGER.role, active: true },
    { assignedToUserId: EMPLOYEE.id, workDate: BUSINESS_DATE, content: "Relancer les écoles" },
    assignDeps,
    BUSINESS_DATE,
  );
  assert.equal(assignResult.success, true);
  if (!assignResult.success) return;
  const taskId = assignResult.task.id;
  assert.equal(assignResult.task.status, "OPEN");
  assert.equal(assignResult.task.assignedByUserId, MANAGER.id);

  // 2. Employee starts their workday.
  const startResult = await startMyWorkdayCore(
    { id: EMPLOYEE.id, role: EMPLOYEE.role, active: true },
    workdayStore.startDependencies,
    BUSINESS_DATE,
  );
  assert.equal(startResult.success, true);
  if (!startResult.success) return;
  assert.equal(startResult.workday.confirmedAt, null);

  workdayOpenState[`${EMPLOYEE.id}:${BUSINESS_DATE.toISOString()}`] = {
    endedAt: null,
  };

  // 3. Manager confirms the declared start.
  const confirmDeps: ConfirmWorkdayStartDependencies = {
    findSubject: async (id) => subjects[id] ?? null,
    findWorkday: workdayStore.findWorkday,
    confirmAtomically: workdayStore.confirmAtomically,
  };
  const confirmResult = await confirmWorkdayStartForCore(
    { id: MANAGER.id, role: MANAGER.role, active: true },
    { employeeUserId: EMPLOYEE.id, workDate: BUSINESS_DATE },
    confirmDeps,
    BUSINESS_DATE,
  );
  assert.equal(confirmResult.success, true);

  // 4. Employee completes their own task.
  const completeDeps: CompleteMyTaskDependencies = {
    findTask: taskStore.findTask,
    findWorkdayOpenState: async (id, date) => workdayOpenState[`${id}:${date.toISOString()}`] ?? null,
    completeAtomically: taskStore.completeAtomically,
  };
  const completeResult = await completeMyTaskCore(
    { id: EMPLOYEE.id, role: EMPLOYEE.role, active: true },
    taskId,
    completeDeps,
    BUSINESS_DATE,
  );
  assert.equal(completeResult.success, true);
  if (!completeResult.success) return;
  assert.equal(completeResult.task.status, "COMPLETED");

  // 5. Employee ends their workday.
  const endResult = await endMyWorkdayCore(
    { id: EMPLOYEE.id, role: EMPLOYEE.role, active: true },
    workdayStore.endDependencies,
    BUSINESS_DATE,
  );
  assert.equal(endResult.success, true);

  // 6. Manager's overview reflects every declared fact — none rewritten
  //    or inferred beyond what was actually recorded above.
  const roster = [
    { id: MANAGER.id, role: MANAGER.role, firstName: "Awa", lastName: "Traoré", active: true },
    { id: EMPLOYEE.id, role: EMPLOYEE.role, firstName: "Julbert", lastName: "Sermé", active: true },
  ];
  const overview = composeDailyWorkManagementOverview(
    { id: MANAGER.id, role: MANAGER.role },
    roster,
    workdayStore.workdays,
    taskStore.tasks,
  );

  const employeeAgent = overview.find((agent) => agent.user.id === EMPLOYEE.id);
  assert.ok(employeeAgent, "expected the employee to appear in the management overview");
  assert.ok(employeeAgent!.workday, "expected the employee's workday to be visible");
  assert.equal(employeeAgent!.workday!.confirmedByUserId, MANAGER.id);
  assert.notEqual(employeeAgent!.workday!.endedAt, null);
  assert.equal(employeeAgent!.tasks.length, 1);
  assert.equal(employeeAgent!.tasks[0].status, "COMPLETED");
  assert.equal(employeeAgent!.tasks[0].assignedByUserId, MANAGER.id);
});

test("Ticket 27H §46: assign -> cancel by an authority other than the assignor -> assignedByUserId stays the original assignor, never rewritten to the canceller", async () => {
  const taskStore = makeTaskStore();

  const subjects: Record<string, DailyTaskSubject> = {
    [EMPLOYEE.id]: { id: EMPLOYEE.id, role: EMPLOYEE.role, active: true },
  };
  const workdayOpenState: Record<string, WorkdayOpenState> = {
    [`${EMPLOYEE.id}:${BUSINESS_DATE.toISOString()}`]: { endedAt: null },
  };

  const assignDeps: AssignTaskDependencies = {
    findSubject: async (id) => subjects[id] ?? null,
    findWorkdayOpenState: async (id, date) => workdayOpenState[`${id}:${date.toISOString()}`] ?? null,
    create: taskStore.create,
  };

  // Manager assigns.
  const assignResult = await assignTaskCore(
    { id: MANAGER.id, role: MANAGER.role, active: true },
    { assignedToUserId: EMPLOYEE.id, workDate: BUSINESS_DATE, content: "Relancer les écoles" },
    assignDeps,
    BUSINESS_DATE,
  );
  assert.equal(assignResult.success, true);
  if (!assignResult.success) return;
  const taskId = assignResult.task.id;
  assert.equal(assignResult.task.assignedByUserId, MANAGER.id);

  // Admin — not the original assignor — cancels it.
  const cancelDeps: CancelTaskDependencies = {
    findTask: taskStore.findTask,
    findWorkdayOpenState: async (id, date) => workdayOpenState[`${id}:${date.toISOString()}`] ?? null,
    cancelAtomically: taskStore.cancelAtomically,
  };
  const cancelResult = await cancelTaskCore(
    { id: ADMIN.id, role: ADMIN.role, active: true },
    { taskId, cancellationReason: "Doublon avec une autre tâche déjà assignée" },
    cancelDeps,
    BUSINESS_DATE,
  );
  assert.equal(cancelResult.success, true);
  if (!cancelResult.success) return;

  assert.equal(cancelResult.task.status, "CANCELLED");
  // The historical fact of who originally assigned the task must never
  // be overwritten by whoever cancels it.
  assert.equal(cancelResult.task.assignedByUserId, MANAGER.id);
  assert.equal(taskStore.tasks[0].assignedByUserId, MANAGER.id);
});
