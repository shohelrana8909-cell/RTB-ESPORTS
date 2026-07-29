import React, { useState } from "react";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { useSiteData } from "../../context/SiteDataContext.jsx";
import { supabase } from "../../supabaseClient.js";

const GALLERY_BUCKET = "gallery";

export default function GalleryTab() {
  const { photos, addPhoto, removePhoto } = useSiteData();
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newCategory, setNewCategory] = useState("Stage");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleAddByUrl(e) {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;
    await addPhoto({ url: newPhotoUrl.trim(), category: newCategory });
    setNewPhotoUrl("");
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(GALLERY_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
      await addPhoto({ url: data.publicUrl, category: newCategory });
    } catch (err) {
      alert(`Couldn't upload the photo: ${err?.message || err}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    await removePhoto(id);
    setDeletingId(null);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <form onSubmit={handleAddByUrl} className="flex-1 flex gap-2">
          <input
            placeholder="Paste photo URL"
            value={newPhotoUrl}
            onChange={(e) => setNewPhotoUrl(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
          >
            <option>Stage</option>
            <option>Crowd</option>
            <option>Players</option>
          </select>
          <button className="px-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-400 text-black shrink-0">
            <Plus size={18} />
          </button>
        </form>
        <label className="flex items-center justify-center gap-2 text-xs text-slate-400 border border-dashed border-white/15 rounded-lg px-4 py-2.5 cursor-pointer hover:border-cyan-400/40 whitespace-nowrap">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
            <img src={p.url} alt={p.category} className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-300">{p.category}</span>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="text-slate-300 hover:text-red-400 bg-black/40 rounded-full p-1 disabled:opacity-50"
              >
                {deletingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="text-sm text-slate-500 col-span-full">No photos yet — add one above.</p>}
      </div>

      <p className="text-[11px] text-slate-500 mt-4">
        Uploaded files go to the public Supabase Storage <code className="text-cyan-400">gallery</code> bucket, and
        entries are saved in the <code className="text-cyan-400">gallery_photos</code> table — changes appear on
        the public Gallery immediately and persist across reloads.
      </p>
    </div>
  );
}
