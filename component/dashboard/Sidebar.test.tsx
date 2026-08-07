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
