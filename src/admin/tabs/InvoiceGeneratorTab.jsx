import React, { useMemo, useState } from "react";
import { FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { buildInvoicePdfBytes, usdFmt, amountToWords, RTB_LOGO_DATA_URI } from "../accounting/pdfEngine.js";
import { useSiteData } from "../../context/SiteDataContext.jsx";

const CARD = "#171025";
const CARD_ALT = "#1E1730";
const BORDER = "#2E2545";
const ACCENT = "#8A2BE2";
const TEXT = "#FFFFFF";
const MUTED = "#A79FC0";

function nextInvoiceNumber(invoices) {
  let max = 1030;
  invoices.forEach((inv) => {
    const m = /^RE(\d+)$/.exec(inv.number || "");
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `RE${max + 1}`;
}

const DEFAULT_BANK = {
  bankName: "EASTERN BANK LIMITED",
  bankAccNo: "1321570000162",
  bankAccName: "SHOHEL HOSSAN",
  swiftCode: "EBLDBDDHXXX",
  routingNumber: "095260226",
};

export default function InvoiceGeneratorTab({ invoices, onSaveInvoice, onFileReady, onInvoiceSaved }) {
  const { settings } = useSiteData();
  const siteLogo = settings.logoUrl || RTB_LOGO_DATA_URI;
  const [form, setForm] = useState({
    number: nextInvoiceNumber(invoices),
    date: new Date().toISOString().slice(0, 10),
    projectName: "",
    edition: "",
    clientName: "Garena Online Private Limited",
    clientAddress: "1 Fusionopolis Place, #17-10 Galaxis.",
    prizepool: "",
    eventCost: "",
    serviceChargePct: "10",
    ...DEFAULT_BANK,
  });
  const [bankOpen, setBankOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const prizepool = Number(form.prizepool) || 0;
  const eventCost = Number(form.eventCost) || 0;
  const pct = Number(form.serviceChargePct) || 0;
  const subtotal = prizepool + eventCost;
  const serviceChargeAmt = (subtotal * pct) / 100;
  const grandTotal = subtotal + serviceChargeAmt;

  const invoiceForPdf = useMemo(
    () => ({
      number: form.number,
      date: form.date,
      projectName: form.projectName || "—",
      edition: form.edition || "—",
      clientName: form.clientName,
      clientAddress: form.clientAddress,
      prizepool,
      eventCost,
      serviceChargePct: pct,
      subtotal,
      serviceChargeAmt,
      grandTotal,
      bankName: form.bankName,
      bankAccNo: form.bankAccNo,
      bankAccName: form.bankAccName,
      swiftCode: form.swiftCode,
      routingNumber: form.routingNumber,
    }),
    [form, prizepool, eventCost, pct, subtotal, serviceChargeAmt, grandTotal]
  );

  async function handleGenerate() {
    if (!form.projectName.trim()) {
      alert("Please enter a project name first.");
      return;
    }
    setSaving(true);
    try {
      const bytes = await buildInvoicePdfBytes(invoiceForPdf, settings.logoUrl);
      const blob = new Blob([bytes], { type: "application/pdf" });

      const saved = await onSaveInvoice(invoiceForPdf);
      if (!saved) throw new Error("Failed to save the invoice to the database.");
      await onFileReady("Invoices", { name: `Invoice-${form.number}.pdf`, blob, size: blob.size });

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      setForm((prev) => ({ ...prev, number: nextInvoiceNumber([...invoices, invoiceForPdf]) }));
      if (onInvoiceSaved) onInvoiceSaved(saved);
    } catch (err) {
      alert(`Couldn't generate the invoice: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6" style={{ color: TEXT }}>
      {/* -------------------- LEFT: FORM -------------------- */}
      <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
        <h3 className="font-bold text-base mb-4 flex items-center gap-2">
          <FileText size={16} color={ACCENT} /> New Invoice
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <LField label="Invoice #">
            <Input value={form.number} onChange={(v) => update("number", v)} />
          </LField>
          <LField label="Date">
            <Input type="date" value={form.date} onChange={(v) => update("date", v)} />
          </LField>
        </div>

        <LField label="Project Name">
          <Input value={form.projectName} onChange={(v) => update("projectName", v)} placeholder="FREE FIRE TALENT HUNT 2026" />
        </LField>
        <LField label="Edition">
          <Input value={form.edition} onChange={(v) => update("edition", v)} placeholder="Chittagong University Edition" />
        </LField>
        <LField label="Client Name">
          <Input value={form.clientName} onChange={(v) => update("clientName", v)} />
        </LField>
        <LField label="Client Address">
          <textarea
            rows={2}
            value={form.clientAddress}
            onChange={(e) => update("clientAddress", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none"
            style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
          />
        </LField>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <LField label="Prizepool ($)">
            <Input type="number" value={form.prizepool} onChange={(v) => update("prizepool", v)} />
          </LField>
          <LField label="Event Cost ($)">
            <Input type="number" value={form.eventCost} onChange={(v) => update("eventCost", v)} />
          </LField>
          <LField label="Service Charge (%)">
            <Input type="number" value={form.serviceChargePct} onChange={(v) => update("serviceChargePct", v)} />
          </LField>
        </div>

        <div className="rounded-lg p-3 mb-4 space-y-1.5" style={{ background: CARD_ALT }}>
          <Row label="Subtotal" value={usdFmt(subtotal)} />
          <Row label={`Service Charge (${pct}%)`} value={usdFmt(serviceChargeAmt)} />
          <Row label="Grand Total" value={usdFmt(grandTotal)} bold accent />
        </div>

        <button
          onClick={() => setBankOpen((s) => !s)}
          className="flex items-center gap-1.5 text-sm font-medium mb-3"
          style={{ color: MUTED }}
        >
          {bankOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Bank details (fixed, editable)
        </button>
        {bankOpen && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <LField label="Bank">
              <Input value={form.bankName} onChange={(v) => update("bankName", v)} />
            </LField>
            <LField label="Bank Acc No">
              <Input value={form.bankAccNo} onChange={(v) => update("bankAccNo", v)} />
            </LField>
            <LField label="Account Name">
              <Input value={form.bankAccName} onChange={(v) => update("bankAccName", v)} />
            </LField>
            <LField label="SWIFT Code">
              <Input value={form.swiftCode} onChange={(v) => update("swiftCode", v)} />
            </LField>
            <LField label="Routing Number">
              <Input value={form.routingNumber} onChange={(v) => update("routingNumber", v)} />
            </LField>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {saving ? "Generating…" : "Generate & Save Invoice"}
        </button>
        <p className="text-xs text-center mt-2" style={{ color: MUTED }}>
          Saves a real PDF into PDF Studio → Invoices, and opens a costing project for it.
        </p>
        {savedFlash && <p className="text-xs text-center mt-1 font-semibold" style={{ color: "#7CE0B0" }}>Saved ✓</p>}
      </div>

      {/* -------------------- RIGHT: LIVE PREVIEW -------------------- */}
      <div className="rounded-xl overflow-hidden" style={{ background: "white", color: "#111" }}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <img src={siteLogo} alt="RTB" className="h-14 object-contain" />
            <div className="bg-black text-white px-5 py-2.5 rounded">
              <p className="font-extrabold text-lg tracking-wide">INVOICE</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500 -mt-4 mb-5">
            <p>Invoice #{form.number}</p>
            <p>Date: {form.date}</p>
          </div>

          <div className="bg-gray-100 rounded p-3 mb-4 text-sm">
            <p className="font-bold">Project Details -</p>
            <p>Name - {form.projectName || "—"}</p>
            <p>Edition - {form.edition || "—"}</p>
          </div>

          <div className="bg-gray-100 rounded p-3 mb-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold mb-1">From:</p>
              <p>R.T.B Esports</p>
              <p>Plot-34, Sonargaon Janpath Road, Sector-11,</p>
              <p>Uttara-1230, Dhaka.</p>
            </div>
            <div>
              <p className="font-bold mb-1">To:</p>
              <p>{form.clientName}</p>
              {form.clientAddress.split("\n").map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          </div>

          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="border-b border-gray-300 text-gray-500">
                <th className="text-left py-1.5 font-medium">SL</th>
                <th className="text-left py-1.5 font-medium">Description</th>
                <th className="text-right py-1.5 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-700">
                <td className="py-1.5">01.</td>
                <td className="py-1.5">Prizepool</td>
                <td className="text-right py-1.5">{usdFmt(prizepool)}</td>
              </tr>
              <tr className="text-gray-700">
                <td className="py-1.5">02.</td>
                <td className="py-1.5">Total Event Cost</td>
                <td className="text-right py-1.5">{usdFmt(eventCost)}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-2">
            <div className="w-48 text-xs space-y-1">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{usdFmt(subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Service Charge</span><span>{usdFmt(serviceChargeAmt)}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t border-gray-300"><span>Total</span><span>{usdFmt(grandTotal)}</span></div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mb-4">IN WORDS :- {amountToWords(grandTotal)}</p>

          <table className="w-full text-xs border border-gray-800">
            <tbody>
              <tr>
                <td colSpan={2} className="text-center font-bold py-2 border-b border-gray-800">PAYMENT DETAILS</td>
              </tr>
              {[
                ["BANK", form.bankName],
                ["BANK ACC NO", form.bankAccNo],
                ["ACCOUNT NAME", form.bankAccName],
                ["SWIFT CODE", form.swiftCode],
                ["ROUTING NUMBER", form.routingNumber],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-300 last:border-b-0">
                  <td className="font-semibold px-3 py-1.5 border-r border-gray-300 w-1/3">{k}</td>
                  <td className="px-3 py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LField({ label, children }) {
  return (
    <div className="mb-3">
      <label className="text-[11px] mb-1 block" style={{ color: MUTED }}>{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
      style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
    />
  );
}
function Row({ label, value, bold, accent }) {
  return (
    <div className="flex justify-between text-sm" style={{ color: accent ? ACCENT : TEXT, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: bold ? undefined : MUTED }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
