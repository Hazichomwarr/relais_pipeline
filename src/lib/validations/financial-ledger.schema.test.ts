import assert from "node:assert/strict";
import test from "node:test";

import {
  financialLedgerEntrySchema,
  reverseLedgerEntrySchema,
} from "./financial-ledger.schema";

function validInflow(overrides: Record<string, unknown> = {}) {
  return {
    type: "INFLOW",
    category: "CLIENT_PAYMENT",
    amount: "300000",
    counterpartyName: "Groupe scolaire Horizon",
    reason: "Premier paiement annuel KARMDA",
    paymentMethod: "MOBILE_MONEY",
    occurredAt: new Date().toISOString().slice(0, 10),
    product: "KARMDA",
    ...overrides,
  };
}

function validOutflow(overrides: Record<string, unknown> = {}) {
  return {
    type: "OUTFLOW",
    category: "FUEL",
    amount: "25000",
    counterpartyName: "Julbert Serme",
    reason: "Carburant pour la prospection terrain",
    paymentMethod: "CASH",
    occurredAt: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
}

test("accepts a valid inflow with a required product", () => {
  const result = financialLedgerEntrySchema.safeParse(validInflow());
  assert.equal(result.success, true);
});

test("accepts a valid outflow without a product", () => {
  const result = financialLedgerEntrySchema.safeParse(validOutflow());
  assert.equal(result.success, true);
});

test("defaults currencyCode to XOF when omitted", () => {
  const result = financialLedgerEntrySchema.parse(validOutflow());
  assert.equal(result.currencyCode, "XOF");
});

test("rejects a non-XOF currency", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ currencyCode: "USD" }),
  );
  assert.equal(result.success, false);
});

test("category/type compatibility: rejects INFLOW + SALARY", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validInflow({ category: "SALARY", product: undefined }),
  );
  assert.equal(result.success, false);
});

test("category/type compatibility: rejects OUTFLOW + CLIENT_PAYMENT", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ category: "CLIENT_PAYMENT", product: "KARMDA" }),
  );
  assert.equal(result.success, false);
});

test("category/type compatibility: rejects OUTFLOW + CAPITAL_CONTRIBUTION", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ category: "CAPITAL_CONTRIBUTION" }),
  );
  assert.equal(result.success, false);
});

test("product rule: CLIENT_PAYMENT requires a product", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validInflow({ product: undefined }),
  );
  assert.equal(result.success, false);
});

for (const product of ["KARMDA", "LOKARI", "NIA", "DIGITAL_SERVICES"]) {
  test(`product rule: CLIENT_PAYMENT accepts ${product}`, () => {
    const result = financialLedgerEntrySchema.safeParse(
      validInflow({ product }),
    );
    assert.equal(result.success, true);
  });
}

test("product rule: FUEL with a product is rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ product: "KARMDA" }),
  );
  assert.equal(result.success, false);
});

test("product rule: SALARY with a product is rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ category: "SALARY", product: "KARMDA" }),
  );
  assert.equal(result.success, false);
});

test("product rule: CAPITAL_CONTRIBUTION with a product is rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validInflow({ category: "CAPITAL_CONTRIBUTION", product: "KARMDA" }),
  );
  assert.equal(result.success, false);
});

test("product rule: CLIENT_REFUND may carry a product", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ category: "CLIENT_REFUND", product: "LOKARI" }),
  );
  assert.equal(result.success, true);
});

test("product rule: CLIENT_REFUND may omit a product", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ category: "CLIENT_REFUND" }),
  );
  assert.equal(result.success, true);
});

test("amount: positive whole XOF integer accepted", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "20000" }),
  );
  assert.equal(result.success, true);
});

test("amount: zero rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "0" }),
  );
  assert.equal(result.success, false);
});

test("amount: negative rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "-1000" }),
  );
  assert.equal(result.success, false);
});

test("amount: decimal CFA rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "1000.50" }),
  );
  assert.equal(result.success, false);
});

test("amount: malformed number rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "abc" }),
  );
  assert.equal(result.success, false);
});

test("amount: missing amount rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "" }),
  );
  assert.equal(result.success, false);
});

test("amount: very large supported value accepted and stays a precise string", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "9999999999999999" }),
  );
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.amount, "9999999999999999");
  }
});

test("amount: value beyond the Decimal(18,2) integer capacity rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ amount: "99999999999999999" }),
  );
  assert.equal(result.success, false);
});

test("counterpartyName: too short rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ counterpartyName: "A" }),
  );
  assert.equal(result.success, false);
});

test("counterpartyName: too long rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ counterpartyName: "A".repeat(151) }),
  );
  assert.equal(result.success, false);
});

test("reason: too short rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ reason: "ab" }),
  );
  assert.equal(result.success, false);
});

test("reason: too long rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ reason: "a".repeat(1001) }),
  );
  assert.equal(result.success, false);
});

test("paymentMethod: required", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ paymentMethod: "" }),
  );
  assert.equal(result.success, false);
});

test("paymentMethod: invalid value rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ paymentMethod: "ORANGE_MONEY" }),
  );
  assert.equal(result.success, false);
});

test("reference: blank normalizes to undefined", () => {
  const result = financialLedgerEntrySchema.parse(
    validOutflow({ reference: "   " }),
  );
  assert.equal(result.reference, undefined);
});

test("reference: too long rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ reference: "a".repeat(151) }),
  );
  assert.equal(result.success, false);
});

test("occurredAt: required", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ occurredAt: "" }),
  );
  assert.equal(result.success, false);
});

test("occurredAt: invalid date rejected", () => {
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ occurredAt: "not-a-date" }),
  );
  assert.equal(result.success, false);
});

test("occurredAt: same-day entry accepted", () => {
  const today = new Date().toISOString().slice(0, 10);
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ occurredAt: today }),
  );
  assert.equal(result.success, true);
});

test("occurredAt: unreasonably far in the future rejected", () => {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const result = financialLedgerEntrySchema.safeParse(
    validOutflow({ occurredAt: nextYear.toISOString().slice(0, 10) }),
  );
  assert.equal(result.success, false);
});

test("never accepts createdByUserId, status, or reversalOfId — those come from the trusted server workflow", () => {
  assert.deepEqual(
    Object.keys(financialLedgerEntrySchema.shape).sort(),
    [
      "amount",
      "category",
      "counterpartyName",
      "currencyCode",
      "occurredAt",
      "paymentMethod",
      "product",
      "reason",
      "reference",
      "type",
    ].sort(),
  );
});

test("submitting createdByUserId/status/reversalOfId is silently dropped, not honored", () => {
  const result = financialLedgerEntrySchema.safeParse({
    ...validOutflow(),
    createdByUserId: "attacker-controlled",
    status: "REVERSED",
    reversalOfId: "some-other-entry",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal("createdByUserId" in result.data, false);
    assert.equal("status" in result.data, false);
    assert.equal("reversalOfId" in result.data, false);
  }
});

test("reverseLedgerEntrySchema requires entryId and a reason", () => {
  const valid = reverseLedgerEntrySchema.safeParse({
    entryId: "entry-1",
    reason: "Erreur de saisie sur le montant",
  });
  const missingEntry = reverseLedgerEntrySchema.safeParse({
    entryId: "",
    reason: "Erreur de saisie sur le montant",
  });
  const shortReason = reverseLedgerEntrySchema.safeParse({
    entryId: "entry-1",
    reason: "ab",
  });

  assert.equal(valid.success, true);
  assert.equal(missingEntry.success, false);
  assert.equal(shortReason.success, false);
});
