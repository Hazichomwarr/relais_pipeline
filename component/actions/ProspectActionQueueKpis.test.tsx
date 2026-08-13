import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProspectActionQueueKpis from "./ProspectActionQueueKpis";

test("renders overdue, today, upcoming, and total open counts", () => {
  const html = renderToStaticMarkup(
    <ProspectActionQueueKpis
      summary={{ overdue: 7, today: 12, upcoming: 31, totalOpen: 50 }}
    />,
  );

  assert.match(html, /En retard/);
  assert.match(html, />7</);
  assert.match(html, /Aujourd’hui/);
  assert.match(html, />12</);
  assert.match(html, /À venir/);
  assert.match(html, />31</);
  assert.match(html, /Ouvertes/);
  assert.match(html, />50</);
});

test("shows zero counts plainly, no percentages or performance framing", () => {
  const html = renderToStaticMarkup(
    <ProspectActionQueueKpis
      summary={{ overdue: 0, today: 0, upcoming: 0, totalOpen: 0 }}
    />,
  );

  assert.doesNotMatch(html, /%/);
  assert.doesNotMatch(html, /score/i);
});
