import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";

import UserTable from "./user-table";

const noOp = () => undefined;

test("renders the user empty state and create-first-user CTA", () => {
  const html = renderToStaticMarkup(
    <UserTable
      users={[]}
      onCreate={noOp}
      onEdit={noOp}
      onDeactivate={noOp}
    />,
  );

  assert.match(html, /Aucun utilisateur n’a été créé/);
  assert.match(html, /Créer le premier utilisateur/);
});

test("renders user columns, French role, status, edit, and deactivate actions", () => {
  const html = renderToStaticMarkup(
    <UserTable
      users={[makeUser("user-1")]}
      onCreate={noOp}
      onEdit={noOp}
      onDeactivate={noOp}
    />,
  );

  assert.match(html, /Aminata Ouédraogo/);
  assert.match(html, /Commercial/);
  assert.match(html, /70 12 34 56/);
  assert.match(html, /aminata@example.com/);
  assert.match(html, /Actif/);
  assert.match(html, /Modifier Aminata Ouédraogo/);
  assert.match(html, /Désactiver Aminata Ouédraogo/);
});

test("the desktop table has no oversized fixed min-width forcing horizontal overflow (Ticket 24B)", () => {
  const html = renderToStaticMarkup(
    <UserTable
      users={[makeUser("user-1")]}
      onCreate={noOp}
      onEdit={noOp}
      onDeactivate={noOp}
    />,
  );

  assert.match(html, /<table/);
  assert.doesNotMatch(html, /min-w-245/);
});

test("keeps inactive users visible without offering another deactivate action", () => {
  const html = renderToStaticMarkup(
    <UserTable
      users={[makeUser("user-1", { active: false })]}
      onCreate={noOp}
      onEdit={noOp}
      onDeactivate={noOp}
    />,
  );

  assert.match(html, /Inactif/);
  assert.match(html, /Modifier Aminata Ouédraogo/);
  assert.doesNotMatch(html, /Désactiver Aminata Ouédraogo/);
});

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    firstName: "Aminata",
    lastName: "Ouédraogo",
    email: "aminata@example.com",
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
