# Ticket 25G — Performance Domain Audit & Scoring Foundation

Audit date: 2026-08-28.

This is an **audit-only** ticket. No `PerformanceEvaluation`,
`PerformancePeriod`, or any related model/migration was created. No
employee-facing score exists after this ticket. No application behavior
changed. All findings below are grounded in full reads of
`prisma/schema.prisma` and the relevant `src/services/*` files, cited by
`file:line`. No database access was needed to answer this ticket's
questions — everything turns on code/schema structure, not live row
counts, so none was performed (25F/26A's read-only-DB precedent was not
invoked because it wasn't necessary here).

---

## 1. Executive verdict

RELAIS CRM can **today** support roughly half of a fair, explainable
performance model from durable operational evidence — mostly the
**Execution Discipline** dimension (`ProspectAction` completion/overdue
semantics are clean and well-tested) — and **cannot yet** support the
other half without either accepting real gaps or scoping a follow-up
ticket first. Three findings dominate:

1. **WON attribution has no durable "who gets credit" fact.** The
   `WON_TRANSITION` activity records only an `agentName` string snapshot
   of whoever *submitted the follow-up that flipped the status*
   (`prospect-won-transition.service-core.ts:19-34`,
   `prospect-follow-up.service-core.ts:251-273`) — not the prospect's
   owner. For `ADMIN`/`MANAGER`, follow-up submission is **unscoped**
   (`prospect-follow-up.service.ts:39-41`: `{ id: prospectId }`, no
   owner filter), so a manager who closes a deal on a commercial's behalf
   becomes the attributed agent, not the commercial who owns the pipeline.
   `Prospect.assignedUserId` is a **mutable current-state pointer**
   (`schema.prisma:429-430`), not a historical snapshot, so "who owned
   this prospect at the moment it became WON" cannot be reconstructed
   after the fact if ownership changed later. **Results scoring cannot be
   built on top of existing WON evidence without a schema addition**
   (§4, §38).
2. **"Who was expected to submit a Daily Report" is explicitly a
   today-only concept, not a historical one**, by the codebase's own
   documented design: `DailyReportExpectedUser`
   (`daily-report.service-core.ts:461-473`) is computed as "active users
   with a currently assigned template," with an explicit comment: *"This
   says nothing about any date other than today: today's expectation must
   not be projected onto historical dates, since the app has no
   assignment-history model."* `NOT_STARTED` (silence — no report at all)
   is likewise **only ever derived for today**
   (`daily-report.service-core.ts:476-478`, `:456-457`: "no derived
   NOT_STARTED" for historical periods). For a past evaluation period,
   the CRM can see which reports *were* submitted, but cannot reliably
   reconstruct which employees were *expected* to submit one on a given
   past day and silently didn't. This is a hard blocker for "Daily
   Reports submitted as expected" as an A-tier metric until a template
   assignment history is added.
3. **Execution Discipline is the one dimension the CRM can support
   cleanly today.** `ProspectAction` overdue/on-time/cancellation
   semantics are well-defined, tested, and derivable
   (`prospect-action.service-core.ts:32-41`), and role has no bearing on
   what counts as "your assigned work" — this is the strongest
   foundation to build 25H on first.

No schema change is recommended in 25G, per the ticket's own strong
preference (§45 below). Recommendation for 25H is in §20.

---

## 2. Historical information to preserve (once evaluations exist)

Per the ticket's own list (§1 of the ticket), cross-checked against what
this codebase already does well for other historical facts —
`ProspectActivity.agentName` (`schema.prisma:482`, a deliberate text
snapshot, never a `User` relation), `DailyReport.templateType`
(`schema.prisma:348-351`, "never re-derived from the User relation"),
and `UserCreationActivity.roleAtEvent` (`schema.prisma:304`, "must never
be re-derived from the mutable `User.role` field") — a future
`PerformanceEvaluation` must snapshot, at submission time, at minimum:

```
employeeId, roleAtEvaluation, evaluatorId
periodStart, periodEnd
policyVersion
metric definitions + weights used (by reference to policyVersion, or
  inlined if the audit below concludes weights/thresholds are
  policy-version-specific rather than hardcoded)
machine-derived evidence (raw counts, not just the normalized score)
BARS anchor text shown to the manager (verbatim, not by reference —
  anchor wording is exactly the kind of thing that "RELAIS modifies
  level 4 to definition Y" in the ticket's own example would silently
  corrupt if only referenced)
managerial ratings + any required justifications
component scores (Results/Execution/Role/Professional)
overall score
status (draft/submitted/void) + submittedAt
```

This list is a direct restatement of the ticket's own §1, confirmed
consistent with every existing "freeze at event time" pattern this
codebase already uses. No new pattern needs to be invented — extend the
existing one.

---

## 3. Evidence inventory — classification

### A — Strong objective evidence (usable, with caveats noted)

| Metric | Source | Caveat |
|---|---|---|
| Assigned action completed | `ProspectAction.status = COMPLETED` (`schema.prisma:513-557`) | Completable by assignee **or** any ADMIN/MANAGER (`prospect-action.service-core.ts:48-57`) — a manager completing someone else's action on their behalf must not silently credit the assignee (see §5) |
| Assigned action completed on time | `completedAt <= dueAt` (derivable; not stored as a flag) | "Overdue" itself is only ever computed as `status===OPEN && dueAt<now` (`:36-41`) — a **completed-late** action is never flagged "overdue" by existing code, so on-time-ness must be computed fresh by the scoring engine, not read off an existing field |
| Action overdue (open, past due) | `isOverdueProspectAction` (`:36-41`) | Point-in-time derived only — there is no persisted "was this ever overdue" fact, so a live re-query at evaluation time is required; if it's queried *after* the period closes and the action later got completed, the "was it overdue during the period" question needs the action's own `dueAt`/`completedAt`, which are stable, so this is actually safe to answer historically as long as the query uses those two fields, not a live `isOverdueProspectAction` call against `now` |
| WON prospect count | `WON_TRANSITION` `ProspectActivity` rows, `occurredAt`-scoped | See §1 finding — attribution to an *employee* is the open question, not the fact of a WON event itself, which is durably recorded (Ticket 18A) |
| Daily Report submitted | `DailyReport.status = SUBMITTED`, `submittedAt` (`schema.prisma:337-374`) | Existence is reliable; "was this employee expected to submit one" is not reconstructable historically (§1 finding 2) |
| Report on-time vs late | `submittedAt` vs `reportDate` (both timestamps exist) | Never currently computed anywhere in the codebase (confirmed: no "late"/"onTime" logic found in `daily-report.service-core.ts`); no stored deadline (e.g. "by end of business day") exists to compare against — would need a policy definition, not just a comparison |

### B — Context-dependent evidence (usable only with qualification)

| Metric | Source | Risk |
|---|---|---|
| Number of prospects contacted / interactions created | `ProspectActivity` count | Pure volume — rewards busywork; the ticket's own worked examples (§2, §6 of the ticket) apply directly |
| Number of `FOLLOW_UP` activities created | `ProspectActivity.type = FOLLOW_UP` | Ticket §8 explicitly warns against this — "do not reward employees merely for creating many FOLLOW_UP activities" |
| `conversionOutcome`/`conversionReason` distribution (ADVANCED/STALLED/WON/LOST) | `ProspectActivity.conversionOutcome` (`schema.prisma:492-494`) | **Nullable, and only populated by the follow-up mini-form going forward** — per the schema's own comment, every prior activity and every non-`FOLLOW_UP` activity type legitimately has none; coverage is partial and its actual percentage was not queried in this audit (would require a live count) |
| Conversion rate (WON / total, or WON / (WON+LOST)) | `sales-funnel-analytics.service-core.ts:30-47` (`conversionRate`, `closedWinRate`, both `number \| null`) | Small-sample risk is explicit ticket concern (§4/§24); the service already returns `null` rather than a misleading 0 or 100% when a denominator is zero — a good precedent to reuse (Ticket 20F: "prefer a clearly documented denominator") |
| Actions created (as the creator, not assignee) | `ProspectAction.createdByUserId` | Creating tasks isn't itself an outcome or execution signal — belongs nowhere in Results/Execution as a positive metric |

### C — Invalid performance evidence (confirmed, must not be used)

Confirmed absent from every service reviewed — no login-duration,
session-length, click-count, or page-view tracking exists anywhere in
`src/services/` or the schema. The CRM has no analytics/telemetry layer
of that kind at all today, so this category is naturally satisfied by
omission rather than by a deliberate exclusion the audit had to
enforce. Restated per the ticket for completeness: login frequency, time
logged in, page views, clicks, time-of-day usage, note length/typing
volume are all out of scope, and none of them exist as measurable data
in this codebase to begin with.

---

## 4. Results — 40 points: scoring candidates

**The single biggest open question in this audit.** Candidates, in order
of reliability:

1. **WON count in period** — objective in principle (Ticket 18A's
   `WON_TRANSITION` activity is durable and never derived from mutable
   `Prospect.status`), but **attribution is broken** per §1 finding 1.
   Recommendation: **do not implement Results scoring in 25H until this
   is resolved.** Two resolution paths, to decide in 25H's own scoping,
   not here:
   - (a) Add `wonAttributedToUserId` (or similar) captured at the same
     moment `buildWonTransitionActivityData` fires
     (`prospect-won-transition.service-core.ts:22-34`), set from
     `Prospect.assignedUserId` **at that instant** (a real schema
     addition, contradicting §45's "no migration" preference — flagged
     explicitly as the one plausible exception); or
     (b) accept `agentName` as an imperfect proxy for V1, document the
     known distortion (ADMIN/MANAGER assists get miscredited), and treat
     Results as advisory-only until (a) is built.
   - This audit does **not** pick between them — that's 25H's call once
     schema-change tolerance for that specific ticket is known.
2. **Conversion rate** (`sales-funnel-analytics.service-core.ts:30-47`)
   — reusable formula, already null-safe for small samples. Needs a
   minimum-denominator threshold before being weighted (ticket §4's own
   worked example: 10 easy leads/5 WON vs 40 cold leads/4 WON shows raw
   rate alone is misleading) — this audit recommends a minimum sample
   size be decided in 25H against real distribution data, not guessed
   here.
3. **`READY_TO_DISCUSS` count** — a leading indicator (current interest
   state), not an outcome (`prospect-status.service-core.ts:44`,
   `commercial-performance.service.ts:40-45`). Recommend excluding from
   Results; it belongs, if anywhere, under Role Responsibilities
   ("pipeline maintenance/qualification quality") since it reflects
   ongoing qualification work, not a closed result.
4. **Pipeline progression** (status advancing NEW→...→PROPOSAL_SENT) —
   no enforced state machine exists (`schema.prisma:42-60`: "no
   transition between values is enforced ... including backward moves");
   `conversionOutcome=ADVANCED` on a `ProspectActivity` is the closest
   thing to a structured signal, but is nullable/partial-coverage per
   §3. Not reliable enough for V1 Results scoring; revisit once
   `conversionOutcome` coverage is measured.

**Existing reusable engine:** `sales-funnel-analytics.service-core.ts`
already contains the exact "never conflate `Prospect.createdAt` with
`ProspectActivity.occurredAt`" discipline
(`sales-funnel-analytics.service.ts:21`) that a period-scoped Results
metric needs — WON-in-period must filter `WON_TRANSITION.occurredAt`,
never `Prospect.createdAt` or a live status snapshot. This is the
correct pattern to extend, not `commercial-performance.service.ts`
(§30 — that service is explicitly a **live** dashboard KPI, unscoped by
any date range, and unsuitable for a frozen evaluation as-is).

**Manager/Admin Results dimension:** no CRM evidence maps to individual
sales outcomes for these roles (by design — they don't own a pipeline
the same way). See §6 for the recommended role-specific substitution.

---

## 5. Execution Discipline — 30 points: scoring candidates

This is the **strongest** dimension today. Confirmed clean, tested
semantics from `prospect-action.service-core.ts`:

- **Denominator = actions assigned to the employee with `dueAt` inside
  the period**, not "all actions that exist." Confirmed no reassignment
  capability exists in the schema (`ProspectAction` has exactly one
  `assignedToUserId`, set once at creation, `schema.prisma:519-525`) —
  so "assigned" is unambiguous and stable for a closed period; no
  mid-flight reassignment complicates the denominator.
- **On-time completion**: `completedAt <= dueAt`, computed fresh — not
  read off any existing "overdue" flag, since `isOverdueProspectAction`
  only ever describes *currently open, currently overdue* actions
  (`:36-41`), never a terminal state. This must be a **new** comparison
  in the scoring engine, not a reused field.
- **Cancellation semantics — real gap found.** `cancellationReason` is
  free text (`schema.prisma:549`), with **no structured category**
  distinguishing "no longer applicable" (should not hurt performance)
  from "employee didn't do it and cancelled to avoid an overdue mark"
  (should). `canCancelProspectAction` permits the assignee themself to
  cancel their own action (`prospect-action.service-core.ts:63-73`) —
  meaning an employee can self-cancel their way out of a bad on-time
  rate today, and the CRM cannot distinguish a legitimate cancellation
  from this exact gaming pattern from the data alone. **This must be
  flagged, not solved, in 25G.** Recommendation for 25H: either exclude
  self-cancelled actions from the denominator entirely (safe default:
  worst case is under-counting real work, not rewarding gaming) or
  require a structured cancellation-reason taxonomy before trusting this
  metric — do not silently treat "cancelled" as neutral.
- **Completed-by-someone-else.** `canCompleteProspectAction` allows any
  `ADMIN`/`MANAGER` to complete another employee's assigned action
  (`:48-57`, explicit comment: "deliberately not prospect-ownership
  scoped, since delegated actions may live on a prospect the assignee
  doesn't own"). If a manager completes an employee's overdue task for
  them, `completedByUserId !== assignedToUserId`. Recommendation:
  execution credit should track **`assignedToUserId`** for "was the
  expected work done," and `completedByUserId !== assignedToUserId`
  should itself be a visible signal (not scored, just surfaced) — an
  employee whose tasks are frequently completed by their manager is a
  real operational fact worth showing, not hiding inside a clean
  percentage.
- **Volume-bias handling (ticket §6/§7)**: the audit agrees with the
  ticket's own instinct — rate alone (2/2=100% vs 36/40=90%) is
  misleading. Recommend the smallest viable fix: a **minimum-volume
  threshold** below which the rate isn't weighted at full confidence
  (exact threshold: 25H's call, informed by real per-employee action
  volume, not guessed here), rather than a compound statistical model —
  consistent with the ticket's own "do not prematurely design a complex
  statistical model" instruction (§6 of the ticket).
- **Follow-up discipline**: the *structured* mechanism
  (`ProspectAction`, created via `submitProspectFollowUp`) is fully
  covered by the above. The **legacy** single-slot
  `Prospect.nextAction`/`followUpDate` pair
  (`follow-up.service-core.ts:10-31`, `buildFollowUpQueueWhere`) has **no
  history at all** — every write overwrites the previous value
  (`schema.prisma:418-421` domain-map comment). It cannot answer "was a
  scheduled follow-up performed on time" for a past period, only "what's
  the current single pending follow-up." Recommendation: **Execution
  Discipline's follow-up component must be built entirely on
  `ProspectAction`, never on the legacy `nextAction`/`followUpDate`
  pair** — the latter is structurally incapable of contributing
  historical evidence.
- **Reporting discipline**: on-time submission is computable
  (`submittedAt` vs `reportDate`, both real fields), but "who was
  expected to report" is not reconstructable historically (§1 finding
  2). Recommendation: **exclude Daily Report expected-vs-actual from
  V1 Execution Discipline** until a template-assignment-history model
  exists (a real future ticket, not 25G/25H) — scoring an employee
  against an expectation the system can't prove existed on that date is
  exactly the kind of false precision §22 of the ticket warns against.
  A narrower, honest V1 substitute: score only **lateness of reports
  that were actually submitted** (`submittedAt` vs `reportDate` gap),
  which says nothing about missing reports but is at least truthful
  about what it measures.
- **No workday/weekend concept exists anywhere, despite the naming.**
  `addBusinessDays` (`src/lib/financial-report-period.ts:44-46`) is pure
  calendar-day arithmetic — `date.getTime() + days * MS_PER_DAY`, no
  weekend or holiday skipping despite the function name. Every calendar
  day, including Sundays, is treated as an equally "expected" reporting
  day for any active user with a template assigned. This is exactly the
  gap ticket §9 warns against ("must not create a metric that assumes
  every calendar day requires a report") — not a hypothetical risk to
  design around, but the system's actual current behavior. Any future
  Daily Report metric needs its own explicit workday-definition policy
  before it can be trusted, on top of (not instead of) the
  expected-reporters gap above.
- **Overdue-action semantics, per the ticket's own question list (§7)**:
  - *Cancelled action* → excluded from denominator by default (see
    above), pending a structured reason taxonomy.
  - *Reassignment* → structurally impossible today (no reassignment
    field exists) — not a real scenario to design for in V1.
  - *Assigned after the deadline already passed* → possible today (no
    validation prevents creating an action with `dueAt` in the past);
    such an action would be born already "overdue" through no fault of
    the assignee. Recommend excluding actions whose `dueAt < createdAt`
    from the on-time denominator, or at minimum flagging them for
    exclusion — otherwise this becomes a silent, unfair penalty.
  - *Completed one hour late vs ten days late* → both are simply
    "not on time" under a binary on-time/late split; the ticket doesn't
    require severity-weighting, and no evidence in this audit suggests
    the current data would support anything more granular than binary
    without inventing precision that doesn't exist. Recommend binary.

---

## 6. Role Responsibilities — 20 points: role-by-role audit

**Confirmed: no manager/employee hierarchy exists anywhere in the
schema or services.** No `managerId`, `teamId`, or equivalent field on
`User` (`schema.prisma:221-267`, `user.service-core.ts` grep confirms
only `role`/`active`/`dailyReportTemplateType` are the mutable fields).
Every `MANAGER` has company-wide visibility identical to `ADMIN` on
nearly every authorization list (`authorization.service-core.ts:28-73`:
`DAILY_REPORT_MANAGEMENT_ROLES`, `SALES_ANALYTICS_ROLES`,
`MY_PROSPECTS_ROLES` are all exactly `["ADMIN","MANAGER"]`). This is a
**structural limitation**, not a 25G oversight: "which employees does
this manager supervise" is not a question the CRM can currently answer
at all. §27's V1 authority model must account for this (see §7 below).

Recommendation, per the ticket's own strong preference (§3 of the
ticket): **same four dimensions, role-specific evidence underneath.**
No separate scoring systems per role.

| Responsibility | COMMERCIAL | MANAGER | ADMIN | Evidence source |
|---|---|---|---|---|
| Prospect follow-up ownership | Primary responsibility | Oversight only (can act on any prospect, `prospect-follow-up.service.ts:39-41`) | Same as MANAGER | `ProspectAction`, `ProspectActivity` |
| Assigned action execution | Primary | Also assignable to a manager (any active user can be an assignee, `findAssignee` has no role restriction, `prospect-action.service-core.ts:166-174`) | Same | `ProspectAction` |
| Daily reporting | Only if `dailyReportTemplateType` is set (currently near-zero adoption per template values `ASSISTANT`/`OPERATIONS_COORDINATOR`, nullable for most users, `schema.prisma:236-240`) | Same conditional | Same conditional | `DailyReport` |
| Team/operational oversight | N/A | **No CRM evidence exists for this today** — no "reviewed N reports," "resolved N escalations," or similar tracked anywhere | N/A | None — would need new evidence-producing features before this can be scored, not just a new metric definition |
| Report review / decisions-required handling | N/A | `DailyReportAttentionItem` (`daily-report.service-core.ts:502-508`) surfaces `hasDecisionNeeded`/`hasProblemReported` flags to managers, but **whether a manager actually acted on one is not tracked** — no "resolved by," no timestamp | N/A | Partial — the *surface* exists, the *action taken* does not |
| Pipeline maintenance / qualification quality | Candidate: `ProspectAction` creation quality, `READY_TO_DISCUSS` progression | N/A | N/A | See §4 note on `READY_TO_DISCUSS` belonging here, not Results |

**Verdict**: Role Responsibilities has real, usable evidence for
`COMMERCIAL` (via the same `ProspectAction`/follow-up evidence as
Execution Discipline — see §8's double-counting warning). For
`MANAGER`, the CRM can prove **visibility** into oversight surfaces
(the attention-item flags) but **not action taken** on them — scoring
"did the manager act" would require inventing evidence the system
doesn't collect, which the ticket explicitly forbids (§10: "do not
invent unavailable evidence"). For `ADMIN`, no operational
responsibility evidence exists at all — `ADMIN`'s CRM footprint is
almost entirely user-management and finance
(`user.service-core.ts`, `financial-ledger.service.ts`), neither of
which the ticket frames as performance-evaluable. **Recommendation:
Role Responsibilities for MANAGER and ADMIN should remain thin/mostly
Professional-Contribution-driven in V1**, with an explicit documented
gap rather than a fabricated metric.

---

## 7. Employee visibility / authorization (ticket §27)

Existing precedent, all from `authorization.service-core.ts:22-124`:

- Every feature's role list is its **own deliberately separate
  constant**, even when currently identical to another (explicit
  repeated comment pattern: "identical today by coincidence... kept
  separate so they can diverge"). This is the right precedent for a new
  `PERFORMANCE_EVALUATION_ROLES` (viewing) and a separate
  `PERFORMANCE_EVALUATION_SUBMIT_ROLES` (authoring) constant — never
  reuse an existing list "because it happens to match today."
- `DAILY_REPORT_MANAGEMENT_ROLES = ["ADMIN","MANAGER"]`
  (`:36`) is explicitly documented as **read-only**, never authorizing a
  mutation — directly reusable pattern: performance evaluations, being
  even more sensitive (ticket §37), should follow the same
  read-authority-≠-write-authority split from day one.
- `assertCanChangePasswordCore` (`:111-124`) is the closest existing
  precedent for "self, or an elevated role" — self-view of one's own
  finalized evaluation (ticket §27's "COMMERCIAL → own finalized
  evaluation only?") maps directly onto this same shape.

**Given the confirmed absence of any manager-to-employee assignment
concept (start of §6)**, a V1 "MANAGER can evaluate only their managed
employees" model is **not implementable** without first building that
assignment concept — which is out of scope for 25G/25H per the ticket's
own instruction not to invent unavailable evidence. Recommended V1
authority model, given this constraint:

```
ADMIN    → can view/author any employee's evaluation (org-wide, matches
           every other ADMIN grant in this codebase)
MANAGER  → can view/author any COMMERCIAL's evaluation (matches the
           existing flat-visibility pattern MANAGER already has for
           daily reports and sales analytics — not a new precedent)
COMMERCIAL → own finalized evaluation only, read-only (mirrors
           DAILY_REPORT_MANAGEMENT_ROLES's read/write split)
```

This is honest about the current flat-hierarchy limitation rather than
pretending a "managed employees" scope exists. If RELAIS later wants
manager-scoped evaluation authority, that requires a real hierarchy
model as its own ticket — flagged here, not solved.

---

## 8. Separating Execution Discipline from Role Responsibilities

Per the ticket's own worked example (§11): on-time follow-up execution
must not be counted twice. Given §5's finding that `ProspectAction` is
the only reliable follow-up evidence, and §6's finding that
`COMMERCIAL`'s Role Responsibilities candidates are largely the *same*
`ProspectAction`/follow-up data:

**Recommended boundary**: Execution Discipline = *rate/reliability*
metrics (on-time %, completion %, with volume-threshold handling).
Role Responsibilities for `COMMERCIAL` = *coverage/completeness*
metrics that are conceptually different, not the same count reframed —
e.g., "does every `READY_TO_DISCUSS` prospect have at least one open or
recently-completed `ProspectAction`" (a completeness/coverage check,
not a rate). This distinction needs concrete definition in 25H once
real data volume is known; this audit only establishes the *principle*
(rate vs. coverage) that keeps the two dimensions from double-counting
the same underlying rows.

---

## 9. Professional Contribution — 10 points: BARS architecture

Per ticket §12-14, this is managerial-only, not CRM-inferred — nothing
in this audit contradicts that; there is no writing-style, sentiment, or
message-volume data in the CRM to infer it from even if the ticket
allowed it (confirmed absent, same as §3's Category C finding).

**Trait set recommendation** (ticket §12-13's "smallest meaningful
set," challenged for overlap with machine evidence per §13):

- **Initiative** — no CRM-machine equivalent exists; safe to keep as-is.
- **Collaboration** — no CRM-machine equivalent; safe.
- **Communication** — no CRM-machine equivalent (message *content*
  quality is never inferred from data, per Category C); safe, but
  anchors must stay behavioral ("keeps stakeholders informed
  proactively") not stylistic ("writes clear messages" risks becoming a
  writing-style judgment the ticket explicitly forbids).
- **Reliability** — **overlaps directly with Execution Discipline**
  (§5's on-time/completion metrics are exactly "reliability" made
  machine-derived). Per ticket §13's own resolution options: either
  narrow this trait's anchors to what the system *cannot* observe
  (verbal commitments, dependability with colleagues outside tracked
  tasks) or drop it from the managerial component entirely.
  **Recommendation: narrow, don't drop** — RELAIS is small enough that
  "keeps commitments outside tracked tasks" is a real, distinct,
  observable behavior a manager can speak to, and dropping it entirely
  would leave no space for that signal anywhere in the model.
- **Problem solving** — no CRM-machine equivalent; safe.

Four traits (Initiative, Collaboration, Communication, narrowed
Reliability) at 10 points total is consistent with the ticket's warning
against "ten tiny traits" — this audit does not recommend a fifth.

BARS-writing standards (ticket §14): observable behavior, role-relevant,
neutral wording, no personality/moral judgment, distinguishable adjacent
levels. No CRM evidence bears on *how* to write these — this is a
managerial-design question, not a code-audit one. 25J owns the full
catalog per the ticket's own scoping.

**Evidence requirement (ticket §15)**: recommend adopting the ticket's
own proposed policy verbatim (1/5 require justification, 2-4 optional) —
nothing in the codebase argues against it, and it mirrors the existing
"extreme values need more scrutiny" instinct already present in this
codebase's `LedgerEntry` reversal flow (any reversal requires a
`reversalOfId` link and atomic guard, `financial-ledger.service.ts`
per the 26A audit §16 — extreme/consequential actions get more
structure, not less, is a repeated house pattern).

---

## 10. Bias-control matrix

| Bias | Risk | System mitigation available today |
|---|---|---|
| Recency | Manager remembers only the last week of a month-long period | Fixed evaluation period + machine evidence snapshot (frozen at submission, §2) makes the *objective* half immune; BARS anchors reduce but don't eliminate this for Professional Contribution |
| Halo/Horn | One strong/weak trait colors all ratings | Separate BARS criteria per trait, scored independently (ticket §14 principle) |
| Favoritism/similarity | Subjective generosity toward liked employees | Behavioral anchors + required evidence at extremes (§15) narrow, don't eliminate, subjective slack |
| Severity/leniency | One manager rates harshly, another leniently | Same scoring policy/anchors company-wide (§10 of the ticket) — the codebase's `SHARED_FEED_ROLES`-style "one constant per feature, applied uniformly" pattern is the right precedent: one `PERFORMANCE_V1` policy applied identically, not per-manager configuration |
| Activity-volume bias | More actions/interactions look like more work | §5's minimum-volume-threshold + rate-not-raw-count approach; §3's Category B classification explicitly excludes raw counts from direct scoring |
| Outcome-only bias | Only WON counts, ignoring process | Four separate dimensions (Results is only 40 of 100) already structurally prevents this by design |

Per ticket §16: software cannot eliminate managerial bias, only reduce
specific, named risks with specific, named mechanisms — this audit does
not claim otherwise.

---

## 11. Evaluation-period semantics

`sales-funnel-period.ts:1-35` already provides a reusable
`today/week/month/year/all` period resolver
(`resolveSalesFunnelPeriod`), itself delegating to
`financial-report-period.ts`'s centralized RELAIS business-timezone math
(Africa/Ouagadougou = UTC+0, confirmed by
`daily-report-date.ts:28-34`'s comment). This is a strong candidate
**bounds-calculation** base for a future `PerformancePeriod`, but it
only computes `{from, toExclusive}` — it has no concept of a
*persisted, named* period a `PerformanceEvaluation` would reference.

Recommendation: monthly periods (`periodStart`/`periodEnd`, calendar-
month aligned, reusing the existing business-day boundary helpers)
is a reasonable default — nothing in this audit found evidence RELAIS's
actual operating rhythm needs a different cadence, but this audit did
not survey RELAIS's non-CRM operational calendar (e.g. actual HR review
cycles), so this is a recommendation, not a confirmed fact. Confirm with
the user/RELAIS leadership before 25H hardcodes it.

---

## 12. Role-transition semantics

**Confirmed via `role-transition-ownership.test.ts:19-26`**: Ticket 21A
established, and this codebase enforces via regression tests, that "a
role transition changes authorization, never ownership" —
`Prospect.assignedUserId` (and by extension `ProspectAction.
assignedToUserId`) is **never** touched by a role change. A `COMMERCIAL`
promoted to `MANAGER` mid-period keeps every prospect/action they owned
before the promotion, with no automatic reassignment.

Consequence for performance evaluation: evidence accrued under the old
role does not magically move or disappear at the role-change instant —
it just sits there, still attributed to the same `userId`, needing a
scoring engine that knows *which role's rubric* applied to *which slice*
of the period. Per ticket §25, recommend: **evaluate each evidence
segment against the role effective when that evidence was produced**
(e.g., WON transitions before the promotion score under the
`COMMERCIAL` Results rubric; `ProspectAction` completions after the
promotion score under whatever rubric `MANAGER` uses for Execution
Discipline, which per §6 is largely the same shape anyway). This is the
"split by role segment" option the ticket offers, not the "current role
governs the whole period" option — the latter would misjudge a
newly-promoted manager by results-heavy commercial standards for days
they were still doing commercial work, or vice versa.

`roleAtEvaluation` (§2) must capture the role that governed the
*majority or entirety* of the period's rubric choice, not simply
"whatever `User.role` says when the evaluation is generated" — this
matters doubly once 26B's `OrganizationMembership` split happens,
per that ticket's own §5/§28 finding that `roleAtEvent`-style snapshots
must never be re-derived from a mutable current field.

---

## 13. Missing/N/A evidence policy

Per ticket §23, and directly informed by an existing precedent already
in this codebase: `sales-funnel-analytics.service-core.ts:30-47`
already returns `null` (not `0`) for `conversionRate`/`closedWinRate`
when the denominator is zero, with an explicit "prefer a documented
denominator" design note (Ticket 20F). **This is the exact pattern to
extend**: any Results/Execution sub-metric with zero applicable evidence
in the period must resolve to `null`/"not applicable," never `0`, and
the scoring engine must have an explicit redistribution-or-exclude rule
per dimension rather than silently averaging a `null` into `0`. This
audit does not pick the redistribute-vs-exclude policy — that's a 25H
design decision informed by which metrics turn out to have how much
real N/A frequency, which requires the live data this audit deliberately
did not query (§29 pattern from 26A: live counts are a 25H/26-series
concern once the shape is settled, not a prerequisite for this audit's
conclusions).

---

## 14. Small-sample handling

Directly per ticket §24's own examples (1 prospect won = 100%
conversion; 0 assigned actions = "perfect" execution) — both are real
risks given confirmed current data patterns: `RelaisProduct` distribution
from the 26A audit shows some products/segments are very thin (LOKARI
and NIA had **zero** prospects company-wide as of 2026-08-26, per
`ticket-26a-multitenancy-domain-data-ownership-audit.md` §11), so a
commercial working a thin product segment could trivially hit
small-sample distortion. Recommendation: every rate-based metric
(conversion rate, on-time %) needs a minimum-denominator floor below
which the metric contributes at reduced confidence or is treated as
N/A per §13, not at full weight. Exact floor: 25H's call, against real
per-employee volume — not guessed here.

---

## 15. Explainability requirements

Every machine-derived component score must be backed by the literal
evidence counts that produced it (ticket §31/§32) — e.g. "17 actions
expected, 15 completed, 13 on-time" must be inspectable, not just the
resulting "24/30." This requires the scoring engine to **return** its
raw evidence object alongside the normalized score, and the
`PerformanceEvaluation` snapshot (§2) must persist that evidence object,
not just the final number — otherwise an `18/20` is unauditable exactly
as the ticket warns. No existing service in this codebase currently
returns raw counts alongside a computed KPI in this shape (
`presentCommercialPerformance`, `commercial-performance.service-core.
ts:15-43`, returns only the final KPI object, no "how was this
computed" trail) — this is a **new pattern 25H must introduce**, not one
to copy from an existing service.

---

## 16. Snapshot/versioning requirements

Directly extends the pattern already proven correct by 26A's audit of
this exact codebase (`ticket-26a-multitenancy-domain-data-ownership-
audit.md` §1): **capture once at event time, never derive at read time
from a mutable current relationship.** Applied to performance:

- Before submission: machine evidence may be freely recomputed (the
  period is still "live").
- At submission: freeze evidence, score, policy version, BARS anchor
  text, and manager assessment together, atomically.
- After submission: immutable. Any future correction need uses
  void/supersede (a new evaluation row referencing the voided one),
  never an in-place overwrite — mirrors `LedgerEntry`'s reversal pattern
  (`reversalOfId`, atomic guarded update,
  `financial-ledger.service.ts` per 26A §16) as the closest existing
  precedent for "never overwrite a finalized financial-grade record,
  always append a correcting counter-record."

`policyVersion` (ticket §20): recommend a simple string like
`"2026-08"` or `"PERFORMANCE_V1"` — no evidence in this codebase
justifies more complex versioning than the plain string precedent
`DailyReportTemplateType`/enum values already use. A historical
evaluation's weights/anchors are looked up by that stored version
string, never recalculated against current definitions.

**Required historical-change scenarios (ticket §44)**, reasoned through
against the model in §18:

| Scenario | Outcome under the proposed snapshot model | Why |
|---|---|---|
| A — employee promoted mid-period | The finalized evaluation's `roleAtEvaluation` stays whatever was captured at submission (§12); it is never recomputed from `User.role` after the fact | `roleAtEvaluation` is a frozen field, same discipline as `UserCreationActivity.roleAtEvent` (`schema.prisma:304`) |
| B — a `Prospect` later moves from WON back toward another status, or a `ProspectAction` is edited/completed after the period closes | No change to any already-submitted evaluation | `machineEvidence` (§18) is frozen at submission; only DRAFT/pre-submission evaluations may recompute (§16's "before submission" rule) |
| C — the evaluator's own role or employment later changes, or a different manager now manages this employee | `evaluatorId` and the evaluator's identity at the time stay part of the record; the evaluation is not reassigned to whoever manages the employee today | `evaluatorId` is a stored FK snapshot alongside the rest of §2's list, mirroring `UserStatusActivity.actorUserId` (`schema.prisma:280-281`), which never gets reattributed either |
| D — BARS anchor wording is revised later (the ticket's own "definition X → definition Y" example) | The evaluation keeps the exact anchor text it showed the manager, verbatim, not a reference that would silently pick up the new wording | §2 explicitly requires storing anchor text verbatim rather than by reference, for exactly this reason |
| E — scoring weights or metric definitions change | The historical `/100` stays computed under the `policyVersion` string stored on the row; it is never recalculated against a newer policy | Same reasoning as `policyVersion` above |
| F — the employee is later deactivated | Their historical evaluations remain readable to whichever roles §7 grants view access; `User.active=false` has no cascading effect on `PerformanceEvaluation` rows, matching how deactivation already leaves `DailyReport`/`ProspectAction` history intact today (confirmed live: 6 of 68 `ProspectAction` rows already belong to a deactivated user, per `ticket-26a-multitenancy-domain-data-ownership-audit.md` §26) | `onDelete: Restrict` is the existing house pattern for every historical relation to `User`; a future `PerformanceEvaluation.employeeId` should follow it |

None of these require new mechanism beyond what §2/§16/§18 already
propose — they are confirmations that the proposed snapshot shape
actually holds up against each scenario, not additional design.

---

## 17. Privacy/authorization requirements

Confirmed via `shared-feed.service-core.ts:24-100` (full type/export
scan): the `/updates` feed's source types are exactly
`ProspectInteractionFeedItem`, `FollowUpCompletedFeedItem`,
`ProspectWonFeedItem`, `UserStatusFeedItem`, `UserCreatedFeedItem` — a
closed, enumerated union. **Performance data has no adjacent code path
into this feed today**, and per ticket §37, must never gain one.
Recommend an explicit invariant, stated for whoever builds 25H/25J:
*no `PerformanceEvaluation`-derived event type is ever added to
`SharedFeedItem`* — this is a one-line rule now, cheap to state,
expensive to retrofit once the feed has grown a "performance" branch
by accident.

Authorization: see §7's recommended V1 model. `DAILY_REPORT_
MANAGEMENT_ROLES`'s explicit "read-only, never authorizes a mutation"
comment (`authorization.service-core.ts:31-36`) is the precedent for
splitting `PERFORMANCE_EVALUATION_ROLES` (view) from a stricter
submit/finalize role list.

---

## 18. Proposed V1 domain model (not implemented)

Smallest model consistent with §2's snapshot requirements, following
this codebase's existing preference for JSON snapshots over
over-normalized tables (e.g. `DailyReport.templateData: Json?`,
`schema.prisma:358-363`, explicitly chosen over per-field columns for
"template-specific payload"):

```
PerformanceEvaluation
  id
  employeeId          -> User (Restrict, matches every other
                          historical User relation in this schema)
  evaluatorId          -> User (Restrict)
  roleAtEvaluation      UserRole (snapshot, never re-derived)
  periodStart, periodEnd
  policyVersion         String
  machineEvidence       Json   (raw counts per §15 — explainable trail)
  resultsScore, executionScore, roleResponsibilitiesScore,
    professionalContributionScore, overallScore   Int (human-readable,
    no false precision per ticket §22)
  professionalContributionAssessment  Json  (per-trait rating + optional/
    required justification text, per §9/§15's evidence-requirement
    policy)
  status                 DRAFT | SUBMITTED | VOID
  submittedAt
  createdAt, updatedAt
```

Rationale for JSON over dedicated tables (ticket §39): `machineEvidence`
and `professionalContributionAssessment` are read-mostly, evaluation-
scoped, never independently queried across evaluations in a way that
would need relational joins (no evidence in this audit suggests RELAIS
needs "show me every evaluation where overdue-count exceeded N" as a
cross-evaluation query) — this mirrors exactly the reasoning
`DailyReport.templateData` already used. If future reporting needs
prove otherwise, that's a schema-evolution decision for later, not a
reason to over-build now (ticket §39's own instruction).

**This is a proposal for 25H to adopt or revise, not something 25G
built.** No migration was written.

---

## 19. Proposed V1 scoring map

Derived from this audit's actual findings, not the ticket's illustrative
example (ticket §40 explicitly warns against merely reproducing it):

```
RESULTS — 40  [COMMERCIAL only in V1; see §6 for why MANAGER/ADMIN
               have no reliable Results evidence today]
├── WON count in period (BLOCKED on attribution fix, §1/§4 — do not
│     implement in 25H until resolved)
└── conversion rate, with minimum-sample floor (§4, §14)

EXECUTION DISCIPLINE — 30  [all roles; strongest dimension, §5]
├── assigned-action on-time completion rate (with volume floor, §5)
├── assigned-action completion rate (excl. self-cancelled pending a
│     reason taxonomy, §5)
└── report-lateness-when-submitted (COMMERCIAL/others with a template
      only; explicitly NOT "reports missed," §5/§1 finding 2)

ROLE RESPONSIBILITIES — 20  [COMMERCIAL: pipeline coverage distinct
                              from Execution's rate metrics, §8;
                              MANAGER/ADMIN: thin in V1, §6]
└── prospect-coverage completeness (e.g. READY_TO_DISCUSS prospects
      with an open/recent ProspectAction) — COMMERCIAL only in V1

PROFESSIONAL CONTRIBUTION — 10  [all roles; §9]
├── Initiative
├── Collaboration
├── Communication
└── Reliability (narrowed to non-machine-observable behavior, §9)
```

**Explicit V1 gaps this map does not paper over**: MANAGER/ADMIN have
essentially no populated Results or Role-Responsibilities evidence
today. A honest V1 might weight Professional Contribution and Execution
Discipline more heavily for those two roles rather than force-fitting
hollow Results/Role-Responsibility numbers — this is a real design
decision for 25H, flagged here rather than decided, since it changes
the 40/30/20/10 weighting per role and the ticket's own §21 says "do
not change the weights casually," which cuts both ways: don't change
them without evidence, but also don't apply them uniformly across roles
when the evidence audit shows they don't fit uniformly.

---

## 20. Exact recommendation for 25H

**Do not start 25H on Results scoring first.** Start with **Execution
Discipline for COMMERCIAL**, since:

1. It has the cleanest, best-tested evidence (`ProspectAction`
   OPEN/COMPLETED/CANCELED semantics, §5).
2. It has zero blocking attribution problems (unlike Results, §1/§4).
3. It surfaces the volume-threshold and cancellation-taxonomy design
   questions (§5) early, on the dimension where they're cheapest to
   get wrong.

Before Results scoring can be implemented at all, one of two things
must happen first, as its own explicitly-scoped decision (not silently
inside 25H):

- Add a `wonAttributedToUserId`-style snapshot field (a real, small,
  justified schema change — the one plausible exception to §45's "no
  migration" preference, and only for this one field, only after
  explicit confirmation); or
- Ship Results as an openly-labeled "advisory, agent-of-record only"
  metric with the known distortion documented in-product, not hidden.

Daily Report evidence should be limited to lateness-of-submitted-reports
only, explicitly excluding "reports missed," until a template-
assignment-history model exists as its own future ticket.

MANAGER/ADMIN Role-Responsibilities and Results should either be
explicitly thin in V1 (recommended) or deferred to a later phase once
new evidence-producing features exist for those roles — do not invent
metrics for them now.

---

## Production changes made by this ticket

None, other than this documentation file. No schema, migration, service,
or test file was modified. No database write of any kind was performed.
