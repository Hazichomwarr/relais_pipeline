import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DigitalServicesDirectoryCards from "./DigitalServicesDirectoryCards";

function baseItem() {
  return {
    id: "prospect-1",
    name: "Orange Market",
    businessCategory: "GROCERY_STORE",
    status: "TO_FOLLOW_UP" as const,
    interest: "INTERESTED" as const,
    commercialName: "Odette Yaméogo",
    nextAction: "CALL_BACK" as const,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    detailHref: "/admin/prospects/prospect-1" as string | null,
  };
}

test("renders the empty state with clear copy", () => {
  const html = renderToStaticMarkup(<DigitalServicesDirectoryCards items={[]} />);

  assert.match(html, /Aucune entreprise trouvée\./);
  assert.match(html, /Cette entreprise n&#x27;a pas encore été prospectée\./);
});

test("renders a card with name, business category, commercial, status, interest, next action, and link", () => {
  const html = renderToStaticMarkup(
    <DigitalServicesDirectoryCards items={[baseItem()]} />,
  );

  assert.match(html, /Orange Market/);
  assert.match(html, /GROCERY_STORE/);
  assert.match(html, /Odette Yaméogo/);
  assert.match(html, /À suivre/);
  assert.match(html, /Intéressé/);
  assert.match(html, /Rappeler/);
  assert.match(html, /href="\/admin\/prospects\/prospect-1"/);
  assert.match(html, /Voir le prospect/);
});

test("omits the business category line when none is recorded", () => {
  const html = renderToStaticMarkup(
    <DigitalServicesDirectoryCards
      items={[{ ...baseItem(), businessCategory: null }]}
    />,
  );

  assert.doesNotMatch(html, /GROCERY_STORE/);
});

test("omits the next action line when none is recorded", () => {
  const html = renderToStaticMarkup(
    <DigitalServicesDirectoryCards items={[{ ...baseItem(), nextAction: null }]} />,
  );

  assert.doesNotMatch(html, /Prochaine action/);
});

test("shows a non-link placeholder — not an unauthorized link — when detailHref is null (foreign commercial-owned prospect)", () => {
  const html = renderToStaticMarkup(
    <DigitalServicesDirectoryCards items={[{ ...baseItem(), detailHref: null }]} />,
  );

  assert.doesNotMatch(html, /<a /);
  assert.match(html, /Assigné à un autre commercial/);
});
