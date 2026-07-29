import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import {
  uid,
  DEFAULT_FOLDERS,
  dbFolderToApp,
  dbFileToApp,
  dbInvoiceToApp,
  appInvoiceToDbInsert,
  dbExpenseToApp,
  dbRemittanceToApp,
  uploadDocument,
  getSignedUrl,
} from "./pdfEngine.js";

export function useAccountingData() {
  const [folders, setFolders] = useState([{ id: "root", name: "All Files", parentId: null }]);
  const [files, setFiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [costing, setCosting] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setLoadError("");
      try {
        let { data: folderRows, error: folderErr } = await supabase.from("studio_folders").select("*");
        if (folderErr) throw folderErr;
        if (!folderRows || folderRows.length === 0) {
          const { data: created, error: seedErr } = await supabase
            .from("studio_folders")
            .insert(DEFAULT_FOLDERS.map((name) => ({ name, parent_id: null })))
            .select();
          if (seedErr) throw seedErr;
          folderRows = created || [];
        }
        const mappedFolders = [{ id: "root", name: "All Files", parentId: null }, ...folderRows.map(dbFolderToApp)];

        const { data: fileRows, error: fileErr } = await supabase.from("studio_files").select("*");
        if (fileErr) throw fileErr;
        const mappedFiles = await Promise.all(
          (fileRows || []).map(async (f) => dbFileToApp(f, await getSignedUrl(f.storage_path).catch(() => null)))
        );

        const { data: invRows, error: invErr } = await supabase
          .from("invoices")
          .select("*, event_expenses(*), bank_remittances(*)")
          .order("created_at", { ascending: true });
        if (invErr) throw invErr;
        const mappedInvoices = (invRows || []).map(dbInvoiceToApp);
        const mappedCosting = {};
        (invRows || []).forEach((row) => {
          mappedCosting[row.id] = {
            expenses: (row.event_expenses || []).map(dbExpenseToApp),
            remittances: (row.bank_remittances || []).map(dbRemittanceToApp),
          };
        });

        if (!cancelled) {
          setFolders(mappedFolders);
          setFiles(mappedFiles);
          setInvoices(mappedInvoices);
          setCosting(mappedCosting);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureCosting = useCallback(
    (invoiceId) => setCosting((prev) => (prev[invoiceId] ? prev : { ...prev, [invoiceId]: { expenses: [], remittances: [] } })),
    []
  );

  // Finds (or creates, in Supabase) a top-level folder by name, uploads the
  // blob into Storage under it, and registers a studio_files row — used for
  // invoices, remittance slips, and event reports landing in PDF Studio.
  const addFileToFolderByName = useCallback(
    async (folderName, { name, blob, size }) => {
      let target = folders.find((f) => f.name === folderName && f.parentId === "root");
      if (!target) {
        const { data, error } = await supabase.from("studio_folders").insert({ name: folderName, parent_id: null }).select().single();
        if (error) {
          console.error(error);
          return;
        }
        target = dbFolderToApp(data);
        setFolders((prev) => [...prev, target]);
      }
      const storagePath = `${target.name}/${uid()}-${name}`;
      try {
        await uploadDocument(storagePath, blob);
        const { data: fileRow, error } = await supabase
          .from("studio_files")
          .insert({ folder_id: target.id, name, storage_path: storagePath, size_bytes: size, notes: [] })
          .select()
          .single();
        if (error) throw error;
        const url = await getSignedUrl(storagePath).catch(() => URL.createObjectURL(blob));
        setFiles((prev) => [...prev, dbFileToApp(fileRow, url)]);
      } catch (err) {
        console.error("Failed to save file to Supabase Storage:", err);
      }
    },
    [folders]
  );

  const handleSaveInvoice = useCallback(async (inv) => {
    const { data, error } = await supabase.from("invoices").insert(appInvoiceToDbInsert(inv)).select().single();
    if (error) {
      console.error(error);
      return;
    }
    const saved = dbInvoiceToApp(data);
    setInvoices((prev) => [...prev, saved]);
    ensureCosting(saved.id);
    return saved;
  }, [ensureCosting]);

  return {
    folders, setFolders,
    files, setFiles,
    invoices, setInvoices,
    costing, setCosting,
    loading, loadError,
    addFileToFolderByName,
    handleSaveInvoice,
  };
}
