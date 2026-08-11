import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * AdminMobileHeader's nav items only render once MobileNavDrawer's client
 * state opens (renderToStaticMarkup always sees the closed, item-less
 * state), so — unlike Sidebar and CommercialSidebar, which also render a
 * static always-visible desktop nav — this can't be verified by rendering.
 * Asserted against the source instead.
 */
test("ADMIN/MANAGER mobile navigation includes an À la une entry pointing to /updates (Ticket 18B)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  assert.match(source, /label: "À la une"/);
  assert.match(source, /href: "\/updates"/);
});

test("ADMIN/MANAGER mobile navigation includes an active (non-disabled) Mes rapports entry pointing to /reports (Ticket 19B)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  const reportsEntryMatch = source.match(
    /\{\s*label: "Mes rapports",[\s\S]*?\},/,
  );

  assert.ok(reportsEntryMatch, "expected a Mes rapports nav item entry");
  assert.match(reportsEntryMatch![0], /href: "\/reports"/);
  assert.doesNotMatch(reportsEntryMatch![0], /disabled: true/);
});

test("ADMIN mobile navigation includes an active Mes prospects entry pointing to /admin/my-prospects (Ticket 15H.2)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  const myProspectsEntryMatch = source.match(
    /\{\s*label: "Mes prospects",[\s\S]*?\},/,
  );

  assert.ok(myProspectsEntryMatch, "expected a Mes prospects nav item entry");
  assert.match(myProspectsEntryMatch![0], /href: "\/admin\/my-prospects"/);
  assert.doesNotMatch(myProspectsEntryMatch![0], /disabled: true/);
});

test("Mes prospects is only added for ADMIN, mirroring the existing Utilisateurs role gate (Ticket 15H.2)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  const myProspectsBlockMatch = source.match(
    /role === "ADMIN"\s*\n\s*\?\s*\[\s*\n\s*\{\s*\n\s*label: "Mes prospects",/,
  );

  assert.ok(
    myProspectsBlockMatch,
    "expected the Mes prospects entry to be gated behind role === \"ADMIN\"",
  );
});

test("ADMIN/MANAGER mobile navigation renames the shared directory entry to Répertoire, pointing at /products (Ticket 15G.1)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  const repertoireEntryMatch = source.match(
    /\{\s*label: "Répertoire",[\s\S]*?\},/,
  );

  assert.ok(repertoireEntryMatch, "expected a Répertoire nav item entry");
  assert.match(repertoireEntryMatch![0], /href: "\/products"/);
  assert.doesNotMatch(repertoireEntryMatch![0], /disabled: true/);
  assert.doesNotMatch(source, /label: "Toutes les écoles"/);
});

test("ADMIN/MANAGER mobile navigation includes a distinct, active Rapports quotidiens entry pointing to /admin/reports (Ticket 19C)", () => {
  const source = readFileSync(
    "component/dashboard/AdminMobileHeader.tsx",
    "utf8",
  );

  const managementEntryMatch = source.match(
    /\{\s*label: "Rapports quotidiens",[\s\S]*?\},/,
  );

  assert.ok(managementEntryMatch, "expected a Rapports quotidiens nav item entry");
  assert.match(managementEntryMatch![0], /href: "\/admin\/reports"/);
  assert.doesNotMatch(managementEntryMatch![0], /disabled: true/);
});
