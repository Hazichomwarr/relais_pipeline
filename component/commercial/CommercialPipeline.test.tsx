import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { buildPipeline } from "@/src/lib/commercial-dashboard-presentation";

import CommercialPipeline from "./CommercialPipeline";

test("renders all seven stages even when every count is zero", () => {
  const html = renderToStaticMarkup(
    <CommercialPipeline pipeline={buildPipeline({})} />,
  );

  assert.match(html, /Nouveau/);
  assert.match(html, /À suivre/);
  assert.match(html, /Contacté/);
  assert.match(html, /Qualifié/);
  assert.match(html, /Proposition envoyée/);
  assert.match(html, /Gagné/);
  assert.match(html, /Perdu/);
});

test("reflects real counts per stage", () => {
  const html = renderToStaticMarkup(
    <CommercialPipeline
      pipeline={buildPipeline({ QUALIFIED: 5, WON: 2 })}
    />,
  );

  assert.match(html, /5/);
  assert.match(html, /2/);
});
