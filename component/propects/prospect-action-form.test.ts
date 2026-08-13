import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectActionForm is a "use client" component built on react-hook-form's
 * useForm and next/navigation's useRouter, neither of which can run
 * outside a mounted Next.js app router under plain node:test — same
 * constraint as LedgerEntryForm.test.ts.
 */
const source = readFileSync(
  "component/propects/prospect-action-form.tsx",
  "utf8",
);

test("validates through createProspectActionSchema and submits through createProspectActionAction, never a direct service or Prisma call", () => {
  assert.match(source, /resolver: zodResolver\(createProspectActionSchema\)/);
  assert.match(source, /createProspectActionAction\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("never lets the client supply a status, creator, or lifecycle field — only prospectId, assignee, title, description, dueAt are registered", () => {
  for (const field of [
    "prospectId",
    "assignedToUserId",
    "title",
    "description",
    "dueAt",
  ]) {
    assert.match(source, new RegExp(`register\\("${field}"\\)`));
  }

  for (const trustedField of [
    "status",
    "createdByUserId",
    "completedByUserId",
    "canceledByUserId",
  ]) {
    assert.doesNotMatch(source, new RegExp(`register\\("${trustedField}"\\)`));
  }
});

test("the assignee dropdown is populated from the assignableUsers prop, never a hardcoded role filter", () => {
  assert.match(source, /assignableUsers\.map\(/);
  assert.doesNotMatch(source, /role === "COMMERCIAL"/);
});
