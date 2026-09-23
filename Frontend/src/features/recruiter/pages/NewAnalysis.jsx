import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, FileText, FileUp, Plus, X } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { Link } from 'react-router-dom';
import { createAnalysis, createPdfAnalysis, uploadResumes } from '../services/analysis.api';
import { jdTextError, JD_MAX_LENGTH } from '../utils/jdValidation';
import { analysisDraftReducer, createAnalysisDraft, topKError } from '../state/analysisDraft';
import RequirementsReview from '../components/RequirementsReview';
import BulkResumeImport from '../components/BulkResumeImport';
import ProcessingProgress from '../components/ProcessingProgress';

const steps = ['Job Description', 'Candidate Resumes', 'Result configuration', 'Start analysis'];
const jdSources = [
  { value: 'text', label: 'Paste text', description: 'Copy and paste your job description.', icon: ClipboardPaste },
  { value: 'pdf', label: 'Upload PDF', description: 'Choose a PDF document up to 5 MB.', icon: FileUp },
];
const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 dark:border-white/15 dark:bg-slate-900/70 dark:text-white';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-50';

export default function NewAnalysis() {
  const { user } = useAuth();
  // Reset the entire draft if the authenticated account changes.
  return <AnalysisWizard key={user.id} recruiterId={user.id} />;
}

function AnalysisWizard({ recruiterId }) {
  const [state, dispatch] = useReducer(analysisDraftReducer, recruiterId, createAnalysisDraft);
  const [fileError, setFileError] = useState('');
  const [jdTouched, setJdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceType, setSourceType] = useState('text');
  const [jdPdf, setJdPdf] = useState(null);
  const [saveError, setSaveError] = useState('');
  const saveRequest = useRef(null);
  const heading = useRef(null);
  const previousStep = useRef(0);
  const { analysis, step } = state;
  const configError = topKError(state);
  const jdError = sourceType === 'pdf' && !state.savedAnalysis
    ? (!jdPdf ? 'Choose a JD PDF to upload.' : '') : jdTextError(analysis.jd.text);

  useEffect(() => () => saveRequest.current?.abort(), []);

  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);

  const goToStep = next => {
    if (saving) return;
    if (next > 0 && !state.savedAnalysis) {
      setJdTouched(true);
      setSaveError(jdError ? '' : 'Save the job description before continuing.');
      dispatch({ type: 'step', step: 0 });
      return;
    }
    if (next === 3 && configError) {
      dispatch({ type: 'step', step: 2 });
      return;
    }
    dispatch({ type: 'step', step: next });
  };

  const saveJD = async () => {
    setJdTouched(true);
    if (jdError || saveRequest.current) return;
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setSaveError('');
    try {
      const saved = sourceType === 'pdf'
        ? await createPdfAnalysis(jdPdf, { signal: controller.signal })
        : await createAnalysis(analysis.jd.text, { signal: controller.signal });
      if (!controller.signal.aborted) dispatch({ type: 'saved', analysis: saved });
    } catch (error) {
      if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setSaveError(error.response?.data?.message || 'Unable to confirm the save. Please try again.');
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      saveRequest.current = null;
    }
  };

  const uploadSelectedResumes = async () => {
    const files = analysis.resumes.filter(file => !file.id);
    if (!files.length || saveRequest.current) return;
    if (files.length > 10) { setFileError('Upload at most 10 PDFs per batch.'); return; }
    const controller = new AbortController(); saveRequest.current = controller;
    setSaving(true); setFileError('');
    try {
      const resumes = await uploadResumes(state.savedAnalysis.id, files, { signal: controller.signal });
      if (!controller.signal.aborted) dispatch({ type: 'uploadedResumes', files, resumes });
    } catch (error) {
      if (!controller.signal.aborted) setFileError(error.response?.data?.message || 'Could not confirm the upload. Check the saved analysis before retrying to avoid duplicates.');
    } finally { if (!controller.signal.aborted) setSaving(false); saveRequest.current = null; }
  };

  const selectResumes = event => {
    const files = Array.from(event.target.files || []);
    const pdfs = files.filter(file => /\.pdf$/i.test(file.name) && (!file.type || file.type === 'application/pdf') && file.size <= 5 * 1024 * 1024);
    setFileError(pdfs.length !== files.length ? 'Only PDF files up to 5 MB can be selected. Other files were skipped.' : '');
    if (analysis.resumes.filter(file => !file.id).length + pdfs.length > 10) { setFileError('Select at most 10 PDFs per upload batch.'); event.target.value = ''; return; }
    dispatch({ type: 'addResumes', files: pdfs });
    event.target.value = '';
  };

  return <section aria-labelledby="recruiter-page-title" className="glass-panel-strong overflow-hidden rounded-[32px]">
    <div className="border-b border-slate-200/70 p-6 sm:p-8 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">Create an analysis</p>
      <h2 id="recruiter-page-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">New Candidate Analysis</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">Save the original job description, then upload resumes and preview result preferences.</p>
      <p className="mt-4 rounded-xl bg-fuchsia-500/5 px-4 py-3 text-xs leading-6 text-slate-600 dark:text-slate-300">Your JD and uploaded resumes are saved to this analysis. Resume processing runs in a controlled background queue after you start it.</p>
      {state.savedAnalysis && <p role="status" className="mt-3 break-all text-sm text-emerald-800 dark:text-emerald-300">JD saved as draft. Analysis ID: {state.savedAnalysis.id}. <Link to={`/recruiter/analysis/${state.savedAnalysis.id}`} className="font-semibold underline">View saved original</Link></p>}
      {state.savedAnalysis && <RequirementsReview key={state.savedAnalysis.id} analysis={state.savedAnalysis} />}
      <nav aria-label="Analysis steps" className="mt-6">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((label, index) => <li key={label}>
            <button type="button" onClick={() => goToStep(index)} aria-current={step === index ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30 ${step === index ? 'border-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-800 dark:border-fuchsia-500/50 dark:text-fuchsia-200' : 'border-slate-200 text-slate-600 hover:bg-slate-500/5 dark:border-white/10 dark:text-slate-400'}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-500/10 text-xs">{index + 1}</span>{label}
            </button>
          </li>)}
        </ol>
      </nav>
    </div>

    <div className="p-6 sm:p-8">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Step {step + 1} of 4</p>
      <h3 ref={heading} tabIndex={-1} className="mt-2 text-xl font-semibold outline-none">{steps[step]}</h3>

      {step === 0 && <div className="mt-5">
        <fieldset disabled={saving || Boolean(state.savedAnalysis)} className="mb-6 min-w-0">
          <legend className="mb-3 text-sm font-semibold">Job description source</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {jdSources.map(({ value, label, description, icon: Icon }) => {
              const selected = sourceType === value;
              return <label key={value} className="relative block">
                <input type="radio" name="jd-source" value={value} checked={selected}
                  aria-labelledby={`jd-source-${value}-label`} aria-describedby={`jd-source-${value}-help`}
                  onChange={() => { setSourceType(value); setJdTouched(false); setSaveError(''); }} className="peer sr-only" />
                <span className="flex h-full cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white/50 p-4 transition hover:border-fuchsia-300 hover:bg-fuchsia-50/50 peer-checked:border-fuchsia-500 peer-checked:bg-fuchsia-50 peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-fuchsia-500/25 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-fuchsia-500/40 dark:hover:bg-fuchsia-500/5 dark:peer-checked:border-fuchsia-400/70 dark:peer-checked:bg-fuchsia-500/10">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${selected ? 'bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-500/20 dark:bg-fuchsia-500' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span id={`jd-source-${value}-label`} className={`block text-sm font-semibold ${selected ? 'text-fuchsia-900 dark:text-fuchsia-100' : 'text-slate-800 dark:text-slate-200'}`}>{label}</span>
                    <span id={`jd-source-${value}-help`} className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</span>
                  </span>
                  <Check size={17} strokeWidth={2.5} aria-hidden="true" className={`mt-0.5 shrink-0 text-fuchsia-600 transition-opacity dark:text-fuchsia-300 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                </span>
              </label>;
            })}
          </div>
        </fieldset>
        {sourceType === 'pdf' && <div className="mb-5 rounded-2xl border border-dashed border-fuchsia-300 bg-fuchsia-500/5 p-5 sm:p-6 dark:border-fuchsia-500/30">
          <label htmlFor="jd-pdf" className="flex items-center gap-2 text-sm font-semibold"><Plus size={17} aria-hidden="true" />Choose JD PDF</label>
          <input id="jd-pdf" type="file" accept=".pdf,application/pdf" disabled={saving || Boolean(state.savedAnalysis)} className="mt-4 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:font-medium file:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30" onChange={event => {
            const file = event.target.files?.[0];
            setJdPdf(null); setJdTouched(false); setSaveError('');
            if (!file) return;
            if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) { setSaveError('Choose a PDF file.'); event.target.value = ''; return; }
            if (file.size > 5 * 1024 * 1024) { setSaveError('JD PDF must be 5 MB or smaller.'); event.target.value = ''; return; }
            setJdPdf(file);
          }} />
          <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-400">Up to 5 MB and 50 pages. Use a readable, unencrypted PDF with 100–20,000 characters of text. Your original PDF is preserved; scanned images require pasted text.</p>
        </div>}
        {(sourceType === 'text' || state.savedAnalysis) && <>
        <label htmlFor="analysis-jd" className="text-sm font-medium">Job description text</label>
        <textarea id="analysis-jd" value={analysis.jd.text} readOnly={Boolean(state.savedAnalysis) || saving} onBlur={() => setJdTouched(true)} onChange={event => { dispatch({ type: 'jd', text: event.target.value }); setSaveError(''); }} rows={9} placeholder="Paste the role, responsibilities, and candidate requirements…" aria-invalid={jdTouched && Boolean(jdError)} aria-describedby={`analysis-jd-help${jdTouched && jdError ? ' analysis-jd-error' : ''}`} className={`${inputClass} resize-y`} />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400"><p id="analysis-jd-help">100–20,000 characters. Surrounding whitespace does not count toward the minimum.</p><span>{analysis.jd.text.length.toLocaleString()} / {JD_MAX_LENGTH.toLocaleString()}</span></div>
        </>}
        {jdTouched && jdError && <p id="analysis-jd-error" role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{jdError}</p>}
        {saveError && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{saveError}</p>}
        <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-400">The original text, including whitespace and line breaks, is preserved. Once saved, it is read-only. Create a new analysis for a different JD.</p>
        <details className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-semibold">Preview original JD</summary>
          <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">{analysis.jd.text || 'Paste a job description to preview it here.'}</pre>
        </details>
      </div>}

      {step === 1 && <div className="mt-5">
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">Choose up to 10 resume PDFs per upload batch, each 5 MB or smaller. You can also continue without files.</p>
        <div className="mt-4 rounded-2xl border border-dashed border-fuchsia-300 bg-fuchsia-500/5 p-5 sm:p-6 dark:border-fuchsia-500/30">
          <label htmlFor="analysis-resumes" className="flex items-center gap-2 text-sm font-semibold"><Plus size={17} aria-hidden="true" />Select resume PDFs</label>
          <input id="analysis-resumes" type="file" accept=".pdf,application/pdf" multiple disabled={saving} onChange={selectResumes} aria-describedby="analysis-files-help" className="mt-4 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:font-medium file:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30" />
          <p id="analysis-files-help" className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-400">Click Upload resumes to save the selected PDFs privately. Use the folder or ZIP import below for larger selections.</p>
        </div>
        {fileError && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{fileError}</p>}
        <p aria-live="polite" className="mt-5 text-sm font-medium">{analysis.resumes.length} resume{analysis.resumes.length === 1 ? '' : 's'} selected</p>
        <ul className="mt-3 space-y-2">
          {analysis.resumes.map((file, index) => <li key={file.id || `${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <FileText size={18} className="shrink-0 text-fuchsia-600 dark:text-fuchsia-300" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-all text-sm">{file.name}{file.id && <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-300">{file.processingStatus}</span>}<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span></span>
            {!file.id && <button type="button" disabled={saving} aria-label={`Remove ${file.name}`} onClick={() => dispatch({ type: 'removeResume', index })} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30"><X size={18} aria-hidden="true" /></button>}
          </li>)}
        </ul>
        <button type="button" disabled={saving || !analysis.resumes.some(file => !file.id)} onClick={uploadSelectedResumes} className={`${buttonClass} mt-4 bg-fuchsia-600 text-white disabled:opacity-50`}>{saving ? 'Uploading resumes…' : 'Upload resumes'}</button>
        <p role="status" className="mt-3 text-sm">{analysis.resumes.filter(file => file.id).length} uploaded · {analysis.resumes.filter(file => !file.id).length} awaiting upload</p>
        <BulkResumeImport analysisId={state.savedAnalysis.id} disabled={saving} onBusyChange={setSaving} onImported={resumes => dispatch({ type: 'importedResumes', resumes })} />
      </div>}

      {step === 2 && <div className="mt-5 space-y-6">
        <fieldset>
          <legend className="text-sm font-medium">How many candidates would you like to see?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[['all', 'All candidates', 'Return every candidate in ranked order.'], ['top', 'Top candidates', 'Choose the maximum number of results.']].map(([value, label, description]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${state.resultMode === value ? 'border-fuchsia-400 bg-fuchsia-500/5 dark:border-fuchsia-500/50' : 'border-slate-200 dark:border-white/10'}`}>
              <input type="radio" name="result-mode" value={value} checked={state.resultMode === value} onChange={() => dispatch({ type: 'resultMode', mode: value })} className="mt-1 accent-fuchsia-600" />
              <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-6 text-slate-600 dark:text-slate-400">{description}</span></span>
            </label>)}
          </div>
          {state.resultMode === 'top' && <div className="mt-4 max-w-xs">
            <label htmlFor="analysis-top-k" className="text-sm font-medium">Requested Top-K</label>
            <input id="analysis-top-k" type="number" min="1" step="1" value={state.topKInput} onChange={event => dispatch({ type: 'topK', value: event.target.value })} aria-invalid={Boolean(configError)} aria-describedby={configError ? 'analysis-top-k-error' : undefined} className={inputClass} />
            {configError && <p id="analysis-top-k-error" role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{configError}</p>}
          </div>}
        </fieldset>
        <p className="text-xs leading-6 text-slate-600 dark:text-slate-400">Top-K limits the results returned, not the resumes considered. It cannot exceed the number of selected resume PDFs.</p>
        <div className="rounded-xl bg-slate-500/5 p-4"><h4 className="text-sm font-semibold">Ranking preferences</h4><p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-400">Ranking criteria and weights will be configured in a later step of development. No ranking is applied in this preview.</p></div>
      </div>}

      {step === 3 && <div className="mt-5">
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">Review your draft before completing the preview. You can go back to edit any section.</p>
        <dl className="mt-5 grid gap-5 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2 dark:border-white/10">
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Job description</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{analysis.jd.text.trim() ? `${analysis.jd.text.trim().slice(0, 220)}${analysis.jd.text.trim().length > 220 ? '…' : ''}` : 'Not provided'}</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Candidate resumes</dt><dd className="mt-1 text-sm">{analysis.resumes.length} selected · {analysis.resumes.filter(file => file.id).length} uploaded</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Requested results</dt><dd className="mt-1 text-sm">{analysis.requestedTopK === null ? 'All candidates' : `Top ${analysis.requestedTopK} candidates`}</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Processing state</dt><dd className="mt-1 text-sm">See live progress below</dd></div>
        </dl>
        {state.savedAnalysis && <ProcessingProgress analysisId={state.savedAnalysis.id} />}
        {state.savedAnalysis && <Link to={`/recruiter/analysis/${state.savedAnalysis.id}`} className="mt-4 inline-block text-sm font-semibold text-fuchsia-700 underline dark:text-fuchsia-300">View all resumes and individual failures</Link>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" disabled aria-describedby="analysis-start-help" className={`${buttonClass} bg-slate-500/15`}>Start analysis</button>
        </div>
        <p id="analysis-start-help" className="mt-4 text-xs leading-6 text-slate-600 dark:text-slate-400">Background processing extracts resume text with bounded worker concurrency. Matching and ranking are added in a later checkpoint.</p>
        {state.previewComplete && <div role="status" className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-800 dark:text-emerald-300"><Check size={19} className="mt-0.5 shrink-0" aria-hidden="true" />Preview complete. Your original JD and uploaded resumes are saved. Resume progress is shown above; result preferences are not saved.</div>}
      </div>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-6 dark:border-white/10">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)} className={`${buttonClass} border border-slate-200 hover:bg-slate-500/5 dark:border-white/15`}><ArrowLeft size={17} aria-hidden="true" />Back</button>
        {step < 3 ? <button type="button" disabled={saving || (step === 2 && Boolean(configError))} onClick={() => step === 0 && !state.savedAnalysis ? saveJD() : goToStep(step + 1)} className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{saving ? 'Saving…' : step === 0 && !state.savedAnalysis ? 'Save JD & continue' : 'Continue'}<ArrowRight size={17} aria-hidden="true" /></button>
          : <button type="button" disabled={state.previewComplete} onClick={() => dispatch({ type: 'finishPreview' })} className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{state.previewComplete ? 'Preview complete' : 'Finish preview'}</button>}
      </div>
    </div>
  </section>;
}
