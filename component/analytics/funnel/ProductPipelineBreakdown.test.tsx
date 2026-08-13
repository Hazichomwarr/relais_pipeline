import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProductPipelineBreakdown from "./ProductPipelineBreakdown";

test("renders every product entry with total/won/lost and non-zero status counts", () => {
  const html = renderToStaticMarkup(
    <ProductPipelineBreakdown
      byProduct={[
        {
          product: "KARMDA",
          total: 114,
          won: 2,
          lost: 1,
          statusCounts: [
            { status: "NEW", count: 90, percentage: 79 },
            { status: "TO_FOLLOW_UP", count: 0, percentage: 0 },
            { status: "CONTACTED", count: 10, percentage: 9 },
            { status: "QUALIFIED", count: 8, percentage: 7 },
            { status: "PROPOSAL_SENT", count: 3, percentage: 3 },
            { status: "WON", count: 2, percentage: 2 },
            { status: "LOST", count: 1, percentage: 1 },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /KARMDA/);
  assert.match(html, /114 prospects/);
  assert.match(html, /2 gagnés/);
  assert.match(html, /1 perdu/);
  assert.match(html, /Nouveau 90/);
  assert.doesNotMatch(html, /À suivre 0/);
});

test("never renders a numbered ranking badge for a product (the subtitle's own disclaimer mentioning 'score' is fine — an actual computed score/rank is not)", () => {
  const html = renderToStaticMarkup(
    <ProductPipelineBreakdown
      byProduct={[
        { product: "LOKARI", total: 0, won: 0, lost: 0, statusCounts: [] },
      ]}
    />,
  );

  assert.doesNotMatch(html, /#1/);
  assert.doesNotMatch(html, /classement/i);
});
