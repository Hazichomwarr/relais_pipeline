---
title: "Relais CRM Vision"
status: "Architecture Vision"
---

# Relais CRM Vision

## Philosophy

Relais CRM is **not** simply a Customer Relationship Management (CRM) system.

It is the operating system of RELAIS.

Every activity performed by the company should eventually be managed from a single platform.

The objective is simple:

> **Run the entire company from one place.**

---

# One Organization. One Record.

The primary object inside Relais CRM is **the Organization**.

An organization may represent:

- a prospect;
- a client;
- a former client;
- a partner.

The organization record never changes.

Only its lifecycle changes.

Example:

```text
Prospect
      ↓
Qualified
      ↓
Proposal Sent
      ↓
Client
      ↓
Deployment
      ↓
Active Customer
      ↓
Former Customer
```

Nothing is duplicated.

Everything remains attached to the same organization.

---

# Every Department Lives Inside the CRM

Relais CRM is divided into functional areas.

## Commercial

- Prospects
- Meetings
- Demonstrations
- Opportunities
- Quotations

---

## Operations

- School deployments
- Training
- Installations
- Customer onboarding

---

## Administration

- Contracts
- Official letters
- Company documents
- Correspondence
- Administrative follow-up

---

## Finance

- Invoices
- Receipts
- Subscriptions
- Payments
- Outstanding balances

---

## Customer Support

- Support requests
- Maintenance
- Incidents
- Customer history

---

## Human Resources

- Employees
- Performance reviews
- Training
- Leave requests
- Internal documents

---

# Documents Are Templates

Documents are **not stored as independent Word files**.

Instead, they are maintained as reusable templates.

Example:

```text
Contract Template

School Name:
{{school_name}}

Director:
{{director}}

Offer:
{{subscription}}

Price:
{{price}}

Date:
{{date}}
```

The CRM automatically replaces these variables using the organization's data.

The user simply clicks:

> Generate PDF

The document is created instantly.

---

# Automatic Document Generation

Every important document should eventually be generated directly from the CRM.

Examples:

- Subscription Contract
- Invoice
- Receipt
- School Information Form
- Deployment Plan
- Deployment Report
- Training Certificate
- Support Report
- Official Letter
- Company Presentation

Documents are automatically archived inside the client record.

---

# Organization Timeline

Every interaction with a client contributes to a chronological timeline.

Example:

```text
05 Aug
Prospect Created

↓

07 Aug
Demonstration

↓

08 Aug
Contract Signed

↓

09 Aug
School Created

↓

10 Aug
Training

↓

11 Aug
Go Live

↓

12 Sep
30-Day Follow-up
```

The timeline becomes the history of the relationship.

---

# Client Workspace

Each organization has its own workspace.

Example:

```text
École Saint Exupéry

Overview

Commercial

Deployment

Documents

Invoices

Support

Timeline

Notes
```

Everything related to that client is available in one place.

---

# The CRM Replaces Physical Folders

Instead of maintaining paper folders containing:

- contracts;
- invoices;
- correspondence;
- deployment documents;
- support history;

all information is centralized inside Relais CRM.

The CRM becomes the official client folder.

Paper copies are printed only when necessary.

---

# Guiding Principles

When adding a new feature to Relais CRM, always ask:

- Does this reduce manual work?
- Can this document be generated automatically?
- Can this information be reused elsewhere?
- Does this avoid duplicate data?
- Does this improve the client's history?

If the answer is yes, it probably belongs inside the CRM.

---

# Long-Term Vision

Relais CRM is not designed only to manage contacts.

It is designed to operate the entire company.

Sales, administration, finance, operations, customer support and human resources all converge into a single platform.

The objective is that every employee begins and ends their day inside Relais CRM.

---

# Philosophy

> **Relais CRM is not where we store information. It is where RELAIS operates.**
