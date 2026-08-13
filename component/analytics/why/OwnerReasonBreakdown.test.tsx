import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import OwnerReasonBreakdown from "./OwnerReasonBreakdown";

test("renders each owner's top reasons, in the order the array is given (alphabetical is the core's job, not this component's)", () => {
  const html = renderToStaticMarkup(
    <OwnerReasonBreakdown
      byOwner={[
        {
          ownerUserId: "owner-1",
          ownerName: "Odette Yameogo",
          total: 12,
          topReasons: [
            { reason: "PROMOTIONAL_OFFER", count: 5 },
            { reason: "DEMO_CONVINCED", count: 4 },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /Odette Yameogo/);
  assert.match(html, /12 suivis/);
  assert.match(html, /Offre promotionnelle — 5/);
});

test("never renders a ranking number or performance framing", () => {
  const html = renderToStaticMarkup(
    <OwnerReasonBreakdown
      byOwner={[{ ownerUserId: "owner-1", ownerName: "Awa", total: 3, topReasons: [] }]}
    />,
  );
  assert.doesNotMatch(html, /#1/);
  assert.doesNotMatch(html, /meilleur/i);
  assert.doesNotMatch(html, /score/i);
});

test("renders nothing when no owner has structured data in scope", () => {
  const html = renderToStaticMarkup(<OwnerReasonBreakdown byOwner={[]} />);
  assert.equal(html, "");
});
