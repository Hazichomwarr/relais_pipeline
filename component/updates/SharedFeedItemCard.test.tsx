import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SharedFeedItemCard from "./SharedFeedItemCard";
import type {
  FollowUpCompletedFeedItem,
  ProspectInteractionFeedItem,
  ProspectWonFeedItem,
  UserCreatedFeedItem,
  UserStatusFeedItem,
} from "@/src/services/shared-feed.service-core";

const referenceDate = new Date("2026-08-08T15:00:00.000Z");
const adminViewer = { id: "admin-1", role: "ADMIN" as const };

const interactionItem: ProspectInteractionFeedItem = {
  id: "activity-1",
  type: "PROSPECT_INTERACTION",
  occurredAt: "2026-08-08T14:42:00.000Z",
  actorName: "Julbert Serme",
  prospectId: "prospect-1",
  prospectName: "Lycée Saint Viateur",
  prospectProduct: "KARMDA",
  prospectAssignedUserId: "commercial-1",
  activityType: "PHONE_CALL",
  summary: "Appel avec le directeur",
  preview: "Le directeur souhaite une démonstration mardi matin.",
  entity: { kind: "PROSPECT", id: "prospect-1" },
};

const followUpItem: FollowUpCompletedFeedItem = {
  id: "activity-2",
  type: "FOLLOW_UP_COMPLETED",
  occurredAt: "2026-08-08T14:15:00.000Z",
  actorName: "Odette Yameogo",
  prospectId: "prospect-2",
  prospectName: "Groupe Scolaire Horizon",
  prospectProduct: "KARMDA",
  prospectAssignedUserId: "commercial-2",
  summary: "Relance effectuée",
  entity: { kind: "PROSPECT", id: "prospect-2" },
};

const wonItem: ProspectWonFeedItem = {
  id: "activity-3",
  type: "PROSPECT_WON",
  occurredAt: "2026-08-08T14:45:00.000Z",
  actorName: "Amidou Koane",
  prospectId: "prospect-3",
  prospectName: "Groupe Scolaire Wend-Panga",
  prospectProduct: "KARMDA",
  prospectAssignedUserId: "commercial-3",
  entity: { kind: "PROSPECT", id: "prospect-3" },
};

const userActivatedItem: UserStatusFeedItem = {
  id: "status-1",
  type: "USER_ACTIVATED",
  occurredAt: "2026-08-08T08:30:00.000Z",
  userDisplayName: "Odette Yameogo",
  userRole: "COMMERCIAL",
  actorName: "Hamza Mare",
};

const userDeactivatedItem: UserStatusFeedItem = {
  id: "status-2",
  type: "USER_DEACTIVATED",
  occurredAt: "2026-08-08T18:05:00.000Z",
  userDisplayName: "Salifou Ouattara",
  userRole: "COMMERCIAL",
  actorName: "Hamza Mare",
};

const userCreatedItem: UserCreatedFeedItem = {
  id: "creation-1",
  type: "USER_CREATED",
  occurredAt: "2026-08-08T09:05:00.000Z",
  subjectDisplayName: "Aminata Ouédraogo",
  actorName: "Hamza Mare",
  roleAtEvent: "COMMERCIAL",
};

test("PROSPECT_INTERACTION renders the actor, the prospect, and the interaction preview", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={interactionItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Julbert Serme/);
  assert.match(html, /a ajouté une interaction sur/);
  assert.match(html, /Lycée Saint Viateur/);
  assert.match(html, /Le directeur souhaite une démonstration mardi matin/);
});

test("PROSPECT_INTERACTION falls back to a neutral actor label when none was captured", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={{ ...interactionItem, actorName: null }}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Un commercial/);
});

test("PROSPECT_INTERACTION never renders full multi-paragraph content unclamped", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={interactionItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /line-clamp-4/);
});

test("FOLLOW_UP_COMPLETED renders the actor and the prospect, never a 'scheduled' phrasing", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={followUpItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Odette Yameogo/);
  assert.match(html, /a terminé un suivi avec/);
  assert.match(html, /Groupe Scolaire Horizon/);
  assert.doesNotMatch(html, /planifié/);
});

test("PROSPECT_WON gets the Nouveau client label and the acting commercial", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={wonItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Nouveau client/);
  assert.match(html, /Groupe Scolaire Wend-Panga/);
  assert.match(html, /est devenu client/);
  assert.match(html, /Commercial : Amidou Koane/);
});

test("USER_CREATED renders actor, subject, and the persisted creation-time role without private fields", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userCreatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Hamza Mare/);
  assert.match(html, /a ajouté/);
  assert.match(html, /Aminata Ouédraogo/);
  assert.match(html, /Rôle à l’arrivée : Commercial/);
  assert.doesNotMatch(html, /email|téléphone|mot de passe/i);
});

test("USER_CREATED renders roleAtEvent after a later promotion, never a current role", () => {
  const promotedCurrentRole = "MANAGER";
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={{ ...userCreatedItem, roleAtEvent: "COMMERCIAL" }}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Commercial/);
  assert.doesNotMatch(html, new RegExp(promotedCurrentRole, "i"));
});

test("USER_ACTIVATED renders the user, their role, and the acting admin — never implying self-activation", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userActivatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Odette Yameogo/);
  assert.match(html, /activé\(e\) comme Commercial/);
  assert.match(html, /Activé\(e\) par Hamza Mare/);
});

test("USER_DEACTIVATED renders neutral language and no clickable user detail link", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userDeactivatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /Salifou Ouattara/);
  assert.match(html, /a été désactivé\(e\)/);
  assert.match(html, /Action effectuée par Hamza Mare/);
  assert.doesNotMatch(html, /href="\/admin\/users/);
  assert.doesNotMatch(html, /supprimé|banni|bloqué/i);
});

test("timestamps render as a semantic <time> element with the exact time available", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={followUpItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /<time dateTime="2026-08-08T14:15:00\.000Z"/);
});

test("ADMIN viewer receives the admin prospect link", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={interactionItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /href="\/admin\/prospects\/prospect-1"/);
  assert.match(html, /Voir le prospect/);
});

test("COMMERCIAL viewer owning the prospect receives the editable commercial link", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={interactionItem}
      viewer={{ id: "commercial-1", role: "COMMERCIAL" }}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /href="\/dashboard\/commercial\/prospects\/prospect-1"/);
});

test("COMMERCIAL viewer on another commercial's KARMDA school receives the read-only school summary link", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={interactionItem}
      viewer={{ id: "commercial-99", role: "COMMERCIAL" }}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /href="\/schools\/prospect-1"/);
});

test("COMMERCIAL viewer on another commercial's non-KARMDA prospect gets no link at all", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={{ ...interactionItem, prospectProduct: "DIGITAL_SERVICES" }}
      viewer={{ id: "commercial-99", role: "COMMERCIAL" }}
      referenceDate={referenceDate}
    />,
  );

  assert.doesNotMatch(html, /Voir le prospect/);
  assert.doesNotMatch(html, /<a /);
});

test("user lifecycle items never render a prospect or user detail link", () => {
  const activatedHtml = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userActivatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );
  const deactivatedHtml = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userDeactivatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );
  const createdHtml = renderToStaticMarkup(
    <SharedFeedItemCard
      item={userCreatedItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.doesNotMatch(activatedHtml, /<a /);
  assert.doesNotMatch(deactivatedHtml, /<a /);
  assert.doesNotMatch(createdHtml, /<a /);
});

test("decorative icons are hidden from screen readers", () => {
  const html = renderToStaticMarkup(
    <SharedFeedItemCard
      item={wonItem}
      viewer={adminViewer}
      referenceDate={referenceDate}
    />,
  );

  assert.match(html, /aria-hidden="true"/);
});
