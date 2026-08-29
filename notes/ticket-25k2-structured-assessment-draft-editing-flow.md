# Ticket 25K.2 — Structured Assessment Draft Entry & Editing Flow

Implemented 2026-08-29. Closes the workflow gap between "assessment
exists" and "assessment can actually be completed." No new scoring
logic, no schema change — the audit below found that 25I/25J's own
detail components already implemented most of the anchored-option UI
this ticket asks for; the real gaps were narrower than the ticket's
length suggests.

## 1. Pre-implementation audit

Read before writing anything: both creation actions/services/cores, both
detail pages/components, both list components, both catalogs, both
Zod schemas, and `prisma/schema.prisma`'s two assessment models.

Findings that shaped everything below:

- **Creation already returns `assessmentId`.** Both
  `createRoleResponsibilityAssessmentCore`/`createProfessionalContributionAssessmentCore`
  return `{ success: true; assessmentId: string }` on success — the
  service wrappers and Server Actions just discarded it. No new
  identifier needed; the actions only needed to stop throwing it away.
- **The detail components already render real anchored options.**
  `RoleResponsibilityAssessmentDetail.tsx`/`ProfessionalContributionAssessmentDetail.tsx`
  already: render `anchorsSnapshot` text (never raw points beside a
  choice), auto-save per item on selection/blur, require an observation
  only for extreme levels via `isExtremeRoleResponsibilityLevel`/the
  `EXTREME_LEVELS` set, disable submission until every item is
  assessed, and lock into a read-only view once `status === "SUBMITTED"`.
  This is essentially §9–§22, §34–§41, and §46–§48 of the ticket,
  already shipped by 25I/25J.
- **Evaluator ownership is already a hard domain rule, not a UI
  decision to invent (§29).** `assessRoleResponsibilityItemCore`,
  `submitRoleResponsibilityAssessmentCore`, and
  `deleteRoleResponsibilityAssessmentCore` (and their 25J mirrors) all
  reject any actor whose `id` isn't the assessment's own
  `evaluatorUserId`, regardless of whether that actor could otherwise
  assess the employee. A different ADMIN cannot continue someone else's
  draft. Confirmed by the existing, passing test "only the assessment's
  own evaluator may assess its items" and "§75/§76: assessing,
  submitting, and deleting never re-fetch the employee or re-check
  anyone's current role — only identity (evaluatorUserId) and status
  are consulted" in both `*-service-core.test.ts` files.
- **The compound unique constraint already prevents double-submission
  duplicates (§5).** `@@unique([employeeUserId, periodStart, periodEnd])`
  exists on both `RoleResponsibilityAssessment` and
  `ProfessionalContributionAssessment` (`prisma/schema.prisma`). A race
  between two concurrent creates is resolved at the DB level: the
  loser's insert fails the constraint and surfaces as `CREATE_FAILED`,
  never a second row. No weakening, no new guard needed.
- **A draft can never exist for an open period (§44 doesn't apply).**
  Both create-cores reject creation outright with `PERIOD_NOT_CLOSED`
  before anything else runs. Since periods don't reopen, an *existing*
  draft's period is always already closed — the "draft exists but
  submission is blocked by an open period" scenario the ticket asks the
  UI to handle gracefully is structurally unreachable in this domain.
  Documented here rather than built as dead code.
- **Anchors are snapshotted in full at creation, not just the selected
  one (§33).** `snapshotCatalogFor` (25I) and `snapshotCatalog` (25J)
  both copy every anchor from the catalog into `anchorsSnapshot` on
  each item at create time. The detail views already read this
  snapshot, never the live catalog — a later catalog edit can't
  retroactively change what an open or historical draft is scoring
  against.
- **The real gaps:** creation dead-ends at a success message instead of
  entering the draft (§3/§4); the assessment list had no clear
  "continue"/"view" action, only "Supprimer" for drafts (§6–§8); the
  detail pages' only authorization was the coarse ADMIN/MANAGER gate —
  no per-employee view check and no ownership-aware read-only rendering
  (§27–§29); there was no explicit "Enregistrer le brouillon" affordance
  or confirmation, and no "Évaluation soumise." confirmation (§13/§37/§38).

## 2. Creation redirects into the new draft

`createRoleResponsibilityAssessmentAction`/`createProfessionalContributionAssessmentAction`
now return a dedicated result type carrying `assessmentId` on success
(`CreateRoleResponsibilityAssessmentActionResult` /
`CreateProfessionalContributionAssessmentActionResult`), rather than the
shared `{ success: true }` used by assess/submit/delete. Both creation
forms (`RoleResponsibilityAssessmentForm.tsx`/
`ProfessionalContributionAssessmentForm.tsx`) replaced their old
"reset the form, show a success message, `router.refresh()`" flow with
a single `router.push()` straight into the new draft's canonical route.
No re-lookup by employee+period+latest — the id came back from the same
call that created the row.

## 3. Canonical draft routes (unchanged, now fully wired)

25I and 25J already use distinct detail routes — preserved as-is:

```
/admin/performance-assessments/[assessmentId]                              (Role Responsibilities)
/admin/performance-assessments/professional-contribution/[assessmentId]    (Professional Contribution)
```

Every entry point that reaches a specific assessment now targets one of
these two routes and nothing else:

- Creation redirect (§2 above).
- The assessment list's row action (§4 below).
- 25K.1's dashboard "Continuer l'évaluation"/"Voir le détail" CTAs
  (`detailHrefBase` in `app/admin/performance/page.tsx`) — already
  pointed here since 25K.1; regression-tested in this ticket
  (`app/admin/performance-assessments/role-responsibility-assessment-detail-navigation.test.ts`'s
  §65 test) to confirm it still does.

There is exactly one canonical way to reach and edit a given draft.

## 4. List row actions

`RoleResponsibilityAssessmentList.tsx`/`ProfessionalContributionAssessmentList.tsx`'s
action column, previously "Supprimer"-only for drafts and empty for
submitted rows, now shows:

- **DRAFT** — a primary, filled "Continuer l'évaluation" button linking
  to the canonical detail route, plus "Supprimer" rendered as a small,
  muted text link beside it (destructive action visually subordinate,
  per §7).
- **SUBMITTED** — "Voir le détail," no delete or edit control (the
  domain already refuses to delete a submitted assessment; the UI
  doesn't offer a control that would just bounce off that check).

## 5. Detail-page authorization: closing the IDOR gap

Before this ticket, both detail pages checked only the coarse
`require*AssessmentManagementAccess()` gate (any ADMIN/MANAGER) before
loading and rendering *any* assessment by id — including, for example,
a MANAGER viewing another MANAGER's assessment, which
`canViewEmployeePerformance` has never permitted anywhere else in this
codebase. Both pages now:

1. Keep the coarse gate (proves "an ADMIN/MANAGER is signed in"), but
   capture the authenticated user's `id`, not just their role.
2. Fetch the assessment.
3. Re-check `canViewEmployeePerformance(actor.role, assessment.roleAtEvaluation)`
   — the same per-employee view authority 25K's dashboard uses — before
   rendering anything about this specific assessment. A failed check
   calls `notFound()`, not an access-denied message, so an unauthorized
   id doesn't confirm the assessment's existence (§27/§42/§43).
4. Compute `canEdit = assessment.status === "DRAFT" && actor.id === assessment.evaluatorUserId`
   and pass it to the detail component, which uses it (together with
   the existing `locked = status === "SUBMITTED"` check) to decide
   whether to render editable controls at all.

This mirrors 25I/25J's own shipped mutation policy (§28/§29) rather
than inventing a UI-level rule broader than what the Server Actions
would actually allow — a viewer with `canEdit: false` sees the exact
same read-only rendering a submitted assessment gets, plus a note
naming the actual evaluator ("Cette évaluation est en cours de
rédaction par {evaluatorName}."), instead of interactive controls that
would fail with `ACCESS_DENIED` on the first click.

`evaluator: { firstName, lastName }` was added to both
`getRoleResponsibilityAssessmentDetail`/`getProfessionalContributionAssessmentDetail`'s
top-level `select` — the only schema-adjacent change in this ticket,
and purely additive (the field already existed on the model; it just
wasn't being read at the detail granularity, only in the list query).

## 6. Save vs. submit

Both detail components lifted per-item `{ level, observation }` state
from each item card up into the parent. Per-item auto-save on selection
(non-extreme) or textarea blur (extreme, once an observation is typed)
is unchanged. On top of that, both components now expose:

- **"Enregistrer le brouillon"** — re-saves every item that currently
  has a selected level, including one picked but not yet auto-saved
  because its required observation hadn't been typed yet (previously:
  silently lost if the evaluator navigated away before blurring that
  textarea — a real, if narrow, data-loss edge case, not just a
  decorative addition). Shows "Brouillon enregistré." on success, or an
  aggregate error message with the per-item error still visible on each
  affected item card.
- **"Soumettre l'évaluation de {employee}"** — unchanged behavior
  (disabled until every item is assessed, calls the existing submit
  action), now also sets a `justSubmitted` flag so the resulting
  read-only view shows "Évaluation soumise." once, distinguishing "you
  just did this" from "this was submitted at some point in the past."

Saving never sets `submittedAt`, never freezes the assessment, and
never turns the score authoritative — it only calls the existing
per-item assess action, which the domain already refuses once
`status === "SUBMITTED"`.

## 7. Read-only / submitted view

Unchanged from 25I/25J except for two additions: the evaluator's name
("Évaluée par {evaluatorName}") and, immediately after a fresh
submission in the same session, "Évaluation soumise." Selected anchors,
observations, and the score remain exactly as 25I/25J already rendered
them — read-only inputs, no `Modifier`/`Resoumettre` control.

## 8. Return navigation

25K.1 already added "Retour à la vue d'ensemble," built from the
assessment's own `employeeUserId`/`periodStart` (no forwarded
`returnUrl`). Unchanged and re-verified by this ticket's tests; nothing
new was needed here.

## 9. Mobile / accessibility

Already compliant before this ticket: anchors render as a single
vertical `space-y-2` stack (never a multi-column grid), each choice is
an `<input type="radio">` wrapped by a `<label htmlFor>` covering the
full behavioral text (not color-only selection), and the observation
`<textarea>` already had an associated `<label>`. The one adjustment
made here: each radio now has an explicit `id`/`htmlFor` pair
(`${item.id}-${anchor.level}`) instead of relying on implicit
label-wraps-input association, since the item card is no longer the
sole owner of its own DOM in the lifted-state refactor.

## 10. No schema or scoring changes

`prisma/schema.prisma` and `prisma/migrations/` are untouched. The only
service-layer change is the additive `evaluator` select field (§5). No
formula in Commercial Results, Execution Discipline, Role Responsibility
scoring, Professional Contribution scoring, or the /100 composition was
touched.

## 11. A testing-infrastructure finding worth recording

Two of this ticket's new page-level test files were first written
*inside* the `[assessmentId]` dynamic-route directories they test. Node's
test runner interprets `[...]` in a file path passed directly as a CLI
argument as a glob character class, not a literal folder name — a test
file placed inside a bracketed route directory silently matches zero
files and never runs, with no error, no matter how the shell quotes it.
Both files were moved to
`app/admin/performance-assessments/role-responsibility-assessment-detail-navigation.test.ts`
and
`app/admin/performance-assessments/professional-contribution-assessment-detail-navigation.test.ts`
(flat paths, no brackets); `readFileSync` has no such restriction, so
they still read the real bracketed page files by their literal path.
Confirmed no other test file in the repo lives inside a bracketed
directory.

## 12. Verification

`npx tsc --noEmit`, full `npm test` (2002 tests; the one pre-existing,
unrelated `Sidebar.test.tsx` "Rapports quotidiens" failure — confirmed
via `git stash` in the prior ticket to predate this session — is the
only failure), `npx eslint .` (clean), `npm run build` (clean),
`git diff --check` (no whitespace issues), then unstaged per this
session's convention of leaving verified work uncommitted until
explicitly requested. No real assessment was created against live data
to verify this ticket — coverage is unit/component/source-regex tests
plus the pre-existing, already-passing 25I/25J domain test suites.

## 13. Acceptance walkthrough (traced through the code, not run against a live DB)

1. ADMIN opens `/admin/performance`, selects an employee and a closed
   month, clicks "Évaluer les responsabilités" → lands on
   `/admin/performance-assessments?employeeId=…&year=…&month=…#role-responsibility`
   with the create form pre-filled (25K.1).
2. Clicks "Créer l'évaluation" → `createRoleResponsibilityAssessmentAction`
   returns `{ success: true, assessmentId }` → the form calls
   `router.push('/admin/performance-assessments/' + assessmentId)` —
   the evaluator is now on the draft, not back at a success banner.
3. Sees the real responsibility label/description and its four
   anchored behavioral descriptions (never bare `0/10/17/20`).
4. Selects a level; if extreme, the observation textarea appears and
   auto-saves on blur once non-empty; otherwise it auto-saves
   immediately.
5. Clicks "Enregistrer le brouillon" → "Brouillon enregistré." appears;
   the page stays on the same draft.
6. Once every item has a level, "Soumettre l'évaluation de {employee}"
   becomes enabled; clicking it submits, and the same page re-renders
   read-only with the score, "Évaluée par {evaluator}," and "Évaluation
   soumise."
7. "Retour à la vue d'ensemble" returns to `/admin/performance` with
   the same employee/period, now showing the submitted `/20` and a
   "Voir le détail" link instead of a CTA.
8. The same sequence, mirrored, for "Contribution professionnelle,"
   surfaces the three 25J traits and their five BARS choices each.
