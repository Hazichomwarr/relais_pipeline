import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ReverseLedgerEntryForm is a "use client" component built on
 * next/navigation's useRouter, which can't run outside a mounted Next.js
 * app router under plain node:test — same constraint as LedgerEntryForm.
 * These assertions run against the source directly instead.
 */
const source = readFileSync(
  "component/finances/ReverseLedgerEntryForm.tsx",
  "utf8",
);

test("submits through reverseLedgerEntryAction, never a direct service or Prisma call", () => {
  assert.match(source, /reverseLedgerEntryAction\(/);
  assert.doesNotMatch(source, /prisma\./);
});

test("requires a non-trivial reason before the confirm button is enabled", () => {
  assert.match(source, /reason\.trim\(\)\.length < 3/);
});

test("uses the required confirmation copy and never says Supprimer/delete", () => {
  assert.match(source, /Annuler cette écriture financière \?/);
  assert.match(
    source,
    /L’écriture originale restera dans l’historique et une\s*\n?\s*écriture inverse sera créée pour corriger le solde\./,
  );
  assert.match(source, /Motif de l’annulation/);
  assert.doesNotMatch(source, /Supprimer/);
});

test("confirmation dialog is a modal with a labelled heading (accessibility)", () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="reverse-entry-dialog-title"/);
  assert.match(source, /id="reverse-entry-dialog-title"/);
});

test("shows a success confirmation once the balance has been corrected", () => {
  assert.match(
    source,
    /L’écriture a été annulée et le solde a été corrigé\./,
  );
});
