import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Ticket 18A already excludes PersonalNote/LedgerEntry/prospect-created/
 * status-change/interest-change/scheduled-follow-up at the service layer
 * (see src/services/shared-feed.service.test.ts). This is the Ticket 18B
 * regression: nothing in the UI layer re-derives history from a different
 * query or slips an excluded event family back in.
 */
const uiFiles = [
  "app/updates/layout.tsx",
  "app/updates/page.tsx",
  "app/updates/loading.tsx",
  "component/updates/SharedFeedList.tsx",
  "component/updates/SharedFeedDateGroup.tsx",
  "component/updates/SharedFeedItemCard.tsx",
  "component/updates/SharedFeedEmptyState.tsx",
  "src/lib/shared-feed-date-grouping.ts",
  "src/lib/shared-feed-timestamp.ts",
  "src/lib/shared-feed-prospect-navigation.ts",
];

test("no /updates UI file imports PersonalNote or LedgerEntry, or queries Prisma directly", () => {
  for (const file of uiFiles) {
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /personalNote/i, `${file} must not reference PersonalNote`);
    assert.doesNotMatch(source, /ledgerEntry/i, `${file} must not reference LedgerEntry`);
    assert.doesNotMatch(source, /from "@\/src\/lib\/prisma"/, `${file} must not import prisma directly`);
    assert.doesNotMatch(source, /prisma\./, `${file} must not call Prisma directly`);
  }
});

test("no /updates UI file references an excluded event family by name", () => {
  const excluded = [
    /PROSPECT_CREATED/,
    /PROSPECT_STATUS_CHANGED/,
    /PROSPECT_INTEREST_CHANGED/,
    /FOLLOW_UP_SCHEDULED/,
  ];

  for (const file of uiFiles) {
    const source = readFileSync(file, "utf8");

    for (const pattern of excluded) {
      assert.doesNotMatch(source, pattern, `${file} must not reference ${pattern}`);
    }
  }
});

test("SharedFeedItemCard's discriminated switch covers exactly the six approved event types — no more, no less", () => {
  const source = readFileSync("component/updates/SharedFeedItemCard.tsx", "utf8");
  const cases = [...source.matchAll(/case\s+"([A-Z_]+)":/g)].map((m) => m[1]);

  assert.deepEqual(
    cases.sort(),
    [
      "FOLLOW_UP_COMPLETED",
      "PROSPECT_INTERACTION",
      "PROSPECT_WON",
      "USER_ACTIVATED",
      "USER_CREATED",
      "USER_DEACTIVATED",
    ].sort(),
  );
});

test("the updates page never mentions financial totals, passwords, or email addresses", () => {
  const pageSource = readFileSync("app/updates/page.tsx", "utf8");
  const cardSource = readFileSync(
    "component/updates/SharedFeedItemCard.tsx",
    "utf8",
  );

  for (const source of [pageSource, cardSource]) {
    assert.doesNotMatch(source, /\.email\b/);
    assert.doesNotMatch(source, /password/i);
    assert.doesNotMatch(source, /solde|paiement|dépense|salaire/i);
  }
});

test("USER_ACTIVATED/USER_DEACTIVATED items never render a clickable /admin/users link (V1 scope)", () => {
  const source = readFileSync("component/updates/SharedFeedItemCard.tsx", "utf8");

  assert.doesNotMatch(source, /\/admin\/users/);
});
