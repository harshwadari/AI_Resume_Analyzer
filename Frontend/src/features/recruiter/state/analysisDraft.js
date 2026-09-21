// Page-local draft only. File references are never uploaded or persisted here.
export function createAnalysisDraft(recruiterId) {
  return {
    step: 0,
    previewComplete: false,
    resultMode: 'all',
    topKInput: '10',
    savedAnalysis: null,
    analysis: {
      recruiter: recruiterId,
      jd: { text: '', document: null },
      resumes: [],
      requestedTopK: null,
      processingState: 'not_started',
      rankingConfiguration: { criteria: [], weights: null },
      results: [],
    },
  };
}

export function topKError(state) {
  if (state.resultMode === 'all') return '';
  const value = Number(state.topKInput);
  if (!/^\d+$/.test(state.topKInput) || !Number.isSafeInteger(value) || value <= 0)
    return 'Enter a whole number greater than zero, or choose all candidates.';
  const count = Array.isArray(state.analysis.resumes) ? state.analysis.resumes.length : null;
  if (count !== null && value > count)
    return `Top-K cannot exceed the ${count} selected resume${count === 1 ? '' : 's'}. Choose all candidates or reduce Top-K.`;
  return '';
}

function syncRequestedTopK(state) {
  return { ...state, analysis: { ...state.analysis,
    requestedTopK: state.resultMode === 'top' && !topKError(state) ? Number(state.topKInput) : null } };
}

export function analysisDraftReducer(state, action) {
  const analysis = state.analysis;
  switch (action.type) {
    case 'step':
      return { ...state, step: Math.max(0, Math.min(3, action.step)), previewComplete: false };
    case 'jd':
      if (state.savedAnalysis) return state;
      return { ...state, previewComplete: false, analysis: { ...analysis, jd: { ...analysis.jd, text: action.text } } };
    case 'saved':
      return { ...state, savedAnalysis: action.analysis, step: 1,
        analysis: { ...analysis, id: action.analysis.id, recruiter: action.analysis.recruiter,
          jd: { ...analysis.jd, text: action.analysis.rawJDText, sourceType: action.analysis.sourceType } } };
    case 'addResumes': {
      const resumes = [...analysis.resumes];
      for (const file of action.files) {
        if (!resumes.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) resumes.push(file);
      }
      return syncRequestedTopK({ ...state, previewComplete: false, analysis: { ...analysis, resumes } });
    }
    case 'removeResume':
      return syncRequestedTopK({ ...state, previewComplete: false, analysis: { ...analysis, resumes: analysis.resumes.filter((_, index) => index !== action.index) } });
    case 'resultMode':
    case 'topK': {
      const next = { ...state, previewComplete: false,
        resultMode: action.type === 'resultMode' ? action.mode : state.resultMode,
        topKInput: action.type === 'topK' ? action.value : state.topKInput };
      return syncRequestedTopK(next);
    }
    case 'finishPreview':
      return topKError(state) ? state : { ...state, previewComplete: true };
    default:
      return state;
  }
}
