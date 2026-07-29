import React, { useState } from "react";
import { Plus, Trash2, Upload, Loader2, Users } from "lucide-react";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { supabase } from "../../supabaseClient.js";

const BRANDING_BUCKET = "branding"; // team photos share the same public bucket as the site logo/favicon

const EMPTY_FORM = { name: "", role: "", photoUrl: "", instagramUrl: "", facebookUrl: "", phone: "" };

export default function TeamTab() {
  const { teamMembers, addTeamMember, removeTeamMember } = useSiteData();
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `team-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
      update("photoUrl", data.publicUrl);
    } catch (err) {
      alert(`Couldn't upload the photo: ${err?.message || err}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Please add a name first.");
      return;
    }
    setSaving(true);
    await addTeamMember({
      name: form.name.trim(),
      role: form.role.trim(),
      photoUrl: form.photoUrl.trim(),
      instagramUrl: form.instagramUrl.trim(),
      facebookUrl: form.facebookUrl.trim(),
      phone: form.phone.trim(),
    });
    setSaving(false);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id) {
    setDeletingId(id);
    await removeTeamMember(id);
    setDeletingId(null);
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Name</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Shanto Wahidur"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Role</label>
            <input
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="e.g. Director, Caster, CTO, Member"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Photo</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={form.photoUrl}
              onChange={(e) => update("photoUrl", e.target.value)}
              placeholder="https://... (photo URL)"
              className="flex-1 min-w-[200px] bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-3 py-2.5 cursor-pointer hover:border-cyan-400/40 whitespace-nowrap">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            {form.photoUrl && <img src={form.photoUrl} alt="Preview" className="h-10 w-10 object-cover rounded-full" />}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <input
            value={form.instagramUrl}
            onChange={(e) => update("instagramUrl", e.target.value)}
            placeholder="Instagram URL (optional)"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
          />
          <input
            value={form.facebookUrl}
            onChange={(e) => update("facebookUrl", e.target.value)}
            placeholder="Facebook URL (optional)"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
          />
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="Phone (optional)"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(90deg, #7000FF, #00F0FF)" }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add team member
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {teamMembers.map((m) => (
          <div key={m.id} className="relative rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center text-center group">
            {m.photoUrl ? (
              <img src={m.photoUrl} alt={m.name} className="h-16 w-16 object-cover rounded-full mb-2" />
            ) : (
              <div className="h-16 w-16 rounded-full mb-2 bg-white/10 flex items-center justify-center">
                <Users size={22} className="text-slate-500" />
              </div>
            )}
            <p className="text-xs font-semibold text-slate-200 truncate w-full">{m.name}</p>
            {m.role && <p className="text-[10px] uppercase tracking-wide text-cyan-400 font-bold">{m.role}</p>}
            <button
              onClick={() => handleDelete(m.id)}
              disabled={deletingId === m.id}
              className="absolute top-1.5 right-1.5 text-slate-500 hover:text-red-400 bg-black/40 rounded-full p-1 opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {deletingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ))}
        {teamMembers.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full flex items-center gap-1.5">
            <Users size={14} /> No team members yet — add one above.
          </p>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-4">
        Saved directly to Supabase (<code className="text-cyan-400">team_members</code> table) — changes appear in
        the public "Our Team" section immediately and persist across reloads.
      </p>
    </div>
  );
}
