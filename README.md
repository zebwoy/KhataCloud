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

## Hosting & operations
- Hosted on Netlify, backed by Neon (PostgreSQL).
- Environment-driven configuration (e.g., admin password hash, DB URL).

## Project at a glance
- Iterative build focused on UX clarity (friendly dates/currency), receiver analytics, and audit-friendly reporting.
- Commits: see Git history for the full activity trail.

## Contact
- Maintained by Ayman Shaikh (zebwoy).
