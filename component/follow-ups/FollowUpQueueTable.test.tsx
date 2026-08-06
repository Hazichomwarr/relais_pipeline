import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FollowUpQueueTable from "./FollowUpQueueTable";

test("renders the follow-up empty state", () => {
  const html = renderToStaticMarkup(
    <FollowUpQueueTable items={[]} returnTo="/admin/follow-ups" />,
  );

  assert.match(html, /Aucun suivi en attente/);
  assert.match(html, /Toute l’équipe est à jour/);
});

test("renders a populated queue with commercial and detail link", () => {
  const html = renderToStaticMarkup(
    <FollowUpQueueTable
      returnTo="/admin/follow-ups"
      items={[
        {
          id: "prospect-1",
          name: "École Horizon",
          prospectType: "École privée",
          product: "KARMDA",
          phone: "+22670000000",
          interest: "READY_TO_DISCUSS",
          nextAction: "SEND_DEMO",
          followUpDate: new Date("2026-08-01T10:00:00"),
          overdueDays: 2,
          followUpLabel: "En retard de 2 jours",
          createdAt: new Date("2026-07-30T10:00:00"),
          latestActivityAt: new Date("2026-08-01T08:00:00"),
          assignedUser: {
            id: "user-1",
            firstName: "Awa",
            lastName: "Traoré",
            active: true,
          },
          commercialName: "Awa Traoré",
        },
      ]}
    />,
  );

  assert.match(html, /École Horizon/);
  assert.match(html, /Awa Traoré/);
  assert.match(html, /Envoyer une démonstration/);
  assert.match(html, /En retard de 2 jours/);
  assert.match(html, /\/admin\/prospects\/prospect-1/);
});
