# Sold Contracts CRM — React

React + Vite frontend for the Supabase `sold_contracts` table.

## 1. Install
npm install

## 2. Configure Supabase
Copy `.env.example` to `.env.local` and fill in:
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY

Do not put a Supabase service-role/secret key in this file or in browser code.

## 3. Run
npm run dev

Open the local URL Vite gives you.

## 4. Build
npm run build

The app reads the `public.sold_contracts` table directly. It does not yet write to the database or connect to Pipedrive.
