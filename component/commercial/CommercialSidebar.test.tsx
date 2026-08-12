import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialSidebar from "./CommercialSidebar";
import { resolveCommercialActiveItem } from "./commercialNavItems";

test("COMMERCIAL sidebar includes a Mes notes link to /notes", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Mes notes/);
  assert.match(html, /href="\/notes"/);
});

test("COMMERCIAL sidebar never exposes a Finances link (Ticket 17B)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.doesNotMatch(html, /Finances/);
  assert.doesNotMatch(html, /href="\/finances"/);
});

test("COMMERCIAL sidebar never exposes ADMIN/MANAGER-only links (Utilisateurs, Rapports quotidiens)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.doesNotMatch(html, /Utilisateurs/);
  assert.doesNotMatch(html, /href="\/admin\/users"/);
  assert.doesNotMatch(html, /Rapports quotidiens/);
  assert.doesNotMatch(html, /href="\/admin\/reports"/);
});

test("COMMERCIAL sidebar includes an À la une link to /updates (Ticket 18B)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /À la une/);
  assert.match(html, /href="\/updates"/);
});

test("COMMERCIAL sidebar includes a Mes rapports link to /reports (Ticket 19B)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Mes rapports/);
  assert.match(html, /href="\/reports"/);
});

test("COMMERCIAL sidebar includes every expected destination", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  for (const label of [
    "Tableau de bord",
    "À la une",
    "Nouveau prospect",
    "Mes prospects",
    "Répertoire",
    "Mes suivis",
    "Mes notes",
    "Mes rapports",
    "Mon profil",
  ]) {
    assert.match(html, new RegExp(label));
  }
});

test("COMMERCIAL sidebar includes a Nouveau prospect link to / (Ticket 15H.3)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Nouveau prospect/);
  assert.match(html, /href="\/"/);
});

test("COMMERCIAL sidebar renames the shared directory link to Répertoire, pointing at /products (Ticket 15G.1)", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Répertoire/);
  assert.match(html, /href="\/products"/);
  assert.doesNotMatch(html, /Toutes les écoles/);
});

test("COMMERCIAL sidebar shows the account name, role, and a logout control", () => {
  const html = renderToStaticMarkup(
    <CommercialSidebar firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Julbert Sermé/);
  assert.match(html, /Commercial/);
  assert.match(html, /Déconnexion/);
  assert.match(html, /action="\/logout"/);
  assert.match(html, /method="POST"/);
});

test("the mobile drawer's item list mirrors the desktop sidebar — asserted against the shared source since the drawer only renders once opened", () => {
  const source = readFileSync(
    "component/commercial/commercialNavItems.tsx",
    "utf8",
  );

  assert.match(source, /label: "À la une"/);
  assert.match(source, /href: "\/updates"/);
  assert.match(source, /label: "Mes rapports"/);
  assert.match(source, /href: "\/reports"/);
  assert.doesNotMatch(source, /\/admin\/reports/);
  assert.match(source, /label: "Répertoire"/);
  assert.match(source, /href: "\/products"/);
  assert.doesNotMatch(source, /label: "Toutes les écoles"/);
});

test("resolveCommercialActiveItem highlights Nouveau prospect only on the exact root route (Ticket 15H.3)", () => {
  assert.equal(resolveCommercialActiveItem("/"), "newProspect");
});

test("resolveCommercialActiveItem does not activate Nouveau prospect on other routes (Ticket 15H.3 regression)", () => {
  assert.equal(resolveCommercialActiveItem("/products"), "products");
  assert.equal(resolveCommercialActiveItem("/updates"), "updates");
  assert.equal(resolveCommercialActiveItem("/dashboard/commercial"), "dashboard");
  assert.equal(
    resolveCommercialActiveItem("/dashboard/commercial/prospects/abc"),
    "prospects",
  );
});

test("resolveCommercialActiveItem highlights Tableau de bord on /dashboard/commercial", () => {
  assert.equal(resolveCommercialActiveItem("/dashboard/commercial"), "dashboard");
});

test("resolveCommercialActiveItem highlights Mes prospects on nested prospect routes", () => {
  assert.equal(
    resolveCommercialActiveItem("/dashboard/commercial/prospects"),
    "prospects",
  );
  assert.equal(
    resolveCommercialActiveItem("/dashboard/commercial/prospects/abc123"),
    "prospects",
  );
});

test("resolveCommercialActiveItem highlights Mon profil on /dashboard/commercial/profile", () => {
  assert.equal(
    resolveCommercialActiveItem("/dashboard/commercial/profile"),
    "profile",
  );
});

test("resolveCommercialActiveItem highlights the shared-page destinations", () => {
  assert.equal(resolveCommercialActiveItem("/updates"), "updates");
  assert.equal(resolveCommercialActiveItem("/products"), "products");
  assert.equal(resolveCommercialActiveItem("/products/karmda"), "products");
  assert.equal(resolveCommercialActiveItem("/notes"), "notes");
  assert.equal(resolveCommercialActiveItem("/notes/some-note"), "notes");
  assert.equal(resolveCommercialActiveItem("/reports"), "reports");
  assert.equal(resolveCommercialActiveItem("/reports/some-report"), "reports");
});

test("resolveCommercialActiveItem still highlights Répertoire on the legacy /schools redirect route (Ticket 15G.1)", () => {
  assert.equal(resolveCommercialActiveItem("/schools"), "products");
  assert.equal(resolveCommercialActiveItem("/schools/some-prospect"), "products");
});

test("resolveCommercialActiveItem returns undefined for unrelated or null paths", () => {
  assert.equal(resolveCommercialActiveItem("/finances"), undefined);
  assert.equal(resolveCommercialActiveItem(null), undefined);
});
