import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import PaymentMethodBreakdown from "./PaymentMethodBreakdown";

test("empty payment methods show a fallback message", () => {
  const html = renderToStaticMarkup(
    <PaymentMethodBreakdown paymentMethods={[]} />,
  );

  assert.match(html, /Aucun mouvement enregistré sur cette période/);
});

test("renders method label, movement count, and volume amount, labeled as volume not revenue", () => {
  const html = renderToStaticMarkup(
    <PaymentMethodBreakdown
      paymentMethods={[
        { paymentMethod: "CASH", amount: "720000.00", entryCount: 12 },
        { paymentMethod: "MOBILE_MONEY", amount: "430000.00", entryCount: 9 },
      ]}
    />,
  );

  assert.match(html, /Espèces/);
  assert.match(html, /12 mouvements/);
  assert.match(html, /720 000 CFA/);
  assert.match(html, /Mobile Money/);
  assert.match(html, /9 mouvements/);
  assert.match(html, /430 000 CFA/);
  assert.match(html, /Volume des mouvements/);
});
