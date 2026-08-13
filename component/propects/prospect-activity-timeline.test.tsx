import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectActivity } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";

import ProspectActivityTimeline from "./prospect-activity-timeline";

test("renders the subsequent-interaction empty state without erasing the initial observation", () => {
  const html = renderToStaticMarkup(
    <ProspectActivityTimeline activities={[]} />,
  );

  assert.match(html, /Aucune interaction supplémentaire enregistrée/);
  assert.match(html, /observation initiale du terrain reste disponible/);
});

test("renders an activity with its French label, summary, details, and agent", () => {
  const item: ProspectActivity = {
    id: "activity-1",
    prospectId: "prospect-1",
    type: "PHONE_CALL",
    summary: "Le fondateur souhaite recevoir la fiche KARMDA.",
    details: "Une réunion sera organisée après lecture.",
    occurredAt: new Date("2026-08-03T16:30:00.000Z"),
    agentName: "Koane Amidou",
    conversionOutcome: null,
    conversionReason: null,
    conversionReasonNote: null,
    createdAt: new Date("2026-08-03T20:00:00.000Z"),
  };
  const html = renderToStaticMarkup(
    <ProspectActivityTimeline activities={[item]} />,
  );

  assert.match(html, /Appel téléphonique/);
  assert.match(html, /Le fondateur souhaite recevoir la fiche KARMDA/);
  assert.match(html, /Une réunion sera organisée après lecture/);
  assert.match(html, /Koane Amidou/);
  assert.match(html, /Saisi le/);
});
