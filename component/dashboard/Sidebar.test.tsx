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
