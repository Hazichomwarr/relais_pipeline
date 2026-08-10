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
