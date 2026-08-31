# Sold Contracts CRM refactor

The app has been refactored so App.jsx is now the application shell only.

## New structure

- `src/App.jsx` — app state, Supabase loading, page routing
- `src/components/Sidebar.jsx` — sidebar navigation
- `src/components/Header.jsx` — page header and refresh button
- `src/components/Stat.jsx` — dashboard stat card
- `src/components/SalesChart.jsx` — sales graph
- `src/components/ProductBreakdown.jsx` — product value breakdown
- `src/components/ContractsTable.jsx` — contracts search/table
- `src/components/ContractDrawer.jsx` — contract detail drawer
- `src/pages/Dashboard.jsx` — dashboard page
- `src/pages/Contracts.jsx` — contracts page
- `src/utils/formatters.js` — shared money/date/status/initials helpers
- `src/EPVSCalculator.jsx` — existing EPVS calculator, kept separate

No database schema or environment variables were changed.
