import { useEffect, useRef, useState } from 'react';
import { uploadResumes, uploadResumeZip } from '../services/analysis.api';
import { discoverFolder, uploadFolderBatches } from '../utils/folderFiles';

export default function BulkResumeImport({ analysisId, onImported, onBusyChange, disabled = false }) {
  const [queue, setQueue] = useState([]);
  const [zip, setZip] = useState(null);
  const [report, setReport] = useState(null);
  const [uploaded, setUploaded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const selectFolder = async event => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    setQueue([]); setZip(null); setReport(null); setUploaded(0); setError('');
    if (!files.length) return;
    if (files.length > 500) { setError('Select a folder containing at most 500 files.'); return; }
    const controller = new AbortController(); operation.current = controller; setBusy(true);
    try {
      const found = await discoverFolder(files, controller.signal);
      setQueue(found.valid); setReport(found);
    } catch { if (!controller.signal.aborted) setError('Unable to inspect this folder.'); }
    finally { if (!controller.signal.aborted) { setBusy(false); operation.current = null; } }
  };
  const upload = async () => {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError('');
    try {
      if (zip) {
        const result = await uploadResumeZip(analysisId, zip, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setReport(result); setUploaded(result.resumes.length); setZip(null);
        await onImported?.(result.resumes);
      } else {
        await uploadFolderBatches(queue,
          files => uploadResumes(analysisId, files, { signal: controller.signal }),
          async (records, count) => { setQueue(current => current.slice(count)); setUploaded(value => value + count); await onImported?.(records); }, controller.signal);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || 'Import stopped. Check saved resumes before retrying; the last batch may have been saved.');
    } finally { if (!controller.signal.aborted) { setBusy(false); operation.current = null; } }
  };
  const inputClass = 'mt-3 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:font-medium file:text-white';
  return <section aria-label="Folder and ZIP import" className="mt-5 rounded-2xl border border-dashed border-fuchsia-300 bg-fuchsia-500/5 p-5 dark:border-fuchsia-500/30">
    <h4 className="text-base font-semibold">Import a folder or ZIP</h4>
    <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">Up to 500 entries; PDFs up to 5 MB each. Folder PDFs upload in batches of 10. ZIP limit: 50 MB compressed, 100 MB expanded. Files are saved as UPLOADED; resume processing has not started.</p>
    <div className="mt-4 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Choose resume folder<input aria-label="Choose resume folder" type="file" webkitdirectory="" directory="" multiple disabled={disabled || busy} onChange={selectFolder} className={inputClass} /></label>
      <label className="text-sm font-medium">Choose resume ZIP<input aria-label="Choose resume ZIP" type="file" accept=".zip,application/zip" disabled={disabled || busy} className={inputClass} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        setZip(null); setQueue([]); setReport(null); setUploaded(0); setError('');
        if (!file) return;
        if (!/\.zip$/i.test(file.name) || file.size > 50 * 1024 * 1024) { setError('Choose a ZIP archive of 50 MB or smaller.'); return; }
        setZip(file);
      }} /></label>
    </div>
    {zip && <p className="mt-3 break-all text-sm">Selected ZIP: {zip.name}</p>}
    {report && <div className="mt-4 text-sm" aria-live="polite"><p>Total files: {report.totalFiles} · Valid PDFs: {report.validPDFs} · Rejected files: {report.rejected.length}</p><p className="mt-2">Queued: {queue.length} · Uploaded: {uploaded}</p>
      {report.rejected.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-medium">Rejected files</summary><ul className="mt-2 max-h-64 space-y-1 overflow-auto">{report.rejected.map((item, index) => <li key={index} className="break-all">{item.name}: {item.reason}</li>)}</ul></details>}
    </div>}
    <button type="button" disabled={disabled || busy || (!queue.length && !zip)} onClick={upload} className="mt-4 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Import in progress…' : zip ? 'Import ZIP' : 'Upload queued PDFs'}</button>
    {busy && <p role="status" className="mt-2 text-sm">Checking or uploading files. Completed batches remain saved.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
  </section>;
}
