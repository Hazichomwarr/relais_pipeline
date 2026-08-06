import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import PersonalNotesEmptyState from "./PersonalNotesEmptyState";

test("renders the exact ticket copy and a link to create a note", () => {
  const html = renderToStaticMarkup(<PersonalNotesEmptyState />);

  assert.match(html, /Aucune note pour le moment\./);
  assert.match(
    html,
    /Créez votre première note pour conserver une idée, un rappel ou une tâche personnelle\./,
  );
  assert.match(html, /href="\/notes\/new"/);
  assert.match(html, /Créer une note/);
});
