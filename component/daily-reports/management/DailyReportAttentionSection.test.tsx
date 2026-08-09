import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import DailyReportAttentionSection from "./DailyReportAttentionSection";
import type { DailyReportAttentionItem } from "@/src/services/daily-report.service-core";

function makeItem(overrides: Partial<DailyReportAttentionItem> = {}): DailyReportAttentionItem {
  return {
    reportId: "report-1",
    owner: { id: "user-1", firstName: "Lucie", lastName: "Gouba" },
    templateType: "ASSISTANT",
    content: "Contrat école Wend-Panga à valider.",
    submittedAt: "2026-08-09T16:47:00.000Z",
    ...overrides,
  };
}

test("renders the empty message when there are no items", () => {
  const html = renderToStaticMarkup(
    <DailyReportAttentionSection
      title="Décisions requises"
      emptyMessage="Aucune décision de la Direction signalée aujourd’hui."
      items={[]}
    />,
  );

  assert.match(html, /Décisions requises/);
  assert.match(html, /Aucune décision de la Direction signalée aujourd’hui\./);
});

test("renders the employee, template, verbatim content, and a link per item", () => {
  const html = renderToStaticMarkup(
    <DailyReportAttentionSection
      title="Décisions requises"
      emptyMessage="Aucune décision."
      items={[makeItem()]}
    />,
  );

  assert.match(html, /Lucie Gouba/);
  assert.match(html, /Assistante de Direction/);
  assert.match(html, /Contrat école Wend-Panga à valider\./);
  assert.match(html, /href="\/admin\/reports\/report-1"/);
});

test("preserves the employee's exact wording without any summarization", () => {
  const verbatim = "Le client hésite encore, à recontacter la semaine prochaine.";
  const html = renderToStaticMarkup(
    <DailyReportAttentionSection
      title="Problèmes signalés"
      emptyMessage="Aucun problème."
      items={[makeItem({ content: verbatim })]}
    />,
  );

  assert.match(html, new RegExp(verbatim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
