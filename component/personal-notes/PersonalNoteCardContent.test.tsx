import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import PersonalNoteCardContent, {
  formatPersonalNoteDate,
  type PersonalNoteCardContentNote,
} from "./PersonalNoteCardContent";

function baseNote(
  overrides: Partial<PersonalNoteCardContentNote> = {},
): PersonalNoteCardContentNote {
  return {
    category: "URGENT_TODO",
    title: "Relancer l’école Sainte-Marie",
    content: "Appeler avant vendredi pour confirmer la visite.",
    pinned: false,
    updatedAt: new Date("2026-08-06T09:30:00.000Z"),
    ...overrides,
  };
}

test("renders the category label from the centralized options", () => {
  const html = renderToStaticMarkup(
    <PersonalNoteCardContent note={baseNote({ category: "RELAIS_IDEA" })} />,
  );

  assert.match(html, /Idées pour RELAIS/);
});

test("shows a pinned indicator only when the note is pinned", () => {
  const pinnedHtml = renderToStaticMarkup(
    <PersonalNoteCardContent note={baseNote({ pinned: true })} />,
  );
  const unpinnedHtml = renderToStaticMarkup(
    <PersonalNoteCardContent note={baseNote({ pinned: false })} />,
  );

  assert.match(pinnedHtml, /Épinglée/);
  assert.doesNotMatch(unpinnedHtml, /Épinglée/);
});

test("renders the title", () => {
  const html = renderToStaticMarkup(<PersonalNoteCardContent note={baseNote()} />);

  assert.match(html, /Relancer l.école Sainte-Marie/);
});

test("renders a content preview with a line-clamp class when content is present", () => {
  const html = renderToStaticMarkup(<PersonalNoteCardContent note={baseNote()} />);

  assert.match(html, /Appeler avant vendredi/);
  assert.match(html, /line-clamp-3/);
});

test("renders no empty preview block when content is blank", () => {
  const nullContent = renderToStaticMarkup(
    <PersonalNoteCardContent note={baseNote({ content: null })} />,
  );

  assert.doesNotMatch(nullContent, /line-clamp-3/);
});

test("renders the updated date", () => {
  const html = renderToStaticMarkup(<PersonalNoteCardContent note={baseNote()} />);

  assert.match(
    html,
    new RegExp(`Modifiée le ${formatPersonalNoteDate(baseNote().updatedAt)}`),
  );
});
