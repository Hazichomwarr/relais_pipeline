# Ticket 25H — Commercial Execution Discipline Score Engine

Implemented 2026-08-28. Extends the audit in
`ticket-25g-performance-domain-audit-and-scoring-foundation.md`, which
this ticket does not re-litigate — see that document for the full
evidence audit. This note records what 25H actually built and the
policy decisions made along the way, so a future 25H.1/25I/25J does not
have to reverse-engineer them from the code.

## What this ticket built

- `src/services/execution-discipline.service-core.ts` — pure scoring
  engine (no Prisma import). No schema or migration changes.
- `src/services/execution-discipline.service.ts` — thin, server-only
  Prisma wiring: fetches the employee and their `ProspectAction` rows
  due inside the given period, then calls the pure core.
- `src/services/execution-discipline.service-core.test.ts` — the full
  required test matrix (scoring formula, period boundaries, ownership,
  status lifecycle, unsupported roles, period closure).
- No schema change, no UI, no Server Action/API route — per the
  ticket's own scope limits (§24, §25, §26).

## Key policy decisions

**Population = actions assigned to the employee with `dueAt` inside the
period**, inclusive on both ends. Never `createdByUserId` — the
`ExecutionDisciplineActionRow` type doesn't even carry that field, so
creator identity cannot leak into scoring by accident, not just by
convention.

**Historical state is reconstructed as of `periodEnd`, not as of "now."**
`ProspectAction`'s terminal fields (`completedAt`/`canceledAt`) are
write-once and one-way (Ticket 20B: no reopen, no edit), and
`assignedToUserId`/`dueAt` are never mutated after creation anywhere in
this codebase (verified by a repo-wide grep for `prospectAction.update`/
`updateMany` — only the two guarded terminal-transition call sites
exist). That means comparing `completedAt`/`canceledAt` against
`periodEnd` reconstructs true historical state exactly, without a
separate history table. An action still open at `periodEnd` but
completed the following month scores as open-overdue for the period it
was due in, not as a late completion — its eventual completion belongs
to whichever period contains that completion date.

**A period whose `periodEnd` hasn't occurred yet is refused
(`PERIOD_NOT_CLOSED`), not scored.** The reconstruction above is only
truthful once that instant has actually passed; scoring an in-progress
period would present a still-changing snapshot as final. This wasn't
explicitly asked for by name in the ticket, but follows directly from
its "do not fabricate historical state" instruction (§8) and the
determinism requirement (§4).

**Cancellation policy (§9): excluded from the scoring denominator
entirely, never counted as success or failure, always visible in
evidence.** `applicableActions` includes canceled actions;
`sampleSize` (the actual scoring denominator) does not. A Commercial
with 8 canceled and 2 on-time actions scores 30/30 on a `sampleSize` of
2 — the evidence object still shows `canceled: 8` so a manager reading
the score isn't misled into thinking all 10 were handled well. No
cancellation-reason taxonomy was added (§10) — the self-cancellation
gaming risk 25G identified is still open, just visible now instead of
invisible.

**Scoring formula: on-time = full credit, late = half credit, open
= no credit**, `score = round(30 * (onTime + late * 0.5) / sampleSize)`.
The 0.5 late-credit weight is a deliberately coarse, named constant
(`EXECUTION_DISCIPLINE_LATE_CREDIT_WEIGHT`), not a lateness-magnitude
curve — §16 explicitly asked for exactly this level of precision, no
more.

**Small-sample handling: only `sampleSize === 0` is blocked
(`INSUFFICIENT_EVIDENCE`).** The ticket's own example (§14) only
mandates this for zero applicable actions; a nonzero minimum-confidence
threshold was deliberately not invented here, per 25G's own conclusion
that the right threshold needs real per-employee action volume this
ticket did not query. `sampleSize` is exposed in every scored result so
a `1/1` doesn't read with the same confidence as `40/40` once a UI
exists to show it.

**Role scope: `COMMERCIAL` only**, via `isScorableForExecutionDiscipline`.
`ADMIN`/`MANAGER` get an explicit `UNSUPPORTED_ROLE` result, never a
silently wrong score built from data that doesn't represent their real
responsibilities.

## Known limitations (do not reinterpret these as forgotten features)

- **WON attribution is unavailable.** Results scoring cannot be built
  the same way — see 25G §1/§4 and the "25H.1" follow-up the user has
  already scoped.
- **Historical Daily Report expectations are unavailable.** Who was
  expected to report on a past day cannot be reconstructed; this engine
  does not touch `DailyReport` at all.
- **A true business-day/working-day calendar is unavailable.**
  `addBusinessDays` (`src/lib/financial-report-period.ts:44-46`) is
  plain calendar-day arithmetic despite its name — not used by this
  engine, and not safe to reuse as evidence of actual working days for
  any future reporting-discipline metric.
- **Cancellation reasons are unavailable.** `cancellationReason` is free
  text with no taxonomy; this engine treats every cancellation
  identically (excluded, visible, unscored) regardless of whether it
  was legitimate.
- **A manager-to-employee hierarchy is unavailable.** There is no
  concept of "which employees this manager supervises" anywhere in the
  schema — irrelevant to this scoring engine directly, but relevant to
  whoever builds the authorization layer around it later.

## Verification performed

```
npx tsc --noEmit
npm test -- (full suite, includes the new execution-discipline.service-core.test.ts)
git diff --check
```

No database access was needed or performed — this ticket is pure
domain code plus documentation.
