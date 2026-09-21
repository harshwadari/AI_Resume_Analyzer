import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Plus, X } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { Link } from 'react-router-dom';
import { createAnalysis } from '../services/analysis.api';
import { jdTextError, JD_MAX_LENGTH } from '../utils/jdValidation';
import { analysisDraftReducer, createAnalysisDraft, topKError } from '../state/analysisDraft';

const steps = ['Job Description', 'Candidate Resumes', 'Result configuration', 'Start analysis'];
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
  const [saveError, setSaveError] = useState('');
  const saveRequest = useRef(null);
  const heading = useRef(null);
  const previousStep = useRef(0);
  const { analysis, step } = state;
  const configError = topKError(state);
  const jdError = jdTextError(analysis.jd.text);

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
      const saved = await createAnalysis(analysis.jd.text, { signal: controller.signal });
      if (!controller.signal.aborted) dispatch({ type: 'saved', analysis: saved });
    } catch (error) {
      if (!controller.signal.aborted && error.code !== 'ERR_CANCELED') setSaveError(error.response?.data?.message || 'Unable to confirm the save. Please try again.');
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      saveRequest.current = null;
    }
  };

  const selectResumes = event => {
    const files = Array.from(event.target.files || []);
    const pdfs = files.filter(file => /\.pdf$/i.test(file.name));
    setFileError(pdfs.length !== files.length ? 'Only PDF files can be selected for this preview. Other files were skipped.' : '');
    dispatch({ type: 'addResumes', files: pdfs });
    event.target.value = '';
  };

  return <section aria-labelledby="recruiter-page-title" className="glass-panel-strong overflow-hidden rounded-[32px]">
    <div className="border-b border-slate-200/70 p-6 sm:p-8 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">Create an analysis</p>
      <h2 id="recruiter-page-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">New Candidate Analysis</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">Save the original job description, then preview resume selection and result preferences.</p>
      <p className="mt-4 rounded-xl bg-fuchsia-500/5 px-4 py-3 text-xs leading-6 text-slate-600 dark:text-slate-300">Only the JD is saved to your analysis. Resume selections and result preferences remain a preview and clear when you leave or refresh. No processing takes place.</p>
      {state.savedAnalysis && <p role="status" className="mt-3 break-all text-sm text-emerald-800 dark:text-emerald-300">JD saved as draft. Analysis ID: {state.savedAnalysis.id}. <Link to={`/recruiter/analysis/${state.savedAnalysis.id}`} className="font-semibold underline">View saved original</Link></p>}
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
        <label htmlFor="analysis-jd" className="text-sm font-medium">Job description text</label>
        <textarea id="analysis-jd" value={analysis.jd.text} readOnly={Boolean(state.savedAnalysis) || saving} onBlur={() => setJdTouched(true)} onChange={event => { dispatch({ type: 'jd', text: event.target.value }); setSaveError(''); }} rows={9} placeholder="Paste the role, responsibilities, and candidate requirements…" aria-invalid={jdTouched && Boolean(jdError)} aria-describedby={`analysis-jd-help${jdTouched && jdError ? ' analysis-jd-error' : ''}`} className={`${inputClass} resize-y`} />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400"><p id="analysis-jd-help">100–20,000 characters. Surrounding whitespace does not count toward the minimum.</p><span>{analysis.jd.text.length.toLocaleString()} / {JD_MAX_LENGTH.toLocaleString()}</span></div>
        {jdTouched && jdError && <p id="analysis-jd-error" role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{jdError}</p>}
        {saveError && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{saveError}</p>}
        <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-400">The original text, including whitespace and line breaks, is preserved. Once saved, it is read-only. Create a new analysis for a different JD.</p>
        <details className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-semibold">Preview original JD</summary>
          <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">{analysis.jd.text || 'Paste a job description to preview it here.'}</pre>
        </details>
      </div>}

      {step === 1 && <div className="mt-5">
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">Choose one or more resume PDFs to preview your selection. You can also continue without files.</p>
        <div className="mt-4 rounded-2xl border border-dashed border-fuchsia-300 bg-fuchsia-500/5 p-5 sm:p-6 dark:border-fuchsia-500/30">
          <label htmlFor="analysis-resumes" className="flex items-center gap-2 text-sm font-semibold"><Plus size={17} aria-hidden="true" />Select resume PDFs</label>
          <input id="analysis-resumes" type="file" accept=".pdf,application/pdf" multiple onChange={selectResumes} aria-describedby="analysis-files-help" className="mt-4 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:font-medium file:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30" />
          <p id="analysis-files-help" className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-400">Files stay on your device. No text extraction or upload takes place. Folder and ZIP selection are coming later.</p>
        </div>
        {fileError && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{fileError}</p>}
        <p aria-live="polite" className="mt-5 text-sm font-medium">{analysis.resumes.length} resume{analysis.resumes.length === 1 ? '' : 's'} selected</p>
        <ul className="mt-3 space-y-2">
          {analysis.resumes.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <FileText size={18} className="shrink-0 text-fuchsia-600 dark:text-fuchsia-300" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-all text-sm">{file.name}<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{Math.max(1, Math.round(file.size / 1024))} KB</span></span>
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => dispatch({ type: 'removeResume', index })} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-500/30"><X size={18} aria-hidden="true" /></button>
          </li>)}
        </ul>
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
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Candidate resumes</dt><dd className="mt-1 text-sm">{analysis.resumes.length} selected · not uploaded</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Requested results</dt><dd className="mt-1 text-sm">{analysis.requestedTopK === null ? 'All candidates' : `Top ${analysis.requestedTopK} candidates`}</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Processing state</dt><dd className="mt-1 text-sm">Not started</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" disabled aria-describedby="analysis-start-help" className={`${buttonClass} bg-slate-500/15`}>Start analysis</button>
          <p id="analysis-start-help" className="text-xs leading-6 text-slate-600 dark:text-slate-400">Your JD is saved. Resume processing and saving result preferences are not available yet.</p>
        </div>
        {state.previewComplete && <div role="status" className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-800 dark:text-emerald-300"><Check size={19} className="mt-0.5 shrink-0" aria-hidden="true" />Preview complete. Your original JD is saved. No resumes were uploaded or processed, and result preferences are not saved.</div>}
      </div>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-6 dark:border-white/10">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)} className={`${buttonClass} border border-slate-200 hover:bg-slate-500/5 dark:border-white/15`}><ArrowLeft size={17} aria-hidden="true" />Back</button>
        {step < 3 ? <button type="button" disabled={saving || (step === 2 && Boolean(configError))} onClick={() => step === 0 && !state.savedAnalysis ? saveJD() : goToStep(step + 1)} className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{saving ? 'Saving…' : step === 0 && !state.savedAnalysis ? 'Save JD & continue' : 'Continue'}<ArrowRight size={17} aria-hidden="true" /></button>
          : <button type="button" disabled={state.previewComplete} onClick={() => dispatch({ type: 'finishPreview' })} className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{state.previewComplete ? 'Preview complete' : 'Finish preview'}</button>}
      </div>
    </div>
  </section>;
}
