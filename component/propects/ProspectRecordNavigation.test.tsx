import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProspectRecordNavigation } from "./ProspectRecordNavigation";
import type { ProspectRecordNavigationProps } from "@/src/lib/prospect-record-navigation";

function props(
  overrides: Partial<ProspectRecordNavigationProps> = {},
): ProspectRecordNavigationProps {
  return {
    previousHref: "/admin/prospects/prospect-d?returnTo=%2Fadmin",
    previousLabel: "École D",
    nextHref: "/admin/prospects/prospect-b?returnTo=%2Fadmin",
    nextLabel: "École B",
    returnHref: "/admin",
    contextLabel: "Navigation parmi les prospects de Amidou Koane",
    ...overrides,
  };
}

test("renders both previous and next links with their destination names", () => {
  const html = renderToStaticMarkup(<ProspectRecordNavigation {...props()} />);

  assert.match(html, /href="\/admin\/prospects\/prospect-d\?returnTo=%2Fadmin"/);
  assert.match(html, /href="\/admin\/prospects\/prospect-b\?returnTo=%2Fadmin"/);
  assert.match(html, /École D/);
  assert.match(html, /École B/);
});

test("a null previous renders a disabled placeholder instead of a link", () => {
  const html = renderToStaticMarkup(
    <ProspectRecordNavigation {...props({ previousHref: null, previousLabel: null })} />,
  );

  assert.match(html, /aria-disabled="true"/);
  const previousLinkCount = (html.match(/href="\/admin\/prospects\/prospect-d/g) ?? []).length;
  assert.equal(previousLinkCount, 0);
});

test("the return-to-list link always renders regardless of neighbor availability", () => {
  const html = renderToStaticMarkup(
    <ProspectRecordNavigation
      {...props({
        previousHref: null,
        previousLabel: null,
        nextHref: null,
        nextLabel: null,
      })}
    />,
  );

  assert.match(html, /Retour à la liste/);
  assert.match(html, /href="\/admin"/);
});

test("a null contextLabel renders no context paragraph", () => {
  const html = renderToStaticMarkup(
    <ProspectRecordNavigation {...props({ contextLabel: null })} />,
  );

  assert.doesNotMatch(html, /Navigation parmi/);
});

test("a long prospect name is wrapped for truncation, not left to overflow", () => {
  const longName = "École " + "Très ".repeat(30) + "Longue";
  const html = renderToStaticMarkup(
    <ProspectRecordNavigation {...props({ nextLabel: longName })} />,
  );

  assert.match(html, /class="truncate"/);
  assert.match(html, new RegExp(longName));
});

test("present links carry an accessible label naming the destination", () => {
  const html = renderToStaticMarkup(<ProspectRecordNavigation {...props()} />);

  assert.match(html, /aria-label="Précédent : École D"/);
  assert.match(html, /aria-label="Suivant : École B"/);
});
