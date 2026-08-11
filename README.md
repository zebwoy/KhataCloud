# KhataCloud – Accounting & Financial Reporting

## What this is
A focused accounting and reconciliation tool for small teams and NGOs to record transactions, monitor cashflow, and produce clear, audit-friendly reports without heavy ERP overhead.

## Built with
- React + TypeScript + Vite (frontend)
- Netlify Functions + Neon/PostgreSQL (backend & persistence)

## Key features and intent
- Secure access via server-side auth (Netlify Function, env-based admin hash).
- Transaction form with category-aware sender/receiver labels, optional remarks, receiver dropdown, and validation to keep entries clean.
- Dashboard with all-time and filtered totals, balances, and inflow/outflow visibility.
- Transaction history with friendly dates, INR currency formatting, receiver filter, and CSV export.
- Financial reports: surplus/deficit badges, period comparison (current vs same period last year), category breakdowns, receiver-wise funds (income, expenses, net) with reimbursement cues for negative nets.
- Filters and presets: this month/quarter/fiscal year/all-time/custom ranges.
- Data consistency: numeric coercion to avoid NaN, local date parsing to avoid TZ drift, consistent currency/date presentation for auditability.

## Directory Structure

```text
├── api/            # Serverless backend endpoints (org-admin, admin, transactions, entities)
├── src/            # React + TypeScript frontend application (components, utils, lib)
├── migrations/     # Ordered SQL schema migration scripts & database seeds
│   ├── 001_migration_saas_platform.sql
│   ├── 002_migration_clerk_orgs.sql
│   ├── 003_migration_custodian_counterparty.sql
│   ├── 004_migration_entered_by.sql
│   ├── 005_migration_audit_v2.sql
│   └── 006_create_entities_table.sql
├── docs/           # Documentation, local dev guide, & architecture diagrams
├── scripts/        # CLI utilities & migration helpers
├── lib/            # Shared backend helpers (auditHelper, postgres)
└── public/         # Static web assets
```

## Hosting & operations
- Hosted on Vercel / Netlify, backed by Neon (PostgreSQL).
- Environment-driven configuration (e.g., Clerk Auth, DB URL).

## Project at a glance
- Iterative build focused on UX clarity (friendly dates/currency), receiver analytics, and audit-friendly reporting.
- Commits: see Git history for the full activity trail.

## Contact
- Maintained by Ayman Shaikh (zebwoy).
