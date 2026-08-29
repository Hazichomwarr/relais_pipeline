import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Sidebar from "./Sidebar";

test("ADMIN sidebar includes a Mes notes link to /notes", () => {
  const html = renderToStaticMarkup(<Sidebar role="ADMIN" />);

  assert.match(html, /Mes notes/);
  assert.match(html, /href="\/notes"/);
});

test("MANAGER sidebar includes a Mes notes link to /notes", () => {
  const html = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  assert.match(html, /Mes notes/);
  assert.match(html, /href="\/notes"/);
});

test("the notes link is highlighted when activeItem is notes", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="notes" />,
  );
  const notesLinkMatch = html.match(/<a [^>]*href="\/notes"[^>]*>/);

  assert.ok(notesLinkMatch, "expected a /notes link in the sidebar");
  assert.match(notesLinkMatch![0], /bg-blue-50/);
});

test("ADMIN sidebar includes a Finances link to /finances (Ticket 17B)", () => {
  const html = renderToStaticMarkup(<Sidebar role="ADMIN" />);

  assert.match(html, /Finances/);
  assert.match(html, /href="\/finances"/);
});

test("MANAGER sidebar never exposes the ADMIN-only Finances link (Ticket 20G.1 — MANAGER lost the read access it had under Ticket 17B)", () => {
  const html = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  assert.doesNotMatch(html, /Finances/);
  assert.doesNotMatch(html, /href="\/finances"/);
});

test("the finances link is highlighted when activeItem is finances", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="finances" />,
  );
  const financesLinkMatch = html.match(/<a [^>]*href="\/finances"[^>]*>/);

  assert.ok(financesLinkMatch, "expected a /finances link in the sidebar");
  assert.match(financesLinkMatch![0], /bg-blue-50/);
});

test("ADMIN and MANAGER sidebars include an À la une link to /updates (Ticket 18B)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /À la une/);
    assert.match(html, /href="\/updates"/);
  }
});

test("the À la une link is highlighted when activeItem is updates", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="updates" />,
  );
  const updatesLinkMatch = html.match(/<a [^>]*href="\/updates"[^>]*>/);

  assert.ok(updatesLinkMatch, "expected an /updates link in the sidebar");
  assert.match(updatesLinkMatch![0], /bg-blue-50/);
});

test("ADMIN and MANAGER sidebars include a Mes rapports (personal) link to /reports (Ticket 19B)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Mes rapports/);
    assert.match(html, /href="\/reports"/);
  }
});

test("the Mes rapports link is highlighted when activeItem is reports", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="reports" />,
  );
  const reportsLinkMatch = html.match(/<a [^>]*href="\/reports"[^>]*>/);

  assert.ok(reportsLinkMatch, "expected a /reports link in the sidebar");
  assert.match(reportsLinkMatch![0], /bg-blue-50/);
});

test("ADMIN and MANAGER sidebars include a distinct Rapports quotidiens (management) link to /admin/reports (Ticket 19C)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Rapports quotidiens/);
    assert.match(html, /href="\/admin\/reports"/);
  }
});

test("ADMIN and MANAGER sidebars include a Nouveau prospect link to / (Ticket 15H.3)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Nouveau prospect/);
    assert.match(html, /href="\/"/);
  }
});

test("the Nouveau prospect link is highlighted when activeItem is newProspect", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="newProspect" />,
  );
  const newProspectLinkMatch = html.match(/<a [^>]*href="\/"[^>]*>/);

  assert.ok(newProspectLinkMatch, "expected a / link in the sidebar");
  assert.match(newProspectLinkMatch![0], /bg-blue-50/);
});

test("ADMIN sidebar includes a Mes prospects link to /admin/my-prospects (Ticket 15H.2)", () => {
  const html = renderToStaticMarkup(<Sidebar role="ADMIN" />);

  assert.match(html, /Mes prospects/);
  assert.match(html, /href="\/admin\/my-prospects"/);
});

test("MANAGER sidebar includes a Mes prospects link to /admin/my-prospects (Ticket 21B — MANAGER's personal portfolio must remain reachable after a promotion, unlike the ADMIN-only Ticket 15H.2 original)", () => {
  const html = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  assert.match(html, /Mes prospects/);
  assert.match(html, /href="\/admin\/my-prospects"/);
});

test("the Mes prospects link is highlighted when activeItem is myProspects", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="myProspects" />,
  );
  const myProspectsLinkMatch = html.match(
    /<a [^>]*href="\/admin\/my-prospects"[^>]*>/,
  );

  assert.ok(myProspectsLinkMatch, "expected an /admin/my-prospects link in the sidebar");
  assert.match(myProspectsLinkMatch![0], /bg-blue-50/);
});

test("ADMIN and MANAGER sidebars rename the shared directory link to Répertoire, pointing at /products (Ticket 15G.1)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Répertoire/);
    assert.match(html, /href="\/products"/);
    assert.doesNotMatch(html, /Toutes les écoles/);
    assert.doesNotMatch(html, /href="\/schools"/);
  }
});

test("the Répertoire link is highlighted when activeItem is products", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="products" />,
  );
  const productsLinkMatch = html.match(/<a [^>]*href="\/products"[^>]*>/);

  assert.ok(productsLinkMatch, "expected a /products link in the sidebar");
  assert.match(productsLinkMatch![0], /bg-blue-50/);
});

test("the Rapports quotidiens link is highlighted when activeItem is reportsManagement, not when it is reports", () => {
  const managementActive = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="reportsManagement" />,
  );
  const managementLinkMatch = managementActive.match(
    /<a [^>]*href="\/admin\/reports"[^>]*>/,
  );

  assert.ok(managementLinkMatch, "expected an /admin/reports link in the sidebar");
  assert.match(managementLinkMatch![0], /bg-blue-50/);

  const personalActive = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="reports" />,
  );
  const managementLinkWhenPersonalActive = personalActive.match(
    /<a [^>]*href="\/admin\/reports"[^>]*>/,
  );

  assert.ok(managementLinkWhenPersonalActive);
  assert.doesNotMatch(managementLinkWhenPersonalActive![0], /bg-blue-50/);
});

test("ADMIN and MANAGER sidebars include an active Paramètres link to /profile (Ticket 25F — previously a dead, unlinked button)", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Paramètres/);
    assert.match(html, /<a [^>]*href="\/profile"[^>]*>/);
  }
});

test("Ticket 25K.1: ADMIN and MANAGER sidebars include a Performance link to /admin/performance", () => {
  const adminHtml = renderToStaticMarkup(<Sidebar role="ADMIN" />);
  const managerHtml = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  for (const html of [adminHtml, managerHtml]) {
    assert.match(html, /Performance/);
    assert.match(html, /href="\/admin\/performance"/);
  }
});

test("Ticket 25K.1: COMMERCIAL never sees the Performance link, mirroring the existing view-authorization boundary", () => {
  const html = renderToStaticMarkup(<Sidebar role="COMMERCIAL" />);

  assert.doesNotMatch(html, /href="\/admin\/performance"/);
});

test("Ticket 25K.1: the Performance link is highlighted when activeItem is performance", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="performance" />,
  );
  const performanceLinkMatch = html.match(
    /<a [^>]*href="\/admin\/performance"[^>]*>/,
  );

  assert.ok(performanceLinkMatch, "expected an /admin/performance link in the sidebar");
  assert.match(performanceLinkMatch![0], /bg-blue-50/);
});

test("the Paramètres link is highlighted when activeItem is profile", () => {
  const html = renderToStaticMarkup(
    <Sidebar role="ADMIN" activeItem="profile" />,
  );
  const profileLinkMatch = html.match(/<a [^>]*href="\/profile"[^>]*>/);

  assert.ok(profileLinkMatch, "expected a /profile link in the sidebar");
  assert.match(profileLinkMatch![0], /bg-blue-50/);
});

test("Ticket 25M §24/§25/§43: ASSISTANT still never sees any item leading into a route it can't reach — every remaining ADMIN/MANAGER-only surface stays hidden", () => {
  const html = renderToStaticMarkup(<Sidebar role="ASSISTANT" />);

  for (const href of [
    "/updates",
    'href="/"',
    "/actions",
    "/admin/my-prospects",
    "/products",
    "/admin/follow-ups",
    "/admin/analytics/funnel",
    "/admin/reports",
    "/admin/performance",
    "/admin/users",
  ]) {
    assert.doesNotMatch(html, new RegExp(href.replace(/\//g, "\\/")));
  }

  assert.match(html, /href="\/notes"/);
  assert.match(html, /href="\/reports"/);
  assert.match(html, /href="\/profile"/);
});

test("Ticket 25N: ASSISTANT sees Finances", () => {
  const html = renderToStaticMarkup(<Sidebar role="ASSISTANT" />);

  assert.match(html, /href="\/finances"/);
  assert.match(html, /Finances/);
});

test("Ticket 25R §14/§15: ASSISTANT now also sees Tableau de bord, linking to /admin — the new dashboard-shell capability this ticket grants, alongside Finances/Mes notes/Mes rapports/Paramètres and nothing else", () => {
  const html = renderToStaticMarkup(<Sidebar role="ASSISTANT" />);

  assert.match(html, /href="\/admin"/);
  assert.match(html, /Tableau de bord/);
});
