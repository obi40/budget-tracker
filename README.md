# Budget

A personal budget tracker that installs on your iPhone as a home-screen app (PWA). It works offline and keeps all data on the phone.

**Features:** accounts and net worth · expenses, income and transfers (with split categories and tags) · monthly category budgets with rollover · recurring bills, salary and subscriptions · savings goals · debt payoff plans · reports (category donut, income vs expenses, cash flow, net worth, month-over-month) · search and filters · JOD with USD/EUR · bank CSV import · JSON backup and restore · CSV export · passcode lock · light and dark mode.

## Install on iPhone
1. Open the site's link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open the app from that icon from then on. Back up from **More → Backup & export** now and then.

## Develop
```bash
npm install
npm run dev     # http://localhost:5173 (also on your Wi-Fi network)
npm test        # unit tests (money, budgets, rollover, recurring, CSV, backup)
npm run build   # production build in dist/
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. Enable it once in the repo under **Settings → Pages → Source: GitHub Actions**.

## Data model
Amounts are stored as integers in the smallest unit: fils for JOD (3 decimals), cents for USD/EUR. Totals are converted to JD using the rates in Settings. Storage is IndexedDB via Dexie (`src/db/schema.ts`).
