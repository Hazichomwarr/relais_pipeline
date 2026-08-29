# Ticket 25N — Assistant Finance Access & Authorization

Implemented 2026-08-29. Finance is now an explicit `ADMIN + ASSISTANT`
capability across every real Finance boundary — route reads, both
mutations, navigation (desktop + mobile), and the Assistant landing
route. `requireAdmin()` itself is untouched and re-proven ADMIN-only. No
schema change; 25M's `UserRole.ASSISTANT` migration remains the
deployment prerequisite, still undeployed in this environment.

## 1. Pre-implementation Finance mutation audit

Read every file under `app/finances/**`, `src/services/financial-ledger.*`,
`src/services/financial-report.*`, and `src/actions/financial-ledger.actions.ts`
before changing anything. Findings:

**The entire mutation surface is exactly two Server Actions:**
`createLedgerEntryAction` and `reverseLedgerEntryAction`
(`financial-ledger.actions.ts`), both gated by `requireAdmin()` before
this ticket. No edit, no delete, no payment-method mutation, no
import/export write exists anywhere in the codebase — confirmed by
grepping the entire finance domain for `role`/`actor`/mutation verbs.

**Authorization lives at exactly one layer.** Neither
`financial-ledger.service-core.ts` nor `financial-report.service-core.ts`
contains any authorization concept at all — no `role`, no `actor`, no
`AuthorizationError`. All enforcement is at the Server Action / page
layer; the domain core is, and remains, pure arithmetic and pure reads.

**Every read/report function is already role-blind by signature**:
`listLedgerEntriesCore`, `getLedgerEntryByIdCore`,
`getFinancialLedgerSummaryCore`, `getEffectiveFinancialLedgerSummaryCore`,
and `computeFinancialReportCore` accept filters/entries/periods — never a
role or actor. There was structurally no way for a report to have been
forked by role even before this ticket.

**Actor attribution was already identity-based, never hardcoded.**
`createdByUserId`/`reversedByUserId` are threaded straight from
`authorization.user.id` (whoever actually authenticated) through to the
Prisma write — confirmed by the pre-existing "never accepts a
creator/reverser id from client input" test. Granting Assistant access
required zero attribution changes: an Assistant's entry is created with
the Assistant's own id, exactly as an Admin's already was.

**Classification (§14 of the ticket): Category A only.** Record
income/expense, view ledger, view reports, reverse an erroneous
transaction — all operational accounting. No Category B (global finance
configuration, structural category management, destructive maintenance)
operation exists to invent or preserve as ADMIN-only. This settles §15's
question directly: Assistant gets full operational authority, not a
read-only reduction, because there is no narrower "safe" subset to carve
out — the audit found one policy, not two.

## 2. The Finance capability

One constant, one wrapper — no read/write split, because the audit found
no distinct policies to justify one (§31/§32):

```ts
// src/services/authorization.service-core.ts
export const FINANCE_ACCESS_ROLES: UserRole[] = ["ADMIN", "ASSISTANT"];

// src/services/authorization.service.ts
export async function requireFinanceAccess() {
  return requireRole(...FINANCE_ACCESS_ROLES);
}
```

Positive capability, not a negative exclusion (`role !== "MANAGER" &&
role !== "COMMERCIAL"`) — the ticket's own §3, restated: this constant
means "ADMIN and ASSISTANT may access Finance," never "everyone except
these two." Matters concretely once role authority moves onto
`OrganizationMembership` in Phase 26, where an exclusion-based check
would silently misbehave for any role added after it was written; an
allow-list simply doesn't include a new role until someone decides it
should.

## 3. `requireAdmin()` — untouched, re-verified

`requireAdmin()` still wraps `requireRole("ADMIN")` — a literal
single-role list, unchanged. No repository-wide `requireAdmin →
requireFinanceAccess` replacement was made or considered; only the
Finance-domain call sites below changed. A new, explicit regression
(`authorization.service.test.ts`) proves ADMIN still succeeds and
ASSISTANT (along with MANAGER/COMMERCIAL) is still denied through the
*real* `["ADMIN"]` shape — not a simulated one, since 25M had temporarily
tested this against a stand-in "Finance-shaped" array before Finance
access actually existed. That stand-in test is now retired in favor of
testing the genuine `requireAdmin()` boundary and the genuine
`FINANCE_ACCESS_ROLES` capability side by side.

## 4. Layout and route authorization

| Boundary | Before | After |
|---|---|---|
| `app/finances/layout.tsx` (all of `/finances/**`) | `requireAdmin()` | `requireFinanceAccess()` |
| `app/finances/new/page.tsx` (its own explicit gate, on top of the layout) | `requireAdmin()` | `requireFinanceAccess()` |
| `app/finances/reports/page.tsx` | inherits the layout gate, no own check | inherits the layout gate, no own check — automatically covered |
| `app/finances/ledger/[entryId]/page.tsx` | inherits the layout gate; own `canReverse` UI boolean checked `role === "ADMIN"` | inherits the layout gate; `canReverse` now checks `role === "ADMIN" || role === "ASSISTANT"` |
| `app/finances/page.tsx`'s `canCreate` UI boolean | `role === "ADMIN"` | `role === "ADMIN" || role === "ASSISTANT"` |

No route bypasses the shared layout boundary — `/finances/reports` was
the one route relying entirely on inherited authorization, confirmed
correct by its own comment and left as-is; it needed no code change
because the layout it inherits from is the thing that changed.

Both UI-visibility booleans (`canCreate`, `canReverse`) are exactly
that — presentation only. Mutation authorization is never trusted from
them; it's re-checked independently at the Server Action layer (§19,
below), same defense-in-depth pattern this codebase uses everywhere
else.

Three stale doc comments 25L had already flagged (claiming the layout
"already ran `requireRole(\"ADMIN\", \"MANAGER\")`" — a leftover from
before Ticket 20G.1 tightened Finance to ADMIN-only) were corrected while
touching these exact lines, since leaving them stale through a *second*
boundary change would have made them actively more misleading.

## 5. Mutation authorization

`financial-ledger.actions.ts`'s two Server Actions now call
`requireFinanceAccess()` in place of `requireAdmin()` — the only change
needed, since the domain core underneath has no authorization concept to
touch and attribution was already identity-based (§1). Reversal is
granted the identical capability as creation (§21): the audit found no
domain rule distinguishing "may create" from "may reverse" beyond the
existing `status === "POSTED" && reversalOfId === null` eligibility check
on the target entry, which is unchanged. No separate deletion mechanism
was added for Assistant; reversal remains the only correction mechanism,
exactly as it already was for ADMIN.

Provenance is truthful by construction, not by new code: an Assistant's
created entry has `createdByUserId` = the Assistant's own id; an
Assistant's reversal has the Assistant as `reversedByUserId`
(surfaced as `createdByUserDisplayName` on the resulting reversal row).
The original entry's own creator field is never rewritten — reversal
only ever adds a new row and flips the original's `status`, per the
existing, untouched domain rule.

## 6. Reports and arithmetic — unchanged, proven unchanged

New regression tests confirm what the audit already found: neither the
ledger summary functions nor `computeFinancialReportCore` accept a role
or actor parameter at all, and none of these files reference `UserRole`
anywhere. This is not a new invariant introduced by 25N — it's the
pre-existing shape of the domain, now locked in with an explicit test so
a future change can't accidentally introduce role-forked arithmetic
without immediately failing a test that says so in its own name. The
canonical 23A effective-movement rule (`status POSTED && reversalOfId ==
null`) and every 23A/23B regression (Entrées/Sorties/Solde, period
totals, product revenue, expense categories, previous-period comparison,
reversal netting) pass unchanged — confirmed by the full suite, not
re-derived here.

## 7. Navigation

Desktop (`Sidebar.tsx`) and mobile (`AdminMobileHeader.tsx`) Finances
entries both widened from `role === "ADMIN"` to `role === "ADMIN" ||
role === "ASSISTANT"`, matching this codebase's established per-item
inline-literal convention for nav gating (no shared constant is imported
into these presentational components for this purpose — consistent with
every other nav item in both files, none of which import
`authorization.service-core.ts`'s role arrays either). MANAGER and
COMMERCIAL remain hidden, unchanged. No other Assistant nav item was
added or removed — 25M's existing Mes notes/Mes rapports/Paramètres stay
exactly as they were; this ticket adds precisely one line to each file.

## 8. Assistant landing route

`resolveDashboardRedirect(ASSISTANT)` changed from 25M's transitional
`/profile` to `/finances` — the real operational workspace this role now
has. ADMIN, MANAGER, and COMMERCIAL destinations are untouched.
`/profile` remains fully reachable via its own nav item and its own
authorization (`requireAuthenticatedUser()`, no role list) — changing the
*default* post-login destination doesn't remove or gate the route itself;
25M's self-service password semantics are untouched.

## 9. What stayed exactly as 25M left it

Per the ticket's own explicit non-goals, none of the following were
touched: `PROSPECT_OWNER_ROLES`/`PROSPECT_ACTION_ASSIGNEE_ROLES`
(Assistant remains excluded from prospect ownership and action
assignment — Finance access grants no commercial capability), user
administration (`requireAdmin()`-gated actions in `user.actions.ts` are
untouched and still ADMIN-only, re-verified via the `requireAdmin()`
regression), and every performance-domain authorization
(`canAssessEmployeeInStructuredEvaluation`, `canViewEmployeePerformance`,
`isScorableForCommercialResults`, etc.) — 25N made zero changes to the
performance domain.

## 10. No schema, no backfill

`prisma/schema.prisma` and `prisma/migrations/` are unchanged — confirmed
via `git diff --stat` showing no diff in either path. There is nothing to
backfill: no historical `LedgerEntry` row's `createdByUserId`,
`reversalOfId`, status, or payment method was touched, and none needed to
be — authorization changes who may perform *future* operations; it never
rewrites who performed past ones (§1/§30).

## 11. Deployment prerequisite (unchanged from 25M)

This environment has a live Neon `DATABASE_URL`. 25M's `UserRole.ASSISTANT`
migration is written and verified but was deliberately not deployed
against it, and remains so after this ticket — 25N introduces no new
migration, only runtime code that depends on the enum value 25M already
added. Deployment order, restated from the ticket:

```text
1. Deploy 25M's UserRole.ASSISTANT migration
2. Verify migration status
3. Deploy runtime containing 25M + 25N
4. Verify existing roles still behave normally
5. Only then intentionally create/transition an Assistant account
```

No real user's role was changed and no live Finance mutation was
performed to verify this ticket.

## 12. Verification

`npx tsc --noEmit`, `npx prisma validate`/`generate` (no schema diff),
full `npm test` (2057 tests; the one pre-existing, unrelated
`Sidebar.test.tsx` "Rapports quotidiens" failure — confirmed in earlier
tickets via `git stash` to predate this session — is the only failure),
`npx eslint .` (clean), `npm run build` (clean), `git diff --check` (no
whitespace issues). New/updated coverage: the `requireAdmin()` regression
(§37), the full four-role `FINANCE_ACCESS_ROLES` matrix (§38), updated
layout/create/reversal source-regex tests reflecting the real capability
(§39), updated desktop/mobile navigation tests (§40), the updated
redirect test (§41), and two new role-blindness regressions on the
ledger and report cores (§16/§17/§18/§27/§44). No live Finance mutation
and no real role change were needed for any of it.

## 13. Deferred to later tickets

Unchanged from 25L's sequencing: `25O` (ADMIN-only structured-assessment
evaluator authority, including the mutation-layer re-check 25L found is
required for existing MANAGER-owned drafts to actually lose live
authority), `25P` (Manager Results & target eligibility), `25Q` (Manager
Execution Discipline eligibility), `25R` (performance role matrix &
dashboard integration, including the Assistant Professional Contribution
`/10` decision). None of the performance-policy work moved in this
ticket.
