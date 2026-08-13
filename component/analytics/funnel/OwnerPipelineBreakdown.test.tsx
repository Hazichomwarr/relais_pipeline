import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import OwnerPipelineBreakdown from "./OwnerPipelineBreakdown";

test("renders each owner's name and breakdown, including a Non attribué bucket", () => {
  const html = renderToStaticMarkup(
    <OwnerPipelineBreakdown
      byOwner={[
        {
          ownerUserId: "owner-1",
          ownerName: "Odette Yameogo",
          total: 22,
          interested: 7,
          qualified: 3,
          proposalSent: 2,
          won: 1,
          lost: 0,
        },
        {
          ownerUserId: null,
          ownerName: "Non attribué",
          total: 4,
          interested: 0,
          qualified: 0,
          proposalSent: 0,
          won: 0,
          lost: 0,
        },
      ]}
    />,
  );

  assert.match(html, /Odette Yameogo/);
  assert.match(html, /22 prospects/);
  assert.match(html, /Non attribué/);
  assert.match(html, /4 prospects/);
});

test("never renders a ranking number or performance framing for an owner (management visibility, not a leaderboard)", () => {
  const html = renderToStaticMarkup(
    <OwnerPipelineBreakdown
      byOwner={[
        {
          ownerUserId: "admin-1",
          ownerName: "Hamza (ADMIN)",
          total: 5,
          interested: 1,
          qualified: 1,
          proposalSent: 0,
          won: 0,
          lost: 0,
        },
      ]}
    />,
  );

  assert.doesNotMatch(html, /#1/);
  assert.doesNotMatch(html, /rank/i);
  assert.doesNotMatch(html, /score/i);
});

test("an ADMIN-owned prospect group is displayed the same way as any other owner (Ticket 15H.1 role-neutral prospecting)", () => {
  const html = renderToStaticMarkup(
    <OwnerPipelineBreakdown
      byOwner={[
        {
          ownerUserId: "admin-1",
          ownerName: "Hamza",
          total: 5,
          interested: 1,
          qualified: 1,
          proposalSent: 0,
          won: 0,
          lost: 0,
        },
      ]}
    />,
  );

  assert.match(html, /Hamza/);
  assert.match(html, /5 prospects/);
});
