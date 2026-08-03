import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { CommercialDashboard } from "@/src/services/commercial-dashboard.service";

import CommercialRecentProspects from "./CommercialRecentProspects";

test("renders the no-assigned-prospects empty state without implying poor performance", () => {
  const html = renderToStaticMarkup(
    <CommercialRecentProspects prospects={[]} />,
  );

  assert.match(html, /Aucun prospect ne vous est encore assigné/);
});

test("renders a recent prospect with a link to its own detail page", () => {
  const html = renderToStaticMarkup(
    <CommercialRecentProspects prospects={[makeRecentProspect()]} />,
  );

  assert.match(html, /École Horizon/);
  assert.match(html, /\/dashboard\/commercial\/prospects\/prospect-1/);
  assert.match(html, /Qualifié/);
});

function makeRecentProspect(): CommercialDashboard["recentProspects"][number] {
  return {
    id: "prospect-1",
    product: "KARMDA",
    name: "École Horizon",
    prospectType: "École privée",
    contactName: null,
    phone: "+22670000000",
    location: null,
    interest: "INTERESTED",
    status: "QUALIFIED",
    nextAction: null,
    followUpDate: null,
    notes: "",
    onlinePresence: null,
    agentName: "Awa Traoré",
    assignedUserId: "commercial-1",
    schoolType: null,
    estimatedStudentCount: null,
    currentSchoolSystem: null,
    contactRole: null,
    propertyOwnerType: null,
    estimatedPropertyCount: null,
    propertyCountries: null,
    currentPropertySystem: null,
    savingsGroupType: null,
    estimatedMemberCount: null,
    contributionFrequency: null,
    currentSavingsSystem: null,
    businessCategory: null,
    requestedService: null,
    createdAt: new Date("2026-07-30T10:00:00"),
    updatedAt: new Date("2026-07-30T10:00:00"),
    assignedUser: {
      id: "commercial-1",
      firstName: "Awa",
      lastName: "Traoré",
      role: "COMMERCIAL",
      active: true,
    },
  };
}
