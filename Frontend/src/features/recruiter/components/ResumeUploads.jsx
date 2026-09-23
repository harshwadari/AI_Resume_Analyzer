import { useCallback, useEffect, useRef, useState } from 'react';
import { listResumes, uploadResumes } from '../services/analysis.api';
import BulkResumeImport from './BulkResumeImport';
import ProcessingProgress from './ProcessingProgress';

export default function ResumeUploads({ analysisId }) {
  const [state, setState] = useState({ resumes: [], total: 0, page: 1, pageSize: 50 });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const request = useRef(null);
  const picker = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    listResumes(analysisId, 1, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState(result);
    }).catch(() => { if (!controller.signal.aborted) setError('Unable to load resumes. Refresh the list to retry.'); })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); request.current = null; } });
    return () => { controller.abort(); request.current?.abort(); };
  }, [analysisId]);
  const refresh = useCallback(async (page = 1, silent = false) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const result = await listResumes(analysisId, page, { signal: controller.signal });
      if (!controller.signal.aborted) setState(result);
    } catch { if (!controller.signal.aborted) setError('Unable to load resumes. Refresh the list to retry.'); }
    finally { if (!controller.signal.aborted) { setLoading(false); request.current = null; } }
   }, [analysisId]);
  const upload = async () => {
    if (request.current || !files.length) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setMessage('');
    try {
      const records = await uploadResumes(analysisId, files, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFiles([]); if (picker.current) picker.current.value = '';
      setMessage(`${records.length} resume${records.length === 1 ? '' : 's'} uploaded and ready for background processing.`);
      const result = await listResumes(analysisId, 1, { signal: controller.signal });
      if (!controller.signal.aborted) setState(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || 'Could not confirm the upload/list. Refresh the list before retrying to avoid duplicates.');
    } finally { if (!controller.signal.aborted) { setBusy(false); request.current = null; } }
   };
  const onProgress = useCallback(job => { if (job) refresh(state.page, true); }, [refresh, state.page]);
  return <section aria-label="Analysis resumes" className="mt-8 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
    <h3 className="text-lg font-semibold">Candidate resumes</h3>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Upload 1–10 PDFs at a time, up to 5 MB each. Files are stored privately. Start processing below to extract resume text.</p>
    <label className="mt-4 block text-sm font-medium">Choose resume PDFs<input ref={picker} type="file" accept=".pdf,application/pdf" multiple disabled={busy || loading} className="mt-2 block w-full text-sm" onChange={event => {
      const selected = Array.from(event.target.files || []);
      setFiles([]); setError(''); setMessage('');
      if (selected.length > 10 || selected.some(file => !/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf') || file.size > 5 * 1024 * 1024)) {
        setError('Choose 1–10 PDF files, each 5 MB or smaller.'); event.target.value = ''; return;
      }
      setFiles(selected);
    }} /></label>
    {files.length > 0 && <p className="mt-2 break-words text-sm">Selected: {files.map(file => file.name).join(', ')}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={busy || loading || !files.length} onClick={upload} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Uploading resumes…' : 'Upload resumes'}</button>
      <button type="button" disabled={busy || loading} onClick={() => refresh()} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">Refresh resumes</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">{message}</p>}
    <BulkResumeImport analysisId={analysisId} disabled={busy || loading} onBusyChange={setBusy} onImported={() => refresh()} />
    <ProcessingProgress analysisId={analysisId} onProgress={onProgress} />
    {loading ? <p role="status" className="mt-4 text-sm">Loading resumes…</p> : <>
      <p className="mt-4 text-sm font-semibold">{state.total} uploaded resume{state.total === 1 ? '' : 's'}</p>
      <ul className="mt-3 space-y-3">{state.resumes.map(resume => <li key={resume.id} className="rounded-xl bg-slate-500/5 p-3 text-sm">
        <p className="break-all font-medium">{resume.originalFilename}</p>
        <p className="mt-1">{resume.processingStatus} · {Math.ceil(resume.size / 1024)} KB</p>
        {resume.processingStatus === 'OCR_REQUIRED' && <p className="mt-1 text-amber-800 dark:text-amber-300">OCR required: no usable text was found. Upload a text-based PDF to extract this resume’s text. Automatic OCR is not available yet.</p>}
        {resume.processingError && <p className="mt-1 text-rose-700 dark:text-rose-300">{resume.processingError} (Attempts: {resume.attempts})</p>}
        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">ID: {resume.id} · {new Date(resume.createdAt).toLocaleString()}</p>
      </li>)}</ul>
      {state.total > state.pageSize && <div className="mt-4 flex items-center gap-4 text-sm"><button type="button" disabled={busy || state.page <= 1} onClick={() => refresh(state.page - 1)}>Previous</button><span>Page {state.page} of {Math.ceil(state.total / state.pageSize)}</span><button type="button" disabled={busy || state.page * state.pageSize >= state.total} onClick={() => refresh(state.page + 1)}>Next</button></div>}
    </>}
  </section>;
}
