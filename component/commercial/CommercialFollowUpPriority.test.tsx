import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialFollowUpPriority from "./CommercialFollowUpPriority";

test("renders the 'all caught up' empty state when there are no follow-ups", () => {
  const html = renderToStaticMarkup(
    <CommercialFollowUpPriority items={[]} returnTo="/dashboard/commercial" />,
  );

  assert.match(html, /Tout est à jour/);
  assert.match(html, /Aucun suivi ne demande votre attention aujourd’hui/);
});

test("renders a follow-up row with a link to its own detail page", () => {
  const html = renderToStaticMarkup(
    <CommercialFollowUpPriority
      returnTo="/dashboard/commercial"
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
          latestActivityAt: new Date("2026-07-31T10:00:00"),
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
  assert.match(html, /En retard de 2 jours/);
  assert.match(html, /\/dashboard\/commercial\/prospects\/prospect-1/);
  assert.doesNotMatch(html, /Voir tous mes suivis/);
});

test("shows a link to the full queue only past the initial 5 items", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: `prospect-${index}`,
    name: `Prospect ${index}`,
    prospectType: "École privée",
    product: "KARMDA" as const,
    phone: "+22670000000",
    interest: "MAYBE" as const,
    nextAction: null,
    followUpDate: null,
    overdueDays: null,
    followUpLabel: "Date à planifier",
    createdAt: new Date("2026-07-30T10:00:00"),
    latestActivityAt: new Date("2026-07-30T10:00:00"),
    assignedUser: null,
    commercialName: "Awa Traoré",
  }));

  const html = renderToStaticMarkup(
    <CommercialFollowUpPriority items={items} returnTo="/dashboard/commercial" />,
  );

  assert.match(html, /Voir tous mes suivis/);
  assert.doesNotMatch(html, /Prospect 5/);
});
