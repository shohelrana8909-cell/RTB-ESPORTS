import React, { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useSiteData } from "../../context/SiteDataContext.jsx";

function extractYoutubeId(input) {
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : input.trim();
}

export default function MediaTab() {
  const { videos, addVideo, removeVideo } = useSiteData();
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Highlights");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newVideoUrl.trim()) return;
    setAdding(true);
    await addVideo({
      youtubeId: extractYoutubeId(newVideoUrl),
      title: newTitle.trim() || "Untitled video",
      category: newCategory,
    });
    setAdding(false);
    setNewVideoUrl("");
    setNewTitle("");
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="grid sm:grid-cols-[2fr_1.3fr_1fr_auto] gap-2 mb-5">
        <input
          placeholder="YouTube URL or video ID"
          value={newVideoUrl}
          onChange={(e) => setNewVideoUrl(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
        />
        <input
          placeholder="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400/60"
        >
          <option>Highlights</option>
          <option>BTS</option>
          <option>Analysis</option>
        </select>
        <button disabled={adding} className="px-3 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-400 text-black flex items-center justify-center disabled:opacity-50">
          {adding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        </button>
      </form>

      <div className="space-y-2">
        {videos.map((v) => (
          <div key={v.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-lg p-2.5">
            <img
              src={`https://img.youtube.com/vi/${v.youtubeId}/default.jpg`}
              alt={v.title}
              className="w-16 h-10 object-cover rounded shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">{v.title}</p>
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">{v.category}</span>
            </div>
            <button onClick={() => removeVideo(v.id)} className="text-slate-500 hover:text-red-400 shrink-0 p-1.5">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {videos.length === 0 && <p className="text-sm text-slate-500">No videos yet — add one above.</p>}
      </div>

      <p className="text-[11px] text-slate-500 mt-4">
        Saved directly to Supabase (<code className="text-cyan-400">youtube_videos</code> table) — changes appear
        on the public Media Hub immediately and persist across reloads.
      </p>
    </div>
  );
}
