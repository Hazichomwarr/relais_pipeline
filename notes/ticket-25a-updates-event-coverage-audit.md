# Ticket 25A — À la une Event Coverage Audit

Audit date: 2026-08-21

## Executive conclusion

`/updates` is a read-only chronological projection over durable history. Its
merge algorithm is correct and does not artificially favor follow-ups. The
current dominance is truthful: a read-only production snapshot found 29
`FOLLOW_UP` rows and one `PHONE_CALL` in the newest 30 eligible events.

The main coverage gaps are user creation and prospect creation. Both entities
have trustworthy creation timestamps, but neither has a durable creator
relation. They can support actor-neutral messages now, not messages naming who
created them. Role changes cannot be reconstructed safely at all.

There is one material privacy problem to address before broadening coverage:
`INTERNAL_NOTE` is currently included by the generic interaction query, and
its `details` preview is rendered to every ADMIN, MANAGER, and COMMERCIAL user.
Ticket 25A makes no production change, so this remains an explicit Ticket 25B
priority.

## 1. Current read path

```text
/updates
  -> app/updates/layout.tsx: requireSharedFeedAccess()
  -> app/updates/page.tsx: getSharedFeed({ limit })
  -> src/services/shared-feed.service.ts: four bounded Prisma queries
  -> src/services/shared-feed.service-core.ts: normalize, merge, sort, slice
  -> SharedFeedList: order-preserving date grouping
  -> SharedFeedItemCard: discriminated rendering and role-safe links
```

Access is shared by `ADMIN`, `MANAGER`, and `COMMERCIAL`. The service itself is
deliberately authorization-neutral; the layout and page enforce access before
the query.

### Source queries

| Query | Source and predicate | Timestamp | Per-source limit |
| --- | --- | --- | ---: |
| Prospect interactions | `ProspectActivity.type NOT IN (FOLLOW_UP, WON_TRANSITION)` | `occurredAt` | requested limit |
| Follow-ups completed | `ProspectActivity.type = FOLLOW_UP` | `occurredAt` | requested limit |
| Prospect won | `ProspectActivity.type = WON_TRANSITION` | `occurredAt` | requested limit |
| User status | all `UserStatusActivity` rows | `occurredAt` | requested limit |

Every query orders by `occurredAt DESC, id DESC`. The core fetches the four
sources concurrently, maps them, flattens them, repeats that same ordering,
and takes the global limit.

The default limit is 30 and the hard maximum is 100. “Afficher plus” increases
the `limit` parameter by 30 and refetches the newest N rows; it is expanding
top-N pagination, not cursor pagination.

## 2. Current event families

| Family | Source | Durable timestamp | Actor | Subject | Rendered message / content | Inclusion rule |
| --- | --- | --- | --- | --- | --- | --- |
| `PROSPECT_INTERACTION` | `ProspectActivity` | `occurredAt` | `agentName` text snapshot, nullable | Prospect relation and durable prospect ID | “{actor} a ajouté une interaction sur {prospect}”; renders up to 320 characters of `details`, but not `summary` or the interaction-type label | Every activity except `FOLLOW_UP` and `WON_TRANSITION` |
| `FOLLOW_UP_COMPLETED` | `ProspectActivity` | `occurredAt` | `agentName` text snapshot, nullable | Prospect relation and durable prospect ID | “{actor} a terminé un suivi avec {prospect}.” The stored summary is not rendered | `type = FOLLOW_UP` |
| `PROSPECT_WON` | `ProspectActivity` | `occurredAt` | `agentName` text snapshot, nullable | Prospect relation and durable prospect ID | “{prospect} est devenu client.” plus the commercial when present | `type = WON_TRANSITION` |
| `USER_ACTIVATED` | `UserStatusActivity` | `occurredAt` | `actorUserId` relation | `userId` relation | “{user} vient d’être activé(e) comme {current role}.” plus actor | `type = ACTIVATED` |
| `USER_DEACTIVATED` | `UserStatusActivity` | `occurredAt` | `actorUserId` relation | `userId` relation | “{user} a été désactivé(e).” plus actor | `type = DEACTIVATED` |

There are five normalized families backed by four queries. The generic
interaction family currently admits these seven activity types:

- `FIELD_VISIT`
- `PHONE_CALL`
- `WHATSAPP`
- `MEETING`
- `DEMO`
- `DOCUMENT_SENT`
- `INTERNAL_NOTE`

Prospect activity actors are durable name snapshots, not durable User IDs.
User-status actor and subject identities are durable relations, but their
displayed names and the subject's displayed role are read from mutable current
User fields.

## 3. Why follow-ups dominate

There is no balancing mechanism and no per-family quota. Each family may
contribute up to N rows, after which the newest N across all families win. One
source can consume every visible slot.

This is a correct bounded top-K merge, not query amplification. Fetching N per
source cannot omit a row that belongs in the global newest N. Artificial family
quotas would make the feed less chronologically truthful.

Read-only database snapshot on 2026-08-21:

| Durable activity type | Total rows |
| --- | ---: |
| `INTERNAL_NOTE` | 41 |
| `FOLLOW_UP` | 36 |
| `PHONE_CALL` | 3 |
| `FIELD_VISIT` | 3 |
| All other `ProspectActivity` types | 0 |
| All `UserStatusActivity` rows | 0 |

The newest 30 eligible rows are 29 follow-ups and one phone call. The observed
feed is therefore truthful chronology. User creation cannot compete for slots
because it is not queried, and activation/deactivation cannot appear because
there are currently no durable status-transition rows.

Recommendation: retain pure chronological ordering. Improve event coverage
and exclude inappropriate content; do not add arbitrary diversity quotas.

## 4. User creation durability

The authoritative path is:

```text
createUserAction
  -> requireAdmin()
  -> createUser(parsed data)
  -> prisma.user.create()
```

`User.createdAt` is a trustworthy database creation timestamp and normal
application updates do not rewrite it. The created User ID is durable.

The authenticated admin's ID is not passed to `createUser` and is not stored on
the new User or in a lifecycle event. The User's role is mutable and no
creation-time role snapshot exists. Therefore the data cannot support:

> Hamza MARE a ajouté Aminata OUEDRAOGO comme Commerciale.

It can support the reduced, actor-neutral and role-neutral wording:

> Le compte de Aminata OUEDRAOGO a été créé.

“A rejoint RELAIS” is less precise than the stored fact: the database proves
account creation, not the employee's actual joining date.

Classification: **B — durable event exists but lacks attribution**.

For full wording going forward, add a future-only durable lifecycle event with
`type = CREATED`, `actorUserId`, `subjectUserId`, `occurredAt`, and preferably a
role snapshot. Do not backfill creator identity.

## 5. User activation/deactivation

Both transitions are durably implemented. A real `active` flip causes the User
update and `UserStatusActivity` creation to run in one transaction. Repeating
the same active state creates no false event. Both directions are queried by
`/updates`.

Durable facts:

- transition type;
- affected User ID;
- actor User ID;
- occurrence timestamp.

Important qualification: the feed joins current User names and current target
role. A later role change can make an old activation card claim the user was
activated “comme” a role they did not hold then. The transition remains valid,
but that role wording is not historically reliable. Ticket 25B should either
remove the role phrase or introduce a role-at-event snapshot in a separate
persistence ticket.

The current database has zero `UserStatusActivity` rows. Creating an already
active User does not create an `ACTIVATED` event, which explains why the three
new users produced no feed cards.

Classification: **A — durable and already queried**, with a presentation
correctness caveat for the role phrase.

## 6. Prospect creation durability

The current creation path authenticates the submitter and writes both:

```text
assignedUserId = authenticated user ID
agentName = authenticated user's full-name snapshot
```

alongside `Prospect.createdAt`. That path reliably makes creator and initial
owner the same person for new records.

It is not a universal historical guarantee:

- older prospects predate authenticated creation;
- reconciliation scripts set `assignedUserId` from reviewed historical owner
  names, not from a dedicated creator fact;
- `assignedUserId` is ownership and may change independently in future;
- no `createdByUserId` or prospect-creation event exists.

Do not infer historical creator from the current assigned User. All records can
truthfully support:

> Nouveau prospect ajouté : École ABC.

Naming an actor for every historical record is not safe. `agentName` is useful
historical text but is not a stable creator relation.

Classification: **B — creation and timestamp are durable; stable creator
attribution is incomplete**.

## 7. WON coverage

WON is correctly represented by an explicit `WON_TRANSITION`
`ProspectActivity`, never by reading mutable `Prospect.status`.

The structured follow-up transaction:

1. reads the previous status;
2. updates the prospect;
3. creates the `FOLLOW_UP` activity;
4. when crossing from non-WON to WON, creates `WON_TRANSITION` with the same
   occurrence timestamp and actor-name snapshot.

The event remains trustworthy after later prospect edits or actor role changes.
Only the prospect's displayed current name is joined dynamically. A later name
edit changes the label, not the durable subject ID or transition.

Classification: **A — durable and already queried**. Keep it.

## 8. Generic interaction suitability

| Activity type | Durable? | Current feed | Recommendation |
| --- | ---: | ---: | --- |
| `FIELD_VISIT` | yes | yes, generic | Keep |
| `PHONE_CALL` | yes | yes, generic | Keep when explicitly logged as an interaction |
| `WHATSAPP` | yes | yes, generic | Keep when explicitly logged as an interaction |
| `MEETING` | yes | yes, generic | Keep |
| `DEMO` | yes | yes, generic | Keep |
| `DOCUMENT_SENT` | yes | yes, generic | Keep |
| `INTERNAL_NOTE` | yes | **yes, generic** | Exclude immediately in 25B |

The query should become an explicit outward-interaction allow-list rather than
“everything except two types.” That makes future enum additions opt-in and
prevents another private type from silently entering the shared feed.

Privacy finding: the card renders `details`, not merely `summary`. A newly
created internal note can therefore expose up to 320 characters to every
operational role. This is inappropriate for a company-wide feed. Ticket 25B
should exclude `INTERNAL_NOTE` and consider rendering the concise summary for
all outward interactions instead of a free-text details preview.

`FOLLOW_UP` cannot masquerade as a generic interaction because it is excluded
and can only be submitted through the structured follow-up workflow.

## 9. ProspectAction suitability

The model durably supports:

- created: `createdAt`, `createdByUserId`, assignee, prospect, due date;
- completed: immutable `completedAt` and `completedByUserId`;
- canceled: immutable `canceledAt`, `canceledByUserId`, and reason.

There is no separate assignment transition: assignment is part of creation and
actions cannot be reassigned in V1.

These events are not currently queried. They are operational task chatter, and
the structured follow-up transaction may complete one action, create the next,
and create a follow-up activity together. Adding action lifecycle rows would
turn one meaningful follow-up into up to three feed cards.

Classification: **D — durable but intentionally inappropriate**. Exclude until
the domain has an explicit “company-significant” action concept.

## 10. Daily Report suitability

Submission is trustworthy: the authenticated owner performs a guarded
`DRAFT -> SUBMITTED` update that atomically sets `submittedAt`. The durable
subject is the report and the actor is its `ownerUserId`.

A privacy-safe card could say “Lucie GOUBA a soumis son rapport quotidien”
without exposing content. However, this is recurring operational compliance,
already served by `/reports` and `/admin/reports`, and daily volume could replace
commercial progress with attendance-like noise.

Classification: **D — durable but better kept in the reporting workflow**.
Do not include report contents under any circumstances.

## 11. Finance and other privacy exclusions

Finance entries have durable occurrence timestamps and creator relations, but
`/finances` is ADMIN-only while `/updates` is shared with MANAGER and
COMMERCIAL. The feed service and regression tests explicitly exclude
`LedgerEntry`.

Classification: **D — durable, sensitive, and intentionally excluded**.
Amounts, counterparties, reasons, salaries, payments, reversals, and finance
notes must remain absent.

Also keep these out of the shared feed:

- `PersonalNote` and its content;
- `INTERNAL_NOTE` activity details;
- Daily Report contents;
- user email, phone, password, or other HR details;
- action cancellation reasons unless a later product decision defines safe
  visibility.

## 12. Role changes

Admin User updates can change `User.role`, and the authenticated actor ID is
available at command time. It is only persisted when `active` also flips; no
role-transition history records previous role, next role, actor, or occurrence
time. `User.updatedAt` is shared by all User edits and cannot prove a role
transition.

Classification: **C — meaningful but only mutable current state exists**.
Do not reconstruct promotions or demotions. A future role-history model is
required.

The same limitation applies to general Prospect status and interest changes.
WON is the one explicit status-transition exception. LOST currently has no
equivalent transition event and should not be reconstructed from status or
`updatedAt`.

## 13. Coverage matrix

| Event | Durable source | Actor durable | Meaningful | Current feed | Class | Recommendation |
| --- | --- | ---: | ---: | ---: | :---: | --- |
| User created | `User.createdAt` | no | yes | no | B | Actor-neutral event now, or lifecycle history for full attribution |
| User activated | `UserStatusActivity` | yes, relation | yes | yes | A | Keep; remove mutable current-role wording |
| User deactivated | `UserStatusActivity` | yes, relation | yes | yes | A | Keep |
| Prospect created | `Prospect.createdAt` | incomplete | yes | no | B | Actor-neutral event or add `createdByUserId` |
| Customer-facing interaction | `ProspectActivity` | name snapshot | yes | yes | A | Keep via explicit type allow-list |
| Internal note | `ProspectActivity` | name snapshot | no/private | **yes** | D | Exclude in 25B |
| Follow-up completed | `ProspectActivity(FOLLOW_UP)` | name snapshot | yes | yes | A | Keep |
| Prospect WON | `ProspectActivity(WON_TRANSITION)` | name snapshot | yes | yes | A | Keep |
| Prospect LOST | current Prospect status only | no transition actor/time | potentially | no | C | Requires explicit transition history |
| Action created/completed/canceled | `ProspectAction` | yes, relations | operational | no | D | Exclude |
| Daily report submitted | `DailyReport.submittedAt` | owner relation | maybe | no | D | Keep in reports, not shared feed |
| Finance entry | `LedgerEntry` | yes, relation | sensitive | no | D | Exclude |
| Role changed | current `User.role`/generic `updatedAt` | no | yes | no | C | Requires role-transition history |

## 14. Event identity, duplication, and chronology

Each item carries the durable source row ID, but the normalized ID is not
namespaced by source model and family. CUID collisions across models are very
unlikely, yet the contract should preferably be explicit, for example:

```text
prospect-activity:{rowId}:FOLLOW_UP_COMPLETED
user-status-activity:{rowId}:USER_ACTIVATED
```

The current ProspectActivity query predicates are disjoint, so one activity row
cannot appear as both a generic interaction and a dedicated follow-up/WON item.

A WON follow-up intentionally writes two rows with the same prospect, actor,
and timestamp: `FOLLOW_UP` and `WON_TRANSITION`. They are two durable facts,
not a duplicated row, but they can feel repetitive. There is no durable causal
or transaction correlation ID, so suppressing one by matching timestamp and
prospect would be heuristic. Keep both for now, or add an explicit workflow
correlation before bundling/superseding them.

All current families use event-specific `occurredAt`; none uses mutable
`updatedAt`. Generic interactions use the user-supplied actual interaction
time, structured follow-ups/WON use workflow completion time, and user-status
events use transaction time. This chronology is sound.

## 15. What history À la une must preserve

Every feed item must be grounded in durable facts for:

1. what happened;
2. who performed it, or an explicitly actor-neutral message when unknown;
3. which durable entity it concerned;
4. when it happened.

The feed is only a projection. Changing queries, messages, or coverage must
never alter or delete `ProspectActivity`, `UserStatusActivity`,
`ProspectAction`, `DailyReport`, `LedgerEntry`, or entity records.

## 16. Recommended V2 families

Recommended shared feed:

- keep `FOLLOW_UP_COMPLETED`;
- keep `PROSPECT_WON`;
- keep customer-facing interactions through an explicit allow-list;
- keep `USER_ACTIVATED` and `USER_DEACTIVATED`, correcting role wording;
- add actor-neutral `USER_CREATED` from `User.createdAt`;
- evaluate actor-neutral `PROSPECT_CREATED` from `Prospect.createdAt` after
  confirming that importing old rows into the current chronology is desired.

Explicitly exclude internal notes, actions, Daily Report submissions, finance,
generic role/status/interest updates, and inferred LOST events.

## 17. Persistence changes required

No schema change is required for the safe, reduced-wording V2 above.

Separate future persistence tickets are required for richer claims:

- user creator attribution: lifecycle event with actor, subject, time, and
  optionally role snapshot;
- prospect creator attribution: immutable `createdByUserId` or creation event,
  distinct from mutable ownership;
- role changes: explicit previous/next-role transition history;
- LOST events: explicit transition activity written transactionally;
- workflow deduplication/bundling: durable correlation ID shared by follow-up,
  WON transition, and related action changes.

No historical actor should be backfilled from guesses.

## 18. Recommended Ticket 25B

Ticket 25B should remain a focused feed-query and presentation change:

1. Replace the generic `notIn` interaction predicate with an explicit
   customer-facing allow-list; exclude `INTERNAL_NOTE`.
2. Stop rendering interaction `details` in the company-wide feed, or limit
   cards to the concise `summary` after a content-policy review.
3. Add `USER_CREATED` using `User.id` and `createdAt`, with actor-neutral,
   role-neutral wording. Do not claim who created the account.
4. Optionally add actor-neutral `PROSPECT_CREATED`, clearly treating
   `createdAt` as CRM record creation and never `assignedUserId` as historical
   creator.
5. Keep activation/deactivation, but remove “comme {role}” unless role-at-event
   is durably snapshotted.
6. Namespace normalized feed IDs by source and family.
7. Preserve the current pure chronological merge, 30/100 limits, role-safe
   navigation, and privacy regression tests.
8. Add tests proving internal notes/details, finance, reports, actions, and
   mutable `updatedAt` fields cannot enter the feed.

Do not add quotas, migrations, backfills, notifications, or inferred history
in Ticket 25B.
