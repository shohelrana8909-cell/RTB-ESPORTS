import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileSpreadsheet, Download, Plus, X, Loader2, ChevronDown, ChevronUp, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../../supabaseClient.js";
import { usdFmt, bdtFmt, EXPENSE_CATEGORIES, buildCostingReportPdfBytes, uploadDocument } from "../accounting/pdfEngine.js";
import { useSiteData } from "../../context/SiteDataContext.jsx";

const CARD = "#171025";
const CARD_ALT = "#1E1730";
const BORDER = "#2E2545";
const ACCENT = "#8A2BE2";
const TEXT = "#FFFFFF";
const MUTED = "#A79FC0";
const GOOD = "#7CE0B0";
const BAD = "#FF5C7A";

export default function BudgetTrackerTab({ invoices, costing, setCosting, onFileReady }) {
  const projects = useMemo(() => {
    return invoices.map((inv) => {
      const c = costing[inv.id] || { expenses: [], remittances: [] };
      const totalExpense = c.expenses.reduce((s, e) => s + e.amount, 0);
      const netProfit = inv.grandTotal - totalExpense;
      return { inv, expenses: c.expenses, remittances: c.remittances, grossIncome: inv.grandTotal, totalExpense, netProfit };
    });
  }, [invoices, costing]);

  const chartData = projects.map((p) => ({
    name: p.inv.projectName.length > 14 ? p.inv.projectName.slice(0, 14) + "…" : p.inv.projectName,
    Income: p.grossIncome,
    Expense: p.totalExpense,
  }));

  function exportExcel() {
    const rows = projects.map((p) => ({
      "Invoice #": p.inv.number,
      "Project Name": p.inv.projectName,
      Edition: p.inv.edition,
      Client: p.inv.clientName,
      Date: p.inv.date,
      "Income (USD)": p.grossIncome,
      "Internal Expense (USD)": p.totalExpense,
      "Net Profit (USD)": p.netProfit,
      "Service Charge %": p.inv.serviceChargePct,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget Report");
    XLSX.writeFile(wb, `RTB-Esports-Budget-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div style={{ color: TEXT }}>
      <div className="flex justify-end mb-4">
        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
          style={{ borderColor: BORDER, background: CARD, color: TEXT }}
        >
          <FileSpreadsheet size={15} /> Export Excel (tax-ready)
        </button>
      </div>

      <div className="rounded-xl border p-4 mb-6" style={{ borderColor: BORDER, background: CARD }}>
        <p className="text-sm font-semibold mb-3">Income vs Internal Expense per Project (USD)</p>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} />
              <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: CARD_ALT, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Legend wrapperStyle={{ color: MUTED, fontSize: 12 }} />
              <Bar dataKey="Income" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill={BAD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <ProjectCard key={p.inv.id} p={p} setCosting={setCosting} onFileReady={onFileReady} />
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: MUTED }}>
            No projects yet — generate an invoice first, and it'll show up here for costing.
          </p>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ p, setCosting, onFileReady }) {
  const { settings } = useSiteData();
  const [open, setOpen] = useState(false);
  const [expForm, setExpForm] = useState({ category: EXPENSE_CATEGORIES[0], description: "", amount: "" });
  const [remForm, setRemForm] = useState({ usdReceived: "", fxRate: "" });
  const [downloading, setDownloading] = useState(false);
  const [slipUploading, setSlipUploading] = useState(false);

  async function addExpense(e) {
    e.preventDefault();
    if (!expForm.amount) return;
    const { data, error } = await supabase
      .from("event_expenses")
      .insert({ invoice_id: p.inv.id, category: expForm.category, description: expForm.description, amount_usd: Number(expForm.amount) })
      .select()
      .single();
    if (error) {
      alert(`Couldn't add expense: ${error.message}`);
      return;
    }
    setCosting((prev) => ({
      ...prev,
      [p.inv.id]: {
        ...prev[p.inv.id],
        expenses: [...(prev[p.inv.id]?.expenses || []), { id: data.id, category: data.category, description: data.description || "", amount: Number(data.amount_usd) }],
      },
    }));
    setExpForm({ category: EXPENSE_CATEGORIES[0], description: "", amount: "" });
  }

  async function removeExpense(id) {
    setCosting((prev) => ({ ...prev, [p.inv.id]: { ...prev[p.inv.id], expenses: prev[p.inv.id].expenses.filter((x) => x.id !== id) } }));
    const { error } = await supabase.from("event_expenses").delete().eq("id", id);
    if (error) console.error(error);
  }

  async function addRemittance(e, slipFile) {
    e.preventDefault();
    if (!remForm.usdReceived || !remForm.fxRate) return;
    let slipPath = null;
    if (slipFile) {
      setSlipUploading(true);
      try {
        slipPath = `Remittance Slips/${p.inv.number}-${Date.now()}-${slipFile.name}`;
        await uploadDocument(slipPath, slipFile);
      } catch (err) {
        alert(`Couldn't upload the slip: ${err?.message || err}`);
        slipPath = null;
      } finally {
        setSlipUploading(false);
      }
    }
    const { data, error } = await supabase
      .from("bank_remittances")
      .insert({ invoice_id: p.inv.id, usd_received: Number(remForm.usdReceived), fx_rate: Number(remForm.fxRate), slip_storage_path: slipPath })
      .select()
      .single();
    if (error) {
      alert(`Couldn't save remittance: ${error.message}`);
      return;
    }
    setCosting((prev) => ({
      ...prev,
      [p.inv.id]: {
        ...prev[p.inv.id],
        remittances: [
          ...(prev[p.inv.id]?.remittances || []),
          { id: data.id, usdReceived: Number(data.usd_received), fxRate: Number(data.fx_rate), date: data.remittance_date, slipName: slipFile?.name || null },
        ],
      },
    }));
    setRemForm({ usdReceived: "", fxRate: "" });
  }

  async function downloadReport() {
    setDownloading(true);
    try {
      const bytes = await buildCostingReportPdfBytes(p, settings.logoUrl);
      const blob = new Blob([bytes], { type: "application/pdf" });
      await onFileReady("Event Reports", { name: `Budget-Report-${p.inv.number}.pdf`, blob, size: blob.size });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Budget-Report-${p.inv.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`Couldn't build the report: ${err?.message || err}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: BORDER, background: CARD }}>
      <button onClick={() => setOpen((s) => !s)} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="font-bold text-sm">
            {p.inv.projectName} · #{p.inv.number}
          </p>
          <p className="text-xs" style={{ color: MUTED }}>{p.inv.clientName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs" style={{ color: MUTED }}>
            <p>Income {usdFmt(p.grossIncome)}</p>
            <p style={{ color: BAD }}>− {usdFmt(p.totalExpense)}</p>
          </div>
          <p className="font-bold" style={{ color: p.netProfit >= 0 ? GOOD : BAD }}>{usdFmt(p.netProfit)}</p>
          {open ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-3 gap-3 my-4">
            <SummaryCard label="Income (invoice grand total)" value={usdFmt(p.grossIncome)} />
            <SummaryCard label="Internal expenses" value={usdFmt(p.totalExpense)} color={BAD} />
            <SummaryCard label="Net profit" value={usdFmt(p.netProfit)} color={p.netProfit >= 0 ? GOOD : BAD} />
          </div>

          <button
            onClick={downloadReport}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white mb-4 disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download budget report (PDF)
          </button>

          <p className="text-xs font-semibold mb-2" style={{ color: MUTED }}>Internal expenses</p>
          <div className="space-y-1.5 mb-2">
            {p.expenses.map((x) => (
              <div key={x.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: CARD_ALT }}>
                <span>
                  <span className="font-semibold">{x.category}</span>
                  {x.description && <span style={{ color: MUTED }}> · {x.description}</span>}
                </span>
                <div className="flex items-center gap-2">
                  <span>{usdFmt(x.amount)}</span>
                  <button onClick={() => removeExpense(x.id)} style={{ color: MUTED }}><X size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={addExpense} className="grid grid-cols-[130px_1fr_120px_auto] gap-2 mb-5">
            <select
              value={expForm.category}
              onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
              className="rounded-lg border px-2 py-2 text-sm"
              style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
            >
              {EXPENSE_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}
            </select>
            <input
              placeholder="Description"
              value={expForm.description}
              onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
            />
            <input
              type="number"
              placeholder="Amount USD"
              value={expForm.amount}
              onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
            />
            <button className="px-3 rounded-lg text-black flex items-center justify-center" style={{ background: ACCENT }}>
              <Plus size={16} />
            </button>
          </form>

          <p className="text-xs font-semibold mb-2" style={{ color: MUTED }}>Bank remittances (USD → BDT)</p>
          <div className="space-y-1.5 mb-2">
            {p.remittances.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: CARD_ALT }}>
                <span>{usdFmt(r.usdReceived)} @ {r.fxRate} → {bdtFmt(r.usdReceived * r.fxRate)}</span>
                {r.slipName && <span className="text-xs" style={{ color: MUTED }}>{r.slipName}</span>}
              </div>
            ))}
          </div>
          <RemittanceForm form={remForm} setForm={setRemForm} onSubmit={addRemittance} uploading={slipUploading} />
        </div>
      )}
    </div>
  );
}

function RemittanceForm({ form, setForm, onSubmit, uploading }) {
  const [file, setFile] = useState(null);
  return (
    <form
      onSubmit={(e) => onSubmit(e, file)}
      className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center"
    >
      <input
        type="number"
        placeholder="USD received"
        value={form.usdReceived}
        onChange={(e) => setForm({ ...form, usdReceived: e.target.value })}
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
      />
      <input
        type="number"
        placeholder="FX rate (BDT/USD)"
        value={form.fxRate}
        onChange={(e) => setForm({ ...form, fxRate: e.target.value })}
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: BORDER, background: CARD_ALT, color: TEXT }}
      />
      <label className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border cursor-pointer whitespace-nowrap" style={{ borderColor: BORDER, color: MUTED }}>
        <Upload size={13} /> {file ? file.name.slice(0, 14) : "Choose File"}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <button disabled={uploading} className="px-3 py-2 rounded-lg text-black flex items-center justify-center disabled:opacity-50" style={{ background: ACCENT }}>
        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
      </button>
    </form>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-lg p-3" style={{ background: CARD_ALT }}>
      <p className="text-[11px] mb-1" style={{ color: MUTED }}>{label}</p>
      <p className="font-bold text-sm" style={{ color: color || TEXT }}>{value}</p>
    </div>
  );
}
