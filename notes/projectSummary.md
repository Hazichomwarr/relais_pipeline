# RELAIS CRM — Project Summary

## Overview

RELAIS CRM is an internal CRM built for RELAIS to manage commercial prospecting, follow-ups, product sales, and future multi-company SaaS operations.

The project follows strict domain-driven layering:

```
UI

↓

Server Actions

↓

Services

↓

Prisma

↓

PostgreSQL (Neon)
```

Business logic lives exclusively inside Services.

React components remain presentation-only.

---

# Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- Neon PostgreSQL
- Zod
- React Hook Form
- TailwindCSS

Authentication has intentionally not been introduced yet.

---

# Current Domain

## User

Represents an employee of RELAIS.

Current roles:

- ADMIN
- MANAGER
- COMMERCIAL

Users are soft-deactivated.

Inactive users remain visible historically.

---

## Prospect

Represents a sales opportunity.

Each Prospect belongs to one assigned commercial.

Historical ownership is preserved through the legacy snapshot:

```
agentName
```

Current ownership is:

```
assignedUserId
```

The relation is authoritative.

---

## ProspectActivity

Append-only interaction history.

Examples:

- phone call
- visit
- WhatsApp
- meeting
- demo
- follow-up

Activities are immutable history.

---

# Completed Tickets

## 12A

Prospect Detail

- prospect page
- follow-up editor
- detail route
- Zod validation

---

## 12B

Prospect Activity Timeline

- append-only activities
- transactional follow-up updates
- activity history

---

## 13A

User Foundation

- User model
- User CRUD
- User management UI

---

## 13B

Prospect Assignment

- Prospect → User relation
- assignment dropdown
- eligibility validation
- ownership reconciliation
- dashboard relation display
- historical fallback

22 historical prospects were safely reconciled.

No ownership information was lost.

---

## 14A

Follow-up Queue

Introduced

```
/admin/follow-ups
```

Features

- Prisma filtering
- overdue calculations
- KPIs
- follow-up queue
- reusable presentation helpers

---

## 13C.1

Commercial Domain Foundation

Introduced read-only commercial services.

No authentication.

No UI.

Services:

- commercial-dashboard.service.ts
- commercial-prospect.service.ts
- commercial-follow-up.service.ts
- commercial-performance.service.ts

Shared Admin logic is reused.

All queries scope inside Prisma using:

```
assignedUserId
```

---

# Current Architecture

```
Admin Dashboard

↓

Shared Services

↓

Commercial Services

↓

Prisma
```

Commercial services reuse Admin filtering and follow-up logic.

Business rules are never duplicated.

---

# Important Design Principles

## 1.

Business logic belongs in Services.

Never inside React components.

---

## 2.

Presentation helpers remain pure.

No Prisma.

No React.

---

## 3.

Historical information is append-only.

Never overwrite history.

---

## 4.

Filtering happens inside Prisma.

Never fetch everything then filter in JavaScript.

---

## 5.

Admin and Commercial dashboards share domain logic.

Only scope differs.

---

## 6.

Authentication is not simulated.

Current commercial services explicitly accept:

```
userId
```

Later this becomes:

```
session.user.id
```

No business logic should change.

---

# Current Roadmap

✅ User Foundation

✅ Prospect Assignment

✅ Follow-up Queue

✅ Commercial Domain Services

⬜ Authentication

⬜ RBAC

⬜ Commercial Dashboard UI

⬜ Organizations (multi-tenancy)

---

# Next Ticket

## 13D

Authentication + RBAC

Goals

- login
- sessions
- protected routes
- authorization helpers
- admin access
- commercial access
- manager access

After Ticket 13D the existing commercial services will simply receive the authenticated user's ID instead of an explicit parameter.

The domain layer should require little or no modification.

---

# Coding Standards

- TypeScript strict
- Zod validation
- Prisma for persistence
- Services own business rules
- React only renders data
- Reuse existing helpers whenever possible
- Never duplicate domain logic
- Keep tickets narrowly scoped
- Preserve historical data
