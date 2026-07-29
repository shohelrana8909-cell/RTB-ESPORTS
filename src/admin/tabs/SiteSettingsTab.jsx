import React, { useState } from "react";
import {
  Facebook,
  Youtube,
  Instagram,
  MessageSquare,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Upload,
  Save,
  CalendarClock,
  Loader2,
  Image as ImageIcon,
  Trophy,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { supabase } from "../../supabaseClient.js";

const BRANDING_BUCKET = "branding";

// datetime-local inputs need "YYYY-MM-DDTHH:mm" (local time, no seconds/zone).
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

export default function SiteSettingsTab() {
  const { settings, saveSettings } = useSiteData();
  const [draft, setDraft] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(null); // "logo" | "favicon" | null
  const [saving, setSaving] = useState(false);

  function updateField(path, value) {
    setDraft((prev) => {
      const next = { ...prev };
      if (path.includes(".")) {
        const [group, key] = path.split(".");
        next[group] = { ...prev[group], [key]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  }

  async function handleFileUpload(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    try {
      const path = `${field}-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
      updateField(field, data.publicUrl);
    } catch (err) {
      alert(`Couldn't upload the image: ${err?.message || err}`);
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await saveSettings(draft);
    setSaving(false);
    if (error) {
      alert(`Couldn't save settings: ${error.message || error}`);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3">Logo &amp; Favicon</h4>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Website logo</label>
            <input
              placeholder="https://... (logo URL)"
              value={draft.logoUrl}
              onChange={(e) => updateField("logoUrl", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-cyan-400/60"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-3 py-2 cursor-pointer hover:border-cyan-400/40">
              {uploading === "logoUrl" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading === "logoUrl" ? "Uploading…" : "Or upload an image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "logoUrl")} disabled={!!uploading} />
            </label>
            {draft.logoUrl && <img src={draft.logoUrl} alt="Logo preview" className="mt-2 h-10 object-contain" />}
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Browser favicon</label>
            <input
              placeholder="https://... (favicon URL)"
              value={draft.faviconUrl}
              onChange={(e) => updateField("faviconUrl", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-cyan-400/60"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-3 py-2 cursor-pointer hover:border-cyan-400/40">
              {uploading === "faviconUrl" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading === "faviconUrl" ? "Uploading…" : "Or upload an image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "faviconUrl")} disabled={!!uploading} />
            </label>
            {draft.faviconUrl && <img src={draft.faviconUrl} alt="Favicon preview" className="mt-2 h-8 w-8 object-contain" />}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3">Site Content</h4>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Hero title</label>
            <input
              value={draft.heroTitle}
              onChange={(e) => updateField("heroTitle", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Hero subtitle</label>
            <textarea
              rows={2}
              value={draft.heroSubtitle}
              onChange={(e) => updateField("heroSubtitle", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60 resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Announcement bar (leave blank to hide)</label>
            <input
              placeholder="e.g. Registration for FFBC Finals closes Friday!"
              value={draft.announcementBar}
              onChange={(e) => updateField("announcementBar", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3 flex items-center gap-1.5">
          <CalendarClock size={13} /> Next Event Countdown
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Event name</label>
            <input
              value={draft.nextEventName}
              onChange={(e) => updateField("nextEventName", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Starts at</label>
            <input
              type="datetime-local"
              value={isoToLocalInput(draft.nextEventStartsAt)}
              onChange={(e) => updateField("nextEventStartsAt", localInputToIso(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400 mb-1 block">Event poster</label>
            <input
              placeholder="https://... (poster image URL)"
              value={draft.nextEventPosterUrl}
              onChange={(e) => updateField("nextEventPosterUrl", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-cyan-400/60"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-3 py-2 cursor-pointer hover:border-cyan-400/40 w-fit">
              {uploading === "nextEventPosterUrl" ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              {uploading === "nextEventPosterUrl" ? "Uploading…" : "Or upload a poster image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, "nextEventPosterUrl")}
                disabled={!!uploading}
              />
            </label>
            {draft.nextEventPosterUrl && (
              <img src={draft.nextEventPosterUrl} alt="Event poster preview" className="mt-2 h-24 rounded-lg object-cover" />
            )}
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><MapPin size={11} /> Venue</label>
            <input
              placeholder="e.g. City University Auditorium, Dhaka"
              value={draft.nextEventVenue}
              onChange={(e) => updateField("nextEventVenue", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><Trophy size={11} /> Prize pool</label>
            <input
              placeholder="e.g. ৳2,00,000"
              value={draft.nextEventPrizePool}
              onChange={(e) => updateField("nextEventPrizePool", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 flex items-center gap-1"><Ticket size={11} /> Registration status</label>
            <select
              value={draft.nextEventRegistrationStatus}
              onChange={(e) => updateField("nextEventRegistrationStatus", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            >
              <option value="Open">Open</option>
              <option value="Full">Full</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          This drives the live countdown banner on the public site's Events section.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3 flex items-center gap-1.5">
          <TrendingUp size={13} /> Stats Ticker
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Tournaments organized</label>
            <input
              placeholder="e.g. 144+ Events"
              value={draft.statTournaments}
              onChange={(e) => updateField("statTournaments", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Prize money distributed</label>
            <input
              placeholder="e.g. ৳1.1 Crore+ Prize Pool"
              value={draft.statPrizeMoney}
              onChange={(e) => updateField("statPrizeMoney", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Reach / hours streamed</label>
            <input
              placeholder="e.g. 400+ Hours Streamed"
              value={draft.statReach}
              onChange={(e) => updateField("statReach", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Players connected</label>
            <input
              placeholder="e.g. 75k+ Players"
              value={draft.statPlayers}
              onChange={(e) => updateField("statPlayers", e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Leave all four blank to hide the ticker. Free-text so you control the exact wording/format.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3">Social Media Links</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <Facebook size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Facebook URL"
              value={draft.social.facebook}
              onChange={(e) => updateField("social.facebook", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <Youtube size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="YouTube URL"
              value={draft.social.youtube}
              onChange={(e) => updateField("social.youtube", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <Instagram size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Instagram URL"
              value={draft.social.instagram}
              onChange={(e) => updateField("social.instagram", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <MessageSquare size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Discord invite URL"
              value={draft.social.discord}
              onChange={(e) => updateField("social.discord", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 sm:col-span-2">
            <MessageCircle size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="WhatsApp number (digits only, with country code, no +)"
              value={draft.social.whatsapp}
              onChange={(e) => updateField("social.whatsapp", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Leaving a field blank hides that icon in the header, footer, and contact section automatically.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-300 mb-3">Contact Info</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <Mail size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Contact email"
              value={draft.contact.email}
              onChange={(e) => updateField("contact.email", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3">
            <Phone size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Contact phone"
              value={draft.contact.phone}
              onChange={(e) => updateField("contact.phone", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 sm:col-span-2">
            <MapPin size={14} className="text-slate-500 shrink-0" />
            <input
              placeholder="Office address"
              value={draft.contact.address}
              onChange={(e) => updateField("contact.address", e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm tracking-wide bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] hover:shadow-[0_0_30px_rgba(34,211,238,0.55)] transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save Site Settings"}
        </button>
        {savedFlash && <span className="text-xs text-cyan-300 font-semibold">Saved — live across the site.</span>}
      </div>
      <p className="text-[11px] text-slate-500">
        Saved directly to Supabase (<code className="text-cyan-400">site_settings</code> table) — every visitor
        sees these changes, and they survive reloads.
      </p>
    </form>
  );
}
