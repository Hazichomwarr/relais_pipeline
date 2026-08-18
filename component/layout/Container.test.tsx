import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Container from "./Container";

test("renders its children", () => {
  const html = renderToStaticMarkup(
    <Container>
      <p>Contenu de la page</p>
    </Container>,
  );

  assert.match(html, /Contenu de la page/);
});

test("uses the full available width — no max-width constraint", () => {
  const html = renderToStaticMarkup(
    <Container>
      <p>x</p>
    </Container>,
  );

  assert.match(html, /\bw-full\b/);
  assert.doesNotMatch(
    html,
    /max-w-/,
    "Container must not impose a global max-width (Ticket 24B) — data-heavy pages need the full width beside the sidebar",
  );
});

test("establishes min-w-0 so a wide child (e.g. a table) can shrink instead of forcing the page to overflow", () => {
  const html = renderToStaticMarkup(
    <Container>
      <p>x</p>
    </Container>,
  );

  assert.match(html, /\bmin-w-0\b/);
});

test("provides responsive horizontal gutters without imposing vertical spacing", () => {
  const html = renderToStaticMarkup(
    <Container>
      <p>x</p>
    </Container>,
  );

  assert.match(html, /\bpx-4\b/);
  assert.doesNotMatch(
    html,
    /\bpy-\d/,
    "vertical rhythm (page title margin, section spacing) stays owned by pages/components, not Container",
  );
});

test("accepts and appends a caller-supplied className instead of replacing the defaults", () => {
  const html = renderToStaticMarkup(
    <Container className="space-y-6">
      <p>x</p>
    </Container>,
  );

  assert.match(html, /w-full min-w-0 px-4 sm:px-6 lg:px-8 space-y-6/);
});

test("renders with no extra wrapper when no className is given", () => {
  const html = renderToStaticMarkup(
    <Container>
      <p>x</p>
    </Container>,
  );

  assert.doesNotMatch(html, /class="[^"]*  /, "no doubled-up whitespace from an empty className");
});
