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

test("MANAGER sidebar includes a Finances link to /finances (Ticket 17B)", () => {
  const html = renderToStaticMarkup(<Sidebar role="MANAGER" />);

  assert.match(html, /Finances/);
  assert.match(html, /href="\/finances"/);
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
