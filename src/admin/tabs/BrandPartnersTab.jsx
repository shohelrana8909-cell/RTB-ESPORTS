import React, { useState } from "react";
import { Plus, Trash2, Upload, Loader2, Handshake } from "lucide-react";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { supabase } from "../../supabaseClient.js";

const BRANDING_BUCKET = "branding"; // partner logos share the same public bucket as the site logo/favicon

export default function BrandPartnersTab() {
  const { partners, addPartner, removePartner } = useSiteData();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `partner-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (err) {
      alert(`Couldn't upload the logo: ${err?.message || err}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !logoUrl.trim()) {
      alert("Please add a name and a logo first.");
      return;
    }
    setSaving(true);
    await addPartner({ name: name.trim(), logoUrl: logoUrl.trim(), websiteUrl: websiteUrl.trim() });
    setSaving(false);
    setName("");
    setWebsiteUrl("");
    setLogoUrl("");
  }

  async function handleDelete(id) {
    setDeletingId(id);
    await removePartner(id);
    setDeletingId(null);
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Partner name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Garena, bKash, Walton"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Website (optional)</label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Logo</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://... (logo URL)"
              className="flex-1 min-w-[200px] bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-3 py-2.5 cursor-pointer hover:border-cyan-400/40 whitespace-nowrap">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Uploading…" : "Upload logo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            {logoUrl && <img src={logoUrl} alt="Logo preview" className="h-10 w-10 object-contain rounded bg-white/90 p-1" />}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(90deg, #7000FF, #00F0FF)" }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add partner
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {partners.map((p) => (
          <div key={p.id} className="relative rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center text-center group">
            <img src={p.logoUrl} alt={p.name} className="h-12 w-full object-contain mb-2 bg-white/90 rounded p-1" />
            <p className="text-xs font-semibold text-slate-200 truncate w-full">{p.name}</p>
            <button
              onClick={() => handleDelete(p.id)}
              disabled={deletingId === p.id}
              className="absolute top-1.5 right-1.5 text-slate-500 hover:text-red-400 bg-black/40 rounded-full p-1 opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {deletingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ))}
        {partners.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full flex items-center gap-1.5">
            <Handshake size={14} /> No partners yet — add one above.
          </p>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-4">
        Saved directly to Supabase (<code className="text-cyan-400">brand_partners</code> table, logos in the{" "}
        <code className="text-cyan-400">branding</code> bucket) — changes appear in the public Brand Partners bar
        immediately and persist across reloads.
      </p>
    </div>
  );
}
