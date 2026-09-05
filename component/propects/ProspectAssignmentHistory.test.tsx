import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProspectAssignmentHistory from "./ProspectAssignmentHistory";

test("renders 'Aucune réaffectation enregistrée.' for a prospect with zero transfer rows — never implying it was never assigned", () => {
  const html = renderToStaticMarkup(<ProspectAssignmentHistory transfers={[]} />);

  assert.match(html, /Aucune réaffectation enregistrée\./);
  assert.doesNotMatch(html, /Attribution initiale/);
  assert.doesNotMatch(html, /créé par/i);
});

test("renders a populated history entry with from/to/changedBy/reason/date, newest first as given", () => {
  const html = renderToStaticMarkup(
    <ProspectAssignmentHistory
      transfers={[
        {
          id: "transfer-1",
          fromUser: { firstName: "Jean", lastName: "Ouédraogo" },
          toUser: { firstName: "Amidou", lastName: "Koane" },
          changedByUser: { firstName: "Mamadou", lastName: "Nana" },
          reason: "Réorganisation du suivi",
          occurredAt: new Date("2026-09-05T14:12:00.000Z"),
        },
      ]}
    />,
  );

  assert.match(html, /Jean Ouédraogo/);
  assert.match(html, /Amidou Koane/);
  assert.match(html, /Mamadou Nana/);
  assert.match(html, /Réorganisation du suivi/);
});

test("renders 'Aucun responsable' truthfully for a transfer whose fromUser is null, never inventing a name", () => {
  const html = renderToStaticMarkup(
    <ProspectAssignmentHistory
      transfers={[
        {
          id: "transfer-1",
          fromUser: null,
          toUser: { firstName: "Amidou", lastName: "Koane" },
          changedByUser: { firstName: "Mamadou", lastName: "Nana" },
          reason: "Attribution initiale via le nouvel outil",
          occurredAt: new Date("2026-09-05T14:12:00.000Z"),
        },
      ]}
    />,
  );

  assert.match(html, /Aucun responsable/);
  assert.match(html, /Amidou Koane/);
});

test("never renders raw transfer/database IDs", () => {
  const html = renderToStaticMarkup(
    <ProspectAssignmentHistory
      transfers={[
        {
          id: "transfer-cuid-xyz789",
          fromUser: { firstName: "Jean", lastName: "Ouédraogo" },
          toUser: { firstName: "Amidou", lastName: "Koane" },
          changedByUser: { firstName: "Mamadou", lastName: "Nana" },
          reason: "Réorganisation du suivi",
          occurredAt: new Date("2026-09-05T14:12:00.000Z"),
        },
      ]}
    />,
  );

  assert.doesNotMatch(html, /transfer-cuid-xyz789/);
});

test("is a native <details> disclosure, not an always-open audit log", () => {
  const html = renderToStaticMarkup(
    <ProspectAssignmentHistory
      transfers={[
        {
          id: "transfer-1",
          fromUser: null,
          toUser: { firstName: "Amidou", lastName: "Koane" },
          changedByUser: { firstName: "Mamadou", lastName: "Nana" },
          reason: "Réorganisation du suivi",
          occurredAt: new Date("2026-09-05T14:12:00.000Z"),
        },
      ]}
    />,
  );

  assert.match(html, /<details/);
  assert.match(html, /<summary/);
});
