import assert from "node:assert/strict";
import test from "node:test";
import {
  LedgerEntryCategory,
  LedgerEntryType,
  PaymentMethod,
} from "@prisma/client";

import {
  getLedgerEntryCategoryLabel,
  getPaymentMethodLabel,
  getProductRequirementForCategory,
  inflowCategoryOptions,
  isCategoryAllowedForType,
  isInflowCategory,
  isOutflowCategory,
  isProductValidForCategory,
  outflowCategoryOptions,
  paymentMethodOptions,
} from "./financial-ledger-options";

test("LedgerEntryType has exactly INFLOW and OUTFLOW", () => {
  assert.deepEqual(Object.values(LedgerEntryType).sort(), [
    "INFLOW",
    "OUTFLOW",
  ]);
});

test("every LedgerEntryCategory enum value is covered exactly once, split between inflow and outflow options", () => {
  const inflowValues = inflowCategoryOptions.map((option) => option.value);
  const outflowValues = outflowCategoryOptions.map((option) => option.value);
  const combined = [...inflowValues, ...outflowValues].sort();

  assert.deepEqual(combined, Object.values(LedgerEntryCategory).sort());
  assert.equal(new Set(combined).size, combined.length);
});

test("every PaymentMethod enum value has an option", () => {
  const values = paymentMethodOptions.map((option) => option.value).sort();
  assert.deepEqual(values, Object.values(PaymentMethod).sort());
});

test("inflow category labels match the requested French wording exactly", () => {
  assert.deepEqual(
    Object.fromEntries(
      inflowCategoryOptions.map((option) => [option.value, option.label]),
    ),
    {
      CLIENT_PAYMENT: "Paiement client",
      CAPITAL_CONTRIBUTION: "Apport en capital",
      LOAN_RECEIVED: "Prêt reçu",
      REFUND_RECEIVED: "Remboursement reçu",
      OTHER_INFLOW: "Autre entrée",
    },
  );
});

test("outflow category labels match the requested French wording exactly", () => {
  assert.deepEqual(
    Object.fromEntries(
      outflowCategoryOptions.map((option) => [option.value, option.label]),
    ),
    {
      SALARY: "Salaire",
      TRANSPORT: "Transport",
      FUEL: "Carburant",
      PRINTING: "Impression",
      INTERNET: "Internet et communication",
      OFFICE_SUPPLIES: "Fournitures de bureau",
      EQUIPMENT: "Équipement",
      TAXES_AND_FEES: "Taxes et frais",
      CLIENT_REFUND: "Remboursement client",
      OTHER_OUTFLOW: "Autre sortie",
    },
  );
});

test("payment method labels match the requested French wording exactly", () => {
  assert.deepEqual(
    Object.fromEntries(
      paymentMethodOptions.map((option) => [option.value, option.label]),
    ),
    {
      CASH: "Espèces",
      BANK_TRANSFER: "Virement bancaire",
      MOBILE_MONEY: "Mobile Money",
      CARD: "Carte",
      CHECK: "Chèque",
      OTHER: "Autre",
    },
  );
});

test("category labels have no duplicates across inflow and outflow", () => {
  const labels = [...inflowCategoryOptions, ...outflowCategoryOptions].map(
    (option) => option.label,
  );
  assert.equal(new Set(labels).size, labels.length);
});

test("payment method labels have no duplicates", () => {
  const labels = paymentMethodOptions.map((option) => option.label);
  assert.equal(new Set(labels).size, labels.length);
});

test("getLedgerEntryCategoryLabel resolves every category to its exact French label", () => {
  for (const option of [...inflowCategoryOptions, ...outflowCategoryOptions]) {
    assert.equal(getLedgerEntryCategoryLabel(option.value), option.label);
  }
});

test("getPaymentMethodLabel resolves every method to its exact French label", () => {
  for (const option of paymentMethodOptions) {
    assert.equal(getPaymentMethodLabel(option.value), option.label);
  }
});

test("isInflowCategory / isOutflowCategory correctly separate categories by type", () => {
  for (const option of inflowCategoryOptions) {
    assert.equal(isInflowCategory(option.value), true);
    assert.equal(isOutflowCategory(option.value), false);
  }

  for (const option of outflowCategoryOptions) {
    assert.equal(isOutflowCategory(option.value), true);
    assert.equal(isInflowCategory(option.value), false);
  }
});

test("isCategoryAllowedForType: INFLOW + CLIENT_PAYMENT is valid", () => {
  assert.equal(isCategoryAllowedForType("INFLOW", "CLIENT_PAYMENT"), true);
});

test("isCategoryAllowedForType: OUTFLOW + FUEL is valid", () => {
  assert.equal(isCategoryAllowedForType("OUTFLOW", "FUEL"), true);
});

test("isCategoryAllowedForType: INFLOW + SALARY is invalid", () => {
  assert.equal(isCategoryAllowedForType("INFLOW", "SALARY"), false);
});

test("isCategoryAllowedForType: OUTFLOW + CAPITAL_CONTRIBUTION is invalid", () => {
  assert.equal(
    isCategoryAllowedForType("OUTFLOW", "CAPITAL_CONTRIBUTION"),
    false,
  );
});

test("getProductRequirementForCategory: CLIENT_PAYMENT requires a product", () => {
  assert.equal(getProductRequirementForCategory("CLIENT_PAYMENT"), "required");
});

test("getProductRequirementForCategory: CLIENT_REFUND allows an optional product", () => {
  assert.equal(getProductRequirementForCategory("CLIENT_REFUND"), "optional");
});

test("getProductRequirementForCategory: unrelated categories forbid a product", () => {
  for (const category of [
    "SALARY",
    "FUEL",
    "CAPITAL_CONTRIBUTION",
  ] as const) {
    assert.equal(getProductRequirementForCategory(category), "forbidden");
  }
});

test("isProductValidForCategory enforces the CLIENT_PAYMENT/CLIENT_REFUND/other rules", () => {
  assert.equal(isProductValidForCategory("CLIENT_PAYMENT", "KARMDA"), true);
  assert.equal(isProductValidForCategory("CLIENT_PAYMENT", null), false);
  assert.equal(isProductValidForCategory("CLIENT_PAYMENT", undefined), false);

  assert.equal(isProductValidForCategory("CLIENT_REFUND", "LOKARI"), true);
  assert.equal(isProductValidForCategory("CLIENT_REFUND", null), true);

  assert.equal(isProductValidForCategory("FUEL", null), true);
  assert.equal(isProductValidForCategory("FUEL", "KARMDA"), false);
  assert.equal(isProductValidForCategory("SALARY", "NIA"), false);
});
