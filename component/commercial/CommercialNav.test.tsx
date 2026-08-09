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

test("COMMERCIAL navigation includes a Mes rapports link to /reports — visible even before a template is assigned (Ticket 19B)", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Mes rapports/);
  assert.match(html, /href="\/reports"/);
});

test("the mobile drawer's item list also includes Mes rapports", () => {
  const source = readFileSync("component/commercial/CommercialNav.tsx", "utf8");

  assert.match(source, /label: "Mes rapports"/);
  assert.match(source, /href: "\/reports"/);
});

test("COMMERCIAL navigation never exposes the management Rapports quotidiens link (Ticket 19C — /admin/reports is ADMIN/MANAGER only)", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );
  const source = readFileSync("component/commercial/CommercialNav.tsx", "utf8");

  assert.doesNotMatch(html, /Rapports quotidiens/);
  assert.doesNotMatch(html, /href="\/admin\/reports"/);
  assert.doesNotMatch(source, /\/admin\/reports/);
});
