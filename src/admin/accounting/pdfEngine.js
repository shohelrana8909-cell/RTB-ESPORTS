import { supabase } from "../../supabaseClient.js";
import RTB_LOGO_DATA_URI from "../../rtb.png";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const usdFmt = (n) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
export const bdtFmt = (n) => `৳${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)}`;
// PDF-safe variant: pdf-lib's StandardFonts use WinAnsi encoding, which has no
// Bengali glyphs (the ৳ sign crashes drawText). Use this one for anything drawn into a PDF.
export const bdtFmtAscii = (n) => `Tk ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)}`;

export const FONT_FAMILIES = ["Georgia, serif", "'Segoe UI', sans-serif", "'Courier New', monospace", "Verdana, sans-serif"];
export const EXPENSE_CATEGORIES = ["Venue", "Production", "Casting", "Logistics", "Local Costs", "Other"];
export const DEFAULT_FOLDERS = ["Invoices", "Remittance Slips", "Event Reports", "Custom PDFs"];

// ---------------------------------------------------------------------------
// RTB logo. Prefers the logo uploaded on the public site (Site Branding &
// Social tab → settings.logoUrl); falls back to the bundled src/rtb.png if
// none is set yet, or if fetching/embedding it fails for any reason (e.g.
// an unsupported format — pdf-lib can only embed PNG/JPG, not SVG/WebP).
// ---------------------------------------------------------------------------
let _fallbackLogoBytesPromise = null;
function fetchFallbackLogoBytes() {
  if (!_fallbackLogoBytesPromise) {
    _fallbackLogoBytesPromise = fetch(RTB_LOGO_DATA_URI).then((r) => r.arrayBuffer());
  }
  return _fallbackLogoBytesPromise;
}

async function embedImageBytes(pdfDoc, bytes) {
  const arr = new Uint8Array(bytes);
  const isPng = arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47;
  return isPng ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

// logoUrl: pass settings.logoUrl from useSiteData() — the logo the admin
// uploaded on the public site. Omit it (or pass "") to use the bundled default.
export async function embedSiteLogo(pdfDoc, logoUrl) {
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) return await embedImageBytes(pdfDoc, await res.arrayBuffer());
    } catch (err) {
      console.warn("Couldn't embed the site's uploaded logo, falling back to the default:", err);
    }
  }
  return embedImageBytes(pdfDoc, await fetchFallbackLogoBytes());
}
export { RTB_LOGO_DATA_URI };

// ---------------------------------------------------------------------------
// SUPABASE DATA LAYER — persistence for invoices, costing, and PDF Studio
// files. See SUPABASE_SETUP.sql for the tables this talks to (invoices,
// event_expenses, bank_remittances, studio_folders, studio_files) and the
// private 'documents' bucket.
// ---------------------------------------------------------------------------
export const DOCS_BUCKET = "documents";

export async function uploadDocument(path, blob) {
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || "application/pdf" });
  if (error) throw error;
}
export async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 60 * 60); // 1 hour
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteDocuments(paths) {
  if (!paths.length) return;
  await supabase.storage.from(DOCS_BUCKET).remove(paths);
}

// ---- invoices ----
export function dbInvoiceToApp(row) {
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
export function appInvoiceToDbInsert(inv) {
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
export function dbExpenseToApp(row) {
  return { id: row.id, category: row.category, description: row.description || "", amount: Number(row.amount_usd) };
}
export function dbRemittanceToApp(row) {
  return {
    id: row.id, usdReceived: Number(row.usd_received), fxRate: Number(row.fx_rate),
    date: row.remittance_date, slipName: row.slip_storage_path ? row.slip_storage_path.split("/").pop() : null,
  };
}
// ---- PDF Studio folders/files ----
export function dbFolderToApp(row) {
  return { id: row.id, name: row.name, parentId: row.parent_id || "root" };
}
export function dbFileToApp(row, url) {
  return { id: row.id, folderId: row.folder_id || "root", name: row.name, url, size: row.size_bytes, notes: row.notes || [], storagePath: row.storage_path };
}

// ---------------------------------------------------------------------------
// Number -> words (for the invoice's "IN WORDS" line)
// ---------------------------------------------------------------------------
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

export function amountToWords(amount) {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  let out = `${numberToWords(dollars)} dollar${dollars === 1 ? "" : "s"}`;
  if (cents > 0) out += ` and ${numberToWords(cents)} cent${cents === 1 ? "" : "s"}`;
  return out + " only";
}

// ---------------------------------------------------------------------------
// Dynamically load pdf.js + pdf-lib from CDN (once, shared)
// ---------------------------------------------------------------------------
let enginePromise = null;
export function loadPdfEngines() {
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

// ---------------------------------------------------------------------------
// Build a real invoice PDF with pdf-lib — matches the RTB invoice format
// exactly (logo, INVOICE stamp, project details, from/to, line items,
// totals, IN WORDS line, and a bordered PAYMENT DETAILS table).
// ---------------------------------------------------------------------------
// Sizes an embedded logo to fit within a target box (in PDF points),
// preserving aspect ratio — needed because the site's uploaded logo can be
// any resolution (a fixed .scale(0.28) multiplier only worked for the one
// bundled default image and blew up for larger uploads).
function fitLogoDims(logoImage, maxHeight, maxWidth) {
  const scaleByHeight = maxHeight / logoImage.height;
  const scaleByWidth = maxWidth / logoImage.width;
  const scale = Math.min(scaleByHeight, scaleByWidth);
  return { width: logoImage.width * scale, height: logoImage.height * scale };
}

export async function buildInvoicePdfBytes(inv, logoUrl) {
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

  const logoPng = await embedSiteLogo(pdfDoc, logoUrl);
  const logoDims = fitLogoDims(logoPng, 42, 160); // fixed target size, not raw-resolution dependent
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

  left("Project Details -", { bold: true, size: 10 });
  y -= 14;
  left(`Name - ${inv.projectName}`, { size: 10 });
  y -= 14;
  left(`Edition - ${inv.edition}`, { size: 10 });
  y -= 28;

  left("From:", { bold: true, size: 10 });
  page.drawText("To:", { x: 320, y, size: 10, font: bold, color: ink });
  y -= 14;
  const fromLines = ["R.T.B Esports", "Plot-34, Sonargaon Janpath Road, Sector-11,", "Uttara-1230, Dhaka.", "+880 1832 172810", "rtbesportsbd@gmail.com"];
  const toLines = [inv.clientName, ...inv.clientAddress.split("\n")];
  const maxLines = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (fromLines[i]) page.drawText(fromLines[i], { x: 50, y, size: 9, font, color: ink });
    if (toLines[i]) page.drawText(toLines[i], { x: 320, y, size: 9, font, color: ink });
    y -= 13;
  }
  y -= 12;

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

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Per-project Income vs Cost budget report (printable PDF)
// ---------------------------------------------------------------------------
export async function buildCostingReportPdfBytes(p, logoUrl) {
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
  const logoPng = await embedSiteLogo(pdfDoc, logoUrl);
  const logoDims = fitLogoDims(logoPng, 34, 140); // fixed target size, not raw-resolution dependent
  page.drawImage(logoPng, { x: tableX, y: y - logoDims.height + 14, width: logoDims.width, height: logoDims.height });
  page.drawText("R.T.B Esports · Plot-34, Sonargaon Janpath Road, Sector-11, Uttara-1230, Dhaka", { x: 220, y: y - 10, size: 8, font, color: gray });
  page.drawText("+880 1832 172810 · rtbesportsbd@gmail.com", { x: 220, y: y - 22, size: 8, font, color: gray });
  y -= (logoDims.height + 16);

  page.drawText("Income & Cost Budget Report", { x: tableX, y, size: 16, font: bold, color: ink });
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
