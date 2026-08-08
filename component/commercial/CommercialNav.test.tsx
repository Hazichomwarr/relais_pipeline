import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialNav from "./CommercialNav";

test("COMMERCIAL navigation includes a Mes notes link to /notes", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Mes notes/);
  assert.match(html, /href="\/notes"/);
});

test("COMMERCIAL navigation never exposes a Finances link (Ticket 17B)", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );

  assert.doesNotMatch(html, /Finances/);
  assert.doesNotMatch(html, /href="\/finances"/);
});

test("COMMERCIAL navigation includes an À la une link to /updates (Ticket 18B)", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /À la une/);
  assert.match(html, /href="\/updates"/);
});

test("the mobile drawer's item list also includes À la une — the drawer content itself only renders once opened, so this is asserted against the source", () => {
  const source = readFileSync("component/commercial/CommercialNav.tsx", "utf8");

  assert.match(source, /label: "À la une"/);
  assert.match(source, /href: "\/updates"/);
});
