import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import OperationsProspectingSummary from "./OperationsProspectingSummary";

test("3/3 + 1/1: targets met, shown as atteint", () => {
  const html = renderToStaticMarkup(
    <OperationsProspectingSummary
      digitalServicesProspects={3}
      karmdaSchoolProspects={1}
      prospectingException={false}
      prospectingExceptionReason=""
    />,
  );

  assert.match(html, /3 \/ 3/);
  assert.match(html, /1 \/ 1/);
  assert.match(html, /Objectif atteint/);
});

test("5/3 + 2/1: targets exceeded, shown as dépassé, not a failure", () => {
  const html = renderToStaticMarkup(
    <OperationsProspectingSummary
      digitalServicesProspects={5}
      karmdaSchoolProspects={2}
      prospectingException={false}
      prospectingExceptionReason=""
    />,
  );

  assert.match(html, /5 \/ 3/);
  assert.match(html, /Objectif dépassé/);
  assert.doesNotMatch(html, /non atteint/);
});

test("2/3 + 1/1 with no exception: shown as objectif non atteint", () => {
  const html = renderToStaticMarkup(
    <OperationsProspectingSummary
      digitalServicesProspects={2}
      karmdaSchoolProspects={1}
      prospectingException={false}
      prospectingExceptionReason=""
    />,
  );

  assert.match(html, /Objectif non atteint/);
});

test("targets missed with a valid exception: shown as justified, never as employee failure", () => {
  const html = renderToStaticMarkup(
    <OperationsProspectingSummary
      digitalServicesProspects={0}
      karmdaSchoolProspects={0}
      prospectingException={true}
      prospectingExceptionReason="Formation KARMDA toute la journée."
    />,
  );

  assert.match(html, /Exception justifiée/);
  assert.match(html, /Formation KARMDA toute la journée\./);
  assert.doesNotMatch(html, /Objectif non atteint/);
});

test("an absent (null) count renders as a dash, not a misleading 0", () => {
  const html = renderToStaticMarkup(
    <OperationsProspectingSummary
      digitalServicesProspects={null}
      karmdaSchoolProspects={null}
      prospectingException={false}
      prospectingExceptionReason=""
    />,
  );

  assert.match(html, /— \/ 3/);
  assert.match(html, /— \/ 1/);
});
