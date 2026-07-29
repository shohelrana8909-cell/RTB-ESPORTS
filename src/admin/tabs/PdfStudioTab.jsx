import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Folder, FolderPlus, Upload, FileText, Printer, Trash2, Type, X, Check,
  ChevronRight, Home, ZoomIn, ZoomOut, ChevronLeft, StickyNote, Save,
  Loader2, AlertTriangle, Pencil,
} from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { uid, FONT_FAMILIES, loadPdfEngines, deleteDocuments, uploadDocument, dbFolderToApp, dbFileToApp } from "../accounting/pdfEngine.js";

const BG = "#0D021A";
const CARD = "#171025";
const CARD_ALT = "#1E1730";
const BORDER = "#2E2545";
const ACCENT = "#8A2BE2";
const ACCENT_SOFT = "#8A2BE22A";
const TEXT = "#FFFFFF";
const MUTED = "#A79FC0";
const BAD = "#FF5C7A";
const DARKVIEW = "#0A0113";

export default function PdfStudioTab({ folders, setFolders, files, setFiles }) {
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
        const url = URL.createObjectURL(f);
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
    if (!file?.storagePath) return;
    try {
      await uploadDocument(file.storagePath, blob);
      const { error } = await supabase.from("studio_files").update({ notes: newNotes }).eq("id", fileId);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to save edited PDF to Supabase Storage:", err);
    }
  };

  const allFoldersFlat = folders.filter((f) => f.id !== "root");

  return (
    <div style={{ color: TEXT }}>
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
              <p className="text-xs" style={{ color: MUTED }}>{((f.size || 0) / 1024).toFixed(0)} KB</p>
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

  React.useEffect(() => {
    let cancelled = false;
    loadPdfEngines()
      .then(() => fetch(file.url))
      .then((r) => r.arrayBuffer())
      .then((buf) => window.pdfjsLib.getDocument({ data: buf }).promise)
      .then((doc) => { if (cancelled) return; docRef.current = doc; setNumPages(doc.numPages); setEngineReady(true); })
      .catch((err) => setError(err?.message || "Couldn't load the PDF editing engine (needs internet access)."));
    return () => { cancelled = true; };
  }, [file.url]);

  React.useEffect(() => {
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
