import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SchoolDuplicateWarning } from "./SchoolDuplicateWarning";
import type { SchoolDuplicateLookupState } from "./useSchoolDuplicateLookup";

const checkboxProps = {
  name: "duplicateSchoolReviewed" as const,
  onChange: async () => true,
  onBlur: async () => true,
  ref: () => {},
};

function match(overrides: Partial<{
  id: string;
  name: string;
  location: string | null;
  assignedUserName: string;
  status: "NEW" | "TO_FOLLOW_UP" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST";
  interest: "NOT_INTERESTED" | "MAYBE" | "NEEDS_INFORMATION" | "INTERESTED" | "READY_TO_DISCUSS";
  lastContactAt: Date | null;
}> = {}) {
  return {
    id: "existing-1",
    name: "École Karpala",
    location: "Ouagadougou",
    assignedUserName: "Awa Traoré",
    status: "QUALIFIED" as const,
    interest: "INTERESTED" as const,
    lastContactAt: null,
    ...overrides,
  };
}

for (const lookup of [
  { status: "idle" as const },
  { status: "loading" as const },
  { status: "error" as const, message: "Impossible de vérifier." },
  { status: "success" as const, matches: [] },
] satisfies SchoolDuplicateLookupState[]) {
  test(`does not render the visible warning block when ${lookup.status}${"matches" in lookup ? " with no matches" : ""}`, () => {
    const html = renderToStaticMarkup(
      <SchoolDuplicateWarning
        lookup={lookup}
        query="École Karpala"
        checkboxProps={checkboxProps}
      />,
    );

    assert.doesNotMatch(html, /Établissements similaires déjà enregistrés/);
  });
}

test("renders matches, heading, and the exact checkbox label when there are results", () => {
  const html = renderToStaticMarkup(
    <SchoolDuplicateWarning
      lookup={{ status: "success", matches: [match()] }}
      query="Karpala"
      checkboxProps={checkboxProps}
    />,
  );

  assert.match(html, /Établissements similaires déjà enregistrés/);
  assert.match(html, /École Karpala/);
  assert.match(html, /Awa Traoré/);
  assert.match(html, /Qualifié/);
  assert.match(
    html,
    /J.{1,2}ai vérifié les établissements existants et je confirme qu.{1,2}il s.{1,2}agit d.{1,2}un nouveau prospect\./,
  );
  assert.match(html, /href="\/schools\/existing-1"/);
});

test("shows the stronger exact-match line only when a result's name normalizes to the same query", () => {
  const exactHtml = renderToStaticMarkup(
    <SchoolDuplicateWarning
      lookup={{ status: "success", matches: [match({ name: "École Karpala" })] }}
      query="  école   karpala "
      checkboxProps={checkboxProps}
    />,
  );

  assert.match(exactHtml, /Un établissement portant ce nom existe déjà dans RELAIS CRM\./);

  const partialHtml = renderToStaticMarkup(
    <SchoolDuplicateWarning
      lookup={{ status: "success", matches: [match({ name: "École Karpala Nord" })] }}
      query="École Karpala"
      checkboxProps={checkboxProps}
    />,
  );

  assert.doesNotMatch(
    partialHtml,
    /Un établissement portant ce nom existe déjà dans RELAIS CRM\./,
  );
});

test("renders a placeholder instead of crashing when a match has no last contact date", () => {
  const html = renderToStaticMarkup(
    <SchoolDuplicateWarning
      lookup={{ status: "success", matches: [match({ lastContactAt: null })] }}
      query="Karpala"
      checkboxProps={checkboxProps}
    />,
  );

  assert.match(html, /Aucun contact enregistré/);
});

test("surfaces a lookup failure distinctly from a quiet no-match state", () => {
  const html = renderToStaticMarkup(
    <SchoolDuplicateWarning
      lookup={{ status: "error", message: "Impossible de vérifier les établissements existants." }}
      query="Karpala"
      checkboxProps={checkboxProps}
    />,
  );

  assert.match(html, /Impossible de vérifier les établissements existants\./);
});
