import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SharedFeedList from "./SharedFeedList";
import type {
  ProspectWonFeedItem,
  UserStatusFeedItem,
} from "@/src/services/shared-feed.service-core";

const referenceDate = new Date("2026-08-08T15:00:00.000Z");
const adminViewer = { id: "admin-1", role: "ADMIN" as const };

function wonItem(
  id: string,
  occurredAt: string,
  prospectName: string,
): ProspectWonFeedItem {
  return {
    id,
    type: "PROSPECT_WON",
    occurredAt,
    actorName: "Amidou Koane",
    prospectId: id,
    prospectName,
    prospectProduct: "KARMDA",
    prospectAssignedUserId: "commercial-1",
    entity: { kind: "PROSPECT", id },
  };
}

function userStatusItem(
  id: string,
  occurredAt: string,
): UserStatusFeedItem {
  return {
    id,
    type: "USER_ACTIVATED",
    occurredAt,
    userDisplayName: "Odette Yameogo",
    userRole: "COMMERCIAL",
    actorName: "Hamza Mare",
  };
}

test("renders the empty state when there is no shared activity", () => {
  const html = renderToStaticMarkup(
    <SharedFeedList items={[]} viewer={adminViewer} referenceDate={referenceDate} />,
  );

  assert.match(html, /Aucune activité récente/);
  assert.doesNotMatch(html, /Prospect créé|changement de statut|intérêt/i);
});

test("groups items by calendar date, newest date first, preserving feed order within a group", () => {
  const items = [
    wonItem("won-1", "2026-08-08T10:00:00.000Z", "École A"),
    userStatusItem("status-1", "2026-08-08T08:00:00.000Z"),
    wonItem("won-2", "2026-08-07T12:00:00.000Z", "École B"),
  ];

  const html = renderToStaticMarkup(
    <SharedFeedList items={items} viewer={adminViewer} referenceDate={referenceDate} />,
  );

  const todayIndex = html.indexOf("Aujourd’hui");
  const yesterdayIndex = html.indexOf("Hier");
  const ecoleAIndex = html.indexOf("École A");
  const ecoleBIndex = html.indexOf("École B");

  assert.ok(todayIndex >= 0 && yesterdayIndex >= 0);
  assert.ok(todayIndex < yesterdayIndex, "Aujourd’hui must appear before Hier");
  assert.ok(ecoleAIndex < yesterdayIndex, "École A belongs under Aujourd’hui");
  assert.ok(ecoleBIndex > yesterdayIndex, "École B belongs under Hier");
});
