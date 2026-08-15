import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ProspectWorkflowSections is a "use client" component built on
 * react-hook-form's useForm/useWatch (via its child forms) and
 * next/navigation's useRouter, which can't run outside a mounted Next.js
 * app router under plain node:test — same constraint documented in
 * component/propects/prospect-action-form.test.ts and
 * component/propects/prospect-follow-up-mini-form.test.ts. These
 * assertions run against the source directly instead of rendering the
 * component; Ticket 22C's requirement is that only one composer can ever
 * be open, which this file proves structurally (a single OpenComposer
 * state variable, not three independent booleans) rather than by
 * simulating clicks.
 */
const source = readFileSync(
  "component/propects/prospect-workflow-sections.tsx",
  "utf8",
);

test("tracks composer state with a single variable that can only ever hold one value, never three independent booleans", () => {
  assert.match(
    source,
    /type OpenComposer =\s*"ACTION"\s*\|\s*"FOLLOW_UP"\s*\|\s*"INTERACTION"\s*\|\s*null/,
  );
  assert.match(
    source,
    /const \[openComposer, setOpenComposer\] = useState<OpenComposer>\(null\)/,
  );
  // Exactly one useState call in the whole component — no parallel
  // per-form "isActionOpen"/"isFollowUpOpen"/"isInteractionOpen" booleans
  // that could drift out of sync with each other.
  assert.equal((source.match(/= useState[<(]/g) ?? []).length, 1);
});

test("starts with every composer closed", () => {
  assert.match(source, /useState<OpenComposer>\(null\)/);
});

test("toggling a composer closes it if already open, and switches to it (closing whichever else was open) otherwise", () => {
  assert.match(
    source,
    /function toggle\(target: Exclude<OpenComposer, null>\) \{\s*setOpenComposer\(\(current\) => \(current === target \? null : target\)\)/,
  );
});

test("each of the three CTAs drives the same shared toggle, never a form-local open flag", () => {
  assert.match(source, /onClick=\{\(\) => toggle\("ACTION"\)\}/);
  assert.match(source, /onClick=\{\(\) => toggle\("FOLLOW_UP"\)\}/);
  assert.match(source, /onClick=\{\(\) => toggle\("INTERACTION"\)\}/);
});

test("each composer form is gated on this component's own openComposer state", () => {
  assert.match(source, /openComposer === "ACTION"/);
  assert.match(source, /openComposer === "FOLLOW_UP" &&/);
  assert.match(source, /openComposer === "INTERACTION" &&/);
});

test("the action list itself is never gated on composer state — it stays visible regardless", () => {
  assert.doesNotMatch(
    source,
    /openComposer === "ACTION" &&\s*\(?\s*<ProspectActionList/,
  );
  assert.match(source, /^\s*<ProspectActionList\s/m);
});

test("a successful submission on any composer closes it, via the same onSuccess callback contract", () => {
  const onSuccessCalls = source.match(
    /onSuccess=\{\(\) => setOpenComposer\(null\)\}/g,
  );
  assert.equal(onSuccessCalls?.length, 3);
});

test("cancelling a composer only closes it — it never calls a mutating action", () => {
  const cancelButtons = source.match(
    /onClick=\{\(\) => setOpenComposer\(null\)\}\s*\n\s*className=\{cancelButtonClassName\}/g,
  );
  assert.equal(cancelButtons?.length, 3);
});

test("the commercial-activity CTAs are visually differentiated (primary follow-up, secondary interaction note)", () => {
  assert.match(source, /primaryCtaClassName[^]*Ajouter un suivi/);
  assert.match(source, /secondaryCtaClassName[^]*Ajouter une note d.interaction/);
});

test("the two Activité commerciale CTAs stack vertically on narrow screens", () => {
  assert.match(source, /flex flex-col gap-3 sm:flex-row/);
});

test("does not reintroduce a CommercialActivity domain model — this is presentation only", () => {
  assert.doesNotMatch(source, /CommercialActivity/);
  assert.doesNotMatch(source, /prisma\./);
});

// ---------------------------------------------------------------------------
// Ticket 22D — "+ Nouvelle action" is promoted to the primary CTA style
// ---------------------------------------------------------------------------

test("+ Nouvelle action uses the same primary CTA treatment as the rest of the app, not a bespoke understated header style", () => {
  assert.match(source, /className=\{primaryCtaClassName\}[^]*?Nouvelle action/);
  assert.doesNotMatch(source, /headerCtaClassName/);
});

test("does not invent a special color for the promoted CTA — it reuses the exact primary class shared with Ajouter un suivi", () => {
  const primaryCtaUses = source.match(/className=\{primaryCtaClassName\}/g);
  assert.equal(
    primaryCtaUses?.length,
    2,
    "both Nouvelle action and Ajouter un suivi should share the one primaryCtaClassName definition",
  );
});
