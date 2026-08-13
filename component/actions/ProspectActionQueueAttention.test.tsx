import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProspectActionQueueAttention from "./ProspectActionQueueAttention";
import type { ProspectWithoutOpenActionItem } from "@/src/services/prospect-action-queue.service-core";

function prospect(
  overrides: Partial<ProspectWithoutOpenActionItem> = {},
): ProspectWithoutOpenActionItem {
  return {
    id: "prospect-1",
    name: "Groupe Scolaire Horizon",
    product: "KARMDA",
    status: "QUALIFIED",
    interest: "INTERESTED",
    href: "/admin/prospects/prospect-1",
    ...overrides,
  };
}

test("renders nothing when there is nothing to flag", () => {
  const html = renderToStaticMarkup(<ProspectActionQueueAttention prospects={[]} />);
  assert.equal(html, "");
});

test("renders the count and each flagged prospect with a link to inspect it", () => {
  const html = renderToStaticMarkup(
    <ProspectActionQueueAttention prospects={[prospect(), prospect({ id: "prospect-2", name: "Entreprise B" })]} />,
  );

  assert.match(html, /Prospects actifs sans prochaine action — 2/);
  assert.match(html, /Groupe Scolaire Horizon/);
  assert.match(html, /Entreprise B/);
  assert.match(html, /Voir le prospect/);
});

test("never renders a create-action control here — creation happens through the existing Ticket 20B section", () => {
  const html = renderToStaticMarkup(
    <ProspectActionQueueAttention prospects={[prospect()]} />,
  );

  assert.doesNotMatch(html, /Nouvelle action/);
  assert.doesNotMatch(html, /<form/);
});

test("renders no link when the prospect has no safe shared route (e.g. a foreign LOKARI/NIA prospect)", () => {
  const html = renderToStaticMarkup(
    <ProspectActionQueueAttention prospects={[prospect({ href: null })]} />,
  );

  assert.doesNotMatch(html, /Voir le prospect/);
});
