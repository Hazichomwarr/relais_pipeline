import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { personalNoteCategoryOptions } from "@/src/lib/personal-note-options";

import PersonalNoteCategoryBadge from "./PersonalNoteCategoryBadge";

test("renders the exact French label for every category", () => {
  for (const option of personalNoteCategoryOptions) {
    const html = renderToStaticMarkup(
      <PersonalNoteCategoryBadge category={option.value} />,
    );

    assert.match(html, new RegExp(option.label));
  }
});
