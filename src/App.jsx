import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Folder, FolderPlus, Upload, FileText, Printer, Trash2, Type, X, Plus,
  TrendingUp, TrendingDown, Wallet, ChevronRight, Home, Check,
  ZoomIn, ZoomOut, ChevronLeft, FileSpreadsheet, ChevronDown, ChevronUp,
  Receipt, StickyNote, Save, Loader2, AlertTriangle, Pencil, FileSignature,
  Landmark, ArrowRightLeft
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import RTB_LOGO_DATA_URI from "./rtb.png";

// ---------- RTB Esports dark theme tokens ----------
const BG = "#0D021A";
const CARD = "#171025";
const CARD_ALT = "#1E1730";
const BORDER = "#2E2545";
const ACCENT = "#8A2BE2";
const ACCENT_SOFT = "#8A2BE22A";
const ACCENT_DARK = "#5E1E9E";
const TEXT = "#FFFFFF";
const MUTED = "#A79FC0";
const GOOD = "#3ECF8E";
const BAD = "#FF5C7A";
const DARKVIEW = "#0A0113";

const uid = () => Math.random().toString(36).slice(2, 10);
const usdFmt = (n) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
const bdtFmt = (n) => `৳${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)}`;
// PDF-safe variant: pdf-lib's StandardFonts use WinAnsi encoding, which has no Bengali glyphs
// (the ৳ sign crashes drawText). Use this one anywhere text gets drawn into a PDF.
const bdtFmtAscii = (n) => `Tk ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)}`;

const FONT_FAMILIES = ["Georgia, serif", "'Segoe UI', sans-serif", "'Courier New', monospace", "Verdana, sans-serif"];
const EXPENSE_CATEGORIES = ["Venue", "Production", "Casting", "Logistics", "Local Costs", "Other"];
const DEFAULT_FOLDERS = ["Invoices", "Remittance Slips", "Event Reports", "Custom PDFs"];

// ---------- Real login gate, backed by Supabase Auth + RLS ----------
// See ACCOUNTING_SCHEMA.sql for the profiles/RLS setup, and .env.example
// for the two env vars this needs (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).

// ---------- RTB logo (src/rtb.png — swap that file to rebrand) ----------
// pdf-lib needs raw bytes, not a URL, to embed the logo into a PDF.
// The import above gives us a URL (Vite serves/bundles the file); fetch it
// once and cache the bytes so every PDF build doesn't refetch the same file.
let _logoBytesPromise = null;
function getLogoBytes() {
  if (!_logoBytesPromise) {
    _logoBytesPromise = fetch(RTB_LOGO_DATA_URI).then((r) => r.arrayBuffer());
  }
  return _logoBytesPromise;
}

// ============================================================
// SUPABASE DATA LAYER — persistence for invoices, costing, and
// PDF Studio files. See ACCOUNTING_SCHEMA.sql for the tables this
// talks to (invoices, event_expenses, bank_remittances,
// studio_folders, studio_files) and the private 'documents' bucket.
// ============================================================
const DOCS_BUCKET = "documents";

async function uploadDocument(path, blob) {
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || "application/pdf" });
  if (error) throw error;
}
async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 60 * 60); // 1 hour
  if (error) throw error;
  return data.signedUrl;
}
async function deleteDocuments(paths) {
  if (!paths.length) return;
  await supabase.storage.from(DOCS_BUCKET).remove(paths);
}

// ---- invoices ----
function dbInvoiceToApp(row) {
  return {
    id: row.id, number: row.invoice_number, date: row.invoice_date,
    projectName: row.project_name, edition: row.edition,
    clientName: row.client_name, clientAddress: row.client_address,
    prizepool: Number(row.prizepool_usd), eventCost: Number(row.event_cost_usd),
    serviceChargePct: Number(row.service_charge_pct),
    subtotal: Number(row.subtotal_usd), serviceChargeAmt: Number(row.service_charge_usd),
    grandTotal: Number(row.grand_total_usd),
    bankName: row.bank_name, bankAccNo: row.bank_acc_no, bankAccName: row.bank_acc_name,
    swiftCode: row.swift_code, routingNumber: row.routing_number,
  };
}
function appInvoiceToDbInsert(inv) {
  return {
    invoice_number: inv.number, invoice_date: inv.date,
    project_name: inv.projectName, edition: inv.edition,
    client_name: inv.clientName, client_address: inv.clientAddress,
    prizepool_usd: inv.prizepool, event_cost_usd: inv.eventCost,
    service_charge_pct: inv.serviceChargePct,
    bank_name: inv.bankName, bank_acc_no: inv.bankAccNo, bank_acc_name: inv.bankAccName,
    swift_code: inv.swiftCode, routing_number: inv.routingNumber,
  };
}
// ---- costing (event_expenses / bank_remittances) ----
function dbExpenseToApp(row) {
  return { id: row.id, category: row.category, description: row.description || "", amount: Number(row.amount_usd) };
}
function dbRemittanceToApp(row) {
  return {
    id: row.id, usdReceived: Number(row.usd_received), fxRate: Number(row.fx_rate),
    date: row.remittance_date, slipName: row.slip_storage_path ? row.slip_storage_path.split("/").pop() : null,
  };
}
// ---- PDF Studio folders/files ----
function dbFolderToApp(row) {
  return { id: row.id, name: row.name, parentId: row.parent_id || "root" };
}
function dbFileToApp(row, url) {
  return { id: row.id, folderId: row.folder_id || "root", name: row.name, url, size: row.size_bytes, notes: row.notes || [], storagePath: row.storage_path };
}

// ---------- Number -> words (for the invoice's "IN WORDS" line) ----------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function chunkToWords(num) {
  let str = "";
  if (num >= 100) { str += ONES[Math.floor(num / 100)] + " Hundred "; num %= 100; }
  if (num >= 20) { str += TENS[Math.floor(num / 10)] + " "; num %= 10; }
  if (num > 0) str += ONES[num] + " ";
  return str.trim();
}

function numberToWords(n) {
  if (n === 0) return "Zero";
  const scales = ["", "Thousand", "Million", "Billion"];
  let scaleIdx = 0;
  const words = [];
  while (n > 0) {
    const part = n % 1000;
    if (part) words.unshift((chunkToWords(part) + (scales[scaleIdx] ? " " + scales[scaleIdx] : "")).trim());
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return words.join(" ");
}

function amountToWords(amount) {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  let out = `${numberToWords(dollars)} dollar${dollars === 1 ? "" : "s"}`;
  if (cents > 0) out += ` and ${numberToWords(cents)} cent${cents === 1 ? "" : "s"}`;
  return out + " only";
}

// ---------- Dynamically load pdf.js + pdf-lib from CDN (once, shared) ----------
let enginePromise = null;
function loadPdfEngines() {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise((resolve, reject) => {
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    s1.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"; } catch (e) {}
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
      s2.onload = () => resolve();
      s2.onerror = () => reject(new Error("pdf-lib failed to load"));
      document.body.appendChild(s2);
    };
    s1.onerror = () => reject(new Error("pdf.js failed to load"));
    document.body.appendChild(s1);
  });
  return enginePromise;
}

// ---------- Build a real invoice PDF with pdf-lib ----------
async function buildInvoicePdfBytes(inv) {
  await loadPdfEngines();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.05, 0.2);
  const gray = rgb(0.45, 0.45, 0.45);
  const W = 595.28;

  let y = 790;
  const left = (text, opts = {}) => page.drawText(text, { x: 50, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: opts.color ?? ink });
  const right = (text, opts = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: W - 50 - w, y, size, font: f, color: opts.color ?? ink });
  };
  const hr = (yy) => page.drawLine({ start: { x: 50, y: yy }, end: { x: W - 50, y: yy }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });

  // Brand logo (real PNG, embedded) + a black "INVOICE" stamp box, matching the brand sheet
  const logoPng = await pdfDoc.embedPng(await getLogoBytes());
  const logoDims = logoPng.scale(0.28);
  page.drawImage(logoPng, { x: 50, y: y - logoDims.height + 18, width: logoDims.width, height: logoDims.height });

  const stampW = 150, stampH = 34;
  const stampX = W - 50 - stampW, stampY = y - stampH + 18;
  page.drawRectangle({ x: stampX, y: stampY, width: stampW, height: stampH, color: rgb(0.06, 0.06, 0.06) });
  const stampText = "INVOICE";
  const stampSize = 20;
  const stampTextW = bold.widthOfTextAtSize(stampText, stampSize);
  page.drawText(stampText, { x: stampX + (stampW - stampTextW) / 2, y: stampY + 9, size: stampSize, font: bold, color: rgb(1, 1, 1) });

  y -= (logoDims.height + 6);
  right(`Invoice #${inv.number}`, { size: 10 });
  y -= 12;
  right(`Date: ${inv.date}`, { size: 10 });
  y -= 26;

  // Project details box
  left("Project Details -", { bold: true, size: 10 });
  y -= 14;
  left(`Name - ${inv.projectName}`, { size: 10 });
  y -= 14;
  left(`Edition - ${inv.edition}`, { size: 10 });
  y -= 28;

  // From / To
  const fromToY = y;
  left("From:", { bold: true, size: 10 });
  page.drawText("To:", { x: 320, y, size: 10, font: bold, color: ink });
  y -= 14;
  const fromLines = ["R.T.B Esports", "Plot-34, Sonargaon Janpath Road, Sector-11,", "Uttara-1230, Dhaka.", "+880 1832 172810", "rtbesportsbd@gmail.com"];
  const toLines = [inv.clientName, ...inv.clientAddress.split("\n")];
  const maxLines = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (fromLines[i]) { page.drawText(fromLines[i], { x: 50, y, size: 9, font, color: ink }); }
    if (toLines[i]) { page.drawText(toLines[i], { x: 320, y, size: 9, font, color: ink }); }
    y -= 13;
  }
  y -= 12;

  // Table header
  hr(y + 8);
  left("SL", { bold: true, size: 10 });
  page.drawText("Description", { x: 90, y, size: 10, font: bold, color: ink });
  page.drawText("QTY", { x: 330, y, size: 10, font: bold, color: ink });
  page.drawText("Unit Rate", { x: 400, y, size: 10, font: bold, color: ink });
  right("Amount", { bold: true, size: 10 });
  y -= 8;
  hr(y);
  y -= 18;

  const rows = [["01.", "Prizepool", usdFmt(inv.prizepool)], ["02.", "Total Event Cost", usdFmt(inv.eventCost)]];
  rows.forEach(([sl, desc, amt]) => {
    left(sl, { size: 10 });
    page.drawText(desc, { x: 90, y, size: 10, font, color: ink });
    const w = font.widthOfTextAtSize(amt, 10);
    page.drawText(amt, { x: W - 50 - w, y, size: 10, font, color: ink });
    y -= 18;
  });
  y -= 6;
  hr(y);
  y -= 20;

  // Subtotal / service charge / total box (right aligned)
  const box = (label, value, opts = {}) => {
    page.drawText(label, { x: 380, y, size: 10, font: opts.bold ? bold : font, color: ink });
    const w = (opts.bold ? bold : font).widthOfTextAtSize(value, 10);
    page.drawText(value, { x: W - 50 - w, y, size: 10, font: opts.bold ? bold : font, color: ink });
    y -= 16;
  };
  box("Subtotal", usdFmt(inv.subtotal));
  box(`Service Charge (${inv.serviceChargePct}%)`, usdFmt(inv.serviceChargeAmt));
  hr(y + 8);
  box("Total", usdFmt(inv.grandTotal), { bold: true });
  y -= 14;

  left(`IN WORDS :- ${amountToWords(inv.grandTotal)}`, { size: 9 });
  y -= 4;
  hr(y);
  y -= 24;

  // Payment Details — real bordered table, like the bank's own slip layout
  const tableX = 50, tableW = W - 100, col1W = 160, rowH = 26;
  const pay = [["BANK", inv.bankName], ["BANK ACC NO", inv.bankAccNo], ["ACCOUNT NAME", inv.bankAccName], ["SWIFT CODE", inv.swiftCode], ["ROUTING NUMBER", inv.routingNumber]];
  const titleRowH = 24;
  const tableTop = y;
  const tableBottom = tableTop - titleRowH - rowH * pay.length;
  const border = rgb(0, 0, 0);

  page.drawRectangle({ x: tableX, y: tableTop - titleRowH, width: tableW, height: titleRowH, borderColor: border, borderWidth: 1 });
  const titleText = "PAYMENT DETAILS";
  const titleW = bold.widthOfTextAtSize(titleText, 12);
  page.drawText(titleText, { x: tableX + (tableW - titleW) / 2, y: tableTop - titleRowH + 7, size: 12, font: bold, color: ink });

  pay.forEach(([k, v], i) => {
    const rowTop = tableTop - titleRowH - i * rowH;
    page.drawRectangle({ x: tableX, y: rowTop - rowH, width: col1W, height: rowH, borderColor: border, borderWidth: 1 });
    page.drawRectangle({ x: tableX + col1W, y: rowTop - rowH, width: tableW - col1W, height: rowH, borderColor: border, borderWidth: 1 });
    page.drawText(k, { x: tableX + 8, y: rowTop - rowH + 9, size: 9.5, font: bold, color: ink });
    page.drawText(v || "", { x: tableX + col1W + 8, y: rowTop - rowH + 9, size: 9.5, font, color: ink });
  });

  y = tableBottom - 16;
  left("IT Export Exemption Notice: This invoice relates to export of IT/ITES services and is eligible for", { size: 7.5, color: gray });
  y -= 10;
  left("income tax exemption under the applicable NBR SRO - for bank & tax verification purposes.", { size: 7.5, color: gray });

  const bytes = await pdfDoc.save();
  return bytes;
}

// ---------- Per-project Income vs Cost budget report (printable PDF) ----------
async function buildCostingReportPdfBytes(p) {
  await loadPdfEngines();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.05, 0.2);
  const gray = rgb(0.45, 0.45, 0.45);
  const W = 595.28;
  const tableX = 50, tableW = W - 100;

  let y = 790;
  const logoPng = await pdfDoc.embedPng(await getLogoBytes());
  const logoDims = logoPng.scale(0.24);
  page.drawImage(logoPng, { x: tableX, y: y - logoDims.height + 14, width: logoDims.width, height: logoDims.height });
  page.drawText("R.T.B Esports · Plot-34, Sonargaon Janpath Road, Sector-11, Uttara-1230, Dhaka", { x: 220, y: y - 10, size: 8, font, color: gray });
  page.drawText("+880 1832 172810 · rtbesportsbd@gmail.com", { x: 220, y: y - 22, size: 8, font, color: gray });
  y -= (logoDims.height + 16);

  const titleText = "Income & Cost Budget Report";
  page.drawText(titleText, { x: tableX, y, size: 16, font: bold, color: ink });
  y -= 8;
  page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  page.drawText(`Project: ${p.inv.projectName}`, { x: tableX, y, size: 10.5, font: bold, color: ink });
  y -= 14;
  page.drawText(`Invoice #${p.inv.number} · Client: ${p.inv.clientName} · Date: ${p.inv.date}`, { x: tableX, y, size: 9, font, color: gray });
  y -= 26;

  const border = rgb(0, 0, 0);
  const rowH = 22;
  const col1 = tableW * 0.55, col2 = tableW * 0.2, col3 = tableW * 0.25;

  const headerRow = (labels) => {
    let x = tableX;
    const widths = [col1, col2, col3];
    page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: rgb(0.91, 0.87, 0.97), borderColor: border, borderWidth: 1 });
    labels.forEach((label, i) => {
      page.drawText(label, { x: x + 6, y: y - rowH + 7, size: 9.5, font: bold, color: ink });
      if (i > 0) page.drawLine({ start: { x, y }, end: { x, y: y - rowH }, thickness: 1, color: border });
      x += widths[i];
    });
    page.drawLine({ start: { x: tableX, y: y - rowH }, end: { x: tableX + tableW, y: y - rowH }, thickness: 1, color: border });
    y -= rowH;
  };

  const dataRow = (a, b, c, opts = {}) => {
    const widths = [col1, col2, col3];
    const vals = [a, b, c];
    let x = tableX;
    if (opts.fill) page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: rgb(0.95, 0.95, 0.95) });
    page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, borderColor: border, borderWidth: 1 });
    vals.forEach((v, i) => {
      const f = opts.bold ? bold : font;
      const align = i === 0 ? "left" : "right";
      const size = 9.5;
      if (align === "left") {
        page.drawText(v, { x: x + 6, y: y - rowH + 7, size, font: f, color: ink });
      } else {
        const w = f.widthOfTextAtSize(v, size);
        page.drawText(v, { x: x + widths[i] - w - 6, y: y - rowH + 7, size, font: f, color: ink });
      }
      if (i > 0) page.drawLine({ start: { x, y }, end: { x, y: y - rowH }, thickness: 1, color: border });
      x += widths[i];
    });
    y -= rowH;
  };

  headerRow(["Line item", "Type", "Amount (USD)"]);
  dataRow("Prizepool (billed to client)", "Income", usdFmt(p.inv.prizepool));
  dataRow("Total Event Cost (billed to client)", "Income", usdFmt(p.inv.eventCost));
  dataRow(`Service Charge (${p.inv.serviceChargePct}%)`, "Income", usdFmt(p.inv.serviceChargeAmt));
  dataRow("Gross Income (Invoice Grand Total)", "Subtotal", usdFmt(p.grossIncome), { bold: true, fill: true });

  p.expenses.forEach((x) => dataRow(`${x.category}${x.description ? " - " + x.description : ""}`, "Expense", `- ${usdFmt(x.amount)}`));
  dataRow("Total Internal Expenses", "Subtotal", `- ${usdFmt(p.totalExpense)}`, { bold: true, fill: true });

  y -= 6;
  dataRow("NET PROFIT", "", usdFmt(p.netProfit), { bold: true, fill: true });

  y -= 20;
  if (p.remittances.length > 0) {
    page.drawText("Bank Remittances (USD -> BDT)", { x: tableX, y, size: 11, font: bold, color: ink });
    y -= 16;
    p.remittances.forEach((r) => {
      page.drawText(`${r.date} - ${usdFmt(r.usdReceived)} @ ${r.fxRate} = ${bdtFmtAscii(r.usdReceived * r.fxRate)}`, { x: tableX, y, size: 9, font, color: gray });
      y -= 13;
    });
  }

  y -= 10;
  page.drawText("Generated by RTB Esports Accounting - for internal budgeting use.", { x: tableX, y, size: 7.5, font, color: gray });

  return pdfDoc.save();
}

export default function App() {
  // undefined = still checking for an existing session, null = logged out, object = logged in
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: BG, minHeight: "100%", color: MUTED }} className="w-full min-h-full flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }
  if (!session) return <LoginGate />;
  return <AppShell onLogout={() => supabase.auth.signOut()} userEmail={session.user.email} />;
}

function LoginGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
    // On success, the onAuthStateChange listener in App() picks up the new
    // session automatically — no local state to flip here.
  };

  return (
    <div style={{ background: BG, minHeight: "100%", color: TEXT }} className="w-full min-h-full flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border p-6" style={{ borderColor: BORDER, background: CARD }}>
        <div className="flex flex-col items-center mb-5">
          <img src={RTB_LOGO_DATA_URI} alt="RAHAT THE BRAND" style={{ height: 64 }} className="mb-2" />
          <p className="text-xs" style={{ color: MUTED }}>RTB Esports · Accounting — Admin Access</p>
        </div>
        <label className="block text-xs mb-1" style={{ color: MUTED }}>Email</label>
        <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
        <label className="block text-xs mb-1" style={{ color: MUTED }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
        {error && <p className="text-xs mb-3" style={{ color: BAD }}>{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-2 disabled:opacity-50" style={{ background: ACCENT }}>
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p className="text-xs mt-4 leading-relaxed" style={{ color: MUTED }}>
          Real access control + Row Level Security — see <b>ACCOUNTING_</b>.
          There's no self-signup; an admin has to invite each account from the Server dashboard
          (Authentication → Users → Invite user) before they can log in here.
        </p>
      </form>
    </div>
  );
}

function AppShell({ onLogout, userEmail }) {
  const [tab, setTab] = useState("studio");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Shared folder/file state (used by PDF Studio and fed by the Invoice Generator).
  // Populated from Supabase on mount — see loadAll() below.
  const [folders, setFolders] = useState([{ id: "root", name: "All Files", parentId: null }]);
  const [files, setFiles] = useState([]);
  // Invoices (Invoice Generator module) — from the `invoices` table.
  const [invoices, setInvoices] = useState([]);
  // Projects for costing (one per invoice, keyed by invoice id) — from
  // `event_expenses` / `bank_remittances`, nested under each invoice.
  const [costing, setCosting] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setLoadError("");
      try {
        // ---- PDF Studio: folders (seed the four defaults on a brand-new project) ----
        let { data: folderRows, error: folderErr } = await supabase.from("studio_folders").select("*");
        if (folderErr) throw folderErr;
        if (!folderRows || folderRows.length === 0) {
          const { data: created, error: seedErr } = await supabase
            .from("studio_folders")
            .insert(DEFAULT_FOLDERS.map((name) => ({ name, parent_id: null })))
            .select();
          if (seedErr) throw seedErr;
          folderRows = created || [];
        }
        const mappedFolders = [{ id: "root", name: "All Files", parentId: null }, ...folderRows.map(dbFolderToApp)];

        // ---- PDF Studio: files (each gets a fresh 1-hour signed URL) ----
        const { data: fileRows, error: fileErr } = await supabase.from("studio_files").select("*");
        if (fileErr) throw fileErr;
        const mappedFiles = await Promise.all(
          (fileRows || []).map(async (f) => dbFileToApp(f, await getSignedUrl(f.storage_path).catch(() => null)))
        );

        // ---- Invoices + nested costing ----
        const { data: invRows, error: invErr } = await supabase
          .from("invoices").select("*, event_expenses(*), bank_remittances(*)")
          .order("created_at", { ascending: true });
        if (invErr) throw invErr;
        const mappedInvoices = (invRows || []).map(dbInvoiceToApp);
        const mappedCosting = {};
        (invRows || []).forEach((row) => {
          mappedCosting[row.id] = {
            expenses: (row.event_expenses || []).map(dbExpenseToApp),
            remittances: (row.bank_remittances || []).map(dbRemittanceToApp),
          };
        });

        if (!cancelled) {
          setFolders(mappedFolders);
          setFiles(mappedFiles);
          setInvoices(mappedInvoices);
          setCosting(mappedCosting);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, []);

  const ensureCosting = (invoiceId) => setCosting((prev) => (prev[invoiceId] ? prev : { ...prev, [invoiceId]: { expenses: [], remittances: [] } }));

  // Finds (or creates, in Supabase) a top-level folder by name, uploads the
  // blob into Storage under it, and registers a studio_files row — used for
  // invoices, remittance slips, and event reports landing in PDF Studio.
  const addFileToFolderByName = useCallback(async (folderName, { name, blob, size }) => {
    let target = folders.find((f) => f.name === folderName && f.parentId === "root");
    if (!target) {
      const { data, error } = await supabase.from("studio_folders").insert({ name: folderName, parent_id: null }).select().single();
      if (error) { console.error(error); return; }
      target = dbFolderToApp(data);
      setFolders((prev) => [...prev, target]);
    }
    const storagePath = `${target.name}/${uid()}-${name}`;
    try {
      await uploadDocument(storagePath, blob);
      const { data: fileRow, error } = await supabase
        .from("studio_files")
        .insert({ folder_id: target.id, name, storage_path: storagePath, size_bytes: size, notes: [] })
        .select().single();
      if (error) throw error;
      const url = await getSignedUrl(storagePath).catch(() => URL.createObjectURL(blob));
      setFiles((prev) => [...prev, dbFileToApp(fileRow, url)]);
    } catch (err) {
      console.error("Failed to save file to Supabase Storage:", err);
    }
  }, [folders]);

  const handleSaveInvoice = useCallback(async (inv) => {
    const { data, error } = await supabase.from("invoices").insert(appInvoiceToDbInsert(inv)).select().single();
    if (error) { console.error(error); return; }
    const saved = dbInvoiceToApp(data);
    setInvoices((prev) => [...prev, saved]);
    ensureCosting(saved.id);
  }, []);

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100%", color: MUTED }} className="w-full min-h-full flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100%", color: TEXT, fontFamily: "'Segoe UI', system-ui, sans-serif" }} className="w-full min-h-full">
      <TopBar tab={tab} setTab={setTab} onLogout={onLogout} userEmail={userEmail} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <div className="rounded-lg border px-3 py-2 mb-4 text-xs" style={{ borderColor: BAD, color: BAD, background: "rgba(220,38,38,0.06)" }}>
            Couldn't load saved data from Supabase: {loadError}. Check that ACCOUNTING_SCHEMA.sql has been run
            and your .env values are correct — see the README.
          </div>
        )}
        {tab === "studio" && (
          <PdfStudio folders={folders} setFolders={setFolders} files={files} setFiles={setFiles} />
        )}
        {tab === "invoices" && (
          <InvoiceGenerator
            invoices={invoices}
            onSave={handleSaveInvoice}
            onFileReady={(name, blob) => addFileToFolderByName("Invoices", { name, blob, size: blob.size })}
          />
        )}
        {tab === "costing" && (
          <CostingDashboard invoices={invoices} costing={costing} setCosting={setCosting}
            onSlipUpload={(name, blob) => addFileToFolderByName("Remittance Slips", { name, blob, size: blob.size })}
            onReportReady={(name, blob) => addFileToFolderByName("Event Reports", { name, blob, size: blob.size })} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// BRAND HEADER + TAB NAV
// ============================================================
function TopBar({ tab, setTab, onLogout, userEmail }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, background: BG }} className="px-4 sm:px-6 pt-5">
      <div className="max-w-6xl mx-auto flex items-end gap-1">
        <div className="flex items-center gap-2 mr-4 pb-3 shrink-0">
          <img src={RTB_LOGO_DATA_URI} alt="RAHAT THE BRAND" style={{ height: 34 }} />
          <p className="text-xs" style={{ color: MUTED }}>RTB Esports · Accounting</p>
        </div>
        <TabButton label="PDF Studio" icon={Folder} active={tab === "studio"} onClick={() => setTab("studio")} />
        <TabButton label="Invoice Generator" icon={FileSignature} active={tab === "invoices"} onClick={() => setTab("invoices")} />
        <TabButton label="Costing & Profit" icon={Wallet} active={tab === "costing"} onClick={() => setTab("costing")} />
        <div className="ml-auto flex items-center gap-3 mb-3 shrink-0">
          {userEmail && <p className="text-xs hidden sm:block" style={{ color: MUTED }}>{userEmail}</p>}
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg border shrink-0" style={{ borderColor: BORDER, color: MUTED }}>Log out</button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: active ? CARD : "transparent", color: active ? TEXT : MUTED,
        borderTopLeftRadius: 10, borderTopRightRadius: 10,
        border: active ? `1px solid ${BORDER}` : "1px solid transparent",
        borderBottom: active ? `1px solid ${CARD}` : "none", marginBottom: -1,
      }}>
      <Icon size={15} color={active ? ACCENT : MUTED} />
      {label}
    </button>
  );
}

// ============================================================
// MODULE 1 — PDF & FOLDER MANAGEMENT STUDIO
// ============================================================
function PdfStudio({ folders, setFolders, files, setFiles }) {
  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef(null);

  const path = useMemo(() => {
    const p = [];
    let cur = folders.find((f) => f.id === currentFolderId);
    while (cur) { p.unshift(cur); cur = folders.find((f) => f.id === cur.parentId); }
    return p;
  }, [folders, currentFolderId]);

  const subFolders = folders.filter((f) => f.parentId === currentFolderId);
  const currentFiles = files.filter((f) => f.folderId === currentFolderId);

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderName(""); setShowNewFolder(false);
    const { data, error } = await supabase
      .from("studio_folders")
      .insert({ name, parent_id: currentFolderId === "root" ? null : currentFolderId })
      .select().single();
    if (error) { console.error(error); return; }
    setFolders((prev) => [...prev, dbFolderToApp(data)]);
  };

  const handleFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (incoming.length === 0) return;
    for (const f of incoming) {
      const storagePath = `${currentFolderId}/${uid()}-${f.name}`;
      try {
        await uploadDocument(storagePath, f);
        const { data, error } = await supabase
          .from("studio_files")
          .insert({ folder_id: currentFolderId === "root" ? null : currentFolderId, name: f.name, storage_path: storagePath, size_bytes: f.size, notes: [] })
          .select().single();
        if (error) throw error;
        const url = await getSignedUrl(storagePath).catch(() => URL.createObjectURL(f));
        setFiles((prev) => [...prev, dbFileToApp(data, url)]);
      } catch (err) {
        console.error("Failed to upload PDF to Supabase Storage:", err);
      }
    }
  }, [currentFolderId, setFiles]);

  const deleteFolder = async (id) => {
    const toDelete = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((f) => { if (toDelete.has(f.parentId) && !toDelete.has(f.id)) { toDelete.add(f.id); changed = true; } });
    }
    const orphanedPaths = files.filter((f) => toDelete.has(f.folderId) && f.storagePath).map((f) => f.storagePath);
    setFolders((prev) => prev.filter((f) => !toDelete.has(f.id)));
    setFiles((prev) => prev.filter((f) => !toDelete.has(f.folderId)));
    if (toDelete.has(currentFolderId)) setCurrentFolderId("root");
    // Cascade delete on studio_folders removes the studio_files rows automatically;
    // we still need to clean up the actual objects in Storage ourselves.
    const { error } = await supabase.from("studio_folders").delete().in("id", Array.from(toDelete));
    if (error) console.error(error);
    deleteDocuments(orphanedPaths).catch((err) => console.error(err));
  };
  const deleteFile = async (id) => {
    const file = files.find((f) => f.id === id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    const { error } = await supabase.from("studio_files").delete().eq("id", id);
    if (error) console.error(error);
    if (file?.storagePath) deleteDocuments([file.storagePath]).catch((err) => console.error(err));
  };

  const startRename = (id, current) => { setRenamingId(id); setRenameValue(current); };
  const commitRenameFolder = async (id) => {
    const newName = renameValue.trim();
    setRenamingId(null);
    if (!newName) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
    const { error } = await supabase.from("studio_folders").update({ name: newName }).eq("id", id);
    if (error) console.error(error);
  };
  const commitRenameFile = async (id) => {
    const newName = renameValue.trim();
    setRenamingId(null);
    if (!newName) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
    const { error } = await supabase.from("studio_files").update({ name: newName }).eq("id", id);
    if (error) console.error(error);
  };

  const moveFile = async (fileId, targetFolderId) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, folderId: targetFolderId } : f)));
    const { error } = await supabase.from("studio_files").update({ folder_id: targetFolderId === "root" ? null : targetFolderId }).eq("id", fileId);
    if (error) console.error(error);
  };

  const saveEditedFile = async (fileId, blob, newNotes) => {
    const file = files.find((f) => f.id === fileId);
    const url = URL.createObjectURL(blob);
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, url, notes: newNotes } : f)));
    setEditorFile((p) => (p ? { ...p, url, notes: newNotes } : p));
    if (!file?.storagePath) return; // shouldn't happen, but don't crash the UI if it does
    try {
      await uploadDocument(file.storagePath, blob); // upsert: true — overwrites the same object
      const { error } = await supabase.from("studio_files").update({ notes: newNotes }).eq("id", fileId);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to save edited PDF to Supabase Storage:", err);
    }
  };

  const allFoldersFlat = folders.filter((f) => f.id !== "root");

  return (
    <div>
      <div className="flex items-center gap-1 text-sm mb-4 flex-wrap" style={{ color: MUTED }}>
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={13} />}
            <button onClick={() => setCurrentFolderId(p.id)} className="hover:underline flex items-center gap-1"
              style={{ color: i === path.length - 1 ? TEXT : MUTED, fontWeight: i === path.length - 1 ? 600 : 400 }}>
              {i === 0 && <Home size={13} />}
              {p.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewFolder((s) => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: BORDER, background: CARD, color: TEXT }}>
            <FolderPlus size={15} /> New folder
          </button>
          {showNewFolder && (
            <div className="flex items-center gap-1">
              <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()}
                placeholder="Folder name" className="px-2 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
              <button onClick={createFolder} className="p-2 rounded-lg" style={{ background: ACCENT, color: "white" }}><Check size={15} /></button>
            </div>
          )}
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: ACCENT }}>
          <Upload size={15} /> Upload PDF
        </button>
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className="rounded-xl border-2 border-dashed mb-6 flex flex-col items-center justify-center py-8 text-center transition-colors"
        style={{ borderColor: dragOver ? ACCENT : BORDER, background: dragOver ? ACCENT_SOFT : CARD }}>
        <Upload size={22} color={dragOver ? ACCENT : MUTED} />
        <p className="text-sm mt-2" style={{ color: MUTED }}>Drag &amp; drop PDF files here, or use the Upload button</p>
      </div>

      {subFolders.length > 0 && (
        <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {subFolders.map((f) => (
            <div key={f.id} className="group relative rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: BORDER, background: CARD }} onClick={() => renamingId !== f.id && setCurrentFolderId(f.id)}>
              <Folder size={26} color={ACCENT} />
              {renamingId === f.id ? (
                <input autoFocus value={renameValue} onClick={(e) => e.stopPropagation()} onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitRenameFolder(f.id)} onBlur={() => commitRenameFolder(f.id)}
                  className="w-full mt-2 px-1 py-0.5 text-sm rounded border" style={{ background: CARD_ALT, borderColor: ACCENT, color: TEXT }} />
              ) : (
                <p className="text-sm font-medium mt-2 truncate">{f.name}</p>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); startRename(f.id, f.name); }} style={{ color: MUTED }}><Pencil size={13} /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }} style={{ color: BAD }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentFiles.length === 0 && subFolders.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: MUTED }}>This folder is empty. Upload a PDF to get started.</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
          {currentFiles.map((f) => (
            <div key={f.id} className="group relative rounded-xl border p-4 hover:shadow-sm transition-shadow" style={{ borderColor: BORDER, background: CARD }}>
              <FileText size={26} color={ACCENT} />
              {renamingId === f.id ? (
                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitRenameFile(f.id)} onBlur={() => commitRenameFile(f.id)}
                  className="w-full mt-2 px-1 py-0.5 text-sm rounded border" style={{ background: CARD_ALT, borderColor: ACCENT, color: TEXT }} />
              ) : (
                <p className="text-sm font-medium mt-2 truncate">{f.name}</p>
              )}
              <p className="text-xs" style={{ color: MUTED }}>{(f.size / 1024).toFixed(0)} KB</p>
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <button onClick={() => setEditorFile(f)} className="text-xs px-2 py-1 rounded-md font-medium text-white" style={{ background: ACCENT }}>Edit</button>
                <button onClick={() => window.open(f.url, "_blank")} className="text-xs px-2 py-1 rounded-md border" style={{ borderColor: BORDER, color: TEXT }}>View</button>
                <button onClick={() => startRename(f.id, f.name)} className="text-xs px-1.5 py-1 rounded-md" style={{ color: MUTED }}><Pencil size={13} /></button>
                <select onChange={(e) => e.target.value && moveFile(f.id, e.target.value)} value="" className="text-xs px-1 py-1 rounded-md border" style={{ borderColor: BORDER, background: CARD_ALT, color: MUTED }}>
                  <option value="">Move to…</option>
                  <option value="root">All Files</option>
                  {allFoldersFlat.map((fo) => (<option key={fo.id} value={fo.id}>{fo.name}</option>))}
                </select>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteFile(f.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded" style={{ color: BAD }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editorFile && (
        <PdfFullPageEditor file={editorFile} onClose={() => setEditorFile(null)} onSaveFile={(blob, newNotes) => saveEditedFile(editorFile.id, blob, newNotes)} />
      )}
    </div>
  );
}

// ============================================================
// FULL-PAGE PDF EDITOR — real in-place text editing
// ============================================================
function PdfFullPageEditor({ file, onClose, onSaveFile }) {
  const [engineReady, setEngineReady] = useState(false);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [textItems, setTextItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [mode, setMode] = useState("edit");
  const [notes, setNotes] = useState(file.notes || []);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [fontSize, setFontSize] = useState(16);
  const [noteColor, setNoteColor] = useState("#8A2BE2");
  const [align, setAlign] = useState("left");

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const docRef = useRef(null);
  const pageItemsRef = useRef({});
  const dragState = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPdfEngines()
      .then(() => fetch(file.url))
      .then((r) => r.arrayBuffer())
      .then((buf) => window.pdfjsLib.getDocument({ data: buf }).promise)
      .then((doc) => { if (cancelled) return; docRef.current = doc; setNumPages(doc.numPages); setEngineReady(true); })
      .catch((err) => setError(err?.message || "Couldn't load the PDF editing engine (needs internet access)."));
    return () => { cancelled = true; };
  }, [file.url]);

  useEffect(() => {
    if (!engineReady || !docRef.current) return;
    let cancelled = false;
    setRendering(true);
    renderPage(pageNum, scale).finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, pageNum, scale]);

  async function renderPage(num, sc) {
    try {
      const page = await docRef.current.getPage(num);
      const viewport = page.getViewport({ scale: sc });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.style.width = viewport.width + "px"; canvas.style.height = viewport.height + "px";
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const content = await page.getTextContent();
      const items = content.items.map((item, idx) => {
        const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
        return { idx, str: item.str, left: tx[4], top: tx[5] - fontHeight, fontHeight,
          width: Math.max(item.width * sc, fontHeight * 0.6 * Math.max(item.str.length, 1)),
          pdfTransform: item.transform, pdfWidth: item.width };
      }).filter((it) => it.str.trim() !== "");
      pageItemsRef.current[num] = items;
      setTextItems(items);
    } catch (err) { setError(err?.message || "Couldn't render this page."); }
  }

  const editedText = (idx, original) => edits[`${pageNum}-${idx}`] ?? original;
  const onTextBlur = (idx, e) => setEdits((prev) => ({ ...prev, [`${pageNum}-${idx}`]: e.target.innerText }));
  const addNote = (x, y) => setNotes((prev) => [...prev, { id: uid(), page: pageNum, x, y, text: "New note", fontFamily, fontSize, color: noteColor, align }]);
  const updateNote = (id, patch) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const removeNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const onOverlayClick = (e) => {
    if (mode !== "note") return;
    const rect = overlayRef.current.getBoundingClientRect();
    addNote(((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
  };
  const startDrag = (e, id) => { e.stopPropagation(); dragState.current = { id }; };
  const onMouseMove = (e) => {
    if (!dragState.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateNote(dragState.current.id, { x, y });
  };
  const endDrag = () => { dragState.current = null; };
  const editCount = Object.keys(edits).length;

  async function handleSaveDownload() {
    setSaving(true); setError(null);
    try {
      const bytes = await fetch(file.url).then((r) => r.arrayBuffer());
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const pdfDoc = await PDFDocument.load(bytes);
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      Object.entries(edits).forEach(([key, newText]) => {
        const [pg, idxStr] = key.split("-");
        const pgNum = Number(pg); const idx = Number(idxStr);
        const items = pageItemsRef.current[pgNum];
        const item = items && items[idx];
        const page = pages[pgNum - 1];
        if (!item || !page) return;
        const [a, b, c, d, e, f] = item.pdfTransform;
        const fSize = Math.hypot(c, d) || Math.hypot(a, b) || 12;
        page.drawRectangle({ x: e - 1, y: f - fSize * 0.28, width: item.pdfWidth + 3, height: fSize * 1.2, color: rgb(1, 1, 1) });
        if (newText.trim() !== "") page.drawText(newText, { x: e, y: f, size: fSize, font: helv, color: rgb(0.1, 0.05, 0.2) });
      });
      const newBytes = await pdfDoc.save();
      const blob = new Blob([newBytes], { type: "application/pdf" });
      const newUrl = URL.createObjectURL(blob);
      onSaveFile(blob, notes);
      const a = document.createElement("a");
      a.href = newUrl; a.download = file.name.replace(/\.pdf$/i, "") + "-edited.pdf";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { setError("Couldn't save the edited PDF: " + (err?.message || err)); }
    finally { setSaving(false); }
  }

  const pageNotes = notes.filter((n) => n.page === pageNum);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: CARD }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ borderColor: BORDER }}>
        <p className="font-medium text-sm truncate pr-2">{file.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleSaveDownload} disabled={saving || !engineReady} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: ACCENT }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : editCount > 0 ? `Save & download (${editCount} edit${editCount > 1 ? "s" : ""})` : "Download"}
          </button>
          <button onClick={() => window.open(file.url, "_blank")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: BORDER, color: TEXT }}>
            <Printer size={14} /> Print
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: MUTED }}><X size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b text-xs shrink-0" style={{ borderColor: BORDER, background: CARD_ALT }}>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: BORDER }}>
          <button onClick={() => setMode("edit")} className="flex items-center gap-1 px-2.5 py-1.5 font-medium" style={{ background: mode === "edit" ? ACCENT : CARD, color: TEXT }}>
            <Type size={13} /> Edit existing text
          </button>
          <button onClick={() => setMode("note")} className="flex items-center gap-1 px-2.5 py-1.5 font-medium" style={{ background: mode === "note" ? ACCENT : CARD, color: TEXT }}>
            <StickyNote size={13} /> Add note
          </button>
        </div>
        {mode === "note" && (
          <>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="px-2 py-1.5 rounded-lg border" style={{ borderColor: BORDER, background: CARD, color: TEXT }}>
              {FONT_FAMILIES.map((f) => (<option key={f} value={f}>{f.split(",")[0].replace(/'/g, "")}</option>))}
            </select>
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="px-2 py-1.5 rounded-lg border" style={{ borderColor: BORDER, background: CARD, color: TEXT }}>
              {[10, 12, 14, 16, 20, 24, 32].map((s) => (<option key={s} value={s}>{s}px</option>))}
            </select>
            <input type="color" value={noteColor} onChange={(e) => setNoteColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border" style={{ borderColor: BORDER }} />
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: BORDER }}>
              {["left", "center", "right"].map((a) => (<button key={a} onClick={() => setAlign(a)} className="px-2 py-1.5" style={{ background: align === a ? ACCENT : CARD, color: TEXT }}>{a[0].toUpperCase()}</button>))}
            </div>
            <span style={{ color: MUTED }}>Click the page to drop a note</span>
          </>
        )}
        {mode === "edit" && <span style={{ color: MUTED }}>Click directly on any text below and type to replace it</span>}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ background: DARKVIEW, color: "#DDD" }}>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}><ChevronLeft size={16} /></button>
          <span>{pageNum} / {numPages}</span>
          <button onClick={() => setPageNum((p) => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setScale((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}><ZoomOut size={15} /></button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}><ZoomIn size={15} /></button>
        </div>
      </div>

      {!engineReady && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ background: DARKVIEW, color: "#CCC" }}>
          <Loader2 size={22} className="animate-spin" /><p className="text-sm">Loading the PDF editing engine…</p>
        </div>
      )}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center" style={{ background: DARKVIEW, color: "#F3D9C4" }}>
          <AlertTriangle size={22} /><p className="text-sm max-w-md">{error}</p>
          <button onClick={() => window.open(file.url, "_blank")} className="text-xs underline mt-1">Open the original PDF in a new tab instead</button>
        </div>
      )}
      {engineReady && !error && (
        <div className="flex-1 overflow-auto flex justify-center py-6" style={{ background: DARKVIEW }}>
          <div ref={overlayRef} onClick={onOverlayClick} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
            className="relative shrink-0" style={{ cursor: mode === "note" ? "crosshair" : "default" }}>
            <canvas ref={canvasRef} style={{ display: "block", background: "white" }} />
            {rendering && (<div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,1,19,0.5)" }}><Loader2 size={20} className="animate-spin" color="white" /></div>)}
            {mode === "edit" && !rendering && textItems.map((t) => (
              <div key={`${pageNum}-${t.idx}`} contentEditable suppressContentEditableWarning onBlur={(e) => onTextBlur(t.idx, e)}
                className="absolute outline-none"
                style={{ left: t.left, top: t.top, width: t.width, minHeight: t.fontHeight * 1.15, fontSize: t.fontHeight, lineHeight: `${t.fontHeight * 1.15}px`,
                  fontFamily: "Arial, sans-serif", color: "#1B2430", background: "white", border: "1px dashed rgba(138,43,226,0.4)", whiteSpace: "pre", overflow: "visible", padding: "0 1px" }}>
                {editedText(t.idx, t.str)}
              </div>
            ))}
            <div className="absolute inset-0" style={{ pointerEvents: mode === "note" ? "auto" : "none" }}>
              {pageNotes.map((n) => (
                <div key={n.id} onMouseDown={(e) => startDrag(e, n.id)} className="absolute group" style={{ left: `${n.x}%`, top: `${n.y}%`, cursor: "move", pointerEvents: "auto" }}>
                  <div contentEditable suppressContentEditableWarning onBlur={(e) => updateNote(n.id, { text: e.target.innerText })}
                    className="px-1.5 py-0.5 rounded outline-none" style={{ fontFamily: n.fontFamily, fontSize: n.fontSize, color: n.color, textAlign: n.align, background: "rgba(255,235,180,0.95)", border: "1px dashed rgba(0,0,0,0.25)", minWidth: 40 }}>
                    {n.text}
                  </div>
                  <button onClick={() => removeNote(n.id)} className="absolute -top-2 -right-2 rounded-full opacity-0 group-hover:opacity-100 p-0.5" style={{ background: BAD, color: "white" }}><X size={10} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="text-xs px-4 py-2 shrink-0" style={{ color: MUTED, borderTop: `1px solid ${BORDER}` }}>
        "Edit existing text" writes the real text into the PDF file when you press Save. Print opens the PDF in a new tab —
        that's the browser's own vector renderer, so it prints crisp at full resolution (no rasterization/blur).
      </p>
    </div>
  );
}

// ============================================================
// MODULE 2 — INVOICE GENERATOR
// ============================================================
function InvoiceGenerator({ invoices, onSave, onFileReady }) {
  const [form, setForm] = useState({
    number: `RE${1031 + invoices.length}`,
    date: new Date().toISOString().slice(0, 10),
    projectName: "FREE FIRE TALENT HUNT 2026",
    edition: "Chittagong University Edition",
    clientName: "Garena Online Private Limited",
    clientAddress: "1 Fusionopolis Place, #17-10 Galaxis.",
    prizepool: "", eventCost: "", serviceChargePct: "10",
    bankName: "EASTERN BANK LIMITED", bankAccNo: "1321570000162", bankAccName: "SHOHEL HOSSAN",
    swiftCode: "EBLDBDDHXXX", routingNumber: "095260226",
  });
  const [generating, setGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [lastSavedUrl, setLastSavedUrl] = useState(null);

  const prizepool = parseFloat(form.prizepool) || 0;
  const eventCost = parseFloat(form.eventCost) || 0;
  const pct = parseFloat(form.serviceChargePct) || 0;
  const subtotal = prizepool + eventCost;
  const serviceChargeAmt = subtotal * (pct / 100);
  const grandTotal = subtotal + serviceChargeAmt;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const inv = { id: uid(), ...form, prizepool, eventCost, serviceChargePct: pct, subtotal, serviceChargeAmt, grandTotal };
      const bytes = await buildInvoicePdfBytes(inv);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      onFileReady(`Invoice-${inv.number}.pdf`, blob);
      await onSave(inv);
      setLastSaved(inv);
      setLastSavedUrl(url);
      // Auto-download immediately, so it's on the person's device even before
      // any server-side storage is wired up.
      const a = document.createElement("a");
      a.href = url; a.download = `Invoice-${inv.number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setForm((f) => ({ ...f, number: `RE${1031 + invoices.length + 1}`, prizepool: "", eventCost: "" }));
    } catch (err) {
      alert("Couldn't generate the PDF: " + (err?.message || err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleGenerate} className="rounded-xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-sm font-semibold mb-4 flex items-center gap-2"><FileSignature size={16} color={ACCENT} /> New Invoice</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <LField label="Invoice #"><Input value={form.number} onChange={(v) => setForm((f) => ({ ...f, number: v }))} /></LField>
            <LField label="Date"><Input type="date" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} /></LField>
          </div>
          <LField label="Project Name" className="mb-3"><Input value={form.projectName} onChange={(v) => setForm((f) => ({ ...f, projectName: v }))} /></LField>
          <LField label="Edition" className="mb-3"><Input value={form.edition} onChange={(v) => setForm((f) => ({ ...f, edition: v }))} /></LField>
          <LField label="Client Name" className="mb-3"><Input value={form.clientName} onChange={(v) => setForm((f) => ({ ...f, clientName: v }))} /></LField>
          <LField label="Client Address" className="mb-3"><textarea value={form.clientAddress} onChange={(e) => setForm((f) => ({ ...f, clientAddress: e.target.value }))} rows={2} className="w-full px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} /></LField>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <LField label="Prizepool ($)"><Input type="number" value={form.prizepool} onChange={(v) => setForm((f) => ({ ...f, prizepool: v }))} required /></LField>
            <LField label="Event Cost ($)"><Input type="number" value={form.eventCost} onChange={(v) => setForm((f) => ({ ...f, eventCost: v }))} required /></LField>
            <LField label="Service Charge (%)"><Input type="number" value={form.serviceChargePct} onChange={(v) => setForm((f) => ({ ...f, serviceChargePct: v }))} required /></LField>
          </div>

          <div className="rounded-lg p-3 mb-4 text-sm space-y-1" style={{ background: CARD_ALT, border: `1px solid ${BORDER}` }}>
            <Row label="Subtotal" value={usdFmt(subtotal)} />
            <Row label={`Service Charge (${pct || 0}%)`} value={usdFmt(serviceChargeAmt)} />
            <Row label="Grand Total" value={usdFmt(grandTotal)} bold accent />
            <p className="text-xs pt-1" style={{ color: MUTED }}>{grandTotal > 0 ? amountToWords(grandTotal) : ""}</p>
          </div>

          <details className="mb-4 text-sm">
            <summary className="cursor-pointer font-medium" style={{ color: MUTED }}>Bank details (fixed, editable)</summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <LField label="Bank Name"><Input value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} /></LField>
              <LField label="Account No"><Input value={form.bankAccNo} onChange={(v) => setForm((f) => ({ ...f, bankAccNo: v }))} /></LField>
              <LField label="Account Name"><Input value={form.bankAccName} onChange={(v) => setForm((f) => ({ ...f, bankAccName: v }))} /></LField>
              <LField label="SWIFT Code"><Input value={form.swiftCode} onChange={(v) => setForm((f) => ({ ...f, swiftCode: v }))} /></LField>
              <LField label="Routing Number"><Input value={form.routingNumber} onChange={(v) => setForm((f) => ({ ...f, routingNumber: v }))} /></LField>
            </div>
          </details>

          <button type="submit" disabled={generating} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>
            {generating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {generating ? "Generating PDF…" : "Generate & Save Invoice"}
          </button>
          <p className="text-xs mt-2 text-center" style={{ color: MUTED }}>Saves a real PDF into PDF Studio → Invoices, and opens a costing project for it.</p>
        </form>

        {/* Live preview (mirrors your sample layout) */}
        <div className="rounded-xl border p-6 text-sm" style={{ borderColor: BORDER, background: "#FFFFFF", color: "#1B2430" }}>
          <div className="flex items-start justify-between mb-4">
            <img src={RTB_LOGO_DATA_URI} alt="RAHAT THE BRAND" style={{ height: 56 }} />
            <div className="text-right">
              <p className="font-bold text-xl px-3 py-1" style={{ background: "#111", color: "#fff" }}>INVOICE</p>
              <p className="text-xs mt-1">Invoice #{form.number}</p>
              <p className="text-xs">Date: {form.date}</p>
            </div>
          </div>
          <div className="mb-3 p-2 rounded" style={{ background: "#F5F5F5" }}>
            <p className="font-semibold text-xs">Project Details -</p>
            <p className="text-xs">Name - {form.projectName}</p>
            <p className="text-xs">Edition - {form.edition}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4 p-2 rounded text-xs" style={{ background: "#F5F5F5" }}>
            <div><p className="font-semibold">From:</p><p>R.T.B Esports</p><p>Plot-34, Sonargaon Janpath Road, Sector-11,</p><p>Uttara-1230, Dhaka.</p></div>
            <div><p className="font-semibold">To:</p><p>{form.clientName}</p><p style={{ whiteSpace: "pre-line" }}>{form.clientAddress}</p></div>
          </div>
          <table className="w-full text-xs mb-3">
            <thead><tr style={{ background: "#F5F5F5" }}><th className="text-left p-1">SL</th><th className="text-left p-1">Description</th><th className="text-right p-1">Amount</th></tr></thead>
            <tbody>
              <tr><td className="p-1">01.</td><td className="p-1">Prizepool</td><td className="p-1 text-right">{usdFmt(prizepool)}</td></tr>
              <tr><td className="p-1">02.</td><td className="p-1">Total Event Cost</td><td className="p-1 text-right">{usdFmt(eventCost)}</td></tr>
            </tbody>
          </table>
          <div className="flex justify-end mb-3">
            <div className="w-48 text-xs space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{usdFmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>Service Charge</span><span>{usdFmt(serviceChargeAmt)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{usdFmt(grandTotal)}</span></div>
            </div>
          </div>
          <p className="text-xs italic mb-3">IN WORDS :- {grandTotal > 0 ? amountToWords(grandTotal) : "—"}</p>
          <table className="w-full text-xs" style={{ border: "1px solid #111" }}>
            <thead><tr><th colSpan={2} className="p-2 font-bold text-sm" style={{ border: "1px solid #111" }}>PAYMENT DETAILS</th></tr></thead>
            <tbody>
              {[["BANK", form.bankName], ["BANK ACC NO", form.bankAccNo], ["ACCOUNT NAME", form.bankAccName], ["SWIFT CODE", form.swiftCode], ["ROUTING NUMBER", form.routingNumber]].map(([k, v]) => (
                <tr key={k}>
                  <td className="p-2 font-semibold w-1/3" style={{ border: "1px solid #111" }}>{k}</td>
                  <td className="p-2" style={{ border: "1px solid #111" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lastSaved && (
        <div className="mt-4 rounded-lg border p-3 flex items-center justify-between flex-wrap gap-2" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-xs" style={{ color: GOOD }}>Saved Invoice #{lastSaved.number} - find it under PDF Studio - Invoices, and its costing project under Costing & Profit.</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { const a = document.createElement("a"); a.href = lastSavedUrl; a.download = `Invoice-${lastSaved.number}.pdf`; a.click(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: ACCENT }}>
              <FileText size={13} /> Download PDF
            </button>
            <button onClick={() => window.open(lastSavedUrl, "_blank")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: BORDER, color: TEXT }}>
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ type = "text", value, onChange, required }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />;
}
function LField({ label, children, className = "" }) {
  return <div className={className}><label className="block text-xs mb-1" style={{ color: MUTED }}>{label}</label>{children}</div>;
}
function Row({ label, value, bold, accent }) {
  return <div className="flex justify-between"><span style={{ color: MUTED }}>{label}</span><span className={bold ? "font-semibold" : ""} style={{ color: accent ? ACCENT : TEXT }}>{value}</span></div>;
}

// ============================================================
// MODULE 3 — COSTING & PROFIT DASHBOARD
// ============================================================
function CostingDashboard({ invoices, costing, setCosting, onSlipUpload, onReportReady }) {
  const [expanded, setExpanded] = useState({});

  const addExpense = async (invId, category, description, amount) => {
    if (!amount) return;
    const { data, error } = await supabase
      .from("event_expenses")
      .insert({ invoice_id: invId, category, description, amount_usd: parseFloat(amount) })
      .select().single();
    if (error) { console.error(error); return; }
    setCosting((prev) => ({ ...prev, [invId]: { ...prev[invId], expenses: [...(prev[invId]?.expenses || []), dbExpenseToApp(data)] } }));
  };
  const removeExpense = async (invId, expId) => {
    setCosting((prev) => ({ ...prev, [invId]: { ...prev[invId], expenses: prev[invId].expenses.filter((x) => x.id !== expId) } }));
    const { error } = await supabase.from("event_expenses").delete().eq("id", expId);
    if (error) console.error(error);
  };

  const addRemittance = async (invId, usdReceived, fxRate, slipFile) => {
    const { data, error } = await supabase
      .from("bank_remittances")
      .insert({ invoice_id: invId, usd_received: parseFloat(usdReceived) || 0, fx_rate: parseFloat(fxRate) || 0 })
      .select().single();
    if (error) { console.error(error); return; }
    const rec = dbRemittanceToApp(data);
    setCosting((prev) => ({ ...prev, [invId]: { ...prev[invId], remittances: [...(prev[invId]?.remittances || []), { ...rec, slipName: slipFile?.name || null }] } }));
    if (slipFile) onSlipUpload(`${invId}-${slipFile.name}`, slipFile);
  };

  // Income = the invoice's Grand Total (Prizepool + Event Cost + Service Charge) — the
  // whole amount actually billed and collected. Internal Expenses (what RTB really
  // spends running the event, including paying out the prizepool) are subtracted from
  // that to get Net Profit — see the per-project calc a few lines down.
  const projects = invoices.map((inv) => {
    const c = costing[inv.id] || { expenses: [], remittances: [] };
    // Income = the invoice's Grand Total (Prizepool + Event Cost + Service Charge) —
    // the whole amount actually billed and collected. Internal Expenses (what RTB
    // really spends running the event, including paying out the prizepool) are
    // subtracted from that to get Net Profit.
    const grossIncome = inv.grandTotal;
    const totalExpense = c.expenses.reduce((s, x) => s + x.amount, 0);
    const netProfit = grossIncome - totalExpense;
    const totalBDT = c.remittances.reduce((s, r) => s + r.usdReceived * r.fxRate, 0);
    return { inv, ...c, grossIncome, totalExpense, netProfit, totalBDT };
  });

  const totalIncomeUSD = projects.reduce((s, p) => s + p.grossIncome, 0);
  const totalIncomeBDT = projects.reduce((s, p) => s + p.totalBDT, 0);
  const totalExpenseAll = projects.reduce((s, p) => s + p.totalExpense, 0);
  const totalNetProfit = projects.reduce((s, p) => s + p.netProfit, 0);

  const chartData = projects.map((p) => ({ name: p.inv.projectName.length > 14 ? p.inv.projectName.slice(0, 14) + "…" : p.inv.projectName, Income: Math.round(p.grossIncome), Expense: Math.round(p.totalExpense) }));

  const exportExcel = () => {
    const summary = projects.map((p) => ({
      Invoice: p.inv.number, Project: p.inv.projectName, Client: p.inv.clientName,
      "Invoiced Grand Total (USD)": p.inv.grandTotal.toFixed(2),
      "Income: Invoice Grand Total (USD)": p.grossIncome.toFixed(2),
      "Internal Expenses (USD)": p.totalExpense.toFixed(2), "Net Profit (USD)": p.netProfit.toFixed(2),
      "Remitted (BDT)": Math.round(p.totalBDT),
    }));
    const expenseRows = [];
    projects.forEach((p) => p.expenses.forEach((x) => expenseRows.push({ Invoice: p.inv.number, Category: x.category, Description: x.description, "Amount (USD)": x.amount })));
    const remittanceRows = [];
    projects.forEach((p) => p.remittances.forEach((r) => remittanceRows.push({ Invoice: p.inv.number, Date: r.date, "USD Received": r.usdReceived, "FX Rate": r.fxRate, "BDT Credited": Math.round(r.usdReceived * r.fxRate), Slip: r.slipName || "" })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows.length ? expenseRows : [{}]), "Internal Expenses");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(remittanceRows.length ? remittanceRows : [{}]), "Bank Remittances");
    XLSX.writeFile(wb, `RTB_Financial_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={TrendingUp} label="Total Income (USD)" value={usdFmt(totalIncomeUSD)} tint={GOOD} />
        <SummaryCard icon={Landmark} label="Remitted (BDT)" value={bdtFmt(totalIncomeBDT)} tint={ACCENT} />
        <SummaryCard icon={TrendingDown} label="Internal Expenses" value={usdFmt(totalExpenseAll)} tint={BAD} />
        <SummaryCard icon={Wallet} label="Net Profit" value={usdFmt(totalNetProfit)} tint={totalNetProfit >= 0 ? GOOD : BAD} emphasize />
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={exportExcel} disabled={projects.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-40" style={{ borderColor: BORDER, background: CARD, color: TEXT }}>
          <FileSpreadsheet size={15} color={GOOD} /> Export Excel (tax-ready)
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border p-4 mb-6" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-sm font-medium mb-3">Income vs. Internal Expense per Project (USD)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: MUTED }} />
              <YAxis tick={{ fontSize: 12, fill: MUTED }} />
              <Tooltip formatter={(v) => usdFmt(v)} contentStyle={{ background: CARD_ALT, border: `1px solid ${BORDER}` }} />
              <Legend />
              <Bar dataKey="Income" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill={BAD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: MUTED }}>No projects yet — generate an invoice first, then track its internal costs and remittances here.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectCard key={p.inv.id} p={p} expanded={!!expanded[p.inv.id]} onToggle={() => setExpanded((e) => ({ ...e, [p.inv.id]: !e[p.inv.id] }))}
              onAddExpense={(cat, desc, amt) => addExpense(p.inv.id, cat, desc, amt)} onRemoveExpense={(id) => removeExpense(p.inv.id, id)}
              onAddRemittance={(usd, fx, slip) => addRemittance(p.inv.id, usd, fx, slip)} onReportReady={onReportReady} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ p, expanded, onToggle, onAddExpense, onRemoveExpense, onAddRemittance, onReportReady }) {
  const [cat, setCat] = useState(EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [usdIn, setUsdIn] = useState("");
  const [fx, setFx] = useState("");
  const [slip, setSlip] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const slipInputRef = useRef(null);

  const submitExpense = (e) => { e.preventDefault(); onAddExpense(cat, desc, amt); setDesc(""); setAmt(""); };
  const submitRemittance = (e) => { e.preventDefault(); onAddRemittance(usdIn, fx, slip); setUsdIn(""); setFx(""); setSlip(null); if (slipInputRef.current) slipInputRef.current.value = ""; };

  const downloadReport = async (e) => {
    e.stopPropagation();
    setGeneratingReport(true);
    try {
      const bytes = await buildCostingReportPdfBytes(p);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const name = `Report-${p.inv.number}.pdf`;
      onReportReady(name, blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      alert("Couldn't generate the report: " + (err?.message || err));
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          <Receipt size={16} color={ACCENT} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{p.inv.projectName} <span style={{ color: MUTED }}>· #{p.inv.number}</span></p>
            <p className="text-xs truncate" style={{ color: MUTED }}>{p.inv.clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs" style={{ color: MUTED }}>Income {usdFmt(p.grossIncome)}</p>
            <p className="text-xs" style={{ color: BAD }}>− {usdFmt(p.totalExpense)}</p>
          </div>
          <p className="text-sm font-mono font-semibold" style={{ color: p.netProfit >= 0 ? GOOD : BAD }}>{usdFmt(p.netProfit)}</p>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-3 gap-3 py-3 text-sm">
            <div><p className="text-xs" style={{ color: MUTED }}>Income (invoice grand total)</p><p className="font-mono">{usdFmt(p.grossIncome)}</p></div>
            <div><p className="text-xs" style={{ color: MUTED }}>Internal expenses</p><p className="font-mono" style={{ color: BAD }}>{usdFmt(p.totalExpense)}</p></div>
            <div><p className="text-xs" style={{ color: MUTED }}>Net profit</p><p className="font-mono font-semibold" style={{ color: p.netProfit >= 0 ? GOOD : BAD }}>{usdFmt(p.netProfit)}</p></div>
          </div>
          <button onClick={downloadReport} disabled={generatingReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white mb-4 disabled:opacity-50" style={{ background: ACCENT_DARK }}>
            {generatingReport ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            {generatingReport ? "Building report…" : "Download budget report (PDF)"}
          </button>

          <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><TrendingDown size={14} color={BAD} /> Internal expenses</p>
          {p.expenses.length > 0 && (
            <table className="w-full text-sm mb-2">
              <thead><tr style={{ color: MUTED }}><th className="text-left font-medium py-1">Category</th><th className="text-left font-medium py-1">Description</th><th className="text-right font-medium py-1">Amount</th><th className="w-8"></th></tr></thead>
              <tbody>
                {p.expenses.map((x) => (
                  <tr key={x.id} className="border-t" style={{ borderColor: BORDER }}>
                    <td className="py-1.5">{x.category}</td><td className="py-1.5" style={{ color: MUTED }}>{x.description || "—"}</td>
                    <td className="py-1.5 text-right font-mono">{usdFmt(x.amount)}</td>
                    <td className="py-1.5 text-right"><button onClick={() => onRemoveExpense(x.id)} style={{ color: BAD }}><X size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={submitExpense} className="flex flex-wrap gap-2 mb-5">
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}>
              {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
            <input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount USD" className="w-32 px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: ACCENT_DARK }}><Plus size={14} /></button>
          </form>

          <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><ArrowRightLeft size={14} color={ACCENT} /> Bank remittances (USD → BDT)</p>
          {p.remittances.length > 0 && (
            <table className="w-full text-sm mb-2">
              <thead><tr style={{ color: MUTED }}><th className="text-left font-medium py-1">Date</th><th className="text-right font-medium py-1">USD</th><th className="text-right font-medium py-1">FX Rate</th><th className="text-right font-medium py-1">BDT</th><th className="text-left font-medium py-1">Slip</th></tr></thead>
              <tbody>
                {p.remittances.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: BORDER }}>
                    <td className="py-1.5">{r.date}</td><td className="py-1.5 text-right font-mono">{usdFmt(r.usdReceived)}</td>
                    <td className="py-1.5 text-right font-mono">{r.fxRate}</td><td className="py-1.5 text-right font-mono">{bdtFmt(r.usdReceived * r.fxRate)}</td>
                    <td className="py-1.5" style={{ color: MUTED }}>{r.slipName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form onSubmit={submitRemittance} className="flex flex-wrap gap-2">
            <input type="number" min="0" step="0.01" value={usdIn} onChange={(e) => setUsdIn(e.target.value)} placeholder="USD received" className="w-32 px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
            <input type="number" min="0" step="0.01" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="FX rate (BDT/USD)" className="w-36 px-2 py-1.5 rounded-lg border text-sm" style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }} />
            <input ref={slipInputRef} type="file" accept="application/pdf,image/*" onChange={(e) => setSlip(e.target.files[0] || null)} className="text-xs" style={{ color: MUTED }} />
            <button type="submit" className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ background: ACCENT_DARK }}><Plus size={14} /></button>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tint, emphasize }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: `${tint}22` }}><Icon size={16} color={tint} /></div>
        <p className="text-xs font-medium" style={{ color: MUTED }}>{label}</p>
      </div>
      <p className={emphasize ? "text-xl font-semibold font-mono" : "text-lg font-semibold font-mono"} style={{ color: tint }}>{value}</p>
    </div>
  );
}
