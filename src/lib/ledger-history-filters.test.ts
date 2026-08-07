import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLedgerHistoryCategoryUrl,
  buildLedgerHistoryProductUrl,
  buildLedgerHistoryTypeUrl,
  parseLedgerHistoryFilter,
} from "./ledger-history-filters";

test("no params -> all (Tous)", () => {
  assert.deepEqual(parseLedgerHistoryFilter({}), {});
});

test("valid INFLOW type is accepted", () => {
  assert.deepEqual(parseLedgerHistoryFilter({ type: "INFLOW" }), {
    type: "INFLOW",
  });
});

test("valid OUTFLOW type is accepted", () => {
  assert.deepEqual(parseLedgerHistoryFilter({ type: "OUTFLOW" }), {
    type: "OUTFLOW",
  });
});

test("an invalid type falls back to Tous (no filter)", () => {
  assert.deepEqual(parseLedgerHistoryFilter({ type: "banana" }), {});
});

test("a valid inflow category is accepted for INFLOW", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({ type: "INFLOW", category: "CLIENT_PAYMENT" }),
    { type: "INFLOW", category: "CLIENT_PAYMENT" },
  );
});

test("a valid outflow category is accepted for OUTFLOW", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({ type: "OUTFLOW", category: "FUEL" }),
    { type: "OUTFLOW", category: "FUEL" },
  );
});

test("an incompatible category (outflow category under INFLOW) is ignored", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({ type: "INFLOW", category: "FUEL" }),
    { type: "INFLOW" },
  );
});

test("an incompatible category (inflow category under OUTFLOW) is ignored", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({
      type: "OUTFLOW",
      category: "CLIENT_PAYMENT",
    }),
    { type: "OUTFLOW" },
  );
});

test("an unknown category value is ignored", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({ type: "INFLOW", category: "MADE_UP" }),
    { type: "INFLOW" },
  );
});

test("product is accepted for CLIENT_PAYMENT", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "KARMDA",
    }),
    { type: "INFLOW", category: "CLIENT_PAYMENT", product: "KARMDA" },
  );
});

test("product is accepted for the optional-product CLIENT_REFUND category", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({
      type: "OUTFLOW",
      category: "CLIENT_REFUND",
      product: "LOKARI",
    }),
    { type: "OUTFLOW", category: "CLIENT_REFUND", product: "LOKARI" },
  );
});

test("a stale product is ignored for a product-forbidden category (e.g. FUEL)", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({
      type: "OUTFLOW",
      category: "FUEL",
      product: "KARMDA",
    }),
    { type: "OUTFLOW", category: "FUEL" },
  );
});

test("a product without a category is ignored entirely", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({ type: "OUTFLOW", product: "KARMDA" }),
    { type: "OUTFLOW" },
  );
});

test("an unknown product value is ignored", () => {
  assert.deepEqual(
    parseLedgerHistoryFilter({
      type: "INFLOW",
      category: "CLIENT_PAYMENT",
      product: "NOT_A_PRODUCT",
    }),
    { type: "INFLOW", category: "CLIENT_PAYMENT" },
  );
});

test("buildLedgerHistoryTypeUrl: Tous clears every filter", () => {
  assert.equal(buildLedgerHistoryTypeUrl(""), "/finances");
});

test("buildLedgerHistoryTypeUrl: a direction sets only type", () => {
  assert.equal(buildLedgerHistoryTypeUrl("INFLOW"), "/finances?type=INFLOW");
  assert.equal(buildLedgerHistoryTypeUrl("OUTFLOW"), "/finances?type=OUTFLOW");
});

test("buildLedgerHistoryCategoryUrl: selecting a category preserves type and drops any stale product", () => {
  assert.equal(
    buildLedgerHistoryCategoryUrl("INFLOW", "CLIENT_PAYMENT"),
    "/finances?type=INFLOW&category=CLIENT_PAYMENT",
  );
});

test("buildLedgerHistoryCategoryUrl: Toutes les catégories clears category (and implicitly product)", () => {
  assert.equal(buildLedgerHistoryCategoryUrl("OUTFLOW", ""), "/finances?type=OUTFLOW");
});

test("buildLedgerHistoryProductUrl: selecting a product preserves type and category", () => {
  assert.equal(
    buildLedgerHistoryProductUrl("INFLOW", "CLIENT_PAYMENT", "KARMDA"),
    "/finances?type=INFLOW&category=CLIENT_PAYMENT&product=KARMDA",
  );
});

test("buildLedgerHistoryProductUrl: Tous les produits clears product only", () => {
  assert.equal(
    buildLedgerHistoryProductUrl("INFLOW", "CLIENT_PAYMENT", ""),
    "/finances?type=INFLOW&category=CLIENT_PAYMENT",
  );
});
