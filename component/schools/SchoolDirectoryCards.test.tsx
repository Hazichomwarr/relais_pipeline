import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SchoolDirectoryCards from "./SchoolDirectoryCards";

function baseSchool() {
  return {
    id: "prospect-1",
    name: "École Karpala",
    status: "QUALIFIED" as const,
    interest: "READY_TO_DISCUSS" as const,
    assignedUserId: "commercial-1",
    commercialName: "Awa Traoré",
    lastActivityAt: null as Date | null,
  };
}

test("renders the empty state with the exact ticket copy", () => {
  const html = renderToStaticMarkup(
    <SchoolDirectoryCards schools={[]} resolveHref={() => "/schools/x"} />,
  );

  assert.match(html, /Aucun établissement trouvé\./);
  assert.match(html, /Cette école n&#x27;a pas encore été prospectée\./);
});

test("renders a school card with name, commercial, status, interest, and link", () => {
  const html = renderToStaticMarkup(
    <SchoolDirectoryCards
      schools={[baseSchool()]}
      resolveHref={(school) => `/admin/prospects/${school.id}`}
    />,
  );

  assert.match(html, /École Karpala/);
  assert.match(html, /Awa Traoré/);
  assert.match(html, /Qualifié/);
  assert.match(html, /Prêt à discuter/);
  assert.match(html, /href="\/admin\/prospects\/prospect-1"/);
  assert.match(html, /Voir le prospect/);
});

test("renders a placeholder instead of crashing when there is no last activity", () => {
  const html = renderToStaticMarkup(
    <SchoolDirectoryCards
      schools={[baseSchool()]}
      resolveHref={() => "/schools/prospect-1"}
    />,
  );

  assert.match(html, /Aucune activité enregistrée/);
});

test("formats a known last activity date", () => {
  const html = renderToStaticMarkup(
    <SchoolDirectoryCards
      schools={[
        { ...baseSchool(), lastActivityAt: new Date("2026-08-01T10:00:00.000Z") },
      ]}
      resolveHref={() => "/schools/prospect-1"}
    />,
  );

  assert.doesNotMatch(html, /Aucune activité enregistrée/);
});
