# RTB Esports — rtbnetworkbd.com

Public marketing site (Official Garena Partner, Bangladesh) + a real,
Supabase-backed Admin Dashboard: branding/social/next-event control, a
YouTube Media Hub, a Web Gallery, a folder-based PDF Studio with an in-place
PDF text editor, an Invoice Generator that produces the official RTB invoice
PDF, and a Budget & Profit tracker with charts and tax-ready Excel export.

## 1. Set up Supabase (run once)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of
   **`SUPABASE_SETUP.sql`** (in this project's root), and run it. It creates
   every table, Row Level Security policy, and storage bucket the app needs
   — safe to re-run if you ever need to.
   - Already ran it before Phase 2 existed? Just run **`UPDATE_phase2.sql`**
     instead — it adds the new Next Event fields and the `brand_partners`
     table without touching anything else.
3. Create your admin login: **Authentication → Users → Invite user**, enter
   your email. You'll get an email to set a password. There's no public
   sign-up page — only invited users can log in.
4. Copy `.env.example` to `.env.local` and fill in your project's
   **Project URL** and **anon public key** (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

## 2. Run locally

```bash
npm install
npm run dev
```

Open the link it prints (usually `http://localhost:5173`) — that's the
public site.

## 3. Admin Dashboard

```
http://localhost:5173/admin-x7k9
```

Log in with the email/password you invited in step 1.3. Change the
`/admin-x7k9` path any time via `VITE_ADMIN_PATH` in `.env.local` — it's an
extra layer of obscurity on top of real Supabase Auth + Row Level Security,
which is what actually protects the data (every admin table and bucket
rejects writes from anyone whose `profiles.role` isn't `admin`, regardless
of what the browser sends).

### The six tabs

1. **Site Branding & Social** — logo/favicon (upload or URL), hero title &
   subtitle, announcement bar, **Next Event countdown** (name + date/time —
   drives the live countdown banner on the public site), social links,
   contact info. Saves straight to Supabase; every visitor sees it.
2. **Media Hub (YouTube)** — add/delete videos with category tags.
3. **Web Gallery** — upload photos (stored in the public `gallery` bucket)
   or add by URL, delete, filter by category.
4. **PDF Management** — a real folder-based PDF Studio: create folders,
   drag-and-drop or upload PDFs, move files between folders, rename, delete,
   and **edit PDF text in place** (click any text on the page and retype it
   — saved back into the actual PDF file, not just an overlay) or drop
   sticky notes anywhere on the page. Files persist in the private
   `documents` Storage bucket.
5. **Invoice Generator** — matches the official RTB invoice format exactly
   (logo, INVOICE stamp, project details, from/to, prizepool + event cost +
   service charge, grand total, "in words" line, bordered payment-details
   table). Generating one produces a real PDF (via `pdf-lib`), saves the
   invoice record to Supabase, files the PDF automatically into
   **PDF Studio → Invoices**, and opens a costing project for it in the
   Budget tab.
6. **Budget & Profit** — an Income-vs-Expense bar chart across all projects,
   a per-project card (income = invoice grand total, internal expenses by
   category, net profit), a **Download budget report (PDF)** button per
   project, bank remittance tracking (USD → BDT with an uploaded slip), and
   an **Export Excel (tax-ready)** button for the whole portfolio.

## 4. Deploy (Vercel — free)

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then on [vercel.com](https://vercel.com): New Project → import the repo →
Framework: **Vite** (auto-detected) → add `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_PATH` under Environment Variables
→ Deploy.

## Project structure

```
SUPABASE_SETUP.sql               — run once in Supabase SQL Editor
src/
  App.jsx                        — routes: "/" public site, admin login + dashboard
  RTBEsports.jsx                 — public site (reads from SiteDataContext)
  rtb.png                        — logo, used on the public site, admin login, and every invoice/report PDF
  context/SiteDataContext.jsx    — Supabase-backed settings/videos/photos
  admin/
    AdminLogin.jsx                — Supabase Auth email/password login
    ProtectedRoute.jsx            — session guard + security notes
    AdminDashboard.jsx            — sidebar shell wiring all 6 tabs together
    accounting/
      pdfEngine.js                 — formatters, number-to-words, pdf-lib invoice/report generation, DB<->app mappers
      useAccountingData.js         — loads/saves invoices, costing, and PDF Studio folders/files
    tabs/
      SiteSettingsTab.jsx
      MediaTab.jsx
      GalleryTab.jsx
      PdfStudioTab.jsx             — folders, drag/drop, full-page PDF text editor
      InvoiceGeneratorTab.jsx
      BudgetTrackerTab.jsx
```

## Notes

- The PDF Studio's in-place editor loads `pdf.js` and `pdf-lib` from a CDN
  on first use — it needs internet access to work, same as before.
- Rebranding: swap `src/rtb.png` for a new logo — it's used on the public
  header, admin login, and every generated invoice/report PDF.
