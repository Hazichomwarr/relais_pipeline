import assert from "node:assert/strict";
import test from "node:test";

import type { RelaisProduct } from "@prisma/client";

import { getProductDirectoryOverviewCore } from "./product-directory.service-core";

test("returns exactly the counts reported per product, regardless of owner", async () => {
  const counts: Record<RelaisProduct, number> = {
    KARMDA: 5,
    DIGITAL_SERVICES: 7,
    LOKARI: 1,
    NIA: 0,
  };

  const overview = await getProductDirectoryOverviewCore({
    countByProduct: async (product) => counts[product],
  });

  const byProduct = Object.fromEntries(
    overview.map((item) => [item.product, item.prospectCount]),
  );

  assert.equal(byProduct.KARMDA, 5);
  assert.equal(byProduct.DIGITAL_SERVICES, 7);
  assert.equal(byProduct.LOKARI, 1);
  assert.equal(byProduct.NIA, 0);
});

test("never scopes the count query by an owner/user id — only by product", async () => {
  const calls: RelaisProduct[] = [];

  await getProductDirectoryOverviewCore({
    countByProduct: async (product) => {
      calls.push(product);
      return 0;
    },
  });

  assert.deepEqual([...calls].sort(), [
    "DIGITAL_SERVICES",
    "KARMDA",
    "LOKARI",
    "NIA",
  ]);
});

test("a zero-count product is still returned, not filtered out", async () => {
  const overview = await getProductDirectoryOverviewCore({
    countByProduct: async () => 0,
  });

  assert.equal(overview.length, 4);
  assert.ok(overview.every((item) => item.prospectCount === 0));
});

test("preserves the deterministic display order", async () => {
  const overview = await getProductDirectoryOverviewCore({
    countByProduct: async () => 0,
  });

  assert.deepEqual(
    overview.map((item) => item.product),
    ["KARMDA", "DIGITAL_SERVICES", "LOKARI", "NIA"],
  );
});

test("each item carries its href, slug, label, and description alongside the count", async () => {
  const overview = await getProductDirectoryOverviewCore({
    countByProduct: async () => 3,
  });

  const karmda = overview.find((item) => item.product === "KARMDA");

  assert.ok(karmda);
  assert.equal(karmda!.slug, "karmda");
  assert.equal(karmda!.href, "/products/karmda");
  assert.equal(karmda!.prospectCount, 3);
  assert.ok(karmda!.label.length > 0);
  assert.ok(karmda!.description.length > 0);
});
