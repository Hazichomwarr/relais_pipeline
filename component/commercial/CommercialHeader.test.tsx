import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialHeader from "./CommercialHeader";

test("greets the authenticated commercial by first name", () => {
  const html = renderToStaticMarkup(
    <CommercialHeader
      firstName="Awa"
      today={new Date("2026-08-03T09:00:00")}
    />,
  );

  assert.match(html, /Bonjour, Awa/);
  assert.match(
    html,
    /Voici les actions et opportunités qui demandent votre attention/,
  );
});

test("switches to an evening greeting after 18h", () => {
  const html = renderToStaticMarkup(
    <CommercialHeader
      firstName="Awa"
      today={new Date("2026-08-03T19:00:00")}
    />,
  );

  assert.match(html, /Bonsoir, Awa/);
});
