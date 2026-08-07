import assert from "node:assert/strict";
import test from "node:test";

import { formatXofAmount } from "./financial-ledger-format";

test("formats a whole-CFA Decimal string with thousands separators", () => {
  assert.equal(formatXofAmount("150000.00"), "150 000 CFA");
});

test("formats small amounts without separators", () => {
  assert.equal(formatXofAmount("1000.00"), "1 000 CFA");
  assert.equal(formatXofAmount("999.00"), "999 CFA");
});

test("formats zero", () => {
  assert.equal(formatXofAmount("0.00"), "0 CFA");
});

test("formats negative balances with a leading minus sign", () => {
  assert.equal(formatXofAmount("-25000.00"), "-25 000 CFA");
});

test("formats very large amounts without precision loss", () => {
  assert.equal(
    formatXofAmount("123456789012345.00"),
    "123 456 789 012 345 CFA",
  );
});

test("ignores decimal fraction digits for the CFA display", () => {
  assert.equal(formatXofAmount("150000.50"), "150 000 CFA");
});
