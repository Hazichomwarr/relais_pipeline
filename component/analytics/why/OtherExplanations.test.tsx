import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import OtherExplanations from "./OtherExplanations";

test("renders each explanation verbatim", () => {
  const html = renderToStaticMarkup(
    <OtherExplanations explanations={["Attend la rentrée scolaire prochaine"]} />,
  );
  assert.match(html, /Attend la rentrée scolaire prochaine/);
});

test("renders nothing when there are no OTHER rows in scope", () => {
  const html = renderToStaticMarkup(<OtherExplanations explanations={[]} />);
  assert.equal(html, "");
});
