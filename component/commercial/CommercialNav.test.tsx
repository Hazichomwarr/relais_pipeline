import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CommercialNav from "./CommercialNav";

test("COMMERCIAL navigation includes a Mes notes link to /notes", () => {
  const html = renderToStaticMarkup(
    <CommercialNav firstName="Julbert" lastName="Sermé" />,
  );

  assert.match(html, /Mes notes/);
  assert.match(html, /href="\/notes"/);
});
