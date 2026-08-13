import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ReasonOutcomeMatrix from "./ReasonOutcomeMatrix";

test("renders reason labels with per-outcome counts and a total, using — for zero cells", () => {
  const html = renderToStaticMarkup(
    <ReasonOutcomeMatrix
      matrix={[
        { reason: "PROMOTIONAL_OFFER", advanced: 12, stalled: 0, won: 4, lost: 0, total: 16 },
      ]}
    />,
  );

  assert.match(html, /Offre promotionnelle/);
  assert.match(html, />12</);
  assert.match(html, />16</);
  assert.match(html, />—</);
});

test("renders nothing when the matrix is empty — no impossible-combination noise", () => {
  const html = renderToStaticMarkup(<ReasonOutcomeMatrix matrix={[]} />);
  assert.equal(html, "");
});

test("the desktop table wraps in its own scroll container, never forcing page-level horizontal overflow", () => {
  const html = renderToStaticMarkup(
    <ReasonOutcomeMatrix
      matrix={[{ reason: "NO_BUDGET", advanced: 0, stalled: 6, won: 0, lost: 2, total: 8 }]}
    />,
  );
  assert.match(html, /overflow-x-auto/);
});
