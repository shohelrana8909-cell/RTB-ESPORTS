# RAHAT THE BRAND — PDF Studio, Invoice Generator & Costing Dashboard

## 1. Run locally (see it live)

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` link.

## 2. Deploy for free (Vercel)

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then at https://vercel.com: New Project → import the repo → Framework: **Vite** (auto-detected) →
Deploy. You'll get a live `your-project.vercel.app` link in a couple of minutes; add a custom domain
later from the project settings if you want.

## 3. New in this version

- **Real logo, as an actual file** — `src/rtb.png`, not a giant base64 string buried in the code. Swap
  that file to rebrand; it's used in the top bar, the invoice preview/PDF, and the login screen.
- **Bordered "PAYMENT DETAILS" table** — both the live preview and the generated PDF now draw an actual
  bordered table (matching your bank-slip screenshot), not an inline text line.
- **Real login, via Supabase Auth** — the app now requires an email/password sign-in backed by actual
  Supabase Auth (`supabase.auth.signInWithPassword`), not a front-end-only check. There's no self-signup;
  you invite each admin account from the Supabase dashboard. See section 5 below to set it up.
- **Real data persistence, via Supabase** — invoices, internal expenses, bank remittances, and every
  PDF Studio folder/file now live in Supabase (tables + the `documents` storage bucket), not just
  browser memory. Refreshing the page no longer loses anything. See section 5.
- **Income model** — Income per project = the invoice's Grand Total (Prizepool + Event Cost + Service
  Charge — the whole amount actually billed to the client). Net Profit = that Income − Internal
  Expenses (what RTB actually spends running the event, including paying out the prizepool).
- **Per-project budget report PDF** — each project card has a "Download budget report" button that
  builds a professional, Excel-style bordered PDF (RTB logo + business details up top, a proper line
  itemized income/expense table, net profit total row) and automatically files it into
  PDF Studio → Event Reports.

## 4. What's in this app

- **PDF Studio** — folders (pre-seeded: Invoices, Remittance Slips, Event Reports, Custom PDFs),
  drag-and-drop upload, rename/move files & folders, and a full-page editor that can edit the PDF's
  *actual* text (via pdf.js + pdf-lib, loaded from CDN) and drop sticky notes/annotations.
- **Invoice Generator** — fills in the exact invoice layout you use for Garena, auto-calculates
  Subtotal / Service Charge / Grand Total, converts the total to words, and generates a **real PDF**
  (via pdf-lib) that's automatically filed into PDF Studio → Invoices.
- **Costing & Profit** — one project per invoice: log internal expenses (Venue, Production, Casting,
  Logistics, Local Costs), log bank remittances (USD received, FX rate, resulting BDT, optional slip
  upload), see Net Profit = Income (invoice Grand Total) − Internal Expenses, and export a multi-sheet
  Excel report.

## 5. Backend (Supabase)

**Both login and data are real now.** Every invoice, internal expense, bank remittance, and PDF Studio
folder/file is read from and written to Supabase — nothing lives only in browser memory anymore.
Refreshing the page (or opening the app on another device, logged in as the same admin) shows the same
data. You still need to actually set up a Supabase project for any of this to work — the app has
nothing to talk to until you do.

Setup steps:

1. Create a project at supabase.com, then open Project → SQL Editor → New query, paste in the full
   contents of `ACCOUNTING_SCHEMA.sql`, and run it. This creates:
   - `invoices`, `event_expenses`, `bank_remittances` tables (with generated columns so totals can't
     drift out of sync)
   - `studio_folders`, `studio_files` — the metadata behind PDF Studio (the actual PDF bytes live in
     the storage bucket below; these tables just track names/paths/folder structure)
   - the `project_financial_summary` view
   - Row Level Security locked to `role = 'admin'`
   - a private `documents` storage bucket with folder-per-purpose paths
2. Go to Project → Settings → API and copy the **Project URL** and **anon public key**.
3. Locally: copy `.env.example` to `.env.local` and paste those two values in. On Vercel: Project →
   Settings → Environment Variables, add the same two keys (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`), then redeploy.
4. Invite yourself (and anyone else) as an admin: Authentication → Users → Invite user. They'll get an
   email to set a password — that's the login this app now checks against. There's no public signup
   form, so only people you explicitly invite can ever get in.
5. Run `npm install` again to pull in the new `@supabase/supabase-js` dependency.

The first time the app loads against a brand-new project, it automatically creates the four default
PDF Studio folders (Invoices, Remittance Slips, Event Reports, Custom PDFs) since none exist yet.

## 6. Honest limitations

- **PDF text editing** uses a generic font when it rewrites text into the PDF, so it won't always
  match the original font pixel-for-pixel — the words themselves are genuinely replaced in the file,
  though.
- **Print** opens the PDF in a new tab and uses the browser's own vector renderer — that's already
  full-resolution/vector, not a rasterized image, so there's no extra "300 DPI" step needed.
- **Excel styling**: the free SheetJS build used here writes clean structured data (multiple sheets,
  correct columns) but not cell colors/fonts — for the fully styled coloured look you'd get from
  openpyxl, that part would need a paid SheetJS Pro license or a server-side export step.
- **Login and data are both real** (Supabase Auth + Postgres + Storage) — but only once you've actually
  run through the setup in section 5. Until then, the app will show a "couldn't load saved data" banner
  since there's no Supabase project behind it yet.
- **Bank remittance slips**: the slip you attach when logging a remittance gets filed into PDF Studio →
  Remittance Slips (a real uploaded file), but the `bank_remittances` row itself doesn't store a direct
  link back to that file yet — only its filename, for display. Minor gap, easy to close if you want it.
