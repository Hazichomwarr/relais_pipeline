# Ticket 28C — Management Reassignment Workflow + Read-Only Prospect Parity

Shipped: 2026-09-05. Exposes 28B's assignment-transfer domain through a
management UI, and closes the LOKARI/NIA read-only parity gap 28A found.
No schema change, no migration, no new domain semantics — every rule this
ticket enforces was already frozen by 28A/28B/28A.1.

## 1. UI entry points

- **Management**: `/admin/prospects/[id]` — the existing management
  detail page. No new `/admin/reassignments/...` subsystem.
- **Commercial-facing read-only**: `/schools/[id]` (KARMDA, existing),
  `/products/digital-services/[id]` (existing), and two new routes —
  `/products/lokari/[id]` and `/products/nia/[id]`.
- **Commercial-facing operational**: `/dashboard/commercial/prospects/[id]`
  (existing, unchanged authority — now also shows "Responsable du suivi"
  informationally).

## 2. Management reassignment flow

`ProspectResponsibilitySection` (new) renders on `/admin/prospects/[id]`:
one heading ("Responsable du suivi"), the current assignee's name + role
(+ "Inactif" if applicable), and a single secondary "Réassigner" action
("Assigner un responsable" when currently unassigned — same 28B operation
either way, `fromUserId: null` is a real transition, never a special case).

`ReassignProspectDialog` (new) is the accessible dialog: current
responsible (context only, not selectable as a target), a `<select>`
populated by `listProspectReassignmentEligibleUsers()` (new — active
ADMIN/MANAGER/COMMERCIAL, excluding the current assignee at render time),
a required reason textarea, Annuler/Confirmer. It calls the existing 28B
`reassignProspectAction` directly — no new mutation, no second transfer
service, no direct `assignedUserId` write anywhere in this ticket
(verified by source-string regression tests).

`ProspectAssignmentHistory` (new) is a compact `<details>` disclosure
below the responsibility section, newest-first (28B's
`getProspectAssignmentTransfers` already orders this way): from → to,
occurred-at, changed-by, reason. Zero rows renders "Aucune réaffectation
enregistrée." — truthfully, never implying the prospect was never
assigned; a `null` `fromUser` renders "Aucun responsable", never an
invented prior owner.

## 3. "Responsable du suivi" terminology

Replaces "Commercial assigné" everywhere a current assignee is shown —
28B correctly allows active ADMIN/MANAGER/COMMERCIAL as assignees, so the
old wording misdescribes a management-owned prospect. A new
`getResponsibleUserDisplay()` helper (`src/lib/prospect-responsible-
display.ts`) answers this truthfully and is deliberately distinct from
the existing `getAssignedUserName()` (which intentionally falls back to
the legacy `agentName` text for list rows — untouched, still used
everywhere it already was). `ResponsibleUserInfo`/`ReadOnlyNotice`
(new, in `prospect-detail-sections.tsx`) render this consistently across
every detail/summary page. A null-owner prospect shows "Aucun responsable
actuellement", never a stale agent-name string mistaken for a real
assignee.

`school-directory.service-core.ts`'s presented item gained a `responsible`
field (the truthful representation) alongside the existing
`commercialName` (unchanged, still used by the directory cards) — the two
answer different questions and are not merged.

## 4. Error/conflict UX

28B's `reassignProspectAction` was widened (additively — only a new
optional `code` field) to return its domain `ReassignProspectErrorCode`
alongside the message, so the UI can branch without parsing text. A new
pure, independently-tested mapping —
`resolveReassignProspectErrorPresentation()`
(`src/lib/reassign-prospect-error-presentation.ts`) — turns each code into
deliberate UX:

| Code(s) | UI behavior |
| --- | --- |
| `CONCURRENTLY_REASSIGNED` | Exact required copy ("Ce prospect a été réassigné pendant que vous le consultiez...") + `router.refresh()` + clears the selected target — never a silent retry, never a generic "une erreur est survenue" |
| `TARGET_NOT_FOUND` / `TARGET_INACTIVE` / `TARGET_ROLE_NOT_ELIGIBLE` | "Cette personne ne peut plus recevoir ce prospect..." + refresh (target list re-renders with fresh server props on the next request) |
| `SAME_ASSIGNEE` | "Cette personne est déjà responsable de ce prospect." — never shown as success, never a fabricated history event (the client also disables this by excluding the current assignee from the picker, but the server remains authoritative regardless) |
| Everything else (`PROSPECT_NOT_FOUND`, `ACTOR_*`, `INVALID_REASON`, `REASSIGN_FAILED`) | 28B's own message verbatim — already truthful, French, and non-technical; no Prisma/transaction detail ever reaches this far |

The dialog only shows a success acknowledgement ("Suivi réassigné à
{name}.") after the server call resolves — never optimistically — and
closes only via the user's own "Fermer" click on success, or "Annuler"
with no write. This exact sequencing is enforced by a source-string
regression test (index-order check on `await`/`setSuccess`, and a check
that `handleConfirm` never itself calls `setOpen(false)`).

## 5. Management history visibility (Commercial privacy boundary)

`getProspectAssignmentTransfers` (28B) is unscoped by role in its own
file, by design — the caller must gate it. The only caller is
`/admin/prospects/[id]`, already behind `requireRole("ADMIN", "MANAGER")`
before any of this data is fetched (verified: the authorization call's
source index precedes the history-fetch index). `ProspectAssignmentHistory`
and `ReassignProspectDialog` are never imported by any Commercial-facing
page — verified by an explicit regression test enumerating every such
page (`/dashboard/commercial/prospects/[id]`, `/schools/[id]`,
`/products/digital-services/[id]`, `/products/lokari/[id]`,
`/products/nia/[id]`) and asserting none of them reference these
components or `getProspectAssignmentTransfers`. Transfer *reason* — which
may carry personnel context — never reaches a Commercial-facing surface
in this ticket.

## 6. Canonical prospect access policy

The 28A audit found four independent functions computing overlapping
navigation decisions: `resolveGenericProductDetailHref`,
`resolveSchoolDetailHref`, `resolveSharedFeedProspectHref`, and
`resolveProspectActionQueueProspectHref`. All four are gone or reduced to
a zero-branching delegate:

- `src/lib/generic-product-directory-navigation.ts`,
  `school-directory-navigation.ts`, and `shared-feed-prospect-
  navigation.ts` are **deleted**; every call site now calls the new
  canonical `resolveProspectAccess()` (`src/lib/prospect-access.ts`)
  directly.
- `resolveProspectActionQueueProspectHref` (in
  `prospect-action-queue.service-core.ts`) is **kept** as an exported name
  (its own module's internal callers reference it), but its body is now
  exactly `return resolveProspectAccess(viewer, prospect).detailHref;` —
  no product-specific branching remains.

`resolveProspectAccess(viewer, prospect)` returns a discriminated
`ProspectAccess` (`MANAGEMENT | OWNER | READ_ONLY | NONE`), each carrying
`detailHref`, `canOperate`, and `canReassign` — semantics, not just a URL.
This is presentation/navigation policy only; it grants no mutation
authority itself (§42 of the ticket) — every existing ownership-scoped
Server Action/service was left untouched and re-derives its own
authorization from the database exactly as before. Covered by a 27-case
exhaustive matrix test (every role × every product × owner/non-owner).

## 7. KARMDA / Digital Services behavior — unchanged, reconfirmed

Owner Commercial keeps the existing operational route
(`/dashboard/commercial/prospects/[id]`); non-owner Commercial keeps the
existing read-only route (`/schools/[id]`, `/products/digital-services/
[id]`). Only the copy changed (terminology + the compact `ReadOnlyNotice`,
replacing the old inline "Consultation uniquement"/"Cette école appartient
à un autre commercial" text) — no routing or authorization change. Existing
test suites for both, updated only where they asserted the old copy or
the old navigation function name, otherwise untouched and still passing.

## 8. New LOKARI / NIA read-only behavior

`/products/lokari/[id]` and `/products/nia/[id]` (new) mirror the Digital
Services precedent exactly: `getLokariProspectById`/`getNiaProspectById`
(both thin wrappers around one new parametrized
`getGenericProductProspectById(product, id)`, since LOKARI/NIA share
identical shape and never had their own directory service) scope every
query by product — a KARMDA/Digital-Services/other-product id can never
resolve here, confirmed by tests and mirrored by an identical
not-found.tsx per route ("also served for a wrong-product id", never
revealing cross-product existence). Reachable by any authorized Commercial
directly (not only via a directory link) — ADMIN/MANAGER and an owning
Commercial are still routed to their own pages by `resolveProspectAccess`;
landing here directly is harmless, same read-only render. Zero mutation
controls, zero management-only data. The directory list pages
(`/products/lokari`, `/products/nia`) now resolve every row's `detailHref`
through `resolveProspectAccess` — a non-owner row is no longer a dead end.

## 9. Action-queue link behavior

`ProspectAction.assignedToUserId` and `Prospect.assignedUserId` remain
independent axes (28A/28B, untouched). After this ticket, a Commercial
who still holds an OPEN action on a prospect they no longer own gets a
working `prospectHref` — the product's read-only summary — instead of
`null`. This is the strongest practical case for why parity mattered:
before 28C, LOKARI/NIA actions pointed nowhere for a non-owner assignee;
now they point somewhere true. Verified by updating the two existing
"gets no link" tests in `prospect-action-queue.service-core.test.ts` to
assert the new read-only routes instead.

## 10. Updates-feed link behavior

Feed *visibility* is unchanged (still company-wide by role, per 18A/18B —
not touched in this ticket). Only the per-item `prospectHref` changed,
via the same canonical `resolveProspectAccess` swap in
`SharedFeedItemCard.tsx`: a non-owner Commercial viewing a
DIGITAL_SERVICES/LOKARI/NIA feed item now gets that product's read-only
link instead of `null` (DIGITAL_SERVICES specifically had been an
inconsistency even before this ticket — the old
`resolveSharedFeedProspectHref` only special-cased KARMDA, so a foreign
Digital Services item got no link from the feed even though the directory
itself already supported one; this is now unified).

## 11. Former-owner / new-owner scenarios

**Former owner** (e.g. Jean, reassigned away from a LOKARI prospect):
loses owner-only mutation authority the instant the ownership-scoped
services re-derive current state (already true since 28A/28B — untouched
here) — but is never stranded: navigating there again (directory, feed,
action queue, or a pasted URL) now resolves to the read-only summary via
`resolveProspectAccess`, not a dead end. No special "former owner"
permission is granted; they are simply a non-owner Commercial like any
other.

**New owner** (Amidou): `resolveProspectAccess` resolves `OWNER` for them
immediately once `Prospect.assignedUserId` reflects the transfer — no new
login, no cache to bust beyond the existing `router.refresh()`/
`revalidatePath` calls already present in `reassignProspectAction`.

Both are proven together by the "Final domain test" in
`prospect-assignment-transfer-regression.test.ts` (28B) plus this ticket's
own access-policy matrix — no new integration test duplicates that
narrative; composing the two proves the full story.

## 12. No domain change — confirmed

No Prisma schema edit, no migration (`prisma migrate status`: 23
migrations, unchanged). `reassignProspectAction`'s only change was
additive (a `code` field alongside the existing `message`). No new
eligibility rule, no new concurrency strategy, no new target-eligibility
predicate — `listProspectReassignmentEligibleUsers` reuses
`PROSPECT_OWNER_ROLES` (the same constant 28B's
`canReceiveProspectAssignment` composes with `active`), kept as its own
query rather than reused from `listActiveUsersForTaskAssignment` for the
same "coincidental value overlap, different domain decision" reason this
codebase already documents on `listCommercialResultsTargetEligibleUsers`.

## 13. Tests

- `src/lib/prospect-access.test.ts` — 27 tests, the exhaustive access
  matrix (§6 above).
- `src/lib/prospect-responsible-display.test.ts` — 5 tests.
- `src/lib/reassign-prospect-error-presentation.test.ts` — 12 tests, the
  full error-code mapping.
- `app/products/lokari-nia-summary.test.ts` — 22 tests, mirroring
  `digital-services-summary.test.ts`'s exact assertions for both new
  routes.
- `component/propects/ProspectAssignmentHistory.test.tsx` — 5 real render
  tests (this component has no server-only import chain).
- `component/propects/prospect-responsibility-ui.test.ts` — 9
  source-string tests for `ReassignProspectDialog`/
  `ProspectResponsibilitySection` (both transitively import server-only
  code via the Server Action, so — like every page/action file in this
  repo — they're asserted against source, not rendered).
- `app/admin/prospects/prospect-detail-reassignment.test.ts` — 8 tests:
  authorization order, the new fetches, the new sections rendered, no
  direct `assignedUserId` write, the old header/InfoField gone, and the
  Commercial-privacy-boundary regression (§5 above).
- Updated existing tests: `school-directory.service-core.test.ts` and
  `SchoolDirectoryCards.test.tsx` (new `responsible` field),
  `digital-services-summary.test.ts` (new terminology assertion),
  `generic-directories.test.ts` and `digital-services-directory.test.ts`
  (canonical resolver assertion), `prospect-action-queue.service-core.test.ts`
  (LOKARI/NIA now resolve to real routes), `SharedFeedItemCard.test.tsx`
  (same), `updates-privacy-regression.test.ts` (file-list update after the
  navigation-helper deletion), `authorization.service.test.ts` (added to
  the existing per-constant role-matrix loop for
  `PROSPECT_REASSIGNMENT_ROLES` — already added in 28B, unchanged here).

Full suite: 2552/2552 passing. `tsc --noEmit`: clean. `eslint .`: clean.
`next build`: succeeds, including the two new routes. `prisma migrate
status`: unchanged at 23 migrations. `git diff --check`: clean.

## 14. Visual verification

Per this repo's standing security rule, an authenticated live session
cannot be created by mutating a real account's role/password hash, and no
dedicated test identity was provisioned as its own task — the same
constraint 27F/27G/27H already documented for this project, where live-QA
was offered and declined twice. No browser/screenshot tool was available
to this session either way.

What was actually performed: a structural code-level review of every new/
changed component (`ReassignProspectDialog`, `ProspectResponsibilitySection`,
`ProspectAssignmentHistory`, `ReadOnlyNotice`, `ResponsibleUserInfo`, and
the two new LOKARI/NIA pages) for text-overflow risk on long names/reasons,
responsive-breakpoint coherence reasoned from the Tailwind classes
themselves (320/375/768px), empty-state paths, dialog usability at 375px,
and icon-only-control labeling. Three real issues were found and fixed:

1. **`ReassignProspectDialog`**'s "Responsable actuel" row used
   `flex items-center justify-between` with no wrap allowance — a long
   current-assignee name could compress or overflow at 375px. Fixed:
   `flex-wrap`, `shrink-0` on the label, `break-words` on the name.
2. **`ProspectResponsibilitySection`**'s header text block had no
   `min-w-0` inside its `flex-wrap` container — a long name/role combo
   could force horizontal overflow before wrapping. Fixed: `min-w-0` on
   the wrapper, `break-words` on the responsible-info paragraph.
3. **`ProspectAssignmentHistory`**'s `<summary>` stripped the native
   disclosure marker (`marker:content-none`) without adding a replacement
   — the section would have looked like plain, non-interactive text with
   no visible affordance that it expands. Fixed: added a `ChevronDown`
   icon that rotates on open (`group-open:rotate-180`).

This is a structural-review finding list, not a claim of rendered/pixel
confirmation in a real browser at any breakpoint.

## 15. Production safety

No live prospect was reassigned against the shared database. No account
was activated/deactivated, no role changed, no fake transfer/WON/LOST
history created. The only prior write in this ticket's lineage was 28B's
own migration (unrelated to this ticket, which made none). All
verification here was test execution, static analysis, and source review
— no mutation of real data occurred.

## 16. Explicit non-goals confirmed absent

No takeover-request CTA/schema/workflow, no inactive-owner recovery
queue/filter/dashboard, no bulk reassignment, no notification system, no
`/updates` transfer event, no analytics/performance semantic change —
all grepped for and confirmed absent. 28D (takeover requests) and 28E
(inactive-owner recovery) can both build on this ticket without first
fixing any missing read-only route or ownership-navigation inconsistency.
