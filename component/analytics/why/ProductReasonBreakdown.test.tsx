import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProductReasonBreakdown from "./ProductReasonBreakdown";

test("renders top reasons per product using the centralized product label", () => {
  const html = renderToStaticMarkup(
    <ProductReasonBreakdown
      byProduct={[
        {
          product: "KARMDA",
          total: 18,
          topReasons: [
            { reason: "DECISION_MAKER_UNAVAILABLE", count: 8 },
            { reason: "NEEDS_MORE_TIME", count: 6 },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /KARMDA/);
  assert.match(html, /18 suivis/);
  assert.match(html, /Décideur indisponible — 8/);
  assert.match(html, /A besoin de plus de temps — 6/);
});

test("renders nothing when no product has structured data in scope", () => {
  const html = renderToStaticMarkup(<ProductReasonBreakdown byProduct={[]} />);
  assert.equal(html, "");
});
