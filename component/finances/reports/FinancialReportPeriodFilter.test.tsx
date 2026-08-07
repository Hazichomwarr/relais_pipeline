import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import FinancialReportPeriodFilter from "./FinancialReportPeriodFilter";

test("renders all five period options as links carrying the period in the URL", () => {
  const html = renderToStaticMarkup(
    <FinancialReportPeriodFilter
      requestedPeriod="month"
      fromDateLabel="2026-08-01"
      toDateLabel="2026-08-31"
    />,
  );

  assert.match(html, /Aujourd’hui/);
  assert.match(html, /Cette semaine/);
  assert.match(html, /Ce mois/);
  assert.match(html, /Cette année/);
  assert.match(html, /Personnalisé/);
  assert.match(html, /href="\/finances\/reports\?period=today"/);
  assert.match(html, /href="\/finances\/reports\?period=week"/);
  assert.match(html, /href="\/finances\/reports\?period=month"/);
  assert.match(html, /href="\/finances\/reports\?period=year"/);
  assert.match(html, /href="\/finances\/reports\?period=custom"/);
});

test("exposes the selected period via aria-current (accessibility)", () => {
  const html = renderToStaticMarkup(
    <FinancialReportPeriodFilter
      requestedPeriod="year"
      fromDateLabel="2026-01-01"
      toDateLabel="2026-12-31"
    />,
  );

  const yearLinkMatch = html.match(
    /<a [^>]*href="\/finances\/reports\?period=year"[^>]*>/,
  );

  assert.ok(yearLinkMatch, "expected a period=year link");
  assert.match(yearLinkMatch![0], /aria-current="page"/);
});

test("custom range form is hidden for a preset period", () => {
  const html = renderToStaticMarkup(
    <FinancialReportPeriodFilter
      requestedPeriod="month"
      fromDateLabel="2026-08-01"
      toDateLabel="2026-08-31"
    />,
  );

  assert.doesNotMatch(html, /<form/);
});

test("custom range form is a native GET form, prefilled with the resolved dates", () => {
  const html = renderToStaticMarkup(
    <FinancialReportPeriodFilter
      requestedPeriod="custom"
      fromDateLabel="2026-08-01"
      toDateLabel="2026-08-10"
    />,
  );

  assert.match(html, /<form[^>]*action="\/finances\/reports"/);
  assert.match(html, /<form[^>]*method="GET"/);
  assert.match(html, /name="period"\s+value="custom"/);
  assert.match(html, /name="from"[^>]*value="2026-08-01"/);
  assert.match(html, /name="to"[^>]*value="2026-08-10"/);
  assert.match(html, />Du</);
  assert.match(html, />Au</);
});
