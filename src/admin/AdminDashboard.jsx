import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Settings as SettingsIcon,
  Youtube,
  Image as ImageIcon,
  FileText,
  Receipt,
  Wallet,
  Menu,
  X,
  Loader2,
  AlertTriangle,
  Handshake,
  Users,
} from "lucide-react";
import { supabase } from "../supabaseClient.js";
import { ADMIN_PATH } from "./ProtectedRoute.jsx";
import { useAccountingData } from "./accounting/useAccountingData.js";
import SiteSettingsTab from "./tabs/SiteSettingsTab.jsx";
import MediaTab from "./tabs/MediaTab.jsx";
import GalleryTab from "./tabs/GalleryTab.jsx";
import BrandPartnersTab from "./tabs/BrandPartnersTab.jsx";
import TeamTab from "./tabs/TeamTab.jsx";
import PdfStudioTab from "./tabs/PdfStudioTab.jsx";
import InvoiceGeneratorTab from "./tabs/InvoiceGeneratorTab.jsx";
import BudgetTrackerTab from "./tabs/BudgetTrackerTab.jsx";

const NAV_TABS = [
  { key: "settings", label: "Site Branding & Social", Icon: SettingsIcon },
  { key: "media", label: "Media Hub (YouTube)", Icon: Youtube },
  { key: "gallery", label: "Web Gallery", Icon: ImageIcon },
  { key: "partners", label: "Brand Partners", Icon: Handshake },
  { key: "team", label: "Team", Icon: Users },
  { key: "pdfs", label: "PDF Management", Icon: FileText },
  { key: "invoices", label: "Invoice Generator", Icon: Receipt },
  { key: "budget", label: "Budget & Profit", Icon: Wallet },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("settings");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    folders, setFolders,
    files, setFiles,
    invoices, costing, setCosting,
    loading, loadError,
    addFileToFolderByName,
    handleSaveInvoice,
  } = useAccountingData();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate(ADMIN_PATH);
  }

  const Active = NAV_TABS.find((t) => t.key === tab) ?? NAV_TABS[0];

  return (
    <div
      className="min-h-screen w-full text-slate-100 flex"
      style={{
        background: "radial-gradient(ellipse at top, #14101f 0%, #0a0a0f 55%, #060608 100%)",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-purple-500/15 bg-black/30 p-4">
        <div className="mb-6 px-2">
          <h1 className="font-bold text-lg text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            RTB<span className="text-cyan-400">.</span> Admin
          </h1>
          <p className="text-[11px] text-slate-500">Content &amp; Accounting Suite</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-left transition-colors ${
                tab === key
                  ? "bg-gradient-to-r from-purple-500/20 to-cyan-400/20 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={16} /> Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-md border-b border-purple-500/15 px-4 h-14 flex items-center justify-between">
        <h1 className="font-bold text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          RTB<span className="text-cyan-400">.</span> Admin
        </h1>
        <button onClick={() => setSidebarOpen((v) => !v)} className="text-slate-200">
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/85 backdrop-blur-sm pt-14 px-4">
          <nav className="space-y-1.5 mt-4">
            {NAV_TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm font-semibold text-left ${
                  tab === key ? "bg-gradient-to-r from-purple-500/20 to-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-300 bg-white/5"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm font-semibold text-red-400 bg-red-500/10 mt-3"
            >
              <LogOut size={16} /> Log out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 pt-20 md:pt-8 max-w-6xl">
        <div className="flex items-center gap-2 mb-6">
          <Active.Icon size={20} className="text-cyan-300" />
          <h2 className="font-bold text-xl text-white" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            {Active.label}
          </h2>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 mb-5 text-sm text-orange-300">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Couldn't reach Supabase for the accounting suite ({loadError}). Make sure you've run{" "}
              <code className="text-orange-200">SUPABASE_SETUP.sql</code> and set your env vars — see README.md.
            </span>
          </div>
        )}

        {tab === "settings" && <SiteSettingsTab />}
        {tab === "media" && <MediaTab />}
        {tab === "gallery" && <GalleryTab />}
        {tab === "partners" && <BrandPartnersTab />}
        {tab === "team" && <TeamTab />}

        {(tab === "pdfs" || tab === "invoices" || tab === "budget") && loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
            <Loader2 size={18} className="animate-spin" /> Loading accounting data…
          </div>
        ) : (
          <>
            {tab === "pdfs" && <PdfStudioTab folders={folders} setFolders={setFolders} files={files} setFiles={setFiles} />}
            {tab === "invoices" && (
              <InvoiceGeneratorTab
                invoices={invoices}
                onSaveInvoice={handleSaveInvoice}
                onFileReady={addFileToFolderByName}
                onInvoiceSaved={() => setTab("budget")}
              />
            )}
            {tab === "budget" && (
              <BudgetTrackerTab
                invoices={invoices}
                costing={costing}
                setCosting={setCosting}
                onFileReady={addFileToFolderByName}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
